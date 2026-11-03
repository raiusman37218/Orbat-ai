import { serviceClient } from '@/lib/supabase/service';
import { getWorkspaceEffectivePlan } from '@/lib/plans/enforce';
import { chat, ProviderConfig, ProviderError } from '@/lib/ai/provider';
import { buildModelContext, recordUnanswered } from '@/lib/ai/help-answer';
import { getWorkspaceHelpCenterUrl } from '@/lib/domain';
import {
  CopilotActionType,
  CopilotNextSteps,
  CopilotRewriteMode,
  CopilotSource,
  CopilotSummary,
} from '@/types/database';
import {
  COPILOT_MAX_TOKENS,
  COPILOT_RECENT_MESSAGE_LIMIT,
  CopilotReplyLanguage,
  buildAskCopilotPrompt,
  buildNextStepsPrompt,
  buildRewritePrompt,
  buildSuggestReplyPrompt,
  buildSummaryPrompt,
  describeLanguageDirective,
  formatUntrustedContext,
} from './prompts';

export type CopilotUnavailableReason =
  | 'platform_ai_disabled'
  | 'platform_copilot_disabled'
  | 'plan_inactive'
  | 'copilot_disabled_in_plan'
  | 'workspace_copilot_disabled'
  | 'limit_reached'
  | 'provider_error';

export interface CopilotAvailability {
  available: boolean;
  reason?: CopilotUnavailableReason;
  message?: string;
  requestsUsed: number;
  monthlyLimit: number | null;
  planName: string;
  platformEnabled: boolean;
  planEnabled: boolean;
  workspaceEnabled: boolean;
}

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+|your\s+|previous\s+|prior\s+|above\s+)*instructions/i,
  /disregard\s+(?:all\s+|your\s+|previous\s+|prior\s+)*instructions/i,
  /(?:show|reveal|print|display|output|repeat)\s+(?:me\s+)?(?:your\s+|the\s+)?(?:system\s+prompt|hidden\s+prompt|developer\s+instructions|internal\s+rules)/i,
  /what\s+is\s+your\s+system\s+prompt/i,
];

const FORBIDDEN_OUTPUT_LEAKS = [
  'CRITICAL SECURITY RULES (NEVER VIOLATE)',
  '<untrusted_conversation>',
  '<untrusted_knowledge>',
  'Everything inside <untrusted_conversation>',
];

export function isPromptInjectionAttempt(text: string): boolean {
  const clean = (text || '').trim();
  if (!clean) return false;
  return PROMPT_INJECTION_PATTERNS.some((re) => re.test(clean));
}

export function sanitizeModelOutput(text: string): string {
  const out = (text || '').trim();
  for (const leak of FORBIDDEN_OUTPUT_LEAKS) {
    if (out.includes(leak)) {
      return 'I can only assist with legitimate customer support inquiries for this workspace.';
    }
  }
  return out;
}

function currentPeriodStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .split('T')[0];
}

function estimateTokens(text: string): number {
  const clean = (text || '').trim();
  if (!clean) return 0;
  return Math.max(1, Math.ceil(clean.length / 4));
}

function extractFirstJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const direct = JSON.parse(withoutFence);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return direct as Record<string, unknown>;
    }
  } catch {
    // Try extracting balanced JSON block
  }

  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(withoutFence.slice(start, end + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Loads platform-level AI and Copilot settings on the server.
 * API keys never leave the server.
 */
export async function getPlatformCopilotConfigServerOnly(): Promise<{
  aiEnabled: boolean;
  copilotEnabled: boolean;
  config: ProviderConfig | null;
  model: string | null;
}> {
  const adminClient = serviceClient();
  const { data: settings, error } = await adminClient
    .from('platform_ai_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle();

  if (error || !settings) {
    return { aiEnabled: false, copilotEnabled: false, config: null, model: null };
  }

  const aiEnabled = Boolean(settings.is_enabled && settings.api_key);
  const copilotEnabled = settings.copilot_enabled !== false;

  if (!aiEnabled) {
    return {
      aiEnabled: false,
      copilotEnabled,
      config: null,
      model: settings.model || null,
    };
  }

  const config: ProviderConfig = {
    provider: (settings.provider as ProviderConfig['provider']) || 'anthropic',
    model: settings.model || null,
    apiKey: String(settings.api_key).trim(),
    baseUrl: settings.base_url?.trim() || null,
  };

  return {
    aiEnabled: true,
    copilotEnabled,
    config,
    model: settings.model || null,
  };
}

/**
 * Checks whether Copilot can run for a given workspace right now.
 * Enforces:
 * 1. Super-admin global AI switch & global Copilot switch
 * 2. Active subscription & plan Copilot entitlement
 * 3. Workspace-level Copilot switch
 * 4. Monthly Copilot request quota
 */
export async function checkCopilotAvailability(
  workspaceId: string
): Promise<CopilotAvailability> {
  const adminClient = serviceClient();
  const periodStart = currentPeriodStart();

  const [platform, effective, { data: ws }, { data: usageRow }] = await Promise.all([
    getPlatformCopilotConfigServerOnly(),
    getWorkspaceEffectivePlan(workspaceId),
    adminClient
      .from('workspaces')
      .select('id, name, ai_settings, is_suspended')
      .eq('id', workspaceId)
      .maybeSingle(),
    adminClient
      .from('workspace_ai_usage')
      .select('copilot_requests_used')
      .eq('workspace_id', workspaceId)
      .eq('period_start', periodStart)
      .maybeSingle(),
  ]);

  const plan = effective.plan;
  const planName = plan.name || 'Standard';
  const planEnabled =
    plan.copilot_enabled !== undefined
      ? Boolean(plan.copilot_enabled)
      : effective.effectiveFeatures.copilot !== false;

  const monthlyLimit =
    effective.effectiveLimits.max_copilot_requests_per_month !== undefined
      ? effective.effectiveLimits.max_copilot_requests_per_month
      : plan.copilot_monthly_limit ?? plan.max_copilot_requests_per_month ?? null;

  const requestsUsed =
    typeof (usageRow as { copilot_requests_used?: number } | null)?.copilot_requests_used === 'number'
      ? (usageRow as { copilot_requests_used: number }).copilot_requests_used
      : 0;

  const aiSettings = (ws?.ai_settings || {}) as { copilot_enabled?: boolean; enabled?: boolean };
  const workspaceEnabled = aiSettings.copilot_enabled !== false;
  const platformEnabled = platform.aiEnabled && platform.copilotEnabled;

  if (!platform.aiEnabled) {
    return {
      available: false,
      reason: 'platform_ai_disabled',
      message: 'Platform AI is currently disabled by the platform administrator.',
      requestsUsed,
      monthlyLimit,
      planName,
      platformEnabled: false,
      planEnabled,
      workspaceEnabled,
    };
  }

  if (!platform.copilotEnabled) {
    return {
      available: false,
      reason: 'platform_copilot_disabled',
      message: 'Agent Copilot is currently turned off by the platform administrator.',
      requestsUsed,
      monthlyLimit,
      planName,
      platformEnabled: false,
      planEnabled,
      workspaceEnabled,
    };
  }

  if (
    ws?.is_suspended ||
    effective.status === 'canceled' ||
    effective.status === 'suspended' ||
    effective.isTrialExpired
  ) {
    return {
      available: false,
      reason: 'plan_inactive',
      message: 'Your workspace subscription is inactive or expired. Your inbox remains fully usable.',
      requestsUsed,
      monthlyLimit,
      planName,
      platformEnabled,
      planEnabled,
      workspaceEnabled,
    };
  }

  if (!planEnabled) {
    return {
      available: false,
      reason: 'copilot_disabled_in_plan',
      message: `Agent Copilot is not included in the ${planName} plan. Upgrade your plan to unlock Copilot.`,
      requestsUsed,
      monthlyLimit,
      planName,
      platformEnabled,
      planEnabled: false,
      workspaceEnabled,
    };
  }

  if (!workspaceEnabled) {
    return {
      available: false,
      reason: 'workspace_copilot_disabled',
      message: 'Agent Copilot is turned off in Workspace Settings → AI Bot.',
      requestsUsed,
      monthlyLimit,
      planName,
      platformEnabled,
      planEnabled,
      workspaceEnabled: false,
    };
  }

  if (monthlyLimit !== null && requestsUsed >= monthlyLimit) {
    return {
      available: false,
      reason: 'limit_reached',
      message: `Monthly Copilot limit reached (${requestsUsed.toLocaleString()} / ${monthlyLimit.toLocaleString()} requests on ${planName}). Normal inbox messaging remains unaffected.`,
      requestsUsed,
      monthlyLimit,
      planName,
      platformEnabled,
      planEnabled,
      workspaceEnabled,
    };
  }

  return {
    available: true,
    requestsUsed,
    monthlyLimit,
    planName,
    platformEnabled: true,
    planEnabled: true,
    workspaceEnabled: true,
  };
}

async function incrementCopilotUsageAtomically(
  workspaceId: string,
  tokensIn: number,
  tokensOut: number
): Promise<number> {
  const adminClient = serviceClient();
  const periodStart = currentPeriodStart();

  try {
    const { data, error } = await adminClient.rpc('fn_increment_workspace_copilot_usage', {
      p_workspace_id: workspaceId,
      p_period_start: periodStart,
      p_requests: 1,
      p_tokens_in: tokensIn,
      p_tokens_out: tokensOut,
    });

    if (!error && data && typeof (data as { copilot_requests_used?: number }).copilot_requests_used === 'number') {
      return (data as { copilot_requests_used: number }).copilot_requests_used;
    }
  } catch {
    // Fallback below if migration RPC is not yet present
  }

  const { data: existing } = await adminClient
    .from('workspace_ai_usage')
    .select('replies_used, tokens_in, tokens_out, copilot_requests_used, copilot_tokens_in, copilot_tokens_out')
    .eq('workspace_id', workspaceId)
    .eq('period_start', periodStart)
    .maybeSingle();

  const prevReqs = (existing as { copilot_requests_used?: number } | null)?.copilot_requests_used || 0;
  const prevIn = (existing as { copilot_tokens_in?: number } | null)?.copilot_tokens_in || 0;
  const prevOut = (existing as { copilot_tokens_out?: number } | null)?.copilot_tokens_out || 0;
  const nextReqs = prevReqs + 1;

  await adminClient.from('workspace_ai_usage').upsert(
    {
      workspace_id: workspaceId,
      period_start: periodStart,
      replies_used: existing?.replies_used || 0,
      tokens_in: existing?.tokens_in || 0,
      tokens_out: existing?.tokens_out || 0,
      copilot_requests_used: nextReqs,
      copilot_tokens_in: prevIn + tokensIn,
      copilot_tokens_out: prevOut + tokensOut,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id, period_start' }
  );

  return nextReqs;
}

async function logCopilotEvent(params: {
  workspaceId: string;
  userId: string;
  conversationId?: string | null;
  actionType: CopilotActionType;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  status: 'success' | 'failure';
  errorCode?: string | null;
  missingKnowledge?: boolean;
}): Promise<string | null> {
  try {
    const adminClient = serviceClient();
    const { data } = await adminClient
      .from('copilot_events')
      .insert({
        workspace_id: params.workspaceId,
        user_id: params.userId,
        conversation_id: params.conversationId || null,
        action_type: params.actionType,
        model: params.model,
        tokens_in: Math.max(0, Math.round(params.tokensIn)),
        tokens_out: Math.max(0, Math.round(params.tokensOut)),
        latency_ms: Math.max(0, Math.round(params.latencyMs)),
        status: params.status,
        error_code: params.errorCode || null,
        missing_knowledge: Boolean(params.missingKnowledge),
      })
      .select('id')
      .maybeSingle();

    return data?.id || null;
  } catch {
    return null;
  }
}

interface ExecuteCopilotModelCallResult {
  ok: boolean;
  text: string;
  eventId: string | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string | null;
  retryable?: boolean;
  error?: string;
  availability?: CopilotAvailability;
}

async function executeCopilotModelCall(params: {
  workspaceId: string;
  userId: string;
  conversationId?: string | null;
  actionType: CopilotActionType;
  system: string;
  user: string;
  temperature?: number;
}): Promise<ExecuteCopilotModelCallResult> {
  const availability = await checkCopilotAvailability(params.workspaceId);
  if (!availability.available) {
    return {
      ok: false,
      text: '',
      eventId: null,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      model: null,
      retryable: false,
      error: availability.message || 'Agent Copilot is currently unavailable.',
      availability,
    };
  }

  const platform = await getPlatformCopilotConfigServerOnly();
  if (!platform.config) {
    return {
      ok: false,
      text: '',
      eventId: null,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      model: platform.model,
      retryable: false,
      error: 'Platform AI model is not configured.',
    };
  }

  const startMs = Date.now();
  const maxTokens = COPILOT_MAX_TOKENS[params.actionType] || 450;

  try {
    const result = await chat(platform.config, {
      system: params.system,
      messages: [{ role: 'user', content: params.user }],
      maxTokens,
      temperature: params.temperature ?? 0.2,
      reasoning: 'fast',
      timeoutMs: 18000,
    });

    const latencyMs = Date.now() - startMs;
    const cleanText = sanitizeModelOutput(result.text || '');
    const tokensIn =
      typeof result.tokensIn === 'number' && result.tokensIn > 0
        ? result.tokensIn
        : estimateTokens(params.system + '\n' + params.user);
    const tokensOut =
      typeof result.tokensOut === 'number' && result.tokensOut > 0
        ? result.tokensOut
        : estimateTokens(cleanText);

    const [eventId] = await Promise.all([
      logCopilotEvent({
        workspaceId: params.workspaceId,
        userId: params.userId,
        conversationId: params.conversationId,
        actionType: params.actionType,
        model: result.model || platform.model,
        tokensIn,
        tokensOut,
        latencyMs,
        status: 'success',
      }),
      incrementCopilotUsageAtomically(params.workspaceId, tokensIn, tokensOut),
    ]);

    return {
      ok: true,
      text: cleanText,
      eventId,
      tokensIn,
      tokensOut,
      latencyMs,
      model: result.model || platform.model,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startMs;
    const isProviderErr = err instanceof ProviderError;
    const retryable = isProviderErr ? err.retryable : true;
    const errorCode = isProviderErr ? `provider_${err.status || 'error'}` : 'timeout_or_network';

    const eventId = await logCopilotEvent({
      workspaceId: params.workspaceId,
      userId: params.userId,
      conversationId: params.conversationId,
      actionType: params.actionType,
      model: platform.model,
      tokensIn: estimateTokens(params.system + '\n' + params.user),
      tokensOut: 0,
      latencyMs,
      status: 'failure',
      errorCode,
    });

    return {
      ok: false,
      text: '',
      eventId,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      model: platform.model,
      retryable,
      error: 'The AI provider took too long or encountered an error. Please retry.',
    };
  }
}

/**
 * Loads the conversation context strictly scoped to `workspaceId`:
 * - Workspace details (for help center URL & name)
 * - Conversation row (including cached `copilot_summary` and `summary`)
 * - Limited recent message window (`COPILOT_RECENT_MESSAGE_LIMIT`)
 */
export async function loadConversationWindowForCopilot(
  workspaceId: string,
  conversationId: string
): Promise<{
  workspaceName: string;
  helpCenterUrl: string | null;
  conversation: {
    id: string;
    workspace_id: string;
    summary: string | null;
    copilot_summary: CopilotSummary | null;
    copilot_next_steps: CopilotNextSteps | null;
  };
  recentMessages: {
    id: string;
    sender_type: string;
    sender: 'Customer' | 'Agent' | 'Bot' | 'Internal Note';
    content: string;
    is_internal: boolean;
    created_at: string;
  }[];
  totalMessageCount: number;
  latestCustomerMessage: string;
}> {
  const adminClient = serviceClient();

  const [{ data: ws }, { data: conv }, { data: msgs, count }] = await Promise.all([
    adminClient
      .from('workspaces')
      .select('id, name, slug, custom_domain, custom_domain_status')
      .eq('id', workspaceId)
      .single(),
    adminClient
      .from('conversations')
      .select('id, workspace_id, summary, copilot_summary, copilot_next_steps')
      .eq('id', conversationId)
      .eq('workspace_id', workspaceId)
      .single(),
    adminClient
      .from('messages')
      .select('id, sender_type, content, is_internal, created_at', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(COPILOT_RECENT_MESSAGE_LIMIT),
  ]);

  if (!ws || !conv || conv.workspace_id !== workspaceId) {
    throw new Error('Conversation not found in this workspace.');
  }

  const ordered = [...(msgs || [])].reverse().map((m) => {
    const sender: 'Customer' | 'Agent' | 'Bot' | 'Internal Note' = m.is_internal
      ? 'Internal Note'
      : m.sender_type === 'visitor'
      ? 'Customer'
      : m.sender_type === 'ai'
      ? 'Bot'
      : 'Agent';
    return {
      id: m.id,
      sender_type: m.sender_type,
      sender,
      content: String(m.content || '').slice(0, 1200),
      is_internal: Boolean(m.is_internal),
      created_at: m.created_at,
    };
  });

  const latestCustomerMsg =
    [...ordered].reverse().find((m) => m.sender === 'Customer')?.content || '';

  return {
    workspaceName: ws.name || 'Support Workspace',
    helpCenterUrl: getWorkspaceHelpCenterUrl(ws as never),
    conversation: {
      id: conv.id,
      workspace_id: conv.workspace_id,
      summary: conv.summary || null,
      copilot_summary: (conv.copilot_summary as CopilotSummary | null) || null,
      copilot_next_steps: (conv.copilot_next_steps as CopilotNextSteps | null) || null,
    },
    recentMessages: ordered,
    totalMessageCount: count ?? ordered.length,
    latestCustomerMessage: latestCustomerMsg,
  };
}

function formatSummaryForPrompt(
  copilotSummary: CopilotSummary | null,
  legacySummary: string | null
): string | null {
  if (copilotSummary) {
    return [
      `Issue: ${copilotSummary.issue}`,
      `Tried: ${copilotSummary.tried}`,
      `Status: ${copilotSummary.status}`,
      `Pending: ${copilotSummary.pending_action}`,
    ].join('\n');
  }
  return legacySummary || null;
}

/**
 * 1. Generate or refresh Conversation Summary
 */
export async function generateCopilotSummary(params: {
  workspaceId: string;
  userId: string;
  conversationId: string;
  forceRefresh?: boolean;
}): Promise<{
  ok: boolean;
  summary?: CopilotSummary;
  cached?: boolean;
  error?: string;
  retryable?: boolean;
  availability?: CopilotAvailability;
}> {
  const ctx = await loadConversationWindowForCopilot(params.workspaceId, params.conversationId);

  // Return cached summary if valid, not outdated, and not forced
  if (
    !params.forceRefresh &&
    ctx.conversation.copilot_summary &&
    !ctx.conversation.copilot_summary.is_outdated
  ) {
    return {
      ok: true,
      summary: ctx.conversation.copilot_summary,
      cached: true,
    };
  }

  const nonInternal = ctx.recentMessages.filter((m) => !m.is_internal);
  if (nonInternal.length === 0) {
    return {
      ok: false,
      error: 'Not enough messages in this conversation to generate a summary yet.',
    };
  }

  const contextBlock = formatUntrustedContext({
    workspaceName: ctx.workspaceName,
    existingSummary: formatSummaryForPrompt(
      ctx.conversation.copilot_summary,
      ctx.conversation.summary
    ),
    recentMessages: ctx.recentMessages,
  });

  const prompt = buildSummaryPrompt(contextBlock);
  const callRes = await executeCopilotModelCall({
    workspaceId: params.workspaceId,
    userId: params.userId,
    conversationId: params.conversationId,
    actionType: 'summary',
    system: prompt.system,
    user: prompt.user,
    temperature: 0.1,
  });

  if (!callRes.ok) {
    return {
      ok: false,
      error: callRes.error,
      retryable: callRes.retryable,
      availability: callRes.availability,
    };
  }

  const parsed = extractFirstJsonObject(callRes.text);
  const summary: CopilotSummary = {
    issue: sanitizeModelOutput(
      typeof parsed?.issue === 'string' && parsed.issue.trim()
        ? parsed.issue
        : callRes.text.slice(0, 240)
    ),
    tried: sanitizeModelOutput(
      typeof parsed?.tried === 'string' && parsed.tried.trim()
        ? parsed.tried
        : 'Initial inquiry received; awaiting agent review.'
    ),
    status: sanitizeModelOutput(
      typeof parsed?.status === 'string' && parsed.status.trim()
        ? parsed.status
        : 'Open — awaiting agent action'
    ),
    pending_action: sanitizeModelOutput(
      typeof parsed?.pending_action === 'string' && parsed.pending_action.trim()
        ? parsed.pending_action
        : 'Review customer message and respond.'
    ),
    generated_at: new Date().toISOString(),
    message_count: ctx.totalMessageCount,
    is_outdated: false,
    event_id: callRes.eventId,
  };

  // Cache in conversations table
  const adminClient = serviceClient();
  await adminClient
    .from('conversations')
    .update({
      copilot_summary: summary,
      summary: `${summary.issue} (${summary.status})`.slice(0, 500),
    })
    .eq('id', params.conversationId)
    .eq('workspace_id', params.workspaceId);

  return {
    ok: true,
    summary,
    cached: false,
  };
}

/**
 * 2. Suggest Reply (grounded in workspace knowledge, matching customer language)
 */
export async function generateCopilotSuggestedReply(params: {
  workspaceId: string;
  userId: string;
  conversationId: string;
  language?: CopilotReplyLanguage;
}): Promise<{
  ok: boolean;
  draft?: string;
  sources?: CopilotSource[];
  knowledgeFound?: boolean;
  noteForAgent?: string | null;
  missingKnowledgeRecorded?: boolean;
  resolvedLanguage?: 'en' | 'ur' | 'roman_ur';
  eventId?: string | null;
  error?: string;
  retryable?: boolean;
  availability?: CopilotAvailability;
}> {
  const ctx = await loadConversationWindowForCopilot(params.workspaceId, params.conversationId);
  const latestCustomer = ctx.latestCustomerMessage || 'Customer needs assistance';
  const langInfo = describeLanguageDirective(params.language || 'auto', latestCustomer);

  // If latest customer message is a direct prompt injection attempt, refuse to run retrieval gap
  // and return a safe support response without exposing any internal instructions.
  const injectionAttempt = isPromptInjectionAttempt(latestCustomer);

  const platform = await getPlatformCopilotConfigServerOnly();
  const retrieved = injectionAttempt
    ? {
        text: '',
        used: [],
        belowThreshold: false,
        confidence: 'high' as const,
        sources: [],
        queryEmbedding: null,
        rewrittenQuery: latestCustomer,
      }
    : await buildModelContext(params.workspaceId, latestCustomer, {
        recentMessages: ctx.recentMessages.map((m) => ({
          sender_type: m.sender_type,
          content: m.content,
        })),
        providerConfig: platform.config,
        helpCenterUrl: ctx.helpCenterUrl,
        limit: 5,
      });

  const hasKnowledge = Boolean(retrieved.text && !retrieved.belowThreshold);
  const contextBlock = formatUntrustedContext({
    workspaceName: ctx.workspaceName,
    existingSummary: formatSummaryForPrompt(
      ctx.conversation.copilot_summary,
      ctx.conversation.summary
    ),
    recentMessages: ctx.recentMessages,
    knowledgeText: hasKnowledge ? retrieved.text : '',
  });

  const prompt = buildSuggestReplyPrompt({
    contextBlock,
    languageInstruction: langInfo.instruction,
    hasKnowledge,
  });

  const callRes = await executeCopilotModelCall({
    workspaceId: params.workspaceId,
    userId: params.userId,
    conversationId: params.conversationId,
    actionType: 'suggest_reply',
    system: prompt.system,
    user: prompt.user,
    temperature: 0.15,
  });

  if (!callRes.ok) {
    return {
      ok: false,
      error: callRes.error,
      retryable: callRes.retryable,
      availability: callRes.availability,
    };
  }

  const parsed = extractFirstJsonObject(callRes.text);
  const rawDraft =
    typeof parsed?.draft === 'string' && parsed.draft.trim() ? parsed.draft : callRes.text;
  const draft = sanitizeModelOutput(rawDraft);

  const modelKnowledgeFound =
    injectionAttempt ? true : parsed?.knowledge_found !== false && hasKnowledge;

  const missingQuestion =
    !injectionAttempt && !modelKnowledgeFound
      ? (typeof parsed?.missing_question === 'string' && parsed.missing_question.trim()) ||
        retrieved.rewrittenQuery ||
        latestCustomer
      : null;

  // Map cited chunks to deduplicated CopilotSource list
  const citedNumbers = Array.isArray(parsed?.cited_chunk_numbers)
    ? (parsed.cited_chunk_numbers as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1)
    : [];

  const allSources: CopilotSource[] = (retrieved.sources || []).map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug ?? null,
    url: s.url ?? null,
    kind: s.kind === 'knowledge' ? 'knowledge' : 'article',
  }));

  const selectedSources =
    citedNumbers.length > 0
      ? citedNumbers
          .map((n) => allSources[n - 1])
          .filter((s): s is CopilotSource => Boolean(s))
      : modelKnowledgeFound
      ? allSources.slice(0, 3)
      : [];

  const uniqueSources = Array.from(
    new Map(selectedSources.map((s) => [`${s.kind}:${s.id}`, s])).values()
  );

  let missingKnowledgeRecorded = false;
  if (!modelKnowledgeFound && missingQuestion && missingQuestion.trim().length >= 4) {
    await recordUnanswered(
      params.workspaceId,
      missingQuestion.trim(),
      'copilot_missing_knowledge',
      params.conversationId,
      retrieved.queryEmbedding
    );
    missingKnowledgeRecorded = true;
    if (callRes.eventId) {
      await serviceClient()
        .from('copilot_events')
        .update({ missing_knowledge: true })
        .eq('id', callRes.eventId)
        .eq('workspace_id', params.workspaceId);
    }
  }

  const noteForAgent = !modelKnowledgeFound
    ? sanitizeModelOutput(
        (typeof parsed?.note_for_agent === 'string' && parsed.note_for_agent.trim()) ||
          'Information was not found in workspace knowledge. A clarifying / escalation draft was prepared and the missing question was logged.'
      )
    : typeof parsed?.note_for_agent === 'string' && parsed.note_for_agent.trim()
    ? sanitizeModelOutput(parsed.note_for_agent.trim())
    : null;

  return {
    ok: true,
    draft,
    sources: uniqueSources,
    knowledgeFound: modelKnowledgeFound,
    noteForAgent,
    missingKnowledgeRecorded,
    resolvedLanguage: langInfo.resolved,
    eventId: callRes.eventId,
  };
}

/**
 * 3. Ask Copilot (Private agent chat about the conversation or workspace knowledge)
 */
export async function askCopilotQuestion(params: {
  workspaceId: string;
  userId: string;
  conversationId: string;
  question: string;
}): Promise<{
  ok: boolean;
  agentMessage?: {
    id: string;
    role: 'agent';
    content: string;
    sources: CopilotSource[];
    created_at: string;
  };
  copilotMessage?: {
    id: string;
    role: 'copilot';
    content: string;
    sources: CopilotSource[];
    event_id: string | null;
    feedback: 'up' | 'down' | null;
    created_at: string;
  };
  knowledgeFound?: boolean;
  missingKnowledgeRecorded?: boolean;
  error?: string;
  retryable?: boolean;
  availability?: CopilotAvailability;
}> {
  const cleanQuestion = (params.question || '').trim();
  if (!cleanQuestion) {
    return { ok: false, error: 'Please enter a question for Copilot.' };
  }

  const ctx = await loadConversationWindowForCopilot(params.workspaceId, params.conversationId);
  const adminClient = serviceClient();

  // Load recent private copilot chat history for this conversation
  const { data: prevChat } = await adminClient
    .from('copilot_messages')
    .select('id, role, content')
    .eq('workspace_id', params.workspaceId)
    .eq('conversation_id', params.conversationId)
    .order('created_at', { ascending: false })
    .limit(6);

  const chatHistory = [...(prevChat || [])].reverse().map((m) => ({
    role: m.role as 'agent' | 'copilot',
    content: String(m.content || ''),
  }));

  const injectionAttempt = isPromptInjectionAttempt(cleanQuestion);
  const platform = await getPlatformCopilotConfigServerOnly();

  const retrieved = injectionAttempt
    ? {
        text: '',
        used: [],
        belowThreshold: false,
        confidence: 'high' as const,
        sources: [],
        queryEmbedding: null,
        rewrittenQuery: cleanQuestion,
      }
    : await buildModelContext(params.workspaceId, cleanQuestion, {
        providerConfig: platform.config,
        helpCenterUrl: ctx.helpCenterUrl,
        limit: 5,
      });

  const hasKnowledge = Boolean(retrieved.text && !retrieved.belowThreshold);
  const contextBlock = formatUntrustedContext({
    workspaceName: ctx.workspaceName,
    existingSummary: formatSummaryForPrompt(
      ctx.conversation.copilot_summary,
      ctx.conversation.summary
    ),
    recentMessages: ctx.recentMessages,
    knowledgeText: hasKnowledge ? retrieved.text : '',
  });

  const prompt = buildAskCopilotPrompt({
    contextBlock,
    agentQuestion: cleanQuestion,
    chatHistory,
  });

  const callRes = await executeCopilotModelCall({
    workspaceId: params.workspaceId,
    userId: params.userId,
    conversationId: params.conversationId,
    actionType: 'ask',
    system: prompt.system,
    user: prompt.user,
    temperature: 0.15,
  });

  if (!callRes.ok) {
    return {
      ok: false,
      error: callRes.error,
      retryable: callRes.retryable,
      availability: callRes.availability,
    };
  }

  const parsed = extractFirstJsonObject(callRes.text);
  const rawAnswer =
    typeof parsed?.answer === 'string' && parsed.answer.trim() ? parsed.answer : callRes.text;
  const answer = sanitizeModelOutput(rawAnswer);

  const knowledgeFound = injectionAttempt ? true : parsed?.knowledge_found !== false;
  const citedNumbers = Array.isArray(parsed?.cited_chunk_numbers)
    ? (parsed.cited_chunk_numbers as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1)
    : [];

  const allSources: CopilotSource[] = (retrieved.sources || []).map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug ?? null,
    url: s.url ?? null,
    kind: s.kind === 'knowledge' ? 'knowledge' : 'article',
  }));

  const selectedSources =
    citedNumbers.length > 0
      ? citedNumbers
          .map((n) => allSources[n - 1])
          .filter((s): s is CopilotSource => Boolean(s))
      : knowledgeFound && hasKnowledge
      ? allSources.slice(0, 3)
      : [];

  const uniqueSources = Array.from(
    new Map(selectedSources.map((s) => [`${s.kind}:${s.id}`, s])).values()
  );

  let missingKnowledgeRecorded = false;
  if (!knowledgeFound && !injectionAttempt) {
    const gapText =
      (typeof parsed?.missing_question === 'string' && parsed.missing_question.trim()) ||
      cleanQuestion;
    if (gapText.length >= 4) {
      await recordUnanswered(
        params.workspaceId,
        gapText,
        'copilot_missing_knowledge',
        params.conversationId,
        retrieved.queryEmbedding
      );
      missingKnowledgeRecorded = true;
      if (callRes.eventId) {
        await adminClient
          .from('copilot_events')
          .update({ missing_knowledge: true })
          .eq('id', callRes.eventId)
          .eq('workspace_id', params.workspaceId);
      }
    }
  }

  const nowIso = new Date().toISOString();
  const { data: insertedAgentMsg } = await adminClient
    .from('copilot_messages')
    .insert({
      workspace_id: params.workspaceId,
      conversation_id: params.conversationId,
      agent_id: params.userId,
      role: 'agent',
      content: cleanQuestion,
      sources: [],
    })
    .select('*')
    .maybeSingle();

  const { data: insertedCopilotMsg } = await adminClient
    .from('copilot_messages')
    .insert({
      workspace_id: params.workspaceId,
      conversation_id: params.conversationId,
      agent_id: params.userId,
      role: 'copilot',
      content: answer,
      sources: uniqueSources,
      event_id: callRes.eventId,
    })
    .select('*')
    .maybeSingle();

  return {
    ok: true,
    agentMessage: {
      id: insertedAgentMsg?.id || `agent-${Date.now()}`,
      role: 'agent',
      content: cleanQuestion,
      sources: [],
      created_at: insertedAgentMsg?.created_at || nowIso,
    },
    copilotMessage: {
      id: insertedCopilotMsg?.id || `copilot-${Date.now()}`,
      role: 'copilot',
      content: answer,
      sources: uniqueSources,
      event_id: callRes.eventId,
      feedback: null,
      created_at: insertedCopilotMsg?.created_at || nowIso,
    },
    knowledgeFound,
    missingKnowledgeRecorded,
  };
}

/**
 * 4. Rewrite composer text (Preview only; replaced only when agent accepts)
 */
export async function rewriteComposerText(params: {
  workspaceId: string;
  userId: string;
  conversationId?: string | null;
  text: string;
  mode: CopilotRewriteMode;
}): Promise<{
  ok: boolean;
  rewritten?: string;
  eventId?: string | null;
  error?: string;
  retryable?: boolean;
  availability?: CopilotAvailability;
}> {
  const clean = (params.text || '').trim();
  if (!clean) {
    return { ok: false, error: 'Write a draft in the composer first to rewrite it.' };
  }

  const prompt = buildRewritePrompt({ text: clean, mode: params.mode });
  const callRes = await executeCopilotModelCall({
    workspaceId: params.workspaceId,
    userId: params.userId,
    conversationId: params.conversationId,
    actionType: 'rewrite',
    system: prompt.system,
    user: prompt.user,
    temperature: 0.2,
  });

  if (!callRes.ok) {
    return {
      ok: false,
      error: callRes.error,
      retryable: callRes.retryable,
      availability: callRes.availability,
    };
  }

  const rewritten = sanitizeModelOutput(callRes.text.replace(/^["']|["']$/g, '').trim());
  return {
    ok: true,
    rewritten: rewritten || clean,
    eventId: callRes.eventId,
  };
}

/**
 * 5. Next Steps & Triage Analysis (Suggestions only; never mutates status/tags/assignee)
 */
export async function generateCopilotNextSteps(params: {
  workspaceId: string;
  userId: string;
  conversationId: string;
}): Promise<{
  ok: boolean;
  nextSteps?: CopilotNextSteps;
  error?: string;
  retryable?: boolean;
  availability?: CopilotAvailability;
}> {
  const ctx = await loadConversationWindowForCopilot(params.workspaceId, params.conversationId);

  if (ctx.recentMessages.length === 0) {
    return {
      ok: false,
      error: 'Not enough messages in this conversation to suggest next steps.',
    };
  }

  const contextBlock = formatUntrustedContext({
    workspaceName: ctx.workspaceName,
    existingSummary: formatSummaryForPrompt(
      ctx.conversation.copilot_summary,
      ctx.conversation.summary
    ),
    recentMessages: ctx.recentMessages,
  });

  const prompt = buildNextStepsPrompt(contextBlock);
  const callRes = await executeCopilotModelCall({
    workspaceId: params.workspaceId,
    userId: params.userId,
    conversationId: params.conversationId,
    actionType: 'next_steps',
    system: prompt.system,
    user: prompt.user,
    temperature: 0.15,
  });

  if (!callRes.ok) {
    return {
      ok: false,
      error: callRes.error,
      retryable: callRes.retryable,
      availability: callRes.availability,
    };
  }

  const parsed = extractFirstJsonObject(callRes.text);
  const validSentiments = ['positive', 'neutral', 'frustrated', 'urgent'] as const;
  const rawSentiment = String(parsed?.sentiment || 'neutral').toLowerCase();
  const sentiment = (validSentiments.find((s) => s === rawSentiment) || 'neutral') as CopilotNextSteps['sentiment'];

  const rawSteps = Array.isArray(parsed?.next_steps)
    ? (parsed.next_steps as unknown[])
        .filter((s): s is string => typeof s === 'string' && Boolean(s.trim()))
        .map((s) => sanitizeModelOutput(s.trim()))
        .slice(0, 5)
    : [];

  const nextSteps: CopilotNextSteps = {
    issue_type: sanitizeModelOutput(
      typeof parsed?.issue_type === 'string' && parsed.issue_type.trim()
        ? parsed.issue_type.trim()
        : 'General Support Inquiry'
    ),
    sentiment,
    next_steps:
      rawSteps.length > 0
        ? rawSteps
        : [
            'Review the customer’s latest message and verify account details.',
            'Send a clarifying reply or consult the workspace knowledge base.',
          ],
    specialist_needed: Boolean(parsed?.specialist_needed),
    specialist_reason:
      parsed?.specialist_needed && typeof parsed?.specialist_reason === 'string' && parsed.specialist_reason.trim()
        ? sanitizeModelOutput(parsed.specialist_reason.trim())
        : null,
    generated_at: new Date().toISOString(),
    event_id: callRes.eventId,
  };

  // Cache on conversation (suggestions only — never changes status, assignee, or tags)
  await serviceClient()
    .from('conversations')
    .update({ copilot_next_steps: nextSteps })
    .eq('id', params.conversationId)
    .eq('workspace_id', params.workspaceId);

  return {
    ok: true,
    nextSteps,
  };
}
