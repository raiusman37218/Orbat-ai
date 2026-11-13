import { Pool, QueryResult } from 'pg';

let poolInstance: Pool | null = null;

export function getDbPool(): Pool {
  if (!poolInstance) {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://neondb_owner:npg_HAFi43YTWDot@ep-rapid-tree-b3mv8m3l-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

    poolInstance = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on('error', (err) => {
      console.error('[PostgreSQL Pool] Unexpected error on idle client:', err);
    });
  }
  return poolInstance;
}

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const pool = getDbPool();
  return pool.query<T>(text, params);
}

export async function queryRows<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await query<T>(text, params);
  return res.rows;
}
