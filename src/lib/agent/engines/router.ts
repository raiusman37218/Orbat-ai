import type { AgentEngineType } from '@/lib/ai/agent-templates';
import { normalizeEngineType } from '@/lib/ai/agent-templates';
import { runAdkAgent, type AdkRunOptions } from './adk-engine';
import { runLangGraphAgent, type LangGraphRunOptions } from './langgraph-engine';
import type { AgentExecutionInput, AgentExecutionResult } from './types';

export type ResolvedRuntimeEngine = 'builtin' | 'langgraph' | 'adk';

export interface EngineRouteDecision {
  configuredEngine: AgentEngineType;
  selectedEngine: ResolvedRuntimeEngine;
  routingReason: string;
}

const STATEFUL_WORKFLOW_SIGNAL_RE =
  /\b(refund|chargeback|dispute|cancel(?:lation)?|reimburse|credit back|quote|enterprise|pricing|custom plan|annual contract|upgrade|seat|seats|license|trial extension|approve|approval)\b/i;

const MULTI_DOMAIN_SPECIALIST_SIGNAL_RE =
  /\b(order|account|subscription|invoice|billing|status|ticket|vip|deal|compare|troubleshoot|integration|api|webhook|setup|configure|error)\b/i;

/**
 * Resolves the actual execution engine (`builtin`, `langgraph`, or `adk`)
 * for an agent turn, implementing the Hybrid Auto-Router when `engineType === 'hybrid'`.
 */
export function resolveAgentEngineChoice(input: {
  engineType?: AgentEngineType | null;
  message: string;
  agent?: Pick<
    AgentExecutionInput['agent'],
    'engineConfig' | 'escalationRules' | 'industry'
  >;
  autonomyPolicies?: AgentExecutionInput['autonomyPolicies'];
}): EngineRouteDecision {
  const configured = normalizeEngineType(input.engineType);
  if (configured === 'builtin' || configured === 'langgraph' || configured === 'adk') {
    return {
      configuredEngine: configured,
      selectedEngine: configured,
      routingReason: `Explicitly pinned to "${configured}" in agent configuration.`,
    };
  }

  const msg = (input.message || '').trim();
  const workflowKey = input.agent?.engineConfig?.workflowKey?.toLowerCase() || '';

  if (workflowKey.includes('langgraph')) {
    return {
      configuredEngine: 'hybrid',
      selectedEngine: 'langgraph',
      routingReason: `Hybrid router honored workflowKey="${workflowKey}" -> LangGraph.`,
    };
  }
  if (workflowKey.includes('adk')) {
    return {
      configuredEngine: 'hybrid',
      selectedEngine: 'adk',
      routingReason: `Hybrid router honored workflowKey="${workflowKey}" -> Google ADK.`,
    };
  }

  const hasBlockedMatch = (input.agent?.escalationRules?.blockedTopics || []).some(
    (topic) => topic.trim() && msg.toLowerCase().includes(topic.trim().toLowerCase()),
  );
  const hasStrictTrustPolicy = (input.autonomyPolicies || []).some(
    (p) => p.locked || p.level <= 3,
  );

  // Stateful workflows, commercial deal staging, refund disputes, and strict Trust Ladder
  // approvals route to LangGraph where checkpointed Pause/Resume interrupts live cleanly.
  if (hasBlockedMatch || STATEFUL_WORKFLOW_SIGNAL_RE.test(msg)) {
    return {
      configuredEngine: 'hybrid',
      selectedEngine: 'langgraph',
      routingReason:
        'Hybrid router selected LangGraph for transactional/refund/commercial workflow or policy gating.',
    };
  }

  if (hasStrictTrustPolicy && MULTI_DOMAIN_SPECIALIST_SIGNAL_RE.test(msg)) {
    return {
      configuredEngine: 'hybrid',
      selectedEngine: 'langgraph',
      routingReason:
        'Hybrid router selected LangGraph because active Trust Ladder policies require gated review.',
    };
  }

  // Multi-domain troubleshooting or CRM/KB specialist research routes to Google ADK coordinator + sub-agents.
  if (MULTI_DOMAIN_SPECIALIST_SIGNAL_RE.test(msg) || msg.length >= 60) {
    return {
      configuredEngine: 'hybrid',
      selectedEngine: 'adk',
      routingReason:
        'Hybrid router selected Google ADK multi-agent coordinator for tool-assisted research.',
    };
  }

  // Short / standard queries respect fallbackEngine if configured to 'builtin', else default to ADK
  // when multi-agent runtime is enabled.
  const fallback = input.agent?.engineConfig?.fallbackEngine;
  if (fallback === 'builtin' && msg.length > 0 && msg.split(/\s+/).length <= 5) {
    return {
      configuredEngine: 'hybrid',
      selectedEngine: 'builtin',
      routingReason:
        'Hybrid router selected fast built-in engine for short conversational turn.',
    };
  }

  return {
    configuredEngine: 'hybrid',
    selectedEngine: 'adk',
    routingReason: 'Hybrid router defaulted to Google ADK coordinator for grounded multi-turn execution.',
  };
}

export interface RouterExecutionOptions {
  langgraph?: LangGraphRunOptions;
  adk?: AdkRunOptions;
  /** Optional hard execution budget before triggering safe fallback. Default 20000ms. */
  timeoutMs?: number;
}

export interface RouterExecutionOutcome {
  decision: EngineRouteDecision;
  result: AgentExecutionResult | null;
  failedOver: boolean;
  error?: string;
}

async function withBudget<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Executes either LangGraph or Google ADK directly or via Hybrid auto-routing.
 * Returns `result: null` when `'builtin'` is chosen or when an engine fails safely
 * so callers can run the deterministic built-in pipeline as a zero-downtime fallback.
 */
export async function executeAgentWithRouter(
  input: AgentExecutionInput,
  options?: RouterExecutionOptions,
): Promise<RouterExecutionOutcome> {
  const decision = resolveAgentEngineChoice({
    engineType: input.agent.engineType,
    message: input.message,
    agent: input.agent,
    autonomyPolicies: input.autonomyPolicies,
  });

  if (decision.selectedEngine === 'builtin') {
    return { decision, result: null, failedOver: false };
  }

  const timeoutMs = options?.timeoutMs ?? 20_000;

  try {
    if (decision.selectedEngine === 'langgraph') {
      const result = await withBudget(
        runLangGraphAgent(input, options?.langgraph),
        timeoutMs,
        'LangGraph engine',
      );
      return { decision, result, failedOver: false };
    }

    const result = await withBudget(
      runAdkAgent(input, options?.adk),
      timeoutMs,
      'Google ADK engine',
    );
    return { decision, result, failedOver: false };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const configuredFallback = input.agent.engineConfig?.fallbackEngine;
    // If primary was ADK or LangGraph and configured fallback is the sibling engine, try failover once cleanly.
    if (
      (configuredFallback === 'langgraph' || configuredFallback === 'adk') &&
      configuredFallback !== decision.selectedEngine
    ) {
      try {
        const siblingResult =
          configuredFallback === 'langgraph'
            ? await withBudget(runLangGraphAgent(input, options?.langgraph), timeoutMs, 'LangGraph failover')
            : await withBudget(runAdkAgent(input, options?.adk), timeoutMs, 'ADK failover');
        return {
          decision: {
            ...decision,
            selectedEngine: configuredFallback,
            routingReason: `${decision.routingReason} (failed over to ${configuredFallback}: ${errMsg})`,
          },
          result: siblingResult,
          failedOver: true,
        };
      } catch (siblingErr) {
        return {
          decision,
          result: null,
          failedOver: true,
          error: siblingErr instanceof Error ? siblingErr.message : String(siblingErr),
        };
      }
    }

    return {
      decision,
      result: null,
      failedOver: true,
      error: errMsg,
    };
  }
}
