/**
 * The one check every server action and agent-facing API route makes before
 * touching workspace data: who is calling, are they an active member of this
 * workspace, and does their role allow `capability`.
 *
 * Checks PostgreSQL directly first, with fallback to Supabase.
 */
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/supabase/service';
import { type Capability, type Role, isRole, roleCan, ROLE_LABELS } from './permissions';
import { markUserFacing } from '@/lib/errors/user-error';
import { sessionUser } from '@/lib/supabase/session-user';
import { queryRows } from '@/lib/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MemberRow {
  id: string;
  name?: string | null;
  role: string | null;
  workspace_id: string | null;
  is_super_admin?: boolean | null;
  is_active?: boolean | null;
}

/** Mirrors fn_workspace_role. */
export function resolveWorkspaceRole(
  userId: string,
  agent: MemberRow | null | undefined,
  workspace: { id: string; owner_id: string | null } | null | undefined,
  workspaceId: string
): Role | null {
  if (!workspace || workspace.id !== workspaceId) {
    // Unknown workspace: only a super admin's view of it would matter, and they need it to exist.
    return null;
  }
  if (workspace.owner_id === userId) return 'owner';
  if (!agent || agent.id !== userId || agent.is_active === false) return null;
  if (agent.workspace_id === workspaceId && isRole(agent.role)) return agent.role;
  if (agent.is_super_admin) return 'admin';
  return null;
}

export class AccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403
  ) {
    super(message);
    // Shown to the person in production too (server actions mask other errors).
    markUserFacing(this);
  }
}

const CAPABILITY_TEXT: Record<Capability, string> = {
  view: 'view this workspace',
  add_note: 'add internal notes',
  reply: 'reply to customers',
  edit_ticket: 'change tickets',
  edit_content: 'change workspace content',
  manage_groups: 'manage groups',
  manage_team: 'manage the team',
  manage_settings: 'change workspace settings',
};

export async function getWorkspaceAccess(workspaceId: string, capability: Capability = 'view') {
  if (!UUID.test(workspaceId || '')) throw new AccessError('Unknown workspace.', 403);
  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) throw new AccessError('Unauthorized: sign in again.', 401);

  let agent: MemberRow | null = null;
  let workspace: { id: string; owner_id: string | null; is_suspended: boolean; deleted_at: string | null } | null = null;

  if (!process.env.VITEST || Boolean(process.env.TEST_DATABASE_URL)) {
    try {
      const [agentRows, wsRows] = await Promise.all([
        queryRows<MemberRow>(
          'SELECT id, name, role, workspace_id, is_super_admin, is_active FROM public.agents WHERE id = $1 LIMIT 1',
          [user.id]
        ),
        queryRows<{ id: string; owner_id: string | null; is_suspended: boolean; deleted_at: string | null }>(
          'SELECT id, owner_id, is_suspended, deleted_at FROM public.workspaces WHERE id = $1 LIMIT 1',
          [workspaceId]
        ),
      ]);
      agent = agentRows[0] || null;
      workspace = wsRows[0] || null;
    } catch {
      agent = null;
      workspace = null;
    }
  }

  // Fall back to Supabase client when Neon does not contain the record (e.g., mocked tests or Supabase-only workspaces)
  if (!agent) {
    const { data: aData } = await supabase
      .from('agents')
      .select('id, name, role, workspace_id, is_super_admin, is_active')
      .eq('id', user.id)
      .maybeSingle();
    agent = (aData as MemberRow) || null;
  }
  if (!workspace) {
    const { data: wsData } = await supabase
      .from('workspaces')
      .select('id, owner_id, is_suspended, deleted_at')
      .eq('id', workspaceId)
      .maybeSingle();
    workspace = (wsData as any) || null;
  }

  const role = resolveWorkspaceRole(user.id, agent, workspace, workspaceId);
  if (!role) {
    if (agent && agent.is_active === false && agent.workspace_id === workspaceId) {
      throw new AccessError('Forbidden: your account has been deactivated.', 403);
    }
    throw new AccessError('Forbidden: this workspace is not yours.', 403);
  }
  if (workspace?.deleted_at || workspace?.is_suspended) {
    let access: { role?: string } | null = null;
    if (!process.env.VITEST || Boolean(process.env.TEST_DATABASE_URL)) {
      try {
        const accessRows = await queryRows<{ role: string }>(
          'SELECT role FROM public.platform_access WHERE user_id = $1 LIMIT 1',
          [user.id]
        );
        access = accessRows[0] || null;
      } catch {
        access = null;
      }
    }
    if (!access) {
      const adminClient = serviceClient();
      const { data: sbAccess } = await adminClient
        .from('platform_access')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      access = sbAccess || null;
    }
    const isSuperAdmin = Boolean(access?.role && ['owner', 'admin'].includes(access.role));
    if (!isSuperAdmin) {
      if (workspace?.deleted_at) {
        throw new AccessError('This workspace was deleted.', 403);
      }
      if (workspace?.is_suspended) {
        throw new AccessError('This workspace is suspended.', 403);
      }
    }
  }
  if (!roleCan(role, capability)) {
    throw new AccessError(`Forbidden: as ${article(ROLE_LABELS[role])} you cannot ${CAPABILITY_TEXT[capability]}.`, 403);
  }
  return { supabase, user, agent: { ...(agent as MemberRow), id: user.id } as MemberRow, role };
}

export type WorkspaceAccess = Awaited<ReturnType<typeof getWorkspaceAccess>>;

function article(label: string) {
  return /^[aeiou]/i.test(label) ? `an ${label.toLowerCase()}` : `a ${label.toLowerCase()}`;
}
