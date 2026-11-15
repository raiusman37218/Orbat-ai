-- Part 6: Built-in LangGraph checkpoints (optional setup) & AI Agent Runs / Human Approval queue

CREATE TABLE IF NOT EXISTS public.ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  visitor_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  engine_type TEXT NOT NULL DEFAULT 'langgraph'
    CHECK (engine_type IN ('builtin', 'langgraph', 'adk', 'hybrid', 'external_agent')),
  thread_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'paused_approval', 'completed', 'rejected', 'failed')),
  topic TEXT,
  pending_action JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_reply TEXT,
  final_reply TEXT,
  trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  resolved_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agent_runs_thread_id
  ON public.ai_agent_runs (thread_id);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_ws_conv_created
  ON public.ai_agent_runs (workspace_id, conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_ws_status
  ON public.ai_agent_runs (workspace_id, status, created_at DESC)
  WHERE status = 'paused_approval';

ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_agent_runs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_agent_runs TO authenticated, service_role;

DROP POLICY IF EXISTS ai_agent_runs_select ON public.ai_agent_runs;
CREATE POLICY ai_agent_runs_select ON public.ai_agent_runs
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS ai_agent_runs_insert ON public.ai_agent_runs;
CREATE POLICY ai_agent_runs_insert ON public.ai_agent_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_role_can(workspace_id, 'reply'));

DROP POLICY IF EXISTS ai_agent_runs_update ON public.ai_agent_runs;
CREATE POLICY ai_agent_runs_update ON public.ai_agent_runs
  FOR UPDATE TO authenticated
  USING (public.fn_role_can(workspace_id, 'reply'))
  WITH CHECK (public.fn_role_can(workspace_id, 'reply'));

-- Also ensure Postgres checkpointer schema tables used by @langchain/langgraph-checkpoint-postgres
-- exist safely in public schema even before first runtime setup() call.
CREATE TABLE IF NOT EXISTS public.checkpoint_migrations (
  v INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  type TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE TABLE IF NOT EXISTS public.checkpoint_blobs (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL,
  version TEXT NOT NULL,
  type TEXT NOT NULL,
  blob BYTEA,
  PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

CREATE TABLE IF NOT EXISTS public.checkpoint_writes (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  channel TEXT NOT NULL,
  type TEXT,
  blob BYTEA NOT NULL,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);
