import {
  matchHandoffKeywords,
  DEFAULT_HANDOFF_KEYWORDS,
} from '@/lib/handoff/state-machine';

export type HandoffTriggerReason =
  | 'explicit_request'
  | 'low_confidence'
  | 'loop_detected'
  | 'frustration'
  | 'sensitive_topic';

export interface HandoffEvaluationInput {
  incomingMessage: string;
  turns?: { role: string; content: string }[];
  aiConfidence?: number;
  confidenceThreshold?: number;
  customKeywords?: string[];
  cooldownMessageCount?: number;
  lastHandoffOfferedAtTurn?: number;
  currentTurnIndex?: number;
}

export interface HandoffEvaluationResult {
  needsHandoff: boolean;
  isExplicit: boolean;
  triggerReason: HandoffTriggerReason | null;
  summary: string | null;
}

const FRUSTRATION_PATTERNS = [
  /\b(terrible|horrible|awful|worst|useless|stupid|idiot|incompetent|fuck|shit|crap|damn)\b/i,
  /\b(waste of time|talking to a wall|hate this|don't understand|you don't understand|stop repeating)\b/i,
  /\b(bakwas|fazool|pagal|dimag kharab|ghatiya)\b/i,
];

const SENSITIVE_PATTERNS = [
  /\b(refund|chargeback|dispute|money back|stolen|fraud|unauthorized transaction)\b/i,
  /\b(cancel subscription|cancel my account|close account|terminate)\b/i,
  /\b(lawyer|attorney|lawsuit|legal action|sue you|consumer court)\b/i,
  /\b(account banned|locked out|security breach|hacked)\b/i,
];

/**
 * Checks for customer repetitive loops in recent turns (2+ repetitions of similar query).
 */
export function detectLoop(turns?: { role: string; content: string }[], currentMsg: string = ''): boolean {
  if (!turns || turns.length < 3) return false;
  const userTurns = turns
    .filter((t) => t.role === 'user' || t.role === 'visitor')
    .map((t) => t.content.trim().toLowerCase())
    .filter(Boolean);

  if (currentMsg) {
    userTurns.push(currentMsg.trim().toLowerCase());
  }

  if (userTurns.length < 2) return false;

  const current = userTurns[userTurns.length - 1];
  let similarCount = 0;

  for (let i = 0; i < userTurns.length - 1; i++) {
    const prev = userTurns[i];
    if (prev === current) {
      similarCount++;
    } else if (prev.length > 8 && current.length > 8) {
      // Check substantial word overlap
      const prevWords = new Set(prev.split(/\s+/));
      const currentWords = current.split(/\s+/);
      const overlap = currentWords.filter((w) => prevWords.has(w)).length;
      if (overlap / Math.max(prevWords.size, currentWords.length) >= 0.7) {
        similarCount++;
      }
    }
  }

  return similarCount >= 2;
}

/**
 * Detects negative sentiment, frustration or anger in user message.
 */
export function detectFrustration(text: string): boolean {
  if (!text) return false;
  return FRUSTRATION_PATTERNS.some((pat) => pat.test(text));
}

/**
 * Detects sensitive transactional, security, or legal topics.
 */
export function detectSensitiveTopic(text: string): boolean {
  if (!text) return false;
  return SENSITIVE_PATTERNS.some((pat) => pat.test(text));
}

/**
 * Evaluates whether a customer message triggers an AI -> Human handoff offer.
 */
export function evaluateHandoffTrigger(input: HandoffEvaluationInput): HandoffEvaluationResult {
  const text = (input.incomingMessage || '').trim();
  const threshold = input.confidenceThreshold ?? 0.65;
  const cooldown = input.cooldownMessageCount ?? 5;

  // 1. Fast Keyword Match (Explicit customer request)
  const matchedKeyword = matchHandoffKeywords(text, input.customKeywords);
  if (matchedKeyword.matched && matchedKeyword.keyword) {
    return {
      needsHandoff: true,
      isExplicit: true,
      triggerReason: 'explicit_request',
      summary: `Customer explicitly asked for support: "${matchedKeyword.keyword}"`,
    };
  }

  // Check cooldown: non-explicit triggers must respect cooldown
  if (
    input.lastHandoffOfferedAtTurn !== undefined &&
    input.currentTurnIndex !== undefined &&
    input.currentTurnIndex - input.lastHandoffOfferedAtTurn < cooldown
  ) {
    return {
      needsHandoff: false,
      isExplicit: false,
      triggerReason: null,
      summary: null,
    };
  }

  // 2. Loop Detection (repeated questions without resolution)
  if (detectLoop(input.turns, text)) {
    return {
      needsHandoff: true,
      isExplicit: false,
      triggerReason: 'loop_detected',
      summary: `Customer repeating similar questions without resolution: "${text.slice(0, 100)}"`,
    };
  }

  // 3. Frustration / Anger Detection
  if (detectFrustration(text)) {
    return {
      needsHandoff: true,
      isExplicit: false,
      triggerReason: 'frustration',
      summary: `Customer expressed frustration or anger: "${text.slice(0, 100)}"`,
    };
  }

  // 4. Sensitive Topic Detection (refunds, disputes, bans, legal)
  if (detectSensitiveTopic(text)) {
    return {
      needsHandoff: true,
      isExplicit: false,
      triggerReason: 'sensitive_topic',
      summary: `Sensitive topic detected (billing/refund/legal): "${text.slice(0, 100)}"`,
    };
  }

  // 5. Low Confidence Detection
  if (input.aiConfidence !== undefined && input.aiConfidence > 0 && input.aiConfidence < threshold) {
    return {
      needsHandoff: true,
      isExplicit: false,
      triggerReason: 'low_confidence',
      summary: `AI confidence (${Math.round(input.aiConfidence * 100)}%) below threshold (${Math.round(threshold * 100)}%): "${text.slice(0, 100)}"`,
    };
  }

  return {
    needsHandoff: false,
    isExplicit: false,
    triggerReason: null,
    summary: null,
  };
}
