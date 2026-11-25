/* Server only: imported by the /app layout (a Server Component).

   The signed-in agent and their workspace for the app shell. Uses the same
   session check as every server action (`sessionUser()` verifies the JWT
   signature, expiry, token version and that the agent is active), then reads
   through the request-scoped pg client so row-level security applies. */

import { redirect } from 'next/navigation';
import { sessionUser } from '@/lib/auth/session-user';
import { queryRows } from '@/lib/db';
import { createPgCompatClient } from '@/lib/pg/query-client';
import { isRole } from '@/lib/team/permissions';
import { userError } from '@/lib/errors/user-error';
import type { AgentPresence, ShellSession } from './types';

const SHELL_SESSION_TTL_MS = 15_000;
const SHELL_SESSION_CACHE_MAX = 500;

interface CachedShellEntry {
  session: ShellSession;
  expiresAt: number;
}

const globalForShellSession = globalThis as unknown as {
  __orbatShellSessionCache?: Map<string, CachedShellEntry>;
  __orbatShellSessionInFlight?: Map<string, Promise<ShellSession | null>>;
};

function getShellSessionCache(): Map<string, CachedShellEntry> {
  if (!globalForShellSession.__orbatShellSessionCache) {
    globalForShellSession.__orbatShellSessionCache = new Map();
  }
  return globalForShellSession.__orbatShellSessionCache;
}

function getShellSessionInFlight(): Map<string, Promise<ShellSession | null>> {
  if (!globalForShellSession.__orbatShellSessionInFlight) {
    globalForShellSession.__orbatShellSessionInFlight = new Map();
  }
  return globalForShellSession.__orbatShellSessionInFlight;
}

export function clearShellSessionCache(userId?: string): void {
  if (userId) {
    globalForShellSession.__orbatShellSessionCache?.delete(userId);
    globalForShellSession.__orbatShellSessionInFlight?.delete(userId);
  } else {
    globalForShellSession.__orbatShellSessionCache?.clear();
    globalForShellSession.__orbatShellSessionInFlight?.clear();
  }
}

async function loadShellSessionDirect(userId: string): Promise<ShellSession | null> {
  const rows = await queryRows<{
    agent_id: string;
    agent_name: string | null;
    agent_email: string | null;
    agent_avatar_url: string | null;
    agent_role: string | null;
    agent_status: string | null;
    agent_workspace_id: string | null;
    agent_is_super_admin: boolean | null;
    workspace_id: string | null;
    workspace_name: string | null;
    workspace_logo_url: string | null;
    platform_role: string | null;
  }>(
    `SELECT
       a.id::text AS agent_id,
       a.name AS agent_name,
       a.email AS agent_email,
       a.avatar_url AS agent_avatar_url,
       a.role AS agent_role,
       a.status AS agent_status,
       a.workspace_id::text AS agent_workspace_id,
       a.is_super_admin AS agent_is_super_admin,
       w.id::text AS workspace_id,
       w.name AS workspace_name,
       w.logo_url AS workspace_logo_url,
       pa.role AS platform_role
     FROM public.agents a
     LEFT JOIN public.workspaces w ON w.id = a.workspace_id
     LEFT JOIN public.platform_access pa ON pa.user_id = a.id
     WHERE a.id = $1
     LIMIT 1`,
    [userId],
  );

  const row = rows[0];
  if (!row || !row.agent_workspace_id || !row.workspace_id) {
    return null;
  }

  const status: AgentPresence =
    row.agent_status === 'online' || row.agent_status === 'away' ? row.agent_status : 'offline';
  const hasPlatformAccess = row.platform_role === 'owner' || row.platform_role === 'admin';

  return {
    agent: {
      id: row.agent_id,
      name: row.agent_name || row.agent_email || 'You',
      email: row.agent_email ?? '',
      avatarUrl: row.agent_avatar_url ?? null,
      role: isRole(row.agent_role) ? row.agent_role : 'agent',
      status,
      isSuperAdmin: Boolean(row.agent_is_super_admin) || hasPlatformAccess,
    },
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name || 'Workspace',
      logoUrl: row.workspace_logo_url ?? null,
    },
  };
}

export async function requireShellSession(returnTo: string): Promise<ShellSession> {
  const user = await sessionUser().catch(() => null);
  if (!user) redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);

  const useDirect = !process.env.VITEST || Boolean(process.env.TEST_DATABASE_URL);
  const useTtlCache = !process.env.VITEST;

  if (useDirect) {
    if (useTtlCache) {
      const cached = getShellSessionCache().get(user.id);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.session;
      }
    }

    const inFlight = getShellSessionInFlight();
    let pending = inFlight.get(user.id);
    if (!pending) {
      pending = loadShellSessionDirect(user.id)
        .then((session) => {
          if (session && useTtlCache) {
            const cache = getShellSessionCache();
            if (cache.size >= SHELL_SESSION_CACHE_MAX) {
              const oldest = cache.keys().next().value;
              if (oldest !== undefined) cache.delete(oldest);
            }
            cache.set(user.id, { session, expiresAt: Date.now() + SHELL_SESSION_TTL_MS });
          }
          return session;
        })
        .finally(() => {
          inFlight.delete(user.id);
        });
      inFlight.set(user.id, pending);
    }

    try {
      const directSession = await pending;
      if (directSession) return directSession;
      redirect('/onboarding');
    } catch (err: any) {
      // Re-throw Next.js redirect() control-flow errors immediately.
      if (err?.digest && String(err.digest).startsWith('NEXT_REDIRECT')) {
        throw err;
      }
      // Fall through to PgCompatClient fallback if direct SQL fails unexpectedly.
    }
  }

  const db = createPgCompatClient({
    userId: user.id,
    role: 'authenticated',
  });

  const agentPromise = db
    .from('agents')
    .select('id, name, email, avatar_url, role, status, workspace_id, is_super_admin')
    .eq('id', user.id)
    .maybeSingle();

  const accessPromise = db
    .from('platform_access')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const preloadedWorkspacePromise = user.workspaceId
    ? db
        .from('workspaces')
        .select('id, name, logo_url')
        .eq('id', user.workspaceId)
        .maybeSingle()
    : null;

  const [{ data: agent, error: agentError }, accessRes, preloadedWorkspaceRes] = await Promise.all([
    agentPromise,
    accessPromise,
    preloadedWorkspacePromise ?? Promise.resolve(null),
  ]);

  if (agentError) {
    console.error('[App Shell] agent lookup failed:', agentError);
    throw userError('Could not load your account.');
  }
  // Signed in but no workspace yet: same place the old dashboard sends them.
  if (!agent?.workspace_id) redirect('/onboarding');

  const workspaceRes =
    preloadedWorkspaceRes && agent.workspace_id === user.workspaceId
      ? preloadedWorkspaceRes
      : await db
          .from('workspaces')
          .select('id, name, logo_url')
          .eq('id', agent.workspace_id)
          .maybeSingle();

  const { data: workspace, error: workspaceError } = workspaceRes;

  if (workspaceError) {
    console.error('[App Shell] workspace lookup failed:', workspaceError);
    throw userError('Could not load your workspace.');
  }
  if (!workspace) redirect('/onboarding');

  const status: AgentPresence =
    agent.status === 'online' || agent.status === 'away' ? agent.status : 'offline';

  const hasPlatformAccess =
    accessRes.data?.role === 'owner' || accessRes.data?.role === 'admin';

  return {
    agent: {
      id: agent.id,
      name: agent.name || agent.email || 'You',
      email: agent.email ?? '',
      avatarUrl: agent.avatar_url ?? null,
      role: isRole(agent.role) ? agent.role : 'agent',
      status,
      isSuperAdmin: Boolean(agent.is_super_admin) || hasPlatformAccess,
    },
    workspace: {
      id: workspace.id,
      name: workspace.name || 'Workspace',
      logoUrl: workspace.logo_url ?? null,
    },
  };
}
