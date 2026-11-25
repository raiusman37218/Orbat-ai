'use server';

import { createClient } from '@/lib/pg/server';
import { query, queryRows } from '@/lib/db';
import { sessionUser } from '@/lib/auth/session-user';
import { AccessError, getWorkspaceAccess } from '@/lib/team/access';
import { getLanguageInfo } from '@/lib/ai/translator';
import { userError } from '@/lib/errors/user-error';
import { loadHandovers, type HandoverItem } from '@/lib/inbox/handovers';
import { resumeAdkAgentRun } from '@/lib/agent/engines/adk-engine';
import { resumeLangGraphAgentRun } from '@/lib/agent/engines/langgraph-engine';
import { dispatchOutboundMessage } from '@/lib/channels/dispatcher';
import { notifyInternalNoteMentions } from '@/lib/notifications/workspace-notifications';
import { roleCan } from '@/lib/team/permissions';
import type {
  Agent,
  AgentStatus,
  CannedResponse,
  Conversation,
  ConversationPriority,
  ConversationStatus,
  Message,
  Visitor,
  VisitorPageHistory,
} from '@/types/database';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let inboxScaleSchemaPromise: Promise<void> | null = null;

async function ensureInboxScaleSchema(): Promise<void> {
  if (process.env.VITEST && !process.env.TEST_DATABASE_URL) return;
  if (!inboxScaleSchemaPromise) {
    inboxScaleSchemaPromise = (async () => {
      try {
        await query(`ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.ticket_groups(id) ON DELETE SET NULL`);
        await query(`ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS notes TEXT`);
        await query(`
          CREATE TABLE IF NOT EXISTS public.conversation_views (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
            owner_id     UUID REFERENCES public.agents(id) ON DELETE CASCADE,
            name         TEXT NOT NULL CHECK (length(trim(name)) > 0),
            filters      JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters) = 'object'),
            sort         JSONB NOT NULL DEFAULT '{"field": "newest", "direction": "desc"}'::jsonb CHECK (jsonb_typeof(sort) = 'object'),
            position     INTEGER NOT NULL DEFAULT 0,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
      } catch {
        // Non-fatal on restricted roles or read-only replicas
      }
    })();
  }
  await inboxScaleSchemaPromise;
}

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
  const { supabase, user, agent, workspaceId } = await guardConversationAccess(conversationId);
  await supabase.from('internal_notes').insert({
    conversation_id: conversationId,
    agent_id: user.id,
    content,
    mentioned_agent_ids: mentionedAgentIds,
  });
  await notifyInternalNoteMentions({
    workspaceId,
    authorId: user.id,
    authorName: agent.name,
    content,
    explicitMentionedIds: mentionedAgentIds,
    contextLabel: 'in an internal note',
    href: `/app/inbox?c=${encodeURIComponent(conversationId)}`,
    client: supabase,
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

  interface RingingRow {
    id: string;
    handoff_reason?: string | null;
    handoff_summary?: string | null;
    ring_started_at?: string | null;
    ring_broadcast?: boolean | null;
    skipped_agent_ids?: string[] | null;
    visitor?:
      | { name?: string | null; email?: string | null }
      | Array<{ name?: string | null; email?: string | null }>
      | null;
  }

  for (const row of data as unknown as RingingRow[]) {
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

  const fetchedConvs = (convData as unknown as Conversation[]) || [];
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
    const spoken = new Set(
      ((withVisitorMsgs as Array<{ conversation_id: string }> | null) || []).map(
        (r) => r.conversation_id,
      ),
    );
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
            ...((c.channel_metadata as Record<string, unknown> | null) || {}),
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
    metadata?: Record<string, unknown> | null;
    shouldAutoAssign?: boolean;
  },
): Promise<{ message: Message; newStatus?: ConversationStatus; now: string }> {
  const { supabase, user, agent } = await getWorkspaceAccess(workspaceId);
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
          ...((conv.channel_metadata as Record<string, unknown> | null) || {}),
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

  await notifyInternalNoteMentions({
    workspaceId,
    authorId: user.id,
    authorName: agent.name,
    content: params.content,
    contextLabel: 'in an Inbox note',
    href: `/app/inbox?c=${encodeURIComponent(params.conversationId)}`,
    client: supabase,
  });

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

  const currentMeta = (existing.metadata as Record<string, unknown> | null) || {};
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
    channel_metadata: Record<string, unknown>;
    group_id: string | null;
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

export async function resumeAgentApprovalAction(
  workspaceId: string,
  params: {
    conversationId: string;
    messageId?: string | null;
    threadId: string;
    approved: boolean;
    editedReply?: string | null;
  },
): Promise<{
  status: 'approved' | 'rejected';
  deliveredMessageId: string | null;
  executedTools: Array<{ toolName: string; ok: boolean; summary: string }>;
}> {
  const { supabase, user } = await getWorkspaceAccess(workspaceId, 'reply');
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id, workspace_id, channel, status, channel_metadata, assigned_agent_id, agent_id')
    .eq('id', params.conversationId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (convErr || !conv) {
    throw userError('Conversation not found in this workspace.');
  }

  let resolvedMessageId = params.messageId?.trim() || null;
  let noteMsg: { id: string; metadata?: unknown; content?: string | null } | null = null;

  if (resolvedMessageId) {
    const { data, error: noteErr } = await supabase
      .from('messages')
      .select('id, metadata, content')
      .eq('id', resolvedMessageId)
      .eq('conversation_id', params.conversationId)
      .maybeSingle();

    if (noteErr || !data) {
      throw userError('Approval request message not found.');
    }
    noteMsg = data as { id: string; metadata?: unknown; content?: string | null };
  }

  const rawMeta = ((noteMsg?.metadata || {}) as Record<string, unknown>);
  const existingApproval = (
    rawMeta.langgraph_approval && typeof rawMeta.langgraph_approval === 'object'
      ? rawMeta.langgraph_approval
      : {}
  ) as Record<string, unknown>;
  if (existingApproval.status === 'approved' || existingApproval.status === 'rejected') {
    throw userError(`This approval request was already ${existingApproval.status}.`);
  }

  const resolvedThreadId = (
    params.threadId ||
    (typeof existingApproval.threadId === 'string' ? existingApproval.threadId : '')
  ).trim();
  if (!resolvedThreadId) {
    throw userError('Missing LangGraph approval thread identifier.');
  }

  if (!noteMsg && !process.env.VITEST) {
    try {
      const matchedMsgs = await queryRows<{ id: string; metadata: unknown; content: string | null }>(
        `SELECT id, metadata, content
         FROM public.messages
         WHERE conversation_id = $1
           AND is_internal = true
           AND metadata->'langgraph_approval'->>'threadId' = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [params.conversationId, resolvedThreadId],
      );
      if (matchedMsgs[0]) {
        noteMsg = matchedMsgs[0];
        resolvedMessageId = matchedMsgs[0].id;
      }
    } catch {
      // Ignore if query unavailable
    }
  }

  let runFallbackDraft = '';
  try {
    const runRows = await queryRows<{ draft_reply: string | null; status: string }>(
      `SELECT draft_reply, status
       FROM public.ai_agent_runs
       WHERE workspace_id = $1 AND thread_id = $2
       LIMIT 1`,
      [workspaceId, resolvedThreadId],
    );
    if (runRows[0]) {
      if (runRows[0].status === 'completed' || runRows[0].status === 'rejected') {
        throw userError(`This approval request was already ${runRows[0].status}.`);
      }
      runFallbackDraft = runRows[0].draft_reply || '';
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already')) {
      throw err;
    }
  }

  const fallbackDraft =
    typeof existingApproval.draftReply === 'string'
      ? existingApproval.draftReply
      : typeof rawMeta.draft_reply === 'string'
        ? rawMeta.draft_reply
        : runFallbackDraft;
  let resumedReply = (params.editedReply || fallbackDraft).trim();
  let executedTools: Array<{ toolName: string; ok: boolean; summary: string }> = [];

  const isAdkThread = resolvedThreadId.startsWith('adk:');
  try {
    const resumed = isAdkThread
      ? await resumeAdkAgentRun({
          workspaceId,
          threadId: resolvedThreadId,
          approved: params.approved,
          editedReply: params.editedReply,
          resolvedBy: user.id,
        })
      : await resumeLangGraphAgentRun({
          workspaceId,
          threadId: resolvedThreadId,
          approved: params.approved,
          editedReply: params.editedReply,
          resolvedBy: user.id,
        });
    if (resumed.replyText?.trim()) {
      resumedReply = resumed.replyText.trim();
    }
    executedTools = resumed.executedTools || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Workspace isolation violation')) {
      throw userError(msg);
    }
    if (!msg.includes('not found or expired')) {
      throw userError(msg || 'Failed to resume agent workflow.');
    }
  }

  const nowIso = new Date().toISOString();
  const nextStatus: 'approved' | 'rejected' = params.approved ? 'approved' : 'rejected';

  let deliveredMessageId: string | null = null;
  if (params.approved && resumedReply) {
    const { data: inserted, error: insertErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: params.conversationId,
        sender_type: 'ai',
        sender_id: null,
        content: resumedReply,
        is_internal: false,
        metadata: {
          approved_by: user.id,
          engine: isAdkThread ? 'adk' : 'langgraph',
          thread_id: resolvedThreadId,
          agent_id: existingApproval.agentId ?? rawMeta.agent_id ?? null,
          agent_name: existingApproval.agentName ?? rawMeta.agent_name ?? null,
          executed_tools: executedTools,
        },
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      throw userError(insertErr?.message || 'Could not deliver approved AI reply.');
    }
    deliveredMessageId = inserted.id as string;

    await supabase
      .from('conversations')
      .update({
        updated_at: nowIso,
        status: conv.status === 'closed' ? 'closed' : 'open',
        ai_needs_attention_at: null,
        channel_metadata: {
          ...((conv.channel_metadata as Record<string, unknown>) || {}),
          last_langgraph_approval_at: nowIso,
        },
      })
      .eq('id', params.conversationId)
      .eq('workspace_id', workspaceId);

    const channel = typeof conv.channel === 'string' ? conv.channel : 'web';
    if (channel && channel !== 'web') {
      await dispatchOutboundMessage({
        conversationId: params.conversationId,
        workspaceId,
        content: resumedReply,
        channel,
      }).catch(() => {});
    }
  } else if (!params.approved) {
    // Reject & Take Over: pause autopilot and assign thread to the reviewing human teammate
    await supabase
      .from('conversations')
      .update({
        updated_at: nowIso,
        ai_mode: 'disabled',
        ai_paused_reason: 'agent_paused',
        ai_needs_attention_at: null,
        assigned_agent_id: (conv as { assigned_agent_id?: string | null }).assigned_agent_id || user.id,
        agent_id: (conv as { agent_id?: string | null }).agent_id || user.id,
        channel_metadata: {
          ...((conv.channel_metadata as Record<string, unknown>) || {}),
          last_langgraph_rejection_at: nowIso,
        },
      })
      .eq('id', params.conversationId)
      .eq('workspace_id', workspaceId);
  }

  // Keep ai_agent_runs status synced even if in-memory checkpoint wasn't present
  await query(
    `UPDATE public.ai_agent_runs
     SET status = $3,
         final_reply = COALESCE($4, final_reply),
         resolved_by = $5,
         resolved_at = now(),
         updated_at = now()
     WHERE workspace_id = $1 AND thread_id = $2`,
    [
      workspaceId,
      resolvedThreadId,
      params.approved ? 'completed' : 'rejected',
      params.approved ? resumedReply : null,
      user.id,
    ],
  ).catch(() => {});

  if (resolvedMessageId) {
    const updatedBaseMeta = ((noteMsg?.metadata || {}) as Record<string, unknown>);
    const updatedExistingApproval = (
      updatedBaseMeta.langgraph_approval && typeof updatedBaseMeta.langgraph_approval === 'object'
        ? updatedBaseMeta.langgraph_approval
        : existingApproval
    ) as Record<string, unknown>;
    await supabase
      .from('messages')
      .update({
        metadata: {
          ...updatedBaseMeta,
          langgraph_approval: {
            ...updatedExistingApproval,
            status: nextStatus,
            resolvedBy: user.id,
            resolvedAt: nowIso,
            finalReply: params.approved ? resumedReply : null,
            executedTools,
          },
        },
      })
      .eq('id', resolvedMessageId)
      .eq('conversation_id', params.conversationId);
  }

  return {
    status: nextStatus,
    deliveredMessageId,
    executedTools,
  };
}

export async function resolveLangGraphApprovalAction(
  workspaceId: string,
  params: {
    conversationId: string;
    messageId?: string | null;
    threadId: string;
    approved: boolean;
    editedReply?: string | null;
  },
) {
  return resumeAgentApprovalAction(workspaceId, params);
}

/* ── Scalable Server-Side Search, Team Inboxes, Views & Insights ───────── */

export type ServerInboxView =
  | 'open'
  | 'mine'
  | 'unassigned'
  | 'ai'
  | 'ai_handled'
  | 'waiting'
  | 'waiting_approval'
  | 'snoozed'
  | 'resolved'
  | 'closed'
  | 'all';

export interface SearchInboxParams {
  view?: ServerInboxView;
  channel?: string | null;
  priority?: string | null;
  groupId?: string | null;
  search?: string | null;
  sort?: 'newest' | 'waiting' | 'unread' | 'priority';
  cursor?: string | null;
  limit?: number;
}

export interface SearchInboxCounts {
  open: number;
  mine: number;
  unassigned: number;
  ai: number;
  ai_handled: number;
  waiting: number;
  waiting_approval: number;
  snoozed: number;
  resolved: number;
  closed: number;
  all: number;
}

export interface SearchInboxResult {
  conversations: Conversation[];
  hasMore: boolean;
  nextCursor: string | null;
  total: number;
  counts: SearchInboxCounts;
  groupCounts: Record<string, number>;
}

export interface SavedConversationView {
  id: string;
  name: string;
  ownerId: string | null;
  filters: {
    view?: ServerInboxView;
    channel?: string;
    priority?: string;
    groupId?: string | null;
    search?: string;
  };
  sort: {
    field: 'newest' | 'waiting' | 'unread' | 'priority';
    direction: 'asc' | 'desc';
  };
}

export interface ConversationAiSummary {
  latestConfidencePct: number | null;
  estimatedCostUsd: number | null;
  agentName: string | null;
  engineUsed: string | null;
  pendingApprovalRun: {
    runId: string;
    threadId: string;
    agentId: string | null;
    agentName: string;
    topic: string;
    autonomyLevel: number;
    reason: string;
    draftReply: string;
    pendingActions: Array<{
      toolName: string;
      summary: string;
      args: Record<string, unknown>;
    }>;
    createdAt: string;
  } | null;
}

export interface VisitorLifetimeStats {
  lifetimeCsatAvg: number | null;
  csatCount: number;
  avgFirstReplySec: number | null;
  totalResolvedCount: number;
}

interface DecodedCursor {
  ts?: string;
  id?: string;
  offset?: number;
}

function encodeCursor(c: DecodedCursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

function decodeCursor(raw: string | null | undefined): DecodedCursor | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as DecodedCursor;
  } catch {
    return null;
  }
}

function escapeSqlLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

export async function searchAndFilterConversationsAction(
  workspaceId: string,
  params: SearchInboxParams = {},
): Promise<SearchInboxResult> {
  const { user } = await getWorkspaceAccess(workspaceId);
  await ensureInboxScaleSchema();

  const limit = Math.max(1, Math.min(100, Math.floor(params.limit ?? 30)));
  const view = params.view || 'open';
  const channel = params.channel && params.channel !== 'all' ? params.channel.trim() : null;
  const priority = params.priority && params.priority !== 'all' ? params.priority.trim() : null;
  const groupId = params.groupId && params.groupId !== 'all' ? params.groupId.trim() : null;
  const search = params.search ? params.search.trim().slice(0, 120) : '';
  const sort = params.sort || 'newest';
  const cursor = decodeCursor(params.cursor);

  let hasAgentRunsTable = false;
  try {
    const tblCheck = await queryRows<{ exists: boolean }>(
      `SELECT to_regclass('public.ai_agent_runs') IS NOT NULL AS exists`,
      [],
    );
    hasAgentRunsTable = Boolean(tblCheck[0]?.exists);
  } catch {
    hasAgentRunsTable = false;
  }

  const approvalMsgExistsSql = `EXISTS (
    SELECT 1 FROM public.messages am
    WHERE am.conversation_id = c.id
      AND am.is_internal = true
      AND am.metadata->'langgraph_approval' IS NOT NULL
      AND COALESCE(am.metadata->'langgraph_approval'->>'status', 'pending') IN ('pending', 'pending_approval', 'paused_approval', 'waiting_approval')
  )`;
  const approvalPredicateSql = hasAgentRunsTable
    ? `(${approvalMsgExistsSql} OR EXISTS (
        SELECT 1 FROM public.ai_agent_runs ar
        WHERE ar.conversation_id = c.id
          AND ar.workspace_id = $1
          AND ar.status IN ('paused_approval', 'waiting_approval')
      ))`
    : approvalMsgExistsSql;

  const whereClauses: string[] = ['c.workspace_id = $1'];
  const sqlParams: unknown[] = [workspaceId, user.id];

  const viewPredicate = (v: ServerInboxView): string | null => {
    switch (v) {
      case 'open':
        return `c.status IN ('open', 'pending')`;
      case 'mine':
        return `COALESCE(c.assigned_agent_id, c.agent_id) = $2 AND c.status <> 'closed'`;
      case 'unassigned':
        return `c.assigned_agent_id IS NULL AND c.agent_id IS NULL AND c.status <> 'closed'`;
      case 'ai':
      case 'ai_handled':
        return `c.status <> 'closed' AND c.ai_mode = 'autopilot' AND c.assigned_agent_id IS NULL AND COALESCE(c.handoff_status, '') NOT IN ('waiting_for_agent', 'offline_queued', 'handoff_offered')`;
      case 'waiting':
        return `c.status <> 'closed' AND c.handoff_status IN ('waiting_for_agent', 'offline_queued', 'handoff_offered')`;
      case 'waiting_approval':
        return `c.status <> 'closed' AND ${approvalPredicateSql}`;
      case 'snoozed':
        return `c.status = 'snoozed'`;
      case 'resolved':
      case 'closed':
        return `c.status = 'closed'`;
      case 'all':
      default:
        return null;
    }
  };

  const vp = viewPredicate(view);
  if (vp) whereClauses.push(vp);

  if (channel) {
    sqlParams.push(channel);
    whereClauses.push(`c.channel = $${sqlParams.length}`);
  }
  if (priority) {
    sqlParams.push(priority);
    whereClauses.push(`c.priority = $${sqlParams.length}`);
  }
  if (groupId) {
    if (groupId === 'none') {
      whereClauses.push(`c.group_id IS NULL`);
    } else if (UUID_RE.test(groupId)) {
      sqlParams.push(groupId);
      whereClauses.push(`c.group_id = $${sqlParams.length}`);
    } else {
      whereClauses.push('1 = 0');
    }
  }

  if (search) {
    const likeIdx = sqlParams.push(`%${escapeSqlLike(search)}%`);
    const prefixIdx = sqlParams.push(`${escapeSqlLike(search)}%`);
    const rawIdx = sqlParams.push(search);
    whereClauses.push(`(
      COALESCE(v.name, '') ILIKE $${likeIdx} ESCAPE '\\'
      OR COALESCE(v.email, '') ILIKE $${likeIdx} ESCAPE '\\'
      OR COALESCE(c.customer_email, '') ILIKE $${likeIdx} ESCAPE '\\'
      OR c.id::text ILIKE $${prefixIdx} ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.tags, ARRAY[]::text[])) t WHERE t ILIKE $${likeIdx} ESCAPE '\\')
      OR EXISTS (
        SELECT 1 FROM public.messages ms
        WHERE ms.conversation_id = c.id
          AND (
            to_tsvector('simple', COALESCE(ms.content, '')) @@ plainto_tsquery('simple', $${rawIdx})
            OR COALESCE(ms.content, '') ILIKE $${likeIdx} ESCAPE '\\'
          )
      )
    )`);
  }

  const filterWhereSql = whereClauses.join(' AND ');

  const countParams: unknown[] = [workspaceId, user.id];
  let countGroupClause = '';
  if (groupId) {
    if (groupId === 'none') {
      countGroupClause = ' AND c.group_id IS NULL';
    } else if (UUID_RE.test(groupId)) {
      countParams.push(groupId);
      countGroupClause = ` AND c.group_id = $${countParams.length}`;
    } else {
      countGroupClause = ' AND 1 = 0';
    }
  }

  const orderSql =
    sort === 'priority'
      ? `CASE c.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END DESC, COALESCE(lm.created_at, c.updated_at, c.created_at) DESC, c.id DESC`
      : sort === 'unread'
        ? `(COALESCE(ur.unread_count, 0) > 0) DESC, COALESCE(ur.unread_count, 0) DESC, COALESCE(lm.created_at, c.updated_at, c.created_at) DESC, c.id DESC`
        : sort === 'waiting'
          ? `(c.handoff_status IN ('waiting_for_agent', 'offline_queued', 'handoff_offered')) DESC, (lm.sender_type = 'visitor') DESC, COALESCE(lm.created_at, c.updated_at, c.created_at) DESC, c.id DESC`
          : `COALESCE(lm.created_at, c.updated_at, c.created_at) DESC, c.id DESC`;

  let paginationSql = '';
  const rowParams = [...sqlParams];
  if (sort === 'newest' && cursor?.ts && cursor?.id && UUID_RE.test(cursor.id)) {
    const tsIdx = rowParams.push(cursor.ts);
    const idIdx = rowParams.push(cursor.id);
    paginationSql = ` AND (COALESCE(lm.created_at, c.updated_at, c.created_at), c.id) < ($${tsIdx}::timestamptz, $${idIdx}::uuid)`;
  }
  const offset = sort !== 'newest' && typeof cursor?.offset === 'number' && cursor.offset > 0 ? cursor.offset : 0;
  const limitIdx = rowParams.push(limit + 1);
  const offsetClause = offset > 0 ? ` OFFSET $${rowParams.push(offset)}` : '';

  const [countsRows, groupCountRows, totalRows, rawRows] = await Promise.all([
    queryRows<{
      open_count: number;
      mine_count: number;
      unassigned_count: number;
      ai_count: number;
      waiting_count: number;
      waiting_approval_count: number;
      snoozed_count: number;
      resolved_count: number;
      all_count: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE c.status IN ('open', 'pending'))::int AS open_count,
         COUNT(*) FILTER (WHERE COALESCE(c.assigned_agent_id, c.agent_id) = $2 AND c.status <> 'closed')::int AS mine_count,
         COUNT(*) FILTER (WHERE c.assigned_agent_id IS NULL AND c.agent_id IS NULL AND c.status <> 'closed')::int AS unassigned_count,
         COUNT(*) FILTER (WHERE c.status <> 'closed' AND c.ai_mode = 'autopilot' AND c.assigned_agent_id IS NULL AND COALESCE(c.handoff_status, '') NOT IN ('waiting_for_agent', 'offline_queued', 'handoff_offered'))::int AS ai_count,
         COUNT(*) FILTER (WHERE c.status <> 'closed' AND c.handoff_status IN ('waiting_for_agent', 'offline_queued', 'handoff_offered'))::int AS waiting_count,
         COUNT(*) FILTER (WHERE c.status <> 'closed' AND ${approvalPredicateSql})::int AS waiting_approval_count,
         COUNT(*) FILTER (WHERE c.status = 'snoozed')::int AS snoozed_count,
         COUNT(*) FILTER (WHERE c.status = 'closed')::int AS resolved_count,
         COUNT(*)::int AS all_count
       FROM public.conversations c
       WHERE c.workspace_id = $1${countGroupClause}`,
      countParams,
    ),
    queryRows<{ group_id: string; cnt: number }>(
      `SELECT c.group_id::text AS group_id, COUNT(*)::int AS cnt
       FROM public.conversations c
       WHERE c.workspace_id = $1
         AND c.group_id IS NOT NULL
         AND c.status IN ('open', 'pending')
       GROUP BY c.group_id`,
      [workspaceId],
    ).catch(() => []),
    queryRows<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt
       FROM public.conversations c
       LEFT JOIN public.visitors v ON v.id = c.visitor_id
       WHERE ${filterWhereSql}`,
      sqlParams,
    ),
    queryRows<Record<string, unknown>>(
      `SELECT c.*,
              row_to_json(v.*) AS visitor,
              CASE WHEN ag.id IS NOT NULL THEN jsonb_build_object(
                'id', ag.id, 'name', ag.name, 'email', ag.email,
                'avatar_url', ag.avatar_url, 'role', ag.role, 'status', ag.status, 'created_at', ag.created_at
              ) ELSE NULL END AS agent,
              lm.id AS lm_id,
              lm.content AS lm_content,
              lm.sender_type AS lm_sender_type,
              lm.attachment_url AS lm_attachment_url,
              lm.created_at AS lm_created_at,
              COALESCE(ur.unread_count, 0)::int AS unread_count,
              COALESCE(lm.created_at, c.updated_at, c.created_at) AS effective_activity_at
       FROM public.conversations c
       LEFT JOIN public.visitors v ON v.id = c.visitor_id
       LEFT JOIN public.agents ag ON ag.id = COALESCE(c.assigned_agent_id, c.agent_id)
       LEFT JOIN LATERAL (
         SELECT m.id, m.content, m.sender_type, m.attachment_url, m.created_at
         FROM public.messages m
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC
         LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS unread_count
         FROM public.messages um
         WHERE um.conversation_id = c.id AND um.sender_type = 'visitor' AND um.read_at IS NULL
       ) ur ON true
       WHERE ${filterWhereSql}${paginationSql}
       ORDER BY ${orderSql}
       LIMIT $${limitIdx}${offsetClause}`,
      rowParams,
    ),
  ]);

  const hasMore = rawRows.length > limit;
  const pageRows = hasMore ? rawRows.slice(0, limit) : rawRows;

  const conversations: Conversation[] = pageRows.map((row) => {
    const conv = { ...row } as Record<string, unknown>;
    const lastMessage: Message | null = row.lm_id
      ? {
          id: String(row.lm_id),
          conversation_id: String(row.id),
          sender_type: String(row.lm_sender_type || 'visitor') as Message['sender_type'],
          sender_id: null,
          content: String(row.lm_content || ''),
          attachment_url: row.lm_attachment_url ? String(row.lm_attachment_url) : null,
          created_at: row.lm_created_at ? new Date(String(row.lm_created_at)).toISOString() : String(row.updated_at),
          read_at: null,
        }
      : null;

    delete conv.lm_id;
    delete conv.lm_content;
    delete conv.lm_sender_type;
    delete conv.lm_attachment_url;
    delete conv.lm_created_at;
    delete conv.effective_activity_at;

    return {
      ...(conv as unknown as Conversation),
      visitor: (row.visitor as Visitor | null) ?? undefined,
      agent: (row.agent as Agent | null) ?? null,
      last_message: lastMessage,
      unread_count: Number(row.unread_count ?? 0),
    };
  });

  let nextCursor: string | null = null;
  if (hasMore && pageRows.length > 0) {
    if (sort === 'newest') {
      const last = pageRows[pageRows.length - 1];
      const rawAt = last.effective_activity_at || last.updated_at || last.created_at;
      const isoAt = rawAt instanceof Date ? rawAt.toISOString() : String(rawAt);
      nextCursor = encodeCursor({ ts: isoAt, id: String(last.id) });
    } else {
      nextCursor = encodeCursor({ offset: offset + pageRows.length });
    }
  }

  const cRow = countsRows[0];
  const counts: SearchInboxCounts = {
    open: Number(cRow?.open_count ?? 0),
    mine: Number(cRow?.mine_count ?? 0),
    unassigned: Number(cRow?.unassigned_count ?? 0),
    ai: Number(cRow?.ai_count ?? 0),
    ai_handled: Number(cRow?.ai_count ?? 0),
    waiting: Number(cRow?.waiting_count ?? 0),
    waiting_approval: Number(cRow?.waiting_approval_count ?? 0),
    snoozed: Number(cRow?.snoozed_count ?? 0),
    resolved: Number(cRow?.resolved_count ?? 0),
    closed: Number(cRow?.resolved_count ?? 0),
    all: Number(cRow?.all_count ?? 0),
  };

  const groupCounts: Record<string, number> = {};
  for (const gc of groupCountRows) {
    if (gc.group_id) groupCounts[gc.group_id] = Number(gc.cnt ?? 0);
  }

  return {
    conversations,
    hasMore,
    nextCursor,
    total: Number(totalRows[0]?.cnt ?? conversations.length),
    counts,
    groupCounts,
  };
}

export async function assignConversationGroupAction(
  workspaceId: string,
  conversationId: string,
  groupId: string | null,
): Promise<{ groupId: string | null }> {
  await getWorkspaceAccess(workspaceId);
  await ensureInboxScaleSchema();

  if (!UUID_RE.test(conversationId)) {
    throw userError('Invalid conversation ID.');
  }

  const cleanGroup = groupId ? groupId.trim() : null;
  if (cleanGroup) {
    if (!UUID_RE.test(cleanGroup)) throw userError('Invalid team group ID.');
    const grp = await queryRows<{ id: string }>(
      `SELECT id FROM public.ticket_groups WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [cleanGroup, workspaceId],
    );
    if (!grp[0]?.id) {
      throw userError('Team group not found in this workspace.');
    }
  }

  const updated = await queryRows<{ id: string }>(
    `UPDATE public.conversations
     SET group_id = $1, updated_at = now()
     WHERE id = $2 AND workspace_id = $3
     RETURNING id`,
    [cleanGroup, conversationId, workspaceId],
  );
  if (!updated[0]?.id) {
    throw userError('Conversation not found in this workspace.');
  }
  return { groupId: cleanGroup };
}

export async function listConversationViewsAction(
  workspaceId: string,
): Promise<SavedConversationView[]> {
  const { user } = await getWorkspaceAccess(workspaceId);
  await ensureInboxScaleSchema();

  const rows = await queryRows<{
    id: string;
    name: string;
    owner_id: string | null;
    filters: Record<string, unknown> | null;
    sort: Record<string, unknown> | null;
  }>(
    `SELECT id::text AS id, name, owner_id::text AS owner_id, filters, sort
     FROM public.conversation_views
     WHERE workspace_id = $1
       AND (owner_id IS NULL OR owner_id = $2)
     ORDER BY position ASC, created_at ASC`,
    [workspaceId, user.id],
  ).catch(() => []);

  return rows.map((r) => {
    const f = (r.filters && typeof r.filters === 'object' ? r.filters : {}) as Record<string, unknown>;
    const s = (r.sort && typeof r.sort === 'object' ? r.sort : {}) as Record<string, unknown>;
    const field =
      s.field === 'waiting' || s.field === 'unread' || s.field === 'priority' ? s.field : 'newest';
    return {
      id: r.id,
      name: r.name,
      ownerId: r.owner_id,
      filters: {
        view: typeof f.view === 'string' ? (f.view as ServerInboxView) : undefined,
        channel: typeof f.channel === 'string' ? f.channel : undefined,
        priority: typeof f.priority === 'string' ? f.priority : undefined,
        groupId: typeof f.groupId === 'string' ? f.groupId : f.groupId === null ? null : undefined,
        search: typeof f.search === 'string' ? f.search : undefined,
      },
      sort: {
        field,
        direction: s.direction === 'asc' ? 'asc' : 'desc',
      },
    };
  });
}

export async function saveConversationViewAction(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    filters?: SavedConversationView['filters'];
    sort?: SavedConversationView['sort'];
    shared?: boolean;
  },
): Promise<SavedConversationView> {
  const { user, role } = await getWorkspaceAccess(workspaceId);
  await ensureInboxScaleSchema();

  const name = (input.name || '').trim().slice(0, 80);
  if (!name) throw userError('Give the saved view a name.');

  const shared = Boolean(input.shared);
  if (shared && !roleCan(role, 'manage_groups')) {
    throw userError('Only admins can share conversation views with the whole team.');
  }

  const rawFilters = input.filters || {};
  const cleanFilters: SavedConversationView['filters'] = {
    ...(rawFilters.view ? { view: rawFilters.view } : {}),
    ...(rawFilters.channel && rawFilters.channel !== 'all' ? { channel: rawFilters.channel } : {}),
    ...(rawFilters.priority && rawFilters.priority !== 'all' ? { priority: rawFilters.priority } : {}),
    ...(rawFilters.groupId ? { groupId: rawFilters.groupId } : {}),
    ...(rawFilters.search?.trim() ? { search: rawFilters.search.trim().slice(0, 120) } : {}),
  };
  const cleanSort: SavedConversationView['sort'] = {
    field:
      input.sort?.field === 'waiting' ||
      input.sort?.field === 'unread' ||
      input.sort?.field === 'priority'
        ? input.sort.field
        : 'newest',
    direction: input.sort?.direction === 'asc' ? 'asc' : 'desc',
  };
  const ownerId = shared ? null : user.id;

  const rows = input.id && UUID_RE.test(input.id)
    ? await queryRows<{
        id: string;
        name: string;
        owner_id: string | null;
        filters: SavedConversationView['filters'];
        sort: SavedConversationView['sort'];
      }>(
        `UPDATE public.conversation_views
         SET name = $1, filters = $2::jsonb, sort = $3::jsonb, owner_id = $4, updated_at = now()
         WHERE id = $5 AND workspace_id = $6
         RETURNING id::text AS id, name, owner_id::text AS owner_id, filters, sort`,
        [name, JSON.stringify(cleanFilters), JSON.stringify(cleanSort), ownerId, input.id, workspaceId],
      )
    : await queryRows<{
        id: string;
        name: string;
        owner_id: string | null;
        filters: SavedConversationView['filters'];
        sort: SavedConversationView['sort'];
      }>(
        `INSERT INTO public.conversation_views (workspace_id, owner_id, name, filters, sort)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
         RETURNING id::text AS id, name, owner_id::text AS owner_id, filters, sort`,
        [workspaceId, ownerId, name, JSON.stringify(cleanFilters), JSON.stringify(cleanSort)],
      );

  const saved = rows[0];
  if (!saved) throw userError('Could not save conversation view.');

  return {
    id: saved.id,
    name: saved.name,
    ownerId: saved.owner_id,
    filters: saved.filters || cleanFilters,
    sort: saved.sort || cleanSort,
  };
}

export async function deleteConversationViewAction(
  workspaceId: string,
  viewId: string,
): Promise<void> {
  const { user, role } = await getWorkspaceAccess(workspaceId);
  await ensureInboxScaleSchema();
  if (!UUID_RE.test(viewId)) throw userError('Invalid view ID.');

  const existing = await queryRows<{ id: string; owner_id: string | null }>(
    `SELECT id::text AS id, owner_id::text AS owner_id
     FROM public.conversation_views
     WHERE id = $1 AND workspace_id = $2
     LIMIT 1`,
    [viewId, workspaceId],
  );
  if (!existing[0]) throw userError('Saved view not found.');
  if (existing[0].owner_id !== user.id && !roleCan(role, 'manage_groups')) {
    throw userError('You do not have permission to delete this shared view.');
  }

  await query(
    `DELETE FROM public.conversation_views WHERE id = $1 AND workspace_id = $2`,
    [viewId, workspaceId],
  );
}

export async function updateVisitorNotesAction(
  workspaceId: string,
  visitorId: string,
  notes: string,
): Promise<{ notes: string | null }> {
  await getWorkspaceAccess(workspaceId);
  await ensureInboxScaleSchema();
  if (!UUID_RE.test(visitorId)) throw userError('Invalid visitor ID.');

  const clean = notes.trim().slice(0, 5000);
  const rows = await queryRows<{ notes: string | null }>(
    `UPDATE public.visitors
     SET notes = $1
     WHERE id = $2 AND workspace_id = $3
     RETURNING notes`,
    [clean || null, visitorId, workspaceId],
  );
  if (!rows[0]) throw userError('Customer record not found in this workspace.');
  return { notes: rows[0].notes ?? null };
}

export async function getConversationAiSummaryAction(
  workspaceId: string,
  conversationId: string,
): Promise<ConversationAiSummary> {
  await getWorkspaceAccess(workspaceId);
  if (!UUID_RE.test(conversationId)) {
    return {
      latestConfidencePct: null,
      estimatedCostUsd: null,
      agentName: null,
      engineUsed: null,
      pendingApprovalRun: null,
    };
  }

  const [verifRows, tokenRows, runRows] = await Promise.all([
    queryRows<{
      confidence: number | string | null;
      agent_name: string | null;
      metadata: Record<string, unknown> | null;
    }>(
      `SELECT confidence, agent_name, metadata
       FROM public.ai_verification_logs
       WHERE workspace_id = $1 AND conversation_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [workspaceId, conversationId],
    ).catch(() => []),

    queryRows<{ total_cost: number | string | null; latest_model: string | null }>(
      `SELECT SUM(cost_usd)::text AS total_cost, MAX(model) AS latest_model
       FROM public.ai_token_logs
       WHERE workspace_id = $1 AND conversation_id = $2`,
      [workspaceId, conversationId],
    ).catch(() => []),

    queryRows<{
      id: string;
      thread_id: string;
      agent_id: string | null;
      engine_type: string | null;
      topic: string | null;
      pending_action: Record<string, unknown> | null;
      draft_reply: string | null;
      created_at: string;
      agent_name: string | null;
    }>(
      `SELECT ar.id::text AS id, ar.thread_id, ar.agent_id::text AS agent_id, ar.engine_type,
              ar.topic, ar.pending_action, ar.draft_reply, ar.created_at,
              aa.name AS agent_name
       FROM public.ai_agent_runs ar
       LEFT JOIN public.ai_agents aa ON aa.id = ar.agent_id AND aa.workspace_id = $1
       WHERE ar.workspace_id = $1
         AND ar.conversation_id = $2
         AND ar.status IN ('paused_approval', 'waiting_approval')
       ORDER BY ar.created_at DESC
       LIMIT 1`,
      [workspaceId, conversationId],
    ).catch(() => []),
  ]);

  const v = verifRows[0];
  let latestConfidencePct: number | null = null;
  if (v?.confidence !== null && v?.confidence !== undefined) {
    const raw = Number(v.confidence);
    if (Number.isFinite(raw) && raw >= 0) {
      latestConfidencePct = Math.min(100, Math.round(raw > 1 ? raw : raw * 100));
    }
  }

  const rawCost = tokenRows[0]?.total_cost != null ? Number(tokenRows[0].total_cost) : null;
  const estimatedCostUsd =
    rawCost !== null && Number.isFinite(rawCost) && rawCost >= 0
      ? Number(rawCost.toFixed(6))
      : null;

  const vMeta = v?.metadata && typeof v.metadata === 'object' ? v.metadata : null;
  const metaEngine =
    typeof vMeta?.engine === 'string'
      ? vMeta.engine
      : typeof vMeta?.selectedEngine === 'string'
        ? vMeta.selectedEngine
        : null;

  const pendingRow = runRows[0];
  const pendingActionObj =
    pendingRow?.pending_action && typeof pendingRow.pending_action === 'object'
      ? pendingRow.pending_action
      : {};
  const rawPendingActions = Array.isArray(pendingActionObj.pendingActions)
    ? pendingActionObj.pendingActions
    : [];

  return {
    latestConfidencePct,
    estimatedCostUsd,
    agentName: v?.agent_name || pendingRow?.agent_name || null,
    engineUsed: metaEngine || pendingRow?.engine_type || tokenRows[0]?.latest_model || null,
    pendingApprovalRun: pendingRow
      ? {
          runId: pendingRow.id,
          threadId: pendingRow.thread_id,
          agentId: pendingRow.agent_id,
          agentName: pendingRow.agent_name || v?.agent_name || 'AI Agent',
          topic: pendingRow.topic || 'General inquiry',
          autonomyLevel: 2,
          reason:
            typeof pendingActionObj.reason === 'string' && pendingActionObj.reason
              ? pendingActionObj.reason
              : typeof pendingActionObj.handoverReason === 'string' && pendingActionObj.handoverReason
                ? pendingActionObj.handoverReason
                : 'Human approval required before sending reply.',
          draftReply: pendingRow.draft_reply || '',
          pendingActions: rawPendingActions
            .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === 'object'))
            .map((a) => ({
              toolName: String(a.toolName || ''),
              summary: String(a.summary || ''),
              args: (a.args && typeof a.args === 'object' ? a.args : {}) as Record<string, unknown>,
            })),
          createdAt: String(pendingRow.created_at),
        }
      : null,
  };
}

export async function getVisitorLifetimeStatsAction(
  workspaceId: string,
  visitorId: string | null,
  visitorEmail?: string | null,
): Promise<VisitorLifetimeStats> {
  await getWorkspaceAccess(workspaceId);

  const cleanEmail = (visitorEmail || '').trim().toLowerCase();
  const cleanId = visitorId && UUID_RE.test(visitorId) ? visitorId : null;
  if (!cleanId && !cleanEmail) {
    return {
      lifetimeCsatAvg: null,
      csatCount: 0,
      avgFirstReplySec: null,
      totalResolvedCount: 0,
    };
  }

  const matchedVisitorRows = await queryRows<{ id: string }>(
    `SELECT id::text AS id
     FROM public.visitors
     WHERE workspace_id = $1
       AND (
         ($2::uuid IS NOT NULL AND id = $2::uuid)
         OR ($3 <> '' AND LOWER(COALESCE(email, '')) = $3)
       )`,
    [workspaceId, cleanId, cleanEmail],
  ).catch(() => []);

  const visitorIds = Array.from(
    new Set([
      ...(cleanId ? [cleanId] : []),
      ...matchedVisitorRows.map((r) => r.id),
    ]),
  );

  if (visitorIds.length === 0) {
    return {
      lifetimeCsatAvg: null,
      csatCount: 0,
      avgFirstReplySec: null,
      totalResolvedCount: 0,
    };
  }

  const [convRows, surveyRows] = await Promise.all([
    queryRows<{
      resolved_cnt: number;
      avg_frt_sec: string | null;
      csat_sum: string | null;
      csat_cnt: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'closed')::int AS resolved_cnt,
         AVG(EXTRACT(EPOCH FROM (first_agent_reply_at - created_at)))
           FILTER (WHERE first_agent_reply_at IS NOT NULL AND first_agent_reply_at >= created_at)::text AS avg_frt_sec,
         SUM(csat_rating) FILTER (WHERE csat_rating IS NOT NULL)::text AS csat_sum,
         COUNT(csat_rating) FILTER (WHERE csat_rating IS NOT NULL)::int AS csat_cnt
       FROM public.conversations
       WHERE workspace_id = $1
         AND visitor_id = ANY($2::uuid[])`,
      [workspaceId, visitorIds],
    ).catch(() => []),
    queryRows<{ survey_sum: string | null; survey_cnt: number }>(
      `SELECT SUM(score)::text AS survey_sum, COUNT(score)::int AS survey_cnt
       FROM public.survey_responses
       WHERE workspace_id = $1
         AND visitor_id = ANY($2::uuid[])
         AND score IS NOT NULL`,
      [workspaceId, visitorIds],
    ).catch(() => []),
  ]);

  const c = convRows[0];
  const s = surveyRows[0];
  const totalCsatCnt = Number(c?.csat_cnt ?? 0) + Number(s?.survey_cnt ?? 0);
  const totalCsatSum =
    (c?.csat_sum != null ? Number(c.csat_sum) : 0) +
    (s?.survey_sum != null ? Number(s.survey_sum) : 0);

  const avgFrtRaw = c?.avg_frt_sec != null ? Number(c.avg_frt_sec) : NaN;

  return {
    lifetimeCsatAvg:
      totalCsatCnt > 0 ? Number((totalCsatSum / totalCsatCnt).toFixed(1)) : null,
    csatCount: totalCsatCnt,
    avgFirstReplySec:
      Number.isFinite(avgFrtRaw) && avgFrtRaw >= 0 ? Math.round(avgFrtRaw) : null,
    totalResolvedCount: Number(c?.resolved_cnt ?? 0),
  };
}
