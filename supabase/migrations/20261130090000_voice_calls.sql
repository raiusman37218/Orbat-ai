-- ============================================================================
-- Voice / Calls module: settings, call records, live transcript turns,
-- and outbound voice campaigns.
-- Idempotent migration with strict workspace RLS via fn_role_can.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.voice_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'unconfigured'
    CHECK (provider IN ('unconfigured', 'twilio', 'telnyx', 'sip', 'custom')),
  business_number TEXT,
  voice_ai_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_greeting TEXT,
  transfer_group_id UUID REFERENCES public.ticket_groups(id) ON DELETE SET NULL,
  after_hours_mode TEXT NOT NULL DEFAULT 'voicemail_callback'
    CHECK (after_hours_mode IN ('voicemail_callback', 'ai_24_7', 'forward', 'closed')),
  forward_number TEXT,
  pii_redaction BOOLEAN NOT NULL DEFAULT true,
  recording_enabled BOOLEAN NOT NULL DEFAULT true,
  default_language TEXT NOT NULL DEFAULT 'en',
  monthly_minutes_cap INTEGER NOT NULL DEFAULT 3000
    CHECK (monthly_minutes_cap > 0 AND monthly_minutes_cap <= 1000000),
  webhook_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voice_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.voice_settings TO authenticated, service_role;

DROP POLICY IF EXISTS voice_settings_select ON public.voice_settings;
CREATE POLICY voice_settings_select ON public.voice_settings
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS voice_settings_write ON public.voice_settings;
CREATE POLICY voice_settings_write ON public.voice_settings
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

CREATE TABLE IF NOT EXISTS public.voice_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('active', 'scheduled', 'paused', 'completed', 'cancelled')),
  script_prompt TEXT,
  total_contacts INTEGER NOT NULL DEFAULT 0 CHECK (total_contacts >= 0),
  completed_contacts INTEGER NOT NULL DEFAULT 0 CHECK (completed_contacts >= 0),
  confirmed_count INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_count >= 0),
  cancelled_count INTEGER NOT NULL DEFAULT 0 CHECK (cancelled_count >= 0),
  no_answer_count INTEGER NOT NULL DEFAULT 0 CHECK (no_answer_count >= 0),
  schedule_label TEXT,
  created_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_campaigns_ws_created
  ON public.voice_campaigns (workspace_id, created_at DESC);

ALTER TABLE public.voice_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voice_campaigns FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.voice_campaigns TO authenticated, service_role;

DROP POLICY IF EXISTS voice_campaigns_select ON public.voice_campaigns;
CREATE POLICY voice_campaigns_select ON public.voice_campaigns
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS voice_campaigns_write ON public.voice_campaigns;
CREATE POLICY voice_campaigns_write ON public.voice_campaigns
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_content'));

CREATE TABLE IF NOT EXISTS public.voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.voice_campaigns(id) ON DELETE SET NULL,
  external_call_id TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'live'
    CHECK (status IN ('live', 'ai_resolved', 'transferred', 'voicemail', 'callback_booked', 'ended', 'missed')),
  handler TEXT NOT NULL DEFAULT 'ai' CHECK (handler IN ('ai', 'agent')),
  assigned_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  caller_name TEXT,
  caller_phone TEXT NOT NULL,
  to_number TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  recording_consent BOOLEAN NOT NULL DEFAULT true,
  order_context TEXT,
  ai_summary TEXT,
  sentiment TEXT CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative')),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  recording_url TEXT,
  is_listening BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_ws_started
  ON public.voice_calls (workspace_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_calls_ws_status
  ON public.voice_calls (workspace_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_calls_ws_external_id
  ON public.voice_calls (workspace_id, external_call_id)
  WHERE external_call_id IS NOT NULL;

ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voice_calls FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.voice_calls TO authenticated, service_role;

DROP POLICY IF EXISTS voice_calls_select ON public.voice_calls;
CREATE POLICY voice_calls_select ON public.voice_calls
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS voice_calls_write ON public.voice_calls;
CREATE POLICY voice_calls_write ON public.voice_calls
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_ticket'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_ticket'));

CREATE TABLE IF NOT EXISTS public.voice_call_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('caller', 'ai', 'agent', 'system')),
  speaker_name TEXT,
  transcript TEXT NOT NULL,
  translated_text TEXT,
  redacted_pii BOOLEAN NOT NULL DEFAULT false,
  offset_seconds INTEGER NOT NULL DEFAULT 0 CHECK (offset_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_call_turns_call_created
  ON public.voice_call_turns (call_id, created_at ASC);

ALTER TABLE public.voice_call_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voice_call_turns FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.voice_call_turns TO authenticated, service_role;

DROP POLICY IF EXISTS voice_call_turns_select ON public.voice_call_turns;
CREATE POLICY voice_call_turns_select ON public.voice_call_turns
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS voice_call_turns_insert ON public.voice_call_turns;
CREATE POLICY voice_call_turns_insert ON public.voice_call_turns
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_role_can(workspace_id, 'reply') OR public.fn_role_can(workspace_id, 'add_note'));
