-- ============================================================================
-- Migration: 20261123090000_copilot_feature.sql
-- Description: End-to-end Agent AI Copilot schema, usage tracking, private
--              agent-copilot chat history, summary caching with invalidation,
--              plan entitlements, and strict workspace RLS isolation.
-- ============================================================================

-- 1. Global Copilot switch on platform_ai_settings
ALTER TABLE public.platform_ai_settings
  ADD COLUMN IF NOT EXISTS copilot_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Copilot entitlement & monthly limit on platform_plans and versions
ALTER TABLE public.platform_plans
  ADD COLUMN IF NOT EXISTS copilot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS copilot_monthly_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_copilot_requests_per_month INTEGER DEFAULT NULL;

ALTER TABLE public.platform_plan_versions
  ADD COLUMN IF NOT EXISTS copilot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS copilot_monthly_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_copilot_requests_per_month INTEGER DEFAULT NULL;

-- Ensure existing plan feature JSON maps include 'copilot' where absent
UPDATE public.platform_plans
SET features = jsonb_set(COALESCE(features, '{}'::jsonb), '{copilot}', to_jsonb(COALESCE(copilot_enabled, TRUE)), true)
WHERE features IS NULL OR NOT (features ? 'copilot');

-- 3. Cached Copilot Summary & Next Steps on conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS copilot_summary JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS copilot_next_steps JSONB DEFAULT NULL;

-- Trigger: Mark cached copilot_summary as outdated when a new message arrives
CREATE OR REPLACE FUNCTION public.fn_mark_copilot_summary_outdated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only mark outdated on non-internal customer/agent/bot messages when a summary exists
  IF NOT COALESCE(NEW.is_internal, FALSE) THEN
    UPDATE public.conversations
    SET copilot_summary = jsonb_set(
      copilot_summary,
      '{is_outdated}',
      'true'::jsonb,
      true
    )
    WHERE id = NEW.conversation_id
      AND copilot_summary IS NOT NULL
      AND COALESCE((copilot_summary->>'is_outdated')::boolean, FALSE) = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_copilot_summary_outdated ON public.messages;
CREATE TRIGGER trg_mark_copilot_summary_outdated
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_mark_copilot_summary_outdated();

-- 4. Extend workspace_ai_usage with Copilot counters
ALTER TABLE public.workspace_ai_usage
  ADD COLUMN IF NOT EXISTS copilot_requests_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copilot_tokens_in INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copilot_tokens_out INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.fn_increment_workspace_copilot_usage(
  p_workspace_id UUID,
  p_period_start DATE,
  p_requests INTEGER DEFAULT 1,
  p_tokens_in INTEGER DEFAULT 0,
  p_tokens_out INTEGER DEFAULT 0
)
RETURNS public.workspace_ai_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.workspace_ai_usage;
BEGIN
  INSERT INTO public.workspace_ai_usage (
    workspace_id,
    period_start,
    replies_used,
    tokens_in,
    tokens_out,
    copilot_requests_used,
    copilot_tokens_in,
    copilot_tokens_out,
    updated_at
  )
  VALUES (
    p_workspace_id,
    p_period_start,
    0,
    0,
    0,
    GREATEST(0, p_requests),
    GREATEST(0, p_tokens_in),
    GREATEST(0, p_tokens_out),
    now()
  )
  ON CONFLICT (workspace_id, period_start)
  DO UPDATE SET
    copilot_requests_used = public.workspace_ai_usage.copilot_requests_used + GREATEST(0, p_requests),
    copilot_tokens_in = public.workspace_ai_usage.copilot_tokens_in + GREATEST(0, p_tokens_in),
    copilot_tokens_out = public.workspace_ai_usage.copilot_tokens_out + GREATEST(0, p_tokens_out),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_increment_workspace_copilot_usage(UUID, DATE, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_increment_workspace_copilot_usage(UUID, DATE, INTEGER, INTEGER, INTEGER) TO service_role;

-- 5. Copilot Events table (Per-request logging, feedback, and draft disposition)
CREATE TABLE IF NOT EXISTS public.copilot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('summary', 'suggest_reply', 'ask', 'rewrite', 'next_steps')),
  model TEXT,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  error_code TEXT,
  feedback TEXT CHECK (feedback IN ('up', 'down')),
  draft_disposition TEXT CHECK (draft_disposition IN ('used', 'edited', 'discarded')),
  missing_knowledge BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_events_workspace_created
  ON public.copilot_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_copilot_events_conversation
  ON public.copilot_events (conversation_id, created_at DESC);

ALTER TABLE public.copilot_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.copilot_events FROM anon;
GRANT SELECT, UPDATE ON public.copilot_events TO authenticated;
GRANT ALL ON public.copilot_events TO service_role;

DROP POLICY IF EXISTS copilot_events_member_select ON public.copilot_events;
CREATE POLICY copilot_events_member_select
  ON public.copilot_events
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspace_ids())
    OR public.is_current_user_super_admin()
  );

DROP POLICY IF EXISTS copilot_events_member_update ON public.copilot_events;
CREATE POLICY copilot_events_member_update
  ON public.copilot_events
  FOR UPDATE
  TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspace_ids()));

-- 6. Private Agent <-> Copilot Chat table (Never visible to visitors/anon)
CREATE TABLE IF NOT EXISTS public.copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('agent', 'copilot')),
  content TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  event_id UUID REFERENCES public.copilot_events(id) ON DELETE SET NULL,
  feedback TEXT CHECK (feedback IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_messages_conv
  ON public.copilot_messages (workspace_id, conversation_id, created_at ASC);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.copilot_messages FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_messages TO authenticated;
GRANT ALL ON public.copilot_messages TO service_role;

DROP POLICY IF EXISTS copilot_messages_member_select ON public.copilot_messages;
CREATE POLICY copilot_messages_member_select
  ON public.copilot_messages
  FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspace_ids()));

DROP POLICY IF EXISTS copilot_messages_member_insert ON public.copilot_messages;
CREATE POLICY copilot_messages_member_insert
  ON public.copilot_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspace_ids())
    AND agent_id = auth.uid()
  );

DROP POLICY IF EXISTS copilot_messages_member_update ON public.copilot_messages;
CREATE POLICY copilot_messages_member_update
  ON public.copilot_messages
  FOR UPDATE
  TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspace_ids()));

DROP POLICY IF EXISTS copilot_messages_member_delete ON public.copilot_messages;
CREATE POLICY copilot_messages_member_delete
  ON public.copilot_messages
  FOR DELETE
  TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspace_ids()));
