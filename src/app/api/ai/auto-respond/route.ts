import { NextRequest, NextResponse, after } from 'next/server';
import { serviceClient } from '@/lib/pg/service';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  generateHelpDeskResponseWithHandover,
  executeHandoverToHuman,
  buildRunningSummary,
} from '@/lib/ai/anthropic';
import { dispatchOutboundMessage } from '@/lib/channels/dispatcher';
import { answerWithExternalAgent } from '@/lib/agent/external-agent';
import { executeAgentWithRouter } from '@/lib/agent/engines/router';
import type { EngineUsed, PendingApprovalPayload } from '@/lib/agent/engines/types';
import { providerConfigFrom, warmHelpIndex } from '@/lib/ai/help-answer';
import { getPlatformAiConfigServerOnly } from '@/lib/ai/platform-gateway';
import {
  asksForHuman,
  asksToResumeAi,
  extractReferences,
  getExpectedReplyTimeNotice,
  localized,
  replyLanguageOf,
  type VisitorIntent,
} from '@/lib/ai/intent';
import {
  botControlState,
  botMayReply,
  deliverAiReply,
  logAiEvent,
  notifyTeamOnly,
  TEAM_MEMBER_PREFIX,
} from '@/lib/ai/bot-control';
import {
  detectLanguage,
  getLanguageInfo,
  isRomanizedText,
  isLikelyEnglishText,
  normalizeDetectedLanguage,
  translateAgentReply,
  translateToEnglish,
  translateWithGoogleGtx,
} from '@/lib/ai/translator';
import { getWorkspaceHelpCenterUrl } from '@/lib/domain';
import { notifyTeamByEmailLater } from '@/lib/team/agent-notify';
import { createWorkspaceNotification } from '@/lib/notifications/workspace-notifications';
import { translateVisitorMessage } from '@/lib/ai/inbound-translation';
import { checkWorkspaceFeature, checkWorkspaceLimit, incrementWorkspaceUsage } from '@/lib/plans/enforce';
import { recordPolicyOutcome } from '@/lib/ai/learning/policy';
import { looksLikeImageUrl, messageWithImage, readScreenshot, type ImageReading } from '@/lib/ai/vision';
import { canAiRespond } from '@/lib/handoff/state-machine';
import {
  getLanguageConfig,
  recordAiVerificationLog,
  resolveTargetAiAgentWithMatch,
  verifyReplyClaimsAgainstKnowledge,
  type AgentRoutingResult,
} from '@/lib/ai/agent-runtime';
import type { ClaimVerificationResult } from '@/lib/ai/claim-verifier';
import {
  getArticleSectionNames,
  getAutonomyPoliciesForAgent,
  resolveAutonomyDecision,
  type AutonomyDecision,
} from '@/lib/ai/trust-ladder';
import type { HandoffStatus } from '@/types/database';
import { evaluateHandoffTrigger } from '@/lib/ai/handoff-detect';

export const maxDuration = 60;

/** Maps categorical retrieval confidence to a numeric score for threshold checks. */
function retrievalConfidenceScore(confidence?: string | null): number | undefined {
  if (confidence === 'high') return 0.92;
  if (confidence === 'medium') return 0.72;
  if (confidence === 'low') return 0.4;
  return undefined;
}

/** Numeric confidence logged to `ai_verification_logs` when claim verifier does not supply one. */
function numericConfidenceFromRetrieval(confidence?: string | null): number | null {
  if (confidence === 'high') return 0.9;
  if (confidence === 'medium') return 0.7;
  if (confidence === 'low') return 0.4;
  return null;
}

/** Runs pre-delivery claim verification with a tight timeout so slow verifiers never stall auto-respond. */
async function runTimedClaimCheck(
  workspaceId: string,
  replyText: string,
  citedTitle: string | null,
  options: { languageCode?: string | null; customerQuestion?: string | null },
  timeoutMs = 5000,
): Promise<ClaimVerificationResult | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const task = verifyReplyClaimsAgainstKnowledge(workspaceId, replyText, citedTitle, options).catch(() => null);
    const guard = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    return await Promise.race([task, guard]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Stores an internal shadow draft, Copilot pre-draft, or safety block note without messaging the visitor. */
async function saveInternalDraftNote(params: {
  supabase: ReturnType<typeof serviceClient>;
  conversationId: string;
  visitorMessageId: string;
  content: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const { error } = await params.supabase.from('messages').insert({
    conversation_id: params.conversationId,
    sender_type: 'ai',
    sender_id: null,
    content: params.content,
    is_internal: true,
    reply_to_message_id: params.visitorMessageId,
    metadata: params.metadata,
  });
  if (error && error.code !== '23505') {
    console.error('[Auto-Respond] Failed saving internal AI draft note:', error.message);
  }
}

interface PreferredAgentRow {
  id: string;
  name: string | null;
  avatar_url: string | null;
  status: string | null;
  is_active: boolean | null;
  role: string | null;
}

/** Picks the best active human agent, preferring members of `handoffGroupId` when set. */
async function pickPreferredGroupAgent(
  supabase: ReturnType<typeof serviceClient>,
  workspaceId: string,
  handoffGroupId?: string | null,
): Promise<{ id: string; name: string | null; avatar_url: string | null } | null> {
  const [{ data: ags }, groupRes] = await Promise.all([
    supabase.from('agents').select('id, name, avatar_url, status, is_active, role').eq('workspace_id', workspaceId),
    handoffGroupId
      ? supabase.from('ticket_group_members').select('agent_id').eq('group_id', handoffGroupId)
      : Promise.resolve({ data: null as { agent_id: string }[] | null }),
  ]);
  const eligible = ((ags as PreferredAgentRow[] | null) || []).filter(
    (a) => a.is_active !== false && a.role !== 'light_agent',
  );
  if (eligible.length === 0) return null;

  const groupIds = new Set(
    ((groupRes?.data as { agent_id: string }[] | null) || []).map((m) => m.agent_id).filter(Boolean),
  );
  const groupPool = groupIds.size > 0 ? eligible.filter((a) => groupIds.has(a.id)) : [];
  const pool = groupPool.length > 0 ? groupPool : eligible;
  const rank = (s: string | null) => (s === 'online' ? 0 : s === 'away' ? 1 : 2);
  const sorted = [...pool].sort((a, b) => rank(a.status) - rank(b.status));
  const chosen = sorted[0];
  return chosen ? { id: chosen.id, name: chosen.name, avatar_url: chosen.avatar_url } : null;
}

/** The parts of workspaces.handoff_settings this route reads. */
interface HandoffSettingsView {
  handoff_mode?: string;
  ai?: {
    require_confirmation?: boolean;
    confidence_threshold?: number;
    cooldown_message_count?: number;
    keywords?: string[];
  };
}

/** Handoff columns on conversations (20261124090000_handoff_foundation). */
interface HandoffConversationView {
  handoff_status?: HandoffStatus | null;
  ai_assist?: boolean | null;
  ai_enabled?: boolean | null;
  handoff_reason?: string | null;
  handoff_offer_count?: number | null;
  handoff_last_offer_msg_count?: number | null;
}

/** What offer_handoff / request_handoff return. */
interface HandoffRpcResult {
  ok?: boolean;
  idempotent?: boolean;
  offered?: boolean;
  status?: string;
  reason?: string;
}

const GENERATION_BUDGET_MS = 35_000;

/** The trailing citation formatCitation() adds, in any of its languages. */
const CITATION_LINE = /\n\n(?:Source|ماخذ|स्रोत|المصدر|Fuente): (?:\[[^\]\n]*\]\([^)\s]+\)|\*\*[^\n]*\*\*)\s*$/;

/**
 * The language the visitor wrote in. The word-list detector is instant but
 * only knows a few dozen languages and calls everything else English, so text
 * it cannot place is checked with Google's detector.
 */
async function visitorLanguageOf(text: string): Promise<{ code: string; roman: boolean }> {
  // The pipeline wrote its reply in the language replyLanguageOf chose. Roman
  // Urdu ("kisi insaan se baat karwa do") also passes isLikelyEnglishText, and
  // the bot's Roman Urdu reply was then "translated" into English.
  if (text && replyLanguageOf(text) === 'roman_ur') {
    return { code: 'ur', roman: true };
  }
  if (!text || !/[\p{L}]/u.test(text) || isLikelyEnglishText(text)) {
    return { code: 'en', roman: false };
  }
  let code = normalizeDetectedLanguage(detectLanguage(text).code, text);
  if (code === 'en') {
    const g = await translateWithGoogleGtx(text, 'en', 'auto').catch(() => null);
    if (g?.detectedLanguage) {
      code = g.romanizedSource ? g.detectedLanguage : normalizeDetectedLanguage(g.detectedLanguage, text);
    }
  }
  return { code, roman: code !== 'en' && isRomanizedText(code, text) };
}

/** Epoch ms of the latest of several optional timestamps; -Infinity if none. */
function latest(...values: (string | null | undefined)[]): number {
  let best = -Infinity;
  for (const v of values) {
    const t = v ? Date.parse(v) : NaN;
    if (!Number.isNaN(t) && t > best) best = t;
  }
  return best;
}

/**
 * Where the customer can read the full article.
 * Uses verified custom domain if live, otherwise platform help center subdomain.
 */
function helpCenterUrlFor(ws: any): string | null {
  if (!ws) return null;
  return getWorkspaceHelpCenterUrl(ws);
}

// The embeddable widget calls this after every visitor message, from the
// customer's own site.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Visitor-Token',
};

function json(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { ...init, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// In-memory sets to prevent concurrent auto-response runs
const inFlightConversations = new Set<string>();
const inFlightMessages = new Set<string>();

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const conversation_id: string | undefined = body?.conversation_id;
  const workspace_id: string | undefined = body?.workspace_id;

  if (!conversation_id || !workspace_id) {
    return json({ error: 'Missing conversation_id or workspace_id' }, { status: 400 });
  }

  if (!(await checkRateLimit(`auto_respond:${conversation_id}`, 30, 60))) {
    return json({ error: 'rate_limited' }, { status: 429 });
  }

  const { withConversationAdvisoryLock } = await import('@/lib/ai/auto-respond-guard');
  const lockOutcome = await withConversationAdvisoryLock(conversation_id, () =>
    executeAutoRespond(req, body),
  );
  if (!lockOutcome.acquired) {
    return json({ replied: false, reason: 'already_in_flight' });
  }
  return lockOutcome.result!;
}

async function executeAutoRespond(req: NextRequest, body: any) {
  let lockAcquired = false;
  let messageLockAcquired = false;
  let conversation_id: string | undefined;
  let targetVisitorMsgId: string | undefined;
  // Set once the conversation is known to belong to the workspace, so an
  // error can be recorded against it.
  let eventScope: { workspaceId: string; conversationId: string } | null = null;

  try {
    conversation_id = body.conversation_id;
    const workspace_id = body.workspace_id;
    const requested_message_id = body.message_id || body.messageId;

    if (!conversation_id || !workspace_id) {
      return json({ error: 'Missing conversation_id or workspace_id' }, { status: 400 });
    }

    console.log('[Auto-Respond Step 1] AI reply triggered for message:', {
      requested_message_id,
      conversation_id,
      workspace_id,
    });

    // Agents read every visitor message in English. This runs whether or not
    // the assistant answers, and after the response so it never slows a reply.
    if (requested_message_id) {
      try {
        after(() =>
          translateVisitorMessage(requested_message_id).catch((err: unknown) =>
            console.warn('[Auto-Respond] Inbound translation failed:', err)
          )
        );
      } catch {
        translateVisitorMessage(requested_message_id).catch((err: unknown) =>
          console.warn('[Auto-Respond] Inbound translation failed:', err)
        );
      }
    }

    if (requested_message_id && inFlightMessages.has(requested_message_id)) {
      return json({ replied: false, reason: 'Auto-response already in progress for this message' });
    }

    // 0. One run per conversation at a time on this instance, so a burst of
    // visitor messages is answered in order. This only saves model calls:
    // other instances are not covered, and fn_deliver_ai_reply is what keeps
    // a conversation to one answer. Waiting too long therefore carries on
    // rather than dropping the message, whose run may be the one that answers.
    const waitUntil = Date.now() + 45_000;
    while (inFlightConversations.has(conversation_id) && Date.now() < waitUntil) {
      await new Promise((r) => setTimeout(r, 200));
    }
    inFlightConversations.add(conversation_id);
    lockAcquired = true;

    // Privileged: this route has no user session, and row level security
    // otherwise hides the workspace's own settings from it.
    const supabase = serviceClient();

    // The reply has a two-second budget, so everything this route reads is
    // fetched at once rather than one query after another, and the help index
    // starts loading alongside.
    warmHelpIndex(workspace_id);
    const [{ data: workspace }, { data: conv }, { data: recentMessages }] = await Promise.all([
      supabase
        .from('workspaces')
        .select('name, industry, greeting_title, greeting_message, ai_settings, handoff_settings, slug, custom_domain, custom_domain_status, business_hours, is_suspended, deleted_at')
        .eq('id', workspace_id)
        .single(),
      supabase
        .from('conversations')
        // '*' rather than a column list, so the route keeps working before
        // the last_resolved_at migration has been run.
        .select('*, visitor:visitors(name, email)')
        .eq('id', conversation_id)
        .single(),
      // Only the recent end of the thread is ever used below.
      supabase
        .from('messages')
        .select('id, sender_type, sender_id, content, attachment_url, is_internal, created_at, metadata, reply_to_message_id')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    // First, before anything is recorded: the caller is the public widget and
    // names both ids itself.
    if (!workspace || !conv || (conv.workspace_id && conv.workspace_id !== workspace_id)) {
      return json({ replied: false, reason: 'Conversation not found or workspace mismatch', code: 'not_found' });
    }

    eventScope = { workspaceId: workspace_id, conversationId: conversation_id };

    const { verifyAutoRespondCaller } = await import('@/lib/ai/auto-respond-guard');
    const callerAuth = await verifyAutoRespondCaller({
      request: req,
      workspaceId: workspace_id,
      convVisitorId: conv.visitor_id,
      visitorToken: body?.visitor_token,
      supabase,
    });
    if (!callerAuth.authorized) {
      return json({ error: 'Unauthorized', code: callerAuth.reason || 'unauthorized' }, { status: 401 });
    }

    // Every silent "no" is recorded with its reason, so "the bot didn't
    // reply" can be answered from ai_reply_events instead of guessed at. The
    // widget ignores the response, so nothing here reaches the visitor.
    const skip = async (code: string, reason: string, visitorMessageId?: string | null) => {
      console.log('[Auto-Respond] Not replying:', code);
      await logAiEvent(supabase, {
        workspaceId: workspace_id,
        conversationId: conversation_id!,
        visitorMessageId: visitorMessageId ?? requested_message_id ?? null,
        event: 'reply_suppressed',
        reason: code,
      });
      return json({ replied: false, reason, code });
    };

    if (workspace.deleted_at) {
      return skip('workspace_deleted', 'Workspace was deleted');
    }
    if (workspace.is_suspended) {
      return skip('workspace_suspended', 'Workspace is suspended');
    }

    const featureCheck = await checkWorkspaceFeature(workspace_id, 'ai_bot');
    const limitCheck = await checkWorkspaceLimit(workspace_id, 'max_ai_bot_replies_per_month');
    console.log('[Auto-Respond Step 3] Plan check:', {
      featureAllowed: featureCheck.allowed,
      limitAllowed: limitCheck.allowed,
    });
    if (!featureCheck.allowed) {
      return skip('plan_no_ai_bot', featureCheck.upgradeMessage || 'AI bot not in plan');
    }
    if (!limitCheck.allowed) {
      return skip('plan_reply_limit_reached', limitCheck.upgradeMessage || 'AI reply limit reached');
    }

    const msgs = (recentMessages || []).reverse();
    const isVisitorLine = (m: (typeof msgs)[number]) =>
      m.sender_type === 'visitor' && !m.is_internal;

    // Gather all visitor message IDs that have already been answered or handed over
    const answeredVisitorMessageIds = new Set<string>();
    for (const m of msgs) {
      if (m.sender_type === 'ai' || m.sender_type === 'agent') {
        if (m.reply_to_message_id) answeredVisitorMessageIds.add(m.reply_to_message_id);
        if (m.metadata?.answered_message_id) answeredVisitorMessageIds.add(m.metadata.answered_message_id);
        if (m.metadata?.reply_to_message_id) answeredVisitorMessageIds.add(m.metadata.reply_to_message_id);
        if (m.metadata?.handover_for_message_id) answeredVisitorMessageIds.add(m.metadata.handover_for_message_id);
      }
    }

    // Determine target visitor message
    let visitorMsg: (typeof msgs)[number] | undefined;
    if (requested_message_id) {
      visitorMsg = msgs.find((m) => m.id === requested_message_id && isVisitorLine(m));
      if (!visitorMsg) {
        const { data: specificMsg } = await supabase
          .from('messages')
          .select('id, sender_type, sender_id, content, attachment_url, is_internal, created_at, metadata, reply_to_message_id')
          .eq('id', requested_message_id)
          .eq('conversation_id', conversation_id)
          .maybeSingle();

        if (specificMsg && isVisitorLine(specificMsg)) {
          visitorMsg = specificMsg;
        }
      }
    }

    if (!visitorMsg) {
      const lastReply = [...msgs]
        .reverse()
        .find((m) => (m.sender_type === 'agent' || m.sender_type === 'ai') && !m.is_internal);
      const answeredUntil = lastReply
        ? Date.parse(
            (lastReply.sender_type === 'ai' && lastReply.metadata?.answered_until) ||
              lastReply.created_at
          )
        : -Infinity;

      const unanswered = msgs.filter(
        (m) =>
          isVisitorLine(m) &&
          !answeredVisitorMessageIds.has(m.id) &&
          Date.parse(m.created_at) > answeredUntil
      );

      if (unanswered.length === 0) {
        return skip('nothing_unanswered', 'Already responded');
      }

      visitorMsg = unanswered[unanswered.length - 1];
    }

    if (!visitorMsg) {
      return skip('no_visitor_message', 'No visitor message found to answer');
    }

    const currentVisitorMsgId: string = visitorMsg.id;
    targetVisitorMsgId = currentVisitorMsgId;

    // Idempotency Guard 1: In-flight duplicate prevention
    if (inFlightMessages.has(currentVisitorMsgId)) {
      return json({ replied: false, reason: `Auto-response already in progress for message ${currentVisitorMsgId}` });
    }
    inFlightMessages.add(currentVisitorMsgId);
    messageLockAcquired = true;

    // Idempotency Guard 2: In-memory answered check
    if (answeredVisitorMessageIds.has(currentVisitorMsgId)) {
      return skip('already_answered', `Already responded to message ${currentVisitorMsgId}`, currentVisitorMsgId);
    }

    // Idempotency Guard 3: Database-level existence check
    const { data: existingAnswer } = await supabase
      .from('messages')
      .select('id, sender_type, is_internal, reply_to_message_id, metadata')
      .eq('conversation_id', conversation_id)
      .or(`reply_to_message_id.eq.${currentVisitorMsgId},metadata->>answered_message_id.eq.${currentVisitorMsgId},metadata->>handover_for_message_id.eq.${currentVisitorMsgId}`)
      .limit(1);

    if (existingAnswer && existingAnswer.length > 0) {
      return skip('already_answered', `Already responded to message ${targetVisitorMsgId}`, currentVisitorMsgId);
    }



    const aiSettings = workspace?.ai_settings;

    // Only an explicit "off" counts. Settings shows a missing flag as on, and
    // ai_settings rows written before a flag existed (or trimmed when the
    // model moved to platform level) do not carry it.
    if (aiSettings && (aiSettings.enabled === false || aiSettings.auto_response_enabled === false)) {
      console.log('[Auto-Respond Step 2] Bot disabled in workspace settings:', {
        enabled: aiSettings?.enabled,
        auto_response_enabled: aiSettings?.auto_response_enabled,
      });
      return skip(
        aiSettings.enabled === false ? 'workspace_ai_off' : 'workspace_auto_reply_off',
        'AI auto-first-response disabled',
        currentVisitorMsgId
      );
    }

    // Who answers. The database decides (migration 20261031090000): a
    // person's public reply hands the conversation to people, and only a
    // person turns the bot back on. A paused bot does not wake up because the
    // conversation went quiet; it used to after 20 minutes, which answered
    // over agents who were still on the case.
    //
    // closed_at cannot tell us about a resolution: the visitor's own message
    // reopens the conversation and clears it before this route runs. The
    // last_resolved_at column (never cleared) and channel_metadata carry the
    // history instead.
    const meta = ((conv.channel_metadata as Record<string, any>) || {}) as Record<string, any>;
    const isHumanLine = (m: (typeof msgs)[number]) =>
      m.sender_type === 'agent' && !m.is_internal && m.sender_id != null && !m.metadata?.is_welcome;
    const lastHumanReply = [...msgs].reverse().find(isHumanLine);
    const lastBotReply = [...msgs]
      .reverse()
      .find((m) => m.sender_type === 'ai' && !m.is_internal && !m.metadata?.system_event);

    const resolvedAt = latest(conv.last_resolved_at, conv.closed_at, meta.last_resolved_at);
    const lastHumanAt = latest(lastHumanReply?.created_at, meta.last_human_reply_at);
    let autopilotAt = latest(meta.autopilot_enabled_at, conv.ai_resumed_at);
    // When the assistant was switched off: by a human reply, by hand, or by a handover.
    const disabledAt = latest(lastHumanReply?.created_at, meta.last_human_reply_at, meta.ai_disabled_at, conv.ai_control_changed_at);

    const CLOSING_ACK_RE =
      /^(?:ok(?:ay)?|k|kk|alright|got\s+it|understood|noted|fine|sure|thanks?(?:\s+you|\s+a\s+lot|\s+so\s+much)?|thank\s+you(?:\s+so\s+much|\s+very\s+much)?|thx|ty|tysm|shukriya|meherbani|bohat\s+shukriya|theek(?:\s+hai)?|thik(?:\s+hai)?|acha(?:\s+theek\s+hai|\s+ji)?|sahi(?:\s+hai)?|ji\s+(?:theek|shukriya|behtar)|👍+|👌+|🙏+|❤️+|✅+)[\s!.,👍👌🙏❤️✅]*$/iu;
    const HUMAN_FOLLOWUP_RE =
      /\b(?:still\s+(?:not|no|same|waiting)|not\s+(?:showing|working|received|updated|fixed)|didn'?t\s+(?:receive|get|work|show)|did\s+not\s+(?:receive|get|work|show)|when\s+(?:shall|will|can)\s+i\s+(?:receive|get)|abhi\s+tak\s+nahi|nahi\s+(?:mila|aaya|show|chal))\b/i;

    const targetAtMs = Date.parse(visitorMsg.created_at);
    const lastPublicBeforeVisitor = [...msgs]
      .reverse()
      .find(
        (m) =>
          m.id !== targetVisitorMsgId &&
          !m.is_internal &&
          !m.metadata?.is_welcome &&
          !m.metadata?.system_event &&
          Date.parse(m.created_at) <= targetAtMs &&
          (m.sender_type === 'agent' || m.sender_type === 'ai')
      );
    const lastSpeakerWasHuman = Boolean(lastPublicBeforeVisitor && isHumanLine(lastPublicBeforeVisitor));
    const explicitAutopilotAt = latest(meta.autopilot_enabled_at);
    const agentExplicitlyResumed =
      (explicitAutopilotAt > -Infinity && explicitAutopilotAt > lastHumanAt) ||
      Boolean(conv.ai_resumed_at && Date.parse(conv.ai_resumed_at) > lastHumanAt && !(resolvedAt > -Infinity && resolvedAt >= lastHumanAt));
    const trimmedVisitorText = String(visitorMsg.content || '').trim();
    const isClosingAckToHuman = lastSpeakerWasHuman && !agentExplicitlyResumed && CLOSING_ACK_RE.test(trimmedVisitorText);
    const isDirectFollowupToClosedHumanChat =
      lastSpeakerWasHuman &&
      !agentExplicitlyResumed &&
      resolvedAt > -Infinity &&
      resolvedAt >= lastHumanAt &&
      HUMAN_FOLLOWUP_RE.test(trimmedVisitorText);
    const keepWithHumanAgent = isClosingAckToHuman || isDirectFollowupToClosedHumanChat;

    if (keepWithHumanAgent && conv.ai_mode !== 'disabled') {
      await supabase
        .from('conversations')
        .update({ ai_mode: 'disabled', ai_paused_reason: 'human_reply' })
        .eq('id', conversation_id);
      Object.assign(conv, { ai_mode: 'disabled', ai_paused_reason: 'human_reply' });
    }

    // A resolution after the switch-off starts a new exchange, and the bot
    // gets its turn back. (The database does this when a closed conversation
    // reopens; this covers resolutions it cannot see, such as a solved ticket.)
    if (!keepWithHumanAgent && conv.ai_mode === 'disabled' && resolvedAt > -Infinity && resolvedAt > disabledAt) {
      const { error: resumeErr } = await supabase
        .from('conversations')
        .update({ ai_mode: 'autopilot' })
        .eq('id', conversation_id)
        .eq('ai_mode', 'disabled');
      if (resumeErr) {
        console.error('[Auto-Respond] Could not resume the bot after resolution:', resumeErr);
      } else {
        const { data: fresh } = await supabase.from('conversations').select('*').eq('id', conversation_id).single();
        if (fresh) Object.assign(conv, fresh);
      }
    }

    // If a human agent replied earlier (human_reply), never resolved the chat,
    // and has been completely silent for 1+ hour while the visitor returns with
    // a new message (not just a closing ack), auto-resume autopilot so the
    // conversation does not stay stuck in human_handling forever.
    const STALE_HUMAN_TAKEOVER_MS = 60 * 60_000;
    const lastHumanActivityAt = Math.max(lastHumanAt, latest(conv.ai_control_changed_at, meta.ai_disabled_at));
    const isStaleHumanTakeover =
      !keepWithHumanAgent &&
      !CLOSING_ACK_RE.test(trimmedVisitorText) &&
      lastHumanActivityAt > -Infinity &&
      targetAtMs - lastHumanActivityAt >= STALE_HUMAN_TAKEOVER_MS &&
      ((conv.ai_mode === 'disabled' && conv.ai_paused_reason === 'human_reply') ||
        (conv.ai_mode !== 'disabled' && lastHumanAt > -Infinity && lastHumanAt > autopilotAt && lastHumanAt > resolvedAt));

    if (isStaleHumanTakeover) {
      const resumedIso = new Date(targetAtMs).toISOString();
      const { error: staleResumeErr } = await supabase
        .from('conversations')
        .update({
          ai_mode: 'autopilot',
          ai_paused_reason: null,
          ai_resumed_at: resumedIso,
          channel_metadata: {
            ...meta,
            autopilot_enabled_at: resumedIso,
          },
        })
        .eq('id', conversation_id);
      if (staleResumeErr) {
        console.error('[Auto-Respond] Could not auto-resume stale human takeover:', staleResumeErr);
      } else {
        const { data: freshStale } = await supabase.from('conversations').select('*').eq('id', conversation_id).single();
        if (freshStale) Object.assign(conv, freshStale);
        autopilotAt = latest((conv.channel_metadata as Record<string, any>)?.autopilot_enabled_at, conv.ai_resumed_at);
      }
    }

    const needsAttentionAt = latest(conv.ai_needs_attention_at);
    const lastHandoverMsg = [...msgs]
      .reverse()
      .find(
        (m) =>
          m.sender_type === 'ai' &&
          !m.is_internal &&
          Date.parse(m.created_at) <= targetAtMs &&
          (m.metadata?.handover === true ||
            m.metadata?.system_event === 'handover' ||
            (typeof m.metadata?.system_event === 'object' && m.metadata?.system_event?.type === 'handover'))
      );
    const lastHandoverAt = latest(conv.ai_needs_attention_at, lastHandoverMsg?.created_at);
    const alreadyHandedOverInExchange =
      lastHandoverAt > -Infinity &&
      lastHandoverAt > resolvedAt &&
      lastHandoverAt > lastHumanAt &&
      lastHandoverAt > autopilotAt;

    // If the visitor is waiting in the human queue (no human agent has replied yet)
    // and clicks "🤖 Ask AI Assistant meanwhile" / asks to resume AI help, re-enable autopilot
    // while keeping ai_needs_attention_at so the conversation stays in the agent queue.
    let waitingInHumanQueue =
      ((conv.ai_mode === 'disabled' &&
        (conv.ai_paused_reason === 'human_requested' || conv.ai_paused_reason === 'needs_attention')) ||
        alreadyHandedOverInExchange) &&
      !(lastHumanAt > -Infinity && lastHumanAt > resolvedAt);

    if (waitingInHumanQueue && asksToResumeAi(visitorMsg.content)) {
      const nowIso = new Date().toISOString();
      const attentionIso = conv.ai_needs_attention_at || new Date(Date.parse(nowIso) - 1000).toISOString();
      const { error: resumeAiErr } = await supabase
        .from('conversations')
        .update({
          ai_mode: 'autopilot',
          ai_paused_reason: null,
          ai_resumed_at: nowIso,
          ai_needs_attention_at: attentionIso,
          channel_metadata: {
            ...meta,
            autopilot_enabled_at: nowIso,
          },
        })
        .eq('id', conversation_id);
      if (!resumeAiErr) {
        const { data: freshConv } = await supabase.from('conversations').select('*').eq('id', conversation_id).single();
        if (freshConv) Object.assign(conv, freshConv);
        visitorMsg.content = 'I have another question.';
        waitingInHumanQueue = false;
      }
    }

    // Rows written before the takeover trigger: a person replied after the
    // bot was last switched on, but the row still says autopilot.
    const legacyHumanOwned =
      conv.ai_mode !== 'disabled' && lastHumanAt > -Infinity && lastHumanAt > autopilotAt && lastHumanAt > resolvedAt;
    const botState =
      legacyHumanOwned || keepWithHumanAgent
        ? 'human_handling'
        : waitingInHumanQueue && conv.ai_mode !== 'disabled'
        ? 'needs_attention'
        : botControlState(conv, lastBotReply?.created_at);
    // Read before generating; delivery is refused if it changes meanwhile.
    const controlVersion: number | null =
      typeof conv.ai_control_version === 'number' ? conv.ai_control_version : null;

    const isAskingForHuman = asksForHuman(visitorMsg.content);

    console.log('[Auto-Respond Step 2] Bot control check:', {
      bot_enabled: aiSettings?.enabled !== false && aiSettings?.auto_response_enabled !== false,
      botState,
      controlVersion,
      isAskingForHuman,
    });

    // The handoff state machine (migration 20261124090000). The bot is silent
    // while a person has the conversation or the visitor is queued for one,
    // except in the offline queue after the visitor asked for AI help. A
    // silenced message still goes through the branch below, which logs why,
    // keeps the visitor informed in the queue and tells the team.
    const handoffSettings: HandoffSettingsView = (workspace as { handoff_settings?: HandoffSettingsView | null }).handoff_settings || {};
    const handoffModeOn = handoffSettings.handoff_mode !== 'off';
    const handoffRow = conv as HandoffConversationView;
    const currentHandoffStatus: HandoffStatus = handoffRow.handoff_status || 'bot_active';
    const isAiAssist = Boolean(handoffRow.ai_assist);
    const isAiEnabled = handoffRow.ai_enabled !== false;
    const silencedByHandoff = !canAiRespond(currentHandoffStatus, { aiEnabled: isAiEnabled, aiAssist: isAiAssist });
    if (silencedByHandoff) {
      console.log(`[Auto-Respond] Silenced by handoff state: ${currentHandoffStatus} (aiAssist: ${isAiAssist})`);
    }

    // The visitor answered the bot's "connect you with our team?" offer in
    // words: "1" / "agent" is the text fallback the offer gives on channels
    // without buttons. The confirmation goes out first, while the bot may still
    // speak (request_handoff switches it off), so it reaches WhatsApp and the
    // other channels too.
    if (!silencedByHandoff && handoffModeOn && currentHandoffStatus === 'handoff_offered') {
      const content = String(visitorMsg.content || '').trim().toLowerCase();
      const isAffirmative =
        /^(1|yes|yep|yeah|sure|ok|okay|please|connect|agent|human|ha|haan|han|jee|ji|g)[.!]*$/i.test(content) ||
        isAskingForHuman;

      if (isAffirmative) {
        console.log(`[Auto-Respond] Visitor accepted the handoff offer on conversation ${conversation_id}`);
        const confirmLang = replyLanguageOf(visitorMsg.content);
        const confirmation = await deliverAiReply(supabase, {
          conversationId: conversation_id,
          visitorMessageId: targetVisitorMsgId,
          expectedVersion: controlVersion,
          content: localized(confirmLang, {
            en: "Thanks! I'm connecting you with our team now. If nobody is free right away, we'll reply here as soon as someone is back.",
            roman_ur: 'Shukriya! Main aapko abhi hamari team se connect kar raha hoon. Agar foran koi available na ho to jaise hi koi wapas aayega, yahin jawab milega.',
            ur: 'شکریہ! میں آپ کو ابھی ہماری ٹیم سے منسلک کر رہا ہوں۔ اگر فوراً کوئی دستیاب نہ ہو تو جیسے ہی کوئی واپس آئے گا، یہیں جواب ملے گا۔',
          }),
          metadata: { answered_message_id: targetVisitorMsgId, bot_engine: 'built_in', handoff_confirmed: true },
        });
        if (confirmation && !confirmation.delivered) {
          console.log('[Auto-Respond] Handoff confirmation not delivered:', confirmation.reason);
        }
        const { data: handoffData, error: handoffErr } = await supabase.rpc('request_handoff', {
          p_conversation_id: conversation_id,
          p_reason: handoffRow.handoff_reason || 'explicit',
        });
        const handoffRes = handoffData as HandoffRpcResult | null;
        if (handoffErr) {
          console.error('[Auto-Respond] request_handoff failed:', handoffErr.message);
        } else {
          await logAiEvent(supabase, {
            workspaceId: workspace_id,
            conversationId: conversation_id,
            visitorMessageId: currentVisitorMsgId,
            event: 'handover',
            reason: 'handoff_accepted',
            detail: { status: handoffRes?.status ?? null },
          });
          if (handoffRes?.ok !== false && !handoffRes?.idempotent) {
            const visitorName = (conv.visitor as { name?: string | null } | null)?.name?.trim() || 'Visitor';
            await createWorkspaceNotification({
              workspaceId: workspace_id,
              recipientAgentId: (conv as { assigned_agent_id?: string | null }).assigned_agent_id ?? null,
              kind: 'handoff',
              title: `${visitorName} requested human handoff`,
              body: handoffRow.handoff_reason || visitorMsg.content,
              href: `/app/inbox?c=${encodeURIComponent(conversation_id)}`,
              client: supabase,
            });
          }
          return json({
            replied: Boolean(confirmation?.delivered),
            handoff_accepted: true,
            status: handoffRes?.status || 'waiting_for_agent',
          });
        }
      }
    }

    if (silencedByHandoff || legacyHumanOwned || keepWithHumanAgent || waitingInHumanQueue || !botMayReply(conv)) {
      // If the visitor is waiting in the human handover queue (no human agent has replied yet)
      // and sends follow-up messages (details, "hi", "why is no one responding?", "connect to team"),
      // do not leave them in dead silence: capture any account/email details for the agent and
      // send a rate-limited queue status update with an option to use the AI assistant meanwhile.
      if (waitingInHumanQueue) {
        const qLang = replyLanguageOf(visitorMsg.content);
        const qRefs = extractReferences(visitorMsg.content, lastBotReply?.content ?? null);
        const hasRefs = Boolean(qRefs.email || qRefs.orderNumber || qRefs.accountNumber);

        if (hasRefs) {
          const givenList = [
            qRefs.orderNumber ? `order ${qRefs.orderNumber}` : null,
            qRefs.accountNumber ? `account ${qRefs.accountNumber}` : null,
            qRefs.email ? `email ${qRefs.email}` : null,
          ]
            .filter(Boolean)
            .join(', ');
          await notifyTeamOnly({
            supabase,
            conversationId: conversation_id,
            visitorMessageId: currentVisitorMsgId,
            note: `📌 Visitor shared details while waiting in queue: ${givenList}\nMessage: "${String(visitorMsg.content).slice(0, 240)}"`,
          });
        } else if (isAskingForHuman) {
          await notifyTeamOnly({
            supabase,
            conversationId: conversation_id,
            visitorMessageId: currentVisitorMsgId,
            note: '🙋 The visitor asked for a person again while waiting in the queue.',
          });
        }

        const lastQueueNotice = [...msgs]
          .reverse()
          .find((m) => m.sender_type === 'ai' && !m.is_internal && m.metadata?.is_queue_update);
        const sinceLastNoticeMs = lastQueueNotice?.created_at
          ? Date.now() - Date.parse(lastQueueNotice.created_at)
          : Infinity;
        const lastDetailsNotice = [...msgs]
          .reverse()
          .find((m) => m.sender_type === 'ai' && !m.is_internal && m.metadata?.is_details_ack);
        const sinceLastDetailsMs = lastDetailsNotice?.created_at
          ? Date.now() - Date.parse(lastDetailsNotice.created_at)
          : Infinity;
        const sinceHandoverMs = lastHandoverAt > -Infinity ? Date.now() - lastHandoverAt : Infinity;

        const shouldSendDetailsAck = hasRefs && sinceLastDetailsMs > 2 * 60_000;
        const shouldSendQueueReminder =
          !hasRefs &&
          !CLOSING_ACK_RE.test(trimmedVisitorText) &&
          sinceLastNoticeMs > 3 * 60_000 &&
          sinceHandoverMs > 2 * 60_000;

        if (shouldSendDetailsAck || shouldSendQueueReminder) {
          const notice = getExpectedReplyTimeNotice(qLang);
          const queueText = hasRefs
            ? localized(qLang, {
                en: `Thanks! I've attached your details to your ticket for our support team. ${notice} If you'd like instant help with another question while you wait, tap below.`,
                roman_ur: `Shukriya! Maine aapki details support team ke liye ticket mein add kar di hain. ${notice} Agar aap intezar ke dauran AI assistant se kuch poochna chahein to neeche click karein.`,
                ur: `شکریہ! میں نے آپ کی تفصیلات سپورٹ ٹیم کے لیے ٹکٹ میں شامل کر دی ہیں۔ ${notice}`,
              })
            : localized(qLang, {
                en: `Your conversation is in our support team's priority queue and we've notified our agents that you're waiting. ${notice} Need instant answers to general questions while you wait?`,
                roman_ur: `Aapki conversation hamari support team ki priority queue mein hai aur humne agents ko bata diya hai ke aap intezar kar rahe hain. ${notice} Agar aap intezar ke dauran AI assistant se madad lena chahein to neeche click karein.`,
                ur: `آپ کی گفتگو ہماری سپورٹ ٹیم کی قطار میں ہے اور ہم نے ایجنٹس کو مطلع کر دیا ہے۔ ${notice}`,
              });

          await supabase.from('messages').insert({
            conversation_id: conversation_id,
            sender_type: 'ai',
            sender_id: null,
            content: queueText,
            is_internal: false,
            reply_to_message_id: currentVisitorMsgId,
            metadata: {
              is_queue_update: true,
              is_details_ack: hasRefs ? true : undefined,
              bot_engine: 'built_in',
              // In the handoff queues the database keeps the bot off (the
              // widget's own "Ask AI while you wait" sets ai_assist), so the
              // typed "Resume AI assistant" would go nowhere there.
              quick_replies:
                currentHandoffStatus === 'waiting_for_agent' || currentHandoffStatus === 'offline_queued'
                  ? undefined
                  : [{ label: '🤖 Ask AI Assistant meanwhile', value: 'Resume AI assistant' }],
            },
          });

          notifyTeamByEmailLater({
            workspaceId: workspace_id,
            conversationId: conversation_id,
            event: 'customer_reply',
            preview: visitorMsg.content,
          });
          return json({ replied: true, queue_update: true, reason: 'Sent queue status update while waiting for agent' });
        }
      }

      // A person owns this conversation, so the bot says nothing to the
      // visitor. Asking for a person again still reaches the team.
      if (isAskingForHuman) {
        await notifyTeamOnly({
          supabase,
          conversationId: conversation_id,
          visitorMessageId: currentVisitorMsgId,
          note: '🙋 The visitor asked for a person again. The bot is off on this conversation, so it did not reply.',
        });
      }
      await logAiEvent(supabase, {
        workspaceId: workspace_id,
        conversationId: conversation_id,
        visitorMessageId: currentVisitorMsgId,
        event: 'reply_suppressed',
        reason: botState,
      });
      // Nobody else will answer: tell the person handling it (or whoever is
      // on shift) by email, at most once every few minutes per conversation.
      notifyTeamByEmailLater({
        workspaceId: workspace_id,
        conversationId: conversation_id,
        event: 'customer_reply',
        preview: visitorMsg.content,
      });
      return json({ replied: false, reason: `Bot is not answering this conversation (${botState})` });
    }

    // The person who last handled this exchange, so the bot carries on from
    // what they said instead of starting over or contradicting them.
    const humanContext =
      lastHumanReply && (Date.parse(lastHumanReply.created_at) > resolvedAt || targetAtMs - Date.parse(lastHumanReply.created_at) < 2 * 60 * 60_000)
        ? { lastReply: String(lastHumanReply.content || ''), at: lastHumanReply.created_at as string }
        : null;

    const burstContext = msgs
      .filter((m) => isVisitorLine(m) && m.id !== targetVisitorMsgId && Date.parse(m.created_at) <= Date.parse(visitorMsg.created_at))
      .slice(-3)
      .map((m) => m.content as string)
      .reverse();

    const earlier = msgs
      .filter((m) => isVisitorLine(m) && m.id !== targetVisitorMsgId && !burstContext.includes(m.content as string))
      .map((m) => m.content as string)
      .reverse();

    const history = [...burstContext, ...earlier].slice(0, 4);

    const targetAt = Date.parse(visitorMsg.created_at);
    const turns = msgs
      .filter(
        (m) =>
          m.id !== targetVisitorMsgId &&
          // Only what came before the message being answered.
          Date.parse(m.created_at) <= targetAt &&
          !m.is_internal &&
          // The widget's welcome line is not part of the conversation, and
          // would make every first "hi" look like a returning one.
          !m.metadata?.is_welcome &&
          !m.metadata?.system_event &&
          ['visitor', 'agent', 'ai'].includes(m.sender_type) &&
          typeof m.content === 'string' &&
          m.content.trim()
      )
      .map((m) => ({
        role: (m.sender_type === 'visitor' ? 'user' : 'assistant') as
          | 'user'
          | 'assistant',
        // Marked, so the model does not take a person's words for its own
        // and answer as if it had made their promises.
        content: isHumanLine(m)
          ? `${TEAM_MEMBER_PREFIX}${m.content}`
          : messageWithImage(m.content as string, m.metadata?.image_reading as ImageReading | undefined),
      }));

    // Send the last 6 messages in full; summarize anything older
    const recentTurns = turns.slice(-6);
    let runningSummary: string | null = (conv as any)?.running_summary || null;
    if (!runningSummary && turns.length > 6) {
      const older = turns.slice(0, -6);
      runningSummary = buildRunningSummary(null, older);
      supabase.from('conversations').update({ running_summary: runningSummary }).eq('id', conversation_id).then();
    }

    // Step 4: Check platform AI settings
    const platformConfig = await getPlatformAiConfigServerOnly().catch(() => null);
    console.log('[Auto-Respond Step 4] Platform AI settings check:', {
      isEnabled: platformConfig?.isEnabled,
      provider: platformConfig?.config?.provider,
      baseUrl: platformConfig?.config?.baseUrl,
      model: platformConfig?.model,
      hasKey: Boolean(platformConfig?.config?.apiKey),
    });

    const recentUserMessages = recentTurns.filter((t) => t.role === 'user').map((t) => t.content);
    const [agentRouting, langConfig] = await Promise.all([
      resolveTargetAiAgentWithMatch({
        workspaceId: workspace_id,
        channel: conv.channel || 'web',
        message: visitorMsg.content || '',
        recentUserMessages,
      }).catch((): AgentRoutingResult => ({ agent: null, reason: 'unavailable', score: 0 })),
      getLanguageConfig(workspace_id).catch(() => null),
    ]);
    const activeAiAgent = agentRouting.agent;

    const botName = activeAiAgent?.name || aiSettings?.bot_name || workspace?.greeting_title || 'Support Agent';
    const effectiveSystemPrompt = (() => {
      if (!activeAiAgent) return aiSettings?.system_prompt || null;
      const roleLine = activeAiAgent.role_title ? `\nRole: ${activeAiAgent.role_title}` : '';
      const toneLine = activeAiAgent.tone ? `\nTone: ${activeAiAgent.tone}` : '';
      const actions = activeAiAgent.capabilities?.actions || [];
      const capabilitiesBlock = actions.length
        ? `\n\n# DECLARED CAPABILITIES\n${actions.map((a) => `- ${a}`).join('\n')}`
        : '';
      const specializationLine = activeAiAgent.capabilities?.subAgentId
        ? `\nPrimary Specialization: ${activeAiAgent.capabilities.subAgentId}`
        : '';
      const guardrailsBlock = activeAiAgent.guardrails.length
        ? `\n\n# GUARDRAILS\n${activeAiAgent.guardrails.map((g) => `- ${g}`).join('\n')}`
        : '';
      return (
        `${activeAiAgent.system_prompt || aiSettings?.system_prompt || ''}${roleLine}${toneLine}${specializationLine}${capabilitiesBlock}${guardrailsBlock}`.trim() ||
        null
      );
    })();
    const effectiveAnswerMode = activeAiAgent?.answer_mode || (aiSettings?.answer_mode === 'strict' ? 'strict' : 'agent');
    const effectiveReplyStyle = activeAiAgent?.reply_language_mode || langConfig?.reply_style || 'match_customer';
    const showCitations = activeAiAgent
      ? activeAiAgent.appearance?.showCitations !== false && activeAiAgent.rag_config?.citations !== false
      : true;
    const effectiveConfidenceThreshold =
      activeAiAgent?.escalation_rules?.confidenceThreshold ?? handoffSettings?.ai?.confidence_threshold ?? 0.65;
    const effectiveHandoffOnFrustration = activeAiAgent?.escalation_rules?.handoffOnFrustration ?? true;
    const effectiveHandoffGroupId = activeAiAgent?.escalation_rules?.handoffGroupId ?? null;
    const effectiveCannedGreeting =
      activeAiAgent?.appearance?.welcomeMessage?.trim() || aiSettings?.greeting_message || null;

    console.log('[Auto-Respond Step 5] Generating RAG response:', {
      botName,
      activeAgentId: activeAiAgent?.id ?? null,
      routingReason: agentRouting.reason,
      workspace: workspace?.name,
      incomingLength: visitorMsg.content?.length,
    });

    // A screenshot is read once (vision.ts) and kept on the message, so the
    // team sees the reading in the inbox and a retry does not read it again.
    // The bot then works with the words plus what the image shows.
    let imageReading = (visitorMsg.metadata?.image_reading as ImageReading | undefined) ?? null;
    if (!imageReading && looksLikeImageUrl(visitorMsg.attachment_url)) {
      const read = await readScreenshot({
        url: visitorMsg.attachment_url as string,
        caption: visitorMsg.content as string,
      });
      imageReading = read.reading;
      await logAiEvent(supabase, {
        workspaceId: workspace_id,
        conversationId: conversation_id,
        visitorMessageId: currentVisitorMsgId,
        event: 'image_read',
        reason: read.reason,
        detail: { kind: read.reading?.kind ?? null, latency_ms: read.latencyMs, provider: read.reading?.provider ?? null },
      });
      if (imageReading) {
        const { error: readingErr } = await supabase
          .from('messages')
          .update({ metadata: { ...(visitorMsg.metadata || {}), image_reading: imageReading } })
          .eq('id', currentVisitorMsgId);
        if (readingErr) console.error('[Auto-Respond] Could not keep the screenshot reading:', readingErr.message);
      }
    }

    // 3. Generate the reply, with a fail-safe handover if it takes too long.
    // A reply can take up to three sequential model calls (intent, query
    // rewrite, answer), each with its own shorter timeout and fallback. 15 s
    // was below their sum on slower providers such as DeepSeek, so a busy
    // minute timed most replies out. 35 s still leaves room inside
    // maxDuration for translation and the insert.
    let result: Awaited<ReturnType<typeof generateHelpDeskResponseWithHandover>>;
    // Whether the answer pipeline itself handed over (it could not answer, or
    // the visitor asked for a person), as opposed to a Spec C trigger below
    // flagging a message the pipeline did answer.
    let pipelineHandover = false;
    let handoffExplicit = false;
    let blockedTopicMatched = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`AI response timed out after ${GENERATION_BUDGET_MS / 1000} seconds`)),
          GENERATION_BUDGET_MS
        );
      });

      const convId = conversation_id;
      const visitorText = messageWithImage(visitorMsg.content as string, imageReading);
      const blockedTopics = activeAiAgent?.escalation_rules?.blockedTopics || [];
      const matchedBlockedTopic = blockedTopics.find((t) =>
        t.trim() ? visitorText.toLowerCase().includes(t.trim().toLowerCase()) : false,
      );
      const maxBotTurns = activeAiAgent?.escalation_rules?.maxBotTurns;
      const sessionCutoff = Math.max(resolvedAt, agentExplicitlyResumed ? -Infinity : lastHumanAt);
      const priorBotTurns = msgs.filter(
        (m) =>
          m.sender_type === 'ai' &&
          !m.is_internal &&
          !m.metadata?.is_welcome &&
          !m.metadata?.system_event &&
          Date.parse(m.created_at) <= targetAt &&
          Date.parse(m.created_at) > sessionCutoff,
      ).length;
      const maxTurnsExceeded = typeof maxBotTurns === 'number' && maxBotTurns > 0 && priorBotTurns >= maxBotTurns;

      const builtIn = () =>
        generateHelpDeskResponseWithHandover({
          workspaceId: workspace_id,
          conversationId: convId,
          incomingMessage: visitorText,
          visitorName: (conv.visitor as { name?: string | null } | null)?.name || undefined,
          botName,
          providerConfig: providerConfigFrom(aiSettings),
          systemPrompt: effectiveSystemPrompt,
          history,
          turns: recentTurns,
          helpCenterUrl: helpCenterUrlFor(workspace),
          workspaceName: workspace?.name,
          industry:
            activeAiAgent?.industry ||
            (workspace as { industry?: string | null } | null | undefined)?.industry ||
            'generic',
          hasHumanReplied: lastHumanAt > -Infinity && lastHumanAt > resolvedAt,
          botFailureCount: (conv as any)?.bot_failure_count || 0,
          runningSummary,
          businessHours: workspace?.business_hours || null,
          cannedGreeting: effectiveCannedGreeting,
          humanContext,
          resuming: botState === 'ai_resuming',
          // Agent mode unless the workspace chose the strict path in settings.
          answerMode: effectiveAnswerMode,
          subAgents: aiSettings?.sub_agents ?? null,
          handoffOnFrustration: effectiveHandoffOnFrustration,
          knowledgeScope: activeAiAgent?.knowledge_scope ?? null,
          ragConfig: activeAiAgent?.rag_config
            ? { ...activeAiAgent.rag_config, citations: showCitations }
            : { citations: showCitations },
        });

      if (matchedBlockedTopic && !isAskingForHuman) {
        blockedTopicMatched = true;
        pipelineHandover = true;
        const blockLang = effectiveReplyStyle === 'english_only' ? 'en' : replyLanguageOf(visitorMsg.content || visitorText);
        const notice = getExpectedReplyTimeNotice(blockLang);
        result = {
          replyText: localized(blockLang, {
            en: `Our team handles this topic personally, so I've passed your message to them. ${notice}`,
            roman_ur: `Ye topic hamari team khud dekhti hai, is liye maine aapka message unhe bhej diya hai. ${notice}`,
            ur: `یہ موضوع ہماری ٹیم خود دیکھتی ہے، اس لیے میں نے آپ کا پیغام انہیں بھیج دیا ہے۔ ${notice}`,
          }),
          shouldHandover: true,
          canAnswerFromDocs: false,
          intent: 'out_of_scope',
          intentSource: 'rules',
          disableAi: false,
          handoverReason: `Blocked topic policy matched: ${matchedBlockedTopic}`,
          priority: 'high',
          citation: null,
          citedArticles: [],
          usedArticleIds: [],
          quickReplies: null,
          engine: 'built_in',
        };
      } else if (maxTurnsExceeded && !isAskingForHuman) {
        pipelineHandover = true;
        const turnLang = effectiveReplyStyle === 'english_only' ? 'en' : replyLanguageOf(visitorMsg.content || visitorText);
        const notice = getExpectedReplyTimeNotice(turnLang);
        result = {
          replyText: localized(turnLang, {
            en: `Let me connect you directly with a member of our team to help you further. ${notice}`,
            roman_ur: `Aapki behtar madad ke liye main aapko abhi hamari team ke member se connect karta hoon. ${notice}`,
            ur: `آپ کی بہتر مدد کے لیے میں آپ کو ابھی ہماری ٹیم کے رکن سے منسلک کرتا ہوں۔ ${notice}`,
          }),
          shouldHandover: true,
          canAnswerFromDocs: false,
          intent: 'out_of_scope',
          intentSource: 'rules',
          disableAi: false,
          handoverReason: `Max bot turns reached (${maxBotTurns})`,
          priority: 'high',
          citation: null,
          citedArticles: [],
          usedArticleIds: [],
          quickReplies: null,
          engine: 'built_in',
        };
      } else {
        // Run configured multi-agent engine (LangGraph / Google ADK / Hybrid Auto-Router)
        // or external webhook before falling back to the built-in deterministic pipeline.
        // Customer requests for a human always follow the built-in handover path cleanly.
        const pausedHolder: {
          current: { payload: PendingApprovalPayload; engine: EngineUsed } | null;
        } = { current: null };
        const generate = async () => {
          if (!isAskingForHuman) {
            const external = await answerWithExternalAgent({
              workspaceId: workspace_id,
              conversationId: convId,
              incomingMessage: visitorText,
              channel: conv.channel || 'web',
              visitorName: (conv.visitor as { name?: string | null } | null)?.name || null,
              turns: [...recentTurns, { role: 'user' as const, content: visitorText }],
              humanContext,
              workspaceSystemPrompt: effectiveSystemPrompt || aiSettings?.system_prompt || null,
              workflowKey: activeAiAgent?.engine_config?.workflowKey ?? null,
              perAgentWebhookUrl: activeAiAgent?.engine_config?.externalWebhookUrl ?? null,
              knowledgeScope: activeAiAgent?.knowledge_scope ?? null,
              ragConfig: activeAiAgent?.rag_config ?? null,
            });
            if (external) return external;

            if (
              activeAiAgent &&
              (activeAiAgent.engine_type === 'langgraph' ||
                activeAiAgent.engine_type === 'adk' ||
                activeAiAgent.engine_type === 'hybrid')
            ) {
              const visitorObj = conv.visitor as { name?: string | null; email?: string | null } | null;
              const routed = await executeAgentWithRouter(
                {
                  workspaceId: workspace_id,
                  workspaceName: workspace?.name || 'Workspace',
                  conversationId: convId,
                  visitorMessageId: targetVisitorMsgId,
                  visitorId: conv.visitor_id ?? null,
                  visitorName: visitorObj?.name ?? null,
                  visitorEmail: visitorObj?.email ?? null,
                  channel: conv.channel || 'web',
                  helpCenterUrl: helpCenterUrlFor(workspace),
                  message: visitorText,
                  history: recentTurns,
                  humanContext: humanContext ? `${humanContext.lastReply} (${humanContext.at})` : null,
                  providerConfig: providerConfigFrom(aiSettings),
                  agent: {
                    id: activeAiAgent.id,
                    name: botName,
                    industry:
                      activeAiAgent.industry ||
                      (workspace as { industry?: string | null } | null | undefined)?.industry ||
                      'generic',
                    tone: activeAiAgent.tone ?? null,
                    systemPrompt: effectiveSystemPrompt,
                    guardrails: activeAiAgent.guardrails,
                    escalationRules: activeAiAgent.escalation_rules,
                    knowledgeScope: activeAiAgent.knowledge_scope,
                    answerMode: effectiveAnswerMode,
                    replyLanguageMode: effectiveReplyStyle,
                    ragConfig: activeAiAgent.rag_config
                      ? { ...activeAiAgent.rag_config, citations: showCitations }
                      : { citations: showCitations },
                    engineType: activeAiAgent.engine_type,
                    engineConfig: activeAiAgent.engine_config,
                    modelConfig: activeAiAgent.model_config,
                    handoffGroupId: effectiveHandoffGroupId,
                  },
                },
                { timeoutMs: 18_000 },
              ).catch((err) => {
                console.warn('[Auto-Respond] Agent router failed, falling back to built-in:', err);
                return null;
              });

              if (routed?.result) {
                const engineRes = routed.result;
                if (engineRes.action === 'awaiting_approval' && engineRes.pendingApproval) {
                  pausedHolder.current = {
                    payload: engineRes.pendingApproval,
                    engine: engineRes.engineUsed,
                  };
                }
                const mappedEngine: 'built_in' | 'langgraph' | 'adk' =
                  engineRes.engineUsed === 'adk'
                    ? 'adk'
                    : engineRes.engineUsed === 'langgraph'
                      ? 'langgraph'
                      : 'built_in';
                return {
                  replyText: engineRes.replyText,
                  shouldHandover: engineRes.shouldHandover,
                  handoverReason: engineRes.handoverReason ?? undefined,
                  canAnswerFromDocs: engineRes.canAnswerFromDocs,
                  intent: engineRes.intent as VisitorIntent,
                  intentSource: 'rules' as const,
                  disableAi: false,
                  priority: 'high' as const,
                  citation: null,
                  citedArticles: engineRes.citedArticles,
                  usedArticleIds: engineRes.usedArticleIds,
                  retrievalConfidence: engineRes.retrievalConfidence,
                  quickReplies: null,
                  engine: mappedEngine,
                };
              }
            }
          }
          return builtIn();
        };

        result = await Promise.race([generate(), timeoutPromise]);
        if (pausedHolder.current) {
          const paused: PendingApprovalPayload = pausedHolder.current.payload;
          const engineBadge = pausedHolder.current.engine === 'adk' ? 'ADK' : 'LangGraph';
          const actionsSummary = paused.pendingActions.length
            ? `\n\nStaged CRM/workflow actions:\n${paused.pendingActions.map((a) => `• ${a.summary}`).join('\n')}`
            : '';
          await saveInternalDraftNote({
            supabase,
            conversationId: conversation_id,
            visitorMessageId: targetVisitorMsgId,
            content: `⏸️ ${engineBadge} workflow paused (${paused.topic} · Level ${paused.autonomyLevel}): ${paused.reason}\n\nProposed reply:\n${paused.draftReply}${actionsSummary}`,
            metadata: {
              answered_message_id: targetVisitorMsgId,
              handover_for_message_id: targetVisitorMsgId,
              is_copilot_suggestion: true,
              autonomy_level: paused.autonomyLevel,
              autonomy_topic: paused.topic,
              agent_id: activeAiAgent?.id ?? null,
              agent_name: botName,
              draft_reply: paused.draftReply,
              langgraph_approval: {
                runId: paused.runId,
                threadId: paused.threadId,
                agentId: paused.agentId,
                agentName: paused.agentName,
                topic: paused.topic,
                autonomyLevel: paused.autonomyLevel,
                reason: paused.reason,
                draftReply: paused.draftReply,
                pendingActions: paused.pendingActions,
                status: 'pending',
              },
            },
          });
          if (handoffModeOn && (currentHandoffStatus === 'bot_active' || currentHandoffStatus === 'handoff_offered')) {
            try {
              await supabase.rpc('request_handoff', {
                p_conversation_id: conversation_id,
                p_reason: `langgraph_approval: ${paused.topic}`,
                p_summary: paused.draftReply.slice(0, 280),
              });
            } catch {
              // Non-fatal handoff queue
            }
          }
          notifyTeamByEmailLater({
            workspaceId: workspace_id,
            conversationId: conversation_id,
            event: 'customer_reply',
            preview: visitorMsg.content,
          });
          await logAiEvent(supabase, {
            workspaceId: workspace_id,
            conversationId: conversation_id,
            visitorMessageId: targetVisitorMsgId,
            event: 'reply_suppressed',
            reason: `langgraph_paused_approval:${paused.topic}`,
            detail: {
              agent_id: activeAiAgent?.id ?? null,
              agent_name: botName,
              thread_id: paused.threadId,
              run_id: paused.runId,
              pending_actions: paused.pendingActions.length,
            },
          }).catch(() => {});
          await createWorkspaceNotification({
            workspaceId: workspace_id,
            recipientAgentId: (conv as { assigned_agent_id?: string | null }).assigned_agent_id ?? null,
            kind: 'ai_approval',
            title: `${botName} paused for approval (${paused.topic})`,
            body: paused.reason || paused.draftReply,
            href: `/app/inbox?c=${encodeURIComponent(conversation_id)}`,
            client: supabase,
          });
          return json({
            replied: false,
            paused_for_approval: true,
            thread_id: paused.threadId,
            run_id: paused.runId,
            topic: paused.topic,
          });
        }
        pipelineHandover = Boolean(result.shouldHandover);
      }

      // Spec C triggers the pipeline does not look for (keywords, repeated
      // questions, anger, refunds and other sensitive topics). They only ever
      // lead to an offer the visitor can decline, never a forced handover, so
      // they run only with the handoff system on, and respect the cooldown
      // after an ignored offer unless the visitor asked in words.
      if (handoffModeOn && !pipelineHandover && (currentHandoffStatus === 'bot_active' || currentHandoffStatus === 'handoff_offered')) {
        const handoffEval = evaluateHandoffTrigger({
          incomingMessage: visitorText,
          turns: recentTurns,
          aiConfidence: retrievalConfidenceScore(result.retrievalConfidence),
          confidenceThreshold: effectiveConfidenceThreshold,
          handoffOnFrustration: effectiveHandoffOnFrustration,
          cooldownMessageCount: handoffSettings?.ai?.cooldown_message_count ?? 5,
          customKeywords: handoffSettings?.ai?.keywords,
        });
        const cooldown = Number(handoffSettings?.ai?.cooldown_message_count ?? 5);
        const visitorLines = msgs.filter(isVisitorLine).length;
        const inCooldown =
          Number(handoffRow.handoff_offer_count || 0) > 0 &&
          visitorLines - Number(handoffRow.handoff_last_offer_msg_count || 0) < cooldown;
        if (handoffEval.needsHandoff && (handoffEval.isExplicit || !inCooldown)) {
          result.shouldHandover = true;
          result.handoverReason = handoffEval.triggerReason || 'needs_human';
          handoffExplicit = handoffEval.isExplicit;
          if (!result.internalNote && handoffEval.summary) {
            result.internalNote = handoffEval.summary;
          }
        }
      }
    } catch (timeoutErr: any) {
      console.warn('[Auto-Respond] Timeout or error during AI generation:', timeoutErr?.message);
      // Seamless fail-safe handover to human: never show error to customer!
      await executeHandoverToHuman({
        supabase,
        conversationId: conversation_id,
        workspaceId: workspace_id,
        visitorMessageId: targetVisitorMsgId,
        reason: 'AI generation timed out or encountered an error. Gracefully handed over.',
        channel: conv.channel || 'web',
        // A slow or failing provider is not the visitor's choice: the
        // assistant stays on so their next message still gets an answer.
        // Switching it off here silenced the bot for the whole conversation.
        disableAi: false,
        priority: 'high',
        internalNote: `🤖 [AI Timeout/Failover]: Bot response took too long or failed (${timeoutErr?.message || 'timeout'}). Handed to a human agent so the visitor was not kept waiting.`,
        controlVersion,
        handoffGroupId: effectiveHandoffGroupId,
      });
      await logAiEvent(supabase, {
        workspaceId: workspace_id,
        conversationId: conversation_id,
        visitorMessageId: targetVisitorMsgId,
        event: 'provider_error',
        reason: String(timeoutErr?.message || 'timeout').slice(0, 200),
      });
      return json({ replied: true, handed_over: true, reason: 'Handed over due to timeout or failover' });
    } finally {
      clearTimeout(timer);
    }

    console.log('[Auto-Respond Step 5 Result]', {
      ok: Boolean(result.replyText),
      replyLength: result.replyText?.length,
      shouldHandover: result.shouldHandover,
      canAnswerFromDocs: result.canAnswerFromDocs,
      intent: result.intent,
      citedCount: result.citedArticles?.length || (result.citation ? 1 : 0),
    });

    let aiResponseText = result.replyText;
    if (!aiResponseText || !aiResponseText.trim()) {
      return skip('empty_reply', 'Empty auto-response generated', targetVisitorMsgId);
    }

    // 3b. ATOMIC DOUBLE-CHECK: Re-query messages to guarantee no agent or AI replied during RAG generation
    const { data: lateReplies } = await supabase
      .from('messages')
      .select('id, sender_type, is_internal, reply_to_message_id, metadata, created_at')
      .eq('conversation_id', conversation_id)
      .or(`reply_to_message_id.eq.${targetVisitorMsgId},metadata->>answered_message_id.eq.${targetVisitorMsgId},metadata->>handover_for_message_id.eq.${targetVisitorMsgId}`)
      .limit(5);

    if (lateReplies && lateReplies.length > 0) {
      return skip('answered_during_generation', 'Already responded for this visitor message during generation', targetVisitorMsgId);
    }

    const { data: humanReplies } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversation_id)
      .eq('is_internal', false)
      .eq('sender_type', 'agent')
      .not('sender_id', 'is', null)
      .gt('created_at', visitorMsg.created_at)
      .limit(1);

    if (humanReplies && humanReplies.length > 0) {
      return skip('human_replied_during_generation', 'A person replied during generation', targetVisitorMsgId);
    }

    // Check if conversation was closed during generation
    const { data: freshConv } = await supabase
      .from('conversations')
      .select('status')
      .eq('id', conversation_id)
      .single();

    if (freshConv && freshConv.status === 'closed') {
      return skip('closed_during_generation', 'Conversation was closed during generation', targetVisitorMsgId);
    }

    // The reply must be in the language of the visitor's latest message. The
    // model is told so, but the documentation it quotes is usually English,
    // and the no-provider fallback answers straight from that documentation —
    // so check, and translate when the reply came out in the wrong language.
    const visitorText = (visitorMsg.content || '').trim();
    const visitorLang = await visitorLanguageOf(visitorText);
    // The citation line ("Source: [Title](url)") is added by code. Sent
    // through a translator it comes back as a broken link, and it skews
    // language detection, so only the answer above it is translated.
    const citationLine = aiResponseText.match(CITATION_LINE)?.[0] ?? '';
    let replyBody = citationLine ? aiResponseText.slice(0, -citationLine.length) : aiResponseText;
    let englishBody = replyBody;
    const replyLang =
      replyLanguageOf(replyBody) === 'roman_ur' ? 'ur' : isLikelyEnglishText(replyBody) ? 'en' : detectLanguage(replyBody).code;
    const providerConfig = providerConfigFrom(aiSettings);

    if (effectiveReplyStyle === 'english_only') {
      if (replyLang !== 'en') {
        try {
          const t = await translateToEnglish({ text: replyBody, providerConfig });
          if (t.englishText?.trim()) {
            replyBody = t.englishText.trim();
            englishBody = replyBody;
          }
        } catch (err) {
          console.warn('[Auto-Respond] English-only translation failed, sending as written:', err);
        }
      } else {
        replyBody = englishBody;
      }
    } else if (visitorLang.code !== 'en' && replyLang === 'en') {
      try {
        const wantRoman = effectiveReplyStyle === 'native_script' ? false : visitorLang.roman;
        const t = await translateAgentReply({
          text: replyBody,
          targetLanguageCode: visitorLang.code,
          sourceLanguageCode: 'en',
          providerConfig,
          businessName: workspace?.name,
          romanize: wantRoman,
        });
        const translated = t.translatedText?.trim();
        // A visitor writing Roman Urdu asked for Latin letters; a translator
        // that falls back to Urdu script gives them text in a script they did
        // not write in. The untranslated reply reads better than that.
        const wrongScript = wantRoman && translated && /[؀-ۿऀ-ॿ]/.test(translated);
        if (translated && !wrongScript) replyBody = translated;
        else if (wrongScript) console.warn('[Auto-Respond] Translation came back in the wrong script; sending the reply as written.');
      } catch (err) {
        console.warn('[Auto-Respond] Reply translation failed, sending as written:', err);
      }
    } else if (visitorLang.code === 'en' && replyLang !== 'en') {
      try {
        const t = await translateToEnglish({ text: replyBody, providerConfig });
        if (t.englishText?.trim()) replyBody = t.englishText.trim();
        englishBody = replyBody;
      } catch (err) {
        console.warn('[Auto-Respond] Reply translation to English failed:', err);
      }
    } else if (visitorLang.code !== 'en') {
      // Already in the visitor's language: keep an English copy for agents.
      // Only agents read it, so the free translator does; a model call here
      // was spent on every non-English reply.
      try {
        const g = await translateWithGoogleGtx(replyBody, 'en', 'auto');
        if (g?.translated?.trim()) englishBody = g.translated.trim();
      } catch (err) {
        console.warn('[Auto-Respond] English copy of the reply failed:', err);
      }
    }
    const citedArticleIds = result.usedArticleIds || (result.citation?.id ? [result.citation.id] : []);
    const citedArticles = result.citedArticles || (result.citation ? [{ id: result.citation.id, title: result.citation.title }] : []);
    const detected = { code: visitorLang.code, name: getLanguageInfo(visitorLang.code).name };
    const numericConfidence = numericConfidenceFromRetrieval(result.retrievalConfidence);
    const rawEnglishDraft = `${englishBody}${showCitations ? citationLine : ''}`;

    // Trust Ladder & pre-delivery claim verification (Part 3 enforcement):
    // 1. Resolve canonical/custom topic against ai_autonomy_policies & cited Help sections
    // 2. Run pre-delivery claim verification BEFORE sending to catch unsupported figures/policies
    // 3. Enforce Locked, Level 1 Shadow, Level 2 Suggest, Level 3 Supervised, Level 4 Autonomous
    const [agentPolicies, citedSectionNames] = activeAiAgent?.id
      ? await Promise.all([
          getAutonomyPoliciesForAgent(workspace_id, activeAiAgent.id).catch(() => []),
          getArticleSectionNames(workspace_id, citedArticleIds).catch(() => []),
        ])
      : [[], []];
    const autonomyDecision: AutonomyDecision = resolveAutonomyDecision({
      policies: agentPolicies,
      message: visitorText,
      subAgent: result.subAgent ?? null,
      citedSectionNames,
      defaultLevelWhenUnconfigured: 4,
    });

    let preVerif: ClaimVerificationResult | null = null;
    let claimCheckFailed = false;
    let escalationOverride: 'verification_blocked' | 'autonomy_locked' | null = null;

    if (!pipelineHandover && result.intent !== 'wants_human') {
      preVerif = await runTimedClaimCheck(workspace_id, englishBody, citedArticles[0]?.title ?? null, {
        languageCode: detected.code,
        customerQuestion: visitorText,
      });
      claimCheckFailed = preVerif?.verdict === 'needs_review';
      const guardLang = effectiveReplyStyle === 'english_only' ? 'en' : replyLanguageOf(visitorMsg.content || visitorText);

      if (claimCheckFailed) {
        const failedDetail = preVerif?.unsupportedClaims?.length
          ? ` Unsupported claim(s): ${preVerif.unsupportedClaims.slice(0, 2).join('; ')}`
          : '';
        await saveInternalDraftNote({
          supabase,
          conversationId: conversation_id,
          visitorMessageId: targetVisitorMsgId,
          content: `🛡️ Verification blocked ungrounded AI reply (${autonomyDecision.topic}).${failedDetail}\n\nBlocked draft:\n${replyBody}`,
          metadata: {
            answered_message_id: targetVisitorMsgId,
            handover_for_message_id: targetVisitorMsgId,
            is_shadow_draft: true,
            verification_blocked: true,
            autonomy_level: autonomyDecision.level,
            autonomy_topic: autonomyDecision.topic,
            autonomy_mode: autonomyDecision.mode,
            agent_id: activeAiAgent?.id ?? null,
            draft_reply: replyBody,
            english_translation: rawEnglishDraft,
            verification: preVerif,
          },
        });
        replyBody = localized(guardLang, {
          en: "I want to make sure you get completely accurate details on this, so I'm connecting you with a member of our team.",
          roman_ur: 'Main aapko bilkul sahi maloomat dena chahta hoon, is liye main aapko hamari team ke member se connect kar raha hoon.',
          ur: 'میں چاہتا ہوں کہ آپ کو اس بارے میں بالکل درست معلومات ملیں، اس لیے میں آپ کو ہماری ٹیم کے رکن سے منسلک کر رہا ہوں۔',
        });
        englishBody =
          "I want to make sure you get completely accurate details on this, so I'm connecting you with a member of our team.";
        result.shouldHandover = true;
        pipelineHandover = true;
        escalationOverride = 'verification_blocked';
        result.handoverReason = `Pre-delivery claim verification flagged unsupported details${
          preVerif?.unsupportedClaims?.[0] ? `: ${preVerif.unsupportedClaims[0].slice(0, 120)}` : ''
        }`;
      } else if (autonomyDecision.mode === 'human_only') {
        await saveInternalDraftNote({
          supabase,
          conversationId: conversation_id,
          visitorMessageId: targetVisitorMsgId,
          content: `🔒 Trust Ladder locked topic "${autonomyDecision.topic}" (${
            autonomyDecision.lockReason || 'Human only'
          }). Draft withheld from visitor:\n\n${replyBody}`,
          metadata: {
            answered_message_id: targetVisitorMsgId,
            handover_for_message_id: targetVisitorMsgId,
            is_shadow_draft: true,
            autonomy_locked: true,
            autonomy_level: autonomyDecision.level,
            autonomy_topic: autonomyDecision.topic,
            autonomy_mode: autonomyDecision.mode,
            lock_reason: autonomyDecision.lockReason,
            agent_id: activeAiAgent?.id ?? null,
            draft_reply: replyBody,
            english_translation: rawEnglishDraft,
            verification: preVerif,
          },
        });
        replyBody = localized(guardLang, {
          en: "Our team handles this topic personally so you get the right assistance. Let me connect you with a specialist.",
          roman_ur: 'Ye topic hamari team khud handle karti hai taake aapko sahi madad mil sake. Main aapko specialist se connect karta hoon.',
          ur: 'یہ موضوع ہماری ٹیم خود دیکھتی ہے تاکہ آپ کو صحیح مدد مل سکے۔ میں آپ کو ماہر سے منسلک کرتا ہوں۔',
        });
        englishBody =
          'Our team handles this topic personally so you get the right assistance. Let me connect you with a specialist.';
        result.shouldHandover = true;
        pipelineHandover = true;
        blockedTopicMatched = true;
        escalationOverride = 'autonomy_locked';
        result.handoverReason =
          autonomyDecision.lockReason || `Autonomy policy locked for topic: ${autonomyDecision.topic}`;
      } else if (autonomyDecision.mode === 'shadow' || autonomyDecision.mode === 'suggest') {
        const mode = autonomyDecision.mode;
        const draftCitation = showCitations ? citationLine : '';
        const draftForTeam = `${replyBody}${draftCitation}`;
        const draftEnglish = `${englishBody}${draftCitation}`;
        const header =
          mode === 'shadow'
            ? `👁️ Shadow draft (Level 1 — ${autonomyDecision.topic}): Not sent to visitor.`
            : `💡 Suggested reply ready in Copilot (Level 2 — ${autonomyDecision.topic}): Review & approve before sending.`;

        await saveInternalDraftNote({
          supabase,
          conversationId: conversation_id,
          visitorMessageId: targetVisitorMsgId,
          content: `${header}\n\n${draftForTeam}`,
          metadata: {
            answered_message_id: targetVisitorMsgId,
            handover_for_message_id: targetVisitorMsgId,
            is_shadow_draft: mode === 'shadow',
            is_copilot_suggestion: mode === 'suggest',
            autonomy_level: autonomyDecision.level,
            autonomy_topic: autonomyDecision.topic,
            autonomy_mode: mode,
            agent_id: activeAiAgent?.id ?? null,
            agent_name: botName,
            draft_reply: draftForTeam,
            suggested_draft: draftForTeam,
            english_translation: draftEnglish,
            cited_articles: citedArticles,
            cited_article_ids: citedArticleIds,
            verification: preVerif
              ? {
                  verdict: preVerif.verdict,
                  confidence: preVerif.confidence,
                  method: preVerif.method,
                  claims: preVerif.claims,
                }
              : null,
          },
        });

        try {
          await supabase
            .from('conversations')
            .update({ priority: 'high', updated_at: new Date().toISOString() })
            .eq('id', conversation_id);
        } catch {
          // Non-fatal priority bump
        }

        if (handoffModeOn && (currentHandoffStatus === 'bot_active' || currentHandoffStatus === 'handoff_offered')) {
          try {
            await supabase.rpc('request_handoff', {
              p_conversation_id: conversation_id,
              p_reason: `autonomy_${mode}: ${autonomyDecision.topic}`,
              p_summary: rawEnglishDraft.slice(0, 280),
            });
            if (effectiveHandoffGroupId && !conv.assigned_agent_id) {
              const preferredAgent = await pickPreferredGroupAgent(supabase, workspace_id, effectiveHandoffGroupId);
              if (preferredAgent) {
                await supabase
                  .from('conversations')
                  .update({ assigned_agent_id: preferredAgent.id })
                  .eq('id', conversation_id);
              }
            }
          } catch {
            // Non-fatal handoff queue
          }
        }

        notifyTeamByEmailLater({
          workspaceId: workspace_id,
          conversationId: conversation_id,
          event: 'customer_reply',
          preview: visitorMsg.content,
        });

        await logAiEvent(supabase, {
          workspaceId: workspace_id,
          conversationId: conversation_id,
          visitorMessageId: targetVisitorMsgId,
          event: 'reply_suppressed',
          reason: `autonomy_${mode}`,
          detail: {
            agent_id: activeAiAgent?.id ?? null,
            agent_name: botName,
            topic: autonomyDecision.topic,
            autonomy_level: autonomyDecision.level,
            cited_count: citedArticles.length,
          },
        }).catch(() => {});

        await recordAiVerificationLog({
          workspaceId: workspace_id,
          agentId: activeAiAgent?.id ?? null,
          agentName: botName,
          conversationId: conversation_id,
          messageId: null,
          channel: conv.channel || 'web',
          topic: autonomyDecision.topic,
          customerQuestion: visitorText,
          draftReply: draftEnglish,
          finalReply: null,
          verdict: 'blocked_human',
          claims: preVerif?.claims ?? [],
          outcomeNote:
            mode === 'shadow'
              ? `Shadow mode (Level 1 — ${autonomyDecision.topic}): silent draft saved for review`
              : `Suggest mode (Level 2 — ${autonomyDecision.topic}): Copilot pre-draft saved for approval`,
          confidence: preVerif?.confidence ?? numericConfidence,
          metadata: {
            detected_language: detected.code,
            bot_intent: result.intent ?? null,
            autonomy_level: autonomyDecision.level,
            autonomy_mode: mode,
            verification_method: preVerif?.method ?? null,
          },
        }).catch(() => {});

        if (mode === 'suggest') {
          await createWorkspaceNotification({
            workspaceId: workspace_id,
            recipientAgentId: (conv as { assigned_agent_id?: string | null }).assigned_agent_id ?? null,
            kind: 'ai_approval',
            title: `${botName} drafted reply for approval (${autonomyDecision.topic})`,
            body: rawEnglishDraft,
            href: `/app/inbox?c=${encodeURIComponent(conversation_id)}`,
            client: supabase,
          });
        }

        return json({
          replied: false,
          reason: `autonomy_${mode}`,
          topic: autonomyDecision.topic,
          autonomy_level: autonomyDecision.level,
          shadow_draft_saved: mode === 'shadow',
          draft_suggested: mode === 'suggest',
        });
      }
    }

    // What follows this reply when someone should take over:
    //   offer   - the bot says it will connect them and shows [Connect to
    //             agent] (or "1" / "agent" on channels without buttons); the
    //             visitor's click is what queues them (Spec A.2), also when
    //             they asked for a person in words;
    //   request - the workspace turned confirmation off: queue them now
    //             (request_handoff);
    //   queued  - already in the offline queue, talking to AI assist: nothing
    //             more to do, the team has it;
    //   legacy  - the handoff system is off: the older direct handover.
    const requireConfirmation = activeAiAgent
      ? activeAiAgent.escalation_rules.requireConfirmation
      : handoffSettings?.ai?.require_confirmation !== false;
    const handoffAction: 'none' | 'offer' | 'request' | 'queued' | 'legacy' = !result.shouldHandover
      ? 'none'
      : !handoffModeOn
      ? 'legacy'
      : currentHandoffStatus === 'offline_queued'
      ? 'queued'
      : currentHandoffStatus !== 'bot_active' && currentHandoffStatus !== 'handoff_offered'
      ? 'legacy'
      : !requireConfirmation
      ? 'request'
      : 'offer';
    const askedForPerson = result.intent === 'wants_human';

    let effectiveCitation = escalationOverride ? '' : citationLine;
    if (handoffAction === 'offer') {
      const offerLang = effectiveReplyStyle === 'english_only' ? 'en' : replyLanguageOf(visitorMsg.content);
      const onChannel = Boolean(conv.channel && conv.channel !== 'web');
      const channelHint = onChannel
        ? localized(offerLang, {
            en: "\n\nReply '1' or 'AGENT' to speak with our team.",
            roman_ur: "\n\nHamari team se baat karne ke liye '1' ya 'AGENT' likhein.",
            ur: "\n\nہماری ٹیم سے بات کرنے کے لیے '1' یا 'AGENT' لکھیں۔",
          })
        : '';
      if (askedForPerson) {
        // Spec C.7: "I'll connect you with our team" + [Connect to agent].
        const offerText = onChannel
          ? localized(offerLang, {
              en: "Sure, I'll connect you with our team.",
              roman_ur: 'Zaroor, main aapko hamari team se connect karta hoon.',
              ur: 'ضرور، میں آپ کو ہماری ٹیم سے منسلک کرتا ہوں۔',
            })
          : localized(offerLang, {
              en: "Sure, I'll connect you with our team. Tap **Connect to agent** below and the next available person will join.",
              roman_ur: 'Zaroor, main aapko hamari team se connect karta hoon. Neeche **Connect to agent** dabayein, jo bhi available hoga woh join karega.',
              ur: 'ضرور، میں آپ کو ہماری ٹیم سے منسلک کرتا ہوں۔ نیچے **Connect to agent** دبائیں، جو بھی دستیاب ہوگا وہ شامل ہوگا۔',
            });
        replyBody = `${offerText}${channelHint}`;
        englishBody = "Sure, I'll connect you with our team.";
        effectiveCitation = '';
      } else if (escalationOverride === 'verification_blocked') {
        replyBody = `${replyBody}${channelHint}`;
        effectiveCitation = '';
      } else if (blockedTopicMatched) {
        const offerText = localized(offerLang, {
          en: "Our team handles this topic personally. Would you like me to connect you with a specialist now?",
          roman_ur: 'Ye topic hamari team khud dekhti hai. Kya main aapko abhi specialist se connect kar doon?',
          ur: 'یہ موضوع ہماری ٹیم خود دیکھتی ہے۔ کیا میں آپ کو ابھی کسی ماہر سے منسلک کر دوں؟',
        });
        replyBody = `${offerText}${channelHint}`;
        englishBody = "Our team handles this topic personally. Would you like me to connect you with a specialist now?";
        effectiveCitation = '';
      } else if (pipelineHandover) {
        // The pipeline's text announces a handover that has not happened
        // yet; the visitor decides, so ask instead.
        const offerText = localized(offerLang, {
          en: "I couldn't find a reliable answer to that in our help center. Would you like me to connect you with our team?",
          roman_ur: 'Mujhe iska pakka jawab hamare help center mein nahi mila. Kya main aapko hamari team se connect kar doon?',
          ur: 'مجھے اس کا پکا جواب ہمارے ہیلپ سینٹر میں نہیں ملا۔ کیا میں آپ کو ہماری ٹیم سے منسلک کر دوں؟',
        });
        replyBody = `${offerText}${channelHint}`;
        englishBody = "I couldn't find a reliable answer to that in our help center. Would you like me to connect you with our team?";
        effectiveCitation = '';
      } else {
        // The bot answered; the offer rides along with the answer.
        const offerLine = localized(offerLang, {
          en: "\n\nIf you'd rather talk to a person, I can connect you with our team.",
          roman_ur: '\n\nAgar aap kisi insaan se baat karna chahein to main aapko hamari team se connect kar sakta hoon.',
          ur: '\n\nاگر آپ کسی انسان سے بات کرنا چاہیں تو میں آپ کو ہماری ٹیم سے منسلک کر سکتا ہوں۔',
        });
        replyBody = `${replyBody}${offerLine}${channelHint}`;
        englishBody = `${englishBody}\n\nIf you'd rather talk to a person, I can connect you with our team.`;
      }
    }

    let preassignedAgent: { id: string; name: string | null; avatar_url: string | null } | null = null;
    if (handoffAction === 'legacy') {
      try {
        if (conv.assigned_agent_id) {
          const { data: a } = await supabase.from('agents').select('id, name, avatar_url').eq('id', conv.assigned_agent_id).maybeSingle();
          if (a) preassignedAgent = a;
        }
        if (!preassignedAgent) {
          preassignedAgent = await pickPreferredGroupAgent(supabase, workspace_id, effectiveHandoffGroupId);
        }

        // If visitor asked for human and an agent name is available, append professional connecting notice
        // only for non-web channels (WhatsApp, email, social) where rich widget handover cards do not render.
        if (preassignedAgent?.name && result.intent === 'wants_human' && conv.channel && conv.channel !== 'web') {
          const agentName = preassignedAgent.name;
          const connectingNotice =
            effectiveReplyStyle !== 'english_only' && visitorLang.code === 'ur'
              ? visitorLang.roman
                ? `\n\n🔄 Main aapko hamare available support agent **${agentName}** se connect kar raha hoon...`
                : `\n\n🔄 میں آپ کو ہمارے دستیاب سپورٹ ایجنٹ **${agentName}** سے منسلک کر رہا ہوں۔`
              : `\n\n🔄 Connecting you with our available support agent, **${agentName}**...`;
          if (!replyBody.includes(agentName)) {
            replyBody = `${replyBody}${connectingNotice}`;
          }
        }
      } catch (err) {
        console.warn('[Auto-Respond] Pre-assign agent lookup failed:', err);
      }
    }

    const visibleCitation = showCitations ? effectiveCitation : '';
    aiResponseText = `${replyBody}${visibleCitation}`;
    const aiEnglishTranslation = `${englishBody}${visibleCitation}`;

    console.log('[Auto-Respond Step 6] Delivering AI reply:', {
      conversation_id,
      reply_to_message_id: targetVisitorMsgId,
      control_version: controlVersion,
      delivered_language: detected.code,
      cited_articles_count: citedArticles.length,
      show_citations: showCitations,
    });

    const replyMetadata = {
      answered_message_id: targetVisitorMsgId,
      reply_to_message_id: targetVisitorMsgId,
      answered_until: visitorMsg.created_at,
      delivered_language: detected.code,
      delivered_language_name: detected.name,
      english_translation: aiEnglishTranslation,
      bot_intent: result.intent ?? null,
      bot_intent_source: result.intentSource ?? null,
      bot_state: botState,
      bot_engine: result.engine ?? 'built_in',
      agent_id: activeAiAgent?.id ?? null,
      agent_name: botName,
      agent_role_title: activeAiAgent?.role_title ?? null,
      agent_badge_label: activeAiAgent?.appearance?.badgeLabel ?? null,
      agent_routing_reason: agentRouting.reason,
      autonomy_topic: autonomyDecision.topic,
      autonomy_level: autonomyDecision.level,
      autonomy_mode: autonomyDecision.mode,
      verification_verdict: preVerif?.verdict ?? null,
      handoff_group_id: effectiveHandoffGroupId,
      retrieval_confidence: result.retrievalConfidence ?? null,
      cited_article_id: result.citation?.id ?? null,
      cited_article_ids: citedArticleIds,
      cited_articles: citedArticles,
      policy_arm: result.policyArm ?? null,
      // Agent mode's specialist, shown on the reply in the inbox.
      sub_agent: result.subAgent ?? null,
      // Quick reply chips rendered in the widget below the bot bubble.
      // Null means no chips; an empty array is treated the same.
      quick_replies: result.quickReplies?.length ? result.quickReplies : null,
      handover: result.shouldHandover ? true : null,
      assigned_agent_id: preassignedAgent?.id || null,
      assigned_agent_name: preassignedAgent?.name || null,
      assigned_agent_avatar: preassignedAgent?.avatar_url || null,
      system_event: result.shouldHandover
        ? {
            type: 'handover',
            agent_id: preassignedAgent?.id || null,
            agent_name: preassignedAgent?.name || null,
            agent_avatar: preassignedAgent?.avatar_url || null,
          }
        : undefined,
    };

    // 4. Deliver. fn_deliver_ai_reply locks the conversation and refuses the
    // reply if a person answered, the bot was switched off, the conversation
    // was closed or the visitor wrote again while it was being written. Only
    // before the migration has run does the plain insert below happen.
    let insertedMsg: Record<string, unknown> | null = null;
    const delivery = await deliverAiReply(supabase, {
      conversationId: conversation_id,
      visitorMessageId: targetVisitorMsgId,
      expectedVersion: controlVersion,
      content: aiResponseText,
      metadata: replyMetadata,
    });

    if (delivery && !delivery.delivered) {
      console.log('[Auto-Respond] Reply not delivered:', delivery.reason);
      return json({ replied: false, reason: `Reply not delivered: ${delivery.reason}` });
    }

    if (delivery) {
      insertedMsg = delivery.message;
    } else {
      const { data, error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id,
          sender_type: 'ai',
          sender_id: null,
          content: aiResponseText,
          is_internal: false,
          reply_to_message_id: targetVisitorMsgId,
          metadata: replyMetadata,
        })
        .select()
        .single();
      if (msgErr) {
        if ((msgErr as any).code === '23505') {
          return json({ replied: false, reason: 'Already responded for this visitor message' });
        }
        throw msgErr;
      }
      insertedMsg = data;
    }

    incrementWorkspaceUsage(workspace_id, 'ai_replies', 1).catch(() => {});
    // The retrieval policy learns from what happens after this reply
    // (src/lib/ai/learning/policy.ts). Awaited so a serverless function does
    // not stop before it is written; it never throws.
    if (result.policyArm && insertedMsg?.id) {
      await recordPolicyOutcome({
        workspaceId: workspace_id,
        conversationId: conversation_id,
        messageId: String(insertedMsg.id),
        arm: result.policyArm,
        kind: result.shouldHandover && !result.canAnswerFromDocs ? 'handover' : 'answer',
      });
    }
    console.log('[Auto-Respond Step 6 Success] AI reply delivered:', {
      message_id: insertedMsg?.id,
      created_at: insertedMsg?.created_at,
    });

    if (!result.shouldHandover) {
      logAiEvent(supabase, {
        workspaceId: workspace_id,
        conversationId: conversation_id,
        visitorMessageId: targetVisitorMsgId,
        event: 'reply_delivered',
        reason: 'Grounded AI reply delivered',
        detail: {
          agent_id: activeAiAgent?.id ?? null,
          agent_name: botName,
          channel: conv.channel || 'web',
          intent: result.intent ?? null,
          cited_count: citedArticles.length,
        },
      }).catch(() => {});
    }

    const logVerificationTask = async () => {
      try {
        const verif =
          preVerif ??
          (await verifyReplyClaimsAgainstKnowledge(
            workspace_id,
            rawEnglishDraft,
            citedArticles[0]?.title ?? null,
            { languageCode: detected.code, customerQuestion: visitorText },
          ));
        const finalVerdict =
          result.shouldHandover || escalationOverride || autonomyDecision.locked
            ? 'blocked_human'
            : autonomyDecision.queueForSupervisorAudit || verif.verdict === 'needs_review'
              ? 'needs_review'
              : 'supported';
        const outcomeNote =
          escalationOverride === 'verification_blocked'
            ? `Pre-delivery claim check blocked ungrounded reply (${autonomyDecision.topic})`
            : escalationOverride === 'autonomy_locked'
              ? `Locked autonomy policy blocked auto-reply (${autonomyDecision.topic})`
              : result.shouldHandover
                ? `Escalated (${result.handoverReason || 'handoff triggered'})`
                : autonomyDecision.queueForSupervisorAudit
                  ? `Level 3 Supervised (${autonomyDecision.topic}): queued for supervisor audit`
                  : citedArticles.length > 0
                    ? `Verified against ${citedArticles.length} cited source(s)`
                    : 'Grounded reply delivered';
        await recordAiVerificationLog({
          workspaceId: workspace_id,
          agentId: activeAiAgent?.id ?? null,
          agentName: botName,
          conversationId: conversation_id,
          messageId: insertedMsg?.id ? String(insertedMsg.id) : null,
          channel: conv.channel || 'web',
          topic: autonomyDecision.topic,
          customerQuestion: visitorText,
          draftReply: rawEnglishDraft,
          finalReply: aiResponseText,
          verdict: finalVerdict,
          claims: verif.claims,
          outcomeNote,
          confidence: preVerif?.confidence ?? numericConfidence,
          metadata: {
            detected_language: detected.code,
            bot_intent: result.intent ?? null,
            autonomy_level: autonomyDecision.level,
            autonomy_mode: autonomyDecision.mode,
            escalation_override: escalationOverride,
            verification_method: verif.method ?? null,
          },
        });
        if (finalVerdict === 'needs_review') {
          await createWorkspaceNotification({
            workspaceId: workspace_id,
            recipientAgentId: null,
            kind: 'ai_flagged',
            title: `${botName} reply flagged for review`,
            body: outcomeNote,
            href: '/app/ai-quality',
            client: supabase,
          });
        }
      } catch {
        // Non-fatal verification audit write
      }
    };
    try {
      after(() => logVerificationTask());
    } catch {
      logVerificationTask().catch(() => {});
    }

    // 4b. Someone should take over: offer, queue, or the older direct handover
    // (see handoffAction above).
    if (result.shouldHandover) {
      // Narrowed here; closures lose the narrowing.
      const handoffConversationId: string = conversation_id;
      const runLegacyHandover = async () => {
        console.log(`[Auto-Respond] Handing over conversation ${conversation_id} directly to real agent. Reason: ${result.handoverReason}`);
        const handoverResult = await executeHandoverToHuman({
          supabase,
          conversationId: handoffConversationId,
          workspaceId: workspace_id,
          visitorMessageId: targetVisitorMsgId,
          reason: result.handoverReason || 'Inquiry not covered in Help Desk documentation.',
          channel: conv.channel || 'web',
          disableAi: Boolean(result.disableAi),
          pausedReason: result.intent === 'wants_human' ? 'human_requested' : 'needs_attention',
          internalNote: result.internalNote,
          priority: result.priority || 'high',
          // The reply just delivered already tells the visitor what happens next.
          announce: false,
          handoffGroupId: effectiveHandoffGroupId,
        });

        const finalAgent = (handoverResult as any)?.assignedAgent || preassignedAgent;
        if (insertedMsg?.id && finalAgent) {
          const { error: metaErr } = await supabase
            .from('messages')
            .update({
              metadata: {
                ...replyMetadata,
                handover: true,
                assigned_agent_id: finalAgent.id,
                assigned_agent_name: finalAgent.name,
                assigned_agent_avatar: finalAgent.avatar_url,
                system_event: {
                  type: 'handover',
                  agent_id: finalAgent.id,
                  agent_name: finalAgent.name,
                  agent_avatar: finalAgent.avatar_url,
                },
              },
            })
            .eq('id', insertedMsg.id);
          if (metaErr) console.warn('[Auto-Respond] Failed to attach final agent metadata to message:', metaErr.message);
        }
      };

      let handoffOutcome: string = handoffAction;
      if (handoffAction === 'offer') {
        console.log(`[Auto-Respond] Offering handoff for conversation ${conversation_id}. Reason: ${result.handoverReason}`);
        const { data: offerData, error: offerErr } = await supabase.rpc('offer_handoff', {
          p_conversation_id: conversation_id,
          p_reason: askedForPerson ? 'explicit_request' : result.handoverReason || 'needs_human',
          p_summary: result.internalNote || null,
          // A pipeline handover (no answer) is offered even inside the
          // cooldown; only the extra triggers wait (checked above).
          p_explicit: askedForPerson || pipelineHandover || handoffExplicit,
        });
        const offerRes = offerData as HandoffRpcResult | null;
        if (offerErr) {
          // The handoff functions are missing (migration not run) or failed:
          // the visitor was promised help, so fall back to the direct path.
          console.error('[Auto-Respond] offer_handoff failed, using the direct handover:', offerErr.message);
          handoffOutcome = 'legacy_fallback';
          await runLegacyHandover();
        } else if (offerRes?.offered && insertedMsg?.id) {
          const { error: metaErr } = await supabase
            .from('messages')
            .update({
              metadata: {
                ...replyMetadata,
                handoff_offered: true,
                offer_handoff: true,
                handoff_reason: result.handoverReason,
              },
            })
            .eq('id', insertedMsg.id);
          if (metaErr) console.warn('[Auto-Respond] Failed to mark the reply as a handoff offer:', metaErr.message);
        } else if (!offerRes?.offered) {
          handoffOutcome = `offer_${offerRes?.reason || 'refused'}`;
        }
      } else if (handoffAction === 'request') {
        console.log(`[Auto-Respond] Queueing conversation ${conversation_id} for a person. Reason: ${result.handoverReason}`);
        const { data: requestData, error: requestErr } = await supabase.rpc('request_handoff', {
          p_conversation_id: conversation_id,
          p_reason: result.intent === 'wants_human' ? 'explicit_request' : result.handoverReason || 'needs_human',
          p_summary: result.internalNote || null,
        });
        const requestRes = requestData as HandoffRpcResult | null;
        if (requestErr) {
          console.error('[Auto-Respond] request_handoff failed, using the direct handover:', requestErr.message);
          handoffOutcome = 'legacy_fallback';
          await runLegacyHandover();
        } else {
          handoffOutcome = `request_${requestRes?.status || requestRes?.reason || 'unknown'}`;
          let assignedHandoffAgentId: string | null =
            (conv as { assigned_agent_id?: string | null }).assigned_agent_id ?? null;
          if (effectiveHandoffGroupId && !conv.assigned_agent_id) {
            try {
              const preferredAgent = await pickPreferredGroupAgent(supabase, workspace_id, effectiveHandoffGroupId);
              if (preferredAgent) {
                assignedHandoffAgentId = preferredAgent.id;
                await supabase
                  .from('conversations')
                  .update({ assigned_agent_id: preferredAgent.id })
                  .eq('id', conversation_id);
              }
            } catch (groupErr) {
              console.warn('[Auto-Respond] Group pre-assignment after request_handoff failed:', groupErr);
            }
          }
          if (requestRes?.ok !== false && !requestRes?.idempotent) {
            const visitorName = (conv.visitor as { name?: string | null } | null)?.name?.trim() || 'Visitor';
            await createWorkspaceNotification({
              workspaceId: workspace_id,
              recipientAgentId: assignedHandoffAgentId,
              kind: 'handoff',
              title: `AI handoff requested for ${visitorName}`,
              body: result.handoverReason || result.internalNote || visitorText,
              href: `/app/inbox?c=${encodeURIComponent(conversation_id)}`,
              client: supabase,
            });
          }
        }
      } else if (handoffAction === 'legacy') {
        await runLegacyHandover();
      }
      await logAiEvent(supabase, {
        workspaceId: workspace_id,
        conversationId: conversation_id,
        visitorMessageId: targetVisitorMsgId,
        event: 'handover',
        reason: String(result.handoverReason || result.intent || '').slice(0, 200),
        // intent: the learner (src/lib/ai/learning/learner.ts) learns only from
        // help-centre questions the team then answered.
        detail: {
          agent_id: activeAiAgent?.id ?? null,
          agent_routing_reason: agentRouting.reason,
          handoff_group_id: effectiveHandoffGroupId,
          disable_ai: Boolean(result.disableAi),
          priority: result.priority || 'high',
          intent: result.intent ?? null,
          sub_agent: result.subAgent ?? null,
          handoff: handoffOutcome,
        },
      });
    }

    // 5. If channel is multi-channel (WhatsApp, Meta, LinkedIn), dispatch outbound
    if (conv.channel && conv.channel !== 'web') {
      await dispatchOutboundMessage({
        conversationId: conversation_id,
        workspaceId: workspace_id,
        content: aiResponseText,
        channel: conv.channel,
      });
    }

    return json({ replied: true, message: insertedMsg, handed_over: result.shouldHandover });
  } catch (error: any) {
    if (error?.code === '23505') {
      return json({ replied: false, reason: 'Already responded for this visitor message' });
    }
    console.error('Error in AI auto-respond:', error);
    if (eventScope) {
      await logAiEvent(serviceClient(), {
        ...eventScope,
        visitorMessageId: targetVisitorMsgId ?? null,
        event: 'route_error',
        reason: String(error?.message || error).slice(0, 200),
      });
    }
    return json({ error: error.message || 'Auto-respond failed' }, { status: 500 });
  } finally {
    if (lockAcquired && conversation_id) {
      inFlightConversations.delete(conversation_id);
    }
    if (messageLockAcquired && targetVisitorMsgId) {
      inFlightMessages.delete(targetVisitorMsgId);
    }
  }
}
