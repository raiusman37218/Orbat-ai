'use server';

import { createClient } from '@/lib/pg/server';
import { sessionUser } from '@/lib/auth/session-user';
import { AccessError, getWorkspaceAccess } from '@/lib/team/access';
import { getLanguageInfo } from '@/lib/ai/translator';
import { userError } from '@/lib/errors/user-error';
import { loadHandovers, type HandoverItem } from '@/lib/inbox/handovers';
import type {
  AgentStatus,
  CannedResponse,
  Conversation,
  ConversationPriority,
  ConversationStatus,
  Message,
  Visitor,
  VisitorPageHistory,
} from '@/types/database';

async function guardConversationAccess(conversationId: string) {
  const supabase = await createClient();
  const user = await sessionUser(supabase);
  if (!user) throw new AccessError('Unauthorized: sign in again.', 401);

  const { data: conv, error } = await supabase
    .from('conversations')
    .select('id, workspace_id, channel_metadata, status, ai_mode, ai_paused_reason')
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !conv?.workspace_id) {
    throw userError('Conversation not found.');
  }

  const access = await getWorkspaceAccess(conv.workspace_id);
  return { ...access, workspaceId: conv.workspace_id as string, conversation: conv };
}

export async function claimConversationAction(
  conversationId: string,
): Promise<{ ok: boolean; reason?: string; message?: string }> {
  const { supabase } = await guardConversationAccess(conversationId);
  const { data, error } = await supabase.rpc('claim_conversation', {
    p_conversation_id: conversationId,
  });
  if (error) throw userError(error.message || 'Failed to claim conversation.');
  return (data || { ok: false }) as { ok: boolean; reason?: string; message?: string };
}

export async function skipConversationAction(conversationId: string): Promise<void> {
  const { supabase } = await guardConversationAccess(conversationId);
  await supabase.rpc('skip_conversation', { p_conversation_id: conversationId });
}

export async function returnToAiAction(conversationId: string): Promise<void> {
  const { supabase } = await guardConversationAccess(conversationId);
  const { error } = await supabase.rpc('return_to_ai', {
    p_conversation_id: conversationId,
  });
  if (error) throw userError(error.message || 'Failed to return conversation to AI.');
}

export async function listCannedResponsesAction(workspaceId: string): Promise<CannedResponse[]> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { data } = await supabase
    .from('canned_responses')
    .select('*')
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
  return (data as CannedResponse[]) || [];
}

export async function listVisitorConversationsAction(
  workspaceId: string,
  visitorId: string | null | undefined,
  visitorEmail?: string | null,
  excludeConversationId?: string | null,
): Promise<Conversation[]> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const email = visitorEmail?.trim().toLowerCase();
  let visitorIds = [visitorId].filter(Boolean) as string[];

  if (email) {
    const { data: matchedVisitors } = await supabase
      .from('visitors')
      .select('id')
      .eq('workspace_id', workspaceId)
      .ilike('email', email);
    if (matchedVisitors) {
      const ids = (matchedVisitors as Array<{ id: string }>).map((v) => v.id);
      visitorIds = Array.from(new Set([...visitorIds, ...ids]));
    }
  }

  if (visitorIds.length === 0) return [];

  let query = supabase
    .from('conversations')
    .select('id, status, priority, created_at, updated_at, tags')
    .eq('workspace_id', workspaceId)
    .in('visitor_id', visitorIds)
    .order('updated_at', { ascending: false });

  if (excludeConversationId) {
    query = query.neq('id', excludeConversationId);
  }

  const { data } = await query;
  return (data as Conversation[]) || [];
}

export async function setConversationLanguageOverrideAction(
  conversationId: string,
  languageCode: string | null,
  detectedFallback = 'en',
): Promise<void> {
  const { supabase, workspaceId, conversation } = await guardConversationAccess(conversationId);
  const meta: Record<string, unknown> = {
    ...((conversation.channel_metadata as Record<string, unknown>) || {}),
  };
  if (languageCode) {
    meta.language_override = languageCode;
    meta.visitor_language = languageCode;
    meta.language_name = getLanguageInfo(languageCode).name;
  } else {
    delete meta.language_override;
    meta.visitor_language = detectedFallback;
    meta.language_name = getLanguageInfo(detectedFallback).name;
  }
  await supabase
    .from('conversations')
    .update({ channel_metadata: meta })
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId);
}

export async function createInternalNoteAction(
  conversationId: string,
  content: string,
  mentionedAgentIds: string[] = [],
): Promise<void> {
  const { supabase, user } = await guardConversationAccess(conversationId);
  await supabase.from('internal_notes').insert({
    conversation_id: conversationId,
    agent_id: user.id,
    content,
    mentioned_agent_ids: mentionedAgentIds,
  });
}

export async function getLiveVisitorMetaAction(
  workspaceId: string,
  visitorIds: string[],
): Promise<{
  pageHistory: VisitorPageHistory[];
  openTickets: Array<{
    id: string;
    number: number;
    subject: string | null;
    status: string;
    requester_id: string | null;
  }>;
}> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const cleanIds = visitorIds.filter(Boolean).slice(0, 300);
  if (cleanIds.length === 0) return { pageHistory: [], openTickets: [] };

  const [historyRes, ticketsRes] = await Promise.all([
    supabase
      .from('visitor_page_history')
      .select('*')
      .in('visitor_id', cleanIds)
      .order('visited_at', { ascending: false })
      .limit(100),
    supabase
      .from('tickets')
      .select('id, number, subject, status, requester_id')
      .eq('workspace_id', workspaceId)
      .in('status', ['new', 'open', 'pending', 'on_hold'])
      .in('requester_id', cleanIds),
  ]);

  return {
    pageHistory: (historyRes.data as VisitorPageHistory[]) || [],
    openTickets:
      (ticketsRes.data as Array<{
        id: string;
        number: number;
        subject: string | null;
        status: string;
        requester_id: string | null;
      }>) || [],
  };
}

export async function getVisitorSnapshotAction(
  workspaceId: string,
  visitorId: string,
): Promise<Visitor | null> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { data } = await supabase
    .from('visitors')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', visitorId)
    .maybeSingle();
  return (data as Visitor | null) ?? null;
}

export async function agentHeartbeatAction(
  workspaceId: string,
  activeInput: boolean,
  syncOnlineIfNeeded = false,
): Promise<{ auto_away?: boolean; manual_status?: string } | null> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { data, error } = await supabase.rpc('agent_heartbeat', { p_active_input: activeInput });
  if (error) return null;
  const beat = (data || null) as { auto_away?: boolean; manual_status?: string } | null;
  if (!beat?.auto_away && syncOnlineIfNeeded && beat?.manual_status !== 'online') {
    await supabase.rpc('set_agent_status', { p_status: 'online' });
  }
  return beat;
}

export async function pollRingingHandoffsAction(workspaceId: string): Promise<
  Array<{
    conversationId: string;
    visitorName: string;
    visitorEmail: string | null;
    question: string | null;
    summary: string | null;
    reason: string | null;
    ringStartedAt: string | null;
    ringBroadcast: boolean;
  }>
> {
  const { supabase, user } = await getWorkspaceAccess(workspaceId);
  const { data, error } = await supabase
    .from('conversations')
    .select(
      'id, handoff_status, handoff_reason, handoff_summary, ringing_agent_id, ring_broadcast, ring_started_at, skipped_agent_ids, visitor:visitors(name, email)',
    )
    .eq('workspace_id', workspaceId)
    .eq('handoff_status', 'waiting_for_agent')
    .or(`ringing_agent_id.eq.${user.id},ring_broadcast.eq.true`)
    .order('ring_started_at', { ascending: false })
    .limit(5);

  if (error || !data) return [];

  const results: Array<{
    conversationId: string;
    visitorName: string;
    visitorEmail: string | null;
    question: string | null;
    summary: string | null;
    reason: string | null;
    ringStartedAt: string | null;
    ringBroadcast: boolean;
  }> = [];

  for (const row of data as any[]) {
    if (Array.isArray(row.skipped_agent_ids) && row.skipped_agent_ids.includes(user.id) && row.ring_broadcast) {
      continue;
    }
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('content')
      .eq('conversation_id', row.id)
      .eq('sender_type', 'visitor')
      .or('is_internal.is.null,is_internal.eq.false')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const visitor = Array.isArray(row.visitor) ? row.visitor[0] : row.visitor;
    results.push({
      conversationId: row.id,
      visitorName: visitor?.name?.trim() || visitor?.email?.trim() || 'Customer',
      visitorEmail: visitor?.email ?? null,
      question: (lastMsg as { content?: string } | null)?.content ?? null,
      summary: row.handoff_summary ?? null,
      reason: row.handoff_reason ?? null,
      ringStartedAt: row.ring_started_at ?? null,
      ringBroadcast: Boolean(row.ring_broadcast),
    });
  }

  return results;
}

export async function getDashboardConversationAction(
  workspaceId: string,
  conversationId: string,
): Promise<Conversation | null> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { data } = await supabase
    .from('conversations')
    .select('*, visitor:visitors(*), agent:agents!conversations_agent_id_fkey(*)')
    .eq('workspace_id', workspaceId)
    .eq('id', conversationId)
    .maybeSingle();
  return (data as Conversation | null) ?? null;
}

export async function listDashboardMessagesAction(
  workspaceId: string,
  conversationId: string,
): Promise<Message[]> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (!conv) throw userError('Conversation not found.');

  const { data, error } = await supabase
    .from('messages')
    .select('*, agent:agents(*)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw userError(error.message || 'Failed to load messages.');

  await supabase
    .rpc('fn_mark_messages_read', {
      p_conversation_id: conversationId,
      p_exclude_sender: 'agent',
    })
    .then(undefined, () => {});

  return (data as Message[]) || [];
}

export async function listDashboardConversationsAction(
  workspaceId: string,
  pageNum = 0,
  pageSize = 30,
): Promise<{
  conversations: Conversation[];
  hasMore: boolean;
}> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { data: convData, error } = await supabase
    .from('conversations')
    .select(
      `
      *,
      visitor:visitors(*),
      agent:agents!conversations_agent_id_fkey(*)
    `,
    )
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

  if (error) throw userError(error.message || 'Conversations could not be loaded.');

  const fetchedConvs = (convData as any[]) || [];
  const hasMore = fetchedConvs.length >= pageSize;
  if (fetchedConvs.length === 0) return { conversations: [], hasMore };

  const convIds = fetchedConvs.map((c) => c.id);
  const unreadCountMap: Record<string, number> = {};
  const latestMessageMap: Record<string, Message> = {};
  const visitorMsgCounts: Record<string, number> = {};

  const summaries = await supabase.rpc('fn_inbox_summaries', { p_conversation_ids: convIds });
  if (summaries && !summaries.error && Array.isArray(summaries.data)) {
    for (const row of summaries.data as Array<{
      conversation_id: string;
      last_message: Message | null;
      unread_count: number;
      has_visitor_message: boolean;
    }>) {
      if (row.unread_count) unreadCountMap[row.conversation_id] = row.unread_count;
      if (row.last_message) latestMessageMap[row.conversation_id] = row.last_message;
      if (row.has_visitor_message) visitorMsgCounts[row.conversation_id] = 1;
    }
  } else {
    const [unreadRes, recentMsgsRes] = await Promise.all([
      supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .eq('sender_type', 'visitor')
        .is('read_at', null),
      supabase
        .from('messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false }),
    ]);

    for (const row of unreadRes.data || []) {
      unreadCountMap[row.conversation_id] = (unreadCountMap[row.conversation_id] || 0) + 1;
    }
    for (const msg of recentMsgsRes.data || []) {
      if (msg.sender_type === 'visitor') {
        visitorMsgCounts[msg.conversation_id] = (visitorMsgCounts[msg.conversation_id] || 0) + 1;
      }
      if (!latestMessageMap[msg.conversation_id]) {
        latestMessageMap[msg.conversation_id] = msg as Message;
      }
    }
  }

  let abandonedIds: string[] = [];
  const nowMs = Date.now();
  const candidates = fetchedConvs
    .filter((c) => {
      if (c.status !== 'open' || visitorMsgCounts[c.id]) return false;
      const ageMinutes = (nowMs - new Date(c.created_at || c.updated_at).getTime()) / (1000 * 60);
      return ageMinutes >= 10;
    })
    .map((c) => c.id as string);

  if (candidates.length > 0) {
    const { data: withVisitorMsgs } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', candidates)
      .eq('sender_type', 'visitor')
      .limit(1000);
    const spoken = new Set((withVisitorMsgs || []).map((r: any) => r.conversation_id));
    abandonedIds = candidates.filter((id) => !spoken.has(id));
  }

  if (abandonedIds.length > 0) {
    const closedAt = new Date().toISOString();
    for (const c of fetchedConvs.filter((fc) => abandonedIds.includes(fc.id))) {
      await supabase
        .from('conversations')
        .update({
          status: 'closed',
          closed_at: closedAt,
          channel_metadata: {
            ...((c.channel_metadata as Record<string, any>) || {}),
            auto_closed_reason: 'no_customer_message_10m',
          },
        })
        .eq('id', c.id)
        .eq('status', 'open');
    }
  }

  const enriched: Conversation[] = fetchedConvs.map((c) => {
    const isAutoClosed = abandonedIds.includes(c.id);
    return {
      ...c,
      status: isAutoClosed ? 'closed' : c.status,
      closed_at: isAutoClosed ? c.closed_at || new Date().toISOString() : c.closed_at,
      last_message: latestMessageMap[c.id] || null,
      unread_count: unreadCountMap[c.id] || 0,
    };
  });

  return { conversations: enriched, hasMore };
}

export async function bulkUpdateDashboardConversationsAction(
  workspaceId: string,
  payload:
    | { ids: string[]; action: 'resolve' }
    | { ids: string[]; action: 'assign'; agentId: string | null }
    | { ids: string[]; action: 'spam' },
): Promise<void> {
  if (!payload.ids.length) return;
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const nowIso = new Date().toISOString();

  if (payload.action === 'resolve') {
    await supabase
      .from('conversations')
      .update({ status: 'closed', closed_at: nowIso, updated_at: nowIso })
      .eq('workspace_id', workspaceId)
      .in('id', payload.ids);
    return;
  }

  if (payload.action === 'assign') {
    await supabase
      .from('conversations')
      .update({
        assigned_agent_id: payload.agentId,
        agent_id: payload.agentId,
        updated_at: nowIso,
      })
      .eq('workspace_id', workspaceId)
      .in('id', payload.ids);
    return;
  }

  const { data: rows } = await supabase
    .from('conversations')
    .select('id, tags')
    .eq('workspace_id', workspaceId)
    .in('id', payload.ids);

  for (const row of (rows as Array<{ id: string; tags?: string[] | null }>) || []) {
    const curTags = row.tags || [];
    const updatedTags = curTags.includes('Spam') ? curTags : [...curTags, 'Spam'];
    await supabase
      .from('conversations')
      .update({
        status: 'closed',
        closed_at: nowIso,
        tags: updatedTags,
        updated_at: nowIso,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', row.id);
  }
}

export async function listDashboardVisitorsAction(workspaceId: string): Promise<Visitor[]> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { data, error } = await supabase
    .from('visitors')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('last_seen', { ascending: false })
    .limit(300);
  if (error) throw userError(error.message || 'Failed to fetch visitors.');
  return (data as Visitor[]) || [];
}

export async function sendDashboardMessageAction(
  workspaceId: string,
  params: {
    conversationId: string;
    content: string;
    isInternal?: boolean;
    replyToId?: string | null;
    attachmentUrl?: string | null;
    metadata?: Record<string, any> | null;
    shouldAutoAssign?: boolean;
  },
): Promise<{ message: Message; newStatus?: ConversationStatus; now: string }> {
  const { supabase, user } = await getWorkspaceAccess(workspaceId);
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, status, channel_metadata')
    .eq('id', params.conversationId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (!conv) throw userError('Conversation not found.');

  const { data: insertedMsg, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: params.conversationId,
      sender_type: 'agent',
      sender_id: user.id,
      content: params.content || (params.attachmentUrl ? 'Sent an attachment' : ''),
      is_internal: Boolean(params.isInternal),
      ...(params.metadata ? { metadata: params.metadata } : {}),
      ...(params.attachmentUrl ? { attachment_url: params.attachmentUrl } : {}),
      ...(params.replyToId ? { reply_to_message_id: params.replyToId } : {}),
    })
    .select('*, agent:agents(*)')
    .single();

  if (error || !insertedMsg) {
    throw userError(error?.message || 'Error sending message.');
  }

  const now = new Date().toISOString();
  if (!params.isInternal) {
    const newStatus: ConversationStatus = conv.status === 'closed' ? 'closed' : 'pending';
    await supabase
      .from('conversations')
      .update({
        updated_at: now,
        status: newStatus,
        ai_mode: 'disabled',
        ai_paused_reason: 'human_reply',
        ai_needs_attention_at: null,
        channel_metadata: {
          ...((conv.channel_metadata as Record<string, any>) || {}),
          last_human_reply_at: now,
        },
        ...(params.shouldAutoAssign ? { agent_id: user.id, assigned_agent_id: user.id } : {}),
      })
      .eq('id', params.conversationId)
      .eq('workspace_id', workspaceId);
    return { message: insertedMsg as Message, newStatus, now };
  }

  await supabase
    .from('conversations')
    .update({
      updated_at: now,
      ...(params.shouldAutoAssign ? { agent_id: user.id, assigned_agent_id: user.id } : {}),
    })
    .eq('id', params.conversationId)
    .eq('workspace_id', workspaceId);

  return { message: insertedMsg as Message, now };
}

export async function editDashboardMessageAction(
  workspaceId: string,
  conversationId: string,
  messageId: string,
  newContent: string,
): Promise<void> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { data: existing } = await supabase
    .from('messages')
    .select('id, metadata')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .maybeSingle();
  if (!existing) throw userError('Message not found.');

  const currentMeta = (existing.metadata as Record<string, any>) || {};
  const { error } = await supabase
    .from('messages')
    .update({
      content: newContent,
      metadata: {
        ...currentMeta,
        is_edited: true,
        edited_at: new Date().toISOString(),
      },
    })
    .eq('id', messageId)
    .eq('conversation_id', conversationId);
  if (error) throw userError(error.message || 'Error editing message.');
}

export async function deleteDashboardMessageAction(
  workspaceId: string,
  conversationId: string,
  messageId: string,
): Promise<void> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)
    .eq('conversation_id', conversationId);
  if (error) throw userError(error.message || 'Error deleting message.');
}

export async function updateDashboardConversationAction(
  workspaceId: string,
  conversationId: string,
  patch: Partial<{
    priority: ConversationPriority;
    tags: string[];
    status: ConversationStatus;
    closed_at: string | null;
    ai_mode: 'autopilot' | 'disabled';
    ai_paused_reason: string | null;
    ai_resumed_at: string | null;
    handoff_status: string;
    handoff_summary: string | null;
    channel_metadata: Record<string, any>;
    agent_id: string | null;
    assigned_agent_id: string | null;
  }>,
): Promise<void> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { error } = await supabase
    .from('conversations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId);
  if (error) throw userError(error.message || 'Error updating conversation.');
}

export async function updateAgentStatusAction(
  workspaceId: string,
  status: AgentStatus,
): Promise<{ waitingQueueCount: number }> {
  const { supabase, user } = await getWorkspaceAccess(workspaceId);
  await supabase.rpc('set_agent_status', {
    p_status: status === 'online' ? 'online' : 'away',
  });
  await supabase.from('agents').update({ status }).eq('id', user.id);

  if (status === 'online') {
    const { count } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('handoff_status', ['waiting_for_agent', 'offline_queued']);
    return { waitingQueueCount: count || 0 };
  }
  return { waitingQueueCount: 0 };
}

export async function startDashboardConversationAction(
  workspaceId: string,
  visitorId: string,
): Promise<Conversation | null> {
  const { supabase, user } = await getWorkspaceAccess(workspaceId);
  const { data } = await supabase
    .from('conversations')
    .insert({
      visitor_id: visitorId,
      workspace_id: workspaceId,
      status: 'open',
      agent_id: user.id,
    })
    .select('*, visitor:visitors(*)')
    .single();
  return (data as Conversation | null) ?? null;
}

export async function getHelpSectionsCountAction(workspaceId: string): Promise<number | null> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { count } = await supabase
    .from('help_sections')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  return count ?? null;
}

export async function getVisitorsCountAction(workspaceId: string): Promise<number> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  const { count } = await supabase
    .from('visitors')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  return count || 0;
}

export async function loadHandoversAction(workspaceId: string): Promise<HandoverItem[]> {
  const { supabase } = await getWorkspaceAccess(workspaceId);
  return loadHandovers(supabase, workspaceId);
}
