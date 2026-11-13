import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('Tables in public schema:', tables.rows.map((r) => r.table_name));

  const cols = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'workspaces' ORDER BY ordinal_position"
  );
  console.log('Columns in workspaces table:', cols.rows.map((r) => r.column_name));
  await client.end();
}

check().catch(console.error);

