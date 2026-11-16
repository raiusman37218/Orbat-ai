'use client';

import {
  createAgentFromTemplateAction,
  deleteAiAgentAction,
  generateAgentPromptDraftAction,
  getAgentBuilderAction,
  getAiAgentsBootstrapAction,
  restoreAgentVersionAction,
  runAgentEvalSuiteAction,
  runAgentPlaygroundAction,
  saveAgentDraftAction,
  submitAgentReviewVerdictAction,
  toggleAiAgentStatusAction,
  type ActivityLogItem,
  type AgentBuilderBundle,
  type AgentEvalCaseOutcome,
  type AgentEvalSuiteResult,
  type AgentVersionItem,
  type AiAgentListItem,
  type AiAgentsBootstrap,
  type EscalationBreakdownItem,
  type KnowledgeGapSummary,
  type PlaygroundResult,
  type PlaygroundTurn,
  type SaveAgentDraftInput,
  type VerificationReviewItem,
  type WeeklyTrendPoint,
} from '@/app/actions/ai-agents';
import {
  AGENT_TEMPLATES,
  AGENT_TEMPLATE_INDUSTRIES,
  DEFAULT_AGENT_APPEARANCE,
  DEFAULT_AGENT_ENGINE_CONFIG,
  DEFAULT_AGENT_MODEL_CONFIG,
  DEFAULT_AGENT_RAG_CONFIG,
  DEFAULT_AGENT_ROUTING_RULES,
  DEFAULT_ESCALATION_RULES,
  DEFAULT_KNOWLEDGE_SCOPE,
  UNIFIED_TOOL_OPTION_DEFS,
  buildRuleBasedAgentPromptDraft,
  detectAgentChannelConflicts,
  getAgentTemplate,
  isToolAllowedInConfig,
  normalizeAgentRagConfig,
  normalizeEngineType,
  type AgentAnswerMode,
  type AgentAppearance,
  type AgentCapabilities,
  type AgentChannelConflict,
  type AgentEngineConfig,
  type AgentEngineType,
  type AgentEscalationRules,
  type AgentEvalCase,
  type AgentKnowledgeScope,
  type AgentModelConfig,
  type AgentRagConfig,
  type AgentRagMode,
  type AgentReplyLanguageMode,
  type AgentRoutingRules,
  type AgentStatus,
  type AgentTemplateSpec,
  type GeneratedAgentPromptDraft,
  type RetrievedChunkSummary,
  type UnifiedToolOptionDef,
} from '@/lib/ai/agent-templates';
import type { AiAgentRow, VerificationClaim } from '@/lib/ai/agent-runtime';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

export type {
  ActivityLogItem,
  AgentAnswerMode,
  AgentAppearance,
  AgentBuilderBundle,
  AgentCapabilities,
  AgentChannelConflict,
  AgentEngineConfig,
  AgentEngineType,
  AgentEscalationRules,
  AgentEvalCase,
  AgentEvalCaseOutcome,
  AgentEvalSuiteResult,
  AgentKnowledgeScope,
  AgentModelConfig,
  AgentRagConfig,
  AgentRagMode,
  AgentReplyLanguageMode,
  AgentRoutingRules,
  AgentStatus,
  AgentTemplateSpec,
  AgentVersionItem,
  AiAgentListItem,
  AiAgentRow,
  AiAgentsBootstrap,
  EscalationBreakdownItem,
  GeneratedAgentPromptDraft,
  KnowledgeGapSummary,
  PlaygroundResult,
  PlaygroundTurn,
  RetrievedChunkSummary,
  SaveAgentDraftInput,
  UnifiedToolOptionDef,
  VerificationClaim,
  VerificationReviewItem,
  WeeklyTrendPoint,
};

export {
  AGENT_TEMPLATES,
  AGENT_TEMPLATE_INDUSTRIES,
  DEFAULT_AGENT_APPEARANCE,
  DEFAULT_AGENT_ENGINE_CONFIG,
  DEFAULT_AGENT_MODEL_CONFIG,
  DEFAULT_AGENT_RAG_CONFIG,
  DEFAULT_AGENT_ROUTING_RULES,
  DEFAULT_ESCALATION_RULES,
  DEFAULT_KNOWLEDGE_SCOPE,
  UNIFIED_TOOL_OPTION_DEFS,
  buildRuleBasedAgentPromptDraft,
  detectAgentChannelConflicts,
  getAgentTemplate,
  isToolAllowedInConfig,
  normalizeAgentRagConfig,
  normalizeEngineType,
};

// TODO(backend): Agent Builder "Capabilities -> Connected external actions" (e.g.
// live Shopify order refunds, Stripe card freezes, PMS/CRM webhooks) stores
// declared capability identifiers on `ai_agents.capabilities`, while executing
// third-party mutations awaits CRM/Commerce integration in Channels & Apps.

export function getAiAgentsBootstrap(workspaceId: string) {
  return getAiAgentsBootstrapAction(workspaceId);
}

export function toggleAiAgentStatus(
  workspaceId: string,
  agentId: string,
  status: AgentStatus,
) {
  return toggleAiAgentStatusAction(workspaceId, agentId, status);
}

export function getAgentBuilder(
  workspaceId: string,
  agentIdOrNew: string,
  templateId?: string | null,
) {
  return getAgentBuilderAction(workspaceId, agentIdOrNew, templateId);
}

export function saveAgentDraft(workspaceId: string, input: SaveAgentDraftInput) {
  return saveAgentDraftAction(workspaceId, input);
}

export function restoreAgentVersion(
  workspaceId: string,
  agentId: string,
  versionId: string,
) {
  return restoreAgentVersionAction(workspaceId, agentId, versionId);
}

export function createAgentFromTemplate(workspaceId: string, templateId: string) {
  return createAgentFromTemplateAction(workspaceId, templateId);
}

export function deleteAiAgent(workspaceId: string, agentId: string) {
  return deleteAiAgentAction(workspaceId, agentId);
}

export function submitAgentReviewVerdict(
  workspaceId: string,
  logId: string,
  verdict: 'correct' | 'wrong',
) {
  return submitAgentReviewVerdictAction(workspaceId, logId, verdict);
}

export function runAgentPlayground(
  workspaceId: string,
  input: Parameters<typeof runAgentPlaygroundAction>[1],
) {
  return runAgentPlaygroundAction(workspaceId, input);
}

export function generateAgentPromptDraft(
  workspaceId: string,
  input: Parameters<typeof generateAgentPromptDraftAction>[1],
) {
  return generateAgentPromptDraftAction(workspaceId, input);
}

export function runAgentEvalSuite(
  workspaceId: string,
  input: Parameters<typeof runAgentEvalSuiteAction>[1],
) {
  return runAgentEvalSuiteAction(workspaceId, input);
}

export function useAiAgentsLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
): void {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 15_000,
    onRefresh,
  });
}
