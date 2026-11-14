-- ============================================================================
-- Customers CRM: visitor CRM attributes, customer segments, notes, and orders.
-- Idempotent migration with strict workspace RLS via fn_role_can.
-- ============================================================================

-- 1. Extend public.visitors with CRM profile attributes (nullable/defaulted so
--    anonymous live-chat widget visitor inserts continue working unchanged).
ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS plan TEXT,
  ADD COLUMN IF NOT EXISTS lifetime_value_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orders_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_visitors_workspace_last_seen
  ON public.visitors (workspace_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_visitors_workspace_segment
  ON public.visitors (workspace_id, segment);

CREATE INDEX IF NOT EXISTS idx_visitors_workspace_email_lower
  ON public.visitors (workspace_id, LOWER(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visitors_tags_gin
  ON public.visitors USING gin (tags);

-- 2. Saved customer segments per workspace
CREATE TABLE IF NOT EXISTS public.customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_segments_ws_slug
  ON public.customer_segments (workspace_id, slug);

ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_segments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_segments TO authenticated, service_role;

DROP POLICY IF EXISTS customer_segments_select ON public.customer_segments;
CREATE POLICY customer_segments_select ON public.customer_segments
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS customer_segments_write ON public.customer_segments;
CREATE POLICY customer_segments_write ON public.customer_segments
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_content'));

-- 3. Customer internal notes
CREATE TABLE IF NOT EXISTS public.visitor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  author_name TEXT,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitor_notes_ws_visitor
  ON public.visitor_notes (workspace_id, visitor_id, created_at DESC);

ALTER TABLE public.visitor_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visitor_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitor_notes TO authenticated, service_role;

DROP POLICY IF EXISTS visitor_notes_select ON public.visitor_notes;
CREATE POLICY visitor_notes_select ON public.visitor_notes
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS visitor_notes_insert ON public.visitor_notes;
CREATE POLICY visitor_notes_insert ON public.visitor_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_role_can(workspace_id, 'add_note'));

DROP POLICY IF EXISTS visitor_notes_delete ON public.visitor_notes;
CREATE POLICY visitor_notes_delete ON public.visitor_notes
  FOR DELETE TO authenticated
  USING (
    public.fn_role_can(workspace_id, 'manage_team')
    OR (author_id = auth.uid() AND public.fn_role_can(workspace_id, 'add_note'))
  );

-- 4. Customer orders (populated via integrations/webhooks or manual logging)
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid'
    CHECK (status IN ('pending', 'paid', 'fulfilled', 'refunded', 'cancelled')),
  currency TEXT NOT NULL DEFAULT 'USD',
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  items_summary TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  external_source TEXT,
  external_id TEXT,
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_orders_ws_visitor
  ON public.customer_orders (workspace_id, visitor_id, ordered_at DESC);

ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_orders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_orders TO authenticated, service_role;

DROP POLICY IF EXISTS customer_orders_select ON public.customer_orders;
CREATE POLICY customer_orders_select ON public.customer_orders
  FOR SELECT TO authenticated
  USING (public.fn_role_can(workspace_id, 'view'));

DROP POLICY IF EXISTS customer_orders_write ON public.customer_orders;
CREATE POLICY customer_orders_write ON public.customer_orders
  FOR ALL TO authenticated
  USING (public.fn_role_can(workspace_id, 'edit_content'))
  WITH CHECK (public.fn_role_can(workspace_id, 'edit_content'));

-- 5. Keep visitors.orders_count and visitors.lifetime_value_cents in sync with customer_orders
CREATE OR REPLACE FUNCTION public.fn_sync_visitor_order_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := COALESCE(NEW.visitor_id, OLD.visitor_id);
  IF v_id IS NOT NULL THEN
    UPDATE public.visitors v
    SET
      orders_count = COALESCE((
        SELECT COUNT(*)::int FROM public.customer_orders o
        WHERE o.visitor_id = v_id AND o.status <> 'cancelled'
      ), 0),
      lifetime_value_cents = COALESCE((
        SELECT SUM(o.total_cents)::int FROM public.customer_orders o
        WHERE o.visitor_id = v_id AND o.status NOT IN ('cancelled', 'refunded')
      ), 0)
    WHERE v.id = v_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_visitor_order_totals ON public.customer_orders;
CREATE TRIGGER trg_sync_visitor_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_visitor_order_totals();
