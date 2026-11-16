import crypto from 'node:crypto';
import { z } from 'zod';
import {
  BaseLlm,
  FunctionTool,
  InMemoryRunner,
  LlmAgent,
  getFunctionCalls,
  getFunctionResponses,
  isFinalResponse,
  stringifyContent,
  type BaseLlmConnection,
  type BaseTool,
  type Event,
  type LlmRequest,
  type LlmResponse,
} from '@google/adk';
import {
  normalizeAgentRagConfig,
  type AgentModelConfig,
  isToolAllowedInConfig,
  toRetrievedChunkSummaries,
  type RagTrace,
  type RetrievedChunkSummary,
} from '@/lib/ai/agent-templates';
import type { CitableArticle, RetrievalConfidence } from '@/lib/ai/help-answer';
import { classifyByRules, localized, replyLanguageOf } from '@/lib/ai/intent';
import type { ProviderConfig } from '@/lib/ai/provider';
import { buildSupportAgentPrompt } from '@/lib/ai/support-agent';
import {
  getArticleSectionNames,
  getAutonomyPoliciesForAgent,
  resolveAutonomyDecision,
} from '@/lib/ai/trust-ladder';
import { queryRows } from '@/lib/db';
import {
  CrmCreateFollowupTaskInputSchema,
  CrmCreateOrUpdateDealInputSchema,
  CrmGetCustomer360InputSchema,
  EscalateToTeamGroupInputSchema,
  RequestHumanApprovalInputSchema,
  SearchKnowledgeInputSchema,
  UNIFIED_TOOL_DEFINITIONS,
  executeAgentTool,
  type AgentToolContext,
  type DbQueryFn,
  type SearchKnowledgeFn,
  type UnifiedToolName,
} from '@/lib/agent/tools/registry';
import { generateAgentModelText, resolveEffectiveProviderConfig } from './model-config';
import { loadPausedAgentRun, persistAgentRun } from './run-store';
import type {
  AgentExecutionInput,
  AgentExecutionResult,
  AgentTraceStep,
  ChatTurn,
  PendingApprovalPayload,
  StagedToolAction,
} from './types';

/* ── Runtime Services & Options ─────────────────────────────────────────── */

export interface AdkRuntimeServices {
  providerConfig?: ProviderConfig | null;
  dbQuery?: DbQueryFn;
  searchKnowledgeFn?: SearchKnowledgeFn;
  getAutonomyPoliciesFn?: typeof getAutonomyPoliciesForAgent;
  getSectionNamesFn?: typeof getArticleSectionNames;
  generateReplyFn?: (params: {
    workspaceId: string;
    conversationId: string;
    system: string;
    messages: ChatTurn[];
    providerConfig?: ProviderConfig | null;
    modelConfig?: Partial<AgentModelConfig> | null;
  }) => Promise<string | null>;
  customLlm?: BaseLlm;
}

export interface AdkRunOptions {
  services?: AdkRuntimeServices;
}

/* ── ADK Content / Tool Prompt Serialization Helpers ────────────────────── */

function extractSystemInstructionText(llmRequest: LlmRequest): string {
  const sys = llmRequest.config?.systemInstruction;
  if (!sys) return '';
  if (typeof sys === 'string') return sys;
  if (Array.isArray(sys)) {
    return sys
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
          return item.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof sys === 'object' && 'parts' in sys && Array.isArray(sys.parts)) {
    return sys.parts
      .map((p) => (p && typeof p === 'object' && 'text' in p && typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof sys === 'object' && 'text' in sys && typeof sys.text === 'string') {
    return sys.text;
  }
  return '';
}

function describeToolsForPrompt(toolsDict: Record<string, BaseTool> | undefined): string {
  if (!toolsDict) return '';
  const entries = Object.values(toolsDict);
  if (!entries.length) return '';

  const toolLines = entries.map((tool) => {
    const fnDecl =
      typeof (tool as unknown as { _getDeclaration?: () => unknown })._getDeclaration === 'function'
        ? ((tool as unknown as { _getDeclaration: () => { parameters?: unknown; description?: string } })
            ._getDeclaration() ?? null)
        : null;
    const desc = (fnDecl?.description || tool.description || '').replace(/\s+/g, ' ').trim();
    const params = fnDecl?.parameters ? ` | params=${JSON.stringify(fnDecl.parameters)}` : '';
    return `- ${tool.name}: ${desc}${params}`;
  });

  return [
    '# AVAILABLE ADK TOOLS',
    'To invoke an ADK tool or delegate via transfer_to_agent, respond ONLY with valid JSON: {"tool_call":{"name":"<tool_name>","args":{...}}}',
    'Once you have enough grounded evidence to answer the customer, reply directly in natural language without any JSON wrapper.',
    ...toolLines,
  ].join('\n');
}

function serializeAdkContentsToTurns(contents: LlmRequest['contents']): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const content of contents || []) {
    const role: 'user' | 'assistant' = content.role === 'model' ? 'assistant' : 'user';
    const pieces: string[] = [];
    for (const part of content.parts || []) {
      if (part.text) {
        pieces.push(part.text);
      } else if (part.functionCall?.name) {
        pieces.push(
          `[Called tool ${part.functionCall.name} with args ${JSON.stringify(part.functionCall.args || {})}]`,
        );
      } else if (part.functionResponse?.name) {
        pieces.push(
          `[Tool ${part.functionResponse.name} result: ${JSON.stringify(part.functionResponse.response || {})}]`,
        );
      }
    }
    const text = pieces.join('\n').trim();
    if (text) {
      turns.push({ role, content: text });
    }
  }
  return turns;
}

function tryParseToolCallEnvelope(
  rawText: string,
  allowedTools: Record<string, BaseTool> | undefined,
): { name: string; args: Record<string, unknown> } | null {
  if (!allowedTools) return null;
  const trimmed = rawText.trim();
  const unwrapped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!unwrapped.startsWith('{') || !unwrapped.includes('tool_call')) return null;

  try {
    const parsed = JSON.parse(unwrapped) as {
      tool_call?: { name?: unknown; args?: unknown };
    };
    const name = typeof parsed.tool_call?.name === 'string' ? parsed.tool_call.name.trim() : '';
    if (!name || !(name in allowedTools)) return null;
    const args =
      parsed.tool_call?.args && typeof parsed.tool_call.args === 'object' && !Array.isArray(parsed.tool_call.args)
        ? (parsed.tool_call.args as Record<string, unknown>)
        : {};
    return { name, args };
  } catch {
    return null;
  }
}

/* ── Multi-Provider ADK BaseLlm Adapter ──────────────────────────────────── */

export class OrbatAdkLlm extends BaseLlm {
  static readonly supportedModels = [/.*/];
  private stepCount = 0;

  constructor(
    private readonly cfg: {
      modelLabel: string;
      workspaceId: string;
      conversationId: string;
      baseProviderConfig?: ProviderConfig | null;
      modelConfig?: Partial<AgentModelConfig> | null;
      maxToolSteps: number;
      generateReplyFn?: AdkRuntimeServices['generateReplyFn'];
      onModelUsed?: (meta: { usedModel: boolean; provider: string | null; model: string | null; note: string | null }) => void;
    },
  ) {
    super({ model: cfg.modelLabel });
  }

  async connect(): Promise<BaseLlmConnection> {
    throw new Error('Streaming BaseLlmConnection is not used for Orbat REST/turn execution.');
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    ...args: [stream?: boolean, abortSignal?: AbortSignal]
  ): AsyncGenerator<LlmResponse, void> {
    const abortSignal = args[1];
    if (abortSignal?.aborted) {
      return;
    }
    this.stepCount += 1;

    const baseSystem = extractSystemInstructionText(llmRequest);
    const allowToolCalls = this.stepCount < this.cfg.maxToolSteps;
    const toolSection = allowToolCalls ? describeToolsForPrompt(llmRequest.toolsDict) : '';
    const fullSystem = [baseSystem, toolSection].filter(Boolean).join('\n\n');
    const messages = serializeAdkContentsToTurns(llmRequest.contents);

    let text: string | null = null;
    let provider: string | null = null;
    let model: string | null = null;
    let note: string | null = null;

    if (this.cfg.generateReplyFn) {
      text = await this.cfg
        .generateReplyFn({
          workspaceId: this.cfg.workspaceId,
          conversationId: this.cfg.conversationId,
          system: fullSystem,
          messages,
          providerConfig: this.cfg.baseProviderConfig ?? null,
          modelConfig: this.cfg.modelConfig ?? null,
        })
        .catch(() => null);
    } else {
      const generated = await generateAgentModelText({
        workspaceId: this.cfg.workspaceId,
        conversationId: this.cfg.conversationId,
        system: fullSystem,
        messages,
        baseProviderConfig: this.cfg.baseProviderConfig ?? null,
        modelConfig: this.cfg.modelConfig ?? null,
        maxTokens: 650,
        countReply: false,
      }).catch(() => ({ text: null, provider: null, model: null, note: null }));
      text = generated.text;
      provider = generated.provider;
      model = generated.model;
      note = generated.note;
    }

    this.cfg.onModelUsed?.({
      usedModel: Boolean(text?.trim()),
      provider,
      model,
      note,
    });

    if (!text?.trim()) {
      yield {
        content: { role: 'model', parts: [{ text: '' }] },
        turnComplete: true,
      };
      return;
    }

    if (allowToolCalls) {
      const toolCall = tryParseToolCallEnvelope(text, llmRequest.toolsDict);
      if (toolCall) {
        yield {
          content: {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: `adk_call_${this.stepCount}_${crypto.randomUUID().slice(0, 8)}`,
                  name: toolCall.name,
                  args: toolCall.args,
                },
              },
            ],
          },
          turnComplete: true,
        };
        return;
      }
    }

    yield {
      content: { role: 'model', parts: [{ text: text.trim() }] },
      turnComplete: true,
    };
  }
}

/* ── Per-Run Collectors & Scoped ADK FunctionTool Adapters ──────────────── */

interface AdkRunCollector {
  retrievalText: string;
  belowThreshold: boolean;
  confidence: RetrievalConfidence;
  retrievalMethod: 'semantic_rag' | 'keyword_fallback' | 'none';
  ragTrace?: RagTrace;
  retrievedChunks: RetrievedChunkSummary[];
  sources: CitableArticle[];
  customer360Summary: string;
  stagedActions: StagedToolAction[];
  executedTools: Array<{ toolName: string; ok: boolean; summary: string }>;
  explicitHandover: { requested: boolean; reason: string | null };
  explicitApproval: { requested: boolean; topic?: string; reason?: string; draftReply?: string };
}

function buildAdkFunctionTool<TSchema extends z.ZodObject<z.ZodRawShape>>(
  name: UnifiedToolName,
  schema: TSchema,
  toolCtx: AgentToolContext,
  collector: AdkRunCollector,
) {
  const def = UNIFIED_TOOL_DEFINITIONS[name];
  return new FunctionTool({
    name: def.name,
    description: def.description,
    parameters: schema,
    execute: async (rawInput) => {
      // Read-only tools execute immediately within workspace isolation.
      if (name === 'search_knowledge') {
        const res = await executeAgentTool(toolCtx, 'search_knowledge', rawInput);
        collector.executedTools.push({ toolName: name, ok: res.ok, summary: res.summary });
        if (res.ok && res.data && typeof res.data === 'object') {
          const d = res.data as {
            text?: string;
            belowThreshold?: boolean;
            confidence?: RetrievalConfidence;
            retrievalMethod?: 'semantic_rag' | 'keyword_fallback' | 'none';
            ragTrace?: RagTrace;
            sources?: CitableArticle[];
            chunks?: Array<{
              id: string;
              article_title?: string | null;
              section_name?: string | null;
              combined_score?: number | null;
              similarity?: number | null;
              content?: string | null;
            }>;
          };
          if (d.text) collector.retrievalText = d.text;
          if (typeof d.belowThreshold === 'boolean') collector.belowThreshold = d.belowThreshold;
          if (d.confidence) collector.confidence = d.confidence;
          if (d.retrievalMethod) collector.retrievalMethod = d.retrievalMethod;
          if (d.ragTrace) collector.ragTrace = d.ragTrace;
          if (Array.isArray(d.sources) && d.sources.length) collector.sources = d.sources;
          const mapped = toRetrievedChunkSummaries(d.chunks, 5);
          if (mapped.length > 0) collector.retrievedChunks = mapped;
        }
        return res;
      }

      if (name === 'crm_get_customer_360') {
        const res = await executeAgentTool(toolCtx, 'crm_get_customer_360', rawInput);
        collector.executedTools.push({ toolName: name, ok: res.ok, summary: res.summary });
        if (res.ok && res.data) {
          collector.customer360Summary = JSON.stringify(res.data);
        }
        return res;
      }

      // Requesting approval records pause intent without executing CRM side effects yet.
      if (name === 'request_human_approval') {
        const parsed = RequestHumanApprovalInputSchema.safeParse(rawInput);
        if (!parsed.success) {
          return {
            ok: false,
            toolName: name,
            summary: 'Invalid approval request arguments',
            error: parsed.error.issues.map((i) => i.message).join('; '),
          };
        }
        collector.explicitApproval = {
          requested: true,
          topic: parsed.data.topic,
          reason: parsed.data.reason,
          draftReply: parsed.data.draftReply,
        };
        return {
          ok: true,
          toolName: name,
          summary: `Approval gate recorded for "${parsed.data.topic}"`,
          data: parsed.data,
        };
      }

      // Mutating CRM or escalation tools stage safely first; Trust Ladder decides whether
      // to execute immediately or pause for human approval in Inbox.
      if (name === 'crm_create_or_update_deal') {
        const parsed = CrmCreateOrUpdateDealInputSchema.safeParse(rawInput);
        if (!parsed.success) {
          return {
            ok: false,
            toolName: name,
            summary: 'Invalid CRM deal arguments',
            error: parsed.error.issues.map((i) => i.message).join('; '),
          };
        }
        const summary = `${parsed.data.dealId ? 'Update' : 'Create'} CRM deal "${parsed.data.title}" (${parsed.data.stage})`;
        collector.stagedActions.push({ toolName: name, summary, args: parsed.data });
        return { ok: true, staged: true, toolName: name, summary };
      }

      if (name === 'crm_create_followup_task') {
        const parsed = CrmCreateFollowupTaskInputSchema.safeParse(rawInput);
        if (!parsed.success) {
          return {
            ok: false,
            toolName: name,
            summary: 'Invalid CRM follow-up task arguments',
            error: parsed.error.issues.map((i) => i.message).join('; '),
          };
        }
        const summary = `Create CRM ${parsed.data.kind} task "${parsed.data.title}" (priority=${parsed.data.priority})`;
        collector.stagedActions.push({ toolName: name, summary, args: parsed.data });
        return { ok: true, staged: true, toolName: name, summary };
      }

      const parsedEsc = EscalateToTeamGroupInputSchema.safeParse(rawInput);
      if (!parsedEsc.success) {
        return {
          ok: false,
          toolName: 'escalate_to_team_group',
          summary: 'Invalid escalation arguments',
          error: parsedEsc.error.issues.map((i) => i.message).join('; '),
        };
      }
      collector.explicitHandover = { requested: true, reason: parsedEsc.data.reason };
      collector.stagedActions.push({
        toolName: 'escalate_to_team_group',
        summary: `Escalate to human team (${parsedEsc.data.priority}): ${parsedEsc.data.reason}`,
        args: parsedEsc.data,
      });
      return { ok: true, staged: true, toolName: 'escalate_to_team_group', summary: parsedEsc.data.reason };
    },
  });
}

function sanitizeAdkAgentName(raw: string, fallback: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned || /^[0-9]/.test(cleaned)) return fallback;
  return cleaned.slice(0, 48);
}

/* ── Main Google ADK Agent Execution Flow ───────────────────────────────── */

/**
 * Executes an AI agent turn using Google `@google/adk` (`LlmAgent`,
 * `FunctionTool`, and `InMemoryRunner`) with dynamic specialist sub-agents,
 * unified workspace-isolated CRM/KB tools, per-agent `modelConfig`, and Trust Ladder gating.
 */
export async function runAdkAgent(
  input: AgentExecutionInput,
  options?: AdkRunOptions,
): Promise<AgentExecutionResult> {
  const startedAt = Date.now();
  const threadId =
    input.threadId?.trim() ||
    `adk:${input.workspaceId}:${input.conversationId}:${input.visitorMessageId || crypto.randomUUID()}`;

  const services = options?.services || {};
  const dbQuery = services.dbQuery ?? queryRows;
  const searchKnowledgeFn = services.searchKnowledgeFn;
  const getAutonomyPoliciesFn = services.getAutonomyPoliciesFn ?? getAutonomyPoliciesForAgent;
  const getSectionNamesFn = services.getSectionNamesFn ?? getArticleSectionNames;

  const lang =
    input.agent.replyLanguageMode === 'english_only'
      ? 'en'
      : replyLanguageOf(input.message);
  const verdict = classifyByRules(input.message);
  const intent = verdict.intent;

  const trace: AgentTraceStep[] = [
    {
      node: 'adk_understand',
      status: 'ok',
      summary: `Classified intent=${intent}, lang=${lang}, agent="${input.agent.name}"`,
      detail: { intent, lang },
      durationMs: 0,
    },
  ];

  // Fast escalation guard for blocked topics & explicit human requests.
  const lowerMsg = (input.message || '').toLowerCase();
  const blockedTopic = (input.agent.escalationRules?.blockedTopics || []).find(
    (topic) => topic.trim() && lowerMsg.includes(topic.trim().toLowerCase()),
  );
  const explicitHuman =
    /\b(human|representative|manager|real person|speak to (?:someone|agent)|live agent)\b/i.test(
      lowerMsg,
    );

  if (blockedTopic || explicitHuman) {
    const reason = blockedTopic
      ? `Blocked topic matched escalation rule: "${blockedTopic}"`
      : 'Customer explicitly requested a human agent';
    const handoverText = localized(lang, {
      en: 'I will transfer you to a human specialist on our team right away with full context.',
      roman_ur: 'Main aapko abhi apni team ke human specialist se connect kar raha hoon, poori context ke saath.',
      ur: 'میں آپ کو ابھی ہماری ٹیم کے ماہر نمائندے سے مکمل تفصیلات کے ساتھ منسلک کر رہا ہوں۔',
    });

    const toolCtx: AgentToolContext = {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      visitorId: input.visitorId,
      visitorEmail: input.visitorEmail,
      agentId: input.agent.id,
      agentName: input.agent.name,
      handoffGroupId: input.agent.handoffGroupId ?? input.agent.escalationRules?.handoffGroupId ?? null,
      knowledgeScope: input.agent.knowledgeScope,
      ragConfig: input.agent.ragConfig,
      helpCenterUrl: input.helpCenterUrl,
      providerConfig: services.providerConfig ?? input.providerConfig ?? null,
      historyTurns: input.history,
      dryRun: input.dryRun,
      dbQuery,
      searchKnowledgeFn,
    };

    const escRes = await executeAgentTool(toolCtx, 'escalate_to_team_group', {
      reason,
      priority: blockedTopic ? 'urgent' : 'high',
    });

    const autonomyDecision = resolveAutonomyDecision({
      policies: input.autonomyPolicies || [],
      message: input.message,
    });

    trace.push({
      node: 'adk_policy_guard',
      status: 'ok',
      summary: `Fast handover triggered (${reason})`,
      durationMs: Date.now() - startedAt,
    });

    const runId = !input.dryRun
      ? await persistAgentRun(
          {
            workspaceId: input.workspaceId,
            conversationId: input.conversationId,
            visitorMessageId: input.visitorMessageId ?? null,
            agentId: input.agent.id,
            engineType: 'adk',
            threadId,
            status: 'completed',
            topic: autonomyDecision.topic,
            draftReply: handoverText,
            finalReply: handoverText,
            trace,
          },
          dbQuery,
        )
      : null;

    return {
      replyText: handoverText,
      action: 'escalate',
      engineUsed: 'adk',
      shouldHandover: true,
      handoverReason: reason,
      canAnswerFromDocs: false,
      citedArticles: [],
      usedArticleIds: [],
      retrievalConfidence: 'high',
      retrievalMethod: 'none',
      topic: autonomyDecision.topic,
      intent,
      usingModel: false,
      autonomyDecision,
      executedTools: [{ toolName: escRes.toolName, ok: escRes.ok, summary: escRes.summary }],
      trace,
      threadId,
      runId,
      latencyMs: Date.now() - startedAt,
    };
  }

  // Prepare model config & workspace-isolated tool context.
  const baseProviderConfig = services.providerConfig ?? input.providerConfig ?? null;
  const resolvedModelCfg = resolveEffectiveProviderConfig(baseProviderConfig, input.agent.modelConfig);

  const collector: AdkRunCollector = {
    retrievalText: '',
    belowThreshold: true,
    confidence: 'low',
    retrievalMethod: 'none',
    retrievedChunks: [],
    sources: [],
    customer360Summary: '',
    stagedActions: [],
    executedTools: [],
    explicitHandover: { requested: false, reason: null },
    explicitApproval: { requested: false },
  };

  const toolCtx: AgentToolContext = {
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    visitorId: input.visitorId,
    visitorEmail: input.visitorEmail,
    agentId: input.agent.id,
    agentName: input.agent.name,
    handoffGroupId: input.agent.handoffGroupId ?? input.agent.escalationRules?.handoffGroupId ?? null,
    knowledgeScope: input.agent.knowledgeScope,
    ragConfig: input.agent.ragConfig,
    helpCenterUrl: input.helpCenterUrl,
    providerConfig: resolvedModelCfg.providerConfig,
    historyTurns: input.history,
    dryRun: input.dryRun,
    dbQuery,
    searchKnowledgeFn,
  };

  // Pre-ground Knowledge Base + optional Customer 360 so Trust Ladder and offline fallback work seamlessly.
  const preRagStart = Date.now();
  const ragRes = await executeAgentTool(toolCtx, 'search_knowledge', {
    query: input.message,
    limit: normalizeAgentRagConfig(input.agent.ragConfig).topK,
  });
  collector.executedTools.push({
    toolName: 'search_knowledge',
    ok: ragRes.ok,
    summary: ragRes.summary,
  });
  if (ragRes.ok && ragRes.data && typeof ragRes.data === 'object') {
    const d = ragRes.data as {
      text?: string;
      belowThreshold?: boolean;
      confidence?: RetrievalConfidence;
      retrievalMethod?: 'semantic_rag' | 'keyword_fallback' | 'none';
      ragTrace?: RagTrace;
      sources?: CitableArticle[];
      chunks?: Array<{
        id: string;
        article_title?: string | null;
        section_name?: string | null;
        combined_score?: number | null;
        similarity?: number | null;
        content?: string | null;
      }>;
    };
    collector.retrievalText = d.text || '';
    collector.belowThreshold = Boolean(d.belowThreshold);
    collector.confidence = d.confidence || 'low';
    collector.retrievalMethod = d.retrievalMethod || 'none';
    collector.ragTrace = d.ragTrace;
    collector.sources = d.sources || [];
    collector.retrievedChunks = toRetrievedChunkSummaries(d.chunks, 5);
  }

  const allowedToolsList = input.agent.engineConfig?.allowedTools;
  const allowCrm360 = isToolAllowedInConfig(allowedToolsList, 'crm_get_customer_360');
  const allowCrmDeal = isToolAllowedInConfig(allowedToolsList, 'crm_create_or_update_deal');
  const allowCrmTask = isToolAllowedInConfig(allowedToolsList, 'crm_create_followup_task');

  const shouldPreloadCrm =
    allowCrm360 &&
    Boolean(input.visitorId || input.visitorEmail) &&
    /\b(order|account|plan|price|pricing|quote|demo|enterprise|refund|subscription|invoice|billing|cancel|vip|deal|status|ticket)\b/i.test(
      input.message,
    );
  if (shouldPreloadCrm) {
    const crmRes = await executeAgentTool(toolCtx, 'crm_get_customer_360', {
      visitorId: input.visitorId ?? undefined,
      email: input.visitorEmail ?? undefined,
    });
    collector.executedTools.push({
      toolName: 'crm_get_customer_360',
      ok: crmRes.ok,
      summary: crmRes.summary,
    });
    if (crmRes.ok && crmRes.data) {
      collector.customer360Summary = JSON.stringify(crmRes.data);
    }
  }

  trace.push({
    node: 'adk_pre_grounding',
    status: 'ok',
    summary: `Grounded ${collector.sources.length} source(s) via ${collector.retrievalMethod} (conf=${collector.confidence})`,
    detail: {
      sourceCount: collector.sources.length,
      confidence: collector.confidence,
      retrievalMethod: collector.retrievalMethod,
      hasCustomer360: Boolean(collector.customer360Summary),
    },
    durationMs: Date.now() - preRagStart,
  });

  // Resolve Trust Ladder policy before response delivery.
  const policies =
    input.autonomyPolicies && input.autonomyPolicies.length > 0
      ? input.autonomyPolicies
      : input.agent.id
        ? await getAutonomyPoliciesFn(input.workspaceId, input.agent.id).catch(() => [])
        : [];
  const articleIds = collector.sources
    .filter((s) => s.kind !== 'knowledge')
    .map((s) => s.id)
    .filter(Boolean);
  const citedSectionNames =
    articleIds.length > 0
      ? await getSectionNamesFn(input.workspaceId, articleIds).catch(() => [])
      : [];

  const autonomyDecision = resolveAutonomyDecision({
    policies,
    message: input.message,
    citedSectionNames,
  });

  // Compose ADK tools & specialist sub-agents.
  const searchTool = buildAdkFunctionTool(
    'search_knowledge',
    SearchKnowledgeInputSchema,
    toolCtx,
    collector,
  );
  const crmReadTool = buildAdkFunctionTool(
    'crm_get_customer_360',
    CrmGetCustomer360InputSchema,
    toolCtx,
    collector,
  );
  const crmDealTool = buildAdkFunctionTool(
    'crm_create_or_update_deal',
    CrmCreateOrUpdateDealInputSchema,
    toolCtx,
    collector,
  );
  const crmTaskTool = buildAdkFunctionTool(
    'crm_create_followup_task',
    CrmCreateFollowupTaskInputSchema,
    toolCtx,
    collector,
  );
  const escalateTool = buildAdkFunctionTool(
    'escalate_to_team_group',
    EscalateToTeamGroupInputSchema,
    toolCtx,
    collector,
  );
  const approvalTool = buildAdkFunctionTool(
    'request_human_approval',
    RequestHumanApprovalInputSchema,
    toolCtx,
    collector,
  );

  let modelUsed = false;
  let modelNote: string | null = resolvedModelCfg.fallbackNote;
  const maxToolSteps = Math.min(10, Math.max(2, Number(input.agent.engineConfig?.maxSteps) || 6));

  const llm: BaseLlm =
    services.customLlm ??
    new OrbatAdkLlm({
      modelLabel:
        resolvedModelCfg.providerConfig?.model ||
        resolvedModelCfg.requestedModel ||
        'orbat-platform-llm',
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      baseProviderConfig: baseProviderConfig,
      modelConfig: input.agent.modelConfig,
      maxToolSteps,
      generateReplyFn: services.generateReplyFn,
      onModelUsed: ({ usedModel, note }) => {
        if (usedModel) modelUsed = true;
        if (note) modelNote = note;
      },
    });

  const guardrailsBlock = input.agent.guardrails?.length
    ? `# GUARDRAILS & COMPLIANCE\n${input.agent.guardrails.map((g) => `- ${g}`).join('\n')}`
    : '';
  const customInstructions = [
    input.agent.systemPrompt || '',
    input.agent.tone ? `Tone: ${input.agent.tone}` : '',
    input.agent.answerMode === 'strict'
      ? 'STRICT MODE: Answer strictly from retrieved Knowledge Base articles. Never guess policies or pricing.'
      : '',
    guardrailsBlock,
    input.humanContext ? `# PRIOR HUMAN TEAMMATE CONTEXT\n${input.humanContext}` : '',
    collector.customer360Summary ? `# CUSTOMER 360 CRM CONTEXT\n${collector.customer360Summary}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const coordinatorInstruction = buildSupportAgentPrompt({
    botName: input.agent.name || 'AI Assistant',
    businessName: input.workspaceName || 'Workspace',
    industry: input.agent.industry ?? null,
    knowledge:
      collector.retrievalText ||
      'No published Help Center articles matched within this agent Knowledge Scope.',
    lang,
    customInstructions,
    visitorName: input.visitorName ?? null,
  });

  const kbResearcherAgent = new LlmAgent({
    name: 'knowledge_researcher',
    model: llm,
    description:
      'Researches scoped Help Center articles and documents using search_knowledge before drafting a grounded reply.',
    instruction: `${coordinatorInstruction}\n\n# SPECIALIST ROLE\nYou are the Knowledge Researcher. Verify details with search_knowledge when needed and give a clear, accurate response.`,
    tools: [searchTool],
  });

  const crmTools = [
    ...(allowCrm360 ? [crmReadTool] : []),
    ...(allowCrmDeal ? [crmDealTool] : []),
    ...(allowCrmTask ? [crmTaskTool] : []),
  ];

  const crmSpecialistAgent = new LlmAgent({
    name: 'crm_sales_specialist',
    model: llm,
    description:
      'Handles customer account lookup (Customer 360), commercial deal creation/updates, and team follow-up tasks.',
    instruction: `${coordinatorInstruction}\n\n# SPECIALIST ROLE\nYou are the CRM & Sales Specialist. Use crm_get_customer_360 for account context, stage deals via crm_create_or_update_deal or tasks via crm_create_followup_task when warranted, and reply clearly.`,
    tools: crmTools.length > 0 ? crmTools : [searchTool],
  });

  const escalationSpecialistAgent = new LlmAgent({
    name: 'escalation_specialist',
    model: llm,
    description:
      'Handles sensitive refunds, billing disputes, policy ambiguity, and human escalation or approval requests.',
    instruction: `${coordinatorInstruction}\n\n# SPECIALIST ROLE\nYou handle sensitive escalation, refund disputes, or human approval requests cleanly and politely.`,
    tools: [escalateTool, approvalTool],
  });

  const coordinatorAgent = new LlmAgent({
    name: sanitizeAdkAgentName(input.agent.name || 'orbat_coordinator', 'orbat_coordinator'),
    model: llm,
    description: `Primary Orbat AI coordinator for ${input.agent.name || 'Workspace Assistant'}`,
    instruction: coordinatorInstruction,
    tools: allowCrm360 ? [searchTool, crmReadTool] : [searchTool],
    subAgents: [kbResearcherAgent, crmSpecialistAgent, escalationSpecialistAgent],
  });

  const runner = new InMemoryRunner({
    agent: coordinatorAgent,
    appName: `orbat_ws_${sanitizeAdkAgentName(input.workspaceId, 'default')}`,
  });

  const recentHistoryPrompt = input.history
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.content}`)
    .join('\n');
  const adkUserPrompt = recentHistoryPrompt
    ? `Recent conversation:\n${recentHistoryPrompt}\n\nCustomer latest message: ${input.message}`
    : input.message;

  const adkRunStart = Date.now();
  let finalReplyText = '';
  let respondingAuthor = coordinatorAgent.name;
  const subAgentsVisited = new Set<string>();

  try {
    const events: Event[] = [];
    for await (const ev of runner.runEphemeral({
      userId: input.visitorId || input.conversationId,
      newMessage: { role: 'user', parts: [{ text: adkUserPrompt }] },
    })) {
      events.push(ev);
      if (ev.author && ev.author !== 'user') {
        subAgentsVisited.add(ev.author);
        respondingAuthor = ev.author;
      }

      const fnCalls = getFunctionCalls(ev);
      if (fnCalls.length > 0) {
        for (const fc of fnCalls) {
          trace.push({
            node: `adk:${ev.author || 'coordinator'}:tool_call`,
            status: 'ok',
            summary: `${ev.author || 'coordinator'} called ${fc.name}`,
            detail: { tool: fc.name, args: fc.args ?? {} },
            durationMs: Date.now() - adkRunStart,
          });
        }
      }

      const fnResps = getFunctionResponses(ev);
      if (fnResps.length > 0) {
        for (const fr of fnResps) {
          trace.push({
            node: `adk:${ev.author || 'coordinator'}:tool_result`,
            status: 'ok',
            summary: `Tool ${fr.name} responded`,
            durationMs: Date.now() - adkRunStart,
          });
        }
      }

      if (ev.actions?.transferToAgent) {
        trace.push({
          node: 'adk_transfer',
          status: 'ok',
          summary: `${ev.author || 'coordinator'} delegated to ${ev.actions.transferToAgent}`,
          detail: { targetAgent: ev.actions.transferToAgent },
          durationMs: Date.now() - adkRunStart,
        });
      }

      if (isFinalResponse(ev)) {
        const text = stringifyContent(ev).trim();
        if (text) {
          finalReplyText = text;
        }
      }
    }

    if (services.customLlm && (events.length > 0 || finalReplyText)) {
      modelUsed = true;
    }
  } catch (err) {
    trace.push({
      node: 'adk_runner',
      status: 'error',
      summary: err instanceof Error ? err.message : 'ADK runner failed; applying grounded fallback',
      durationMs: Date.now() - adkRunStart,
    });
  }

  let shouldHandover = collector.explicitHandover.requested;
  let handoverReason: string | null = collector.explicitHandover.reason;
  let draftReply = finalReplyText
    .replace(/\[(?:SOURCE|HANDOVER|NOT_COVERED)[^\]]*\]/gi, '')
    .trim();

  if (finalReplyText && /\[HANDOVER(?::\s*([^\]]*))?\]/i.test(finalReplyText)) {
    const match = finalReplyText.match(/\[HANDOVER(?::\s*([^\]]*))?\]/i);
    shouldHandover = true;
    handoverReason = match?.[1]?.trim() || 'ADK agent recommended human specialist handover';
  }

  // Deterministic grounded KB fallback when no model is available or model returned empty text.
  if (!draftReply) {
    if (!collector.belowThreshold && collector.retrievalText && collector.sources.length > 0) {
      const firstChunk = collector.retrievalText.split('\n\n---\n\n')[0] || collector.retrievalText;
      const cleaned = firstChunk
        .replace(
          /^\[CHUNK \d+\][\r\n]+(?:Article:[^\r\n]*[\r\n]+)?(?:Section:[^\r\n]*[\r\n]+)?/i,
          '',
        )
        .replace(/\s+/g, ' ')
        .trim();
      draftReply = `${cleaned.slice(0, 360)}${cleaned.length > 360 ? '…' : ''}`;
    } else {
      shouldHandover = true;
      handoverReason =
        'No verified Knowledge Base match or model answer was available within this agent scope.';
      draftReply = localized(lang, {
        en: "I couldn't find a verified answer to that in our Knowledge Base, so I am connecting you with a specialist.",
        roman_ur:
          'Mujhe iska verified jawab Knowledge Base mein nahi mila, is liye main aapko specialist se connect kar raha hoon.',
        ur: 'مجھے اس کا تصدیق شدہ جواب نالج بیس میں نہیں ملا، اس لیے میں آپ کو ماہر سے منسلک کر رہا ہوں۔',
      });
    }
  }

  // Stage a CRM deal for commercial inquiries even if the model answered purely via text
  // without invoking the CRM tool explicitly, matching workspace pipeline automation.
  const commercialCue =
    /\b(pricing|price|quote|enterprise|demo|custom plan|annual contract|upgrade|seat|seats|license|trial extension)\b/i.test(
      input.message,
    );
  if (
    allowCrmDeal &&
    commercialCue &&
    !shouldHandover &&
    !collector.stagedActions.some((a) => a.toolName === 'crm_create_or_update_deal')
  ) {
    collector.stagedActions.push({
      toolName: 'crm_create_or_update_deal',
      summary: `Create CRM deal for "${input.visitorName || input.visitorEmail || 'Inbound Visitor'}" (stage=qualified)`,
      args: {
        visitorId: input.visitorId ?? undefined,
        title: `ADK Inbound Inquiry — ${(input.visitorName || input.visitorEmail || 'Visitor').slice(0, 80)}`,
        stage: 'qualified',
        valueCents: 0,
        currency: 'USD',
        probability: collector.confidence === 'high' ? 60 : 40,
        notes: input.message.slice(0, 500),
      },
    });
  }

  // Enforce Trust Ladder gating before sending reply or committing mutating CRM writes.
  const hasMutatingCrmStage = collector.stagedActions.some(
    (a) => a.toolName === 'crm_create_or_update_deal' || a.toolName === 'crm_create_followup_task',
  );
  const needsApprovalFromTrust =
    autonomyDecision.locked ||
    autonomyDecision.requiresHumanApproval ||
    autonomyDecision.mode === 'suggest' ||
    autonomyDecision.mode === 'shadow' ||
    autonomyDecision.mode === 'human_only';
  const requiresApproval =
    collector.explicitApproval.requested ||
    (!shouldHandover &&
      (needsApprovalFromTrust || (hasMutatingCrmStage && autonomyDecision.level < 4)));

  trace.push({
    node: 'adk_coordinator',
    status: requiresApproval ? 'paused' : 'ok',
    summary: `ADK run completed by ${respondingAuthor} (agents=${Array.from(subAgentsVisited).join(',') || coordinatorAgent.name}, model=${modelUsed}${modelNote ? `, ${modelNote}` : ''})`,
    detail: {
      respondingAuthor,
      subAgentsVisited: Array.from(subAgentsVisited),
      usingModel: modelUsed,
      requestedModel: resolvedModelCfg.requestedModel,
      requestedProvider: resolvedModelCfg.requestedProvider,
      requiresApproval,
      stagedActions: collector.stagedActions.map((a) => a.toolName),
    },
    durationMs: Date.now() - adkRunStart,
  });

  const citeAllowed = normalizeAgentRagConfig(input.agent.ragConfig).citations;
  const citedArticles = citeAllowed ? collector.sources.slice(0, 4) : [];
  const usedArticleIds = Array.from(new Set(collector.sources.map((s) => s.id).filter(Boolean)));
  const canAnswerFromDocs = collector.sources.length > 0 && !collector.belowThreshold;

  if (requiresApproval) {
    const approvalTopic = collector.explicitApproval.topic || autonomyDecision.topic;
    const approvalDraft = collector.explicitApproval.draftReply || draftReply;
    const approvalReason =
      collector.explicitApproval.reason ||
      (autonomyDecision.locked && autonomyDecision.lockReason
        ? autonomyDecision.lockReason
        : hasMutatingCrmStage
          ? `Human review required for CRM action under Trust Ladder (${autonomyDecision.levelLabel} · ${approvalTopic})`
          : `Trust Ladder policy (${autonomyDecision.levelLabel} · ${approvalTopic}) requires human approval before sending`);

    const runId = !input.dryRun
      ? await persistAgentRun(
          {
            workspaceId: input.workspaceId,
            conversationId: input.conversationId,
            visitorMessageId: input.visitorMessageId ?? null,
            agentId: input.agent.id,
            engineType: 'adk',
            threadId,
            status: 'paused_approval',
            topic: approvalTopic,
            pendingAction: {
              reason: approvalReason,
              pendingActions: collector.stagedActions,
              shouldHandover,
              handoverReason,
            },
            draftReply: approvalDraft,
            finalReply: null,
            trace,
          },
          dbQuery,
        )
      : null;

    const pendingApproval: PendingApprovalPayload = {
      threadId,
      runId,
      agentId: input.agent.id ?? null,
      agentName: input.agent.name || 'AI Assistant',
      topic: approvalTopic,
      autonomyLevel: autonomyDecision.level,
      reason: approvalReason,
      draftReply: approvalDraft,
      pendingActions: collector.stagedActions,
    };

    return {
      replyText: approvalDraft,
      action: 'awaiting_approval',
      engineUsed: 'adk',
      shouldHandover: false,
      handoverReason: null,
      canAnswerFromDocs,
      citedArticles,
      usedArticleIds,
      retrievalConfidence: collector.confidence,
      retrievalMethod: collector.retrievalMethod,
      ragTrace: collector.ragTrace,
      retrievedChunks: collector.retrievedChunks,
      topic: approvalTopic,
      intent,
      usingModel: modelUsed,
      autonomyDecision,
      pendingApproval,
      executedTools: collector.executedTools,
      trace,
      threadId,
      runId,
      latencyMs: Date.now() - startedAt,
    };
  }

  // No approval pause needed: execute any staged mutating tools safely.
  for (const staged of collector.stagedActions) {
    const res = await executeAgentTool(toolCtx, staged.toolName, staged.args);
    collector.executedTools.push({ toolName: staged.toolName, ok: res.ok, summary: res.summary });
  }

  const action = shouldHandover ? 'escalate' : 'reply';
  const runId = !input.dryRun
    ? await persistAgentRun(
        {
          workspaceId: input.workspaceId,
          conversationId: input.conversationId,
          visitorMessageId: input.visitorMessageId ?? null,
          agentId: input.agent.id,
          engineType: 'adk',
          threadId,
          status: 'completed',
          topic: autonomyDecision.topic,
          draftReply,
          finalReply: draftReply,
          trace,
        },
        dbQuery,
      )
    : null;

  return {
    replyText: draftReply,
    action,
    engineUsed: 'adk',
    shouldHandover,
    handoverReason,
    canAnswerFromDocs,
    citedArticles,
    usedArticleIds,
    retrievalConfidence: collector.confidence,
    retrievalMethod: collector.retrievalMethod,
    ragTrace: collector.ragTrace,
    retrievedChunks: collector.retrievedChunks,
    topic: autonomyDecision.topic,
    intent,
    usingModel: modelUsed,
    autonomyDecision,
    executedTools: collector.executedTools,
    trace,
    threadId,
    runId,
    latencyMs: Date.now() - startedAt,
  };
}

/**
 * Resumes a paused Google ADK approval run (`adk:...`) stored in `public.ai_agent_runs`,
 * executing staged workspace-scoped CRM tools only on explicit approval.
 */
export async function resumeAdkAgentRun(params: {
  workspaceId: string;
  threadId: string;
  approved: boolean;
  editedReply?: string | null;
  resolvedBy?: string | null;
  dryRun?: boolean;
  dbQuery?: DbQueryFn;
}): Promise<AgentExecutionResult> {
  const startedAt = Date.now();
  const dbQuery = params.dbQuery ?? queryRows;
  const run = await loadPausedAgentRun(params.workspaceId, params.threadId, dbQuery);
  if (!run) {
    throw new Error('ADK checkpoint not found or expired for this approval thread.');
  }
  if (run.workspace_id !== params.workspaceId) {
    throw new Error('Workspace isolation violation: thread does not belong to this workspace.');
  }

  const finalReply = params.approved
    ? (params.editedReply?.trim() || run.draft_reply || '').trim()
    : '';
  const pendingActions = Array.isArray(run.pending_action?.pendingActions)
    ? run.pending_action.pendingActions
    : [];

  const executedTools: Array<{ toolName: string; ok: boolean; summary: string }> = [];
  if (params.approved) {
    const toolCtx: AgentToolContext = {
      workspaceId: params.workspaceId,
      conversationId: run.conversation_id,
      agentId: run.agent_id,
      dryRun: params.dryRun,
      dbQuery,
    };
    for (const staged of pendingActions) {
      const res = await executeAgentTool(toolCtx, staged.toolName, staged.args);
      executedTools.push({ toolName: staged.toolName, ok: res.ok, summary: res.summary });
    }
  }

  const trace: AgentTraceStep[] = [
    ...(Array.isArray(run.trace) ? run.trace : []),
    {
      node: 'adk_human_resume',
      status: 'ok',
      summary: params.approved
        ? `Human approved ADK run (${executedTools.length} staged action(s) executed)`
        : 'Human rejected ADK run; staged CRM actions discarded',
      durationMs: Date.now() - startedAt,
    },
  ];

  const runId = !params.dryRun
    ? await persistAgentRun(
        {
          workspaceId: params.workspaceId,
          conversationId: run.conversation_id,
          visitorMessageId: run.visitor_message_id,
          agentId: run.agent_id,
          engineType: 'adk',
          threadId: params.threadId,
          status: params.approved ? 'completed' : 'rejected',
          topic: run.topic || 'General inquiries',
          pendingAction: {},
          finalReply: params.approved ? finalReply : null,
          trace,
          resolvedBy: params.resolvedBy ?? null,
        },
        dbQuery,
      )
    : run.id;

  return {
    replyText: finalReply,
    action: params.approved ? (run.pending_action?.shouldHandover ? 'escalate' : 'reply') : 'reply',
    engineUsed: 'adk',
    shouldHandover: params.approved ? Boolean(run.pending_action?.shouldHandover) : false,
    handoverReason: params.approved ? run.pending_action?.handoverReason ?? null : null,
    canAnswerFromDocs: true,
    citedArticles: [],
    usedArticleIds: [],
    retrievalConfidence: 'medium',
    retrievalMethod: 'none',
    topic: run.topic || 'General inquiries',
    intent: 'help_center_question',
    usingModel: true,
    autonomyDecision: {
      topic: run.topic || 'General inquiries',
      matchedPolicyTopic: run.topic || null,
      level: 3,
      levelLabel: 'Supervised',
      locked: false,
      lockReason: null,
      mode: 'supervised',
      allowAutoSend: true,
      requiresHumanApproval: false,
      queueForSupervisorAudit: true,
    },
    executedTools,
    trace,
    threadId: params.threadId,
    runId,
    latencyMs: Date.now() - startedAt,
  };
}
