import { queryRows } from '@/lib/db';
import {
  AUTONOMY_LEVEL_DEFS,
  type AutonomyLevel,
} from '@/lib/ai/agent-templates';

export interface AutonomyPolicyRecord {
  id: string | null;
  topic: string;
  level: AutonomyLevel;
  locked: boolean;
  lockReason: string | null;
}

export type AutonomyEnforcementMode =
  | 'human_only'
  | 'shadow'
  | 'suggest'
  | 'supervised'
  | 'autonomous';

export interface AutonomyDecision {
  /** Exact topic stored onto `ai_verification_logs.topic` and matched in AI Quality. */
  topic: string;
  matchedPolicyTopic: string | null;
  level: AutonomyLevel;
  levelLabel: 'Shadow' | 'Suggest' | 'Supervised' | 'Autonomous';
  locked: boolean;
  lockReason: string | null;
  mode: AutonomyEnforcementMode;
  allowAutoSend: boolean;
  requiresHumanApproval: boolean;
  queueForSupervisorAudit: boolean;
}

const TOPIC_SIGNAL_RULES: Array<{
  topic: string;
  subAgents: Set<string>;
  pattern: RegExp;
}> = [
  {
    topic: 'Billing & refunds',
    subAgents: new Set(['refunds', 'payouts', 'pricing_offers']),
    pattern:
      /\b(?:refund|charge|charged|billing|invoice|receipt|payment|pay|payout|withdraw(?:al)?|commission|fee|fees|price|pricing|subscription|plan|upgrade|downgrade|cancel(?:lation)?|dispute|chargeback)\b/i,
  },
  {
    topic: 'Account & access',
    subAgents: new Set(['account', 'kyc', 'affiliate']),
    pattern:
      /\b(?:account|login|log in|sign in|signin|password|reset|forgot|2fa|mfa|otp|verify|verification|kyc|identity|email change|locked out|suspended|banned|permissions?|access|affiliate)\b/i,
  },
  {
    topic: 'Technical troubleshooting',
    subAgents: new Set(['platform', 'trading_tools']),
    pattern:
      /\b(?:error|bug|crash|broken|not working|doesn'?t work|failed|failing|slow|lag|timeout|connect|connection|disconnect|sync|install|setup|configure|api|webhook|mt4|mt5|ctrader|platform|troubleshoot)\b/i,
  },
];

const LEVEL_LABELS: Record<AutonomyLevel, AutonomyDecision['levelLabel']> = {
  1: 'Shadow',
  2: 'Suggest',
  3: 'Supervised',
  4: 'Autonomous',
};

function tokenizeTopic(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && w !== 'and' && w !== 'the' && w !== 'for');
}

function levelLabelFor(level: AutonomyLevel): AutonomyDecision['levelLabel'] {
  const def = AUTONOMY_LEVEL_DEFS.find((d) => d.level === level);
  return (def?.name as AutonomyDecision['levelLabel']) || LEVEL_LABELS[level] || 'Suggest';
}

function mapCanonicalTopic(input: {
  message: string;
  subAgent?: string | null;
}): string {
  const sub = (input.subAgent || '').trim().toLowerCase();
  for (const rule of TOPIC_SIGNAL_RULES) {
    if (sub && rule.subAgents.has(sub)) return rule.topic;
  }
  for (const rule of TOPIC_SIGNAL_RULES) {
    if (rule.pattern.test(input.message)) return rule.topic;
  }
  return 'General inquiries';
}

function scorePolicyMatch(
  policy: AutonomyPolicyRecord,
  input: {
    messageLower: string;
    canonicalTopicLower: string;
    citedSectionsLower: string[];
    subAgentLower: string;
  },
): number {
  const policyLower = policy.topic.trim().toLowerCase();
  if (!policyLower) return 0;

  // Exact cited help section match (e.g. a policy seeded from a Help Center collection)
  if (input.citedSectionsLower.some((s) => s === policyLower)) {
    return 10;
  }

  // Exact phrase mention in incoming message (covers admin-locked custom topics like "Legal dispute")
  if (input.messageLower.includes(policyLower)) {
    return 8;
  }

  // Canonical topic exact match
  if (policyLower === input.canonicalTopicLower) {
    return 7;
  }

  // Token overlap with incoming message, cited section names, or subAgent
  const tokens = tokenizeTopic(policy.topic);
  if (tokens.length === 0) return 0;

  let hits = 0;
  const combinedHaystack = `${input.messageLower} ${input.citedSectionsLower.join(' ')} ${input.subAgentLower}`;
  for (const token of tokens) {
    if (combinedHaystack.includes(token)) {
      hits += 2;
    }
  }
  return hits;
}

/**
 * Maps an incoming conversation turn onto the agent's Trust Ladder (`ai_autonomy_policies`)
 * using locked rules first, then Help Center section matches, custom topic matches, and
 * canonical core topics aligned with `ai-quality.ts`.
 */
export function resolveAutonomyDecision(input: {
  policies: AutonomyPolicyRecord[];
  message: string;
  subAgent?: string | null;
  citedSectionNames?: string[];
  /**
   * Fallback autonomy level when the agent has no saved policy rows yet
   * (e.g. legacy workspaces or mocked test suites without policy fixtures).
   */
  defaultLevelWhenUnconfigured?: AutonomyLevel;
}): AutonomyDecision {
  const messageLower = input.message.toLowerCase();
  const subAgentLower = (input.subAgent || '').trim().toLowerCase();
  const citedSectionsLower = (input.citedSectionNames || [])
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const canonicalTopic = mapCanonicalTopic({ message: input.message, subAgent: input.subAgent });
  const canonicalTopicLower = canonicalTopic.toLowerCase();

  let matched: AutonomyPolicyRecord | null = null;
  if (input.policies.length > 0) {
    const scored = input.policies
      .map((policy) => ({
        policy,
        score: scorePolicyMatch(policy, {
          messageLower,
          canonicalTopicLower,
          citedSectionsLower,
          subAgentLower,
        }),
      }))
      .filter((entry) => entry.score > 0)
      .sort(
        (a, b) =>
          // Locked policy wins ties at comparable relevance so guardrails cannot be bypassed.
          (b.policy.locked === a.policy.locked ? 0 : b.policy.locked && b.score >= 4 ? 1 : -1) ||
          b.score - a.score ||
          a.policy.level - b.policy.level,
      );

    matched =
      scored[0]?.policy ||
      input.policies.find((p) => p.topic.trim().toLowerCase() === 'general inquiries') ||
      null;
  }

  if (!matched) {
    const fallbackLevel: AutonomyLevel = input.defaultLevelWhenUnconfigured ?? 3;
    const mode: AutonomyEnforcementMode =
      fallbackLevel === 1
        ? 'shadow'
        : fallbackLevel === 2
          ? 'suggest'
          : fallbackLevel === 4
            ? 'autonomous'
            : 'supervised';
    return {
      topic: input.citedSectionNames?.[0]?.trim() || canonicalTopic,
      matchedPolicyTopic: null,
      level: fallbackLevel,
      levelLabel: levelLabelFor(fallbackLevel),
      locked: false,
      lockReason: null,
      mode,
      allowAutoSend: fallbackLevel >= 3,
      requiresHumanApproval: fallbackLevel <= 2,
      queueForSupervisorAudit: fallbackLevel === 3,
    };
  }

  const level = Math.min(4, Math.max(1, Number(matched.level || 2))) as AutonomyLevel;
  const locked = Boolean(matched.locked);
  const mode: AutonomyEnforcementMode = locked
    ? 'human_only'
    : level === 1
      ? 'shadow'
      : level === 2
        ? 'suggest'
        : level === 4
          ? 'autonomous'
          : 'supervised';

  return {
    topic: matched.topic,
    matchedPolicyTopic: matched.topic,
    level,
    levelLabel: levelLabelFor(level),
    locked,
    lockReason: matched.lockReason,
    mode,
    allowAutoSend: !locked && level >= 3,
    requiresHumanApproval: locked || level <= 2,
    queueForSupervisorAudit: !locked && level === 3,
  };
}

/** Loads persisted Trust Ladder policies for an AI agent (safe no-op fallback if DB unavailable). */
export async function getAutonomyPoliciesForAgent(
  workspaceId: string,
  agentId: string,
): Promise<AutonomyPolicyRecord[]> {
  const rows = await queryRows<Record<string, unknown>>(
    `SELECT id, topic, level, locked, lock_reason
     FROM public.ai_autonomy_policies
     WHERE workspace_id = $1 AND agent_id = $2`,
    [workspaceId, agentId],
  );
  return rows.map((r) => ({
    id: r.id ? String(r.id) : null,
    topic: String(r.topic || 'General inquiries'),
    level: Math.min(4, Math.max(1, Number(r.level || 2))) as AutonomyLevel,
    locked: Boolean(r.locked),
    lockReason: r.lock_reason ? String(r.lock_reason) : null,
  }));
}

/** Resolves Help Center collection/section names for cited article IDs (used to align Trust Ladder topics). */
export async function getArticleSectionNames(
  workspaceId: string,
  articleIds: string[],
): Promise<string[]> {
  const cleanIds = Array.from(new Set(articleIds.map((id) => id.trim()).filter(Boolean)));
  if (cleanIds.length === 0) return [];
  const rows = await queryRows<{ name: string | null }>(
    `SELECT DISTINCT hs.name
     FROM public.help_articles ha
     JOIN public.help_sections hs ON hs.id = ha.section_id
     WHERE ha.workspace_id = $1 AND ha.id = ANY($2::uuid[])`,
    [workspaceId, cleanIds],
  );
  return rows.map((r) => (r.name || '').trim()).filter(Boolean);
}

export interface WorkspaceTopicAutonomyResult extends AutonomyDecision {
  agentId: string | null;
  agentName: string | null;
}

/**
 * Resolves the active live agent's Trust Ladder decision for a workspace conversation
 * without pulling in RAG or LLM modules (safe for lightweight callers like Inbox Copilot).
 */
export async function resolveWorkspaceTopicAutonomy(input: {
  workspaceId: string;
  message: string;
  channel?: string | null;
  citedArticleIds?: string[];
  defaultLevelWhenUnconfigured?: AutonomyLevel;
}): Promise<WorkspaceTopicAutonomyResult | null> {
  try {
    const liveAgents = await queryRows<{
      id: string;
      name: string | null;
      is_primary: boolean | null;
      channels: unknown;
    }>(
      `SELECT id, name, is_primary, channels
       FROM public.ai_agents
       WHERE workspace_id = $1 AND status = 'live'
       ORDER BY is_primary DESC, published_at DESC NULLS LAST, created_at ASC`,
      [input.workspaceId],
    ).catch(() => []);

    if (liveAgents.length === 0) return null;

    const chan = (input.channel || '').trim().toLowerCase();
    const target =
      liveAgents.find((a) => {
        if (!chan) return Boolean(a.is_primary);
        const list = Array.isArray(a.channels)
          ? a.channels.map((c) => String(c).trim().toLowerCase())
          : [];
        return list.includes(chan);
      }) || liveAgents[0];

    const [policies, citedSectionNames] = await Promise.all([
      getAutonomyPoliciesForAgent(input.workspaceId, target.id).catch(() => []),
      input.citedArticleIds?.length
        ? getArticleSectionNames(input.workspaceId, input.citedArticleIds).catch(() => [])
        : Promise.resolve([]),
    ]);

    const decision = resolveAutonomyDecision({
      policies,
      message: input.message,
      citedSectionNames,
      defaultLevelWhenUnconfigured: input.defaultLevelWhenUnconfigured,
    });

    return {
      ...decision,
      agentId: target.id,
      agentName: target.name || null,
    };
  } catch {
    return null;
  }
}
