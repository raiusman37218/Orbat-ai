import crypto from 'crypto';
import type { PgCompatClient } from '@/lib/pg/query-client';
import { getDbPool } from '@/lib/db';
import { sessionUser } from '@/lib/auth/session-user';

export interface AutoRespondAuthResult {
  authorized: boolean;
  mode: 'internal_secret' | 'visitor_token' | 'agent_session' | 'grace_legacy' | 'enforced_denied';
  reason?: string;
}

export interface AutoRespondRpcClient {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: { authenticated?: boolean } | null; error: unknown }>;
  from?: PgCompatClient['from'];
}

export interface AdvisoryLockClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows?: Array<{ acquired?: boolean }> }>;
  release: () => void;
}

export interface AdvisoryLockPool {
  connect: () => Promise<AdvisoryLockClient>;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies the caller for /api/ai/auto-respond using:
 * 1) Trusted internal server secret (`x-internal-secret`), OR
 * 2) Widget visitor session token verified via `fn_widget_auth`, OR
 * 3) Authenticated dashboard agent belonging to the target workspace.
 *
 * During rollout of cached widget bundles that omit `visitor_token`, enforcement
 * is controlled by `ENFORCE_WIDGET_VISITOR_TOKEN === 'true'`.
 */
export async function verifyAutoRespondCaller(params: {
  request: Request;
  workspaceId: string;
  convVisitorId?: string | null;
  visitorToken?: unknown;
  supabase: PgCompatClient | AutoRespondRpcClient;
  resolveSessionAgent?: () => Promise<{ id: string } | null>;
}): Promise<AutoRespondAuthResult> {
  const internalHeader = params.request.headers.get('x-internal-secret')?.trim();
  const configuredSecrets = [
    process.env.INTERNAL_API_SECRET?.trim(),
    process.env.AI_INTERNAL_SECRET?.trim(),
  ].filter((v): v is string => Boolean(v));

  if (internalHeader && configuredSecrets.some((sec) => timingSafeEqualStr(internalHeader, sec))) {
    return { authorized: true, mode: 'internal_secret' };
  }

  const tokenFromHeader = params.request.headers.get('x-visitor-token')?.trim();
  const visitorToken =
    typeof params.visitorToken === 'string' && params.visitorToken.trim().length > 0
      ? params.visitorToken.trim()
      : tokenFromHeader;

  if (params.convVisitorId && visitorToken) {
    try {
      const { data: authRes, error } = await params.supabase.rpc('fn_widget_auth', {
        p_visitor_id: params.convVisitorId,
        p_visitor_token: visitorToken,
      });
      if (!error && authRes?.authenticated === true) {
        return { authorized: true, mode: 'visitor_token' };
      }
    } catch {
      // Fall through to agent session / enforcement check
    }
  }

  try {
    const user = params.resolveSessionAgent
      ? await params.resolveSessionAgent()
      : await sessionUser();
    if (user?.id && typeof params.supabase.from === 'function') {
      const { data: agent } = await params.supabase
        .from('agents')
        .select('id, workspace_id, is_active')
        .eq('id', user.id)
        .eq('workspace_id', params.workspaceId)
        .maybeSingle();
      if (agent && agent.is_active !== false) {
        return { authorized: true, mode: 'agent_session' };
      }
    }
  } catch {
    // Request may have no Next.js cookie context (e.g. direct API calls or unit tests)
  }

  if (process.env.ENFORCE_WIDGET_VISITOR_TOKEN === 'true') {
    return {
      authorized: false,
      mode: 'enforced_denied',
      reason: 'valid_visitor_token_or_internal_secret_required',
    };
  }

  console.warn('[Auto-Respond] Accepting legacy unauthenticated request during visitor_token grace window', {
    workspaceId: params.workspaceId,
    hasVisitorToken: Boolean(visitorToken),
  });
  return { authorized: true, mode: 'grace_legacy' };
}

export function advisoryLockKeysForConversation(conversationId: string): [number, number] {
  const digest = crypto.createHash('sha256').update(`auto_respond:${conversationId}`).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

/**
 * Coordinates single-flight execution across serverless/API instances using
 * PostgreSQL session advisory locks when DATABASE_URL is available.
 */
export async function withConversationAdvisoryLock<T>(
  conversationId: string,
  fn: () => Promise<T>,
  poolOverride?: AdvisoryLockPool,
): Promise<{ acquired: boolean; result?: T }> {
  if (!poolOverride && !process.env.DATABASE_URL) {
    return { acquired: true, result: await fn() };
  }

  const [k1, k2] = advisoryLockKeysForConversation(conversationId);
  let client: AdvisoryLockClient | null = null;
  let locked = false;

  try {
    const activePool: AdvisoryLockPool = poolOverride || getDbPool();
    client = await activePool.connect();
    const res = await client.query('SELECT pg_try_advisory_lock($1, $2) AS acquired', [k1, k2]);
    locked = Boolean(res?.rows?.[0]?.acquired);
    if (!locked) {
      return { acquired: false };
    }
    const result = await fn();
    return { acquired: true, result };
  } catch (err) {
    if (!locked) {
      console.warn('[Auto-Respond] PostgreSQL advisory lock unavailable, falling back:', (err as Error)?.message || err);
      return { acquired: true, result: await fn() };
    }
    throw err;
  } finally {
    if (client) {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [k1, k2]).catch(() => {});
      }
      client.release();
    }
  }
}
