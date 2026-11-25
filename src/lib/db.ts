import { Pool, QueryResult, QueryResultRow } from 'pg';

const globalForPg = globalThis as unknown as {
  __orbatPgPool?: Pool | null;
};

export function getDbPool(): Pool {
  if (!globalForPg.__orbatPgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required to connect to PostgreSQL.');
    }

    const disableSsl =
      process.env.DB_SSL === 'false' || connectionString.includes('sslmode=disable');
    const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

    const pool = new Pool({
      connectionString,
      ssl: disableSsl ? false : { rejectUnauthorized },
      max: 20,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool] Unexpected error on idle client:', err);
    });

    globalForPg.__orbatPgPool = pool;
  }
  return globalForPg.__orbatPgPool;
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const pool = getDbPool();
  return pool.query<T>(text, params);
}

export async function queryRows<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await query<T>(text, params);
  return res.rows;
}
