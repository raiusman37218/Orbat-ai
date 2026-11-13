import { createPgCompatClient, type PgCompatClient } from './query-client';
import { sessionUser } from '@/lib/auth/session-user';
import type { Database } from '@/types/database';

/**
 * Pure PostgreSQL request-scoped client. Resolves the authenticated Orbat AI
 * session user via HS256 JWT cookie/header so SQL queries and RPCs run with
 * authenticated `request.jwt.claim.sub` PostgreSQL session context.
 */
export async function createClient<_T = any>(): Promise<PgCompatClient> {
  const user = await sessionUser().catch(() => null);
  return createPgCompatClient({
    userId: user?.id ?? null,
    role: user ? 'authenticated' : 'anon',
  });
}

export type { Database, PgCompatClient };
