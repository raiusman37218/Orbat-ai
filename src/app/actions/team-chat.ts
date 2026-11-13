'use server';

import { createClient } from '@/lib/pg/server';
import { getWorkspaceAccess } from '@/lib/team/access';
import { userError } from '@/lib/errors/user-error';
import type { TeamInboxRow, TeamMessage } from '@/types/database';

export async function getTeamInboxAction(
  workspaceId: string,
  sinceIso?: string | null,
): Promise<{ available: boolean; threads: TeamInboxRow[]; recentMessages: TeamMessage[] }> {
  const { supabase, user } = await getWorkspaceAccess(workspaceId);
  const { data, error } = await supabase.rpc('fn_team_inbox', { p_workspace_id: workspaceId });
  if (error) {
    if (/fn_team_inbox|PGRST202|42883|does not exist/i.test(`${error.code || ''} ${error.message || ''}`)) {
      return { available: false, threads: [], recentMessages: [] };
    }
    throw userError(error.message || 'Could not load team chat.');
  }

  const threads = ((data as TeamInboxRow[]) || []);
  let recentMessages: TeamMessage[] = [];

  if (sinceIso && threads.length > 0) {
    const visibleThreadIds = threads.map((t) => t.thread_id);
    const { data: newer } = await supabase
      .from('team_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('thread_id', visibleThreadIds)
      .gt('created_at', sinceIso)
      .neq('sender_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(20);
    recentMessages = ((newer as TeamMessage[]) || []);
  }

  return { available: true, threads, recentMessages };
}

export async function ensureTeamGeneralAction(workspaceId: string): Promise<string | null> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { data, error } = await supabase.rpc('fn_team_general', { p_workspace_id: workspaceId });
  if (error) throw userError(error.message || 'Could not initialize team General channel.');
  return (data as string | null) ?? null;
}

export async function openDirectTeamThreadAction(workspaceId: string, agentId: string): Promise<string> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { data, error } = await supabase.rpc('fn_team_open_direct', {
    p_workspace_id: workspaceId,
    p_agent_id: agentId,
  });
  if (error || !data) {
    throw userError(error?.message || 'Could not open that conversation.');
  }
  return data as string;
}

export async function markTeamThreadReadAction(workspaceId: string, threadId: string): Promise<void> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { error } = await supabase.rpc('fn_team_mark_read', { p_thread_id: threadId });
  if (error) throw userError(error.message || 'Could not mark thread read.');
}

async function assertCanSeeThread(
  supabase: Awaited<ReturnType<typeof createClient>>,
  threadId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('fn_team_can_see', { p_thread_id: threadId });
  if (error || !data) {
    throw userError('You do not have access to this team thread.');
  }
}

export async function listTeamMessagesAction(
  workspaceId: string,
  threadId: string,
  before?: string | null,
  limit = 40,
): Promise<TeamMessage[]> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  await assertCanSeeThread(supabase, threadId);

  let query = supabase
    .from('team_messages')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw userError(error.message || 'Messages could not be loaded.');
  return ((data as TeamMessage[]) || []).reverse();
}

export async function sendTeamMessageAction(
  workspaceId: string,
  params: {
    threadId: string;
    content: string;
    conversationId?: string | null;
    mentions?: string[];
  },
): Promise<TeamMessage> {
  const { supabase, user } = await getWorkspaceAccess(workspaceId);
  await assertCanSeeThread(supabase, params.threadId);

  const content = (params.content || '').trim();
  if (!content || content.length > 4000) {
    throw userError('Message must be between 1 and 4000 characters.');
  }

  const { data, error } = await supabase
    .from('team_messages')
    .insert({
      thread_id: params.threadId,
      workspace_id: workspaceId,
      sender_id: user.id,
      content,
      conversation_id: params.conversationId || null,
      mentions: Array.isArray(params.mentions) ? params.mentions : [],
    })
    .select()
    .single();

  if (error || !data) {
    throw userError(error?.message || 'Could not send message.');
  }
  return data as TeamMessage;
}

export async function deleteTeamMessageAction(workspaceId: string, messageId: string): Promise<void> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { error } = await supabase.rpc('fn_team_delete_message', { p_message_id: messageId });
  if (error) throw userError(error.message || 'That message cannot be deleted.');
}

