import type {
  HandoffStatus,
  WorkspaceHandoffSettings,
  BusinessHoursConfig,
  HandoffOfficeHoursSettings,
} from '@/types/database';

export const HANDOFF_STATES: readonly HandoffStatus[] = [
  'bot_active',
  'handoff_offered',
  'waiting_for_agent',
  'agent_active',
  'offline_queued',
  'resolved',
] as const;

export const DEFAULT_HANDOFF_KEYWORDS: readonly string[] = [
  'agent',
  'human',
  'person',
  'real person',
  'representative',
  'support team',
  'insaan',
  'banda',
  'agent se baat',
  'refund',
] as const;

export const DEFAULT_HANDOFF_SETTINGS: WorkspaceHandoffSettings = {
  routing: {
    strategy: 'round_robin',
    ring_timeout_seconds: 45,
    max_concurrent_chats_per_agent: 3,
  },
  office_hours: {
    enabled: true,
    timezone: 'UTC',
    schedule: {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '17:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' },
    },
    holidays: [],
  },
  ai: {
    confidence_threshold: 0.65,
    loop_detection_limit: 2,
    cooldown_message_count: 5,
    require_confirmation: true,
    keywords: [...DEFAULT_HANDOFF_KEYWORDS],
  },
  fallback: {
    offline_queue_enabled: true,
    offline_expected_reply_text:
      "Our team is offline. Leave your email and we'll reply as soon as we're back.",
    ai_assist_offer_enabled: true,
    unanswered_timeout_minutes: 5,
  },
};

/**
 * Normalizes partial or raw handoff_settings from JSONB into a complete, safe WorkspaceHandoffSettings object.
 */
export function normalizeHandoffSettings(raw: unknown): WorkspaceHandoffSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorkspaceHandoffSettings>;
  const base = DEFAULT_HANDOFF_SETTINGS;

  const routing = {
    strategy: src.routing?.strategy === 'broadcast' ? ('broadcast' as const) : ('round_robin' as const),
    ring_timeout_seconds:
      typeof src.routing?.ring_timeout_seconds === 'number' && src.routing.ring_timeout_seconds >= 10
        ? src.routing.ring_timeout_seconds
        : base.routing.ring_timeout_seconds,
    max_concurrent_chats_per_agent:
      typeof src.routing?.max_concurrent_chats_per_agent === 'number' && src.routing.max_concurrent_chats_per_agent >= 1
        ? src.routing.max_concurrent_chats_per_agent
        : base.routing.max_concurrent_chats_per_agent,
  };

  const schedRaw = (src.office_hours?.schedule || {}) as Partial<WorkspaceHandoffSettings['office_hours']['schedule']>;
  const schedule = {
    monday: schedRaw.monday ? { ...schedRaw.monday } : { ...base.office_hours.schedule.monday },
    tuesday: schedRaw.tuesday ? { ...schedRaw.tuesday } : { ...base.office_hours.schedule.tuesday },
    wednesday: schedRaw.wednesday ? { ...schedRaw.wednesday } : { ...base.office_hours.schedule.wednesday },
    thursday: schedRaw.thursday ? { ...schedRaw.thursday } : { ...base.office_hours.schedule.thursday },
    friday: schedRaw.friday ? { ...schedRaw.friday } : { ...base.office_hours.schedule.friday },
    saturday: schedRaw.saturday ? { ...schedRaw.saturday } : { ...base.office_hours.schedule.saturday },
    sunday: schedRaw.sunday ? { ...schedRaw.sunday } : { ...base.office_hours.schedule.sunday },
  };

  const office_hours = {
    enabled: typeof src.office_hours?.enabled === 'boolean' ? src.office_hours.enabled : base.office_hours.enabled,
    timezone: src.office_hours?.timezone || base.office_hours.timezone,
    schedule,
    holidays: Array.isArray(src.office_hours?.holidays) ? src.office_hours!.holidays : [],
  };

  const ai = {
    confidence_threshold:
      typeof src.ai?.confidence_threshold === 'number' ? src.ai.confidence_threshold : base.ai.confidence_threshold,
    loop_detection_limit:
      typeof src.ai?.loop_detection_limit === 'number' ? src.ai.loop_detection_limit : base.ai.loop_detection_limit,
    cooldown_message_count:
      typeof src.ai?.cooldown_message_count === 'number' ? src.ai.cooldown_message_count : base.ai.cooldown_message_count,
    require_confirmation:
      typeof src.ai?.require_confirmation === 'boolean' ? src.ai.require_confirmation : base.ai.require_confirmation,
    keywords: Array.isArray(src.ai?.keywords) && src.ai!.keywords.length > 0 ? src.ai!.keywords : base.ai.keywords,
  };

  const fallback = {
    offline_queue_enabled:
      typeof src.fallback?.offline_queue_enabled === 'boolean'
        ? src.fallback.offline_queue_enabled
        : base.fallback.offline_queue_enabled,
    offline_expected_reply_text:
      src.fallback?.offline_expected_reply_text || base.fallback.offline_expected_reply_text,
    ai_assist_offer_enabled:
      typeof src.fallback?.ai_assist_offer_enabled === 'boolean'
        ? src.fallback.ai_assist_offer_enabled
        : base.fallback.ai_assist_offer_enabled,
    unanswered_timeout_minutes:
      typeof src.fallback?.unanswered_timeout_minutes === 'number'
        ? src.fallback.unanswered_timeout_minutes
        : base.fallback.unanswered_timeout_minutes,
  };

  return { routing, office_hours, ai, fallback };
}

/**
 * Valid state transitions for the AI -> Human Agent handoff state machine.
 */
export const VALID_HANDOFF_TRANSITIONS: Record<HandoffStatus, readonly HandoffStatus[]> = {
  bot_active: ['handoff_offered', 'waiting_for_agent', 'offline_queued', 'resolved'],
  handoff_offered: ['waiting_for_agent', 'offline_queued', 'bot_active', 'resolved'],
  waiting_for_agent: ['agent_active', 'offline_queued', 'bot_active', 'resolved'],
  agent_active: ['bot_active', 'resolved'],
  offline_queued: ['waiting_for_agent', 'agent_active', 'bot_active', 'resolved'],
  resolved: ['bot_active', 'waiting_for_agent', 'offline_queued'],
};

/**
 * Check whether a state transition from `from` to `to` is legally allowed.
 */
export function isValidHandoffTransition(from: HandoffStatus, to: HandoffStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_HANDOFF_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Check whether AI is permitted to generate a response in the current conversation state.
 * SPEC C Golden Rule:
 * - AI answers in `bot_active` and `handoff_offered`.
 * - In `offline_queued`, AI answers ONLY if customer explicitly enabled `ai_assist = true`.
 * - In `agent_active`, `waiting_for_agent`, or `resolved`, AI is strictly silent.
 */
export function canAiRespond(
  handoffStatus: HandoffStatus = 'bot_active',
  options?: { aiEnabled?: boolean; aiAssist?: boolean }
): boolean {
  const aiEnabled = options?.aiEnabled ?? true;
  if (!aiEnabled) return false;

  switch (handoffStatus) {
    case 'bot_active':
    case 'handoff_offered':
      return true;
    case 'offline_queued':
      return Boolean(options?.aiAssist);
    case 'waiting_for_agent':
    case 'agent_active':
    case 'resolved':
    default:
      return false;
  }
}

/**
 * Fast keyword check to detect if customer asks for an agent/human.
 * Case-insensitive regex matching whole words or common Urdu phrases.
 */
export function matchHandoffKeywords(
  text: string,
  extraKeywords?: readonly string[] | null
): { matched: boolean; keyword?: string } {
  if (!text || typeof text !== 'string') return { matched: false };

  // Sort longest first so specific multi-word phrases match before substrings (e.g. "real person" before "person")
  const combined = [
    ...DEFAULT_HANDOFF_KEYWORDS,
    ...(extraKeywords ?? []).filter((k): k is string => Boolean(k && k.trim())),
  ].sort((a, b) => b.length - a.length);

  const lower = text.toLowerCase();
  for (const kw of combined) {
    const cleanKw = kw.trim().toLowerCase();
    if (!cleanKw) continue;

    // For multi-word keywords or phrases, use substring match with word boundaries if possible
    if (cleanKw.includes(' ')) {
      if (lower.includes(cleanKw)) {
        return { matched: true, keyword: cleanKw };
      }
    } else {
      // Word boundary match for single words (e.g. "agent", not "agentship" unless intended)
      const regex = new RegExp(`(^|\\b|[^\\w])${cleanKw}(\\b|[^\\w]|$)`, 'i');
      if (regex.test(lower)) {
        return { matched: true, keyword: cleanKw };
      }
    }
  }

  return { matched: false };
}

/**
 * Friendly badge / label descriptor for UI.
 */
export function getHandoffStateBadge(status: HandoffStatus): {
  label: string;
  variant: 'default' | 'warning' | 'info' | 'success' | 'muted';
} {
  switch (status) {
    case 'bot_active':
      return { label: 'AI Active', variant: 'info' };
    case 'handoff_offered':
      return { label: 'Handoff Offered', variant: 'warning' };
    case 'waiting_for_agent':
      return { label: 'Waiting for Agent', variant: 'warning' };
    case 'agent_active':
      return { label: 'Agent Active', variant: 'success' };
    case 'offline_queued':
      return { label: 'Offline Queue', variant: 'muted' };
    case 'resolved':
      return { label: 'Resolved', variant: 'default' };
    default:
      return { label: status, variant: 'default' };
  }
}

/**
 * Checks whether the specified Date falls within the workspace's configured office hours.
 * If office hours are disabled, returns true (open 24/7).
 */
export function isWithinOfficeHours(
  config: HandoffOfficeHoursSettings | BusinessHoursConfig | null | undefined,
  now: Date = new Date()
): boolean {
  if (!config || !config.enabled) return true;

  const tz = config.timezone || 'UTC';
  let dateParts: {
    year: string;
    month: string;
    day: string;
    weekday: string;
    hour: string;
    minute: string;
  };

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    dateParts = {
      year: map.year || '1970',
      month: map.month || '01',
      day: map.day || '01',
      weekday: (map.weekday || '').toLowerCase(),
      hour: map.hour || '00',
      minute: map.minute || '00',
    };
  } catch {
    return true;
  }

  // Check holidays (YYYY-MM-DD)
  const yyyyMmDd = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const holidays: string[] = (config as any).holidays || [];
  if (holidays.includes(yyyyMmDd)) {
    return false;
  }

  const dayKey = dateParts.weekday as keyof HandoffOfficeHoursSettings['schedule'];
  const daySchedule = config.schedule?.[dayKey];
  if (!daySchedule || !daySchedule.enabled) {
    return false;
  }

  const currentHhMm = `${dateParts.hour.padStart(2, '0')}:${dateParts.minute.padStart(2, '0')}`;
  const start = daySchedule.start || '00:00';
  const end = daySchedule.end || '23:59';

  return currentHhMm >= start && currentHhMm <= end;
}
