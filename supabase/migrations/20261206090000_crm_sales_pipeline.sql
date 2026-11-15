-- ============================================================================
-- B2B Sales CRM extension: companies/accounts, deals pipeline, and sales tasks.
-- Idempotent migration with strict workspace RLS via fn_role_can.
-- ============================================================================

-- 1. Companies / Accounts hierarchy
CREATE TABLE IF NOT EXISTS public.crm_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  domain TEXT,
  industry TEXT,
  size TEXT,
  website TEXT,
  annual_revenue_cents BIGINT NOT NULL DEFAULT 0 CHECK (annual_revenue_cents >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_companies_ws_name
  ON public.crm_companies (workspace_id, LOWER(name));

CREATE INDEX IF NOT EXISTS idx_crm_companies_ws_created
  ON public.crm_companies (workspace_id, created_at DESC);

ALTER TABLE public.crm_companies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_companies FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_companies TO authenticated, service_role;

DROP POLICY IF EXISTS crm_companies_select ON public.crm_companies;
CREATE POLICY crm_companies_select ON public.crm_companies
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS crm_companies_write ON public.crm_companies;
CREATE POLICY crm_companies_write ON public.crm_companies
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_content'));

-- 2. Deals & Sales Pipeline
CREATE TABLE IF NOT EXISTS public.crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  stage TEXT NOT NULL DEFAULT 'lead'
    CHECK (stage IN ('lead', 'qualified', 'demo', 'proposal', 'won', 'lost')),
  value_cents BIGINT NOT NULL DEFAULT 0 CHECK (value_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  probability INTEGER NOT NULL DEFAULT 20 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  owner_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  notes TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_deals_ws_stage
  ON public.crm_deals (workspace_id, stage, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_deals_ws_visitor
  ON public.crm_deals (workspace_id, visitor_id)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_deals_ws_company
  ON public.crm_deals (workspace_id, company_id)
  WHERE company_id IS NOT NULL;

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_deals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_deals TO authenticated, service_role;

DROP POLICY IF EXISTS crm_deals_select ON public.crm_deals;
CREATE POLICY crm_deals_select ON public.crm_deals
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS crm_deals_write ON public.crm_deals;
CREATE POLICY crm_deals_write ON public.crm_deals
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_content'));

-- 3. Sales Tasks & Follow-up Reminders
CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'follow_up'
    CHECK (kind IN ('call', 'email', 'meeting', 'follow_up', 'todo')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed')),
  due_at TIMESTAMPTZ,
  assignee_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_ws_status_due
  ON public.crm_tasks (workspace_id, status, due_at ASC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_ws_visitor
  ON public.crm_tasks (workspace_id, visitor_id)
  WHERE visitor_id IS NOT NULL;

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_tasks TO authenticated, service_role;

DROP POLICY IF EXISTS crm_tasks_select ON public.crm_tasks;
CREATE POLICY crm_tasks_select ON public.crm_tasks
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS crm_tasks_insert ON public.crm_tasks;
CREATE POLICY crm_tasks_insert ON public.crm_tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_role_can(workspace_id, 'add_note'));

DROP POLICY IF EXISTS crm_tasks_update ON public.crm_tasks;
CREATE POLICY crm_tasks_update ON public.crm_tasks
  FOR UPDATE TO authenticated
  USING (public.fn_role_can(workspace_id, 'add_note'))
  WITH CHECK (public.fn_role_can(workspace_id, 'add_note'));

DROP POLICY IF EXISTS crm_tasks_delete ON public.crm_tasks;
CREATE POLICY crm_tasks_delete ON public.crm_tasks
  FOR DELETE TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'));
