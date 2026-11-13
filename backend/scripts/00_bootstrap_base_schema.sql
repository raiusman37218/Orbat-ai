-- ============================================================================
-- Bootstrap Base Schema for Orbat AI
-- Creates the foundational tables and missing base columns
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. Ensure all core columns on public.workspaces exist
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS greeting_title TEXT NOT NULL DEFAULT 'Welcome to Orbat AI',
  ADD COLUMN IF NOT EXISTS greeting_message TEXT NOT NULL DEFAULT 'How can we help you today?',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS show_launcher_logo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS widget_icon TEXT DEFAULT 'smile_bubble',
  ADD COLUMN IF NOT EXISTS widget_position TEXT DEFAULT 'right',
  ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_assignment JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS smtp_settings JSONB,
  ADD COLUMN IF NOT EXISTS help_center_tab_label TEXT DEFAULT 'Help',
  ADD COLUMN IF NOT EXISTS show_help_tab BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS help_center_tab_icon TEXT DEFAULT 'book',
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS slug_changes_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slug_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_status TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_verification_token TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_notification_sent TEXT,
  ADD COLUMN IF NOT EXISTS help_center_title TEXT,
  ADD COLUMN IF NOT EXISTS help_center_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS help_center_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS help_center_header_links JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS help_center_footer_text TEXT,
  ADD COLUMN IF NOT EXISTS help_center_layout TEXT DEFAULT 'grid-3',
  ADD COLUMN IF NOT EXISTS help_center_theme JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS navbar_trigger_config JSONB,
  ADD COLUMN IF NOT EXISTS launcher_offset_bottom INT,
  ADD COLUMN IF NOT EXISTS launcher_offset_side INT,
  ADD COLUMN IF NOT EXISTS widget_z_index INT,
  ADD COLUMN IF NOT EXISTS enable_proactive_welcome BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS proactive_delay_seconds INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS widget_installed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_limits JSONB,
  ADD COLUMN IF NOT EXISTS merged_into_workspace_id UUID,
  ADD COLUMN IF NOT EXISTS auto_close_days INT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS csat_settings JSONB,
  ADD COLUMN IF NOT EXISTS widget_disabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_powered_by TEXT DEFAULT 'inherited',
  ADD COLUMN IF NOT EXISTS help_center_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_retention_days INT,
  ADD COLUMN IF NOT EXISTS ai_monthly_reply_cap INT,
  ADD COLUMN IF NOT EXISTS ai_monthly_cost_cap_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS channel_disabled_overrides JSONB,
  ADD COLUMN IF NOT EXISTS is_outbound_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_by UUID,
  ADD COLUMN IF NOT EXISTS handoff_settings JSONB DEFAULT '{}'::jsonb;

-- 2. ARTICLES TABLE
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  section_id UUID,
  title TEXT NOT NULL,
  slug TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  summary TEXT,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published',
  author_id UUID,
  views_count INT NOT NULL DEFAULT 0,
  helpful_count INT NOT NULL DEFAULT 0,
  not_helpful_count INT NOT NULL DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. WORKSPACE INTEGRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  langgraph_enabled BOOLEAN DEFAULT false,
  langgraph_webhook_url TEXT,
  langgraph_api_key TEXT,
  langgraph_system_prompt TEXT,
  langgraph_auto_pilot BOOLEAN DEFAULT false,
  whatsapp_enabled BOOLEAN DEFAULT false,
  whatsapp_phone_number_id TEXT,
  whatsapp_access_token TEXT,
  whatsapp_business_account_id TEXT,
  meta_enabled BOOLEAN DEFAULT false,
  meta_page_access_token TEXT,
  meta_verify_token TEXT,
  meta_app_secret TEXT,
  linkedin_enabled BOOLEAN DEFAULT false,
  linkedin_access_token TEXT,
  linkedin_organization_urn TEXT,
  slack_enabled BOOLEAN DEFAULT false,
  slack_webhook_url TEXT,
  email_offline_notifications BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PLATFORM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  platform_name TEXT NOT NULL DEFAULT 'Orbat AI',
  platform_url TEXT NOT NULL DEFAULT 'https://orbat.ai',
  support_email TEXT NOT NULL DEFAULT 'support@orbat.ai',
  smtp_settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. EMAIL VERIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PUBLIC WORKSPACES VIEW
CREATE OR REPLACE VIEW public.public_workspaces AS
SELECT
  id, name, website_url, brand_color, logo_url, widget_position, widget_icon,
  greeting_title, greeting_message, help_center_tab_label, show_help_tab,
  help_center_tab_icon, slug, custom_domain, custom_domain_status,
  help_center_title, help_center_subtitle, help_center_logo_url,
  help_center_header_links, help_center_footer_text, help_center_layout,
  help_center_theme, navbar_trigger_config, slug_changes_count, created_at
FROM public.workspaces;
