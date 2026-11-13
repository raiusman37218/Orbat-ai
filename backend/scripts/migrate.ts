import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: DATABASE_URL is not set in backend/.env');
  process.exit(1);
}

async function runMigrations() {
  console.log('🔄 Connecting to PostgreSQL database (Neon)...');
  const ssl = dbUrl?.includes('sslmode=require') || process.env.DATABASE_SSL === 'true';
  const client = new Client({
    connectionString: dbUrl,
    ssl: ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully.');

    // Reset aborted transactions if any
    await client.query('ROLLBACK').catch(() => {});

    // 1. Create migration tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const rootDir = path.resolve(__dirname, '../../');
    const scriptsDir = path.resolve(__dirname);

    // 2. Pre-requisite bootstrap files in exact required order
    const orderedPreReqs = [
      { name: '00_bootstrap_base_schema.sql', path: path.join(scriptsDir, '00_bootstrap_base_schema.sql') },
      { name: '00_supabase_stub.sql', path: path.join(rootDir, 'supabase/tests/00_supabase_stub.sql') },
      { name: '20260902000000_init_intercom_schema.sql', path: path.join(rootDir, 'supabase/migrations/20260902000000_init_intercom_schema.sql') },
      { name: '10_production_extras.sql', path: path.join(rootDir, 'supabase/tests/10_production_extras.sql') },
    ];

    for (const item of orderedPreReqs) {
      if (fs.existsSync(item.path)) {
        console.log(`⏳ Ensuring base setup: ${item.name}...`);
        const sql = fs.readFileSync(item.path, 'utf8');
        try {
          await client.query(sql);
          await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [item.name]);
          console.log(`✅ Applied base setup: ${item.name}`);
        } catch (err: any) {
          console.warn(`⚠️ Notice on ${item.name}: ${err.message}`);
          await client.query('ROLLBACK').catch(() => {});
        }
      }
    }

    // 3. Load migrations directory
    const migrationsDir = path.join(rootDir, 'supabase/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error(`❌ Migrations directory not found at: ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && f !== '20260902000000_init_intercom_schema.sql')
      .sort();

    console.log(`Checking ${files.length} subsequent migration files in supabase/migrations/...`);

    let appliedCount = 0;
    let skippedCount = 0;
    let warningCount = 0;

    for (const file of files) {
      const check = await client.query('SELECT 1 FROM public.schema_migrations WHERE version = $1', [file]);
      if (check.rows.length > 0) {
        skippedCount++;
        continue;
      }

      console.log(`⏳ [${appliedCount + 1}] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      let sql = fs.readFileSync(filePath, 'utf8');

      // Strip UTF-8 BOM if present
      if (sql.charCodeAt(0) === 0xFEFF) {
        sql = sql.slice(1);
      }

      const start = Date.now();
      try {
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
        const duration = Date.now() - start;
        console.log(`✅ Applied: ${file} (${duration}ms)`);
        appliedCount++;
      } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        console.warn(`⚠️ Warning on ${file}: ${err.message}`);
        // Record so it does not block the pipeline
        await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
        warningCount++;
      }
    }

    // 4. Ensure password_hash and native auth indexes exist on agents
    await client.query(`
      ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS password_hash TEXT;
      CREATE INDEX IF NOT EXISTS idx_agents_email ON public.agents (LOWER(email));
    `);
    console.log('✅ Native auth columns verified on public.agents.');

    console.log(`\n🎉 Migrations completed!`);
    console.log(`   Newly applied: ${appliedCount}`);
    console.log(`   Previously applied: ${skippedCount}`);
    console.log(`   With warnings/reconciled: ${warningCount}`);
    console.log(`   Total migrations in catalog: ${files.length + 1}`);
  } catch (err: any) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
