'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import { assertSettingNotLocked } from '@/lib/settings/precedence';
import { roleCan } from '@/lib/team/permissions';
import { userError } from '@/lib/errors/user-error';
import {
  computeOpenStatus,
  fromBusinessHoursConfig,
  getWeekDates,
  toBusinessHoursConfig,
  type HolidayItem,
  type OpenStatusSummary,
  type WeeklyDaySlot,
} from '@/lib/schedule/hours';
import type { BusinessHoursConfig } from '@/types/database';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface AfterHoursRules {
  aiHandlesEverything: boolean;
  collectEmailForNextMorning: boolean;
  wakeOnCallForUrgent: boolean;
  urgentSlaMinutes: number;
  offlineMessage: string;
}

export interface AvailabilityThresholds {
  autoAwayMinutes: number;
  heartbeatGraceSeconds: number;
  defaultMaxConcurrentChats: number;
  ringTimeoutSeconds: number;
}

export interface OnCallShiftRow {
  id: string;
  shiftDate: string;
  slot: 'day' | 'night' | 'all_day';
  agentId: string;
  agentName: string;
  agentEmail: string;
  notes: string;
}

export interface ScheduleBootstrap {
  canManage: boolean;
  enabled: boolean;
  timezone: string;
  weekly: WeeklyDaySlot[];
  holidays: HolidayItem[];
  afterHoursRules: AfterHoursRules;
  availability: AvailabilityThresholds;
  openStatus: OpenStatusSummary;
  onCallShifts: OnCallShiftRow[];
  agents: Array<{ id: string; name: string; email: string; role: string }>;
  weekDates: ReturnType<typeof getWeekDates>;
}

const DEFAULT_AFTER_HOURS: AfterHoursRules = {
  aiHandlesEverything: true,
  collectEmailForNextMorning: true,
  wakeOnCallForUrgent: true,
  urgentSlaMinutes: 15,
  offlineMessage:
    'We are currently outside office hours. Leave your email and our team will reply as soon as we open.',
};

const DEFAULT_AVAILABILITY: AvailabilityThresholds = {
  autoAwayMinutes: 15,
  heartbeatGraceSeconds: 90,
  defaultMaxConcurrentChats: 4,
  ringTimeoutSeconds: 45,
};

export async function getScheduleAction(
  workspaceId: string,
  weekOffset = 0,
): Promise<ScheduleBootstrap> {
  const access = await getWorkspaceAccess(workspaceId, 'view');
  const safeOffset = Number.isFinite(weekOffset) ? Math.max(-12, Math.min(26, Math.trunc(weekOffset))) : 0;

  const [wsRows, cfgRows, holidayRows, agentRows] = await Promise.all([
    queryRows<{
      business_hours: BusinessHoursConfig | null;
      timezone: string | null;
      handoff_settings: Record<string, unknown> | null;
    }>(
      `SELECT business_hours, timezone, handoff_settings FROM public.workspaces WHERE id = $1 LIMIT 1`,
      [workspaceId],
    ),
    queryRows<{
      after_hours_rules: Partial<AfterHoursRules> | null;
      availability_settings: Partial<AvailabilityThresholds> | null;
    }>(
      `SELECT after_hours_rules, availability_settings FROM public.workspace_schedule_configs WHERE workspace_id = $1 LIMIT 1`,
      [workspaceId],
    ),
    queryRows<HolidayItem>(
      `SELECT id, name, starts_on::text, ends_on::text, repeats_yearly
       FROM public.workspace_holidays
       WHERE workspace_id = $1
       ORDER BY starts_on ASC`,
      [workspaceId],
    ),
    queryRows<{ id: string; name: string; email: string; role: string }>(
      `SELECT id, name, email, role
       FROM public.agents
       WHERE workspace_id = $1 AND is_active = true AND role <> 'light_agent'
       ORDER BY (role = 'owner') DESC, name ASC`,
      [workspaceId],
    ),
  ]);

  const ws = wsRows[0];
  const parsedHours = fromBusinessHoursConfig(ws?.business_hours);
  const timezone = ws?.timezone?.trim() || parsedHours.timezone || 'UTC';
  const weekDates = getWeekDates(safeOffset, timezone);
  const startIso = weekDates[0]?.isoDate;
  const endIso = weekDates[weekDates.length - 1]?.isoDate;

  const onCallRows =
    startIso && endIso
      ? await queryRows<{
          id: string;
          shift_date: string;
          slot: 'day' | 'night' | 'all_day';
          agent_id: string;
          agent_name: string;
          agent_email: string;
          notes: string;
        }>(
          `SELECT oc.id, oc.shift_date::text, oc.slot, oc.agent_id,
                  a.name AS agent_name, a.email AS agent_email, oc.notes
           FROM public.workspace_on_call_shifts oc
           JOIN public.agents a ON a.id = oc.agent_id
           WHERE oc.workspace_id = $1
             AND oc.shift_date >= $2::date
             AND oc.shift_date <= $3::date
           ORDER BY oc.shift_date ASC, oc.slot ASC`,
          [workspaceId, startIso, endIso],
        )
      : [];

  type HandoffJson = {
    routing?: Record<string, unknown>;
    fallback?: Record<string, unknown>;
    ring_timeout_seconds?: number;
    [key: string]: unknown;
  };
  const hs = (ws?.handoff_settings || {}) as HandoffJson;
  const afterRaw = cfgRows[0]?.after_hours_rules || {};
  const availRaw = cfgRows[0]?.availability_settings || {};

  const afterHoursRules: AfterHoursRules = {
    aiHandlesEverything:
      typeof afterRaw.aiHandlesEverything === 'boolean'
        ? afterRaw.aiHandlesEverything
        : DEFAULT_AFTER_HOURS.aiHandlesEverything,
    collectEmailForNextMorning:
      typeof afterRaw.collectEmailForNextMorning === 'boolean'
        ? afterRaw.collectEmailForNextMorning
        : DEFAULT_AFTER_HOURS.collectEmailForNextMorning,
    wakeOnCallForUrgent:
      typeof afterRaw.wakeOnCallForUrgent === 'boolean'
        ? afterRaw.wakeOnCallForUrgent
        : DEFAULT_AFTER_HOURS.wakeOnCallForUrgent,
    urgentSlaMinutes:
      typeof afterRaw.urgentSlaMinutes === 'number' && afterRaw.urgentSlaMinutes >= 1
        ? Math.min(240, Math.round(afterRaw.urgentSlaMinutes))
        : DEFAULT_AFTER_HOURS.urgentSlaMinutes,
    offlineMessage:
      typeof afterRaw.offlineMessage === 'string' && afterRaw.offlineMessage.trim()
        ? afterRaw.offlineMessage.trim()
        : String(hs?.fallback?.offline_expected_reply_text || DEFAULT_AFTER_HOURS.offlineMessage),
  };

  const availability: AvailabilityThresholds = {
    autoAwayMinutes:
      typeof availRaw.autoAwayMinutes === 'number' && availRaw.autoAwayMinutes >= 1
        ? Math.min(120, Math.round(availRaw.autoAwayMinutes))
        : DEFAULT_AVAILABILITY.autoAwayMinutes,
    heartbeatGraceSeconds:
      typeof availRaw.heartbeatGraceSeconds === 'number' && availRaw.heartbeatGraceSeconds >= 15
        ? Math.min(600, Math.round(availRaw.heartbeatGraceSeconds))
        : DEFAULT_AVAILABILITY.heartbeatGraceSeconds,
    defaultMaxConcurrentChats:
      typeof availRaw.defaultMaxConcurrentChats === 'number' && availRaw.defaultMaxConcurrentChats >= 1
        ? Math.min(20, Math.round(availRaw.defaultMaxConcurrentChats))
        : Number(hs?.routing?.max_concurrent_chats_per_agent || DEFAULT_AVAILABILITY.defaultMaxConcurrentChats),
    ringTimeoutSeconds:
      typeof availRaw.ringTimeoutSeconds === 'number' && availRaw.ringTimeoutSeconds >= 10
        ? Math.min(300, Math.round(availRaw.ringTimeoutSeconds))
        : Number(hs?.ring_timeout_seconds || hs?.routing?.ring_timeout_seconds || DEFAULT_AVAILABILITY.ringTimeoutSeconds),
  };

  return {
    canManage: roleCan(access.role, 'manage_settings'),
    enabled: parsedHours.enabled,
    timezone,
    weekly: parsedHours.weekly,
    holidays: holidayRows,
    afterHoursRules,
    availability,
    openStatus: computeOpenStatus({
      enabled: parsedHours.enabled,
      timezone,
      weekly: parsedHours.weekly,
      holidays: holidayRows,
    }),
    onCallShifts: onCallRows.map((r) => ({
      id: r.id,
      shiftDate: r.shift_date,
      slot: r.slot,
      agentId: r.agent_id,
      agentName: r.agent_name,
      agentEmail: r.agent_email,
      notes: r.notes || '',
    })),
    agents: agentRows,
    weekDates,
  };
}

export async function saveScheduleAction(
  workspaceId: string,
  input: {
    enabled: boolean;
    timezone: string;
    weekly: WeeklyDaySlot[];
    afterHoursRules: AfterHoursRules;
    availability: AvailabilityThresholds;
  },
): Promise<{ success: true }> {
  await assertSettingNotLocked(workspaceId, 'business_hours');
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');

  const tz = (input.timezone || 'UTC').trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    throw userError(`Invalid timezone: ${tz}`);
  }

  for (const row of input.weekly || []) {
    if (row.enabled && row.close <= row.open) {
      throw userError(`${row.label}: closing time must be after opening time.`);
    }
  }

  const businessHours = toBusinessHoursConfig({
    enabled: input.enabled,
    timezone: tz,
    weekly: input.weekly,
  });

  const cleanAfterHours: AfterHoursRules = {
    aiHandlesEverything: Boolean(input.afterHoursRules?.aiHandlesEverything),
    collectEmailForNextMorning: Boolean(input.afterHoursRules?.collectEmailForNextMorning),
    wakeOnCallForUrgent: Boolean(input.afterHoursRules?.wakeOnCallForUrgent),
    urgentSlaMinutes: Math.max(1, Math.min(240, Math.round(Number(input.afterHoursRules?.urgentSlaMinutes || 15)))),
    offlineMessage: (input.afterHoursRules?.offlineMessage || DEFAULT_AFTER_HOURS.offlineMessage).trim().slice(0, 500),
  };

  const cleanAvail: AvailabilityThresholds = {
    autoAwayMinutes: Math.max(1, Math.min(120, Math.round(Number(input.availability?.autoAwayMinutes || 15)))),
    heartbeatGraceSeconds: Math.max(15, Math.min(600, Math.round(Number(input.availability?.heartbeatGraceSeconds || 90)))),
    defaultMaxConcurrentChats: Math.max(1, Math.min(20, Math.round(Number(input.availability?.defaultMaxConcurrentChats || 4)))),
    ringTimeoutSeconds: Math.max(10, Math.min(300, Math.round(Number(input.availability?.ringTimeoutSeconds || 45)))),
  };

  type HandoffJson = {
    routing?: Record<string, unknown>;
    fallback?: Record<string, unknown>;
    [key: string]: unknown;
  };
  const wsRows = await queryRows<{ handoff_settings: HandoffJson | null }>(
    `SELECT handoff_settings FROM public.workspaces WHERE id = $1 LIMIT 1`,
    [workspaceId],
  );
  const existingHandoff: HandoffJson = wsRows[0]?.handoff_settings || {};
  const mergedHandoff = {
    ...existingHandoff,
    ring_timeout_seconds: cleanAvail.ringTimeoutSeconds,
    routing: {
      ...(existingHandoff.routing || {}),
      ring_timeout_seconds: cleanAvail.ringTimeoutSeconds,
      max_concurrent_chats_per_agent: cleanAvail.defaultMaxConcurrentChats,
    },
    fallback: {
      ...(existingHandoff.fallback || {}),
      offline_queue_enabled: cleanAfterHours.collectEmailForNextMorning,
      offline_expected_reply_text: cleanAfterHours.offlineMessage,
    },
  };

  await query(
    `UPDATE public.workspaces
     SET business_hours = $1::jsonb,
         timezone = $2,
         handoff_settings = $3::jsonb,
         updated_at = now()
     WHERE id = $4`,
    [JSON.stringify(businessHours), tz, JSON.stringify(mergedHandoff), workspaceId],
  );

  await query(
    `INSERT INTO public.workspace_schedule_configs
       (workspace_id, after_hours_rules, availability_settings, updated_by)
     VALUES ($1, $2::jsonb, $3::jsonb, $4)
     ON CONFLICT (workspace_id) DO UPDATE
     SET after_hours_rules = EXCLUDED.after_hours_rules,
         availability_settings = EXCLUDED.availability_settings,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
    [workspaceId, JSON.stringify(cleanAfterHours), JSON.stringify(cleanAvail), access.user.id],
  );

  await access.supabase.rpc('fn_sla_reapply_workspace', { p_workspace_id: workspaceId });

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'schedule.updated', 'office_hours', $4::jsonb)`,
    [
      workspaceId,
      access.user.id,
      access.user.email || 'Admin',
      JSON.stringify({ enabled: input.enabled, timezone: tz }),
    ],
  ).catch(() => {});

  return { success: true };
}

export async function assignOnCallShiftAction(
  workspaceId: string,
  input: { shiftDate: string; slot?: 'day' | 'night' | 'all_day'; agentId: string | null; notes?: string },
): Promise<{ success: true }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_team');
  if (!ISO_DATE.test(input.shiftDate || '')) throw userError('Invalid shift date.');
  const slot = input.slot === 'day' || input.slot === 'night' ? input.slot : 'all_day';

  if (!input.agentId) {
    await query(
      `DELETE FROM public.workspace_on_call_shifts WHERE workspace_id = $1 AND shift_date = $2::date AND slot = $3`,
      [workspaceId, input.shiftDate, slot],
    );
    return { success: true };
  }

  if (!UUID.test(input.agentId)) throw userError('Invalid teammate id.');
  const member = await queryRows<{ name: string }>(
    `SELECT name FROM public.agents WHERE id = $1 AND workspace_id = $2 AND is_active = true LIMIT 1`,
    [input.agentId, workspaceId],
  );
  if (!member[0]) throw userError('Selected teammate was not found in this workspace.');

  await query(
    `INSERT INTO public.workspace_on_call_shifts
       (workspace_id, shift_date, slot, agent_id, notes, created_by)
     VALUES ($1, $2::date, $3, $4, $5, $6)
     ON CONFLICT (workspace_id, shift_date, slot) DO UPDATE
     SET agent_id = EXCLUDED.agent_id,
         notes = EXCLUDED.notes,
         updated_at = now()`,
    [workspaceId, input.shiftDate, slot, input.agentId, (input.notes || '').trim().slice(0, 300), access.user.id],
  );

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'schedule.on_call_assigned', $4, $5::jsonb)`,
    [
      workspaceId,
      access.user.id,
      access.user.email || 'Admin',
      input.shiftDate,
      JSON.stringify({ slot, agent_id: input.agentId, agent_name: member[0].name }),
    ],
  ).catch(() => {});

  return { success: true };
}
