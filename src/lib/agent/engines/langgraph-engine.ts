import crypto from 'node:crypto';
import {
  Annotation,
  Command,
  END,
  INTERRUPT,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
  type LangGraphRunnableConfig,
} from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import {
  normalizeAgentRagConfig,
  normalizeKnowledgeScope,
  type RagTrace,
} from '@/lib/ai/agent-templates';
import type { CitableArticle } from '@/lib/ai/help-answer';
import { classifyByRules, localized, replyLanguageOf } from '@/lib/ai/intent';
import { executePlatformAiReply, getPlatformAiConfigServerOnly } from '@/lib/ai/platform-gateway';
import { chat, isConfigured, type ProviderConfig } from '@/lib/ai/provider';
import { buildSupportAgentPrompt } from '@/lib/ai/support-agent';
import {
  getArticleSectionNames,
  getAutonomyPoliciesForAgent,
  resolveAutonomyDecision,
  type AutonomyDecision,
  type AutonomyPolicyRecord,
} from '@/lib/ai/trust-ladder';
import { getDbPool, queryRows } from '@/lib/db';
import {
  executeAgentTool,
  type AgentToolContext,
  type DbQueryFn,
  type SearchKnowledgeFn,
} from '@/lib/agent/tools/registry';
import type {
  AgentExecutionInput,
  AgentExecutionResult,
  AgentRuntimeProfile,
  AgentTraceStep,
  ChatTurn,
  PendingApprovalPayload,
  StagedToolAction,
} from './types';

/* ── Checkpointer Singleton (Postgres in production, MemorySaver in tests) ─ */

let pgSaverPromise: Promise<BaseCheckpointSaver> | null = null;
const memorySaverSingleton = new MemorySaver();

/**
 * Returns a persistent PostgreSQL LangGraph checkpointer when `DATABASE_URL`
 * is available, falling back cleanly to an in-memory saver for tests/dry-runs.
 */
export async function getLangGraphCheckpointer(options?: {
  forceMemory?: boolean;
}): Promise<BaseCheckpointSaver> {
  if (options?.forceMemory || !process.env.DATABASE_URL) {
    return memorySaverSingleton;
  }
  if (!pgSaverPromise) {
    pgSaverPromise = (async () => {
      try {
        const saver = new PostgresSaver(getDbPool());
        await saver.setup();
        return saver;
      } catch (err) {
        console.warn('[LangGraph] PostgresSaver init failed, falling back to MemorySaver:', err);
        pgSaverPromise = null;
        return memorySaverSingleton;
      }
    })();
  }
  return pgSaverPromise;
}

/* ── Runtime Services Passed via `configurable` (Never Serialized) ─────── */

export interface LangGraphRuntimeServices {
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
  }) => Promise<string | null>;
}

export interface LangGraphRunOptions {
  checkpointer?: BaseCheckpointSaver;
  services?: LangGraphRuntimeServices;
}

interface HumanApprovalResumeValue {
  approved: boolean;
  editedReply?: string | null;
  resolvedBy?: string | null;
}

interface ApprovalInterruptPayload {
  threadId: string;
  agentId: string | null;
  agentName: string;
  topic: string;
  autonomyLevel: AutonomyDecision['level'];
  reason: string;
  draftReply: string;
  pendingActions: StagedToolAction[];
}

interface RetrievalStatePayload {
  text: string;
  sources: CitableArticle[];
  belowThreshold: boolean;
  confidence: 'high' | 'medium' | 'low';
  retrievalMethod: 'semantic_rag' | 'keyword_fallback' | 'none';
  ragTrace?: RagTrace;
}

/* ── Serializable LangGraph State Definition ────────────────────────────── */

const DEFAULT_AUTONOMY_DECISION: AutonomyDecision = {
  topic: 'General inquiries',
  matchedPolicyTopic: null,
  level: 2,
  levelLabel: 'Suggest',
  locked: false,
  lockReason: null,
  mode: 'suggest',
  allowAutoSend: false,
  requiresHumanApproval: true,
  queueForSupervisorAudit: true,
};

const EMPTY_RETRIEVAL: RetrievalStatePayload = {
  text: '',
  sources: [],
  belowThreshold: true,
  confidence: 'low',
  retrievalMethod: 'none',
};

const LangGraphAgentAnnotation = Annotation.Root({
  threadId: Annotation<string>(),
  workspaceId: Annotation<string>(),
  workspaceName: Annotation<string>(),
  conversationId: Annotation<string>(),
  visitorMessageId: Annotation<string | null>(),
  visitorId: Annotation<string | null>(),
  visitorName: Annotation<string | null>(),
  visitorEmail: Annotation<string | null>(),
  channel: Annotation<string>(),
  helpCenterUrl: Annotation<string | null>(),
  message: Annotation<string>(),
  history: Annotation<ChatTurn[]>(),
  humanContext: Annotation<string | null>(),
  agent: Annotation<AgentRuntimeProfile>(),
  autonomyPolicies: Annotation<AutonomyPolicyRecord[]>(),
  dryRun: Annotation<boolean>(),

  intent: Annotation<string>(),
  wantsHuman: Annotation<boolean>(),
  blockedTopic: Annotation<string | null>(),
  needsCustomer360: Annotation<boolean>(),
  retrieval: Annotation<RetrievalStatePayload>(),
  customer360Summary: Annotation<string | null>(),
  autonomyDecision: Annotation<AutonomyDecision>(),
  stagedActions: Annotation<StagedToolAction[]>(),
  executedTools: Annotation<Array<{ toolName: string; ok: boolean; summary: string }>>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  draftReply: Annotation<string>(),
  usingModel: Annotation<boolean>(),
  requiresApproval: Annotation<boolean>(),
  approvalReason: Annotation<string | null>(),
  humanResolution: Annotation<HumanApprovalResumeValue | null>(),
  action: Annotation<'reply' | 'escalate' | 'awaiting_approval'>(),
  shouldHandover: Annotation<boolean>(),
  handoverReason: Annotation<string | null>(),
  trace: Annotation<AgentTraceStep[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type GraphState = typeof LangGraphAgentAnnotation.State;

function getServices(config?: LangGraphRunnableConfig): LangGraphRuntimeServices {
  const raw = (config?.configurable as Record<string, unknown> | undefined)?.__services;
  return (raw as LangGraphRuntimeServices | undefined) || {};
}

function buildToolContext(
  state: GraphState,
  services: LangGraphRuntimeServices,
  overrideDryRun?: boolean,
): AgentToolContext {
  return {
    workspaceId: state.workspaceId,
    conversationId: state.conversationId,
    visitorId: state.visitorId,
    visitorEmail: state.visitorEmail,
    agentId: state.agent.id,
    agentName: state.agent.name,
    handoffGroupId: state.agent.handoffGroupId ?? null,
    knowledgeScope: state.agent.knowledgeScope ?? null,
    ragConfig: state.agent.ragConfig ?? null,
    helpCenterUrl: state.helpCenterUrl ?? null,
    providerConfig: services.providerConfig ?? null,
    historyTurns: state.history,
    dryRun: overrideDryRun ?? state.dryRun,
    dbQuery: services.dbQuery,
    searchKnowledgeFn: services.searchKnowledgeFn,
  };
}

async function defaultGenerateReply(params: {
  workspaceId: string;
  conversationId: string;
  system: string;
  messages: ChatTurn[];
  providerConfig?: ProviderConfig | null;
}): Promise<string | null> {
  if (params.providerConfig && isConfigured(params.providerConfig)) {
    const res = await chat(params.providerConfig, {
      system: params.system,
      messages: params.messages,
      maxTokens: 550,
      temperature: 0.1,
      reasoning: 'fast',
    });
    return res.text?.trim() || null;
  }

  const platform = await getPlatformAiConfigServerOnly().catch(() => null);
  if (platform?.isEnabled && platform.config && isConfigured(platform.config)) {
    const exec = await executePlatformAiReply({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      providerConfig: platform.config,
      request: {
        system: params.system,
        messages: params.messages,
        maxTokens: 550,
        temperature: 0.1,
        reasoning: 'fast',
      },
      countReply: false,
    }).catch(() => null);
    if (exec?.ok && exec.text) return exec.text.trim();
  }
  return null;
}

const COMMERCIAL_DEAL_PATTERN =
  /\b(pricing|price|quote|enterprise|demo|custom plan|annual contract|upgrade|seat|seats|license|trial extension)\b/i;
const CUSTOMER_360_PATTERN =
  /\b(order|account|plan|price|pricing|quote|demo|enterprise|refund|subscription|invoice|billing|cancel|vip|deal|status|ticket)\b/i;
const REFUND_OR_CANCELLATION_PATTERN =
  /\b(refund|chargeback|dispute|cancel(?:lation)?|reimburse|credit back)\b/i;

/* ── LangGraph Nodes ────────────────────────────────────────────────────── */

async function understandAndRouteNode(state: GraphState): Promise<Partial<GraphState>> {
  const started = Date.now();
  const verdict = classifyByRules(state.message, state.history);
  const lower = state.message.toLowerCase();

  const blockedTopic =
    (state.agent.escalationRules?.blockedTopics || []).find((topic: string) =>
      topic.trim() ? lower.includes(topic.trim().toLowerCase()) : false,
    ) || null;

  const wantsHuman = verdict.intent === 'wants_human' || Boolean(blockedTopic);
  const needsCustomer360 =
    !wantsHuman &&
    (verdict.intent === 'account_specific' ||
      CUSTOMER_360_PATTERN.test(state.message) ||
      Boolean(state.visitorId || state.visitorEmail));

  return {
    intent: verdict.intent,
    wantsHuman,
    blockedTopic,
    needsCustomer360,
    trace: [
      {
        node: 'understand_and_route',
        status: 'ok',
        summary: blockedTopic
          ? `Blocked topic matched: "${blockedTopic}"`
          : `Intent=${verdict.intent}, CRM360=${needsCustomer360}`,
        detail: {
          intent: verdict.intent,
          blockedTopic,
          needsCustomer360,
        },
        durationMs: Date.now() - started,
      },
    ],
  };
}

async function retrieveRagAndCrmNode(
  state: GraphState,
  config?: LangGraphRunnableConfig,
): Promise<Partial<GraphState>> {
  const started = Date.now();
  if (state.wantsHuman) {
    return {
      retrieval: EMPTY_RETRIEVAL,
      trace: [
        {
          node: 'retrieve_rag',
          status: 'skipped',
          summary: 'Skipped retrieval because escalation/blocked rule matched',
          durationMs: Date.now() - started,
        },
      ],
    };
  }

  const services = getServices(config);
  const toolCtx = buildToolContext(state, services);
  const executedTools: Array<{ toolName: string; ok: boolean; summary: string }> = [];

  const ragRes = await executeAgentTool(toolCtx, 'search_knowledge', {
    query: state.message,
    limit: normalizeAgentRagConfig(state.agent.ragConfig).topK,
  });
  executedTools.push({
    toolName: 'search_knowledge',
    ok: ragRes.ok,
    summary: ragRes.summary,
  });

  const rawRag = (ragRes.data as {
    text?: string;
    sources?: CitableArticle[];
    belowThreshold?: boolean;
    confidence?: 'high' | 'medium' | 'low';
    chunks?: Array<{ similarity?: number; combined_score?: number }>;
    ragTrace?: RagTrace;
  }) || {};

  const sources = Array.isArray(rawRag.sources) ? rawRag.sources : [];
  const retrievalMethod: RetrievalStatePayload['retrievalMethod'] =
    rawRag.chunks && rawRag.chunks.length > 0
      ? 'semantic_rag'
      : sources.length > 0
        ? 'keyword_fallback'
        : 'none';

  let customer360Summary: string | null = null;
  if (state.needsCustomer360 && (state.visitorId || state.visitorEmail)) {
    const crmRes = await executeAgentTool(toolCtx, 'crm_get_customer_360', {
      ...(state.visitorId ? { visitorId: state.visitorId } : {}),
      ...(state.visitorEmail ? { email: state.visitorEmail } : {}),
    });
    executedTools.push({
      toolName: 'crm_get_customer_360',
      ok: crmRes.ok,
      summary: crmRes.summary,
    });
    if (crmRes.ok && crmRes.data) {
      const crm = crmRes.data as {
        visitor?: Record<string, unknown> | null;
        orders?: Array<Record<string, unknown>>;
        deals?: Array<Record<string, unknown>>;
        openTasks?: Array<Record<string, unknown>>;
        recentTickets?: Array<Record<string, unknown>>;
      };
      const parts: string[] = [];
      if (crm.visitor) {
        parts.push(
          `Customer: ${crm.visitor.name || 'Visitor'} (segment=${crm.visitor.segment || 'standard'}, plan=${crm.visitor.plan || 'n/a'})`,
        );
      }
      if (crm.orders?.length) {
        parts.push(
          `Recent orders: ${crm.orders.map((o) => `#${o.order_number} (${o.status})`).join(', ')}`,
        );
      }
      if (crm.deals?.length) {
        parts.push(
          `Active deals: ${crm.deals.map((d) => `${d.title} [${d.stage}]`).join(', ')}`,
        );
      }
      if (crm.openTasks?.length) {
        parts.push(`Open CRM tasks: ${crm.openTasks.map((t) => String(t.title)).join(', ')}`);
      }
      if (crm.recentTickets?.length) {
        parts.push(
          `Recent tickets: ${crm.recentTickets.map((t) => `#${t.number} (${t.status})`).join(', ')}`,
        );
      }
      customer360Summary = parts.length ? parts.join('\n') : null;
    }
  }

  return {
    retrieval: {
      text: rawRag.text || '',
      sources,
      belowThreshold: Boolean(rawRag.belowThreshold),
      confidence: rawRag.confidence || (sources.length > 0 ? 'medium' : 'low'),
      retrievalMethod,
      ragTrace: rawRag.ragTrace,
    },
    customer360Summary,
    executedTools,
    trace: [
      {
        node: 'retrieve_rag',
        status: 'ok',
        summary: `Retrieved ${sources.length} source(s) via ${retrievalMethod}${customer360Summary ? ' + Customer 360 CRM' : ''}`,
        detail: {
          sourcesCount: sources.length,
          retrievalMethod,
          hasCustomer360: Boolean(customer360Summary),
        },
        durationMs: Date.now() - started,
      },
    ],
  };
}

async function planOrToolNode(
  state: GraphState,
  config?: LangGraphRunnableConfig,
): Promise<Partial<GraphState>> {
  const started = Date.now();
  const services = getServices(config);
  const lang = replyLanguageOf(state.message);

  // 1. Load or use injected Trust Ladder policies & resolve decision for this turn
  let policies = state.autonomyPolicies || [];
  if (policies.length === 0 && state.agent.id && services.getAutonomyPoliciesFn !== undefined) {
    policies = await services
      .getAutonomyPoliciesFn(state.workspaceId, state.agent.id)
      .catch(() => []);
  } else if (policies.length === 0 && state.agent.id && !state.dryRun && process.env.DATABASE_URL) {
    policies = await getAutonomyPoliciesForAgent(state.workspaceId, state.agent.id).catch(() => []);
  }

  const citedIds = state.retrieval.sources
    .filter((s) => s.kind !== 'knowledge')
    .map((s) => s.id);
  const getSectionsFn = services.getSectionNamesFn ?? getArticleSectionNames;
  const citedSectionNames =
    citedIds.length > 0 && (services.getSectionNamesFn || process.env.DATABASE_URL)
      ? await getSectionsFn(state.workspaceId, citedIds).catch(() => [])
      : [];

  const autonomyDecision = resolveAutonomyDecision({
    policies,
    message: state.message,
    citedSectionNames,
  });

  // 2. Handle explicit human request / blocked topic immediately
  const stagedActions: StagedToolAction[] = [];
  if (state.blockedTopic || state.wantsHuman) {
    const reason = state.blockedTopic
      ? `Blocked topic matched: "${state.blockedTopic}"`
      : 'Customer requested a human specialist';
    stagedActions.push({
      toolName: 'escalate_to_team_group',
      summary: reason,
      args: {
        reason,
        priority: 'high',
        groupId: state.agent.handoffGroupId ?? undefined,
      },
    });
    const handoffText = localized(lang, {
      en: state.blockedTopic
        ? 'Our team handles this topic personally, so I am connecting you with a specialist right now.'
        : 'Of course — let me connect you directly with a member of our team right now.',
      roman_ur:
        'Main aapko abhi hamari team ke specialist se connect kar raha hoon taake wo aapki behtar madad kar sakein.',
      ur: 'میں آپ کو ابھی ہماری ٹیم کے ماہر سے منسلک کر رہا ہوں۔',
    });

    return {
      autonomyDecision,
      stagedActions,
      draftReply: handoffText,
      usingModel: false,
      requiresApproval: false,
      approvalReason: null,
      shouldHandover: true,
      handoverReason: reason,
      trace: [
        {
          node: 'plan_or_tool',
          status: 'ok',
          summary: `Prepared direct escalation: ${reason}`,
          durationMs: Date.now() - started,
        },
      ],
    };
  }

  // 3. Stage CRM actions when commercial intent or sensitive refund follow-up applies
  const visitorLabel = state.visitorName?.trim() || state.visitorEmail?.trim() || 'Workspace Visitor';
  if (COMMERCIAL_DEAL_PATTERN.test(state.message)) {
    stagedActions.push({
      toolName: 'crm_create_or_update_deal',
      summary: `Create qualified deal for ${visitorLabel}`,
      args: {
        ...(state.visitorId ? { visitorId: state.visitorId } : {}),
        title: `${visitorLabel} — Inbound Inquiry`,
        stage: 'qualified',
        valueCents: 0,
        currency: 'USD',
        probability: 40,
        notes: `Triggered from conversation message: "${state.message.slice(0, 220)}"`,
      },
    });
  }
  if (REFUND_OR_CANCELLATION_PATTERN.test(state.message)) {
    stagedActions.push({
      toolName: 'crm_create_followup_task',
      summary: `Schedule high-priority Billing/Refund follow-up for ${visitorLabel}`,
      args: {
        ...(state.visitorId ? { visitorId: state.visitorId } : {}),
        title: `Review billing/refund request from ${visitorLabel}`,
        description: state.message.slice(0, 500),
        kind: 'follow_up',
        priority: 'high',
        dueInHours: 4,
      },
    });
  }

  // 4. Draft reply via configured AI provider (or deterministic KB fallback when offline/no key)
  const effectiveAnswerMode = state.agent.answerMode === 'strict' ? 'strict' : 'agent';
  const customInstructions = [
    state.agent.systemPrompt?.trim() || '',
    state.agent.tone ? `Tone: ${state.agent.tone}` : '',
    `Answer mode: ${effectiveAnswerMode === 'strict' ? 'strict (answer only from retrieved sources)' : 'agent'}`,
    state.agent.guardrails?.length
      ? `Guardrails:\n${state.agent.guardrails.map((g) => `- ${g}`).join('\n')}`
      : '',
    state.customer360Summary ? `# CUSTOMER 360 CRM CONTEXT\n${state.customer360Summary}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt = buildSupportAgentPrompt({
    botName: state.agent.name || 'AI Assistant',
    businessName: state.workspaceName || 'Workspace',
    industry: state.agent.industry ?? null,
    knowledge:
      state.retrieval.text ||
      'No published Help Center articles matched within this agent Knowledge Scope.',
    lang,
    customInstructions,
    visitorName: state.visitorName ?? null,
  });

  const generateFn = services.generateReplyFn ?? defaultGenerateReply;
  let draftReply = await generateFn({
    workspaceId: state.workspaceId,
    conversationId: state.conversationId,
    system: systemPrompt,
    messages: [...state.history.slice(-6), { role: 'user', content: state.message }],
    providerConfig: services.providerConfig ?? null,
  }).catch(() => null);

  const usingModel = Boolean(draftReply);
  let shouldHandover = false;
  let handoverReason: string | null = null;

  if (!draftReply) {
    if (!state.retrieval.belowThreshold && state.retrieval.text && state.retrieval.sources.length > 0) {
      const firstChunk = state.retrieval.text.split('\n\n---\n\n')[0] || state.retrieval.text;
      const cleaned = firstChunk
        .replace(/^\[CHUNK \d+\][\r\n]+(?:Article:[^\r\n]*[\r\n]+)?(?:Section:[^\r\n]*[\r\n]+)?/i, '')
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
  } else if (/\[HANDOVER(?::\s*([^\]]*))?\]/i.test(draftReply)) {
    const match = draftReply.match(/\[HANDOVER(?::\s*([^\]]*))?\]/i);
    shouldHandover = true;
    handoverReason = match?.[1]?.trim() || 'Model recommended human specialist handover';
    draftReply = draftReply.replace(/\[(?:SOURCE|HANDOVER|NOT_COVERED)[^\]]*\]/gi, '').trim();
  } else {
    draftReply = draftReply.replace(/\[(?:SOURCE|HANDOVER|NOT_COVERED)[^\]]*\]/gi, '').trim();
  }

  // 5. Decide whether Trust Ladder or mutating CRM actions require human approval pause
  const hasMutatingCrmStage = stagedActions.some(
    (a) => a.toolName === 'crm_create_or_update_deal' || a.toolName === 'crm_create_followup_task',
  );
  const needsApprovalFromTrust =
    autonomyDecision.locked ||
    autonomyDecision.requiresHumanApproval ||
    autonomyDecision.mode === 'suggest' ||
    autonomyDecision.mode === 'shadow' ||
    autonomyDecision.mode === 'human_only';
  const requiresApproval =
    !shouldHandover &&
    (needsApprovalFromTrust || (hasMutatingCrmStage && autonomyDecision.level < 4));

  const approvalReason = requiresApproval
    ? autonomyDecision.locked && autonomyDecision.lockReason
      ? autonomyDecision.lockReason
      : hasMutatingCrmStage
        ? `Human review required for CRM action under Trust Ladder (${autonomyDecision.levelLabel} · ${autonomyDecision.topic})`
        : `Trust Ladder policy (${autonomyDecision.levelLabel} · ${autonomyDecision.topic}) requires human approval before sending`
    : null;

  return {
    autonomyDecision,
    stagedActions,
    draftReply,
    usingModel,
    requiresApproval,
    approvalReason,
    shouldHandover,
    handoverReason,
    trace: [
      {
        node: 'plan_or_tool',
        status: 'ok',
        summary: `Drafted reply (${usingModel ? 'LLM' : 'KB fallback'}), Trust=${autonomyDecision.levelLabel} (${autonomyDecision.topic}), staged=${stagedActions.length}`,
        detail: {
          usingModel,
          autonomyLevel: autonomyDecision.level,
          topic: autonomyDecision.topic,
          requiresApproval,
          stagedTools: stagedActions.map((a) => a.toolName),
        },
        durationMs: Date.now() - started,
      },
    ],
  };
}

async function policyApprovalGateNode(state: GraphState): Promise<Partial<GraphState>> {
  const started = Date.now();
  if (!state.requiresApproval) {
    return {
      humanResolution: null,
      trace: [
        {
          node: 'policy_approval_gate',
          status: 'skipped',
          summary: `Auto-approved under Trust Ladder (${state.autonomyDecision.levelLabel})`,
          durationMs: Date.now() - started,
        },
      ],
    };
  }

  if (state.dryRun) {
    return {
      humanResolution: { approved: true, editedReply: null, resolvedBy: 'playground-dry-run' },
      trace: [
        {
          node: 'policy_approval_gate',
          status: 'paused',
          summary: `Playground dry-run: live execution would pause here (${state.approvalReason || 'human approval'})`,
          detail: {
            wouldPause: true,
            reason: state.approvalReason,
            stagedActions: state.stagedActions.map((s) => s.toolName),
          },
          durationMs: Date.now() - started,
        },
      ],
    };
  }

  // Real LangGraph checkpoint interrupt: suspends graph execution cleanly until
  // resumed with `new Command({ resume: { approved, editedReply, resolvedBy } })`.
  const resolution = interrupt<ApprovalInterruptPayload, HumanApprovalResumeValue>({
    threadId: state.threadId,
    agentId: state.agent.id,
    agentName: state.agent.name,
    topic: state.autonomyDecision.topic,
    autonomyLevel: state.autonomyDecision.level,
    reason: state.approvalReason || 'Trust Ladder human approval required',
    draftReply: state.draftReply,
    pendingActions: state.stagedActions,
  });

  return {
    humanResolution: resolution,
    trace: [
      {
        node: 'policy_approval_gate',
        status: 'ok',
        summary: resolution?.approved
          ? `Resumed with human approval${resolution.resolvedBy ? ` by ${resolution.resolvedBy}` : ''}`
          : 'Resumed as rejected by human reviewer',
        durationMs: Date.now() - started,
      },
    ],
  };
}

async function finalizeReplyNode(
  state: GraphState,
  config?: LangGraphRunnableConfig,
): Promise<Partial<GraphState>> {
  const started = Date.now();
  const services = getServices(config);
  const executedTools: Array<{ toolName: string; ok: boolean; summary: string }> = [];

  if (state.humanResolution && state.humanResolution.approved === false) {
    return {
      action: 'escalate',
      shouldHandover: true,
      handoverReason: state.handoverReason || 'Draft rejected by human reviewer in Inbox',
      draftReply: state.draftReply,
      trace: [
        {
          node: 'finalize_reply',
          status: 'ok',
          summary: 'Draft rejected by reviewer; no customer message sent and no CRM writes applied',
          durationMs: Date.now() - started,
        },
      ],
    };
  }

  const finalReply = state.humanResolution?.editedReply?.trim()
    ? state.humanResolution.editedReply.trim()
    : state.draftReply;

  // Execute staged tools unless dryRun (CRM read/write tools are dryRun-safe inside registry too)
  const toolCtx = buildToolContext(state, services, state.dryRun);
  for (const staged of state.stagedActions) {
    if (staged.toolName === 'escalate_to_team_group') {
      const res = await executeAgentTool(toolCtx, staged.toolName, staged.args);
      executedTools.push({ toolName: staged.toolName, ok: res.ok, summary: res.summary });
      continue;
    }
    const res = await executeAgentTool(toolCtx, staged.toolName, staged.args);
    executedTools.push({ toolName: staged.toolName, ok: res.ok, summary: res.summary });
  }

  const action: GraphState['action'] = state.shouldHandover ? 'escalate' : 'reply';
  return {
    draftReply: finalReply,
    executedTools,
    action,
    trace: [
      {
        node: 'finalize_reply',
        status: 'ok',
        summary: `Finalized action=${action} with ${executedTools.length} tool execution(s)`,
        durationMs: Date.now() - started,
      },
    ],
  };
}

/* ── Graph Factory ──────────────────────────────────────────────────────── */

function createCompiledLangGraph(checkpointer: BaseCheckpointSaver) {
  return new StateGraph(LangGraphAgentAnnotation)
    .addNode('understand_and_route', understandAndRouteNode)
    .addNode('retrieve_rag', retrieveRagAndCrmNode)
    .addNode('plan_or_tool', planOrToolNode)
    .addNode('policy_approval_gate', policyApprovalGateNode)
    .addNode('finalize_reply', finalizeReplyNode)
    .addEdge(START, 'understand_and_route')
    .addEdge('understand_and_route', 'retrieve_rag')
    .addEdge('retrieve_rag', 'plan_or_tool')
    .addEdge('plan_or_tool', 'policy_approval_gate')
    .addEdge('policy_approval_gate', 'finalize_reply')
    .addEdge('finalize_reply', END)
    .compile({ checkpointer });
}

/* ── Run Persistence Helper (`public.ai_agent_runs`) ────────────────────── */

async function persistAgentRun(
  params: {
    workspaceId: string;
    conversationId: string;
    visitorMessageId?: string | null;
    agentId?: string | null;
    threadId: string;
    status: 'running' | 'paused_approval' | 'completed' | 'rejected' | 'failed';
    topic: string;
    pendingAction?: Record<string, unknown>;
    draftReply?: string | null;
    finalReply?: string | null;
    trace: AgentTraceStep[];
    resolvedBy?: string | null;
  },
  db: DbQueryFn = queryRows,
): Promise<string | null> {
  if (!process.env.DATABASE_URL && db === queryRows) return null;
  try {
    const rows = await db<{ id: string }>(
      `INSERT INTO public.ai_agent_runs (
         workspace_id, conversation_id, visitor_message_id, agent_id, engine_type,
         thread_id, status, topic, pending_action, draft_reply, final_reply, trace,
         resolved_by, resolved_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, 'langgraph',
         $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb,
         $12, CASE WHEN $6 IN ('completed', 'rejected', 'failed') THEN now() ELSE NULL END, now()
       )
       ON CONFLICT (thread_id) DO UPDATE SET
         status = EXCLUDED.status,
         topic = EXCLUDED.topic,
         pending_action = EXCLUDED.pending_action,
         draft_reply = COALESCE(EXCLUDED.draft_reply, public.ai_agent_runs.draft_reply),
         final_reply = COALESCE(EXCLUDED.final_reply, public.ai_agent_runs.final_reply),
         trace = EXCLUDED.trace,
         resolved_by = COALESCE(EXCLUDED.resolved_by, public.ai_agent_runs.resolved_by),
         resolved_at = CASE
           WHEN EXCLUDED.status IN ('completed', 'rejected', 'failed') THEN now()
           ELSE public.ai_agent_runs.resolved_at
         END,
         updated_at = now()
       RETURNING id`,
      [
        params.workspaceId,
        params.conversationId,
        params.visitorMessageId ?? null,
        params.agentId ?? null,
        params.threadId,
        params.status,
        params.topic,
        JSON.stringify(params.pendingAction || {}),
        params.draftReply ?? null,
        params.finalReply ?? null,
        JSON.stringify(params.trace || []),
        params.resolvedBy ?? null,
      ],
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

function buildResultFromState(
  state: GraphState,
  startedAt: number,
  runId: string | null,
  interruptPayload?: ApprovalInterruptPayload | null,
): AgentExecutionResult {
  const sources = state.retrieval?.sources || [];
  const citedArticles = normalizeAgentRagConfig(state.agent.ragConfig).citations
    ? sources.slice(0, 4)
    : [];
  const usedArticleIds = Array.from(new Set(sources.map((s) => s.id).filter(Boolean)));

  if (interruptPayload) {
    const pendingApproval: PendingApprovalPayload = {
      threadId: interruptPayload.threadId || state.threadId,
      runId,
      agentId: interruptPayload.agentId ?? state.agent.id ?? null,
      agentName: interruptPayload.agentName || state.agent.name,
      topic: interruptPayload.topic || state.autonomyDecision.topic,
      autonomyLevel: interruptPayload.autonomyLevel || state.autonomyDecision.level,
      reason: interruptPayload.reason,
      draftReply: interruptPayload.draftReply,
      pendingActions: interruptPayload.pendingActions || [],
    };
    return {
      replyText: interruptPayload.draftReply,
      action: 'awaiting_approval',
      engineUsed: 'langgraph',
      shouldHandover: false,
      handoverReason: null,
      canAnswerFromDocs: sources.length > 0 && !state.retrieval.belowThreshold,
      citedArticles,
      usedArticleIds,
      retrievalConfidence: state.retrieval.confidence || 'low',
      retrievalMethod: state.retrieval.retrievalMethod || 'none',
      ragTrace: state.retrieval.ragTrace,
      topic: pendingApproval.topic,
      intent: state.intent || 'help_center_question',
      usingModel: Boolean(state.usingModel),
      autonomyDecision: state.autonomyDecision,
      pendingApproval,
      executedTools: state.executedTools || [],
      trace: [
        ...(state.trace || []),
        {
          node: 'policy_approval_gate',
          status: 'paused',
          summary: pendingApproval.reason,
          durationMs: Date.now() - startedAt,
        },
      ],
      threadId: state.threadId,
      runId,
      latencyMs: Date.now() - startedAt,
    };
  }

  return {
    replyText: state.draftReply,
    action: state.action || (state.shouldHandover ? 'escalate' : 'reply'),
    engineUsed: 'langgraph',
    shouldHandover: Boolean(state.shouldHandover),
    handoverReason: state.handoverReason ?? null,
    canAnswerFromDocs: sources.length > 0 && !state.retrieval?.belowThreshold,
    citedArticles,
    usedArticleIds,
    retrievalConfidence: state.retrieval?.confidence || 'low',
    retrievalMethod: state.retrieval?.retrievalMethod || 'none',
    ragTrace: state.retrieval?.ragTrace,
    topic: state.autonomyDecision?.topic || 'General inquiries',
    intent: state.intent || 'help_center_question',
    usingModel: Boolean(state.usingModel),
    autonomyDecision: state.autonomyDecision || DEFAULT_AUTONOMY_DECISION,
    executedTools: state.executedTools || [],
    trace: state.trace || [],
    threadId: state.threadId,
    runId,
    latencyMs: Date.now() - startedAt,
  };
}

/* ── Public Engine API ──────────────────────────────────────────────────── */

/**
 * Executes an AI agent turn inside the built-in LangGraph StateGraph with
 * PostgreSQL checkpointing and Trust Ladder human-in-the-loop interrupts.
 */
export async function runLangGraphAgent(
  input: AgentExecutionInput,
  options?: LangGraphRunOptions,
): Promise<AgentExecutionResult> {
  const startedAt = Date.now();
  const threadId =
    input.threadId?.trim() ||
    `lg:${input.workspaceId}:${input.conversationId}:${input.visitorMessageId || crypto.randomUUID()}`;

  const checkpointer =
    options?.checkpointer ??
    (await getLangGraphCheckpointer({ forceMemory: Boolean(input.dryRun) }));
  const graph = createCompiledLangGraph(checkpointer);
  const services: LangGraphRuntimeServices = {
    ...(options?.services || {}),
    providerConfig: options?.services?.providerConfig ?? input.providerConfig ?? null,
  };

  const rawResult = await graph.invoke(
    {
      threadId,
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName || 'Workspace',
      conversationId: input.conversationId,
      visitorMessageId: input.visitorMessageId ?? null,
      visitorId: input.visitorId ?? null,
      visitorName: input.visitorName ?? null,
      visitorEmail: input.visitorEmail ?? null,
      channel: input.channel || 'web',
      helpCenterUrl: input.helpCenterUrl ?? null,
      message: input.message,
      history: input.history || [],
      humanContext: input.humanContext ?? null,
      agent: {
        ...input.agent,
        knowledgeScope: normalizeKnowledgeScope(input.agent.knowledgeScope),
        ragConfig: normalizeAgentRagConfig(input.agent.ragConfig),
      },
      autonomyPolicies: input.autonomyPolicies || [],
      dryRun: Boolean(input.dryRun),

      intent: 'help_center_question',
      wantsHuman: false,
      blockedTopic: null,
      needsCustomer360: false,
      retrieval: EMPTY_RETRIEVAL,
      customer360Summary: null,
      autonomyDecision: DEFAULT_AUTONOMY_DECISION,
      stagedActions: [],
      executedTools: [],
      draftReply: '',
      usingModel: false,
      requiresApproval: false,
      approvalReason: null,
      humanResolution: null,
      action: 'reply',
      shouldHandover: false,
      handoverReason: null,
      trace: [],
    },
    {
      configurable: {
        thread_id: threadId,
        __services: services,
      },
    },
  );

  const interrupts = (
    rawResult as unknown as Record<string, Array<{ value: ApprovalInterruptPayload }> | undefined>
  )[String(INTERRUPT)];
  const interruptPayload = Array.isArray(interrupts) ? interrupts[0]?.value ?? null : null;

  const runId = !input.dryRun
    ? await persistAgentRun(
        {
          workspaceId: input.workspaceId,
          conversationId: input.conversationId,
          visitorMessageId: input.visitorMessageId ?? null,
          agentId: input.agent.id,
          threadId,
          status: interruptPayload ? 'paused_approval' : 'completed',
          topic: interruptPayload?.topic || rawResult.autonomyDecision?.topic || 'General inquiries',
          pendingAction: interruptPayload
            ? {
                reason: interruptPayload.reason,
                pendingActions: interruptPayload.pendingActions,
              }
            : {},
          draftReply: interruptPayload?.draftReply || rawResult.draftReply,
          finalReply: interruptPayload ? null : rawResult.draftReply,
          trace: rawResult.trace || [],
        },
        services.dbQuery,
      )
    : null;

  return buildResultFromState(rawResult, startedAt, runId, interruptPayload);
}

/**
 * Resumes a paused LangGraph execution thread from its checkpoint with either
 * human approval (executing staged CRM tools and returning final reply) or rejection.
 */
export async function resumeLangGraphAgentRun(params: {
  workspaceId: string;
  threadId: string;
  approved: boolean;
  editedReply?: string | null;
  resolvedBy?: string | null;
  checkpointer?: BaseCheckpointSaver;
  services?: LangGraphRuntimeServices;
  dryRun?: boolean;
}): Promise<AgentExecutionResult> {
  const startedAt = Date.now();
  const checkpointer =
    params.checkpointer ??
    (await getLangGraphCheckpointer({ forceMemory: Boolean(params.dryRun) }));
  const graph = createCompiledLangGraph(checkpointer);
  const config: LangGraphRunnableConfig = {
    configurable: {
      thread_id: params.threadId,
      __services: params.services || {},
    },
  };

  // Enforce workspace isolation against checkpointed thread state before resuming.
  const snapshot = await graph.getState(config);
  const snapshotWs = (snapshot?.values as Partial<GraphState> | undefined)?.workspaceId;
  if (!snapshot?.values || !snapshotWs) {
    throw new Error('LangGraph checkpoint not found or expired for this approval thread.');
  }
  if (snapshotWs !== params.workspaceId) {
    throw new Error('Workspace isolation violation: thread does not belong to this workspace.');
  }

  const resumedState = await graph.invoke(
    new Command({
      resume: {
        approved: params.approved,
        editedReply: params.editedReply ?? null,
        resolvedBy: params.resolvedBy ?? null,
      } satisfies HumanApprovalResumeValue,
    }),
    config,
  );

  const runId = !params.dryRun
    ? await persistAgentRun(
        {
          workspaceId: params.workspaceId,
          conversationId: resumedState.conversationId,
          visitorMessageId: resumedState.visitorMessageId ?? null,
          agentId: resumedState.agent?.id ?? null,
          threadId: params.threadId,
          status: params.approved ? 'completed' : 'rejected',
          topic: resumedState.autonomyDecision?.topic || 'General inquiries',
          pendingAction: {},
          finalReply: params.approved ? resumedState.draftReply : null,
          trace: resumedState.trace || [],
          resolvedBy: params.resolvedBy ?? null,
        },
        params.services?.dbQuery,
      )
    : null;

  return buildResultFromState(resumedState, startedAt, runId, null);
}
