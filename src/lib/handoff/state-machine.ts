import type { HandoffStatus } from '@/types/database';

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
