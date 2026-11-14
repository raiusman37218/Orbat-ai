-- ============================================================================
-- Phase 6: Getting Started Checklist, Trial Extensions, Access Requests,
-- Customer Portal Verification, Public Pricing / Router Config & Widget Config
-- ============================================================================

-- 1. Workspace onboarding wizard & trial snooze columns
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS onboarding_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trial_reminder_snoozed_until TIMESTAMPTZ;

-- 2. Platform settings extensions for Pay-As-You-Go catalog & model router tiers
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS payg_rates JSONB NOT NULL DEFAULT '{
    "conversation_base": 0.10,
    "ai_light": 0.01,
    "ai_standard": 0.03,
    "ai_advanced": 0.08,
    "voice_minute": 0.08,
    "website_audit": 4.00
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS router_tier_models JSONB NOT NULL DEFAULT '{
    "light": "claude-3-5-haiku-latest",
    "standard": "claude-sonnet-4-20250514",
    "advanced": "claude-opus-4-20250514"
  }'::jsonb;

-- 3. Getting started checklist state per workspace (explicit completions / skips)
CREATE TABLE IF NOT EXISTS public.workspace_getting_started_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  step_key     TEXT NOT NULL CHECK (step_key IN ('profile', 'data', 'agent', 'widget', 'channels', 'team', 'live')),
  completed    BOOLEAN NOT NULL DEFAULT false,
  skipped      BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, step_key)
);

CREATE INDEX IF NOT EXISTS workspace_getting_started_tasks_ws_idx
  ON public.workspace_getting_started_tasks (workspace_id);

-- 4. Trial extension requests (Workspace asks for +7 days -> Super Admin approves)
CREATE TABLE IF NOT EXISTS public.trial_extension_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requested_by   UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  requested_days INTEGER NOT NULL DEFAULT 7 CHECK (requested_days BETWEEN 1 AND 30),
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by    UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trial_extension_requests_ws_idx
  ON public.trial_extension_requests (workspace_id, status, created_at DESC);

-- 5. Workspace access requests (403 "Request access" workflow)
CREATE TABLE IF NOT EXISTS public.workspace_access_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requester_id    UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  requester_email TEXT,
  requested_area  TEXT NOT NULL CHECK (char_length(trim(requested_area)) BETWEEN 1 AND 120),
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_access_requests_ws_idx
  ON public.workspace_access_requests (workspace_id, status, created_at DESC);

-- 6. Customer portal email verification codes (server-only, never exposed via anon RLS)
CREATE TABLE IF NOT EXISTS public.customer_portal_verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  code_hash    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_portal_verifications_lookup_idx
  ON public.customer_portal_verifications (workspace_id, lower(email), created_at DESC);

-- 7. Update public.fn_get_workspace_config so widget & studio include widget_icon, slug, widget_disabled
CREATE OR REPLACE FUNCTION public.fn_get_workspace_config(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_ws public.workspaces;
begin
  select * into v_ws from public.workspaces where id = p_workspace_id;
  if not found or coalesce(v_ws.is_suspended, false) = true or v_ws.deleted_at is not null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_ws.id,
    'name', v_ws.name,
    'slug', v_ws.slug,
    'website_url', v_ws.website_url,
    'brand_color', v_ws.brand_color,
    'logo_url', v_ws.logo_url,
    'show_launcher_logo', coalesce(v_ws.show_launcher_logo, true),
    'widget_icon', coalesce(v_ws.widget_icon, 'smile_bubble'),
    'widget_position', coalesce(v_ws.widget_position, 'right'),
    'widget_disabled', coalesce(v_ws.widget_disabled, false),
    'launcher_offset_bottom', coalesce(v_ws.launcher_offset_bottom, 20),
    'launcher_offset_side', coalesce(v_ws.launcher_offset_side, 20),
    'widget_z_index', coalesce(v_ws.widget_z_index, 2147483000),
    'enable_proactive_welcome', coalesce(v_ws.enable_proactive_welcome, true),
    'proactive_delay_seconds', coalesce(v_ws.proactive_delay_seconds, 8),
    'greeting_title', v_ws.greeting_title,
    'greeting_message', v_ws.greeting_message,
    'business_hours', v_ws.business_hours,
    'auto_assignment', v_ws.auto_assignment,
    'help_center_tab_label', coalesce(v_ws.help_center_tab_label, 'Help'),
    'show_help_tab', coalesce(v_ws.show_help_tab, true),
    'help_center_tab_icon', coalesce(v_ws.help_center_tab_icon, '📖'),
    'custom_domain', v_ws.custom_domain,
    'custom_domain_status', v_ws.custom_domain_status,
    'navbar_trigger_config', coalesce(v_ws.navbar_trigger_config, '{"enabled": false, "label": "FAQ", "action": "help", "auto_inject": false, "style": "navbar_link"}'::jsonb),
    'agents', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'avatar_url', a.avatar_url, 'status', a.status)), '[]'::jsonb)
      FROM public.agents a
      WHERE a.workspace_id = v_ws.id
    )
  );
end;
$function$;

-- 8. Row-Level Security Policies
ALTER TABLE public.workspace_getting_started_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_extension_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_getting_started_tasks_select ON public.workspace_getting_started_tasks;
CREATE POLICY workspace_getting_started_tasks_select ON public.workspace_getting_started_tasks
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS workspace_getting_started_tasks_manage ON public.workspace_getting_started_tasks;
CREATE POLICY workspace_getting_started_tasks_manage ON public.workspace_getting_started_tasks
  FOR ALL TO authenticated
  USING (public.fn_workspace_role(workspace_id) IS NOT NULL)
  WITH CHECK (public.fn_workspace_role(workspace_id) IS NOT NULL);

DROP POLICY IF EXISTS trial_extension_requests_select ON public.trial_extension_requests;
CREATE POLICY trial_extension_requests_select ON public.trial_extension_requests
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS trial_extension_requests_insert ON public.trial_extension_requests;
CREATE POLICY trial_extension_requests_insert ON public.trial_extension_requests
  FOR INSERT TO authenticated WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS workspace_access_requests_select ON public.workspace_access_requests;
CREATE POLICY workspace_access_requests_select ON public.workspace_access_requests
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS workspace_access_requests_insert ON public.workspace_access_requests;
CREATE POLICY workspace_access_requests_insert ON public.workspace_access_requests
  FOR INSERT TO authenticated WITH CHECK (public.fn_workspace_role(workspace_id) IS NOT NULL);
