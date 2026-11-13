import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;

  constructor(private readonly configService: ConfigService) { }

  async onModuleInit() {
    const dbUrl = this.configService.get<string>('database.url');
    const ssl = this.configService.get<boolean>('database.ssl');
    const sslRejectUnauthorized =
      this.configService.get<boolean>('database.sslRejectUnauthorized') ?? true;
    const max = this.configService.get<number>('database.maxPoolSize');

    if (!dbUrl) {
      this.logger.warn('DATABASE_URL is not set. Database operations will fail until configured.');
      return;
    }

    const isVercel = this.configService.get<boolean>('isVercel') ?? (process.env.VERCEL === '1' || process.env.VERCEL === 'true');
    this.pool = new Pool({
      connectionString: dbUrl,
      ssl: ssl ? { rejectUnauthorized: sslRejectUnauthorized } : false,
      max: max || (isVercel ? 5 : 20),
      idleTimeoutMillis: isVercel ? 10000 : 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected idle client error in PostgreSQL pool:', err);
    });

    if (isVercel) {
      // Avoid extra synchronous round-trip latency on serverless cold starts
      return;
    }

    try {
      const res = await this.pool.query('SELECT NOW() as current_time, version() as version');
      this.logger.log(`Connected to PostgreSQL successfully. Version: ${res.rows[0]?.version?.split(' ')[1] || 'Unknown'}`);
    } catch (err: any) {
      this.logger.error(`Failed to connect to PostgreSQL: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('PostgreSQL pool closed.');
    }
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool is not initialized. Please check DATABASE_URL.');
    }
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        this.logger.warn(`Slow query (${duration}ms): ${text.slice(0, 100)}...`);
      }
      return res;
    } catch (err: any) {
      this.logger.error(`Database query failed: ${err.message} | Query: ${text.slice(0, 150)}`);
      throw err;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database pool is not initialized.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    if (!this.pool) {
      return { ok: false, latencyMs: 0, error: 'Database pool not initialized' };
    }
    const start = Date.now();
    try {
      await this.pool.query('SELECT 1');
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  }
}

