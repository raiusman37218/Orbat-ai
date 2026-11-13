-- Additive architecture, multi-tenant, reliability, and SECURITY DEFINER hardening migration.
-- Non-destructive & idempotent: safe to run on existing databases and clean baselines.

-- 1. Transactional Outbox for reliable Socket.IO event delivery across multi-instance API nodes
CREATE TABLE IF NOT EXISTS public.realtime_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID,
  event_name TEXT NOT NULL,
  rooms TEXT[] NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'published', 'failed', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realtime_outbox_pending_retry
  ON public.realtime_outbox (status, next_retry_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_realtime_outbox_workspace_created
  ON public.realtime_outbox (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_realtime_outbox_conversation_created
  ON public.realtime_outbox (conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.realtime_outbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'realtime_outbox'
      AND policyname = 'Service role manages realtime_outbox'
  ) THEN
    CREATE POLICY "Service role manages realtime_outbox"
      ON public.realtime_outbox
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Persistent BullMQ Dead-Letter Queue (DLQ) audit table
CREATE TABLE IF NOT EXISTS public.dead_letter_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL,
  job_id TEXT,
  job_name TEXT,
  workspace_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  attempts_made INTEGER NOT NULL DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_jobs_queue_created
  ON public.dead_letter_jobs (queue_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_jobs_workspace_created
  ON public.dead_letter_jobs (workspace_id, created_at DESC)
  WHERE workspace_id IS NOT NULL;

ALTER TABLE public.dead_letter_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dead_letter_jobs'
      AND policyname = 'Service role manages dead_letter_jobs'
  ) THEN
    CREATE POLICY "Service role manages dead_letter_jobs"
      ON public.dead_letter_jobs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 3. Multi-tenant & high-frequency query performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_desc
  ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_workspace_status_updated
  ON public.conversations (workspace_id, status, updated_at DESC);

DO $$
BEGIN
  IF to_regclass('public.bot_knowledge') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_bot_knowledge_workspace_status
      ON public.bot_knowledge (workspace_id, status);
  END IF;
END $$;

-- 4. Pin search_path on all legacy SECURITY DEFINER functions to prevent schema hijacking
DO $$
DECLARE
  fn_sig TEXT;
  target_functions TEXT[] := ARRAY[
    'public.fn_track_article_view(uuid)',
    'public.fn_submit_article_feedback(uuid, uuid, text, boolean, text)',
    'public.fn_get_workspace_config(uuid)',
    'public.fn_protect_agent_super_admin()',
    'public.fn_get_platform_companies_summary()',
    'public.fn_get_visitor_conversations(uuid, uuid)',
    'public.fn_merge_workspaces(uuid, uuid)',
    'public.fn_get_platform_analytics(integer)',
    'public.fn_get_company_analytics(uuid, integer)',
    'public.fn_increment_workspace_ai_usage(uuid, date, integer, integer, integer)'
  ];
BEGIN
  FOREACH fn_sig IN ARRAY target_functions LOOP
    IF to_regprocedure(fn_sig) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', fn_sig);
    END IF;
  END LOOP;
END $$;

