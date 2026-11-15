'use server';

import { getWorkspaceAccess } from '@/lib/team/access';
import { serviceClient } from '@/lib/pg/service';
import { userError } from '@/lib/errors/user-error';
import {
  CopilotActionType,
  CopilotMessage,
  CopilotNextSteps,
  CopilotRewriteMode,
  CopilotSource,
  CopilotSummary,
} from '@/types/database';
import { CopilotReplyLanguage } from '@/lib/ai/copilot/prompts';
import {
  CopilotAutonomyMeta,
  CopilotAvailability,
  CopilotVerificationMeta,
  askCopilotQuestion,
  checkCopilotAvailability,
  generateCopilotNextSteps,
  generateCopilotSuggestedReply,
  generateCopilotSummary,
  rewriteComposerText,
} from '@/lib/ai/copilot/service';

async function assertConversationInWorkspace(
  workspaceId: string,
  conversationId: string
): Promise<void> {
  const adminClient = serviceClient();
  const { data: conv } = await adminClient
    .from('conversations')
    .select('id, workspace_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conv || conv.workspace_id !== workspaceId) {
    throw userError('Conversation not found in this workspace.');
  }
}

export interface CopilotPendingDraft {
  messageId: string;
  text: string;
  sources: CopilotSource[];
  knowledgeFound: boolean;
  noteForAgent: string | null;
  resolvedLanguage: 'en' | 'ur' | 'roman_ur';
  autonomy: CopilotAutonomyMeta | null;
  verification: CopilotVerificationMeta | null;
}

export interface CopilotPanelState {
  availability: CopilotAvailability;
  summary: CopilotSummary | null;
  nextSteps: CopilotNextSteps | null;
  copilotMessages: CopilotMessage[];
  nonInternalMessageCount: number;
  pendingDraft?: CopilotPendingDraft | null;
}

const AUTONOMY_LEVEL_LABEL: Record<number, CopilotAutonomyMeta['levelLabel']> = {
  1: 'Shadow',
  2: 'Suggest',
  3: 'Supervised',
  4: 'Autonomous',
};

function parsePendingSuggestionRow(
  row: { id?: string; created_at?: string; metadata?: unknown } | undefined,
  latestHumanReplyAt: string | undefined,
): CopilotPendingDraft | null {
  if (!row?.id || !row.metadata || typeof row.metadata !== 'object') return null;
  const meta = row.metadata as Record<string, unknown>;
  if (meta.is_copilot_suggestion !== true || meta.draft_discarded === true || meta.draft_used === true) {
    return null;
  }
  if (latestHumanReplyAt && row.created_at && Date.parse(row.created_at) <= Date.parse(latestHumanReplyAt)) {
    return null;
  }
  const text =
    (typeof meta.suggested_draft === 'string' && meta.suggested_draft.trim()) ||
    (typeof meta.draft_reply === 'string' && meta.draft_reply.trim()) ||
    '';
  if (!text) return null;

  const citedRaw = Array.isArray(meta.cited_articles) ? meta.cited_articles : [];
  const sources: CopilotSource[] = citedRaw
    .map((item): CopilotSource | null => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const id = String(rec.id || '').trim();
      const title = String(rec.title || '').trim();
      if (!id || !title) return null;
      return { id, title, slug: null, url: null, kind: 'article' };
    })
    .filter((s): s is CopilotSource => Boolean(s));

  const levelNum = Math.min(4, Math.max(1, Number(meta.autonomy_level || 2))) as 1 | 2 | 3 | 4;
  const autonomy: CopilotAutonomyMeta | null =
    typeof meta.autonomy_topic === 'string' && meta.autonomy_topic.trim()
      ? {
          topic: meta.autonomy_topic.trim(),
          level: levelNum,
          levelLabel: AUTONOMY_LEVEL_LABEL[levelNum] || 'Suggest',
          locked: Boolean(meta.autonomy_locked),
          lockReason: typeof meta.lock_reason === 'string' ? meta.lock_reason : null,
          agentName: typeof meta.agent_name === 'string' ? meta.agent_name : null,
        }
      : null;

  const rawVerif =
    meta.verification && typeof meta.verification === 'object'
      ? (meta.verification as Record<string, unknown>)
      : null;
  const rawClaims = Array.isArray(rawVerif?.claims) ? rawVerif.claims : [];
  const unsupportedClaims = rawClaims
    .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object' && (c as Record<string, unknown>).supported === false))
    .map((c) => String(c.claim || '').trim())
    .filter(Boolean);
  const verification: CopilotVerificationMeta | null = rawVerif
    ? {
        verdict: rawVerif.verdict === 'needs_review' ? 'needs_review' : 'supported',
        confidence: Number(rawVerif.confidence ?? 0.75),
        method: rawVerif.method === 'semantic_llm' ? 'semantic_llm' : 'grounded_heuristic',
        unsupportedClaims,
      }
    : null;

  const notes: string[] = [
    autonomy
      ? `Pre-draft prepared under Trust Ladder Level ${autonomy.level} (${autonomy.levelLabel}) for "${autonomy.topic}" — review before sending.`
      : 'Pre-draft prepared under Trust Ladder Suggest mode — review before sending.',
  ];
  if (verification?.verdict === 'needs_review') {
    notes.push(
      `⚠️ Claim verification flagged ${
        unsupportedClaims.length > 0 ? unsupportedClaims.slice(0, 2).join('; ') : 'unverified details'
      }.`,
    );
  }

  return {
    messageId: String(row.id),
    text,
    sources,
    knowledgeFound: sources.length > 0 && verification?.verdict !== 'needs_review',
    noteForAgent: notes.join('\n'),
    resolvedLanguage: 'en',
    autonomy,
    verification,
  };
}

/**
 * Loads initial Copilot panel state for a conversation.
 * Strictly checks workspace membership and conversation ownership.
 */
export async function getCopilotPanelStateAction(
  workspaceId: string,
  conversationId: string
): Promise<CopilotPanelState> {
  const { supabase } = await getWorkspaceAccess(workspaceId, 'view');
  await assertConversationInWorkspace(workspaceId, conversationId);

  const [
    availability,
    { data: conv },
    { data: chatMsgs },
    { count: msgCount },
    { data: internalMsgs },
    { data: latestHuman },
  ] = await Promise.all([
    checkCopilotAvailability(workspaceId),
    supabase
      .from('conversations')
      .select('id, workspace_id, copilot_summary, copilot_next_steps')
      .eq('id', conversationId)
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
    supabase
      .from('copilot_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('is_internal', false),
    supabase
      .from('messages')
      .select('id, created_at, metadata')
      .eq('conversation_id', conversationId)
      .eq('is_internal', true)
      .eq('sender_type', 'ai')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('messages')
      .select('created_at')
      .eq('conversation_id', conversationId)
      .eq('is_internal', false)
      .eq('sender_type', 'agent')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestHumanAt = (latestHuman as { created_at?: string } | null)?.created_at;
  const candidateRow = ((internalMsgs || []) as Array<{ id?: string; created_at?: string; metadata?: unknown }>).find(
    (r) =>
      r.metadata &&
      typeof r.metadata === 'object' &&
      (r.metadata as Record<string, unknown>).is_copilot_suggestion === true,
  );
  const pendingDraft = parsePendingSuggestionRow(candidateRow, latestHumanAt);

  return {
    availability,
    summary: (conv?.copilot_summary as CopilotSummary | null) || null,
    nextSteps: (conv?.copilot_next_steps as CopilotNextSteps | null) || null,
    copilotMessages: ((chatMsgs || []) as CopilotMessage[]).map((m) => ({
      ...m,
      sources: Array.isArray(m.sources) ? (m.sources as CopilotSource[]) : [],
    })),
    nonInternalMessageCount: msgCount ?? 0,
    pendingDraft,
  };
}

/**
 * 1. Generate or refresh Conversation Summary
 */
export async function generateCopilotSummaryAction(
  workspaceId: string,
  conversationId: string,
  forceRefresh = false
) {
  const { user } = await getWorkspaceAccess(workspaceId, 'view');
  await assertConversationInWorkspace(workspaceId, conversationId);

  return generateCopilotSummary({
    workspaceId,
    userId: user.id,
    conversationId,
    forceRefresh,
  });
}

/**
 * 2. Suggest Reply from conversation + workspace knowledge
 */
export async function suggestCopilotReplyAction(
  workspaceId: string,
  conversationId: string,
  language: CopilotReplyLanguage = 'auto'
) {
  const { user } = await getWorkspaceAccess(workspaceId, 'reply');
  await assertConversationInWorkspace(workspaceId, conversationId);

  return generateCopilotSuggestedReply({
    workspaceId,
    userId: user.id,
    conversationId,
    language,
  });
}

/**
 * 3. Ask Copilot (Private agent chat)
 */
export async function askCopilotQuestionAction(
  workspaceId: string,
  conversationId: string,
  question: string
) {
  const { user } = await getWorkspaceAccess(workspaceId, 'view');
  await assertConversationInWorkspace(workspaceId, conversationId);

  return askCopilotQuestion({
    workspaceId,
    userId: user.id,
    conversationId,
    question,
  });
}

/**
 * 4. Rewrite composer text (shorter, professional, friendly, grammar, translate)
 */
export async function rewriteCopilotTextAction(
  workspaceId: string,
  text: string,
  mode: CopilotRewriteMode,
  conversationId?: string | null
) {
  const { user } = await getWorkspaceAccess(workspaceId, 'reply');
  if (conversationId) {
    await assertConversationInWorkspace(workspaceId, conversationId);
  }

  return rewriteComposerText({
    workspaceId,
    userId: user.id,
    conversationId,
    text,
    mode,
  });
}

/**
 * 5. Generate Next Steps & Triage Suggestions
 */
export async function generateCopilotNextStepsAction(
  workspaceId: string,
  conversationId: string
) {
  const { user } = await getWorkspaceAccess(workspaceId, 'view');
  await assertConversationInWorkspace(workspaceId, conversationId);

  return generateCopilotNextSteps({
    workspaceId,
    userId: user.id,
    conversationId,
  });
}

/**
 * 6. Record Thumbs Up / Down feedback on a Copilot output
 */
export async function recordCopilotFeedbackAction(
  workspaceId: string,
  eventId: string | null | undefined,
  feedback: 'up' | 'down',
  copilotMessageId?: string | null
): Promise<{ success: boolean }> {
  await getWorkspaceAccess(workspaceId, 'view');
  const adminClient = serviceClient();

  if (eventId) {
    await adminClient
      .from('copilot_events')
      .update({ feedback })
      .eq('id', eventId)
      .eq('workspace_id', workspaceId);
  }

  if (copilotMessageId) {
    await adminClient
      .from('copilot_messages')
      .update({ feedback })
      .eq('id', copilotMessageId)
      .eq('workspace_id', workspaceId);
  }

  return { success: true };
}

/**
 * 7. Record whether a suggested draft was used, edited, or discarded
 */
export async function recordCopilotDraftDispositionAction(
  workspaceId: string,
  eventId: string | null | undefined,
  disposition: 'used' | 'edited' | 'discarded'
): Promise<{ success: boolean }> {
  await getWorkspaceAccess(workspaceId, 'view');
  if (!eventId) return { success: false };

  const adminClient = serviceClient();
  await adminClient
    .from('copilot_events')
    .update({ draft_disposition: disposition })
    .eq('id', eventId)
    .eq('workspace_id', workspaceId);

  return { success: true };
}

/** Marks a Trust Ladder Level 2 internal draft suggestion as used or discarded so it does not re-appear. */
export async function dismissCopilotSuggestedMessageAction(
  workspaceId: string,
  conversationId: string,
  messageId: string,
  disposition: 'used' | 'discarded',
): Promise<{ success: boolean }> {
  await getWorkspaceAccess(workspaceId, 'reply');
  await assertConversationInWorkspace(workspaceId, conversationId);
  if (!messageId) return { success: false };

  const adminClient = serviceClient();
  const { data: msg } = await adminClient
    .from('messages')
    .select('id, metadata')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (!msg) return { success: false };
  const prevMeta = (msg.metadata && typeof msg.metadata === 'object' ? msg.metadata : {}) as Record<string, unknown>;
  await adminClient
    .from('messages')
    .update({
      metadata: {
        ...prevMeta,
        ...(disposition === 'used' ? { draft_used: true } : { draft_discarded: true }),
      },
    })
    .eq('id', messageId)
    .eq('conversation_id', conversationId);

  return { success: true };
}

export interface CopilotAnalyticsReport {
  availability: CopilotAvailability;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensIn: number;
  totalTokensOut: number;
  avgLatencyMs: number;
  byAction: Record<CopilotActionType, number>;
  draftsTotal: number;
  draftsUsed: number;
  draftsEdited: number;
  draftsDiscarded: number;
  draftAcceptanceRatePercent: number | null;
  thumbsUp: number;
  thumbsDown: number;
  positiveFeedbackPercent: number | null;
  missingKnowledgeCount: number;
}

/**
 * 8. Workspace Copilot Analytics Report (Usage, Draft Acceptance Rate, Feedback)
 */
export async function getCopilotAnalyticsReportAction(
  workspaceId: string,
  days = 30
): Promise<CopilotAnalyticsReport> {
  await getWorkspaceAccess(workspaceId, 'view');
  const adminClient = serviceClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [availability, { data: events }] = await Promise.all([
    checkCopilotAvailability(workspaceId),
    adminClient
      .from('copilot_events')
      .select(
        'id, action_type, tokens_in, tokens_out, latency_ms, status, feedback, draft_disposition, missing_knowledge, created_at'
      )
      .eq('workspace_id', workspaceId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  const rows = events || [];
  const byAction: Record<CopilotActionType, number> = {
    summary: 0,
    suggest_reply: 0,
    ask: 0,
    rewrite: 0,
    next_steps: 0,
  };

  let successfulRequests = 0;
  let failedRequests = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalLatency = 0;
  let draftsUsed = 0;
  let draftsEdited = 0;
  let draftsDiscarded = 0;
  let thumbsUp = 0;
  let thumbsDown = 0;
  let missingKnowledgeCount = 0;

  for (const r of rows) {
    const action = r.action_type as CopilotActionType;
    if (byAction[action] !== undefined) {
      byAction[action]++;
    }
    if (r.status === 'success') {
      successfulRequests++;
      totalLatency += Number(r.latency_ms || 0);
    } else {
      failedRequests++;
    }
    totalTokensIn += Number(r.tokens_in || 0);
    totalTokensOut += Number(r.tokens_out || 0);

    if (r.draft_disposition === 'used') draftsUsed++;
    else if (r.draft_disposition === 'edited') draftsEdited++;
    else if (r.draft_disposition === 'discarded') draftsDiscarded++;

    if (r.feedback === 'up') thumbsUp++;
    else if (r.feedback === 'down') thumbsDown++;

    if (r.missing_knowledge) missingKnowledgeCount++;
  }

  const draftsTotal = draftsUsed + draftsEdited + draftsDiscarded;
  const acceptedDrafts = draftsUsed + draftsEdited;
  const draftAcceptanceRatePercent =
    draftsTotal > 0 ? Math.round((acceptedDrafts / draftsTotal) * 100) : null;

  const totalFeedback = thumbsUp + thumbsDown;
  const positiveFeedbackPercent =
    totalFeedback > 0 ? Math.round((thumbsUp / totalFeedback) * 100) : null;

  return {
    availability,
    totalRequests: rows.length,
    successfulRequests,
    failedRequests,
    totalTokensIn,
    totalTokensOut,
    avgLatencyMs: successfulRequests > 0 ? Math.round(totalLatency / successfulRequests) : 0,
    byAction,
    draftsTotal,
    draftsUsed,
    draftsEdited,
    draftsDiscarded,
    draftAcceptanceRatePercent,
    thumbsUp,
    thumbsDown,
    positiveFeedbackPercent,
    missingKnowledgeCount,
  };
}

