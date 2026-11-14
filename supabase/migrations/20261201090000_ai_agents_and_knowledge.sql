-- ==========================================================================
-- Phase 2: AI Agents, Versioning, Trust Ladder, Verification Logs,
-- Multilingual Engine Config, and Knowledge Base Enhancements
-- ==========================================================================

-- 1. AI AGENTS ROSTER & BUILDER DRAFT/PUBLISHED STATE
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  role_title TEXT NOT NULL DEFAULT 'Support specialist',
  description TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT '#6D3FD6',
  template_id TEXT,
  industry TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('live', 'draft', 'paused')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  channels TEXT[] NOT NULL DEFAULT ARRAY['web']::TEXT[],
  tone TEXT NOT NULL DEFAULT 'Clear, warm, concise',
  reply_language_mode TEXT NOT NULL DEFAULT 'match_customer'
    CHECK (reply_language_mode IN ('match_customer', 'native_script', 'english_only')),
  answer_mode TEXT NOT NULL DEFAULT 'agent' CHECK (answer_mode IN ('agent', 'strict')),
  system_prompt TEXT NOT NULL DEFAULT '',
  guardrails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  escalation_rules JSONB NOT NULL DEFAULT '{"confidenceThreshold":0.7,"handoffOnFrustration":true,"maxBotTurns":8,"requireConfirmation":true,"blockedTopics":[]}'::JSONB,
  knowledge_scope JSONB NOT NULL DEFAULT '{"allArticles":true,"sectionIds":[],"includeBotKnowledge":true}'::JSONB,
  capabilities JSONB NOT NULL DEFAULT '{"actions":[],"frameworks":[],"subAgentId":null}'::JSONB,
  appearance JSONB NOT NULL DEFAULT '{"badgeLabel":"AI agent","showCitations":true,"welcomeMessage":""}'::JSONB,
  published_version INTEGER NOT NULL DEFAULT 0 CHECK (published_version >= 0),
  draft_version INTEGER NOT NULL DEFAULT 1 CHECK (draft_version >= 1),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_workspace_status
  ON public.ai_agents (workspace_id, status, is_primary DESC, updated_at DESC);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_agents FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_agents TO authenticated, service_role;

DROP POLICY IF EXISTS ai_agents_select ON public.ai_agents;
CREATE POLICY ai_agents_select ON public.ai_agents
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS ai_agents_write ON public.ai_agents;
CREATE POLICY ai_agents_write ON public.ai_agents
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));


-- 2. AI AGENT VERSION HISTORY
CREATE TABLE IF NOT EXISTS public.ai_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  summary TEXT NOT NULL DEFAULT '',
  snapshot JSONB NOT NULL,
  created_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_versions_agent_created
  ON public.ai_agent_versions (agent_id, version_number DESC);

ALTER TABLE public.ai_agent_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_agent_versions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_agent_versions TO authenticated, service_role;

DROP POLICY IF EXISTS ai_agent_versions_select ON public.ai_agent_versions;
CREATE POLICY ai_agent_versions_select ON public.ai_agent_versions
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS ai_agent_versions_write ON public.ai_agent_versions;
CREATE POLICY ai_agent_versions_write ON public.ai_agent_versions
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));


-- 3. AI TRUST LADDER (PER-AGENT, PER-TOPIC AUTONOMY)
CREATE TABLE IF NOT EXISTS public.ai_autonomy_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  level SMALLINT NOT NULL DEFAULT 2 CHECK (level BETWEEN 1 AND 4),
  locked BOOLEAN NOT NULL DEFAULT false,
  lock_reason TEXT,
  last_changed_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  last_changed_by_name TEXT,
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, agent_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_ai_autonomy_policies_workspace_agent
  ON public.ai_autonomy_policies (workspace_id, agent_id);

ALTER TABLE public.ai_autonomy_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_autonomy_policies FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_autonomy_policies TO authenticated, service_role;

DROP POLICY IF EXISTS ai_autonomy_policies_select ON public.ai_autonomy_policies;
CREATE POLICY ai_autonomy_policies_select ON public.ai_autonomy_policies
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS ai_autonomy_policies_write ON public.ai_autonomy_policies;
CREATE POLICY ai_autonomy_policies_write ON public.ai_autonomy_policies
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));


-- 4. AI CLAIM VERIFICATION & QUALITY REVIEW LOGS
CREATE TABLE IF NOT EXISTS public.ai_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  agent_name TEXT,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  channel TEXT,
  topic TEXT,
  customer_question TEXT NOT NULL,
  draft_reply TEXT NOT NULL,
  final_reply TEXT,
  verdict TEXT NOT NULL DEFAULT 'supported'
    CHECK (verdict IN ('supported', 'blocked_fixed', 'blocked_human', 'needs_review')),
  human_review TEXT CHECK (human_review IN ('correct', 'wrong')),
  reviewed_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  claims JSONB NOT NULL DEFAULT '[]'::JSONB,
  outcome_note TEXT,
  confidence NUMERIC(4, 3),
  latency_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_verification_logs_workspace_created
  ON public.ai_verification_logs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_verification_logs_agent_verdict
  ON public.ai_verification_logs (workspace_id, agent_id, verdict, created_at DESC);

ALTER TABLE public.ai_verification_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_verification_logs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_verification_logs TO authenticated, service_role;

DROP POLICY IF EXISTS ai_verification_logs_select ON public.ai_verification_logs;
CREATE POLICY ai_verification_logs_select ON public.ai_verification_logs
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS ai_verification_logs_insert ON public.ai_verification_logs;
CREATE POLICY ai_verification_logs_insert ON public.ai_verification_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_role_can(workspace_id, 'reply') OR public.fn_role_can(workspace_id, 'edit_content'));

DROP POLICY IF EXISTS ai_verification_logs_update ON public.ai_verification_logs;
CREATE POLICY ai_verification_logs_update ON public.ai_verification_logs
  FOR UPDATE TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_content'));


-- 5. MULTILINGUAL ENGINE CONFIGURATION
CREATE TABLE IF NOT EXISTS public.ai_language_configs (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reply_style TEXT NOT NULL DEFAULT 'match_customer'
    CHECK (reply_style IN ('match_customer', 'native_script', 'english_only')),
  switch_mid_conversation BOOLEAN NOT NULL DEFAULT true,
  show_translation_to_agents BOOLEAN NOT NULL DEFAULT true,
  transcribe_voice_notes BOOLEAN NOT NULL DEFAULT true,
  reply_voice_notes_audio BOOLEAN NOT NULL DEFAULT false,
  handoff_low_confidence BOOLEAN NOT NULL DEFAULT true,
  low_confidence_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.70
    CHECK (low_confidence_threshold BETWEEN 0.30 AND 0.99),
  enabled_languages JSONB NOT NULL DEFAULT '{"en":true,"ur":true,"hi":true,"ar":true,"es":true}'::JSONB,
  updated_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_language_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_language_configs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_language_configs TO authenticated, service_role;

DROP POLICY IF EXISTS ai_language_configs_select ON public.ai_language_configs;
CREATE POLICY ai_language_configs_select ON public.ai_language_configs
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS ai_language_configs_write ON public.ai_language_configs;
CREATE POLICY ai_language_configs_write ON public.ai_language_configs
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'manage_settings'))
  WITH CHECK (public.fn_role_can(workspace_id, 'manage_settings'));


-- 6. KNOWLEDGE BASE: ARTICLE LANGUAGES & VERSION HISTORY
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT ARRAY['en']::TEXT[];

CREATE TABLE IF NOT EXISTS public.article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  edited_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  edited_by_name TEXT,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (article_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_article_versions_article_created
  ON public.article_versions (article_id, version_number DESC);

ALTER TABLE public.article_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.article_versions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.article_versions TO authenticated, service_role;

DROP POLICY IF EXISTS article_versions_select ON public.article_versions;
CREATE POLICY article_versions_select ON public.article_versions
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS article_versions_write ON public.article_versions;
CREATE POLICY article_versions_write ON public.article_versions
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_content'));
