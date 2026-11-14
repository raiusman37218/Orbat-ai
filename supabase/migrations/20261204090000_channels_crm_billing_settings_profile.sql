-- ============================================================================
-- Phase 5: Channels Marketplace, CRM Commerce Connect, PAYG Billing Profile,
-- Workspace Settings Extensions, Transactional Email Templates & Agent Profile
-- ============================================================================

-- 1. Workspace Settings & Billing extensions
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS company_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_behavior_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS security_policies JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Agent Profile extensions (spoken languages, display name, on-call phone, availability mode)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS on_call_phone TEXT,
  ADD COLUMN IF NOT EXISTS spoken_languages TEXT[] NOT NULL DEFAULT ARRAY['English']::text[],
  ADD COLUMN IF NOT EXISTS availability_mode TEXT NOT NULL DEFAULT 'online';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.agents'::regclass
      AND conname = 'agents_availability_mode_check'
  ) THEN
    ALTER TABLE public.agents
      ADD CONSTRAINT agents_availability_mode_check
      CHECK (availability_mode IN ('online', 'away', 'dnd', 'offline'));
  END IF;
END $$;

-- 3. Agent notification & workload extensions
ALTER TABLE public.agent_notification_preferences
  ADD COLUMN IF NOT EXISTS auto_away_on_idle BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ring_on_handoff BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS urgent_pings_on_breach BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_matrix JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. Workspace Invoices extensions (seat count & billing metadata)
ALTER TABLE public.workspace_invoices
  ADD COLUMN IF NOT EXISTS seat_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5. Workspace Billing Profiles (Fixed vs PAYG mode, wallet & cap settings, billing details)
CREATE TABLE IF NOT EXISTS public.workspace_billing_profiles (
  workspace_id             UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  billing_mode             TEXT NOT NULL DEFAULT 'fixed' CHECK (billing_mode IN ('fixed', 'payg')),
  wallet_balance_usd       NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  auto_topup_enabled       BOOLEAN NOT NULL DEFAULT false,
  auto_topup_threshold_usd NUMERIC(10, 2) NOT NULL DEFAULT 15.00 CHECK (auto_topup_threshold_usd >= 0),
  auto_topup_amount_usd    NUMERIC(10, 2) NOT NULL DEFAULT 50.00 CHECK (auto_topup_amount_usd >= 5),
  monthly_spending_cap_usd NUMERIC(10, 2) DEFAULT 300.00 CHECK (monthly_spending_cap_usd IS NULL OR monthly_spending_cap_usd >= 10),
  billing_company_name     TEXT,
  billing_email            TEXT,
  billing_country          TEXT NOT NULL DEFAULT 'United States',
  tax_id                   TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Workspace App Integrations (Marketplace cards on Channels -> Integrations)
CREATE TABLE IF NOT EXISTS public.workspace_app_integrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  app_key        TEXT NOT NULL CHECK (char_length(trim(app_key)) BETWEEN 1 AND 64),
  category       TEXT NOT NULL CHECK (category IN ('ecommerce', 'payments', 'crm', 'team_chat', 'developer')),
  status         TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'needs_attention', 'pending_oauth')),
  account_label  TEXT,
  config         JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_by   UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  connected_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, app_key)
);

CREATE INDEX IF NOT EXISTS workspace_app_integrations_ws_idx
  ON public.workspace_app_integrations (workspace_id, category);

-- 7. Workspace Commerce / Website CRM Connections (/app/channels/connect)
CREATE TABLE IF NOT EXISTS public.workspace_commerce_connections (
  workspace_id     UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL DEFAULT 'custom' CHECK (platform IN ('shopify', 'woocommerce', 'custom')),
  store_url        TEXT,
  store_name       TEXT,
  status           TEXT NOT NULL DEFAULT 'not_connected' CHECK (status IN ('not_connected', 'syncing', 'connected', 'error')),
  step_progress    INTEGER NOT NULL DEFAULT 1 CHECK (step_progress BETWEEN 1 AND 5),
  synced_metrics   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_actions       JSONB NOT NULL DEFAULT '{"track": true, "return": false, "cod": false, "wallet": true, "book": false, "lead": true}'::jsonb,
  industry_fields  TEXT[] NOT NULL DEFAULT ARRAY['order_id', 'shipping_status', 'plan_tier', 'ltv_usd']::text[],
  install_token    TEXT NOT NULL DEFAULT ('orb_crm_' || replace(gen_random_uuid()::text, '-', '')),
  last_verified_at TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Workspace Transactional Email Templates (/app/settings/emails)
CREATE TABLE IF NOT EXISTS public.workspace_email_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_key        TEXT NOT NULL CHECK (char_length(trim(template_key)) BETWEEN 1 AND 64),
  category            TEXT NOT NULL CHECK (category IN ('Conversations', 'Tickets', 'Security', 'Compliance')),
  name                TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  trigger_description TEXT NOT NULL DEFAULT '',
  language            TEXT NOT NULL DEFAULT 'en' CHECK (char_length(trim(language)) BETWEEN 2 AND 16),
  subject             TEXT NOT NULL DEFAULT '',
  body                TEXT NOT NULL DEFAULT '',
  cta_label           TEXT NOT NULL DEFAULT '',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  available_variables TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_by          UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, template_key, language)
);

CREATE INDEX IF NOT EXISTS workspace_email_templates_ws_idx
  ON public.workspace_email_templates (workspace_id, category, template_key);

-- 9. Row-Level Security Policies
ALTER TABLE public.workspace_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_app_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_commerce_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_billing_profiles_select ON public.workspace_billing_profiles;
CREATE POLICY workspace_billing_profiles_select ON public.workspace_billing_profiles
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS workspace_billing_profiles_manage ON public.workspace_billing_profiles;
CREATE POLICY workspace_billing_profiles_manage ON public.workspace_billing_profiles
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS workspace_app_integrations_select ON public.workspace_app_integrations;
CREATE POLICY workspace_app_integrations_select ON public.workspace_app_integrations
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS workspace_app_integrations_manage ON public.workspace_app_integrations;
CREATE POLICY workspace_app_integrations_manage ON public.workspace_app_integrations
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS workspace_commerce_connections_select ON public.workspace_commerce_connections;
CREATE POLICY workspace_commerce_connections_select ON public.workspace_commerce_connections
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS workspace_commerce_connections_manage ON public.workspace_commerce_connections;
CREATE POLICY workspace_commerce_connections_manage ON public.workspace_commerce_connections
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));

DROP POLICY IF EXISTS workspace_email_templates_select ON public.workspace_email_templates;
CREATE POLICY workspace_email_templates_select ON public.workspace_email_templates
  FOR SELECT TO authenticated USING (public.fn_workspace_role(workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS workspace_email_templates_manage ON public.workspace_email_templates;
CREATE POLICY workspace_email_templates_manage ON public.workspace_email_templates
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));
