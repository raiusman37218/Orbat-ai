import { createPgCompatClient, type PgCompatClient } from './query-client';
import type { Database } from '@/types/database';

export function hasServiceRole(): boolean {
  return Boolean(
    (process.env.DATABASE_URL || '').trim() ||
    (process.env.TEST_DATABASE_URL || '').trim()
  );
}

/**
 * Pure PostgreSQL service client using DATABASE_URL with `service_role` SQL context.
 */
export function serviceClient(): PgCompatClient {
  if (!hasServiceRole()) {
    throw new Error('DATABASE_URL is not configured on the server.');
  }
  return createPgCompatClient({ role: 'service_role' });
}

export type { Database, PgCompatClient };

