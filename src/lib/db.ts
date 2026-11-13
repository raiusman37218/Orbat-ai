import { Pool, QueryResult, QueryResultRow } from 'pg';

let poolInstance: Pool | null = null;

export function getDbPool(): Pool {
  if (!poolInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required to connect to PostgreSQL.');
    }

    const disableSsl =
      process.env.DB_SSL === 'false' || connectionString.includes('sslmode=disable');
    const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

    poolInstance = new Pool({
      connectionString,
      ssl: disableSsl ? false : { rejectUnauthorized },
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

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const pool = getDbPool();
  return pool.query<T>(text, params);
}

export async function queryRows<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await query<T>(text, params);
  return res.rows;
}
