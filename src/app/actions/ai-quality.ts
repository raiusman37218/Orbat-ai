'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import { errorMessage, userError } from '@/lib/errors/user-error';
import {
  AUTONOMY_LEVEL_DEFS,
  DEFAULT_CORE_AUTONOMY_TOPICS,
  type AutonomyLevel,
} from '@/lib/ai/agent-templates';
import {
  ensurePrimaryAiAgent,
  normalizeAgentRow,
  type AiAgentRow,
  type VerificationClaim,
} from '@/lib/ai/agent-runtime';
import {
  approveLearningCandidateAction,
  rejectLearningCandidateAction,
} from '@/app/actions/bot-learning';
import {
  approvePendingAnswerAction,
  dismissUnansweredQuestionAction,
  saveQuickQaAnswerAction,
} from '@/app/actions/unanswered';

export type { AutonomyLevel };

export interface AutonomyPolicyRow {
  id: string;
  agentId: string;
  topic: string;
  level: AutonomyLevel;
  levelLabel: string;
  locked: boolean;
  lockReason: string | null;
  lastChangedByName: string | null;
  lastChangedAt: string;
  changeNote: string | null;
  conversations30d: number;
  agreementPct: number | null;
  correctionRatePct: number | null;
  escalations30d: number;
}

export interface VerificationCheckItem {
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
  claims: VerificationClaim[];
  outcomeNote: string | null;
  confidence: number | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface AnswerCardItem {
  id: string;
  source: 'learning_candidate' | 'unanswered_question';
  question: string;
  answer: string;
  status: 'pending_review' | 'pending_approval' | 'open' | 'approved' | 'auto_approved' | 'rejected' | 'stale';
  grounding: string | null;
  occurrences: number;
  reason: string | null;
  lastSeenAt: string;
  rejectReason: string | null;
}

export interface AiQualityBootstrap {
  canManage: boolean;
  canEditContent: boolean;
  agents: Pick<AiAgentRow, 'id' | 'name' | 'role_title' | 'status' | 'is_primary'>[];
  selectedAgentId: string | null;
  policies: AutonomyPolicyRow[];
  verificationKpis: {
    checked30d: number;
    passedFirstTryPct: number | null;
    fixedBeforeSendCount: number;
    sentToHumanCount: number;
    needsReviewCount: number;
  };
  verificationChecks: VerificationCheckItem[];
  answerCards: AnswerCardItem[];
}

function levelNameFor(level: number): string {
  const found = AUTONOMY_LEVEL_DEFS.find((d) => d.level === level);
  return found ? found.name : 'Suggest';
}

async function seedDefaultPoliciesForAgent(
  workspaceId: string,
  agent: AiAgentRow,
): Promise<void> {
  const existing = await queryRows<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt
     FROM public.ai_autonomy_policies
     WHERE workspace_id = $1 AND agent_id = $2`,
    [workspaceId, agent.id],
  );
  if (Number(existing[0]?.cnt || 0) > 0) return;

  const sectionRows = await queryRows<{ name: string }>(
    `SELECT name FROM public.help_sections WHERE workspace_id = $1 ORDER BY order_index ASC, name ASC LIMIT 4`,
    [workspaceId],
  ).catch(() => []);

  const topicSet = new Map<string, { level: AutonomyLevel; locked: boolean; lockReason: string | null; note: string }>();

  for (const s of sectionRows) {
    const clean = s.name?.trim();
    if (clean) {
      topicSet.set(clean, {
        level: 2,
        locked: false,
        lockReason: null,
        note: 'Initialized from Help Center collection',
      });
    }
  }

  for (const topic of DEFAULT_CORE_AUTONOMY_TOPICS) {
    if (!topicSet.has(topic)) {
      topicSet.set(topic, {
        level: 2,
        locked: false,
        lockReason: null,
        note: 'Default workspace policy (Suggest mode)',
      });
    }
  }

  for (const blocked of agent.escalation_rules?.blockedTopics || []) {
    const clean = blocked.trim();
    if (clean) {
      topicSet.set(clean, {
        level: 1,
        locked: true,
        lockReason: 'Escalation guardrail requires human review before sending',
        note: 'Locked from agent escalation rules',
      });
    }
  }

  for (const [topic, cfg] of topicSet.entries()) {
    await query(
      `INSERT INTO public.ai_autonomy_policies (
         workspace_id, agent_id, topic, level, locked, lock_reason, change_note, last_changed_by_name
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'System')
       ON CONFLICT (workspace_id, agent_id, topic) DO NOTHING`,
      [workspaceId, agent.id, topic, cfg.level, cfg.locked, cfg.lockReason, cfg.note],
    );
  }
}

function verificationScopeSql(alias = ''): string {
  const p = alias ? `${alias}.` : '';
  return `AND COALESCE(${p}channel, '') <> 'playground'
     AND COALESCE((${p}metadata->>'playground')::boolean, false) = false
     AND (${p}agent_id = $2 OR ($3::boolean AND ${p}agent_id IS NULL))`;
}

export async function getAiQualityBootstrapAction(
  workspaceId: string,
  requestedAgentId?: string | null,
): Promise<AiQualityBootstrap> {
  const { role } = await getWorkspaceAccess(workspaceId, 'view');
  const canManage = role === 'owner' || role === 'admin';
  const canEditContent = role === 'owner' || role === 'admin' || role === 'agent';

  await ensurePrimaryAiAgent(workspaceId);

  const rawAgents = await queryRows<Record<string, unknown>>(
    `SELECT * FROM public.ai_agents WHERE workspace_id = $1 ORDER BY is_primary DESC, updated_at DESC`,
    [workspaceId],
  );
  const agents = rawAgents.map(normalizeAgentRow);
  const activeAgent =
    (requestedAgentId && agents.find((a) => a.id === requestedAgentId)) || agents[0] || null;

  if (activeAgent) {
    await seedDefaultPoliciesForAgent(workspaceId, activeAgent);
  }

  const scopeParams = activeAgent ? [workspaceId, activeAgent.id, activeAgent.is_primary] : null;

  const [policyRows, topicStatsRows, verifKpiRow, verifRows, learningRows, unansweredRows] =
    await Promise.all([
      activeAgent
        ? queryRows<Record<string, unknown>>(
            `SELECT * FROM public.ai_autonomy_policies
             WHERE workspace_id = $1 AND agent_id = $2
             ORDER BY locked ASC, level DESC, topic ASC`,
            [workspaceId, activeAgent.id],
          )
        : Promise.resolve([]),
      scopeParams
        ? queryRows<{
            topic_key: string;
            total_cnt: string;
            reviewed_cnt: string;
            correct_cnt: string;
            wrong_cnt: string;
            escalated_cnt: string;
          }>(
            `SELECT
               LOWER(TRIM(topic)) AS topic_key,
               COUNT(*)::text AS total_cnt,
               COUNT(*) FILTER (WHERE human_review IS NOT NULL)::text AS reviewed_cnt,
               COUNT(*) FILTER (WHERE human_review = 'correct')::text AS correct_cnt,
               COUNT(*) FILTER (WHERE human_review = 'wrong')::text AS wrong_cnt,
               COUNT(*) FILTER (WHERE verdict = 'blocked_human')::text AS escalated_cnt
             FROM public.ai_verification_logs
             WHERE workspace_id = $1
               AND created_at >= now() - interval '30 days'
               AND topic IS NOT NULL
               ${verificationScopeSql()}
             GROUP BY LOWER(TRIM(topic))`,
            scopeParams,
          )
        : Promise.resolve([]),
      scopeParams
        ? queryRows<{
            checked_cnt: string;
            supported_cnt: string;
            fixed_cnt: string;
            human_cnt: string;
            review_cnt: string;
          }>(
            `SELECT
               COUNT(*)::text AS checked_cnt,
               COUNT(*) FILTER (WHERE verdict = 'supported')::text AS supported_cnt,
               COUNT(*) FILTER (WHERE verdict = 'blocked_fixed')::text AS fixed_cnt,
               COUNT(*) FILTER (WHERE verdict = 'blocked_human')::text AS human_cnt,
               COUNT(*) FILTER (WHERE verdict = 'needs_review' AND human_review IS NULL)::text AS review_cnt
             FROM public.ai_verification_logs
             WHERE workspace_id = $1
               AND created_at >= now() - interval '30 days'
               ${verificationScopeSql()}`,
            scopeParams,
          )
        : Promise.resolve([]),
      scopeParams
        ? queryRows<Record<string, unknown>>(
            `SELECT v.*, COALESCE(v.agent_name, a.name, 'AI Assistant') AS resolved_agent_name
             FROM public.ai_verification_logs v
             LEFT JOIN public.ai_agents a ON a.id = v.agent_id
             WHERE v.workspace_id = $1
               ${verificationScopeSql('v')}
             ORDER BY v.created_at DESC
             LIMIT 50`,
            scopeParams,
          )
        : Promise.resolve([]),
      canManage
        ? queryRows<Record<string, unknown>>(
            `SELECT id, question, answer, status, grounding, occurrences, reject_reason, last_seen_at
             FROM public.bot_learning_candidates
             WHERE workspace_id = $1
             ORDER BY CASE WHEN status IN ('pending_review','stale') THEN 0 ELSE 1 END, occurrences DESC, last_seen_at DESC
             LIMIT 40`,
            [workspaceId],
          ).catch(() => [])
        : Promise.resolve([]),
      queryRows<Record<string, unknown>>(
        `SELECT id, question, reason, times_asked, status, proposed_answer, last_asked_at
         FROM public.unanswered_questions
         WHERE workspace_id = $1 AND status IN ('pending_approval', 'open')
         ORDER BY CASE WHEN status = 'pending_approval' THEN 0 ELSE 1 END, times_asked DESC, last_asked_at DESC
         LIMIT 30`,
        [workspaceId],
      ).catch(() => []),
    ]);

  const statsMap = new Map(topicStatsRows.map((r) => [r.topic_key, r]));

  const policies: AutonomyPolicyRow[] = policyRows.map((p) => {
    const topic = String(p.topic || 'General');
    const stat = statsMap.get(topic.trim().toLowerCase());
    const conversations30d = Number(stat?.total_cnt || 0);
    const reviewed = Number(stat?.reviewed_cnt || 0);
    const correct = Number(stat?.correct_cnt || 0);
    const wrong = Number(stat?.wrong_cnt || 0);
    const escalations30d = Number(stat?.escalated_cnt || 0);
    const lvlNum = Math.min(4, Math.max(1, Number(p.level || 2))) as AutonomyLevel;

    return {
      id: String(p.id),
      agentId: String(p.agent_id),
      topic,
      level: lvlNum,
      levelLabel: levelNameFor(lvlNum),
      locked: Boolean(p.locked),
      lockReason: p.lock_reason ? String(p.lock_reason) : null,
      lastChangedByName: p.last_changed_by_name ? String(p.last_changed_by_name) : null,
      lastChangedAt: String(p.last_changed_at || p.updated_at),
      changeNote: p.change_note ? String(p.change_note) : null,
      conversations30d,
      agreementPct: reviewed > 0 ? Math.round((correct / reviewed) * 100) : null,
      correctionRatePct: reviewed > 0 ? Number(((wrong / reviewed) * 100).toFixed(1)) : null,
      escalations30d,
    };
  });

  const kpi = verifKpiRow[0];
  const checked30d = Number(kpi?.checked_cnt || 0);
  const supportedCnt = Number(kpi?.supported_cnt || 0);

  const verificationChecks: VerificationCheckItem[] = verifRows.map((r) => ({
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
      : 'supported') as VerificationCheckItem['verdict'],
    humanReview:
      r.human_review === 'correct' || r.human_review === 'wrong'
        ? (r.human_review as 'correct' | 'wrong')
        : null,
    claims: Array.isArray(r.claims) ? (r.claims as VerificationClaim[]) : [],
    outcomeNote: r.outcome_note ? String(r.outcome_note) : null,
    confidence: r.confidence !== null && r.confidence !== undefined ? Number(r.confidence) : null,
    latencyMs: r.latency_ms !== null && r.latency_ms !== undefined ? Number(r.latency_ms) : null,
    createdAt: String(r.created_at),
  }));

  const answerCards: AnswerCardItem[] = [
    ...learningRows.map((c) => ({
      id: String(c.id),
      source: 'learning_candidate' as const,
      question: String(c.question || ''),
      answer: String(c.answer || ''),
      status: String(c.status || 'pending_review') as AnswerCardItem['status'],
      grounding: c.grounding ? String(c.grounding) : null,
      occurrences: Number(c.occurrences || 1),
      reason: 'Self-learning answer candidate from team conversations',
      lastSeenAt: String(c.last_seen_at),
      rejectReason: c.reject_reason ? String(c.reject_reason) : null,
    })),
    ...unansweredRows.map((u) => ({
      id: String(u.id),
      source: 'unanswered_question' as const,
      question: String(u.question || ''),
      answer: String(u.proposed_answer || ''),
      status: (u.status === 'pending_approval' ? 'pending_approval' : 'open') as AnswerCardItem['status'],
      grounding: null,
      occurrences: Number(u.times_asked || 1),
      reason: u.reason ? String(u.reason) : 'Customer question not matched by Knowledge Base',
      lastSeenAt: String(u.last_asked_at),
      rejectReason: null,
    })),
  ];

  return {
    canManage,
    canEditContent,
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      role_title: a.role_title,
      status: a.status,
      is_primary: a.is_primary,
    })),
    selectedAgentId: activeAgent?.id ?? null,
    policies,
    verificationKpis: {
      checked30d,
      passedFirstTryPct: checked30d > 0 ? Math.round((supportedCnt / checked30d) * 100) : null,
      fixedBeforeSendCount: Number(kpi?.fixed_cnt || 0),
      sentToHumanCount: Number(kpi?.human_cnt || 0),
      needsReviewCount: Number(kpi?.review_cnt || 0),
    },
    verificationChecks,
    answerCards,
  };
}

export async function setTopicAutonomyAction(
  workspaceId: string,
  input: { agentId: string; topic: string; level: AutonomyLevel; changeNote?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const topic = input.topic.trim();
    if (!topic) return { success: false, error: 'Topic name is required.' };
    if (input.level < 1 || input.level > 4) {
      return { success: false, error: 'Autonomy level must be between 1 and 4.' };
    }

    const existing = await queryRows<{ locked: boolean; lock_reason: string | null }>(
      `SELECT locked, lock_reason
       FROM public.ai_autonomy_policies
       WHERE workspace_id = $1 AND agent_id = $2 AND topic = $3
       LIMIT 1`,
      [workspaceId, input.agentId, topic],
    );

    if (existing[0]?.locked) {
      return {
        success: false,
        error: existing[0].lock_reason || 'This topic is locked by compliance policy. Unlock it first.',
      };
    }

    await query(
      `INSERT INTO public.ai_autonomy_policies (
         workspace_id, agent_id, topic, level, last_changed_by, last_changed_by_name,
         last_changed_at, change_note, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7, now())
       ON CONFLICT (workspace_id, agent_id, topic) DO UPDATE SET
         level = EXCLUDED.level,
         last_changed_by = EXCLUDED.last_changed_by,
         last_changed_by_name = EXCLUDED.last_changed_by_name,
         last_changed_at = now(),
         change_note = EXCLUDED.change_note,
         updated_at = now()`,
      [
        workspaceId,
        input.agentId,
        topic,
        input.level,
        user.id,
        agent?.name || 'Admin',
        input.changeNote || `Updated to Level ${input.level} (${levelNameFor(input.level)})`,
      ],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not update topic autonomy.') };
  }
}

export async function toggleTopicLockAction(
  workspaceId: string,
  input: { agentId: string; topic: string; locked: boolean; lockReason?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    await query(
      `UPDATE public.ai_autonomy_policies
       SET locked = $4,
           lock_reason = $5,
           last_changed_by = $6,
           last_changed_by_name = $7,
           last_changed_at = now(),
           updated_at = now()
       WHERE workspace_id = $1 AND agent_id = $2 AND topic = $3`,
      [
        workspaceId,
        input.agentId,
        input.topic,
        input.locked,
        input.locked ? input.lockReason?.trim() || 'Locked by workspace admin' : null,
        user.id,
        agent?.name || 'Admin',
      ],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not update topic lock.') };
  }
}

export async function addAutonomyTopicAction(
  workspaceId: string,
  input: { agentId: string; topic: string; level?: AutonomyLevel },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const topic = input.topic.trim();
    if (!topic) return { success: false, error: 'Topic name is required.' };
    const lvl = input.level && input.level >= 1 && input.level <= 4 ? input.level : 2;
    await query(
      `INSERT INTO public.ai_autonomy_policies (
         workspace_id, agent_id, topic, level, last_changed_by, last_changed_by_name,
         last_changed_at, change_note
       )
       VALUES ($1, $2, $3, $4, $5, $6, now(), 'Added manually')
       ON CONFLICT (workspace_id, agent_id, topic) DO NOTHING`,
      [workspaceId, input.agentId, topic, lvl, user.id, agent?.name || 'Admin'],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not add autonomy topic.') };
  }
}

export async function reviewAnswerCardAction(
  workspaceId: string,
  input: {
    source: 'learning_candidate' | 'unanswered_question';
    id: string;
    decision: 'approve' | 'reject';
    question?: string;
    answer?: string;
    reason?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { role } = await getWorkspaceAccess(workspaceId, 'edit_content');
    const isAdmin = role === 'owner' || role === 'admin';

    if (input.source === 'learning_candidate') {
      if (!isAdmin) {
        throw userError('Only workspace owners or admins can approve self-learning entries.');
      }
      if (input.decision === 'approve') {
        let question = input.question?.trim() || '';
        let answer = input.answer?.trim() || '';
        if (!question || !answer) {
          const rows = await queryRows<{ question: string; answer: string }>(
            `SELECT question, answer
             FROM public.bot_learning_candidates
             WHERE id = $1 AND workspace_id = $2
             LIMIT 1`,
            [input.id, workspaceId],
          );
          if (!rows[0]) {
            throw userError('This learning suggestion no longer exists.');
          }
          question = question || rows[0].question;
          answer = answer || rows[0].answer;
        }
        const res = await approveLearningCandidateAction(workspaceId, input.id, {
          question,
          answer,
        });
        if (!res.success) return { success: false, error: res.error };
        return { success: true };
      }
      const res = await rejectLearningCandidateAction(workspaceId, input.id, input.reason);
      if (!res.success) return { success: false, error: res.error };
      return { success: true };
    }

    // unanswered_question flow
    if (input.decision === 'reject') {
      await dismissUnansweredQuestionAction(workspaceId, input.id);
      return { success: true };
    }

    if (input.answer && input.answer.trim()) {
      await saveQuickQaAnswerAction(workspaceId, input.id, {
        question: (input.question || '').trim(),
        answer: input.answer.trim(),
      });
      return { success: true };
    }

    await approvePendingAnswerAction(workspaceId, input.id);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not review answer card.') };
  }
}
