-- ============================================================================
-- Phase 4: Team Schedule Settings, On-Call Rotations, Compliance Policies &
--          Flags, Data Subject Requests, Website Compliance Audits
-- Migration: 20261203090000_team_schedule_compliance_handoff.sql
-- Idempotent & RLS-enforced via public.fn_workspace_role / public.fn_role_can
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extended Workspace Schedule & Availability Rules
--    Synced alongside workspaces.business_hours / workspaces.timezone /
--    workspaces.handoff_settings so existing SQL/SLA/handoff RPCs stay canonical.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workspace_schedule_configs (
  workspace_id           UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  after_hours_rules      JSONB NOT NULL DEFAULT '{"aiHandlesEverything":true,"collectEmailForNextMorning":true,"wakeOnCallForUrgent":true,"urgentSlaMinutes":15,"offlineMessage":"We are currently outside office hours. Leave your email and our team will reply as soon as we open."}'::jsonb,
  availability_settings  JSONB NOT NULL DEFAULT '{"autoAwayMinutes":15,"heartbeatGraceSeconds":90,"defaultMaxConcurrentChats":4,"ringTimeoutSeconds":45}'::jsonb,
  updated_by             UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_on_call_shifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  shift_date   DATE NOT NULL,
  slot         TEXT NOT NULL DEFAULT 'all_day' CHECK (slot IN ('day', 'night', 'all_day')),
  agent_id     UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  notes        TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 300),
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, shift_date, slot)
);

CREATE INDEX IF NOT EXISTS workspace_on_call_shifts_ws_date_idx
  ON public.workspace_on_call_shifts (workspace_id, shift_date ASC);

-- ----------------------------------------------------------------------------
-- 2. Compliance Settings, Policies, Guardrails, Flags & DSR Requests
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workspace_compliance_settings (
  workspace_id        UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sentinel_enabled    BOOLEAN NOT NULL DEFAULT true,
  regional_packs      JSONB NOT NULL DEFAULT '{"eu":false,"us":false,"pk":false,"gcc":false}'::jsonb,
  attestations        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compliance_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  rule_key        TEXT,
  name            TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 160),
  description     TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  category        TEXT NOT NULL DEFAULT 'custom' CHECK (category IN ('pii', 'advice', 'disclosure', 'financial', 'custom')),
  framework       TEXT NOT NULL DEFAULT 'General' CHECK (char_length(trim(framework)) BETWEEN 1 AND 60),
  action_mode     TEXT NOT NULL DEFAULT 'flag' CHECK (action_mode IN ('redact', 'block', 'flag', 'escalate', 'approval', 'require')),
  applies_to      TEXT NOT NULL DEFAULT 'both' CHECK (applies_to IN ('ai', 'human', 'both')),
  pattern_type    TEXT NOT NULL DEFAULT 'keyword' CHECK (pattern_type IN ('builtin', 'regex', 'keyword', 'semantic')),
  pattern         TEXT NOT NULL DEFAULT '' CHECK (char_length(pattern) <= 1000),
  source_document TEXT,
  source_quote    TEXT,
  source_page     INTEGER,
  review_status   TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  is_enabled      BOOLEAN NOT NULL DEFAULT true,
  test_cases      JSONB NOT NULL DEFAULT '[]'::jsonb,
  hits_count      INTEGER NOT NULL DEFAULT 0 CHECK (hits_count >= 0),
  last_triggered_at TIMESTAMPTZ,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS compliance_policies_ws_rule_key_uidx
  ON public.compliance_policies (workspace_id, rule_key)
  WHERE rule_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS compliance_policies_ws_idx
  ON public.compliance_policies (workspace_id, category, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.compliance_flags (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  policy_id        UUID REFERENCES public.compliance_policies(id) ON DELETE SET NULL,
  conversation_id  UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id       UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  severity         TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('high', 'medium', 'low')),
  framework        TEXT NOT NULL DEFAULT 'General',
  rule_name        TEXT NOT NULL CHECK (char_length(trim(rule_name)) BETWEEN 1 AND 160),
  channel          TEXT NOT NULL DEFAULT 'chat',
  actor_type       TEXT NOT NULL DEFAULT 'ai' CHECK (actor_type IN ('customer', 'ai', 'agent', 'simulator')),
  action_taken     TEXT NOT NULL DEFAULT 'flagged' CHECK (action_taken IN ('redacted', 'blocked', 'flagged', 'escalated', 'approval_held')),
  redacted_excerpt TEXT NOT NULL DEFAULT '' CHECK (char_length(redacted_excerpt) <= 1000),
  review_status    TEXT NOT NULL DEFAULT 'open' CHECK (review_status IN ('open', 'confirmed', 'false_positive')),
  reviewed_by      UUID,
  reviewed_by_name TEXT,
  reviewed_at      TIMESTAMPTZ,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_flags_ws_idx
  ON public.compliance_flags (workspace_id, review_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.compliance_data_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  request_type    TEXT NOT NULL CHECK (request_type IN ('export', 'erasure', 'rectification', 'opt_out')),
  regulation      TEXT NOT NULL DEFAULT 'GDPR' CHECK (char_length(trim(regulation)) BETWEEN 1 AND 40),
  requester_name  TEXT NOT NULL CHECK (char_length(trim(requester_name)) BETWEEN 1 AND 160),
  requester_email TEXT NOT NULL CHECK (char_length(trim(requester_email)) BETWEEN 3 AND 254),
  visitor_id      UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('open', 'in_progress', 'pending_approval', 'completed', 'rejected')),
  progress_pct    INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  due_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  export_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at    TIMESTAMPTZ,
  approved_by     UUID,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_data_requests_ws_idx
  ON public.compliance_data_requests (workspace_id, status, due_at ASC);

-- ----------------------------------------------------------------------------
-- 3. Website Compliance Audits
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.website_compliance_audits (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  target_url         TEXT NOT NULL CHECK (char_length(trim(target_url)) BETWEEN 4 AND 500),
  overall_score      INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  framework_scores   JSONB NOT NULL DEFAULT '[]'::jsonb,
  findings           JSONB NOT NULL DEFAULT '[]'::jsonb,
  discovered_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  http_status        INTEGER,
  scanned_by         UUID,
  scanned_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS website_compliance_audits_ws_idx
  ON public.website_compliance_audits (workspace_id, scanned_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Updated_at Triggers
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_workspace_schedule_configs_updated_at ON public.workspace_schedule_configs;
CREATE TRIGGER trg_workspace_schedule_configs_updated_at
  BEFORE UPDATE ON public.workspace_schedule_configs
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_workspace_on_call_shifts_updated_at ON public.workspace_on_call_shifts;
CREATE TRIGGER trg_workspace_on_call_shifts_updated_at
  BEFORE UPDATE ON public.workspace_on_call_shifts
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_workspace_compliance_settings_updated_at ON public.workspace_compliance_settings;
CREATE TRIGGER trg_workspace_compliance_settings_updated_at
  BEFORE UPDATE ON public.workspace_compliance_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_compliance_policies_updated_at ON public.compliance_policies;
CREATE TRIGGER trg_compliance_policies_updated_at
  BEFORE UPDATE ON public.compliance_policies
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_compliance_data_requests_updated_at ON public.compliance_data_requests;
CREATE TRIGGER trg_compliance_data_requests_updated_at
  BEFORE UPDATE ON public.compliance_data_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.workspace_schedule_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_on_call_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_compliance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_compliance_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_schedule_configs_select ON public.workspace_schedule_configs;
CREATE POLICY workspace_schedule_configs_select ON public.workspace_schedule_configs
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS workspace_schedule_configs_manage ON public.workspace_schedule_configs;
CREATE POLICY workspace_schedule_configs_manage ON public.workspace_schedule_configs
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS workspace_on_call_shifts_select ON public.workspace_on_call_shifts;
CREATE POLICY workspace_on_call_shifts_select ON public.workspace_on_call_shifts
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS workspace_on_call_shifts_manage ON public.workspace_on_call_shifts;
CREATE POLICY workspace_on_call_shifts_manage ON public.workspace_on_call_shifts
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_team'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_team'));

DROP POLICY IF EXISTS workspace_compliance_settings_select ON public.workspace_compliance_settings;
CREATE POLICY workspace_compliance_settings_select ON public.workspace_compliance_settings
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS workspace_compliance_settings_manage ON public.workspace_compliance_settings;
CREATE POLICY workspace_compliance_settings_manage ON public.workspace_compliance_settings
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS compliance_policies_select ON public.compliance_policies;
CREATE POLICY compliance_policies_select ON public.compliance_policies
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS compliance_policies_manage ON public.compliance_policies;
CREATE POLICY compliance_policies_manage ON public.compliance_policies
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS compliance_flags_select ON public.compliance_flags;
CREATE POLICY compliance_flags_select ON public.compliance_flags
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS compliance_flags_manage ON public.compliance_flags;
CREATE POLICY compliance_flags_manage ON public.compliance_flags
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS compliance_data_requests_select ON public.compliance_data_requests;
CREATE POLICY compliance_data_requests_select ON public.compliance_data_requests
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS compliance_data_requests_manage ON public.compliance_data_requests;
CREATE POLICY compliance_data_requests_manage ON public.compliance_data_requests
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS website_compliance_audits_select ON public.website_compliance_audits;
CREATE POLICY website_compliance_audits_select ON public.website_compliance_audits
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS website_compliance_audits_manage ON public.website_compliance_audits;
CREATE POLICY website_compliance_audits_manage ON public.website_compliance_audits
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));
