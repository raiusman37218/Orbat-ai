-- Prompt 4: Persistent In-App Notification Feed (`public.workspace_notifications`)
-- Stores per-agent and workspace-wide alerts for handoffs, @mentions, SLA warnings/breaches,
-- LangGraph/ADK human approval pauses, AI flagged replies, and system diagnostics.

CREATE TABLE IF NOT EXISTS public.workspace_notifications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recipient_agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL
    CHECK (kind IN ('handoff', 'mention', 'sla_warning', 'sla_breach', 'ai_approval', 'ai_flagged', 'system')),
  title              TEXT NOT NULL CHECK (length(trim(title)) > 0),
  body               TEXT NOT NULL DEFAULT '',
  href               TEXT NOT NULL DEFAULT '/app',
  read_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspace feed & RLS indexes
CREATE INDEX IF NOT EXISTS idx_workspace_notifications_ws_created
  ON public.workspace_notifications (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_notifications_ws_recipient_created
  ON public.workspace_notifications (workspace_id, recipient_agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_notifications_ws_unread
  ON public.workspace_notifications (workspace_id, recipient_agent_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.workspace_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.workspace_notifications FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_notifications TO authenticated, service_role;

DROP POLICY IF EXISTS workspace_notifications_select ON public.workspace_notifications;
CREATE POLICY workspace_notifications_select ON public.workspace_notifications
  FOR SELECT TO authenticated
  USING (
    public.fn_role_can(workspace_id, 'view')
    AND (recipient_agent_id IS NULL OR recipient_agent_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS workspace_notifications_insert ON public.workspace_notifications;
CREATE POLICY workspace_notifications_insert ON public.workspace_notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS workspace_notifications_update ON public.workspace_notifications;
CREATE POLICY workspace_notifications_update ON public.workspace_notifications
  FOR UPDATE TO authenticated
  USING (
    public.fn_role_can(workspace_id, 'view')
    AND (recipient_agent_id IS NULL OR recipient_agent_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.fn_role_can(workspace_id, 'view')
    AND (recipient_agent_id IS NULL OR recipient_agent_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS workspace_notifications_delete ON public.workspace_notifications;
CREATE POLICY workspace_notifications_delete ON public.workspace_notifications
  FOR DELETE TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS workspace_notifications_service_all ON public.workspace_notifications;
CREATE POLICY workspace_notifications_service_all ON public.workspace_notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
