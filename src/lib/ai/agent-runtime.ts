import { query, queryRows } from '@/lib/db';
import { serviceClient } from '@/lib/pg/service';
import {
  DEFAULT_AGENT_APPEARANCE,
  DEFAULT_ESCALATION_RULES,
  slugifyAgentName,
  type AgentAnswerMode,
  type AgentAppearance,
  type AgentCapabilities,
  type AgentEscalationRules,
  type AgentKnowledgeScope,
  type AgentReplyLanguageMode,
  type AgentStatus,
} from '@/lib/ai/agent-templates';
import { freshKnowledgeIndex } from '@/lib/ai/help-answer';
import { verifyClaimsAgainstPassages, type ClaimVerificationResult } from '@/lib/ai/claim-verifier';
import { asksForHuman } from '@/lib/ai/intent';
import { chat, isConfigured, type ProviderConfig } from '@/lib/ai/provider';
import { getPlatformAiConfigServerOnly } from '@/lib/ai/platform-gateway';
import { routeSubAgent } from '@/lib/ai/sub-agents';

export interface AiAgentRow {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  role_title: string;
  description: string;
  avatar_color: string;
  template_id: string | null;
  industry: string | null;
  status: AgentStatus;
  is_primary: boolean;
  channels: string[];
  tone: string;
  reply_language_mode: AgentReplyLanguageMode;
  answer_mode: AgentAnswerMode;
  system_prompt: string;
  guardrails: string[];
  escalation_rules: AgentEscalationRules;
  knowledge_scope: AgentKnowledgeScope;
  capabilities: AgentCapabilities;
  appearance: AgentAppearance;
  published_version: number;
  draft_version: number;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LanguageConfigRow {
  workspace_id: string;
  reply_style: AgentReplyLanguageMode;
  switch_mid_conversation: boolean;
  show_translation_to_agents: boolean;
  transcribe_voice_notes: boolean;
  reply_voice_notes_audio: boolean;
  handoff_low_confidence: boolean;
  low_confidence_threshold: number;
  enabled_languages: Record<string, boolean>;
  updated_at: string;
}

export interface VerificationClaim {
  claim: string;
  supported: boolean;
  source: string;
}

export function normalizeAgentRow(row: Record<string, unknown>): AiAgentRow {
  const esc = (row.escalation_rules && typeof row.escalation_rules === 'object'
    ? row.escalation_rules
    : {}) as Partial<AgentEscalationRules>;
  const scope = (row.knowledge_scope && typeof row.knowledge_scope === 'object'
    ? row.knowledge_scope
    : {}) as Partial<AgentKnowledgeScope>;
  const cap = (row.capabilities && typeof row.capabilities === 'object'
    ? row.capabilities
    : {}) as Partial<AgentCapabilities>;
  const app = (row.appearance && typeof row.appearance === 'object'
    ? row.appearance
    : {}) as Partial<AgentAppearance>;

  const statusRaw = String(row.status || 'draft');
  const status: AgentStatus = statusRaw === 'live' || statusRaw === 'paused' ? statusRaw : 'draft';
  const langModeRaw = String(row.reply_language_mode || 'match_customer');
  const reply_language_mode: AgentReplyLanguageMode =
    langModeRaw === 'native_script' || langModeRaw === 'english_only' ? langModeRaw : 'match_customer';

  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    slug: String(row.slug || 'assistant'),
    name: String(row.name || 'Support Assistant'),
    role_title: String(row.role_title || 'Support specialist'),
    description: String(row.description || ''),
    avatar_color: String(row.avatar_color || '#6D3FD6'),
    template_id: row.template_id ? String(row.template_id) : null,
    industry: row.industry ? String(row.industry) : null,
    status,
    is_primary: Boolean(row.is_primary),
    channels: Array.isArray(row.channels) ? row.channels.map(String) : ['web'],
    tone: String(row.tone || 'Clear, warm, concise'),
    reply_language_mode,
    answer_mode: row.answer_mode === 'strict' ? 'strict' : 'agent',
    system_prompt: String(row.system_prompt || ''),
    guardrails: Array.isArray(row.guardrails) ? row.guardrails.map(String) : [],
    escalation_rules: {
      confidenceThreshold: Number(esc.confidenceThreshold ?? DEFAULT_ESCALATION_RULES.confidenceThreshold),
      handoffOnFrustration: esc.handoffOnFrustration !== false,
      maxBotTurns: Number(esc.maxBotTurns ?? DEFAULT_ESCALATION_RULES.maxBotTurns),
      requireConfirmation: esc.requireConfirmation !== false,
      blockedTopics: Array.isArray(esc.blockedTopics) ? esc.blockedTopics.map(String) : [],
      handoffGroupId: esc.handoffGroupId ? String(esc.handoffGroupId) : null,
    },
    knowledge_scope: {
      allArticles: scope.allArticles !== false,
      sectionIds: Array.isArray(scope.sectionIds) ? scope.sectionIds.map(String) : [],
      includeBotKnowledge: scope.includeBotKnowledge !== false,
    },
    capabilities: {
      actions: Array.isArray(cap.actions) ? cap.actions.map(String) : [],
      frameworks: Array.isArray(cap.frameworks) ? cap.frameworks.map(String) : [],
      subAgentId: cap.subAgentId ? String(cap.subAgentId) : null,
    },
    appearance: {
      badgeLabel: String(app.badgeLabel || DEFAULT_AGENT_APPEARANCE.badgeLabel),
      showCitations: app.showCitations !== false,
      welcomeMessage: String(app.welcomeMessage || ''),
    },
    published_version: Number(row.published_version ?? 0),
    draft_version: Number(row.draft_version ?? 1),
    published_at: row.published_at ? String(row.published_at) : null,
    created_by: row.created_by ? String(row.created_by) : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Ensures the workspace has at least its primary AI agent row synced with
 * `workspaces.ai_settings` so runtime and UI views stay unified.
 */
export async function ensurePrimaryAiAgent(workspaceId: string): Promise<AiAgentRow | null> {
  const existing = await queryRows<Record<string, unknown>>(
    `SELECT * FROM public.ai_agents WHERE workspace_id = $1 ORDER BY is_primary DESC, created_at ASC LIMIT 1`,
    [workspaceId],
  );
  if (existing[0]) {
    return normalizeAgentRow(existing[0]);
  }

  const wsRows = await queryRows<{
    name: string;
    industry: string | null;
    ai_settings: Record<string, unknown> | null;
    greeting_message: string | null;
  }>(
    `SELECT name, industry, ai_settings, greeting_message
     FROM public.workspaces
     WHERE id = $1
     LIMIT 1`,
    [workspaceId],
  );
  const ws = wsRows[0];
  if (!ws) return null;

  const ai = (ws.ai_settings || {}) as Record<string, unknown>;
  const enabled = ai.enabled !== false && ai.auto_response_enabled !== false;
  const botName =
    typeof ai.bot_name === 'string' && ai.bot_name.trim()
      ? ai.bot_name.trim()
      : `${ws.name.trim() || 'Workspace'} Assistant`;
  const systemPrompt = typeof ai.system_prompt === 'string' ? ai.system_prompt : '';
  const answerMode: AgentAnswerMode = ai.answer_mode === 'strict' ? 'strict' : 'agent';
  const status: AgentStatus = enabled ? 'live' : 'paused';
  const slug = slugifyAgentName(botName);

  const inserted = await queryRows<Record<string, unknown>>(
    `INSERT INTO public.ai_agents (
       workspace_id, slug, name, role_title, description, industry, status, is_primary,
       channels, answer_mode, system_prompt, appearance, published_version, draft_version, published_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, ARRAY['web','email']::text[], $8, $9, $10::jsonb, $11, 1, $12)
     ON CONFLICT (workspace_id, slug) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [
      workspaceId,
      slug,
      botName,
      'Frontline customer support specialist',
      'Answers customer questions directly from your verified Help Center & internal knowledge.',
      ws.industry,
      status,
      answerMode,
      systemPrompt,
      JSON.stringify({
        badgeLabel: 'AI agent',
        showCitations: true,
        welcomeMessage: ws.greeting_message || '',
      }),
      enabled ? 1 : 0,
      enabled ? new Date().toISOString() : null,
    ],
  );
  return inserted[0] ? normalizeAgentRow(inserted[0]) : null;
}

export async function getActivePrimaryAiAgent(workspaceId: string): Promise<AiAgentRow | null> {
  const rows = await queryRows<Record<string, unknown>>(
    `SELECT * FROM public.ai_agents
     WHERE workspace_id = $1 AND status = 'live'
     ORDER BY is_primary DESC, published_at DESC NULLS LAST, updated_at DESC
     LIMIT 1`,
    [workspaceId],
  );
  return rows[0] ? normalizeAgentRow(rows[0]) : null;
}

export interface AgentRoutingResult {
  agent: AiAgentRow | null;
  reason: string;
  score: number;
}

const CHANNEL_ALIASES: Record<string, string> = {
  '': 'web',
  chat: 'web',
  web_chat: 'web',
  webchat: 'web',
  widget: 'web',
  web: 'web',
  messenger: 'facebook',
  fb: 'facebook',
  facebook: 'facebook',
  ig: 'instagram',
  instagram: 'instagram',
  wa: 'whatsapp',
  whatsapp: 'whatsapp',
  mail: 'email',
  email: 'email',
  phone: 'voice',
  call: 'voice',
  voice: 'voice',
};

const ROUTER_STOPWORDS = new Set([
  'agent',
  'agents',
  'assistant',
  'bot',
  'customer',
  'default',
  'for',
  'general',
  'help',
  'primary',
  'service',
  'specialist',
  'support',
  'team',
  'the',
  'with',
]);

/** Normalize channel names across widget, inbox, and social webhooks. */
export function normalizeAgentChannel(channel?: string | null): string {
  const raw = (channel || '').trim().toLowerCase();
  return CHANNEL_ALIASES[raw] ?? raw;
}

function tokenizeInformative(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, ' ')
        .split(/[\s_-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !ROUTER_STOPWORDS.has(t)),
    ),
  );
}

function scoreAgentForMessage(
  agent: AiAgentRow,
  message: string,
  recentUserMessages: string[],
  routedSubAgentId: string | null,
): number {
  const msgLower = message.toLowerCase();
  const msgTokens = new Set(tokenizeInformative(message));
  let score = 0;

  // Strongest deterministic signal: explicit sub-agent specialization match.
  const declaredSub = agent.capabilities?.subAgentId?.trim() || null;
  if (declaredSub && declaredSub !== 'general' && declaredSub !== 'greeting' && declaredSub === routedSubAgentId) {
    score += 5;
  }

  // Match declared capability actions first (phrase match then token match).
  for (const action of agent.capabilities?.actions || []) {
    const actionLower = action.trim().toLowerCase();
    if (!actionLower) continue;
    if (msgLower.includes(actionLower)) {
      score += 4;
      continue;
    }
    for (const token of tokenizeInformative(actionLower)) {
      if (msgTokens.has(token) || msgLower.includes(token)) {
        score += 2;
      }
    }
  }

  // Match name / role_title / slug keywords.
  const identityTokens = tokenizeInformative(`${agent.name} ${agent.role_title} ${agent.slug}`);
  for (const token of identityTokens) {
    if (msgTokens.has(token) || (token.length >= 4 && msgLower.includes(token))) {
      score += 2;
    }
  }

  // Lighter boost from description & industry keywords (capped to avoid noisy inflation).
  let descScore = 0;
  for (const token of tokenizeInformative(`${agent.description} ${agent.industry || ''}`)) {
    if (msgTokens.has(token)) {
      descScore += 1;
      if (descScore >= 3) break;
    }
  }
  score += descScore;

  // Keep context continuity for ultra-short follow-ups ("what about fees?") if history points to a specialist.
  const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
  if (score === 0 && wordCount <= 4 && recentUserMessages.length > 0) {
    const recentText = recentUserMessages.slice(-2).join(' ').toLowerCase();
    for (const token of identityTokens) {
      if (recentText.includes(token)) {
        score += 2;
        break;
      }
    }
  }

  return score;
}

/**
 * Pure multi-agent router across all live workspace agents:
 * filters by normalized channel first, then prefers clear specialist matches
 * over the primary live agent.
 */
export function selectTargetAiAgent(
  liveAgents: AiAgentRow[],
  input: {
    channel?: string | null;
    message: string;
    recentUserMessages?: string[];
    routedSubAgentId?: string | null;
  },
): AgentRoutingResult {
  const targetChannel = normalizeAgentChannel(input.channel);
  const eligible = liveAgents.filter(
    (agent) => agent.status === 'live' && agent.channels.some((c) => normalizeAgentChannel(c) === targetChannel),
  );

  if (eligible.length === 0) {
    return { agent: null, reason: 'no_live_agent_for_channel', score: 0 };
  }

  const primary = eligible.find((a) => a.is_primary) || null;
  if (eligible.length === 1) {
    return {
      agent: eligible[0],
      reason: eligible[0].is_primary ? 'primary_only' : 'single_channel_match',
      score: 1,
    };
  }

  const recent = input.recentUserMessages || [];
  const routedSub =
    input.routedSubAgentId !== undefined
      ? input.routedSubAgentId
      : routeSubAgent({
          message: input.message,
          asksForHuman: asksForHuman(input.message),
        }).agent;

  const scored = eligible.map((agent) => ({
    agent,
    score: scoreAgentForMessage(agent, input.message, recent, routedSub),
  }));
  scored.sort((a, b) => b.score - a.score || Number(b.agent.is_primary) - Number(a.agent.is_primary));

  const top = scored[0];
  const primaryScore = primary ? scored.find((s) => s.agent.id === primary.id)?.score ?? 0 : 0;

  if (!top.agent.is_primary && top.score >= 2 && top.score > primaryScore) {
    return { agent: top.agent, reason: 'specialist_match', score: top.score };
  }

  if (primary) {
    return { agent: primary, reason: 'primary_fallback', score: primaryScore };
  }

  return {
    agent: top.agent,
    reason: top.score > 0 ? 'specialist_match' : 'channel_fallback',
    score: top.score,
  };
}

/**
 * Selects the best live workspace AI agent for the incoming channel + message.
 * Preserves primary fallback and returns null if no live agent serves the channel.
 */
export async function resolveTargetAiAgentWithMatch(input: {
  workspaceId: string;
  channel?: string | null;
  message: string;
  recentUserMessages?: string[];
}): Promise<AgentRoutingResult> {
  const rows = await queryRows<Record<string, unknown>>(
    `SELECT * FROM public.ai_agents
     WHERE workspace_id = $1 AND status = 'live'
     ORDER BY is_primary DESC, published_at DESC NULLS LAST, updated_at DESC`,
    [input.workspaceId],
  );
  const liveAgents = rows.map(normalizeAgentRow);
  return selectTargetAiAgent(liveAgents, {
    channel: input.channel,
    message: input.message,
    recentUserMessages: input.recentUserMessages,
  });
}

export async function resolveTargetAiAgent(input: {
  workspaceId: string;
  channel?: string | null;
  message: string;
  recentUserMessages?: string[];
}): Promise<AiAgentRow | null> {
  const result = await resolveTargetAiAgentWithMatch(input);
  return result.agent;
}

export async function syncPrimaryAgentToWorkspaceAiSettings(
  workspaceId: string,
  agent: Pick<AiAgentRow, 'is_primary' | 'status' | 'system_prompt' | 'answer_mode' | 'guardrails'>,
): Promise<void> {
  if (!agent.is_primary) return;
  const supabase = serviceClient();
  const { data: ws } = await supabase
    .from('workspaces')
    .select('ai_settings')
    .eq('id', workspaceId)
    .maybeSingle();

  const currentAi = ((ws?.ai_settings && typeof ws.ai_settings === 'object' ? ws.ai_settings : {}) as Record<
    string,
    unknown
  >);

  const guardrailsBlock = agent.guardrails.length
    ? `\n\n# COMPLIANCE GUARDRAILS (NEVER VIOLATE)\n${agent.guardrails.map((g) => `- ${g}`).join('\n')}`
    : '';
  const combinedPrompt = `${agent.system_prompt.trim()}${guardrailsBlock}`.trim();

  const nextAi = {
    ...currentAi,
    enabled: agent.status === 'live',
    auto_response_enabled: agent.status === 'live',
    answer_mode: agent.answer_mode,
    system_prompt: combinedPrompt || null,
  };

  await supabase.from('workspaces').update({ ai_settings: nextAi }).eq('id', workspaceId);
}

export async function getLanguageConfig(workspaceId: string): Promise<LanguageConfigRow> {
  const rows = await queryRows<Record<string, unknown>>(
    `SELECT * FROM public.ai_language_configs WHERE workspace_id = $1 LIMIT 1`,
    [workspaceId],
  );
  const row = rows[0];
  if (!row) {
    return {
      workspace_id: workspaceId,
      reply_style: 'match_customer',
      switch_mid_conversation: true,
      show_translation_to_agents: true,
      transcribe_voice_notes: true,
      reply_voice_notes_audio: false,
      handoff_low_confidence: true,
      low_confidence_threshold: 0.7,
      enabled_languages: {
        en: true,
        ur: true,
        hi: true,
        ar: true,
        es: true,
        bn: true,
        tl: true,
        fr: true,
        id: true,
        pt: false,
      },
      updated_at: new Date().toISOString(),
    };
  }
  const styleRaw = String(row.reply_style || 'match_customer');
  const reply_style: AgentReplyLanguageMode =
    styleRaw === 'native_script' || styleRaw === 'english_only' ? styleRaw : 'match_customer';
  return {
    workspace_id: workspaceId,
    reply_style,
    switch_mid_conversation: row.switch_mid_conversation !== false,
    show_translation_to_agents: row.show_translation_to_agents !== false,
    transcribe_voice_notes: row.transcribe_voice_notes !== false,
    reply_voice_notes_audio: Boolean(row.reply_voice_notes_audio),
    handoff_low_confidence: row.handoff_low_confidence !== false,
    low_confidence_threshold: Number(row.low_confidence_threshold ?? 0.7),
    enabled_languages:
      row.enabled_languages && typeof row.enabled_languages === 'object'
        ? (row.enabled_languages as Record<string, boolean>)
        : { en: true },
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

export async function recordAiVerificationLog(input: {
  workspaceId: string;
  agentId?: string | null;
  agentName?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  channel?: string | null;
  topic?: string | null;
  customerQuestion: string;
  draftReply: string;
  finalReply?: string | null;
  verdict: 'supported' | 'blocked_fixed' | 'blocked_human' | 'needs_review';
  claims?: VerificationClaim[];
  outcomeNote?: string | null;
  confidence?: number | null;
  latencyMs?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO public.ai_verification_logs (
         workspace_id, agent_id, agent_name, conversation_id, message_id, channel, topic,
         customer_question, draft_reply, final_reply, verdict, claims, outcome_note,
         confidence, latency_ms, metadata
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16::jsonb)`,
      [
        input.workspaceId,
        input.agentId ?? null,
        input.agentName ?? null,
        input.conversationId ?? null,
        input.messageId ?? null,
        input.channel ?? null,
        input.topic ?? null,
        input.customerQuestion.slice(0, 4000),
        input.draftReply.slice(0, 8000),
        input.finalReply ? input.finalReply.slice(0, 8000) : null,
        input.verdict,
        JSON.stringify(input.claims ?? []),
        input.outcomeNote ?? null,
        input.confidence ?? null,
        input.latencyMs ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch (err) {
    console.warn('[AI Verification Log] Non-fatal insert failure:', (err as Error)?.message);
  }
}

export async function resolveWorkspaceLlmConfig(workspaceId: string): Promise<ProviderConfig | null> {
  const supabase = serviceClient();
  const [{ data: ws }, platform] = await Promise.all([
    supabase.from('workspaces').select('ai_settings').eq('id', workspaceId).maybeSingle(),
    getPlatformAiConfigServerOnly().catch(() => null),
  ]);
  const ai = (ws?.ai_settings && typeof ws.ai_settings === 'object' ? ws.ai_settings : {}) as Record<
    string,
    unknown
  >;
  if (typeof ai.provider === 'string' && typeof ai.api_key === 'string' && ai.api_key.trim()) {
    const candidate: ProviderConfig = {
      provider: ai.provider as ProviderConfig['provider'],
      model: typeof ai.model === 'string' ? ai.model : undefined,
      apiKey: ai.api_key,
      baseUrl: typeof ai.base_url === 'string' ? ai.base_url : undefined,
    };
    if (isConfigured(candidate)) return candidate;
  }
  return platform?.isEnabled && isConfigured(platform.config) ? platform.config : null;
}

/**
 * Verifies claims inside an AI draft reply against the workspace's loaded help chunks.
 * Uses semantic LLM checking when available and strict figure/policy grounding offline,
 * with no citedTitle pass-through loophole.
 */
export async function verifyReplyClaimsAgainstKnowledge(
  workspaceId: string,
  replyText: string,
  citedTitle: string | null,
  options?: {
    languageCode?: string | null;
    customerQuestion?: string | null;
    skipLlm?: boolean;
  },
): Promise<ClaimVerificationResult> {
  const index = await freshKnowledgeIndex(workspaceId);
  const sources = index.docs.map((d) => ({
    id: d.article.id,
    title: d.article.title,
    content: d.article.content,
  }));

  return verifyClaimsAgainstPassages({
    replyText,
    sources,
    citedTitles: citedTitle ? [citedTitle] : [],
    languageCode: options?.languageCode ?? null,
    customerQuestion: options?.customerQuestion ?? null,
    verifyWithLlm: options?.skipLlm
      ? null
      : (system, userPrompt) => tryWorkspaceChat(workspaceId, system, userPrompt, 450),
  });
}

/** Runs an LLM helper when configured, returning null cleanly if unconfigured. */
export async function tryWorkspaceChat(
  workspaceId: string,
  system: string,
  userPrompt: string,
  maxTokens = 700,
): Promise<string | null> {
  const cfg = await resolveWorkspaceLlmConfig(workspaceId);
  if (!cfg) return null;
  try {
    const res = await chat(cfg, {
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens,
      temperature: 0.2,
      reasoning: 'fast',
      timeoutMs: 12000,
    });
    return res.text?.trim() || null;
  } catch (err) {
    console.warn('[tryWorkspaceChat] Provider failed:', (err as Error)?.message);
    return null;
  }
}
