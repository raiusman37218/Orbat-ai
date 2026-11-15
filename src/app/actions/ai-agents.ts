'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import { assertSettingNotLocked } from '@/lib/settings/precedence';
import { userError, errorMessage } from '@/lib/errors/user-error';
import {
  DEFAULT_AGENT_APPEARANCE,
  DEFAULT_AGENT_ENGINE_CONFIG,
  DEFAULT_AGENT_MODEL_CONFIG,
  DEFAULT_AGENT_ROUTING_RULES,
  DEFAULT_ESCALATION_RULES,
  DEFAULT_KNOWLEDGE_SCOPE,
  DEFAULT_AGENT_RAG_CONFIG,
  getAgentTemplate,
  isRestrictedKnowledgeScope,
  normalizeAgentRagConfig,
  normalizeEngineType,
  normalizeKnowledgeScope,
  slugifyAgentName,
  type AgentAnswerMode,
  type AgentAppearance,
  type AgentCapabilities,
  type AgentEngineConfig,
  type AgentEngineType,
  type AgentEscalationRules,
  type AgentKnowledgeScope,
  type AgentModelConfig,
  type AgentRagConfig,
  type AgentRagMode,
  type RagTrace,
  type AgentReplyLanguageMode,
  type AgentRoutingRules,
  type AgentStatus,
} from '@/lib/ai/agent-templates';
import {
  ensurePrimaryAiAgent,
  normalizeAgentRow,
  recordAiVerificationLog,
  syncPrimaryAgentToWorkspaceAiSettings,
  tryWorkspaceChat,
  verifyReplyClaimsAgainstKnowledge,
  type AiAgentRow,
  type VerificationClaim,
} from '@/lib/ai/agent-runtime';
import { buildSupportAgentPrompt } from '@/lib/ai/support-agent';
import { buildModelContext, loadFullKnowledge } from '@/lib/ai/help-answer';
import {
  getArticleSectionNames,
  getAutonomyPoliciesForAgent,
  resolveAutonomyDecision,
} from '@/lib/ai/trust-ladder';
import { detectLanguage, getLanguageInfo, isRomanizedText, translateAgentReply } from '@/lib/ai/translator';

export interface AiAgentListItem extends AiAgentRow {
  replies30d: number;
  handovers30d: number;
  resolutionRate30d: number | null;
}

export interface WeeklyTrendPoint {
  weekLabel: string;
  weekStart: string;
  resolvedCount: number;
  escalatedCount: number;
  totalCount: number;
  resolvedPct: number;
  escalatedPct: number;
}

export interface EscalationBreakdownItem {
  reason: string;
  count: number;
  pct: number;
}

export interface KnowledgeGapSummary {
  id: string;
  question: string;
  timesAsked: number;
  reason: string | null;
  status: string;
  lastAskedAt: string;
}

export interface VerificationReviewItem {
  id: string;
  agentId: string | null;
  agentName: string;
  conversationId: string | null;
  channel: string;
  topic: string | null;
  customerQuestion: string;
  draftReply: string;
  finalReply: string | null;
  verdict: 'supported' | 'blocked_fixed' | 'blocked_human' | 'needs_review';
  humanReview: 'correct' | 'wrong' | null;
  reviewedAt: string | null;
  claims: VerificationClaim[];
  outcomeNote: string | null;
  confidence: number | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface ActivityLogItem {
  id: string;
  event: string;
  reason: string | null;
  conversationId: string;
  createdAt: string;
  agentName: string;
  channel: string;
  detail: Record<string, unknown>;
}

export interface AiAgentsBootstrap {
  canManage: boolean;
  canEditContent: boolean;
  agents: AiAgentListItem[];
  kpis: {
    allReplies30d: number;
    resolvedPct: number | null;
    medianReplySeconds: number | null;
    escalationRatePct: number | null;
    reviewedAccuracyPct: number | null;
    openUnansweredCount: number;
    activeAgentsCount: number;
  };
  weeklyTrend: WeeklyTrendPoint[];
  unansweredTop: KnowledgeGapSummary[];
  escalationBreakdown: EscalationBreakdownItem[];
  reviewQueue: VerificationReviewItem[];
  activityLogs: ActivityLogItem[];
  evalKpis: {
    totalChecked30d: number;
    supportedPct: number | null;
    blockedFixedCount: number;
    blockedHumanCount: number;
    needsReviewCount: number;
  };
}

export async function getAiAgentsBootstrapAction(workspaceId: string): Promise<AiAgentsBootstrap> {
  const { role } = await getWorkspaceAccess(workspaceId, 'view');
  const canManage = role === 'owner' || role === 'admin';
  const canEditContent = role === 'owner' || role === 'admin' || role === 'agent';

  await ensurePrimaryAiAgent(workspaceId);

  const [
    rawAgents,
    eventCounts,
    weeklyRows,
    unansweredRows,
    reasonRows,
    reviewRows,
    activityRows,
    medianRow,
  ] = await Promise.all([
    queryRows<Record<string, unknown>>(
      `SELECT * FROM public.ai_agents
       WHERE workspace_id = $1
       ORDER BY is_primary DESC, updated_at DESC`,
      [workspaceId],
    ),
    queryRows<{
      agent_id: string | null;
      replied_cnt: string;
      handover_cnt: string;
    }>(
      `SELECT
         detail->>'agent_id' AS agent_id,
         COUNT(*) FILTER (WHERE event IN ('reply_delivered', 'replied'))::text AS replied_cnt,
         COUNT(*) FILTER (WHERE event IN ('handover','handoff_requested','blocked_human'))::text AS handover_cnt
       FROM public.ai_reply_events
       WHERE workspace_id = $1 AND created_at >= now() - interval '30 days'
       GROUP BY detail->>'agent_id'`,
      [workspaceId],
    ),
    queryRows<{
      wk_start: string;
      resolved_cnt: string;
      escalated_cnt: string;
    }>(
      `WITH weeks AS (
         SELECT generate_series(
           date_trunc('week', now() - interval '9 weeks'),
           date_trunc('week', now()),
           interval '1 week'
         )::date AS wk_start
       ),
       ev AS (
         SELECT
           date_trunc('week', created_at)::date AS wk,
           COUNT(*) FILTER (WHERE event IN ('reply_delivered', 'replied')) AS resolved_cnt,
           COUNT(*) FILTER (WHERE event IN ('handover','handoff_requested','blocked_human','quota_exceeded')) AS escalated_cnt
         FROM public.ai_reply_events
         WHERE workspace_id = $1 AND created_at >= date_trunc('week', now() - interval '9 weeks')
         GROUP BY 1
       )
       SELECT
         weeks.wk_start::text AS wk_start,
         COALESCE(ev.resolved_cnt, 0)::text AS resolved_cnt,
         COALESCE(ev.escalated_cnt, 0)::text AS escalated_cnt
       FROM weeks
       LEFT JOIN ev ON ev.wk = weeks.wk_start
       ORDER BY weeks.wk_start ASC`,
      [workspaceId],
    ),
    queryRows<{
      id: string;
      question: string;
      times_asked: number;
      reason: string | null;
      status: string;
      last_asked_at: string;
    }>(
      `SELECT id, question, times_asked, reason, status, last_asked_at::text
       FROM public.unanswered_questions
       WHERE workspace_id = $1 AND status IN ('open','pending_approval')
       ORDER BY times_asked DESC, last_asked_at DESC
       LIMIT 10`,
      [workspaceId],
    ),
    queryRows<{ reason: string | null; cnt: string }>(
      `SELECT COALESCE(NULLIF(trim(reason), ''), event) AS reason, COUNT(*)::text AS cnt
       FROM public.ai_reply_events
       WHERE workspace_id = $1
         AND created_at >= now() - interval '30 days'
         AND event IN ('handover','handoff_requested','blocked_human','quota_exceeded')
       GROUP BY 1
       ORDER BY COUNT(*) DESC
       LIMIT 6`,
      [workspaceId],
    ),
    queryRows<Record<string, unknown>>(
      `SELECT v.*, COALESCE(a.name, v.agent_name, 'AI Assistant') AS resolved_agent_name
       FROM public.ai_verification_logs v
       LEFT JOIN public.ai_agents a ON a.id = v.agent_id
       WHERE v.workspace_id = $1
       ORDER BY (v.human_review IS NULL) DESC, v.created_at DESC
       LIMIT 40`,
      [workspaceId],
    ),
    queryRows<Record<string, unknown>>(
      `SELECT e.id, e.event, e.reason, e.conversation_id, e.detail, e.created_at::text,
              COALESCE(c.channel, 'web') AS conv_channel,
              COALESCE(e.detail->>'agent_name', 'AI Assistant') AS agent_name
       FROM public.ai_reply_events e
       LEFT JOIN public.conversations c ON c.id = e.conversation_id
       WHERE e.workspace_id = $1
       ORDER BY e.created_at DESC
       LIMIT 50`,
      [workspaceId],
    ),
    queryRows<{ median_sec: string | null }>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms / 1000.0)::text AS median_sec
       FROM public.ai_verification_logs
       WHERE workspace_id = $1
         AND latency_ms IS NOT NULL
         AND COALESCE(channel, '') <> 'playground'
         AND COALESCE((metadata->>'playground')::boolean, false) = false
         AND created_at >= now() - interval '30 days'`,
      [workspaceId],
    ),
  ]);

  const parsedAgents = rawAgents.map(normalizeAgentRow);
  const perAgentStats = new Map<string, { replies: number; handovers: number }>();
  let totalReplies = 0;
  let totalHandovers = 0;

  for (const row of eventCounts) {
    const rep = Number(row.replied_cnt || 0);
    const ho = Number(row.handover_cnt || 0);
    totalReplies += rep;
    totalHandovers += ho;
    const key = row.agent_id || '__primary__';
    const cur = perAgentStats.get(key) ?? { replies: 0, handovers: 0 };
    cur.replies += rep;
    cur.handovers += ho;
    perAgentStats.set(key, cur);
  }

  const agents: AiAgentListItem[] = parsedAgents.map((agent) => {
    const specific = perAgentStats.get(agent.id);
    const primaryFallback = agent.is_primary ? perAgentStats.get('__primary__') : undefined;
    const replies30d = (specific?.replies ?? 0) + (primaryFallback?.replies ?? 0);
    const handovers30d = (specific?.handovers ?? 0) + (primaryFallback?.handovers ?? 0);
    const total = replies30d + handovers30d;
    const resolutionRate30d = total > 0 ? Math.round((replies30d / total) * 100) : null;
    return {
      ...agent,
      replies30d,
      handovers30d,
      resolutionRate30d,
    };
  });

  const weeklyTrend: WeeklyTrendPoint[] = weeklyRows.map((w) => {
    const resolved = Number(w.resolved_cnt || 0);
    const escalated = Number(w.escalated_cnt || 0);
    const total = resolved + escalated;
    const d = new Date(`${w.wk_start}T00:00:00Z`);
    const weekLabel = Number.isNaN(d.getTime())
      ? w.wk_start
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    return {
      weekLabel,
      weekStart: w.wk_start,
      resolvedCount: resolved,
      escalatedCount: escalated,
      totalCount: total,
      resolvedPct: total > 0 ? Math.round((resolved / total) * 100) : 0,
      escalatedPct: total > 0 ? Math.round((escalated / total) * 100) : 0,
    };
  });

  const totalEscalationReasons = reasonRows.reduce((acc, r) => acc + Number(r.cnt || 0), 0);
  const escalationBreakdown: EscalationBreakdownItem[] = reasonRows.map((r) => {
    const count = Number(r.cnt || 0);
    return {
      reason: String(r.reason || 'Unspecified escalation'),
      count,
      pct: totalEscalationReasons > 0 ? Math.round((count / totalEscalationReasons) * 100) : 0,
    };
  });

  const reviewQueue: VerificationReviewItem[] = reviewRows.map((r) => ({
    id: String(r.id),
    agentId: r.agent_id ? String(r.agent_id) : null,
    agentName: String(r.resolved_agent_name || 'AI Assistant'),
    conversationId: r.conversation_id ? String(r.conversation_id) : null,
    channel: String(r.channel || 'web'),
    topic: r.topic ? String(r.topic) : null,
    customerQuestion: String(r.customer_question || ''),
    draftReply: String(r.draft_reply || ''),
    finalReply: r.final_reply ? String(r.final_reply) : null,
    verdict: (['supported', 'blocked_fixed', 'blocked_human', 'needs_review'].includes(String(r.verdict))
      ? String(r.verdict)
      : 'supported') as VerificationReviewItem['verdict'],
    humanReview:
      r.human_review === 'correct' || r.human_review === 'wrong'
        ? (r.human_review as 'correct' | 'wrong')
        : null,
    reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
    claims: Array.isArray(r.claims) ? (r.claims as VerificationClaim[]) : [],
    outcomeNote: r.outcome_note ? String(r.outcome_note) : null,
    confidence: r.confidence !== null && r.confidence !== undefined ? Number(r.confidence) : null,
    latencyMs: r.latency_ms !== null && r.latency_ms !== undefined ? Number(r.latency_ms) : null,
    createdAt: String(r.created_at),
  }));

  const reviewedItems = reviewQueue.filter((r) => r.humanReview !== null);
  const correctCount = reviewedItems.filter((r) => r.humanReview === 'correct').length;
  const reviewedAccuracyPct =
    reviewedItems.length > 0 ? Math.round((correctCount / reviewedItems.length) * 100) : null;

  const totalActivity = totalReplies + totalHandovers;
  const resolvedPct = totalActivity > 0 ? Math.round((totalReplies / totalActivity) * 100) : null;
  const escalationRatePct = totalActivity > 0 ? Math.round((totalHandovers / totalActivity) * 100) : null;
  const medianRaw = medianRow[0]?.median_sec ? Number(medianRow[0].median_sec) : null;

  const totalChecked30d = reviewQueue.length;
  const supportedCount = reviewQueue.filter((r) => r.verdict === 'supported').length;

  return {
    canManage,
    canEditContent,
    agents,
    kpis: {
      allReplies30d: totalReplies,
      resolvedPct,
      medianReplySeconds: medianRaw !== null && Number.isFinite(medianRaw) ? Math.round(medianRaw * 10) / 10 : null,
      escalationRatePct,
      reviewedAccuracyPct,
      openUnansweredCount: unansweredRows.length,
      activeAgentsCount: agents.filter((a) => a.status === 'live').length,
    },
    weeklyTrend,
    unansweredTop: unansweredRows.map((u) => ({
      id: u.id,
      question: u.question,
      timesAsked: Number(u.times_asked || 1),
      reason: u.reason,
      status: u.status,
      lastAskedAt: u.last_asked_at,
    })),
    escalationBreakdown,
    reviewQueue,
    activityLogs: activityRows.map((a) => ({
      id: String(a.id),
      event: String(a.event || 'reply_delivered'),
      reason: a.reason ? String(a.reason) : null,
      conversationId: String(a.conversation_id),
      createdAt: String(a.created_at),
      agentName: String(a.agent_name || 'AI Assistant'),
      channel: String(a.conv_channel || 'web'),
      detail: a.detail && typeof a.detail === 'object' ? (a.detail as Record<string, unknown>) : {},
    })),
    evalKpis: {
      totalChecked30d,
      supportedPct: totalChecked30d > 0 ? Math.round((supportedCount / totalChecked30d) * 1000) / 10 : null,
      blockedFixedCount: reviewQueue.filter((r) => r.verdict === 'blocked_fixed').length,
      blockedHumanCount: reviewQueue.filter((r) => r.verdict === 'blocked_human').length,
      needsReviewCount: reviewQueue.filter((r) => r.verdict === 'needs_review').length,
    },
  };
}

export async function toggleAiAgentStatusAction(
  workspaceId: string,
  agentId: string,
  status: AgentStatus,
): Promise<{ success: true; agent: AiAgentRow } | { success: false; error: string }> {
  try {
    await assertSettingNotLocked(workspaceId, 'ai_settings');
    const { user } = await getWorkspaceAccess(workspaceId, 'manage_settings');

    const rows = await queryRows<Record<string, unknown>>(
      `UPDATE public.ai_agents
       SET status = $3,
           published_at = CASE WHEN $3 = 'live' AND published_at IS NULL THEN now() ELSE published_at END,
           updated_by = $4,
           updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [agentId, workspaceId, status, user.id],
    );
    if (!rows[0]) return { success: false, error: 'AI agent not found.' };
    const agent = normalizeAgentRow(rows[0]);
    await syncPrimaryAgentToWorkspaceAiSettings(workspaceId, agent);
    return { success: true, agent };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not update AI agent status.') };
  }
}

export interface AgentVersionItem {
  id: string;
  versionNumber: number;
  status: 'draft' | 'published';
  summary: string;
  createdByName: string | null;
  createdAt: string;
}

export interface AgentBuilderBundle {
  canManage: boolean;
  isNew: boolean;
  agent: AiAgentRow;
  allAgents: { id: string; name: string; status: AgentStatus; isPrimary: boolean }[];
  versions: AgentVersionItem[];
  sections: { id: string; name: string; articleCount: number }[];
  botKnowledgeCount: number;
  teamGroups: { id: string; name: string }[];
  workspaceName: string;
}

export async function getAgentBuilderAction(
  workspaceId: string,
  agentIdOrNew: string,
  templateId?: string | null,
): Promise<AgentBuilderBundle> {
  const { role } = await getWorkspaceAccess(workspaceId, 'view');
  const canManage = role === 'owner' || role === 'admin';

  await ensurePrimaryAiAgent(workspaceId);

  const [allAgentRows, sectionRows, bkCountRows, groupRows, wsRows] = await Promise.all([
    queryRows<Record<string, unknown>>(
      `SELECT * FROM public.ai_agents WHERE workspace_id = $1 ORDER BY is_primary DESC, updated_at DESC`,
      [workspaceId],
    ),
    queryRows<{ id: string; name: string; cnt: string }>(
      `SELECT s.id, s.name, COUNT(a.id) FILTER (WHERE a.status = 'published')::text AS cnt
       FROM public.help_sections s
       LEFT JOIN public.articles a ON a.section_id = s.id AND a.workspace_id = s.workspace_id
       WHERE s.workspace_id = $1
       GROUP BY s.id, s.name
       ORDER BY s.order_index ASC, s.name ASC`,
      [workspaceId],
    ),
    queryRows<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM public.bot_knowledge WHERE workspace_id = $1`,
      [workspaceId],
    ),
    queryRows<{ id: string; name: string }>(
      `SELECT id, name FROM public.ticket_groups WHERE workspace_id = $1 ORDER BY name ASC`,
      [workspaceId],
    ).catch(() => []),
    queryRows<{ name: string; industry: string | null }>(
      `SELECT name, industry FROM public.workspaces WHERE id = $1 LIMIT 1`,
      [workspaceId],
    ),
  ]);

  const allAgents = allAgentRows.map(normalizeAgentRow);
  const wsName = wsRows[0]?.name || 'Workspace';
  const isNew = agentIdOrNew === 'new';

  let agent: AiAgentRow | undefined;
  if (!isNew) {
    agent = allAgents.find((a) => a.id === agentIdOrNew || a.slug === agentIdOrNew);
  }

  if (!agent && isNew) {
    const tpl = getAgentTemplate(templateId);
    agent = {
      id: 'new',
      workspace_id: workspaceId,
      slug: tpl ? slugifyAgentName(tpl.name) : 'new-agent',
      name: tpl ? tpl.name : '',
      role_title: tpl ? tpl.roleTitle : 'Customer support specialist',
      description: tpl ? tpl.tagline : '',
      avatar_color: '#6D3FD6',
      template_id: tpl?.id ?? null,
      industry: tpl?.industry ?? wsRows[0]?.industry ?? null,
      status: 'draft',
      is_primary: allAgents.length === 0,
      channels: tpl ? tpl.channels : ['web', 'email'],
      tone: tpl ? tpl.tone : 'Clear, warm, concise',
      reply_language_mode: 'match_customer',
      answer_mode: 'agent',
      system_prompt: tpl ? tpl.systemPrompt : '',
      guardrails: tpl ? tpl.guardrails : [],
      escalation_rules: { ...DEFAULT_ESCALATION_RULES },
      knowledge_scope: { ...DEFAULT_KNOWLEDGE_SCOPE },
      capabilities: {
        actions: tpl ? tpl.actions.map((x) => x.title) : [],
        frameworks: tpl ? tpl.frameworks : [],
        subAgentId: null,
      },
      appearance: { ...DEFAULT_AGENT_APPEARANCE },
      engine_type: 'builtin',
      engine_config: { ...DEFAULT_AGENT_ENGINE_CONFIG },
      rag_config: { ...DEFAULT_AGENT_RAG_CONFIG },
      model_config: { ...DEFAULT_AGENT_MODEL_CONFIG },
      routing_rules: { ...DEFAULT_AGENT_ROUTING_RULES },
      published_version: 0,
      draft_version: 1,
      published_at: null,
      created_by: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  if (!agent) {
    agent = allAgents[0];
  }
  if (!agent) {
    throw userError('AI agent not found in this workspace.');
  }

  const versionRows =
    agent.id !== 'new'
      ? await queryRows<{
          id: string;
          version_number: number;
          status: 'draft' | 'published';
          summary: string;
          created_by_name: string | null;
          created_at: string;
        }>(
          `SELECT id, version_number, status, summary, created_by_name, created_at::text
           FROM public.ai_agent_versions
           WHERE workspace_id = $1 AND agent_id = $2
           ORDER BY version_number DESC
           LIMIT 25`,
          [workspaceId, agent.id],
        )
      : [];

  return {
    canManage,
    isNew,
    agent,
    allAgents: allAgents.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      isPrimary: a.is_primary,
    })),
    versions: versionRows.map((v) => ({
      id: v.id,
      versionNumber: Number(v.version_number),
      status: v.status,
      summary: v.summary,
      createdByName: v.created_by_name,
      createdAt: v.created_at,
    })),
    sections: sectionRows.map((s) => ({
      id: s.id,
      name: s.name,
      articleCount: Number(s.cnt || 0),
    })),
    botKnowledgeCount: Number(bkCountRows[0]?.cnt || 0),
    teamGroups: groupRows,
    workspaceName: wsName,
  };
}

export interface SaveAgentDraftInput {
  id?: string | null;
  name: string;
  roleTitle: string;
  description: string;
  templateId?: string | null;
  industry?: string | null;
  channels: string[];
  tone: string;
  replyLanguageMode: AgentReplyLanguageMode;
  answerMode: AgentAnswerMode;
  systemPrompt: string;
  guardrails: string[];
  escalationRules: AgentEscalationRules;
  knowledgeScope: AgentKnowledgeScope;
  capabilities: AgentCapabilities;
  appearance: AgentAppearance;
  engineType?: AgentEngineType;
  engineConfig?: AgentEngineConfig;
  ragConfig?: Partial<AgentRagConfig>;
  modelConfig?: AgentModelConfig;
  routingRules?: AgentRoutingRules;
  isPrimary?: boolean;
  publishNow?: boolean;
  versionSummary?: string;
}

export async function saveAgentDraftAction(
  workspaceId: string,
  input: SaveAgentDraftInput,
): Promise<{ success: true; agent: AiAgentRow } | { success: false; error: string }> {
  try {
    await assertSettingNotLocked(workspaceId, 'ai_settings');
    const { user, agent: currentMember } = await getWorkspaceAccess(workspaceId, 'manage_settings');

    const cleanName = (input.name || '').trim();
    if (!cleanName) return { success: false, error: 'Give this AI agent a name.' };
    if (cleanName.length > 80) return { success: false, error: 'Agent name cannot exceed 80 characters.' };

    const cleanChannels = (input.channels || []).filter(Boolean);
    const guardrails = (input.guardrails || []).map((g) => g.trim()).filter(Boolean).slice(0, 20);
    const normalizedScope = normalizeKnowledgeScope(input.knowledgeScope || DEFAULT_KNOWLEDGE_SCOPE);
    const isUpdate = Boolean(input.id && input.id !== 'new');
    const publishNow = Boolean(input.publishNow);

    let savedRow: Record<string, unknown> | undefined;

    if (isUpdate) {
      const existing = await queryRows<Record<string, unknown>>(
        `SELECT * FROM public.ai_agents WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
        [input.id, workspaceId],
      );
      if (!existing[0]) return { success: false, error: 'Agent not found.' };

      const prevRow = existing[0];
      const prevDraftVer = Number(prevRow.draft_version ?? 1);
      const prevPubVer = Number(prevRow.published_version ?? 0);
      const nextDraftVer = prevDraftVer + 1;
      const nextPubVer = publishNow ? Math.max(prevPubVer + 1, nextDraftVer) : prevPubVer;

      const nextEngineType = normalizeEngineType(input.engineType ?? prevRow.engine_type);
      const nextEngineConfig = input.engineConfig ?? prevRow.engine_config ?? DEFAULT_AGENT_ENGINE_CONFIG;
      const nextRagConfig = normalizeAgentRagConfig(
        input.ragConfig ?? (prevRow.rag_config as Partial<AgentRagConfig> | undefined),
      );
      const nextModelConfig = input.modelConfig ?? prevRow.model_config ?? DEFAULT_AGENT_MODEL_CONFIG;
      const nextRoutingRules = input.routingRules ?? prevRow.routing_rules ?? DEFAULT_AGENT_ROUTING_RULES;

      const updated = await queryRows<Record<string, unknown>>(
        `UPDATE public.ai_agents
         SET name = $3,
             role_title = $4,
             description = $5,
             industry = $6,
             status = CASE WHEN $16 THEN 'live' ELSE status END,
             channels = $7,
             tone = $8,
             reply_language_mode = $9,
             answer_mode = $10,
             system_prompt = $11,
             guardrails = $12,
             escalation_rules = $13::jsonb,
             knowledge_scope = $14::jsonb,
             capabilities = $15::jsonb,
             appearance = $17::jsonb,
             draft_version = $18,
             published_version = $19,
             published_at = CASE WHEN $16 THEN now() ELSE published_at END,
             updated_by = $20,
             engine_type = $21,
             engine_config = $22::jsonb,
             rag_config = $23::jsonb,
             model_config = $24::jsonb,
             routing_rules = $25::jsonb,
             updated_at = now()
         WHERE id = $1 AND workspace_id = $2
         RETURNING *`,
        [
          input.id,
          workspaceId,
          cleanName,
          (input.roleTitle || 'Support specialist').trim().slice(0, 120),
          (input.description || '').trim().slice(0, 500),
          input.industry ?? null,
          cleanChannels.length ? cleanChannels : ['web'],
          (input.tone || 'Clear, warm, concise').trim().slice(0, 120),
          input.replyLanguageMode,
          input.answerMode,
          (input.systemPrompt || '').trim().slice(0, 8000),
          guardrails,
          JSON.stringify(input.escalationRules || DEFAULT_ESCALATION_RULES),
          JSON.stringify(normalizedScope),
          JSON.stringify(input.capabilities || { actions: [], frameworks: [], subAgentId: null }),
          publishNow,
          JSON.stringify(input.appearance || DEFAULT_AGENT_APPEARANCE),
          nextDraftVer,
          nextPubVer,
          user.id,
          nextEngineType,
          JSON.stringify(nextEngineConfig),
          JSON.stringify(nextRagConfig),
          JSON.stringify(nextModelConfig),
          JSON.stringify(nextRoutingRules),
        ],
      );
      savedRow = updated[0];
    } else {
      const baseSlug = slugifyAgentName(cleanName);
      const existingSlugs = await queryRows<{ slug: string }>(
        `SELECT slug FROM public.ai_agents WHERE workspace_id = $1`,
        [workspaceId],
      );
      const taken = new Set(existingSlugs.map((s) => s.slug.toLowerCase()));
      let slug = baseSlug;
      let suffix = 2;
      while (taken.has(slug)) {
        slug = `${baseSlug}-${suffix++}`;
      }

      const nextEngineType = normalizeEngineType(input.engineType);
      const nextEngineConfig = input.engineConfig ?? DEFAULT_AGENT_ENGINE_CONFIG;
      const nextRagConfig = normalizeAgentRagConfig(input.ragConfig);
      const nextModelConfig = input.modelConfig ?? DEFAULT_AGENT_MODEL_CONFIG;
      const nextRoutingRules = input.routingRules ?? DEFAULT_AGENT_ROUTING_RULES;

      const inserted = await queryRows<Record<string, unknown>>(
        `INSERT INTO public.ai_agents (
           workspace_id, slug, name, role_title, description, template_id, industry,
           status, is_primary, channels, tone, reply_language_mode, answer_mode,
           system_prompt, guardrails, escalation_rules, knowledge_scope, capabilities,
           appearance, published_version, draft_version, published_at, created_by, updated_by,
           engine_type, engine_config, rag_config, model_config, routing_rules
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20,1,$21,$22,$22,$23,$24::jsonb,$25::jsonb,$26::jsonb,$27::jsonb)
         RETURNING *`,
        [
          workspaceId,
          slug,
          cleanName,
          (input.roleTitle || 'Support specialist').trim().slice(0, 120),
          (input.description || '').trim().slice(0, 500),
          input.templateId ?? null,
          input.industry ?? null,
          publishNow ? 'live' : 'draft',
          Boolean(input.isPrimary),
          cleanChannels.length ? cleanChannels : ['web'],
          (input.tone || 'Clear, warm, concise').trim().slice(0, 120),
          input.replyLanguageMode,
          input.answerMode,
          (input.systemPrompt || '').trim().slice(0, 8000),
          guardrails,
          JSON.stringify(input.escalationRules || DEFAULT_ESCALATION_RULES),
          JSON.stringify(normalizedScope),
          JSON.stringify(input.capabilities || { actions: [], frameworks: [], subAgentId: null }),
          JSON.stringify(input.appearance || DEFAULT_AGENT_APPEARANCE),
          publishNow ? 1 : 0,
          publishNow ? new Date().toISOString() : null,
          user.id,
          nextEngineType,
          JSON.stringify(nextEngineConfig),
          JSON.stringify(nextRagConfig),
          JSON.stringify(nextModelConfig),
          JSON.stringify(nextRoutingRules),
        ],
      );
      savedRow = inserted[0];
    }

    if (!savedRow) return { success: false, error: 'Could not save AI agent.' };
    const agent = normalizeAgentRow(savedRow);

    if (publishNow || !isUpdate || Boolean(input.versionSummary?.trim())) {
      const versionNum = publishNow ? agent.published_version : agent.draft_version;
      await query(
        `INSERT INTO public.ai_agent_versions (
           workspace_id, agent_id, version_number, status, summary, snapshot, created_by, created_by_name
         )
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
         ON CONFLICT (agent_id, version_number) DO UPDATE
         SET status = EXCLUDED.status,
             summary = EXCLUDED.summary,
             snapshot = EXCLUDED.snapshot`,
        [
          workspaceId,
          agent.id,
          Math.max(1, versionNum),
          publishNow ? 'published' : 'draft',
          (input.versionSummary || (publishNow ? 'Published changes' : 'Saved draft')).trim(),
          JSON.stringify(agent),
          user.id,
          currentMember?.name || null,
        ],
      );
    }

    await syncPrimaryAgentToWorkspaceAiSettings(workspaceId, agent);
    return { success: true, agent };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not save AI agent.') };
  }
}

export async function restoreAgentVersionAction(
  workspaceId: string,
  agentId: string,
  versionId: string,
): Promise<{ success: true; agent: AiAgentRow } | { success: false; error: string }> {
  try {
    await assertSettingNotLocked(workspaceId, 'ai_settings');
    const { user, agent: currentMember } = await getWorkspaceAccess(workspaceId, 'manage_settings');

    const vRows = await queryRows<{ version_number: number; snapshot: Record<string, unknown> }>(
      `SELECT version_number, snapshot
       FROM public.ai_agent_versions
       WHERE id = $1 AND agent_id = $2 AND workspace_id = $3
       LIMIT 1`,
      [versionId, agentId, workspaceId],
    );
    const ver = vRows[0];
    if (!ver) return { success: false, error: 'Version not found.' };

    const snap = normalizeAgentRow({ ...ver.snapshot, id: agentId, workspace_id: workspaceId });
    const nextRes = await saveAgentDraftAction(workspaceId, {
      id: agentId,
      name: snap.name,
      roleTitle: snap.role_title,
      description: snap.description,
      templateId: snap.template_id,
      industry: snap.industry,
      channels: snap.channels,
      tone: snap.tone,
      replyLanguageMode: snap.reply_language_mode,
      answerMode: snap.answer_mode,
      systemPrompt: snap.system_prompt,
      guardrails: snap.guardrails,
      escalationRules: snap.escalation_rules,
      knowledgeScope: snap.knowledge_scope,
      capabilities: snap.capabilities,
      appearance: snap.appearance,
      engineType: snap.engine_type,
      engineConfig: snap.engine_config,
      ragConfig: snap.rag_config,
      modelConfig: snap.model_config,
      routingRules: snap.routing_rules,
      versionSummary: `Restored from v${ver.version_number} by ${currentMember?.name || user.id}`,
    });
    return nextRes;
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not restore agent version.') };
  }
}

export async function createAgentFromTemplateAction(
  workspaceId: string,
  templateId: string,
  customName?: string,
): Promise<{ success: true; agent: AiAgentRow } | { success: false; error: string }> {
  const tpl = getAgentTemplate(templateId);
  if (!tpl) return { success: false, error: 'Template not found.' };

  return saveAgentDraftAction(workspaceId, {
    name: customName?.trim() || tpl.name,
    roleTitle: tpl.roleTitle,
    description: tpl.tagline,
    templateId: tpl.id,
    industry: tpl.industry,
    channels: tpl.channels,
    tone: tpl.tone,
    replyLanguageMode: 'match_customer',
    answerMode: 'agent',
    systemPrompt: tpl.systemPrompt,
    guardrails: tpl.guardrails,
    escalationRules: { ...DEFAULT_ESCALATION_RULES },
    knowledgeScope: { ...DEFAULT_KNOWLEDGE_SCOPE },
    capabilities: {
      actions: tpl.actions.map((a) => a.title),
      frameworks: tpl.frameworks,
      subAgentId: null,
    },
    appearance: { ...DEFAULT_AGENT_APPEARANCE },
    engineType: 'builtin',
    engineConfig: { ...DEFAULT_AGENT_ENGINE_CONFIG },
    ragConfig: { ...DEFAULT_AGENT_RAG_CONFIG },
    modelConfig: { ...DEFAULT_AGENT_MODEL_CONFIG },
    routingRules: { ...DEFAULT_AGENT_ROUTING_RULES },
    versionSummary: `Created from template "${tpl.name}"`,
  });
}

export async function deleteAiAgentAction(
  workspaceId: string,
  agentId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const rows = await queryRows<{ is_primary: boolean }>(
      `SELECT is_primary FROM public.ai_agents WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [agentId, workspaceId],
    );
    if (!rows[0]) return { success: false, error: 'Agent not found.' };
    if (rows[0].is_primary) {
      return { success: false, error: 'Pause the primary assistant instead of deleting it.' };
    }
    await query(`DELETE FROM public.ai_agents WHERE id = $1 AND workspace_id = $2`, [agentId, workspaceId]);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not delete AI agent.') };
  }
}

export async function submitAgentReviewVerdictAction(
  workspaceId: string,
  logId: string,
  verdict: 'correct' | 'wrong',
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'edit_content');
    const rows = await queryRows<{ id: string }>(
      `UPDATE public.ai_verification_logs
       SET human_review = $3,
           reviewed_by = $4,
           reviewed_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING id`,
      [logId, workspaceId, verdict, user.id],
    );
    if (!rows[0]) return { success: false, error: 'Review entry not found.' };
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not save review verdict.') };
  }
}

export interface PlaygroundTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface PlaygroundResult {
  replyText: string;
  handoffTriggered: boolean;
  handoffReason: string | null;
  citedArticles: { id: string; title: string; slug: string | null }[];
  claims: VerificationClaim[];
  confidencePct: number;
  detectedLanguage: string;
  usingModel: boolean;
  latencyMs: number;
  ragMode?: AgentRagMode;
  ragTrace?: RagTrace;
  retrievalMethod?: 'semantic_rag' | 'keyword_fallback' | 'none';
  verificationVerdict?: 'supported' | 'blocked_fixed' | 'blocked_human' | 'needs_review';
  topic?: string;
}

export async function runAgentPlaygroundAction(
  workspaceId: string,
  input: {
    agentId?: string | null;
    agentName: string;
    industry?: string | null;
    tone: string;
    systemPrompt: string;
    guardrails: string[];
    escalationRules: AgentEscalationRules;
    knowledgeScope: AgentKnowledgeScope;
    answerMode?: AgentAnswerMode;
    replyLanguageMode?: AgentReplyLanguageMode;
    ragConfig?: Partial<AgentRagConfig>;
    engineType?: AgentEngineType;
    message: string;
    persona: 'standard' | 'vip' | 'upset' | 'non_english';
    language: 'auto' | 'en' | 'ur' | 'roman_ur' | 'hi' | 'ar' | 'es';
    simulateHandoff?: boolean;
    history?: PlaygroundTurn[];
  },
): Promise<{ success: true; result: PlaygroundResult } | { success: false; error: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'view');
    const started = Date.now();
    const userMessage = (input.message || '').trim();
    if (!userMessage) return { success: false, error: 'Enter a test message.' };

    const wsRows = await queryRows<{
      name: string;
      industry: string | null;
      slug: string | null;
      custom_domain: string | null;
      custom_domain_status: string | null;
    }>(
      `SELECT name, industry, slug, custom_domain, custom_domain_status FROM public.workspaces WHERE id = $1 LIMIT 1`,
      [workspaceId],
    );
    const ws = wsRows[0];
    const wsName = ws?.name || 'Workspace';
    const helpCenterUrl =
      ws?.custom_domain && ws?.custom_domain_status === 'active'
        ? `https://${ws.custom_domain}`
        : ws?.slug
          ? `/help/${ws.slug}`
          : null;

    if (input.simulateHandoff) {
      const reason = 'Simulated escalation triggered in Playground';
      return {
        success: true,
        result: {
          replyText: `I am connecting you with a specialist on the ${wsName} team right now so they can handle this directly.`,
          handoffTriggered: true,
          handoffReason: reason,
          citedArticles: [],
          claims: [],
          confidencePct: 100,
          detectedLanguage: 'English',
          usingModel: false,
          latencyMs: Date.now() - started,
          ragMode: normalizeAgentRagConfig(input.ragConfig).mode,
          retrievalMethod: 'none',
          verificationVerdict: 'blocked_human',
          topic: 'General inquiries',
        },
      };
    }

    // Check blocked topics & human keywords first
    const lower = userMessage.toLowerCase();
    const matchedBlocked = (input.escalationRules?.blockedTopics || []).find((topic) =>
      topic.trim() ? lower.includes(topic.trim().toLowerCase()) : false,
    );
    if (matchedBlocked || /\b(human|representative|manager|real person)\b/i.test(lower)) {
      const reason = matchedBlocked
        ? `Blocked topic matched escalation rule: "${matchedBlocked}"`
        : 'Customer explicitly requested a human agent';
      return {
        success: true,
        result: {
          replyText: `I will transfer this conversation to our team right away with full context so a specialist can help.`,
          handoffTriggered: true,
          handoffReason: reason,
          citedArticles: [],
          claims: [],
          confidencePct: 98,
          detectedLanguage: 'English',
          usingModel: false,
          latencyMs: Date.now() - started,
          ragMode: normalizeAgentRagConfig(input.ragConfig).mode,
          retrievalMethod: 'none',
          verificationVerdict: 'blocked_human',
          topic: 'General inquiries',
        },
      };
    }

    const hasSavedAgent = Boolean(input.agentId && input.agentId !== 'new');
    const [savedAgentRows, autonomyPolicies] = hasSavedAgent
      ? await Promise.all([
          queryRows<{
            industry?: string | null;
            answer_mode?: AgentAnswerMode | null;
            reply_language_mode?: AgentReplyLanguageMode | null;
            rag_config?: Partial<AgentRagConfig> | null;
            engine_type?: AgentEngineType | null;
          }>(
            `SELECT industry, answer_mode, reply_language_mode, rag_config, engine_type FROM public.ai_agents WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
            [input.agentId, workspaceId],
          ).catch(() => []),
          getAutonomyPoliciesForAgent(workspaceId, input.agentId!).catch(() => []),
        ])
      : [[], []];
    const savedAgent = savedAgentRows[0];

    const resolvedIndustry = input.industry || savedAgent?.industry || ws?.industry || 'generic';
    const effectiveAnswerMode: AgentAnswerMode =
      input.answerMode ?? (savedAgent?.answer_mode === 'strict' ? 'strict' : 'agent');
    const effectiveReplyLanguageMode: AgentReplyLanguageMode =
      input.replyLanguageMode ??
      (savedAgent?.reply_language_mode === 'native_script' ||
      savedAgent?.reply_language_mode === 'english_only'
        ? savedAgent.reply_language_mode
        : 'match_customer');
    const effectiveRagConfig = normalizeAgentRagConfig(input.ragConfig ?? savedAgent?.rag_config);
    const normalizedScope = normalizeKnowledgeScope(input.knowledgeScope);

    // Run live Semantic RAG (with keyword fallback & Advanced RAG stages) strictly scoped by the agent's collections & Bot Knowledge toggle.
    const retrieved = await buildModelContext(workspaceId, userMessage, {
      history: (input.history || []).map((h) => h.content),
      turns: input.history || [],
      limit: effectiveRagConfig.topK,
      helpCenterUrl,
      articlesOnly: true,
      knowledgeScope: normalizedScope,
      minScore: effectiveRagConfig.minScore,
      ragConfig: effectiveRagConfig,
    });

    const priorityIds = retrieved.sources.map((s) =>
      s.kind === 'knowledge' ? `knowledge:${s.id}` : s.id,
    );
    const fullKnowledge =
      effectiveAnswerMode === 'agent'
        ? await loadFullKnowledge(workspaceId, {
            helpCenterUrl,
            priorityIds,
            knowledgeScope: normalizedScope,
            maxChars: 24_000,
          }).catch(() => null)
        : null;

    const retrievalMethod: PlaygroundResult['retrievalMethod'] =
      retrieved.chunks && retrieved.chunks.length > 0
        ? 'semantic_rag'
        : retrieved.sources.length > 0
          ? 'keyword_fallback'
          : 'none';

    const citedArticles = effectiveRagConfig.citations
      ? retrieved.sources
          .filter((s) => s.kind !== 'knowledge')
          .slice(0, 3)
          .map((s) => ({
            id: s.id,
            title: s.title,
            slug: s.slug ?? null,
          }))
      : [];

    const knowledgeBlock =
      effectiveAnswerMode === 'agent'
        ? fullKnowledge?.text || retrieved.text
        : retrieved.text;

    const detected = detectLanguage(userMessage);
    const isRoman = isRomanizedText(detected.code, userMessage);
    const detectedLanguage = isRoman
      ? `Roman ${getLanguageInfo(detected.code).name}`
      : getLanguageInfo(detected.code).name;

    const targetLang =
      input.language !== 'auto'
        ? input.language === 'roman_ur'
          ? 'roman_ur'
          : input.language === 'ur'
            ? 'ur'
            : 'en'
        : effectiveReplyLanguageMode === 'english_only'
          ? 'en'
          : detected.code === 'ur' && isRoman
            ? effectiveReplyLanguageMode === 'native_script'
              ? 'ur'
              : 'roman_ur'
            : detected.code === 'ur'
              ? 'ur'
              : 'en';

    const customInstructions = [
      input.systemPrompt.trim(),
      `Tone: ${input.tone}`,
      `Answer mode: ${effectiveAnswerMode === 'strict' ? 'strict (answer only from retrieved chunks)' : 'agent (synthesize across permitted Help Center articles)'}`,
      !effectiveRagConfig.citations ? 'Do not include source citation links or footers.' : '',
      input.persona === 'vip' ? 'Test persona context: VIP high-lifetime-value customer.' : '',
      input.persona === 'upset' ? 'Test persona context: Customer appears frustrated; lead with empathy.' : '',
      input.guardrails.length
        ? `Guardrails (strict):\n${input.guardrails.map((g) => `- ${g}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const prompt = buildSupportAgentPrompt({
      botName: input.agentName || 'AI Assistant',
      businessName: wsName,
      industry: resolvedIndustry,
      knowledge: knowledgeBlock || 'No published articles exist in this agent\'s Knowledge Scope yet.',
      lang: targetLang,
      customInstructions,
      situation: input.persona === 'upset' ? ['Customer is frustrated in simulation.'] : undefined,
    });

    const llmReply = await tryWorkspaceChat(
      workspaceId,
      prompt,
      [
        ...(input.history || []).slice(-6).map((h) => `${h.role.toUpperCase()}: ${h.content}`),
        `USER: ${userMessage}`,
      ].join('\n'),
      550,
    );

    let replyText = llmReply;
    let usingModel = Boolean(llmReply);
    let handoffTriggered = false;
    let handoffReason: string | null = null;

    if (!replyText) {
      usingModel = false;
      if (!retrieved.belowThreshold && retrieved.text && retrieved.sources.length > 0) {
        const firstChunk = retrieved.text.split('\n\n---\n\n')[0] || retrieved.text;
        const cleaned = firstChunk
          .replace(/^\[CHUNK \d+\][\r\n]+(?:Article:[^\r\n]*[\r\n]+)?(?:Section:[^\r\n]*[\r\n]+)?/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        const snippet = cleaned.slice(0, 360);
        replyText = `${snippet}${cleaned.length > 360 ? '…' : ''}`;
      } else {
        handoffTriggered = true;
        const hasAnyScopedDocs =
          Boolean(fullKnowledge?.sources.length) || retrieved.sources.length > 0;
        const restricted = isRestrictedKnowledgeScope(normalizedScope);
        handoffReason =
          !hasAnyScopedDocs && restricted
            ? "No published articles or Bot knowledge exist within this agent's Knowledge Scope."
            : 'No configured AI provider API key or matching Help Center article found for this test query.';
        replyText = !hasAnyScopedDocs
          ? restricted
            ? "No published articles or Bot knowledge match this agent's current Knowledge Scope."
            : 'Your workspace does not have any published Knowledge Base articles yet. Add articles in Knowledge Base or configure an AI provider key in Settings.'
          : 'I could not find a verified match for this question in your published Knowledge Base, so I would hand this over to a team specialist.';
      }
    } else if (/\[HANDOVER(?::\s*([^\]]*))?\]/i.test(replyText)) {
      const m = replyText.match(/\[HANDOVER(?::\s*([^\]]*))?\]/i);
      handoffTriggered = true;
      handoffReason = m?.[1]?.trim() || 'Model decided human review is required';
      replyText = replyText.replace(/\[(?:SOURCE|HANDOVER|NOT_COVERED)[^\]]*\]/gi, '').trim();
    } else {
      replyText = replyText.replace(/\[(?:SOURCE|HANDOVER|NOT_COVERED)[^\]]*\]/gi, '').trim();
    }

    if (
      input.language !== 'auto' &&
      input.language !== 'en' &&
      !usingModel &&
      replyText
    ) {
      const translated = await translateAgentReply({
        text: replyText,
        targetLanguageCode: input.language === 'roman_ur' ? 'ur' : input.language,
        sourceLanguageCode: 'en',
        romanize: input.language === 'roman_ur',
      }).catch(() => null);
      if (translated?.translatedText) replyText = translated.translatedText;
    }

    const citedIds = (citedArticles.length ? citedArticles : retrieved.sources.filter((s) => s.kind !== 'knowledge'))
      .map((s) => s.id);
    const citedSectionNames = citedIds.length
      ? await getArticleSectionNames(workspaceId, citedIds).catch(() => [])
      : [];
    const autonomy = resolveAutonomyDecision({
      policies: autonomyPolicies,
      message: userMessage,
      citedSectionNames,
    });

    const verification = await verifyReplyClaimsAgainstKnowledge(
      workspaceId,
      replyText,
      citedArticles[0]?.title ?? retrieved.sources[0]?.title ?? null,
      {
        customerQuestion: userMessage,
        knowledgeScope: normalizedScope,
      },
    );

    const topChunk = retrieved.chunks?.[0];
    const topScore =
      topChunk?.combined_score ??
      topChunk?.similarity ??
      (retrieved.confidence === 'high' ? 0.9 : retrieved.confidence === 'medium' ? 0.65 : 0);
    const confidencePct = Math.min(
      99,
      Math.max(35, Math.round((usingModel ? 0.58 : 0.4) * 100 + Math.min(topScore, 1) * 40)),
    );
    const latencyMs = Date.now() - started;
    const verificationVerdict: NonNullable<PlaygroundResult['verificationVerdict']> =
      handoffTriggered ? 'blocked_human' : verification.verdict;

    await recordAiVerificationLog({
      workspaceId,
      agentId: input.agentId && input.agentId !== 'new' ? input.agentId : null,
      agentName: input.agentName || 'AI Assistant',
      channel: 'playground',
      topic: autonomy.topic,
      customerQuestion: userMessage,
      draftReply: replyText,
      finalReply: replyText,
      verdict: verificationVerdict,
      claims: verification.claims,
      outcomeNote: handoffTriggered
        ? `Playground handoff: ${handoffReason || 'escalation rule'}`
        : citedArticles.length > 0
          ? `Playground cited ${citedArticles.length} workspace article(s)`
          : 'Playground dry-run check',
      confidence: Number((confidencePct / 100).toFixed(2)),
      latencyMs,
      metadata: {
        playground: true,
        persona: input.persona,
        language: input.language,
        answerMode: effectiveAnswerMode,
        ragMode: effectiveRagConfig.mode,
        ragTrace: retrieved.ragTrace ?? null,
        retrievalMethod,
      },
    });

    return {
      success: true,
      result: {
        replyText,
        handoffTriggered,
        handoffReason,
        citedArticles,
        claims: verification.claims,
        confidencePct,
        detectedLanguage,
        usingModel,
        latencyMs,
        ragMode: effectiveRagConfig.mode,
        ragTrace: retrieved.ragTrace,
        retrievalMethod,
        verificationVerdict,
        topic: autonomy.topic,
      },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Playground test failed.') };
  }
}
