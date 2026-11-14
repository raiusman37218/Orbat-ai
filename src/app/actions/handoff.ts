'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import { roleCan } from '@/lib/team/permissions';
import { normalizeHandoffSettings } from '@/lib/handoff/state-machine';
import { userError } from '@/lib/errors/user-error';
import type { WorkspaceHandoffSettings } from '@/types/database';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LiveHandoffQueueItem {
  id: string;
  visitorName: string;
  visitorEmail: string | null;
  channel: string;
  priority: string;
  handoffStatus: string;
  handoffReason: string | null;
  handoffSummary: string | null;
  ringStartedAt: string | null;
  handoffRequestedAt: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  ringingAgentId: string | null;
  ringingAgentName: string | null;
  ringBroadcast: boolean;
  lastMessagePreview: string | null;
  updatedAt: string;
}

export interface HandoffAgentPresence {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'away' | 'offline';
  activeChats: number;
  maxChats: number;
  lastHeartbeat: string | null;
}

export interface HandoffConsoleBootstrap {
  me: { id: string; role: string };
  canManage: boolean;
  canReply: boolean;
  isWithinOfficeHours: boolean;
  timezone: string;
  settings: WorkspaceHandoffSettings & {
    handoff_mode?: string;
    routing_mode?: string;
    ring_timeout_seconds?: number;
    queue_timeout_seconds?: number;
    first_reply_timeout_seconds?: number;
    unanswered_alert_to?: string;
  };
  queue: LiveHandoffQueueItem[];
  agents: HandoffAgentPresence[];
}

export async function getHandoffConsoleAction(workspaceId: string): Promise<HandoffConsoleBootstrap> {
  const access = await getWorkspaceAccess(workspaceId, 'view');

  const [wsRows, queueRows, agentRows] = await Promise.all([
    queryRows<{
      handoff_settings: Record<string, unknown> | null;
      timezone: string | null;
      in_hours: boolean;
    }>(
      `SELECT w.handoff_settings, w.timezone,
              public.fn_is_within_office_hours(w.id) AS in_hours
       FROM public.workspaces w
       WHERE w.id = $1 LIMIT 1`,
      [workspaceId],
    ),
    queryRows<{
      id: string;
      channel: string | null;
      priority: string;
      handoff_status: string;
      handoff_reason: string | null;
      handoff_summary: string | null;
      ring_started_at: string | null;
      handoff_requested_at: string | null;
      assigned_agent_id: string | null;
      ringing_agent_id: string | null;
      ring_broadcast: boolean;
      updated_at: string;
      visitor_name: string | null;
      visitor_email: string | null;
      assigned_agent_name: string | null;
      ringing_agent_name: string | null;
      last_msg: string | null;
    }>(
      `SELECT c.id, c.channel, c.priority, c.handoff_status, c.handoff_reason, c.handoff_summary,
              c.ring_started_at, c.handoff_requested_at, c.assigned_agent_id, c.ringing_agent_id,
              c.ring_broadcast, c.updated_at,
              v.name AS visitor_name, COALESCE(c.customer_email, v.email) AS visitor_email,
              aa.name AS assigned_agent_name,
              ra.name AS ringing_agent_name,
              (SELECT m.content FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg
       FROM public.conversations c
       LEFT JOIN public.visitors v ON v.id = c.visitor_id
       LEFT JOIN public.agents aa ON aa.id = c.assigned_agent_id
       LEFT JOIN public.agents ra ON ra.id = c.ringing_agent_id
       WHERE c.workspace_id = $1
         AND c.status = 'open'
         AND c.handoff_status IN ('handoff_offered', 'waiting_for_agent', 'offline_queued', 'agent_active')
       ORDER BY
         CASE c.handoff_status
           WHEN 'waiting_for_agent' THEN 1
           WHEN 'offline_queued' THEN 2
           WHEN 'handoff_offered' THEN 3
           ELSE 4
         END ASC,
         COALESCE(c.handoff_requested_at, c.updated_at) ASC
       LIMIT 40`,
      [workspaceId],
    ),
    queryRows<{
      id: string;
      name: string;
      role: string;
      manual_status: string | null;
      status: string;
      max_concurrent_chats: number | null;
      last_heartbeat: string | null;
      active_chats: string;
    }>(
      `SELECT a.id, a.name, a.role, s.manual_status, a.status, s.max_concurrent_chats, s.last_heartbeat,
              (
                SELECT COUNT(*)
                FROM public.conversations c
                WHERE c.workspace_id = $1 AND c.assigned_agent_id = a.id AND c.status = 'open' AND c.handoff_status = 'agent_active'
              )::text AS active_chats
       FROM public.agents a
       LEFT JOIN public.agent_status s ON s.agent_id = a.id AND s.workspace_id = $1
       WHERE a.workspace_id = $1 AND a.is_active = true AND a.role <> 'light_agent'
       ORDER BY (COALESCE(s.manual_status, a.status) = 'online') DESC, a.name ASC`,
      [workspaceId],
    ),
  ]);

  const ws = wsRows[0];
  const normalized = normalizeHandoffSettings(ws?.handoff_settings);

  return {
    me: { id: access.user.id, role: access.role },
    canManage: roleCan(access.role, 'manage_settings'),
    canReply: roleCan(access.role, 'reply'),
    isWithinOfficeHours: Boolean(ws?.in_hours ?? true),
    timezone: ws?.timezone || 'UTC',
    settings: normalized as HandoffConsoleBootstrap['settings'],
    queue: queueRows.map((q) => ({
      id: q.id,
      visitorName: q.visitor_name?.trim() || 'Visitor',
      visitorEmail: q.visitor_email,
      channel: q.channel || 'web',
      priority: q.priority || 'normal',
      handoffStatus: q.handoff_status,
      handoffReason: q.handoff_reason,
      handoffSummary: q.handoff_summary,
      ringStartedAt: q.ring_started_at,
      handoffRequestedAt: q.handoff_requested_at,
      assignedAgentId: q.assigned_agent_id,
      assignedAgentName: q.assigned_agent_name,
      ringingAgentId: q.ringing_agent_id,
      ringingAgentName: q.ringing_agent_name,
      ringBroadcast: Boolean(q.ring_broadcast),
      lastMessagePreview: q.last_msg ? q.last_msg.slice(0, 140) : null,
      updatedAt: q.updated_at,
    })),
    agents: agentRows.map((a) => {
      const st = a.manual_status || a.status;
      return {
        id: a.id,
        name: a.name,
        role: a.role,
        status: st === 'online' || st === 'away' ? st : 'offline',
        activeChats: Number(a.active_chats || 0),
        maxChats: a.max_concurrent_chats ?? normalized.routing.max_concurrent_chats_per_agent,
        lastHeartbeat: a.last_heartbeat,
      };
    }),
  };
}

export async function saveHandoffPolicyAction(
  workspaceId: string,
  input: {
    handoffMode: 'on' | 'email_only' | 'off';
    strategy: 'round_robin' | 'broadcast';
    ringTimeoutSeconds: number;
    maxConcurrentChatsPerAgent: number;
    unansweredTimeoutMinutes: number;
    cooldownMessageCount: number;
    requireConfirmation: boolean;
    aiAssistOfferEnabled: boolean;
    keywords: string[];
    offlineMessage: string;
  },
): Promise<{ success: true }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');

  type HandoffJson = {
    routing?: Record<string, unknown>;
    ai?: Record<string, unknown>;
    fallback?: Record<string, unknown>;
    [key: string]: unknown;
  };
  const existing = await queryRows<{ handoff_settings: HandoffJson | null }>(
    `SELECT handoff_settings FROM public.workspaces WHERE id = $1 LIMIT 1`,
    [workspaceId],
  );
  const current: HandoffJson = existing[0]?.handoff_settings || {};

  const normalized = normalizeHandoffSettings({
    ...current,
    handoff_mode: input.handoffMode,
    routing: {
      ...(current.routing || {}),
      strategy: input.strategy,
      ring_timeout_seconds: Math.max(10, Math.min(300, Math.round(input.ringTimeoutSeconds))),
      max_concurrent_chats_per_agent: Math.max(1, Math.min(20, Math.round(input.maxConcurrentChatsPerAgent))),
    },
    ai: {
      ...(current.ai || {}),
      cooldown_message_count: Math.max(1, Math.min(30, Math.round(input.cooldownMessageCount))),
      require_confirmation: Boolean(input.requireConfirmation),
      keywords: (input.keywords || []).map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 30),
    },
    fallback: {
      ...(current.fallback || {}),
      ai_assist_offer_enabled: Boolean(input.aiAssistOfferEnabled),
      unanswered_timeout_minutes: Math.max(1, Math.min(60, Math.round(input.unansweredTimeoutMinutes))),
      offline_expected_reply_text: (input.offlineMessage || '').trim().slice(0, 400),
    },
  });

  await query(
    `UPDATE public.workspaces SET handoff_settings = $1::jsonb, updated_at = now() WHERE id = $2`,
    [JSON.stringify(normalized), workspaceId],
  );

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'handoff.settings_updated', 'handoff_settings', $4::jsonb)`,
    [
      workspaceId,
      access.user.id,
      access.user.email || 'Admin',
      JSON.stringify({ mode: input.handoffMode, strategy: input.strategy, ringTimeoutSeconds: input.ringTimeoutSeconds }),
    ],
  ).catch(() => {});

  return { success: true };
}

export async function runHandoffQueueCommandAction(
  workspaceId: string,
  conversationId: string,
  command: 'claim' | 'skip' | 'return_to_ai',
): Promise<{ ok: boolean; message?: string }> {
  const access = await getWorkspaceAccess(workspaceId, 'reply');
  if (!UUID.test(conversationId || '')) throw userError('Invalid conversation id.');

  const conv = await queryRows<{ id: string }>(
    `SELECT id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
    [conversationId, workspaceId],
  );
  if (!conv[0]) throw userError('Conversation not found.');

  if (command === 'claim') {
    const { data, error } = await access.supabase.rpc('claim_conversation', { p_conversation_id: conversationId });
    if (error) throw userError(error.message || 'Could not claim chat.');
    return (data || { ok: true }) as { ok: boolean; message?: string };
  }
  if (command === 'skip') {
    const { error } = await access.supabase.rpc('skip_conversation', { p_conversation_id: conversationId });
    if (error) throw userError(error.message || 'Could not skip chat.');
    return { ok: true };
  }

  const { error } = await access.supabase.rpc('return_to_ai', { p_conversation_id: conversationId });
  if (error) throw userError(error.message || 'Only the assigned agent can return this chat to AI.');
  return { ok: true };
}
