-- Prompt 3: Inbox Scale, Team Inboxes (group_id), Saved Conversation Views, FTS/Trigram Search, and Visitor Notes.

-- 1. Enable trigram extension for fast ILIKE / substring search across messages and visitors
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add team group assignment to conversations + compound index
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.ticket_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_ws_group_updated
  ON public.conversations (workspace_id, group_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_ws_status_updated
  ON public.conversations (workspace_id, status, updated_at DESC);

-- 3. Add persistent agent notes column to visitors
ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Full-text search & trigram indexes on messages.content and visitor names/emails
CREATE INDEX IF NOT EXISTS idx_messages_content_fts
  ON public.messages USING GIN (to_tsvector('simple', COALESCE(content, '')));

CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
  ON public.messages USING GIN (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_visitors_search_trgm
  ON public.visitors USING GIN ((COALESCE(name, '') || ' ' || COALESCE(email, '')) gin_trgm_ops);

-- 5. Saved conversation views (mirroring ticket_views)
CREATE TABLE IF NOT EXISTS public.conversation_views (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id     UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (length(trim(name)) > 0),
  filters      JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters) = 'object'),
  sort         JSONB NOT NULL DEFAULT '{"field": "newest", "direction": "desc"}'::jsonb
                 CHECK (jsonb_typeof(sort) = 'object'),
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_views_workspace
  ON public.conversation_views (workspace_id, position, created_at);

ALTER TABLE public.conversation_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversation_views FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversation_views TO authenticated, service_role;

DROP POLICY IF EXISTS conversation_views_select ON public.conversation_views;
CREATE POLICY conversation_views_select ON public.conversation_views FOR SELECT TO authenticated
  USING (public.fn_ticket_member(workspace_id) AND (owner_id IS NULL OR owner_id = auth.uid()));

DROP POLICY IF EXISTS conversation_views_write ON public.conversation_views;
CREATE POLICY conversation_views_write ON public.conversation_views FOR ALL TO authenticated
  USING (
    public.fn_ticket_member(workspace_id)
    AND (owner_id = auth.uid() OR (owner_id IS NULL AND public.fn_ticket_admin(workspace_id)))
  )
  WITH CHECK (
    public.fn_ticket_member(workspace_id)
    AND (owner_id = auth.uid() OR (owner_id IS NULL AND public.fn_ticket_admin(workspace_id)))
  );

-- 6. Allow both 'paused_approval' and 'waiting_approval' on ai_agent_runs if the table exists
DO $$
BEGIN
  IF to_regclass('public.ai_agent_runs') IS NOT NULL THEN
    ALTER TABLE public.ai_agent_runs DROP CONSTRAINT IF EXISTS ai_agent_runs_status_check;
    ALTER TABLE public.ai_agent_runs
      ADD CONSTRAINT ai_agent_runs_status_check
      CHECK (status IN ('running', 'paused_approval', 'waiting_approval', 'completed', 'rejected', 'failed'));
  END IF;
END $$;
