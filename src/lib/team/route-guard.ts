/**
 * Role checks for API routes called from the dashboard. Each returns the
 * caller's own Supabase session (so row level security and the database's
 * permission triggers apply too) or the response to send back.
 */
import { NextResponse } from 'next/server';
import { AccessError, getWorkspaceAccess, type WorkspaceAccess } from './access';
import type { Capability } from './permissions';
import { sessionUser } from '@/lib/supabase/session-user';
import { queryRows } from '@/lib/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Guarded = { ok: true; access: WorkspaceAccess } | { ok: false; response: NextResponse };

function refusal(err: unknown): NextResponse {
  if (err instanceof AccessError) return NextResponse.json({ error: err.message }, { status: err.status });
  return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
}

export async function guardWorkspace(workspaceId: unknown, capability: Capability): Promise<Guarded> {
  try {
    return { ok: true, access: await getWorkspaceAccess(String(workspaceId ?? ''), capability) };
  } catch (err) {
    return { ok: false, response: refusal(err) };
  }
}

/**
 * Checks the caller's role in the workspace the conversation belongs to.
 * Conversations the caller cannot see are reported as not found.
 */
export async function guardConversation(
  conversationId: unknown,
  capability: Capability
): Promise<(Guarded & { ok: true; workspaceId: string }) | { ok: false; response: NextResponse }> {
  const id = String(conversationId ?? '');
  if (!UUID.test(id)) return { ok: false, response: NextResponse.json({ error: 'Conversation not found' }, { status: 404 }) };
  // Look the workspace up via the caller's session + Neon / Supabase fallback.
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized: sign in again.' }, { status: 401 }) };

  let workspaceId: string | null = null;
  if (!process.env.VITEST || Boolean(process.env.TEST_DATABASE_URL)) {
    try {
      const convRows = await queryRows<{ workspace_id: string }>(
        'SELECT workspace_id FROM public.conversations WHERE id = $1 LIMIT 1',
        [id]
      );
      workspaceId = convRows[0]?.workspace_id || null;
    } catch {
      workspaceId = null;
    }
  }

  if (!workspaceId) {
    const { data: conv } = await supabase.from('conversations').select('workspace_id').eq('id', id).maybeSingle();
    workspaceId = (conv?.workspace_id as string | undefined) || null;
  }

  if (!workspaceId) return { ok: false, response: NextResponse.json({ error: 'Conversation not found' }, { status: 404 }) };
  const guarded = await guardWorkspace(workspaceId, capability);
  return guarded.ok ? { ok: true, access: guarded.access, workspaceId } : guarded;
}

/**
 * For routes that are not about one workspace's data (translate a snippet,
 * test SMTP settings): the caller must be an active member of the workspace
 * they work in, with `capability` there.
 */
export async function guardMember(capability: Capability): Promise<Guarded> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized: sign in again.' }, { status: 401 }) };

  let workspaceId: string | null = null;
  if (!process.env.VITEST || Boolean(process.env.TEST_DATABASE_URL)) {
    try {
      const [agentRows, ownedRows] = await Promise.all([
        queryRows<{ workspace_id: string | null }>(
          'SELECT workspace_id FROM public.agents WHERE id = $1 LIMIT 1',
          [user.id]
        ),
        queryRows<{ id: string }>(
          'SELECT id FROM public.workspaces WHERE owner_id = $1 LIMIT 1',
          [user.id]
        ),
      ]);
      workspaceId = agentRows[0]?.workspace_id ?? ownedRows[0]?.id ?? null;
    } catch {
      workspaceId = null;
    }
  }

  if (!workspaceId) {
    const [{ data: agent }, { data: owned }] = await Promise.all([
      supabase.from('agents').select('workspace_id').eq('id', user.id).maybeSingle(),
      supabase.from('workspaces').select('id').eq('owner_id', user.id).limit(1).maybeSingle(),
    ]);
    workspaceId = (agent?.workspace_id ?? owned?.id ?? null) as string | null;
  }

  if (!workspaceId) return { ok: false, response: NextResponse.json({ error: 'Forbidden: this workspace is not yours.' }, { status: 403 }) };
  return guardWorkspace(workspaceId, capability);
}
