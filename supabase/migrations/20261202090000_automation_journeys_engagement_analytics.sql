-- ============================================================================
-- Phase 3: Automation Studio Workflows, Customer Journeys, Engagement Campaigns,
--          Proactive Messages, Survey Responses (CSAT/NPS), Custom Analytics
-- Migration: 20261202090000_automation_journeys_engagement_analytics.sql
-- Idempotent & RLS-enforced via public.fn_workspace_role / public.fn_role_can
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Visual Automation Workflows & Workflow Run Trace Log
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  description    TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  template_key   TEXT,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('live', 'paused', 'draft', 'error')),
  trigger_kind   TEXT NOT NULL DEFAULT 'conversation_created',
  linked_rule_id UUID REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  nodes          JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges          JSONB NOT NULL DEFAULT '[]'::jsonb,
  runs_7d        INTEGER NOT NULL DEFAULT 0 CHECK (runs_7d >= 0),
  errors_7d      INTEGER NOT NULL DEFAULT 0 CHECK (errors_7d >= 0),
  last_run_at    TIMESTAMPTZ,
  created_by     UUID,
  updated_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_workflows_ws_idx
  ON public.automation_workflows (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.automation_workflow_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  workflow_id     UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  ticket_id       UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL DEFAULT 'Visitor',
  path_summary    TEXT NOT NULL DEFAULT '',
  steps_executed  JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms     INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('resolved', 'handed_off', 'completed', 'failed', 'simulated')),
  error_message   TEXT,
  is_test         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_workflow_runs_ws_idx
  ON public.automation_workflow_runs (workspace_id, workflow_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. Customer Journeys & Enrollments
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_journeys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  goal           TEXT NOT NULL DEFAULT '' CHECK (char_length(goal) <= 300),
  entry_trigger  TEXT NOT NULL DEFAULT 'Conversation started' CHECK (char_length(entry_trigger) <= 200),
  exit_criteria  TEXT NOT NULL DEFAULT 'Goal reached or unsubscribed' CHECK (char_length(exit_criteria) <= 200),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('live', 'paused', 'draft')),
  stages         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by     UUID,
  updated_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_journeys_ws_idx
  ON public.customer_journeys (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_journey_enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  journey_id       UUID NOT NULL REFERENCES public.customer_journeys(id) ON DELETE CASCADE,
  visitor_id       UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
  customer_name    TEXT NOT NULL CHECK (char_length(trim(customer_name)) BETWEEN 1 AND 120),
  customer_email   TEXT,
  current_stage_id TEXT NOT NULL,
  current_step_id  TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'goal_reached', 'needs_attention', 'opted_out', 'exited')),
  revenue_cents    INTEGER NOT NULL DEFAULT 0 CHECK (revenue_cents >= 0),
  last_activity    TEXT NOT NULL DEFAULT 'Entered journey',
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_journey_enrollments_ws_idx
  ON public.customer_journey_enrollments (workspace_id, journey_id, last_activity_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Engagement: Campaigns, Proactive Messages, Surveys (CSAT + NPS)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.engagement_campaigns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name               TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  channel            TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'in_app_banner', 'announcement', 'chat_message', 'whatsapp')),
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'sent', 'paused')),
  audience_label     TEXT NOT NULL DEFAULT 'All workspace contacts',
  audience_rules     JSONB NOT NULL DEFAULT '[]'::jsonb,
  schedule_label     TEXT NOT NULL DEFAULT 'Not scheduled',
  scheduled_at       TIMESTAMPTZ,
  subject            TEXT NOT NULL DEFAULT '',
  body               TEXT NOT NULL DEFAULT '',
  sent_count         INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  delivered_count    INTEGER NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  opened_count       INTEGER NOT NULL DEFAULT 0 CHECK (opened_count >= 0),
  clicked_count      INTEGER NOT NULL DEFAULT 0 CHECK (clicked_count >= 0),
  converted_count    INTEGER NOT NULL DEFAULT 0 CHECK (converted_count >= 0),
  unsubscribed_count INTEGER NOT NULL DEFAULT 0 CHECK (unsubscribed_count >= 0),
  revenue_cents      INTEGER NOT NULL DEFAULT 0 CHECK (revenue_cents >= 0),
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS engagement_campaigns_ws_idx
  ON public.engagement_campaigns (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.proactive_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  trigger_when    TEXT NOT NULL DEFAULT 'After 10s on any page',
  page_pattern    TEXT NOT NULL DEFAULT '*',
  delay_seconds   INTEGER NOT NULL DEFAULT 10 CHECK (delay_seconds >= 0 AND delay_seconds <= 3600),
  message         TEXT NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 1000),
  is_active       BOOLEAN NOT NULL DEFAULT false,
  shown_count     INTEGER NOT NULL DEFAULT 0 CHECK (shown_count >= 0),
  reply_count     INTEGER NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
  converted_count INTEGER NOT NULL DEFAULT 0 CHECK (converted_count >= 0),
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proactive_messages_ws_idx
  ON public.proactive_messages (workspace_id, is_active, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('csat', 'nps')),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  ticket_id       UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  visitor_id      UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL DEFAULT 'Anonymous',
  channel         TEXT NOT NULL DEFAULT 'web',
  handler_type    TEXT NOT NULL DEFAULT 'unknown' CHECK (handler_type IN ('ai', 'human', 'unknown')),
  score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  comment         TEXT,
  theme           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS survey_responses_ws_kind_idx
  ON public.survey_responses (workspace_id, kind, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Saved Custom Analytics Reports
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.analytics_custom_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  description      TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 400),
  section          TEXT NOT NULL DEFAULT 'conv' CHECK (section IN ('conv', 'ai', 'agents', 'calls', 'csat', 'biz')),
  range_days       INTEGER NOT NULL DEFAULT 30 CHECK (range_days IN (7, 30, 90)),
  compare_previous BOOLEAN NOT NULL DEFAULT true,
  filters          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_custom_reports_ws_idx
  ON public.analytics_custom_reports (workspace_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. updated_at triggers
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_automation_workflows_updated_at ON public.automation_workflows;
CREATE TRIGGER trg_automation_workflows_updated_at
  BEFORE UPDATE ON public.automation_workflows
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_customer_journeys_updated_at ON public.customer_journeys;
CREATE TRIGGER trg_customer_journeys_updated_at
  BEFORE UPDATE ON public.customer_journeys
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_engagement_campaigns_updated_at ON public.engagement_campaigns;
CREATE TRIGGER trg_engagement_campaigns_updated_at
  BEFORE UPDATE ON public.engagement_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_proactive_messages_updated_at ON public.proactive_messages;
CREATE TRIGGER trg_proactive_messages_updated_at
  BEFORE UPDATE ON public.proactive_messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_analytics_custom_reports_updated_at ON public.analytics_custom_reports;
CREATE TRIGGER trg_analytics_custom_reports_updated_at
  BEFORE UPDATE ON public.analytics_custom_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_journey_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_custom_reports ENABLE ROW LEVEL SECURITY;

-- Workspace members can view; managers/editors can mutate.

DROP POLICY IF EXISTS automation_workflows_select ON public.automation_workflows;
CREATE POLICY automation_workflows_select ON public.automation_workflows
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS automation_workflows_manage ON public.automation_workflows;
CREATE POLICY automation_workflows_manage ON public.automation_workflows
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS automation_workflow_runs_select ON public.automation_workflow_runs;
CREATE POLICY automation_workflow_runs_select ON public.automation_workflow_runs
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS automation_workflow_runs_manage ON public.automation_workflow_runs;
CREATE POLICY automation_workflow_runs_manage ON public.automation_workflow_runs
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS customer_journeys_select ON public.customer_journeys;
CREATE POLICY customer_journeys_select ON public.customer_journeys
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS customer_journeys_manage ON public.customer_journeys;
CREATE POLICY customer_journeys_manage ON public.customer_journeys
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS customer_journey_enrollments_select ON public.customer_journey_enrollments;
CREATE POLICY customer_journey_enrollments_select ON public.customer_journey_enrollments
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS customer_journey_enrollments_manage ON public.customer_journey_enrollments;
CREATE POLICY customer_journey_enrollments_manage ON public.customer_journey_enrollments
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_content'));

DROP POLICY IF EXISTS engagement_campaigns_select ON public.engagement_campaigns;
CREATE POLICY engagement_campaigns_select ON public.engagement_campaigns
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS engagement_campaigns_manage ON public.engagement_campaigns;
CREATE POLICY engagement_campaigns_manage ON public.engagement_campaigns
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS proactive_messages_select ON public.proactive_messages;
CREATE POLICY proactive_messages_select ON public.proactive_messages
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS proactive_messages_manage ON public.proactive_messages;
CREATE POLICY proactive_messages_manage ON public.proactive_messages
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS survey_responses_select ON public.survey_responses;
CREATE POLICY survey_responses_select ON public.survey_responses
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS survey_responses_manage ON public.survey_responses;
CREATE POLICY survey_responses_manage ON public.survey_responses
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_content'));

DROP POLICY IF EXISTS analytics_custom_reports_select ON public.analytics_custom_reports;
CREATE POLICY analytics_custom_reports_select ON public.analytics_custom_reports
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS analytics_custom_reports_manage ON public.analytics_custom_reports;
CREATE POLICY analytics_custom_reports_manage ON public.analytics_custom_reports
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_content'));
