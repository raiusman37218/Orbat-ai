/* Server only: imported by the /app layout (a Server Component).

   The signed-in agent and their workspace for the app shell. Uses the same
   session check as every server action (`sessionUser()` verifies the JWT
   signature, expiry, token version and that the agent is active), then reads
   through the request-scoped pg client so row-level security applies. */

import { redirect } from 'next/navigation';
import { sessionUser } from '@/lib/auth/session-user';
import { createClient } from '@/lib/pg/server';
import { isRole } from '@/lib/team/permissions';
import { userError } from '@/lib/errors/user-error';
import type { AgentPresence, ShellSession } from './types';

export async function requireShellSession(returnTo: string): Promise<ShellSession> {
  const user = await sessionUser().catch(() => null);
  if (!user) redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);

  const db = await createClient();
  const { data: agent, error: agentError } = await db
    .from('agents')
    .select('id, name, email, avatar_url, role, status, workspace_id, is_super_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (agentError) {
    console.error('[App Shell] agent lookup failed:', agentError);
    throw userError('Could not load your account.');
  }
  // Signed in but no workspace yet: same place the old dashboard sends them.
  if (!agent?.workspace_id) redirect('/onboarding');

  const { data: workspace, error: workspaceError } = await db
    .from('workspaces')
    .select('id, name, logo_url')
    .eq('id', agent.workspace_id)
    .maybeSingle();

  if (workspaceError) {
    console.error('[App Shell] workspace lookup failed:', workspaceError);
    throw userError('Could not load your workspace.');
  }
  if (!workspace) redirect('/onboarding');

  const status: AgentPresence =
    agent.status === 'online' || agent.status === 'away' ? agent.status : 'offline';

  return {
    agent: {
      id: agent.id,
      name: agent.name || agent.email || 'You',
      email: agent.email ?? '',
      avatarUrl: agent.avatar_url ?? null,
      role: isRole(agent.role) ? agent.role : 'agent',
      status,
      isSuperAdmin: Boolean(agent.is_super_admin),
    },
    workspace: {
      id: workspace.id,
      name: workspace.name || 'Workspace',
      logoUrl: workspace.logo_url ?? null,
    },
  };
}
