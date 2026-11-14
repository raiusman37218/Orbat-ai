'use server';

import crypto from 'node:crypto';
import { queryRows } from '@/lib/db';
import { userError } from '@/lib/errors/user-error';
import { getWorkspaceAccess } from '@/lib/team/access';
import { roleCan } from '@/lib/team/permissions';
import { redactVoicePii } from '@/lib/voice/redact';
import { createTicketAction } from './tickets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VoiceProvider = 'unconfigured' | 'twilio' | 'telnyx' | 'sip' | 'custom';
export type VoiceAfterHoursMode = 'voicemail_callback' | 'ai_24_7' | 'forward' | 'closed';
export type VoiceCallStatus =
  | 'live'
  | 'ai_resolved'
  | 'transferred'
  | 'voicemail'
  | 'callback_booked'
  | 'ended'
  | 'missed';
export type VoiceCampaignStatus = 'active' | 'scheduled' | 'paused' | 'completed' | 'cancelled';

export interface VoiceSettingsRecord {
  workspace_id: string;
  provider: VoiceProvider;
  business_number: string | null;
  voice_ai_enabled: boolean;
  ai_greeting: string | null;
  transfer_group_id: string | null;
  transfer_group_name: string | null;
  after_hours_mode: VoiceAfterHoursMode;
  forward_number: string | null;
  pii_redaction: boolean;
  recording_enabled: boolean;
  default_language: string;
  monthly_minutes_cap: number;
  has_webhook_secret: boolean;
  updated_at: string;
}

export interface VoiceKpis {
  callsToday: number;
  aiResolvedPct: number;
  aiResolvedCount: number;
  avgHandleSeconds: number;
  transferRatePct: number;
  transferredCount: number;
  minutesUsedThisMonth: number;
  monthlyMinutesCap: number;
}

export interface VoiceCallRecord {
  id: string;
  workspace_id: string;
  visitor_id: string | null;
  ticket_id: string | null;
  ticket_number: number | null;
  campaign_id: string | null;
  external_call_id: string | null;
  direction: 'inbound' | 'outbound';
  status: VoiceCallStatus;
  handler: 'ai' | 'agent';
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  caller_name: string | null;
  caller_phone: string;
  to_number: string | null;
  language: string;
  recording_consent: boolean;
  order_context: string | null;
  ai_summary: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  duration_seconds: number;
  recording_url: string | null;
  is_listening: boolean;
  started_at: string;
  ended_at: string | null;
}

export interface VoiceCallTurnRecord {
  id: string;
  call_id: string;
  speaker: 'caller' | 'ai' | 'agent' | 'system';
  speaker_name: string | null;
  transcript: string;
  translated_text: string | null;
  redacted_pii: boolean;
  offset_seconds: number;
  created_at: string;
}

export interface VoiceCampaignRecord {
  id: string;
  workspace_id: string;
  name: string;
  status: VoiceCampaignStatus;
  script_prompt: string | null;
  total_contacts: number;
  completed_contacts: number;
  confirmed_count: number;
  cancelled_count: number;
  no_answer_count: number;
  schedule_label: string | null;
  created_at: string;
}

export interface VoiceBootstrap {
  kpis: VoiceKpis;
  settings: VoiceSettingsRecord;
  calls: VoiceCallRecord[];
  campaigns: VoiceCampaignRecord[];
  groups: Array<{ id: string; name: string }>;
  counts: { all: number; live: number; ai: number; transferred: number };
  canEditTicket: boolean;
  canManageSettings: boolean;
  canEditContent: boolean;
  canReply: boolean;
  currentAgentId: string;
}

function assertUuid(id: string, label: string): void {
  if (!UUID_RE.test(id || '')) throw userError(`Invalid ${label}.`);
}

async function ensureVoiceSettings(workspaceId: string): Promise<VoiceSettingsRecord> {
  await queryRows(
    `INSERT INTO public.voice_settings (workspace_id)
     VALUES ($1)
     ON CONFLICT (workspace_id) DO NOTHING`,
    [workspaceId],
  );
  const [row] = await queryRows<VoiceSettingsRecord>(
    `SELECT
       s.workspace_id,
       s.provider,
       s.business_number,
       s.voice_ai_enabled,
       s.ai_greeting,
       s.transfer_group_id,
       g.name AS transfer_group_name,
       s.after_hours_mode,
       s.forward_number,
       s.pii_redaction,
       s.recording_enabled,
       s.default_language,
       s.monthly_minutes_cap,
       (s.webhook_secret IS NOT NULL AND s.webhook_secret <> '') AS has_webhook_secret,
       s.updated_at
     FROM public.voice_settings s
     LEFT JOIN public.ticket_groups g ON g.id = s.transfer_group_id
     WHERE s.workspace_id = $1
     LIMIT 1`,
    [workspaceId],
  );
  if (!row) throw userError('Could not load voice settings.');
  return row;
}

export async function getVoiceBootstrapAction(
  workspaceId: string,
  filter: 'all' | 'live' | 'ai' | 'transferred' = 'all',
  q?: string,
): Promise<VoiceBootstrap> {
  const { role, agent } = await getWorkspaceAccess(workspaceId, 'view');

  const settings = await ensureVoiceSettings(workspaceId);

  const [kpiRow] = await queryRows<{
    calls_today: number;
    total_ended_today: number;
    ai_resolved_today: number;
    transferred_today: number;
    avg_handle_seconds: number;
    seconds_this_month: number;
    all_cnt: number;
    live_cnt: number;
    ai_cnt: number;
    transferred_cnt: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE started_at >= date_trunc('day', now()))::int AS calls_today,
       COUNT(*) FILTER (WHERE started_at >= date_trunc('day', now()) AND status <> 'live')::int AS total_ended_today,
       COUNT(*) FILTER (WHERE started_at >= date_trunc('day', now()) AND status = 'ai_resolved')::int AS ai_resolved_today,
       COUNT(*) FILTER (WHERE started_at >= date_trunc('day', now()) AND (status = 'transferred' OR handler = 'agent'))::int AS transferred_today,
       COALESCE(ROUND(AVG(duration_seconds) FILTER (WHERE duration_seconds > 0)), 0)::int AS avg_handle_seconds,
       COALESCE(SUM(duration_seconds) FILTER (WHERE started_at >= date_trunc('month', now())), 0)::int AS seconds_this_month,
       COUNT(*)::int AS all_cnt,
       COUNT(*) FILTER (WHERE status = 'live')::int AS live_cnt,
       COUNT(*) FILTER (WHERE status = 'ai_resolved' OR (status = 'live' AND handler = 'ai'))::int AS ai_cnt,
       COUNT(*) FILTER (WHERE status = 'transferred' OR handler = 'agent')::int AS transferred_cnt
     FROM public.voice_calls
     WHERE workspace_id = $1`,
    [workspaceId],
  );

  const whereParts = ['c.workspace_id = $1'];
  const params: unknown[] = [workspaceId];

  if (filter === 'live') whereParts.push("c.status = 'live'");
  else if (filter === 'ai') whereParts.push("(c.status = 'ai_resolved' OR (c.status = 'live' AND c.handler = 'ai'))");
  else if (filter === 'transferred') whereParts.push("(c.status = 'transferred' OR c.handler = 'agent')");

  const cleanQ = (q || '').trim();
  if (cleanQ) {
    params.push(`%${cleanQ}%`);
    const p = `$${params.length}`;
    whereParts.push(`(COALESCE(c.caller_name, '') ILIKE ${p} OR c.caller_phone ILIKE ${p} OR COALESCE(c.order_context, '') ILIKE ${p})`);
  }

  const [calls, campaigns, groups] = await Promise.all([
    queryRows<VoiceCallRecord>(
      `SELECT
         c.id, c.workspace_id, c.visitor_id, c.ticket_id, t.number AS ticket_number,
         c.campaign_id, c.external_call_id, c.direction, c.status, c.handler,
         c.assigned_agent_id, a.name AS assigned_agent_name,
         c.caller_name, c.caller_phone, c.to_number, c.language, c.recording_consent,
         c.order_context, c.ai_summary, c.sentiment, c.duration_seconds,
         c.recording_url, c.is_listening, c.started_at, c.ended_at
       FROM public.voice_calls c
       LEFT JOIN public.agents a ON a.id = c.assigned_agent_id
       LEFT JOIN public.tickets t ON t.id = c.ticket_id
       WHERE ${whereParts.join(' AND ')}
       ORDER BY (c.status = 'live') DESC, c.started_at DESC
       LIMIT 80`,
      params,
    ),
    queryRows<VoiceCampaignRecord>(
      `SELECT id, workspace_id, name, status, script_prompt, total_contacts, completed_contacts,
              confirmed_count, cancelled_count, no_answer_count, schedule_label, created_at
       FROM public.voice_campaigns
       WHERE workspace_id = $1
       ORDER BY (status = 'active') DESC, created_at DESC
       LIMIT 30`,
      [workspaceId],
    ),
    queryRows<{ id: string; name: string }>(
      'SELECT id, name FROM public.ticket_groups WHERE workspace_id = $1 ORDER BY name ASC',
      [workspaceId],
    ),
  ]);

  const k = kpiRow ?? {
    calls_today: 0,
    total_ended_today: 0,
    ai_resolved_today: 0,
    transferred_today: 0,
    avg_handle_seconds: 0,
    seconds_this_month: 0,
    all_cnt: 0,
    live_cnt: 0,
    ai_cnt: 0,
    transferred_cnt: 0,
  };

  const denom = Math.max(k.calls_today, 0);
  const aiResolvedPct = denom > 0 ? Math.round((k.ai_resolved_today / denom) * 100) : 0;
  const transferRatePct = denom > 0 ? Math.round((k.transferred_today / denom) * 100) : 0;

  return {
    kpis: {
      callsToday: k.calls_today,
      aiResolvedPct,
      aiResolvedCount: k.ai_resolved_today,
      avgHandleSeconds: k.avg_handle_seconds,
      transferRatePct,
      transferredCount: k.transferred_today,
      minutesUsedThisMonth: Math.ceil(k.seconds_this_month / 60),
      monthlyMinutesCap: settings.monthly_minutes_cap,
    },
    settings,
    calls,
    campaigns,
    groups,
    counts: {
      all: k.all_cnt,
      live: k.live_cnt,
      ai: k.ai_cnt,
      transferred: k.transferred_cnt,
    },
    canEditTicket: roleCan(role, 'edit_ticket'),
    canManageSettings: roleCan(role, 'manage_settings'),
    canEditContent: roleCan(role, 'edit_content'),
    canReply: roleCan(role, 'reply'),
    currentAgentId: agent.id,
  };
}

export async function getVoiceCallDetailAction(
  workspaceId: string,
  callId: string,
): Promise<{ call: VoiceCallRecord; turns: VoiceCallTurnRecord[] }> {
  await getWorkspaceAccess(workspaceId, 'view');
  assertUuid(callId, 'call');

  const [call] = await queryRows<VoiceCallRecord>(
    `SELECT
       c.id, c.workspace_id, c.visitor_id, c.ticket_id, t.number AS ticket_number,
       c.campaign_id, c.external_call_id, c.direction, c.status, c.handler,
       c.assigned_agent_id, a.name AS assigned_agent_name,
       c.caller_name, c.caller_phone, c.to_number, c.language, c.recording_consent,
       c.order_context, c.ai_summary, c.sentiment, c.duration_seconds,
       c.recording_url, c.is_listening, c.started_at, c.ended_at
     FROM public.voice_calls c
     LEFT JOIN public.agents a ON a.id = c.assigned_agent_id
     LEFT JOIN public.tickets t ON t.id = c.ticket_id
     WHERE c.workspace_id = $1 AND c.id = $2
     LIMIT 1`,
    [workspaceId, callId],
  );
  if (!call) throw userError('Call not found.');

  const turns = await queryRows<VoiceCallTurnRecord>(
    `SELECT id, call_id, speaker, speaker_name, transcript, translated_text, redacted_pii, offset_seconds, created_at
     FROM public.voice_call_turns
     WHERE workspace_id = $1 AND call_id = $2
     ORDER BY created_at ASC`,
    [workspaceId, callId],
  );

  return { call, turns };
}

export async function toggleVoiceListenAction(
  workspaceId: string,
  callId: string,
  listening: boolean,
): Promise<void> {
  await getWorkspaceAccess(workspaceId, 'view');
  assertUuid(callId, 'call');
  await queryRows(
    'UPDATE public.voice_calls SET is_listening = $3, updated_at = now() WHERE workspace_id = $1 AND id = $2',
    [workspaceId, callId, Boolean(listening)],
  );
}

export async function takeOverVoiceCallAction(workspaceId: string, callId: string): Promise<void> {
  const { agent } = await getWorkspaceAccess(workspaceId, 'edit_ticket');
  assertUuid(callId, 'call');

  const [call] = await queryRows<{ id: string; status: string; started_at: string }>(
    'SELECT id, status, started_at FROM public.voice_calls WHERE workspace_id = $1 AND id = $2 LIMIT 1',
    [workspaceId, callId],
  );
  if (!call) throw userError('Call not found.');
  if (call.status !== 'live') throw userError('Only live calls can be taken over.');

  const offset = Math.max(0, Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000));
  await queryRows(
    `UPDATE public.voice_calls
     SET handler = 'agent', assigned_agent_id = $3, is_listening = true, updated_at = now()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, callId, agent.id],
  );
  await queryRows(
    `INSERT INTO public.voice_call_turns (workspace_id, call_id, speaker, speaker_name, transcript, offset_seconds)
     VALUES ($1, $2, 'system', 'System', $3, $4)`,
    [workspaceId, callId, `${agent.name || 'Agent'} took over the call from Voice AI.`, offset],
  );
}

export async function handBackVoiceCallToAiAction(workspaceId: string, callId: string): Promise<void> {
  const { agent } = await getWorkspaceAccess(workspaceId, 'edit_ticket');
  assertUuid(callId, 'call');

  const [call] = await queryRows<{ id: string; status: string; started_at: string }>(
    'SELECT id, status, started_at FROM public.voice_calls WHERE workspace_id = $1 AND id = $2 LIMIT 1',
    [workspaceId, callId],
  );
  if (!call) throw userError('Call not found.');
  if (call.status !== 'live') throw userError('Only live calls can be handed back to AI.');

  const offset = Math.max(0, Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000));
  await queryRows(
    `UPDATE public.voice_calls
     SET handler = 'ai', updated_at = now()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, callId],
  );
  await queryRows(
    `INSERT INTO public.voice_call_turns (workspace_id, call_id, speaker, speaker_name, transcript, offset_seconds)
     VALUES ($1, $2, 'system', 'System', $3, $4)`,
    [workspaceId, callId, `${agent.name || 'Agent'} handed the call back to Voice AI.`, offset],
  );
}

export async function endVoiceCallAction(
  workspaceId: string,
  callId: string,
  outcome?: Exclude<VoiceCallStatus, 'live'>,
): Promise<void> {
  await getWorkspaceAccess(workspaceId, 'edit_ticket');
  assertUuid(callId, 'call');

  const [call] = await queryRows<{
    id: string;
    handler: 'ai' | 'agent';
    started_at: string;
    ai_summary: string | null;
    caller_name: string | null;
    caller_phone: string;
  }>(
    'SELECT id, handler, started_at, ai_summary, caller_name, caller_phone FROM public.voice_calls WHERE workspace_id = $1 AND id = $2 LIMIT 1',
    [workspaceId, callId],
  );
  if (!call) throw userError('Call not found.');

  const turns = await queryRows<{ speaker: string; transcript: string }>(
    'SELECT speaker, transcript FROM public.voice_call_turns WHERE workspace_id = $1 AND call_id = $2 ORDER BY created_at ASC',
    [workspaceId, callId],
  );

  const duration = Math.max(1, Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000));
  const nextStatus: Exclude<VoiceCallStatus, 'live'> =
    outcome ?? (call.handler === 'agent' ? 'transferred' : 'ai_resolved');
  const firstCallerLine = turns.find((t) => t.speaker === 'caller')?.transcript;
  const summary =
    call.ai_summary ||
    (firstCallerLine
      ? `${call.caller_name || call.caller_phone} called about: ${firstCallerLine.slice(0, 180)}`
      : `Call completed (${nextStatus.replace('_', ' ')}).`);

  await queryRows(
    `UPDATE public.voice_calls
     SET status = $3, duration_seconds = GREATEST(duration_seconds, $4), is_listening = false,
         ai_summary = COALESCE(ai_summary, $5), ended_at = COALESCE(ended_at, now()), updated_at = now()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, callId, nextStatus, duration, summary],
  );
}

export async function addVoiceCallTurnAction(
  workspaceId: string,
  callId: string,
  input: {
    speaker?: 'caller' | 'ai' | 'agent' | 'system';
    transcript: string;
    translatedText?: string;
  },
): Promise<VoiceCallTurnRecord> {
  const { agent } = await getWorkspaceAccess(workspaceId, 'reply');
  assertUuid(callId, 'call');

  const raw = (input.transcript || '').trim();
  if (!raw) throw userError('Enter transcript text.');

  const [call] = await queryRows<{ id: string; started_at: string }>(
    'SELECT id, started_at FROM public.voice_calls WHERE workspace_id = $1 AND id = $2 LIMIT 1',
    [workspaceId, callId],
  );
  if (!call) throw userError('Call not found.');

  const settings = await ensureVoiceSettings(workspaceId);
  const { text, redacted } = redactVoicePii(raw, settings.pii_redaction);
  const offset = Math.max(0, Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000));
  const speaker = input.speaker || 'agent';
  const speakerName = speaker === 'agent' ? agent.name || 'Agent' : speaker === 'ai' ? 'ORBAT Voice AI' : speaker === 'caller' ? 'Caller' : 'System';

  const [turn] = await queryRows<VoiceCallTurnRecord>(
    `INSERT INTO public.voice_call_turns (
       workspace_id, call_id, speaker, speaker_name, transcript, translated_text, redacted_pii, offset_seconds
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, call_id, speaker, speaker_name, transcript, translated_text, redacted_pii, offset_seconds, created_at`,
    [
      workspaceId,
      callId,
      speaker,
      speakerName,
      text,
      (input.translatedText || '').trim().slice(0, 1000) || null,
      redacted,
      offset,
    ],
  );
  if (!turn) throw userError('Could not save transcript line.');
  return turn;
}

export async function createVoiceTicketAction(
  workspaceId: string,
  callId: string,
): Promise<{ ticketId: string }> {
  await getWorkspaceAccess(workspaceId, 'edit_ticket');
  assertUuid(callId, 'call');

  const { call, turns } = await getVoiceCallDetailAction(workspaceId, callId);
  if (call.ticket_id) return { ticketId: call.ticket_id };

  const requesterName = call.caller_name || call.caller_phone;
  const fallbackEmail = `${call.caller_phone.replace(/\D/g, '') || 'caller'}@phone.orbat.local`;
  const transcriptText =
    turns.length > 0
      ? turns.map((t) => `[${t.speaker_name || t.speaker}] ${t.transcript}`).join('\n')
      : call.ai_summary || `Inbound call from ${call.caller_phone}`;

  const ticket = await createTicketAction(workspaceId, {
    requesterName,
    requesterEmail: fallbackEmail,
    subject: `Call follow-up: ${requesterName}${call.order_context ? ` (${call.order_context})` : ''}`,
    body: `${call.ai_summary ? `${call.ai_summary}\n\n` : ''}${transcriptText}`,
    channel: 'web_form',
    priority: call.sentiment === 'negative' ? 'high' : 'normal',
    type: 'question',
  });

  await queryRows(
    'UPDATE public.voice_calls SET ticket_id = $3, updated_at = now() WHERE workspace_id = $1 AND id = $2',
    [workspaceId, callId, ticket.id],
  );

  return { ticketId: ticket.id };
}

export async function updateVoiceSettingsAction(
  workspaceId: string,
  patch: {
    provider?: VoiceProvider;
    businessNumber?: string | null;
    voiceAiEnabled?: boolean;
    aiGreeting?: string | null;
    transferGroupId?: string | null;
    afterHoursMode?: VoiceAfterHoursMode;
    forwardNumber?: string | null;
    piiRedaction?: boolean;
    recordingEnabled?: boolean;
    defaultLanguage?: string;
    monthlyMinutesCap?: number;
  },
): Promise<VoiceSettingsRecord> {
  await getWorkspaceAccess(workspaceId, 'manage_settings');
  await ensureVoiceSettings(workspaceId);

  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [workspaceId];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (patch.provider !== undefined) {
    if (!['unconfigured', 'twilio', 'telnyx', 'sip', 'custom'].includes(patch.provider)) {
      throw userError('Unsupported telephony provider.');
    }
    push('provider', patch.provider);
  }
  if (patch.businessNumber !== undefined) push('business_number', (patch.businessNumber || '').trim().slice(0, 40) || null);
  if (patch.voiceAiEnabled !== undefined) push('voice_ai_enabled', Boolean(patch.voiceAiEnabled));
  if (patch.aiGreeting !== undefined) push('ai_greeting', (patch.aiGreeting || '').trim().slice(0, 500) || null);
  if (patch.transferGroupId !== undefined) {
    if (patch.transferGroupId) assertUuid(patch.transferGroupId, 'transfer team');
    push('transfer_group_id', patch.transferGroupId || null);
  }
  if (patch.afterHoursMode !== undefined) {
    if (!['voicemail_callback', 'ai_24_7', 'forward', 'closed'].includes(patch.afterHoursMode)) {
      throw userError('Unsupported after-hours mode.');
    }
    push('after_hours_mode', patch.afterHoursMode);
  }
  if (patch.forwardNumber !== undefined) push('forward_number', (patch.forwardNumber || '').trim().slice(0, 40) || null);
  if (patch.piiRedaction !== undefined) push('pii_redaction', Boolean(patch.piiRedaction));
  if (patch.recordingEnabled !== undefined) push('recording_enabled', Boolean(patch.recordingEnabled));
  if (patch.defaultLanguage !== undefined) push('default_language', (patch.defaultLanguage || 'en').trim().slice(0, 16) || 'en');
  if (patch.monthlyMinutesCap !== undefined) {
    const cap = Math.max(60, Math.min(1_000_000, Math.round(Number(patch.monthlyMinutesCap) || 3000)));
    push('monthly_minutes_cap', cap);
  }

  await queryRows(`UPDATE public.voice_settings SET ${sets.join(', ')} WHERE workspace_id = $1`, params);
  return ensureVoiceSettings(workspaceId);
}

export async function rotateVoiceWebhookSecretAction(workspaceId: string): Promise<{ secret: string }> {
  await getWorkspaceAccess(workspaceId, 'manage_settings');
  await ensureVoiceSettings(workspaceId);
  const secret = crypto.randomBytes(24).toString('hex');
  await queryRows(
    'UPDATE public.voice_settings SET webhook_secret = $2, updated_at = now() WHERE workspace_id = $1',
    [workspaceId, secret],
  );
  return { secret };
}

export async function createVoiceCampaignAction(
  workspaceId: string,
  input: {
    name: string;
    scriptPrompt?: string;
    totalContacts: number;
    scheduleLabel?: string;
    status?: VoiceCampaignStatus;
  },
): Promise<VoiceCampaignRecord> {
  const { agent } = await getWorkspaceAccess(workspaceId, 'edit_content');
  const name = (input.name || '').trim().slice(0, 120);
  if (!name) throw userError('Give the campaign a name.');
  const totalContacts = Math.max(1, Math.min(100_000, Math.round(Number(input.totalContacts) || 1)));
  const status: VoiceCampaignStatus = ['active', 'scheduled', 'paused'].includes(input.status || '')
    ? (input.status as VoiceCampaignStatus)
    : 'scheduled';

  const [campaign] = await queryRows<VoiceCampaignRecord>(
    `INSERT INTO public.voice_campaigns (
       workspace_id, name, status, script_prompt, total_contacts, schedule_label, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, workspace_id, name, status, script_prompt, total_contacts, completed_contacts,
               confirmed_count, cancelled_count, no_answer_count, schedule_label, created_at`,
    [
      workspaceId,
      name,
      status,
      (input.scriptPrompt || '').trim().slice(0, 1000) || null,
      totalContacts,
      (input.scheduleLabel || '').trim().slice(0, 80) || null,
      agent.id,
    ],
  );
  if (!campaign) throw userError('Could not create campaign.');
  return campaign;
}

export async function updateVoiceCampaignStatusAction(
  workspaceId: string,
  campaignId: string,
  status: VoiceCampaignStatus,
): Promise<void> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  assertUuid(campaignId, 'campaign');
  if (!['active', 'scheduled', 'paused', 'completed', 'cancelled'].includes(status)) {
    throw userError('Invalid campaign status.');
  }
  await queryRows(
    'UPDATE public.voice_campaigns SET status = $3, updated_at = now() WHERE workspace_id = $1 AND id = $2',
    [workspaceId, campaignId, status],
  );
}

export async function logVoiceCallAction(
  workspaceId: string,
  input: {
    callerName?: string;
    callerPhone: string;
    direction?: 'inbound' | 'outbound';
    status?: VoiceCallStatus;
    orderContext?: string;
    language?: string;
    initialTranscript?: string;
  },
): Promise<{ id: string }> {
  await getWorkspaceAccess(workspaceId, 'edit_ticket');
  const phone = (input.callerPhone || '').trim().slice(0, 40);
  if (!phone) throw userError('Enter a caller phone number.');

  const settings = await ensureVoiceSettings(workspaceId);
  const [matchedVisitor] = await queryRows<{ id: string; name: string | null }>(
    'SELECT id, name FROM public.visitors WHERE workspace_id = $1 AND phone = $2 LIMIT 1',
    [workspaceId, phone],
  );

  const direction = input.direction === 'outbound' ? 'outbound' : 'inbound';
  const status: VoiceCallStatus = input.status || 'live';
  const callerName = (input.callerName || matchedVisitor?.name || '').trim().slice(0, 120) || null;
  const endedAt = status === 'live' ? null : new Date().toISOString();

  const [call] = await queryRows<{ id: string }>(
    `INSERT INTO public.voice_calls (
       workspace_id, visitor_id, direction, status, handler, caller_name, caller_phone,
       to_number, language, recording_consent, order_context, duration_seconds, ended_at
     ) VALUES ($1, $2, $3, $4, 'ai', $5, $6, $7, $8, true, $9, $10, $11)
     RETURNING id`,
    [
      workspaceId,
      matchedVisitor?.id ?? null,
      direction,
      status,
      callerName,
      phone,
      settings.business_number,
      (input.language || settings.default_language || 'en').slice(0, 16),
      (input.orderContext || '').trim().slice(0, 120) || null,
      status === 'live' ? 0 : 45,
      endedAt,
    ],
  );
  if (!call) throw userError('Could not record call.');

  const noteText = (input.initialTranscript || '').trim();
  if (noteText) {
    const { text, redacted } = redactVoicePii(noteText, settings.pii_redaction);
    await queryRows(
      `INSERT INTO public.voice_call_turns (workspace_id, call_id, speaker, speaker_name, transcript, redacted_pii, offset_seconds)
       VALUES ($1, $2, 'caller', $3, $4, $5, 0)`,
      [workspaceId, call.id, callerName || 'Caller', text, redacted],
    );
  }

  return call;
}
