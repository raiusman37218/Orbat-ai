import type {
  AgentAnswerMode,
  AgentEngineConfig,
  AgentEngineType,
  AgentEscalationRules,
  AgentKnowledgeScope,
  AgentModelConfig,
  AgentRagConfig,
  AgentReplyLanguageMode,
  RagTrace,
  RetrievedChunkSummary,
} from '@/lib/ai/agent-templates';
export type { RetrievedChunkSummary };
import type { AutonomyDecision, AutonomyPolicyRecord } from '@/lib/ai/trust-ladder';
import type { CitableArticle } from '@/lib/ai/help-answer';
import type { ProviderConfig } from '@/lib/ai/provider';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type EngineUsed = 'builtin' | 'langgraph' | 'adk' | 'external_agent';

export type AgentExecutionAction = 'reply' | 'escalate' | 'awaiting_approval';

export interface AgentTraceStep {
  node: string;
  status: 'ok' | 'paused' | 'skipped' | 'error';
  summary: string;
  detail?: Record<string, unknown>;
  durationMs: number;
}

export interface StagedToolAction {
  toolName:
    | 'crm_create_or_update_deal'
    | 'crm_create_followup_task'
    | 'escalate_to_team_group';
  summary: string;
  args: Record<string, unknown>;
}

export interface PendingApprovalPayload {
  threadId: string;
  runId: string | null;
  agentId: string | null;
  agentName: string;
  topic: string;
  autonomyLevel: AutonomyDecision['level'];
  reason: string;
  draftReply: string;
  pendingActions: StagedToolAction[];
}

export interface AgentRuntimeProfile {
  id: string | null;
  name: string;
  industry?: string | null;
  tone?: string | null;
  systemPrompt?: string | null;
  guardrails?: string[];
  escalationRules?: AgentEscalationRules;
  knowledgeScope?: AgentKnowledgeScope | null;
  answerMode?: AgentAnswerMode;
  replyLanguageMode?: AgentReplyLanguageMode;
  ragConfig?: Partial<AgentRagConfig> | null;
  engineType?: AgentEngineType;
  engineConfig?: Partial<AgentEngineConfig> | null;
  modelConfig?: Partial<AgentModelConfig> | null;
  handoffGroupId?: string | null;
}

export interface AgentExecutionInput {
  workspaceId: string;
  workspaceName?: string;
  conversationId: string;
  visitorMessageId?: string | null;
  visitorId?: string | null;
  visitorName?: string | null;
  visitorEmail?: string | null;
  channel: string;
  helpCenterUrl?: string | null;
  message: string;
  history: ChatTurn[];
  humanContext?: string | null;
  agent: AgentRuntimeProfile;
  autonomyPolicies?: AutonomyPolicyRecord[];
  providerConfig?: ProviderConfig | null;
  dryRun?: boolean;
  threadId?: string;
}

export interface AgentExecutionResult {
  replyText: string;
  action: AgentExecutionAction;
  engineUsed: EngineUsed;
  shouldHandover: boolean;
  handoverReason?: string | null;
  canAnswerFromDocs: boolean;
  citedArticles: CitableArticle[];
  usedArticleIds: string[];
  retrievalConfidence: 'high' | 'medium' | 'low';
  retrievalMethod: 'semantic_rag' | 'keyword_fallback' | 'none';
  ragTrace?: RagTrace;
  retrievedChunks?: RetrievedChunkSummary[];
  topic: string;
  intent: string;
  usingModel: boolean;
  autonomyDecision: AutonomyDecision;
  pendingApproval?: PendingApprovalPayload;
  executedTools: Array<{
    toolName: string;
    ok: boolean;
    summary: string;
  }>;
  trace: AgentTraceStep[];
  threadId: string;
  runId?: string | null;
  latencyMs: number;
}
