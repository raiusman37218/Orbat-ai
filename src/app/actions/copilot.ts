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
  CopilotAvailability,
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

export interface CopilotPanelState {
  availability: CopilotAvailability;
  summary: CopilotSummary | null;
  nextSteps: CopilotNextSteps | null;
  copilotMessages: CopilotMessage[];
  nonInternalMessageCount: number;
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

  const [availability, { data: conv }, { data: chatMsgs }, { count: msgCount }] =
    await Promise.all([
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
    ]);

  return {
    availability,
    summary: (conv?.copilot_summary as CopilotSummary | null) || null,
    nextSteps: (conv?.copilot_next_steps as CopilotNextSteps | null) || null,
    copilotMessages: ((chatMsgs || []) as CopilotMessage[]).map((m) => ({
      ...m,
      sources: Array.isArray(m.sources) ? (m.sources as CopilotSource[]) : [],
    })),
    nonInternalMessageCount: msgCount ?? 0,
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

