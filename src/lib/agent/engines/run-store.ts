import { queryRows } from '@/lib/db';
import type { DbQueryFn } from '@/lib/agent/tools/registry';
import type { AgentTraceStep, StagedToolAction } from './types';

export type PersistedEngineType = 'langgraph' | 'adk';
export type PersistedRunStatus =
  | 'running'
  | 'paused_approval'
  | 'completed'
  | 'rejected'
  | 'failed';

export interface PersistAgentRunInput {
  workspaceId: string;
  conversationId: string;
  visitorMessageId?: string | null;
  agentId?: string | null;
  engineType: PersistedEngineType;
  threadId: string;
  status: PersistedRunStatus;
  topic: string;
  pendingAction?: Record<string, unknown>;
  draftReply?: string | null;
  finalReply?: string | null;
  trace: AgentTraceStep[];
  resolvedBy?: string | null;
}

/**
 * Upserts a durable execution/approval run record in `public.ai_agent_runs`.
 * Shared by both LangGraph and Google ADK engines to keep pause/resume state uniform.
 */
export async function persistAgentRun(
  params: PersistAgentRunInput,
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
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9::jsonb, $10, $11, $12::jsonb,
         $13, CASE WHEN $7 IN ('completed', 'rejected', 'failed') THEN now() ELSE NULL END, now()
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
        params.engineType,
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

export interface StoredAgentRunRecord {
  id: string;
  workspace_id: string;
  conversation_id: string;
  visitor_message_id: string | null;
  agent_id: string | null;
  engine_type: string;
  thread_id: string;
  status: PersistedRunStatus;
  topic: string | null;
  pending_action: {
    reason?: string;
    pendingActions?: StagedToolAction[];
    shouldHandover?: boolean;
    handoverReason?: string | null;
  } | null;
  draft_reply: string | null;
  trace: AgentTraceStep[] | null;
}

/**
 * Loads a paused `ai_agent_runs` record scoped strictly to `workspaceId`.
 */
export async function loadPausedAgentRun(
  workspaceId: string,
  threadId: string,
  db: DbQueryFn = queryRows,
): Promise<StoredAgentRunRecord | null> {
  if (!process.env.DATABASE_URL && db === queryRows) return null;
  try {
    const rows = await db<StoredAgentRunRecord>(
      `SELECT id, workspace_id, conversation_id, visitor_message_id, agent_id, engine_type,
              thread_id, status, topic, pending_action, draft_reply, trace
       FROM public.ai_agent_runs
       WHERE thread_id = $1 AND workspace_id = $2
       LIMIT 1`,
      [threadId, workspaceId],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
