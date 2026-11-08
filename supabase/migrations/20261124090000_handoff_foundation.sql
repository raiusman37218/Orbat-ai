-- ============================================================================
-- Migration: 20261124090000_handoff_foundation.sql
-- Description: Phase 1 & 2 Foundation for AI -> Human Agent Handoff System
--   - Additive columns on conversations, workspaces, agent_notification_preferences
--   - Tables: agent_status, push_subscriptions, conversation_events
--   - Indexes, strict RLS policies, and role grants
--   - Atomic state transition RPCs, AI guard in fn_deliver_ai_reply,
--     office-hours & availability helpers, and widget session RPC wrappers.
--   - Safe and idempotent: can be run multiple times without error.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Additive Columns on Existing Tables
-- ----------------------------------------------------------------------------

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS handoff_status TEXT NOT NULL DEFAULT 'bot_active',
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_assist BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ringing_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ring_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ring_broadcast BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skipped_agent_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS handoff_reason TEXT,
  ADD COLUMN IF NOT EXISTS handoff_summary TEXT,
  ADD COLUMN IF NOT EXISTS handoff_offered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_offer_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS handoff_last_offer_msg_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_agent_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS previous_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unanswered_alert_sent_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.conversations'::regclass
       AND conname = 'conversations_handoff_status_check'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_handoff_status_check
      CHECK (handoff_status IN (
        'bot_active',
        'handoff_offered',
        'waiting_for_agent',
        'agent_active',
        'offline_queued',
        'resolved'
      ));
  END IF;
END $$;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS handoff_settings JSONB NOT NULL DEFAULT jsonb_build_object(
    'handoff_mode', 'on',
    'routing_mode', 'least_busy',
    'broadcast_enabled', true,
    'ring_timeout_seconds', 45,
    'queue_timeout_seconds', 300,
    'first_reply_timeout_seconds', 180,
    'unanswered_alert_to', 'owner',
    'rr_last_agent_id', NULL
  );

ALTER TABLE public.agent_notification_preferences
  ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_name TEXT NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_missed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_queue_summary BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 2. New Tables: agent_status, push_subscriptions, conversation_events
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_status (
  agent_id             UUID PRIMARY KEY REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id         UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  manual_status        TEXT NOT NULL DEFAULT 'away' CHECK (manual_status IN ('online', 'away')),
  last_heartbeat       TIMESTAMPTZ,
  last_activity_at     TIMESTAMPTZ,
  max_concurrent_chats INTEGER NOT NULL DEFAULT 4 CHECK (max_concurrent_chats BETWEEN 1 AND 50),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  device_label TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('customer', 'ai', 'agent', 'system')),
  actor_id        UUID,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed agent_status rows safely for existing agents without modifying existing rows
INSERT INTO public.agent_status (agent_id, workspace_id, manual_status, max_concurrent_chats)
SELECT a.id,
       a.workspace_id,
       CASE WHEN a.status = 'online' THEN 'online' ELSE 'away' END,
       LEAST(GREATEST(COALESCE(a.max_open_tickets, 4), 1), 50)
  FROM public.agents a
 WHERE a.workspace_id IS NOT NULL
ON CONFLICT (agent_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Indexes for Cron, Routing & Dashboard Queries
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS conversations_handoff_status_ws_idx
  ON public.conversations (workspace_id, handoff_status);

CREATE INDEX IF NOT EXISTS conversations_status_ws_idx
  ON public.conversations (workspace_id, status);

CREATE INDEX IF NOT EXISTS conversations_ringing_agent_idx
  ON public.conversations (ringing_agent_id, ring_started_at)
  WHERE ringing_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversations_handoff_stale_idx
  ON public.conversations (handoff_status, handoff_requested_at, updated_at);

CREATE INDEX IF NOT EXISTS conversations_first_reply_analytics_idx
  ON public.conversations (workspace_id, handoff_requested_at DESC)
  WHERE handoff_requested_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_status_ws_manual_idx
  ON public.agent_status (workspace_id, manual_status, last_heartbeat);

CREATE INDEX IF NOT EXISTS push_subscriptions_agent_idx
  ON public.push_subscriptions (agent_id);

CREATE INDEX IF NOT EXISTS conversation_events_conv_idx
  ON public.conversation_events (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS conversation_events_ws_type_idx
  ON public.conversation_events (workspace_id, type, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Row Level Security & Grants
-- ----------------------------------------------------------------------------

ALTER TABLE public.agent_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.agent_status FROM PUBLIC, anon;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC, anon;
REVOKE ALL ON public.conversation_events FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON public.agent_status TO authenticated;
GRANT ALL ON public.agent_status TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

GRANT SELECT ON public.conversation_events TO authenticated;
GRANT ALL ON public.conversation_events TO service_role;

-- agent_status policies: workspace members can view; owning agent or workspace admin can update
DROP POLICY IF EXISTS agent_status_select_ws ON public.agent_status;
CREATE POLICY agent_status_select_ws ON public.agent_status
  FOR SELECT TO authenticated
  USING (public.fn_workspace_role(workspace_id) IS NOT NULL);

DROP POLICY IF EXISTS agent_status_insert_own ON public.agent_status;
CREATE POLICY agent_status_insert_own ON public.agent_status
  FOR INSERT TO authenticated
  WITH CHECK (
    (agent_id = (SELECT auth.uid()) AND public.fn_workspace_role(workspace_id) IS NOT NULL)
    OR public.fn_workspace_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS agent_status_update_own ON public.agent_status;
CREATE POLICY agent_status_update_own ON public.agent_status
  FOR UPDATE TO authenticated
  USING (
    (agent_id = (SELECT auth.uid()) AND public.fn_workspace_role(workspace_id) IS NOT NULL)
    OR public.fn_workspace_role(workspace_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    (agent_id = (SELECT auth.uid()) AND public.fn_workspace_role(workspace_id) IS NOT NULL)
    OR public.fn_workspace_role(workspace_id) IN ('owner', 'admin')
  );

-- push_subscriptions policies: strictly owning agent only (plus service_role bypass)
DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (agent_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (agent_id = (SELECT auth.uid()))
  WITH CHECK (agent_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (agent_id = (SELECT auth.uid()));

-- conversation_events policies: workspace members can read; writes via server RPCs / service_role only
DROP POLICY IF EXISTS conversation_events_select_ws ON public.conversation_events;
CREATE POLICY conversation_events_select_ws ON public.conversation_events
  FOR SELECT TO authenticated
  USING (public.fn_workspace_role(workspace_id) IS NOT NULL);

-- Seed telegram_notifications feature flag (disabled by default, behind feature flag per Spec F)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'platform_feature_flags'
  ) THEN
    INSERT INTO public.platform_feature_flags (key, enabled, description)
    VALUES (
      'telegram_notifications',
      false,
      'Allow agents to connect a Telegram chat ID to receive handoff ring and queue alerts.'
    )
    ON CONFLICT (key) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Event Logger & Office Hours / Availability Helpers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_log_conversation_event(
  p_conversation_id UUID,
  p_workspace_id UUID,
  p_type TEXT,
  p_actor_type TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws UUID := p_workspace_id;
BEGIN
  IF v_ws IS NULL THEN
    SELECT workspace_id INTO v_ws FROM public.conversations WHERE id = p_conversation_id;
  END IF;
  IF v_ws IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.conversation_events (
    conversation_id, workspace_id, type, actor_type, actor_id, meta
  )
  VALUES (
    p_conversation_id,
    v_ws,
    p_type,
    CASE WHEN p_actor_type IN ('customer', 'ai', 'agent', 'system') THEN p_actor_type ELSE 'system' END,
    p_actor_id,
    COALESCE(p_meta, '{}'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_log_conversation_event(UUID, UUID, TEXT, TEXT, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;

-- Office hours check using workspace's timezone (never customer's) and workspace_holidays
CREATE OR REPLACE FUNCTION public.fn_is_within_office_hours(
  p_workspace_id UUID,
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg JSONB;
  v_tz TEXT;
  v_local TIMESTAMP;
  v_date DATE;
  v_time TIME;
  v_dow INT;
  v_days TEXT[] := ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  v_short TEXT[] := ARRAY['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  v_sched JSONB;
  v_day JSONB;
  v_day_enabled BOOLEAN;
  v_start TIME;
  v_end TIME;
BEGIN
  IF p_workspace_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT w.business_hours INTO v_cfg
    FROM public.workspaces w
   WHERE w.id = p_workspace_id;

  -- When office hours schedule is not enabled, workspace accepts live chats 24/7
  -- unless today is a workspace holiday.
  v_tz := public.fn_sla_timezone(p_workspace_id);
  v_local := p_at AT TIME ZONE v_tz;
  v_date := v_local::date;

  IF public.fn_sla_is_holiday(p_workspace_id, v_date) THEN
    RETURN false;
  END IF;

  IF v_cfg IS NULL OR NOT COALESCE((v_cfg ->> 'enabled')::boolean, false) THEN
    RETURN true;
  END IF;

  v_time := v_local::time;
  v_dow := EXTRACT(dow FROM v_date)::int;
  v_sched := COALESCE(v_cfg -> 'schedule', v_cfg);
  v_day := COALESCE(v_sched -> v_days[v_dow + 1], v_sched -> v_short[v_dow + 1]);

  IF v_day IS NULL OR jsonb_typeof(v_day) <> 'object' THEN
    RETURN false;
  END IF;

  v_day_enabled := COALESCE((v_day ->> 'enabled')::boolean, (v_day ->> 'active')::boolean, false);
  IF NOT v_day_enabled THEN
    RETURN false;
  END IF;

  BEGIN
    v_start := COALESCE(NULLIF(v_day ->> 'start', ''), NULLIF(v_day ->> 'open', ''), '09:00')::time;
    v_end   := COALESCE(NULLIF(v_day ->> 'end', ''),   NULLIF(v_day ->> 'close', ''), '17:00')::time;
  EXCEPTION WHEN OTHERS THEN
    RETURN true;
  END;

  IF v_end <= v_start THEN
    RETURN false;
  END IF;

  RETURN (v_time >= v_start AND v_time < v_end);
END;
$$;

-- Computes next open timestamp & human-readable label in the workspace's timezone
CREATE OR REPLACE FUNCTION public.fn_next_office_hours_open(
  p_workspace_id UUID,
  p_from TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg JSONB;
  v_tz TEXT;
  v_local_now TIMESTAMP;
  v_today DATE;
  v_d DATE;
  v_i INT;
  v_dow INT;
  v_days TEXT[] := ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  v_short TEXT[] := ARRAY['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  v_sched JSONB;
  v_day JSONB;
  v_day_enabled BOOLEAN;
  v_start TIME;
  v_end TIME;
  v_open_ts TIMESTAMPTZ;
  v_time_str TEXT;
  v_label TEXT;
BEGIN
  v_tz := public.fn_sla_timezone(p_workspace_id);
  SELECT w.business_hours INTO v_cfg FROM public.workspaces w WHERE w.id = p_workspace_id;

  v_local_now := p_from AT TIME ZONE v_tz;
  v_today := v_local_now::date;

  IF v_cfg IS NULL OR NOT COALESCE((v_cfg ->> 'enabled')::boolean, false) THEN
    -- Schedule is 24/7 (or agent simply offline right now); check if today is a holiday
    IF NOT public.fn_sla_is_holiday(p_workspace_id, v_today) THEN
      RETURN jsonb_build_object(
        'open_at', NULL,
        'timezone', v_tz,
        'label', 'as soon as an agent is back online'
      );
    END IF;
  END IF;

  v_sched := COALESCE(v_cfg -> 'schedule', v_cfg);

  FOR v_i IN 0..14 LOOP
    v_d := v_today + v_i;
    IF NOT public.fn_sla_is_holiday(p_workspace_id, v_d) THEN
      IF v_cfg IS NULL OR NOT COALESCE((v_cfg ->> 'enabled')::boolean, false) THEN
        v_start := '09:00'::time;
        v_end := '17:00'::time;
        v_day_enabled := true;
      ELSE
        v_dow := EXTRACT(dow FROM v_d)::int;
        v_day := COALESCE(v_sched -> v_days[v_dow + 1], v_sched -> v_short[v_dow + 1]);
        v_day_enabled := v_day IS NOT NULL
          AND jsonb_typeof(v_day) = 'object'
          AND COALESCE((v_day ->> 'enabled')::boolean, (v_day ->> 'active')::boolean, false);
        IF v_day_enabled THEN
          BEGIN
            v_start := COALESCE(NULLIF(v_day ->> 'start', ''), NULLIF(v_day ->> 'open', ''), '09:00')::time;
            v_end   := COALESCE(NULLIF(v_day ->> 'end', ''),   NULLIF(v_day ->> 'close', ''), '17:00')::time;
          EXCEPTION WHEN OTHERS THEN
            v_day_enabled := false;
          END;
        END IF;
      END IF;

      IF v_day_enabled AND v_end > v_start THEN
        IF v_i > 0 OR v_local_now::time < v_start THEN
          v_open_ts := (v_d + v_start) AT TIME ZONE v_tz;
          v_time_str := trim(to_char(v_d + v_start, 'FMHH12:MI AM'));
          IF v_i = 0 THEN
            v_label := 'today at ' || v_time_str || ' (' || v_tz || ')';
          ELSIF v_i = 1 THEN
            v_label := 'tomorrow at ' || v_time_str || ' (' || v_tz || ')';
          ELSE
            v_label := to_char(v_d, 'Dy, Mon FMDD') || ' at ' || v_time_str || ' (' || v_tz || ')';
          END IF;
          RETURN jsonb_build_object(
            'open_at', v_open_ts,
            'timezone', v_tz,
            'label', v_label
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'open_at', NULL,
    'timezone', v_tz,
    'label', 'the next business day'
  );
END;
$$;

-- Active handoff chat count for an agent
CREATE OR REPLACE FUNCTION public.fn_agent_active_chats(
  p_agent_id UUID,
  p_workspace_id UUID
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
    FROM public.conversations c
   WHERE c.workspace_id = p_workspace_id
     AND c.assigned_agent_id = p_agent_id
     AND c.status = 'open'
     AND c.handoff_status = 'agent_active';
$$;

-- Spec E: An agent is AVAILABLE iff manual_status = 'online', heartbeat within 90s,
-- activity within 15m, and active chats < max_concurrent_chats (default 4).
CREATE OR REPLACE FUNCTION public.fn_is_agent_available(
  p_agent_id UUID,
  p_workspace_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.agents a
      JOIN public.agent_status s ON s.agent_id = a.id
     WHERE a.id = p_agent_id
       AND a.workspace_id = p_workspace_id
       AND s.workspace_id = p_workspace_id
       AND a.is_active = true
       AND a.role <> 'light_agent'
       AND s.manual_status = 'online'
       AND s.last_heartbeat IS NOT NULL
       AND s.last_heartbeat >= now() - interval '90 seconds'
       AND COALESCE(s.last_activity_at, s.last_heartbeat) >= now() - interval '15 minutes'
       AND public.fn_agent_active_chats(a.id, p_workspace_id) < COALESCE(s.max_concurrent_chats, 4)
  );
$$;

-- Picks next available agent according to workspace routing_mode ('least_busy' or 'round_robin'),
-- excluding any agents in p_exclude_agent_ids and any agent already currently being rung.
CREATE OR REPLACE FUNCTION public.fn_pick_next_handoff_agent(
  p_workspace_id UUID,
  p_exclude_agent_ids UUID[] DEFAULT '{}'::uuid[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_mode TEXT;
  v_last_rr UUID;
  v_chosen UUID;
  v_candidates UUID[];
  v_idx INT;
BEGIN
  SELECT COALESCE(w.handoff_settings, '{}'::jsonb)
    INTO v_settings
    FROM public.workspaces w
   WHERE w.id = p_workspace_id;

  v_mode := COALESCE(v_settings ->> 'routing_mode', 'least_busy');

  IF v_mode = 'round_robin' THEN
    BEGIN
      v_last_rr := NULLIF(v_settings ->> 'rr_last_agent_id', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_last_rr := NULL;
    END;

    SELECT COALESCE(array_agg(a.id ORDER BY a.created_at ASC, a.id ASC), '{}'::uuid[])
      INTO v_candidates
      FROM public.agents a
     WHERE a.workspace_id = p_workspace_id
       AND public.fn_is_agent_available(a.id, p_workspace_id)
       AND NOT (a.id = ANY(COALESCE(p_exclude_agent_ids, '{}'::uuid[])));

    IF array_length(v_candidates, 1) IS NULL OR array_length(v_candidates, 1) = 0 THEN
      RETURN NULL;
    END IF;

    v_chosen := v_candidates[1];
    IF v_last_rr IS NOT NULL THEN
      FOR v_idx IN 1..array_length(v_candidates, 1) LOOP
        IF v_candidates[v_idx] = v_last_rr THEN
          IF v_idx < array_length(v_candidates, 1) THEN
            v_chosen := v_candidates[v_idx + 1];
          ELSE
            v_chosen := v_candidates[1];
          END IF;
          EXIT;
        ELSIF v_candidates[v_idx]::text > v_last_rr::text THEN
          v_chosen := v_candidates[v_idx];
          EXIT;
        END IF;
      END LOOP;
    END IF;

    UPDATE public.workspaces
       SET handoff_settings = COALESCE(handoff_settings, '{}'::jsonb)
                              || jsonb_build_object('rr_last_agent_id', v_chosen)
     WHERE id = p_workspace_id;

    RETURN v_chosen;
  END IF;

  -- Default: least_busy
  SELECT a.id
    INTO v_chosen
    FROM public.agents a
    JOIN public.agent_status s ON s.agent_id = a.id
   WHERE a.workspace_id = p_workspace_id
     AND public.fn_is_agent_available(a.id, p_workspace_id)
     AND NOT (a.id = ANY(COALESCE(p_exclude_agent_ids, '{}'::uuid[])))
   ORDER BY public.fn_agent_active_chats(a.id, p_workspace_id) ASC,
            -- Prefer agents not currently ringing on another conversation
            EXISTS (
              SELECT 1 FROM public.conversations c2
               WHERE c2.ringing_agent_id = a.id
                 AND c2.handoff_status = 'waiting_for_agent'
            ) ASC,
            s.updated_at ASC,
            a.created_at ASC
   LIMIT 1;

  RETURN v_chosen;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_pick_next_handoff_agent(UUID, UUID[])
  FROM PUBLIC, anon, authenticated;

-- Helper to invoke notify-agent Edge Function asynchronously via pg_net if configured,
-- AND emit immediate Supabase Realtime broadcasts on agent:{id} and queue:{workspace_id}
-- so live in-app ringing has zero latency even before the Edge Function finishes Web Push/Telegram!
CREATE OR REPLACE FUNCTION public.fn_dispatch_handoff_ring_signal(
  p_conversation_id UUID,
  p_event_type TEXT DEFAULT 'ring'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations%ROWTYPE;
  v_visitor_name TEXT;
  v_first_msg TEXT;
  v_timeout_sec INT;
  v_payload JSONB;
  v_supa_url TEXT;
  v_srv_key TEXT;
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
  IF NOT FOUND OR v_conv.workspace_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(btrim(v.name), ''), NULLIF(btrim(v.email), ''), 'Visitor')
    INTO v_visitor_name
    FROM public.visitors v
   WHERE v.id = v_conv.visitor_id;

  SELECT left(m.content, 240)
    INTO v_first_msg
    FROM public.messages m
   WHERE m.conversation_id = p_conversation_id
     AND m.sender_type = 'visitor'
     AND NOT COALESCE(m.is_internal, false)
   ORDER BY m.created_at DESC
   LIMIT 1;

  SELECT COALESCE((w.handoff_settings ->> 'ring_timeout_seconds')::int, 45)
    INTO v_timeout_sec
    FROM public.workspaces w
   WHERE w.id = v_conv.workspace_id;

  v_payload := jsonb_build_object(
    'event', p_event_type,
    'conversation_id', v_conv.id,
    'workspace_id', v_conv.workspace_id,
    'handoff_status', v_conv.handoff_status,
    'ringing_agent_id', v_conv.ringing_agent_id,
    'ring_started_at', v_conv.ring_started_at,
    'ring_broadcast', v_conv.ring_broadcast,
    'ring_timeout_seconds', v_timeout_sec,
    'assigned_agent_id', v_conv.assigned_agent_id,
    'customer_name', COALESCE(v_visitor_name, 'Visitor'),
    'first_message', COALESCE(v_first_msg, ''),
    'handoff_reason', v_conv.handoff_reason,
    'handoff_summary', v_conv.handoff_summary
  );

  -- 1. Direct Realtime broadcast on agent:{agent_id} and queue:{workspace_id}
  BEGIN
    IF v_conv.ringing_agent_id IS NOT NULL AND p_event_type = 'ring' THEN
      PERFORM realtime.send(v_payload, 'ring', 'agent:' || v_conv.ringing_agent_id::text, false);
    END IF;
    PERFORM realtime.send(v_payload, p_event_type, 'queue:' || v_conv.workspace_id::text, false);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 2. Invoke notify-agent Edge Function via pg_net (for Web Push + Telegram)
  IF p_event_type IN ('ring', 'broadcast', 'reopened_within_24h') AND EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'net'
  ) THEN
    BEGIN
      SELECT decrypted_secret INTO v_supa_url
        FROM vault.decrypted_secrets WHERE name = 'zentry_supabase_url' LIMIT 1;
      SELECT decrypted_secret INTO v_srv_key
        FROM vault.decrypted_secrets WHERE name = 'zentry_service_role_key' LIMIT 1;

      IF v_supa_url IS NOT NULL AND v_srv_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := rtrim(v_supa_url, '/') || '/functions/v1/notify-agent',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_srv_key
          ),
          body := v_payload
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_dispatch_handoff_ring_signal(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

-- Helper to invoke send-alert-email Edge Function / app route via pg_net
CREATE OR REPLACE FUNCTION public.fn_dispatch_handoff_email_alert(
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supa_url TEXT;
  v_srv_key TEXT;
  v_app_url TEXT;
  v_cron_secret TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    RETURN;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_supa_url
      FROM vault.decrypted_secrets WHERE name = 'zentry_supabase_url' LIMIT 1;
    SELECT decrypted_secret INTO v_srv_key
      FROM vault.decrypted_secrets WHERE name = 'zentry_service_role_key' LIMIT 1;

    IF v_supa_url IS NOT NULL AND v_srv_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := rtrim(v_supa_url, '/') || '/functions/v1/send-alert-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_srv_key
        ),
        body := p_payload
      );
      RETURN;
    END IF;

    -- Fallback directly to Next.js app endpoint using existing Vault secrets
    SELECT decrypted_secret INTO v_app_url
      FROM vault.decrypted_secrets WHERE name = 'zentry_app_url' LIMIT 1;
    SELECT decrypted_secret INTO v_cron_secret
      FROM vault.decrypted_secrets WHERE name = 'zentry_cron_secret' LIMIT 1;

    IF v_app_url IS NOT NULL AND v_cron_secret IS NOT NULL THEN
      PERFORM net.http_post(
        url := rtrim(v_app_url, '/') || '/api/notifications/handoff-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_cron_secret
        ),
        body := p_payload
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_dispatch_handoff_email_alert(JSONB)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Triggers & Existing Trigger Updates (Guards, Sync, AI Guard, Reopen)
-- ----------------------------------------------------------------------------

-- Protect AI & handoff columns from direct anon writes while allowing validated handoff RPCs
CREATE OR REPLACE FUNCTION public.fn_guard_anon_ai_mode()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'anon'
     AND pg_trigger_depth() <= 1
     AND COALESCE(current_setting('zentry.handoff_rpc', true), '') <> 'on' THEN
    NEW.ai_mode := OLD.ai_mode;
    NEW.ai_paused_reason := OLD.ai_paused_reason;
    NEW.ai_control_version := OLD.ai_control_version;
    NEW.ai_control_changed_at := OLD.ai_control_changed_at;
    NEW.ai_resumed_at := OLD.ai_resumed_at;
    NEW.ai_needs_attention_at := OLD.ai_needs_attention_at;
    NEW.handoff_status := OLD.handoff_status;
    NEW.ai_enabled := OLD.ai_enabled;
    NEW.ai_assist := OLD.ai_assist;
    NEW.assigned_agent_id := OLD.assigned_agent_id;
    NEW.ringing_agent_id := OLD.ringing_agent_id;
    NEW.ring_started_at := OLD.ring_started_at;
    NEW.ring_broadcast := OLD.ring_broadcast;
    NEW.skipped_agent_ids := OLD.skipped_agent_ids;
  END IF;
  RETURN NEW;
END;
$$;

-- Synchronize conversations.status, handoff_status, ai_enabled, and ai_mode
CREATE OR REPLACE FUNCTION public.fn_sync_handoff_and_ai_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'closed' THEN
      NEW.handoff_status := 'resolved';
    ELSIF NEW.handoff_status = 'resolved' THEN
      NEW.status := 'closed';
    END IF;

    IF NEW.handoff_status IN ('waiting_for_agent', 'agent_active', 'resolved') THEN
      NEW.ai_enabled := false;
    ELSIF NEW.handoff_status = 'offline_queued' THEN
      NEW.ai_enabled := COALESCE(NEW.ai_assist, false);
    ELSE
      NEW.ai_enabled := (COALESCE(NEW.ai_mode, 'autopilot') <> 'disabled');
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: keep status ('closed') <-> handoff_status ('resolved') in sync
  IF NEW.handoff_status = 'resolved' AND OLD.handoff_status IS DISTINCT FROM 'resolved' THEN
    NEW.status := 'closed';
    NEW.closed_at := COALESCE(NEW.closed_at, now());
    NEW.last_resolved_at := now();
    NEW.ringing_agent_id := NULL;
    NEW.ring_started_at := NULL;
    NEW.ring_broadcast := false;
    NEW.ai_assist := false;
  ELSIF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    NEW.handoff_status := 'resolved';
    NEW.ringing_agent_id := NULL;
    NEW.ring_started_at := NULL;
    NEW.ring_broadcast := false;
    NEW.ai_assist := false;
    NEW.previous_agent_id := COALESCE(OLD.assigned_agent_id, NEW.previous_agent_id);
  ELSIF OLD.status = 'closed' AND NEW.status = 'open' AND NEW.handoff_status = 'resolved' THEN
    NEW.handoff_status := 'bot_active';
    NEW.ai_assist := false;
  END IF;

  -- Keep ai_enabled <-> ai_mode consistent across handoff states
  IF NEW.handoff_status IN ('waiting_for_agent', 'agent_active') THEN
    NEW.ai_enabled := false;
    NEW.ai_mode := 'disabled';
  ELSIF NEW.handoff_status = 'resolved' THEN
    NEW.ai_enabled := false;
  ELSIF NEW.handoff_status = 'offline_queued' THEN
    NEW.ai_enabled := COALESCE(NEW.ai_assist, false);
    NEW.ai_mode := CASE WHEN COALESCE(NEW.ai_assist, false) THEN 'autopilot' ELSE 'disabled' END;
  ELSE
    -- bot_active or handoff_offered
    IF NEW.ai_mode IS DISTINCT FROM OLD.ai_mode THEN
      NEW.ai_enabled := (NEW.ai_mode <> 'disabled');
    ELSIF NEW.ai_enabled IS DISTINCT FROM OLD.ai_enabled THEN
      NEW.ai_mode := CASE WHEN NEW.ai_enabled THEN 'autopilot' ELSE 'disabled' END;
    ELSE
      NEW.ai_enabled := (COALESCE(NEW.ai_mode, 'autopilot') <> 'disabled');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ab_sync_handoff_and_ai_state ON public.conversations;
CREATE TRIGGER trg_ab_sync_handoff_and_ai_state
  BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_handoff_and_ai_state();

-- Fix A.1: AI answers first! Do not prematurely assign a human agent on conversation creation
-- when workspace AI bot is enabled; human assignment happens atomically via claim_conversation.
CREATE OR REPLACE FUNCTION public.fn_auto_assign_conversation_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_assign JSONB;
  v_ai_settings JSONB;
  v_ai_is_enabled BOOLEAN;
  v_enabled BOOLEAN;
  v_chosen_agent_id UUID;
BEGIN
  IF NEW.assigned_agent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.workspace_id IS NULL AND NEW.visitor_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.visitors WHERE id = NEW.visitor_id;
  END IF;
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT auto_assignment, ai_settings
    INTO v_auto_assign, v_ai_settings
    FROM public.workspaces
   WHERE id = NEW.workspace_id;

  -- When AI bot is enabled on the workspace (default true), AI answers first in bot_active
  -- and human agents only join when handoff is confirmed and claimed.
  v_ai_is_enabled := COALESCE((v_ai_settings ->> 'is_enabled')::boolean, true);
  IF v_ai_is_enabled AND COALESCE(NEW.handoff_status, 'bot_active') = 'bot_active' THEN
    RETURN NEW;
  END IF;

  v_enabled := COALESCE((v_auto_assign ->> 'enabled')::boolean, true);
  IF NOT v_enabled THEN
    RETURN NEW;
  END IF;

  SELECT a.id INTO v_chosen_agent_id
    FROM public.agents a
   WHERE a.workspace_id = NEW.workspace_id
     AND a.status = 'online'
     AND a.is_active
     AND a.role <> 'light_agent'
     AND (a.max_open_tickets IS NULL OR public.fn_agent_open_tickets(a.id) < a.max_open_tickets)
   ORDER BY public.fn_agent_open_tickets(a.id) ASC, a.created_at ASC
   LIMIT 1;

  IF v_chosen_agent_id IS NOT NULL THEN
    NEW.assigned_agent_id := v_chosen_agent_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Spec C AI GUARD: atomic check of ai_enabled both before and inside INSERT INTO messages
CREATE OR REPLACE FUNCTION public.fn_deliver_ai_reply(
  p_conversation_id UUID,
  p_visitor_message_id UUID,
  p_expected_version BIGINT,
  p_content TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations%ROWTYPE;
  v_visitor_at TIMESTAMPTZ;
  v_reason TEXT;
  v_message public.messages%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('delivered', false, 'reason', 'conversation_not_found');
  END IF;

  SELECT created_at INTO v_visitor_at
    FROM public.messages
   WHERE id = p_visitor_message_id
     AND conversation_id = p_conversation_id
     AND sender_type = 'visitor';
  IF NOT FOUND THEN
    v_reason := 'visitor_message_not_found';
  ELSIF coalesce(trim(p_content), '') = '' THEN
    v_reason := 'empty_reply';
  ELSIF v_conv.status = 'closed' OR v_conv.handoff_status = 'resolved' THEN
    v_reason := 'conversation_closed';
  ELSIF v_conv.handoff_status IN ('waiting_for_agent', 'agent_active') THEN
    v_reason := 'ai_' || coalesce(v_conv.ai_paused_reason, 'paused');
  ELSIF v_conv.handoff_status = 'offline_queued' AND NOT coalesce(v_conv.ai_assist, false) THEN
    v_reason := 'ai_offline_queued';
  ELSIF v_conv.ai_mode = 'disabled' OR NOT coalesce(v_conv.ai_enabled, false) THEN
    v_reason := 'ai_' || coalesce(v_conv.ai_paused_reason, 'paused');
  ELSIF p_expected_version IS NOT NULL AND v_conv.ai_control_version <> p_expected_version THEN
    v_reason := 'control_changed';
  ELSIF EXISTS (
    SELECT 1 FROM public.messages
     WHERE conversation_id = p_conversation_id
       AND sender_type = 'agent' AND sender_id IS NOT NULL AND NOT coalesce(is_internal, false)
       AND created_at >= v_visitor_at
  ) THEN
    v_reason := 'human_replied';
  ELSIF EXISTS (
    SELECT 1 FROM public.messages
     WHERE conversation_id = p_conversation_id
       AND sender_type = 'ai' AND NOT coalesce(is_internal, false)
       AND (reply_to_message_id = p_visitor_message_id
            OR metadata ->> 'answered_message_id' = p_visitor_message_id::text)
  ) THEN
    v_reason := 'already_answered';
  ELSIF EXISTS (
    SELECT 1 FROM public.messages
     WHERE conversation_id = p_conversation_id
       AND sender_type = 'visitor' AND NOT coalesce(is_internal, false)
       AND id <> p_visitor_message_id
       AND created_at > v_visitor_at
  ) THEN
    v_reason := 'superseded';
  END IF;

  IF v_reason IS NOT NULL THEN
    IF v_conv.workspace_id IS NOT NULL THEN
      INSERT INTO public.ai_reply_events (workspace_id, conversation_id, visitor_message_id, event, reason, detail)
      VALUES (v_conv.workspace_id, p_conversation_id, p_visitor_message_id, 'reply_suppressed', v_reason,
              jsonb_build_object('expected_version', p_expected_version, 'current_version', v_conv.ai_control_version));
    END IF;
    RETURN jsonb_build_object('delivered', false, 'reason', v_reason);
  END IF;

  BEGIN
    -- Spec C critical AI GUARD at the exact moment of INSERT
    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, is_internal, reply_to_message_id, metadata)
    SELECT p_conversation_id, 'ai', NULL, p_content, false, p_visitor_message_id, coalesce(p_metadata, '{}'::jsonb)
     WHERE EXISTS (
       SELECT 1 FROM public.conversations c
        WHERE c.id = p_conversation_id
          AND c.ai_enabled = true
     )
    RETURNING * INTO v_message;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('delivered', false, 'reason', 'already_answered');
  END;

  IF v_message.id IS NULL THEN
    RETURN jsonb_build_object('delivered', false, 'reason', 'ai_disabled');
  END IF;

  IF v_conv.workspace_id IS NOT NULL THEN
    INSERT INTO public.ai_reply_events (workspace_id, conversation_id, visitor_message_id, event, reason, detail)
    VALUES (v_conv.workspace_id, p_conversation_id, p_visitor_message_id, 'reply_delivered', NULL,
            jsonb_build_object('message_id', v_message.id, 'version', v_conv.ai_control_version));
  END IF;

  RETURN jsonb_build_object('delivered', true, 'message', to_jsonb(v_message));
END;
$$;

-- Human reply takes over: sets ai_enabled = false, handoff_status = 'agent_active',
-- stamps first_agent_reply_at, and triggers offline customer email if customer is away.
CREATE OR REPLACE FUNCTION public.fn_human_reply_takes_over()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations%ROWTYPE;
  v_visitor_email TEXT;
  v_visitor_online BOOLEAN;
  v_visitor_seen TIMESTAMPTZ;
  v_customer_offline BOOLEAN := false;
BEGIN
  IF NEW.sender_type = 'agent'
     AND NEW.sender_id IS NOT NULL
     AND NOT coalesce(NEW.is_internal, false)
     AND coalesce(NEW.metadata ->> 'is_welcome', '') <> 'true' THEN

    SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    UPDATE public.conversations
       SET ai_mode = 'disabled',
           ai_enabled = false,
           ai_assist = false,
           ai_paused_reason = 'human_reply',
           ai_control_version = ai_control_version + 1,
           ai_control_changed_at = now(),
           ai_needs_attention_at = NULL,
           handoff_status = CASE
             WHEN handoff_status IN ('bot_active', 'handoff_offered', 'waiting_for_agent', 'offline_queued')
               THEN 'agent_active'
             ELSE handoff_status
           END,
           assigned_agent_id = COALESCE(assigned_agent_id, NEW.sender_id),
           ringing_agent_id = NULL,
           ring_started_at = NULL,
           ring_broadcast = false,
           first_agent_reply_at = CASE
             WHEN handoff_requested_at IS NOT NULL AND first_agent_reply_at IS NULL
               THEN COALESCE(NEW.created_at, now())
             ELSE first_agent_reply_at
           END,
           channel_metadata = coalesce(channel_metadata, '{}'::jsonb)
             || jsonb_build_object('last_human_reply_at', to_jsonb(coalesce(NEW.created_at, now())))
     WHERE id = NEW.conversation_id;

    IF v_conv.first_agent_reply_at IS NULL AND v_conv.handoff_requested_at IS NOT NULL THEN
      PERFORM public.fn_log_conversation_event(
        NEW.conversation_id,
        v_conv.workspace_id,
        'first_agent_reply',
        'agent',
        NEW.sender_id,
        jsonb_build_object(
          'message_id', NEW.id,
          'response_seconds', EXTRACT(epoch FROM (COALESCE(NEW.created_at, now()) - v_conv.handoff_requested_at))::int
        )
      );
    END IF;

    -- Spec D: If the customer is offline (widget closed), email agent reply to customer when email exists
    IF v_conv.channel = 'web' AND v_conv.visitor_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(btrim(v_conv.customer_email), ''), NULLIF(btrim(v.email), '')),
             COALESCE(v.is_online, false),
             GREATEST(v.last_seen_at, v_conv.customer_last_seen_at)
        INTO v_visitor_email, v_visitor_online, v_visitor_seen
        FROM public.visitors v
       WHERE v.id = v_conv.visitor_id;

      v_customer_offline := (NOT COALESCE(v_visitor_online, false))
        OR (v_visitor_seen IS NULL)
        OR (v_visitor_seen < now() - interval '60 seconds');

      IF v_customer_offline AND v_visitor_email IS NOT NULL THEN
        PERFORM public.fn_dispatch_handoff_email_alert(jsonb_build_object(
          'type', 'offline_customer_reply',
          'workspace_id', v_conv.workspace_id,
          'conversation_id', v_conv.id,
          'message_id', NEW.id,
          'agent_id', NEW.sender_id,
          'customer_email', v_visitor_email,
          'reply_content', NEW.content
        ));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Reopen handling: resolved -> bot_active on customer message; if within 24h, notify previous agent
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations%ROWTYPE;
  v_prev_agent UUID;
  v_within_24h BOOLEAN := false;
BEGIN
  IF NEW.sender_type = 'agent'
     AND (NEW.is_internal IS FALSE OR NEW.is_internal IS NULL)
     AND NEW.sender_id IS NOT NULL
     AND coalesce(NEW.metadata ->> 'is_welcome', '') <> 'true' THEN
    UPDATE public.conversations
       SET updated_at = NEW.created_at,
           assigned_agent_id = COALESCE(assigned_agent_id, NEW.sender_id)
     WHERE id = NEW.conversation_id;

  ELSIF NEW.sender_type = 'visitor' THEN
    SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;

    IF FOUND AND (v_conv.handoff_status = 'resolved' OR v_conv.status = 'closed') THEN
      v_prev_agent := COALESCE(v_conv.previous_agent_id, v_conv.assigned_agent_id);
      v_within_24h := (
        COALESCE(v_conv.last_resolved_at, v_conv.closed_at) IS NOT NULL
        AND COALESCE(v_conv.last_resolved_at, v_conv.closed_at) >= now() - interval '24 hours'
      );

      UPDATE public.conversations
         SET updated_at = NEW.created_at,
             customer_last_seen_at = NEW.created_at,
             status = 'open',
             handoff_status = 'bot_active',
             ai_enabled = CASE WHEN ai_paused_reason = 'agent_paused' THEN false ELSE true END,
             ai_assist = false,
             assigned_agent_id = NULL,
             previous_agent_id = v_prev_agent,
             closed_at = NULL,
             snoozed_until = NULL
       WHERE id = NEW.conversation_id
         AND (handoff_status = 'resolved' OR status = 'closed');

      IF FOUND THEN
        PERFORM public.fn_log_conversation_event(
          NEW.conversation_id,
          v_conv.workspace_id,
          'reopened_to_bot',
          'customer',
          v_conv.visitor_id,
          jsonb_build_object('previous_agent_id', v_prev_agent, 'within_24h', v_within_24h)
        );

        IF v_within_24h AND v_prev_agent IS NOT NULL THEN
          BEGIN
            PERFORM realtime.send(
              jsonb_build_object(
                'event', 'reopened_within_24h',
                'conversation_id', NEW.conversation_id,
                'workspace_id', v_conv.workspace_id,
                'previous_agent_id', v_prev_agent,
                'message_preview', left(NEW.content, 200)
              ),
              'reopened_within_24h',
              'agent:' || v_prev_agent::text,
              false
            );
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        END IF;
      END IF;
    ELSE
      UPDATE public.conversations
         SET updated_at = NEW.created_at,
             customer_last_seen_at = NEW.created_at,
             status = 'open',
             closed_at = NULL,
             snoozed_until = NULL
       WHERE id = NEW.conversation_id;
    END IF;
  ELSE
    UPDATE public.conversations
       SET updated_at = NEW.created_at
     WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Server Handoff State-Machine RPCs (Spec B & G)
-- ----------------------------------------------------------------------------

-- Offer handoff: bot_active -> handoff_offered (respecting 5-message cooldown unless explicit)
CREATE OR REPLACE FUNCTION public.offer_handoff(
  p_conversation_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_summary TEXT DEFAULT NULL,
  p_explicit BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations%ROWTYPE;
  v_settings JSONB;
  v_handoff_mode TEXT;
  v_agent_count INT;
  v_customer_msg_count INT;
  v_updated public.conversations%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF NOT FOUND OR public.fn_workspace_role(v_conv.workspace_id) IS NULL THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('offered', false, 'reason', 'not_found');
  END IF;

  SELECT COALESCE(w.handoff_settings, '{}'::jsonb)
    INTO v_settings
    FROM public.workspaces w
   WHERE w.id = v_conv.workspace_id;

  v_handoff_mode := COALESCE(v_settings ->> 'handoff_mode', 'on');
  IF v_handoff_mode = 'off' THEN
    RETURN jsonb_build_object('offered', false, 'reason', 'handoff_off');
  END IF;

  SELECT count(*)::int INTO v_agent_count
    FROM public.agents a
   WHERE a.workspace_id = v_conv.workspace_id
     AND a.is_active = true
     AND a.role <> 'light_agent';

  IF v_agent_count = 0 THEN
    RETURN jsonb_build_object('offered', false, 'reason', 'no_workspace_agents');
  END IF;

  -- Already offered: update summary/reason idempotently
  IF v_conv.handoff_status = 'handoff_offered' THEN
    UPDATE public.conversations
       SET handoff_reason = COALESCE(p_reason, handoff_reason),
           handoff_summary = COALESCE(p_summary, handoff_summary),
           summary = COALESCE(summary, p_summary, handoff_summary)
     WHERE id = p_conversation_id
       AND handoff_status = 'handoff_offered';
    RETURN jsonb_build_object('offered', true, 'idempotent', true, 'handoff_mode', v_handoff_mode);
  END IF;

  IF v_conv.handoff_status <> 'bot_active' THEN
    RETURN jsonb_build_object('offered', false, 'reason', 'invalid_state', 'status', v_conv.handoff_status);
  END IF;

  SELECT count(*)::int INTO v_customer_msg_count
    FROM public.messages m
   WHERE m.conversation_id = p_conversation_id
     AND m.sender_type = 'visitor'
     AND NOT COALESCE(m.is_internal, false);

  -- Spec C cooldown: offer once; if ignored/declined, cooldown of 5 customer messages unless explicit
  IF NOT COALESCE(p_explicit, false)
     AND COALESCE(v_conv.handoff_offer_count, 0) > 0
     AND (v_customer_msg_count - COALESCE(v_conv.handoff_last_offer_msg_count, 0)) < 5 THEN
    RETURN jsonb_build_object(
      'offered', false,
      'reason', 'cooldown',
      'messages_since_last_offer', (v_customer_msg_count - COALESCE(v_conv.handoff_last_offer_msg_count, 0))
    );
  END IF;

  UPDATE public.conversations
     SET handoff_status = 'handoff_offered',
         handoff_offered_at = now(),
         handoff_offer_count = COALESCE(handoff_offer_count, 0) + 1,
         handoff_last_offer_msg_count = v_customer_msg_count,
         handoff_reason = COALESCE(p_reason, handoff_reason),
         handoff_summary = COALESCE(p_summary, handoff_summary),
         summary = COALESCE(summary, p_summary, handoff_summary),
         updated_at = now()
   WHERE id = p_conversation_id
     AND handoff_status = 'bot_active'
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('offered', false, 'reason', 'race_lost');
  END IF;

  PERFORM public.fn_log_conversation_event(
    p_conversation_id,
    v_updated.workspace_id,
    'handoff_offered',
    'ai',
    NULL,
    jsonb_build_object('reason', p_reason, 'explicit', p_explicit, 'offer_count', v_updated.handoff_offer_count)
  );

  RETURN jsonb_build_object('offered', true, 'idempotent', false, 'handoff_mode', v_handoff_mode);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.offer_handoff(UUID, TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offer_handoff(UUID, TEXT, TEXT, BOOLEAN)
  TO authenticated, service_role;

-- request_handoff(conversation_id): idempotent; checks handoff_mode, office hours, availability;
-- transitions bot_active / handoff_offered -> waiting_for_agent (and rings 1st agent) OR offline_queued.
CREATE OR REPLACE FUNCTION public.request_handoff(
  p_conversation_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_summary TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations%ROWTYPE;
  v_settings JSONB;
  v_handoff_mode TEXT;
  v_agent_count INT;
  v_in_hours BOOLEAN;
  v_next_agent UUID;
  v_next_open JSONB;
  v_offline_reason TEXT;
  v_updated public.conversations%ROWTYPE;
  v_actor_type TEXT;
  v_actor_id UUID;
BEGIN
  PERFORM set_config('zentry.handoff_rpc', 'on', true);

  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'conversation_not_found');
  END IF;

  -- Caller authorization: trusted internal widget wrapper, service_role, or workspace member
  IF COALESCE(current_setting('zentry.widget_verified', true), '') = 'on' THEN
    v_actor_type := 'customer';
    v_actor_id := v_conv.visitor_id;
  ELSIF COALESCE(auth.role(), '') = 'service_role' THEN
    v_actor_type := 'customer';
    v_actor_id := v_conv.visitor_id;
  ELSIF auth.uid() IS NOT NULL AND public.fn_workspace_role(v_conv.workspace_id) IS NOT NULL THEN
    v_actor_type := 'agent';
    v_actor_id := auth.uid();
  ELSE
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Idempotency: double-click or two tabs = only one handoff
  IF v_conv.handoff_status IN ('waiting_for_agent', 'agent_active', 'offline_queued') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'status', v_conv.handoff_status,
      'ringing_agent_id', v_conv.ringing_agent_id,
      'assigned_agent_id', v_conv.assigned_agent_id,
      'next_open', public.fn_next_office_hours_open(v_conv.workspace_id)
    );
  END IF;

  IF v_conv.handoff_status = 'resolved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'conversation_resolved', 'status', 'resolved');
  END IF;

  SELECT COALESCE(w.handoff_settings, '{}'::jsonb)
    INTO v_settings
    FROM public.workspaces w
   WHERE w.id = v_conv.workspace_id;

  v_handoff_mode := COALESCE(v_settings ->> 'handoff_mode', 'on');
  IF v_handoff_mode = 'off' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handoff_off', 'status', v_conv.handoff_status);
  END IF;

  SELECT count(*)::int INTO v_agent_count
    FROM public.agents a
   WHERE a.workspace_id = v_conv.workspace_id
     AND a.is_active = true
     AND a.role <> 'light_agent';

  IF v_agent_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_workspace_agents', 'status', v_conv.handoff_status);
  END IF;

  v_in_hours := public.fn_is_within_office_hours(v_conv.workspace_id);
  IF v_handoff_mode <> 'email_only' AND v_in_hours THEN
    v_next_agent := public.fn_pick_next_handoff_agent(v_conv.workspace_id, '{}'::uuid[]);
  ELSE
    v_next_agent := NULL;
  END IF;

  IF v_handoff_mode = 'email_only' OR NOT v_in_hours OR v_next_agent IS NULL THEN
    v_offline_reason := CASE
      WHEN v_handoff_mode = 'email_only' THEN 'email_only'
      WHEN NOT v_in_hours THEN 'outside_office_hours'
      ELSE 'no_agents_available'
    END;
    v_next_open := public.fn_next_office_hours_open(v_conv.workspace_id);

    UPDATE public.conversations
       SET handoff_status = 'offline_queued',
           status = 'open',
           ai_enabled = false,
           ai_assist = false,
           ai_mode = 'disabled',
           ai_paused_reason = 'human_requested',
           ringing_agent_id = NULL,
           ring_started_at = NULL,
           ring_broadcast = false,
           skipped_agent_ids = '{}'::uuid[],
           handoff_requested_at = COALESCE(handoff_requested_at, now()),
           handoff_reason = COALESCE(p_reason, handoff_reason, 'explicit'),
           handoff_summary = COALESCE(p_summary, handoff_summary),
           summary = COALESCE(summary, p_summary, handoff_summary),
           updated_at = now()
     WHERE id = p_conversation_id
       AND handoff_status IN ('bot_active', 'handoff_offered')
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'state_changed');
    END IF;

    PERFORM public.fn_log_conversation_event(
      p_conversation_id,
      v_updated.workspace_id,
      'offline_queued',
      v_actor_type,
      v_actor_id,
      jsonb_build_object(
        'from_status', v_conv.handoff_status,
        'offline_reason', v_offline_reason,
        'handoff_reason', v_updated.handoff_reason,
        'next_open', v_next_open
      )
    );

    PERFORM public.fn_dispatch_handoff_ring_signal(p_conversation_id, 'offline_queued');

    -- Notify agents with missed-chat email enabled when a handoff goes directly to offline queue
    PERFORM public.fn_dispatch_handoff_email_alert(jsonb_build_object(
      'type', 'missed_chat',
      'workspace_id', v_updated.workspace_id,
      'conversation_id', v_updated.id,
      'offline_reason', v_offline_reason,
      'handoff_reason', v_updated.handoff_reason,
      'handoff_summary', v_updated.handoff_summary
    ));

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', false,
      'status', 'offline_queued',
      'offline_reason', v_offline_reason,
      'next_open', v_next_open
    );
  END IF;

  -- Inside office hours + at least one available agent -> waiting_for_agent & ring 1st agent
  UPDATE public.conversations
     SET handoff_status = 'waiting_for_agent',
         status = 'open',
         ai_enabled = false,
         ai_assist = false,
         ai_mode = 'disabled',
         ai_paused_reason = 'human_requested',
         ringing_agent_id = v_next_agent,
         ring_started_at = now(),
         ring_broadcast = false,
         skipped_agent_ids = '{}'::uuid[],
         handoff_requested_at = COALESCE(handoff_requested_at, now()),
         handoff_reason = COALESCE(p_reason, handoff_reason, 'explicit'),
         handoff_summary = COALESCE(p_summary, handoff_summary),
         summary = COALESCE(summary, p_summary, handoff_summary),
         updated_at = now()
   WHERE id = p_conversation_id
     AND handoff_status IN ('bot_active', 'handoff_offered')
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'state_changed');
  END IF;

  PERFORM public.fn_log_conversation_event(
    p_conversation_id,
    v_updated.workspace_id,
    'waiting_for_agent',
    v_actor_type,
    v_actor_id,
    jsonb_build_object('from_status', v_conv.handoff_status, 'handoff_reason', v_updated.handoff_reason)
  );

  PERFORM public.fn_log_conversation_event(
    p_conversation_id,
    v_updated.workspace_id,
    'ring_started',
    'system',
    v_next_agent,
    jsonb_build_object('ringing_agent_id', v_next_agent)
  );

  PERFORM public.fn_dispatch_handoff_ring_signal(p_conversation_id, 'ring');

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'status', 'waiting_for_agent',
    'ringing_agent_id', v_next_agent
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_handoff(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_handoff(UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- claim_conversation(conversation_id): atomic claim (waiting_for_agent / offline_queued -> agent_active)
CREATE OR REPLACE FUNCTION public.claim_conversation(
  p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID := auth.uid();
  v_conv public.conversations%ROWTYPE;
  v_role TEXT;
  v_agent_name TEXT;
  v_agent_avatar TEXT;
  v_updated public.conversations%ROWTYPE;
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('zentry.handoff_rpc', 'on', true);

  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_role := public.fn_workspace_role(v_conv.workspace_id);
  IF v_role IS NULL OR v_role = 'light_agent' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Atomic claim with strict WHERE clause on assigned_agent_id IS NULL and handoff_status
  UPDATE public.conversations
     SET assigned_agent_id = v_agent_id,
         handoff_status = 'agent_active',
         status = 'open',
         ai_enabled = false,
         ai_assist = false,
         ai_mode = 'disabled',
         ai_paused_reason = 'human_reply',
         ringing_agent_id = NULL,
         ring_started_at = NULL,
         ring_broadcast = false,
         updated_at = now()
   WHERE id = p_conversation_id
     AND assigned_agent_id IS NULL
     AND handoff_status IN ('waiting_for_agent', 'offline_queued')
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF v_conv.assigned_agent_id = v_agent_id AND v_conv.handoff_status = 'agent_active' THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'status', 'agent_active',
        'assigned_agent_id', v_agent_id
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'already_claimed',
      'message', 'Another agent already took this chat',
      'assigned_agent_id', v_conv.assigned_agent_id,
      'status', v_conv.handoff_status
    );
  END IF;

  SELECT COALESCE(NULLIF(btrim(a.name), ''), 'Support agent'), a.avatar_url
    INTO v_agent_name, v_agent_avatar
    FROM public.agents a
   WHERE a.id = v_agent_id;

  -- Spec D: System message "<Name> joined the conversation"
  INSERT INTO public.messages (
    conversation_id, sender_type, sender_id, content, is_internal, metadata
  )
  VALUES (
    p_conversation_id,
    'system',
    NULL,
    COALESCE(v_agent_name, 'Support agent') || ' joined the conversation',
    false,
    jsonb_strip_nulls(jsonb_build_object(
      'system_event', 'agent_joined',
      'assigned_agent_id', v_agent_id,
      'assigned_agent_name', COALESCE(v_agent_name, 'Support agent'),
      'assigned_agent_avatar', v_agent_avatar
    ))
  );

  PERFORM public.fn_log_conversation_event(
    p_conversation_id,
    v_updated.workspace_id,
    'claimed',
    'agent',
    v_agent_id,
    jsonb_build_object('from_status', v_conv.handoff_status, 'agent_name', v_agent_name)
  );

  -- Broadcast "claimed" on queue:{workspace_id} so other agents' popups close immediately
  PERFORM public.fn_dispatch_handoff_ring_signal(p_conversation_id, 'claimed');

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'status', 'agent_active',
    'assigned_agent_id', v_agent_id,
    'assigned_agent_name', COALESCE(v_agent_name, 'Support agent')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_conversation(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_conversation(UUID)
  TO authenticated, service_role;

-- skip_conversation(conversation_id): adds agent to skipped_agent_ids, rings next agent or broadcasts
CREATE OR REPLACE FUNCTION public.skip_conversation(
  p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID := auth.uid();
  v_conv public.conversations%ROWTYPE;
  v_role TEXT;
  v_settings JSONB;
  v_broadcast_enabled BOOLEAN;
  v_new_skipped UUID[];
  v_next_agent UUID;
  v_avail_any INT;
  v_updated public.conversations%ROWTYPE;
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('zentry.handoff_rpc', 'on', true);

  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_role := public.fn_workspace_role(v_conv.workspace_id);
  IF v_role IS NULL OR v_role = 'light_agent' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_conv.handoff_status <> 'waiting_for_agent' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_waiting', 'status', v_conv.handoff_status);
  END IF;

  v_new_skipped := ARRAY(
    SELECT DISTINCT x FROM unnest(COALESCE(v_conv.skipped_agent_ids, '{}'::uuid[]) || v_agent_id) AS x
  );

  PERFORM public.fn_log_conversation_event(
    p_conversation_id,
    v_conv.workspace_id,
    'skipped',
    'agent',
    v_agent_id,
    jsonb_build_object('skipped_count', COALESCE(array_length(v_new_skipped, 1), 0))
  );

  -- If already in broadcast mode, just record skip for this agent without stopping broadcast for others
  IF v_conv.ring_broadcast THEN
    UPDATE public.conversations
       SET skipped_agent_ids = v_new_skipped,
           updated_at = now()
     WHERE id = p_conversation_id
       AND handoff_status = 'waiting_for_agent';
    RETURN jsonb_build_object('ok', true, 'status', 'waiting_for_agent', 'broadcast', true);
  END IF;

  -- Pick next available agent not in v_new_skipped
  v_next_agent := public.fn_pick_next_handoff_agent(v_conv.workspace_id, v_new_skipped);

  IF v_next_agent IS NOT NULL THEN
    UPDATE public.conversations
       SET skipped_agent_ids = v_new_skipped,
           ringing_agent_id = v_next_agent,
           ring_started_at = now(),
           ring_broadcast = false,
           updated_at = now()
     WHERE id = p_conversation_id
       AND handoff_status = 'waiting_for_agent'
    RETURNING * INTO v_updated;

    PERFORM public.fn_log_conversation_event(
      p_conversation_id,
      v_conv.workspace_id,
      'ring_started',
      'system',
      v_next_agent,
      jsonb_build_object('ringing_agent_id', v_next_agent, 'after_skip_by', v_agent_id)
    );

    PERFORM public.fn_dispatch_handoff_ring_signal(p_conversation_id, 'ring');

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'waiting_for_agent',
      'ringing_agent_id', v_next_agent,
      'broadcast', false
    );
  END IF;

  -- Every available agent rung once -> broadcast if enabled (and if any other agent exists/is online)
  SELECT COALESCE(w.handoff_settings, '{}'::jsonb)
    INTO v_settings
    FROM public.workspaces w
   WHERE w.id = v_conv.workspace_id;

  v_broadcast_enabled := COALESCE((v_settings ->> 'broadcast_enabled')::boolean, true);

  SELECT count(*)::int INTO v_avail_any
    FROM public.agents a
   WHERE a.workspace_id = v_conv.workspace_id
     AND public.fn_is_agent_available(a.id, v_conv.workspace_id)
     AND NOT (a.id = ANY(v_new_skipped));

  IF v_broadcast_enabled THEN
    UPDATE public.conversations
       SET skipped_agent_ids = v_new_skipped,
           ringing_agent_id = NULL,
           ring_started_at = now(),
           ring_broadcast = true,
           updated_at = now()
     WHERE id = p_conversation_id
       AND handoff_status = 'waiting_for_agent'
    RETURNING * INTO v_updated;

    PERFORM public.fn_log_conversation_event(
      p_conversation_id,
      v_conv.workspace_id,
      'broadcast_started',
      'system',
      NULL,
      jsonb_build_object('skipped_agent_ids', v_new_skipped)
    );

    PERFORM public.fn_dispatch_handoff_ring_signal(p_conversation_id, 'broadcast');

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'waiting_for_agent',
      'ringing_agent_id', NULL,
      'broadcast', true
    );
  END IF;

  -- Broadcast disabled and no un-skipped available agents left -> keep waiting until queue timeout or move offline
  UPDATE public.conversations
     SET skipped_agent_ids = v_new_skipped,
         ringing_agent_id = NULL,
         ring_started_at = NULL,
         ring_broadcast = false,
         updated_at = now()
   WHERE id = p_conversation_id
     AND handoff_status = 'waiting_for_agent';

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'waiting_for_agent',
    'ringing_agent_id', NULL,
    'broadcast', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.skip_conversation(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.skip_conversation(UUID)
  TO authenticated, service_role;

-- return_to_ai(conversation_id): only the assigned agent; sets bot_active, ai_enabled = true, clears assignment
CREATE OR REPLACE FUNCTION public.return_to_ai(
  p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID := auth.uid();
  v_conv public.conversations%ROWTYPE;
  v_agent_name TEXT;
  v_updated public.conversations%ROWTYPE;
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('zentry.handoff_rpc', 'on', true);

  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_conv.assigned_agent_id IS DISTINCT FROM v_agent_id THEN
    RAISE EXCEPTION 'Only the assigned agent can return this conversation to AI' USING ERRCODE = '42501';
  END IF;

  UPDATE public.conversations
     SET handoff_status = 'bot_active',
         ai_enabled = true,
         ai_assist = false,
         ai_mode = 'autopilot',
         ai_paused_reason = NULL,
         previous_agent_id = v_conv.assigned_agent_id,
         assigned_agent_id = NULL,
         ringing_agent_id = NULL,
         ring_started_at = NULL,
         ring_broadcast = false,
         skipped_agent_ids = '{}'::uuid[],
         first_agent_reply_at = NULL,
         updated_at = now()
   WHERE id = p_conversation_id
     AND handoff_status = 'agent_active'
     AND assigned_agent_id = v_agent_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_state', 'status', v_conv.handoff_status);
  END IF;

  SELECT COALESCE(NULLIF(btrim(a.name), ''), 'Support agent')
    INTO v_agent_name
    FROM public.agents a
   WHERE a.id = v_agent_id;

  -- Spec D: System message when agent returns to AI
  INSERT INTO public.messages (
    conversation_id, sender_type, sender_id, content, is_internal, metadata
  )
  VALUES (
    p_conversation_id,
    'system',
    NULL,
    COALESCE(v_agent_name, 'Support agent') || ' returned the conversation to the AI assistant',
    false,
    jsonb_build_object(
      'system_event', 'returned_to_ai',
      'agent_id', v_agent_id,
      'agent_name', COALESCE(v_agent_name, 'Support agent')
    )
  );

  PERFORM public.fn_log_conversation_event(
    p_conversation_id,
    v_updated.workspace_id,
    'returned_to_ai',
    'agent',
    v_agent_id,
    jsonb_build_object('agent_name', v_agent_name)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'bot_active');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.return_to_ai(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_to_ai(UUID)
  TO authenticated, service_role;

-- mark_resolved(conversation_id): customer or agent closes conversation -> resolved
CREATE OR REPLACE FUNCTION public.mark_resolved(
  p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations%ROWTYPE;
  v_actor_type TEXT;
  v_actor_id UUID;
  v_role TEXT;
  v_updated public.conversations%ROWTYPE;
BEGIN
  PERFORM set_config('zentry.handoff_rpc', 'on', true);

  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF COALESCE(current_setting('zentry.widget_verified', true), '') = 'on' THEN
    v_actor_type := 'customer';
    v_actor_id := v_conv.visitor_id;
  ELSIF COALESCE(auth.role(), '') = 'service_role' THEN
    v_actor_type := 'system';
    v_actor_id := NULL;
  ELSIF auth.uid() IS NOT NULL THEN
    v_role := public.fn_workspace_role(v_conv.workspace_id);
    IF v_role IS NULL OR v_role = 'light_agent' THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    v_actor_type := 'agent';
    v_actor_id := auth.uid();
  ELSE
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_conv.handoff_status = 'resolved' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', 'resolved');
  END IF;

  UPDATE public.conversations
     SET handoff_status = 'resolved',
         status = 'closed',
         closed_at = COALESCE(closed_at, now()),
         last_resolved_at = now(),
         previous_agent_id = COALESCE(assigned_agent_id, previous_agent_id),
         ai_enabled = false,
         ai_assist = false,
         ringing_agent_id = NULL,
         ring_started_at = NULL,
         ring_broadcast = false,
         updated_at = now()
   WHERE id = p_conversation_id
     AND handoff_status <> 'resolved'
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', 'resolved');
  END IF;

  PERFORM public.fn_log_conversation_event(
    p_conversation_id,
    v_updated.workspace_id,
    'resolved',
    v_actor_type,
    v_actor_id,
    jsonb_build_object('from_status', v_conv.handoff_status)
  );

  PERFORM public.fn_dispatch_handoff_ring_signal(p_conversation_id, 'resolved');

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'status', 'resolved');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_resolved(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_resolved(UUID)
  TO authenticated, service_role;

-- set_agent_status(status) & agent_heartbeat(): update agent availability
CREATE OR REPLACE FUNCTION public.set_agent_status(
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID := auth.uid();
  v_ws UUID;
  v_prev_status TEXT;
  v_queue_count INT := 0;
  v_email_summary BOOLEAN := true;
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('online', 'away') THEN
    RAISE EXCEPTION 'Invalid status: must be online or away' USING ERRCODE = '22023';
  END IF;

  SELECT a.workspace_id INTO v_ws
    FROM public.agents a
   WHERE a.id = v_agent_id AND a.is_active = true;

  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Active agent record not found' USING ERRCODE = '42501';
  END IF;

  SELECT s.manual_status INTO v_prev_status
    FROM public.agent_status s
   WHERE s.agent_id = v_agent_id;

  INSERT INTO public.agent_status (
    agent_id, workspace_id, manual_status, last_heartbeat, last_activity_at, updated_at
  )
  VALUES (
    v_agent_id, v_ws, p_status, now(), now(), now()
  )
  ON CONFLICT (agent_id) DO UPDATE
    SET workspace_id = EXCLUDED.workspace_id,
        manual_status = EXCLUDED.manual_status,
        last_heartbeat = CASE WHEN EXCLUDED.manual_status = 'online' THEN now() ELSE public.agent_status.last_heartbeat END,
        last_activity_at = CASE WHEN EXCLUDED.manual_status = 'online' THEN now() ELSE public.agent_status.last_activity_at END,
        updated_at = now();

  UPDATE public.agents
     SET status = p_status
   WHERE id = v_agent_id;

  IF p_status = 'online' THEN
    SELECT count(*)::int INTO v_queue_count
      FROM public.conversations c
     WHERE c.workspace_id = v_ws
       AND c.handoff_status IN ('waiting_for_agent', 'offline_queued')
       AND c.assigned_agent_id IS NULL;

    IF v_queue_count > 0 AND COALESCE(v_prev_status, 'away') <> 'online' THEN
      SELECT COALESCE(p.email_queue_summary, true)
        INTO v_email_summary
        FROM public.agent_notification_preferences p
       WHERE p.agent_id = v_agent_id AND p.workspace_id = v_ws;

      IF COALESCE(v_email_summary, true) THEN
        PERFORM public.fn_dispatch_handoff_email_alert(jsonb_build_object(
          'type', 'queue_summary',
          'workspace_id', v_ws,
          'agent_id', v_agent_id,
          'queue_count', v_queue_count
        ));
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'manual_status', p_status,
    'workspace_id', v_ws,
    'waiting_queue_count', v_queue_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_agent_status(TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_agent_status(TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.agent_heartbeat(
  p_active_input BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID := auth.uid();
  v_ws UUID;
  v_row public.agent_status%ROWTYPE;
  v_auto_away BOOLEAN := false;
BEGIN
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT a.workspace_id INTO v_ws
    FROM public.agents a
   WHERE a.id = v_agent_id AND a.is_active = true;

  IF v_ws IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'agent_not_found');
  END IF;

  INSERT INTO public.agent_status (
    agent_id, workspace_id, manual_status, last_heartbeat, last_activity_at, updated_at
  )
  VALUES (
    v_agent_id, v_ws, 'away', now(), now(), now()
  )
  ON CONFLICT (agent_id) DO UPDATE
    SET workspace_id = EXCLUDED.workspace_id,
        last_heartbeat = now(),
        last_activity_at = CASE
          WHEN p_active_input THEN now()
          ELSE COALESCE(public.agent_status.last_activity_at, now())
        END,
        updated_at = now()
  RETURNING * INTO v_row;

  -- Spec E: Auto-Away after 15 min with no mouse/keyboard activity on dashboard
  IF v_row.manual_status = 'online'
     AND NOT p_active_input
     AND v_row.last_activity_at IS NOT NULL
     AND v_row.last_activity_at < now() - interval '15 minutes' THEN
    UPDATE public.agent_status
       SET manual_status = 'away',
           updated_at = now()
     WHERE agent_id = v_agent_id;

    UPDATE public.agents
       SET status = 'away'
     WHERE id = v_agent_id;

    v_auto_away := true;
    v_row.manual_status := 'away';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'manual_status', v_row.manual_status,
    'auto_away', v_auto_away,
    'last_heartbeat', v_row.last_heartbeat,
    'last_activity_at', v_row.last_activity_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.agent_heartbeat(BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_heartbeat(BOOLEAN)
  TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. requeue_stale(): pg_cron backup & timeout state machine (every minute)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.requeue_stale()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_next_agent UUID;
  v_new_skipped UUID[];
  v_broadcast_enabled BOOLEAN;
  v_auto_away_count INT := 0;
  v_ring_timeouts INT := 0;
  v_queue_timeouts INT := 0;
  v_requeued_agents INT := 0;
  v_auto_resolved INT := 0;
BEGIN
  PERFORM set_config('zentry.handoff_rpc', 'on', true);

  -- 1) Auto-Away: agents online with >15m no mouse/keyboard activity
  FOR r IN
    UPDATE public.agent_status s
       SET manual_status = 'away',
           updated_at = now()
     WHERE s.manual_status = 'online'
       AND COALESCE(s.last_activity_at, s.last_heartbeat, s.updated_at) < now() - interval '15 minutes'
    RETURNING s.agent_id, s.workspace_id
  LOOP
    UPDATE public.agents SET status = 'away' WHERE id = r.agent_id;
    v_auto_away_count := v_auto_away_count + 1;
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object('event', 'auto_away', 'agent_id', r.agent_id, 'reason', 'inactivity_15m'),
        'auto_away',
        'agent:' || r.agent_id::text,
        false
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- 2) Queue timeout (default 5 min / 300s): waiting_for_agent -> offline_queued + unanswered alert email
  FOR r IN
    SELECT c.id,
           c.workspace_id,
           c.handoff_reason,
           c.handoff_summary,
           COALESCE((w.handoff_settings ->> 'queue_timeout_seconds')::int, 300) AS queue_timeout_sec,
           COALESCE(w.handoff_settings ->> 'unanswered_alert_to', 'owner') AS alert_to
      FROM public.conversations c
      JOIN public.workspaces w ON w.id = c.workspace_id
     WHERE c.handoff_status = 'waiting_for_agent'
       AND COALESCE(c.handoff_requested_at, c.updated_at)
             <= now() - make_interval(secs => COALESCE((w.handoff_settings ->> 'queue_timeout_seconds')::int, 300))
  LOOP
    UPDATE public.conversations
       SET handoff_status = 'offline_queued',
           ai_enabled = false,
           ai_assist = false,
           ringing_agent_id = NULL,
           ring_started_at = NULL,
           ring_broadcast = false,
           unanswered_alert_sent_at = COALESCE(unanswered_alert_sent_at, now()),
           updated_at = now()
     WHERE id = r.id
       AND handoff_status = 'waiting_for_agent';

    IF FOUND THEN
      v_queue_timeouts := v_queue_timeouts + 1;
      PERFORM public.fn_log_conversation_event(
        r.id,
        r.workspace_id,
        'queue_timeout',
        'system',
        NULL,
        jsonb_build_object('queue_timeout_seconds', r.queue_timeout_sec)
      );
      PERFORM public.fn_dispatch_handoff_ring_signal(r.id, 'offline_queued');
      PERFORM public.fn_dispatch_handoff_email_alert(jsonb_build_object(
        'type', 'unanswered_alert',
        'workspace_id', r.workspace_id,
        'conversation_id', r.id,
        'alert_to', r.alert_to,
        'handoff_reason', r.handoff_reason,
        'handoff_summary', r.handoff_summary
      ));
      PERFORM public.fn_dispatch_handoff_email_alert(jsonb_build_object(
        'type', 'missed_chat',
        'workspace_id', r.workspace_id,
        'conversation_id', r.id,
        'offline_reason', 'queue_timeout',
        'handoff_reason', r.handoff_reason,
        'handoff_summary', r.handoff_summary
      ));
    END IF;
  END LOOP;

  -- 3) Ring timeout (default 45s): move to next available agent or broadcast
  FOR r IN
    SELECT c.id,
           c.workspace_id,
           c.ringing_agent_id,
           c.skipped_agent_ids,
           COALESCE((w.handoff_settings ->> 'ring_timeout_seconds')::int, 45) AS ring_timeout_sec,
           COALESCE((w.handoff_settings ->> 'broadcast_enabled')::boolean, true) AS broadcast_enabled
      FROM public.conversations c
      JOIN public.workspaces w ON w.id = c.workspace_id
     WHERE c.handoff_status = 'waiting_for_agent'
       AND c.ringing_agent_id IS NOT NULL
       AND NOT c.ring_broadcast
       AND c.ring_started_at <= now() - make_interval(secs => COALESCE((w.handoff_settings ->> 'ring_timeout_seconds')::int, 45))
  LOOP
    v_new_skipped := ARRAY(
      SELECT DISTINCT x FROM unnest(COALESCE(r.skipped_agent_ids, '{}'::uuid[]) || r.ringing_agent_id) AS x
    );
    v_next_agent := public.fn_pick_next_handoff_agent(r.workspace_id, v_new_skipped);

    IF v_next_agent IS NOT NULL THEN
      UPDATE public.conversations
         SET skipped_agent_ids = v_new_skipped,
             ringing_agent_id = v_next_agent,
             ring_started_at = now(),
             ring_broadcast = false,
             updated_at = now()
       WHERE id = r.id
         AND handoff_status = 'waiting_for_agent'
         AND ringing_agent_id = r.ringing_agent_id;

      IF FOUND THEN
        v_ring_timeouts := v_ring_timeouts + 1;
        PERFORM public.fn_log_conversation_event(
          r.id, r.workspace_id, 'ring_timeout', 'system', r.ringing_agent_id,
          jsonb_build_object('next_agent_id', v_next_agent)
        );
        PERFORM public.fn_dispatch_handoff_ring_signal(r.id, 'ring');
      END IF;
    ELSIF r.broadcast_enabled THEN
      UPDATE public.conversations
         SET skipped_agent_ids = v_new_skipped,
             ringing_agent_id = NULL,
             ring_started_at = now(),
             ring_broadcast = true,
             updated_at = now()
       WHERE id = r.id
         AND handoff_status = 'waiting_for_agent'
         AND ringing_agent_id = r.ringing_agent_id;

      IF FOUND THEN
        v_ring_timeouts := v_ring_timeouts + 1;
        PERFORM public.fn_log_conversation_event(
          r.id, r.workspace_id, 'broadcast_started', 'system', r.ringing_agent_id,
          jsonb_build_object('reason', 'ring_timeout_all_rung')
        );
        PERFORM public.fn_dispatch_handoff_ring_signal(r.id, 'broadcast');
      END IF;
    ELSE
      UPDATE public.conversations
         SET skipped_agent_ids = v_new_skipped,
             ringing_agent_id = NULL,
             ring_started_at = NULL,
             updated_at = now()
       WHERE id = r.id
         AND handoff_status = 'waiting_for_agent'
         AND ringing_agent_id = r.ringing_agent_id;
      IF FOUND THEN
        v_ring_timeouts := v_ring_timeouts + 1;
      END IF;
    END IF;
  END LOOP;

  -- 4) Disappeared agent (>90s stale heartbeat while customer waits) OR no first reply within 3 min (180s) of accepting:
  --    agent_active -> waiting_for_agent (or offline_queued if nobody available)
  FOR r IN
    SELECT c.id,
           c.workspace_id,
           c.assigned_agent_id,
           c.skipped_agent_ids,
           c.first_agent_reply_at,
           c.updated_at,
           s.last_heartbeat,
           COALESCE((w.handoff_settings ->> 'first_reply_timeout_seconds')::int, 180) AS first_reply_sec
      FROM public.conversations c
      JOIN public.workspaces w ON w.id = c.workspace_id
      LEFT JOIN public.agent_status s ON s.agent_id = c.assigned_agent_id
     WHERE c.handoff_status = 'agent_active'
       AND c.assigned_agent_id IS NOT NULL
       AND (
         -- No first reply within first_reply_timeout_seconds (default 180s) of accepting
         (c.first_agent_reply_at IS NULL
          AND c.updated_at <= now() - make_interval(secs => COALESCE((w.handoff_settings ->> 'first_reply_timeout_seconds')::int, 180)))
         OR
         -- Agent disappeared (offline > 90s while customer last sent the latest public message and is waiting)
         ((s.last_heartbeat IS NULL OR s.last_heartbeat < now() - interval '90 seconds')
          AND EXISTS (
            SELECT 1 FROM public.messages m
             WHERE m.conversation_id = c.id
               AND NOT COALESCE(m.is_internal, false)
               AND m.sender_type = 'visitor'
               AND m.created_at = (
                 SELECT max(m2.created_at) FROM public.messages m2
                  WHERE m2.conversation_id = c.id
                    AND NOT COALESCE(m2.is_internal, false)
                    AND m2.sender_type IN ('visitor', 'agent')
               )
          ))
       )
  LOOP
    v_new_skipped := ARRAY(
      SELECT DISTINCT x FROM unnest(COALESCE(r.skipped_agent_ids, '{}'::uuid[]) || r.assigned_agent_id) AS x
    );

    IF public.fn_is_within_office_hours(r.workspace_id) THEN
      v_next_agent := public.fn_pick_next_handoff_agent(r.workspace_id, v_new_skipped);
    ELSE
      v_next_agent := NULL;
    END IF;

    IF v_next_agent IS NOT NULL THEN
      UPDATE public.conversations
         SET handoff_status = 'waiting_for_agent',
             assigned_agent_id = NULL,
             skipped_agent_ids = v_new_skipped,
             ringing_agent_id = v_next_agent,
             ring_started_at = now(),
             ring_broadcast = false,
             handoff_requested_at = now(),
             updated_at = now()
       WHERE id = r.id
         AND handoff_status = 'agent_active'
         AND assigned_agent_id = r.assigned_agent_id;

      IF FOUND THEN
        v_requeued_agents := v_requeued_agents + 1;
        PERFORM public.fn_log_conversation_event(
          r.id, r.workspace_id, 'agent_timeout_requeued', 'system', r.assigned_agent_id,
          jsonb_build_object(
            'reason', CASE WHEN r.first_agent_reply_at IS NULL THEN 'first_reply_timeout' ELSE 'agent_disappeared' END,
            'next_agent_id', v_next_agent
          )
        );
        PERFORM public.fn_dispatch_handoff_ring_signal(r.id, 'ring');
      END IF;
    ELSE
      UPDATE public.conversations
         SET handoff_status = 'offline_queued',
             assigned_agent_id = NULL,
             skipped_agent_ids = v_new_skipped,
             ringing_agent_id = NULL,
             ring_started_at = NULL,
             ring_broadcast = false,
             updated_at = now()
       WHERE id = r.id
         AND handoff_status = 'agent_active'
         AND assigned_agent_id = r.assigned_agent_id;

      IF FOUND THEN
        v_requeued_agents := v_requeued_agents + 1;
        PERFORM public.fn_log_conversation_event(
          r.id, r.workspace_id, 'agent_timeout_offline_queued', 'system', r.assigned_agent_id,
          jsonb_build_object(
            'reason', CASE WHEN r.first_agent_reply_at IS NULL THEN 'first_reply_timeout' ELSE 'agent_disappeared' END
          )
        );
        PERFORM public.fn_dispatch_handoff_ring_signal(r.id, 'offline_queued');
      END IF;
    END IF;
  END LOOP;

  -- 5) 24h with no activity in offline_queued / agent_active -> resolved
  FOR r IN
    SELECT c.id, c.workspace_id, c.handoff_status, c.assigned_agent_id
      FROM public.conversations c
     WHERE c.handoff_status IN ('offline_queued', 'agent_active')
       AND c.updated_at <= now() - interval '24 hours'
  LOOP
    UPDATE public.conversations
       SET handoff_status = 'resolved',
           status = 'closed',
           closed_at = COALESCE(closed_at, now()),
           last_resolved_at = now(),
           previous_agent_id = COALESCE(assigned_agent_id, previous_agent_id),
           ai_enabled = false,
           ai_assist = false,
           ringing_agent_id = NULL,
           ring_started_at = NULL,
           ring_broadcast = false,
           updated_at = now()
     WHERE id = r.id
       AND handoff_status = r.handoff_status;

    IF FOUND THEN
      v_auto_resolved := v_auto_resolved + 1;
      PERFORM public.fn_log_conversation_event(
        r.id, r.workspace_id, 'auto_resolved_24h', 'system', NULL,
        jsonb_build_object('from_status', r.handoff_status)
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'auto_away_count', v_auto_away_count,
    'ring_timeouts', v_ring_timeouts,
    'queue_timeouts', v_queue_timeouts,
    'requeued_agents', v_requeued_agents,
    'auto_resolved', v_auto_resolved
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.requeue_stale()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_stale()
  TO service_role;

-- Schedule requeue_stale() every minute via pg_cron (idempotent)
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    FOR v_job_id IN
      SELECT jobid FROM cron.job WHERE jobname = 'zentry-handoff-requeue-stale'
    LOOP
      PERFORM cron.unschedule(v_job_id);
    END LOOP;
    PERFORM cron.schedule(
      'zentry-handoff-requeue-stale',
      '* * * * *',
      $cron$SELECT public.requeue_stale();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 9. Widget RPC Wrappers & Enriched Widget Payloads
-- ----------------------------------------------------------------------------

-- Ensure fn_widget_message_json includes agent identity AND handoff_offer metadata
CREATE OR REPLACE FUNCTION public.fn_widget_message_json(p_message public.messages)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH m AS (SELECT to_jsonb(p_message) AS j),
       a AS (
         SELECT ag.name, ag.avatar_url
           FROM public.agents ag
          WHERE p_message.sender_type = 'agent'
            AND ag.id = p_message.sender_id
          LIMIT 1
       )
  SELECT jsonb_build_object(
    'id', j -> 'id',
    'conversation_id', j -> 'conversation_id',
    'sender_type', j -> 'sender_type',
    'content', j -> 'content',
    'attachment_url', j -> 'attachment_url',
    'created_at', j -> 'created_at',
    'delivered_at', j -> 'delivered_at',
    'read_at', j -> 'read_at',
    'reply_to_message_id', j -> 'reply_to_message_id',
    'metadata', jsonb_strip_nulls(jsonb_build_object(
      'system_event', j #> '{metadata,system_event}',
      'is_edited', j #> '{metadata,is_edited}',
      'is_welcome', j #> '{metadata,is_welcome}',
      'translated_text', j #> '{metadata,translated_text}',
      'quick_replies', j #> '{metadata,quick_replies}',
      'handover', j #> '{metadata,handover}',
      'handoff_offer', j #> '{metadata,handoff_offer}',
      'ai_assist_answer', j #> '{metadata,ai_assist_answer}',
      'assigned_agent_id', j #> '{metadata,assigned_agent_id}',
      'assigned_agent_name', j #> '{metadata,assigned_agent_name}',
      'assigned_agent_avatar', j #> '{metadata,assigned_agent_avatar}',
      'sender_name', coalesce(j #> '{metadata,sender_name}', to_jsonb((SELECT name FROM a))),
      'sender_avatar', coalesce(j #> '{metadata,sender_avatar}', to_jsonb((SELECT avatar_url FROM a))),
      'translation', CASE WHEN j #> '{metadata,translation,translated_text}' IS NULL THEN NULL
                          ELSE jsonb_build_object('translated_text', j #> '{metadata,translation,translated_text}') END
    ))
  )
  FROM m
$$;

REVOKE EXECUTE ON FUNCTION public.fn_widget_message_json(public.messages)
  FROM PUBLIC, anon, authenticated;

-- Enrich fn_widget_conversation_json with handoff state, 7-day avg wait (>=10 samples),
-- next office-hours open label, assigned agent identity, and handoff availability
CREATE OR REPLACE FUNCTION public.fn_widget_conversation_json(p_conv public.conversations)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_name TEXT;
  v_agent_avatar TEXT;
  v_settings JSONB;
  v_handoff_mode TEXT := 'on';
  v_has_agents BOOLEAN := false;
  v_est_wait_min INT := NULL;
  v_sample_count INT := 0;
  v_avg_sec NUMERIC := NULL;
  v_next_open JSONB := NULL;
  v_email TEXT := NULL;
BEGIN
  IF p_conv.assigned_agent_id IS NOT NULL THEN
    SELECT a.name, a.avatar_url
      INTO v_agent_name, v_agent_avatar
      FROM public.agents a
     WHERE a.id = p_conv.assigned_agent_id;
  END IF;

  IF p_conv.workspace_id IS NOT NULL THEN
    SELECT COALESCE(w.handoff_settings, '{}'::jsonb)
      INTO v_settings
      FROM public.workspaces w
     WHERE w.id = p_conv.workspace_id;

    v_handoff_mode := COALESCE(v_settings ->> 'handoff_mode', 'on');

    SELECT EXISTS (
      SELECT 1 FROM public.agents a
       WHERE a.workspace_id = p_conv.workspace_id
         AND a.is_active = true
         AND a.role <> 'light_agent'
    ) INTO v_has_agents;

    -- Spec D: Show estimated wait ONLY with enough data (>=10 handoffs over last 7 days)
    IF p_conv.handoff_status = 'waiting_for_agent' THEN
      SELECT count(*)::int,
             avg(EXTRACT(epoch FROM (c2.first_agent_reply_at - c2.handoff_requested_at)))
        INTO v_sample_count, v_avg_sec
        FROM public.conversations c2
       WHERE c2.workspace_id = p_conv.workspace_id
         AND c2.handoff_requested_at >= now() - interval '7 days'
         AND c2.first_agent_reply_at IS NOT NULL
         AND c2.first_agent_reply_at >= c2.handoff_requested_at;

      IF v_sample_count >= 10 AND v_avg_sec IS NOT NULL THEN
        v_est_wait_min := GREATEST(1, CEIL(v_avg_sec / 60.0)::int);
      END IF;
    ELSIF p_conv.handoff_status = 'offline_queued' THEN
      v_next_open := public.fn_next_office_hours_open(p_conv.workspace_id);
    END IF;
  END IF;

  IF p_conv.visitor_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(btrim(p_conv.customer_email), ''), NULLIF(btrim(v.email), ''))
      INTO v_email
      FROM public.visitors v
     WHERE v.id = p_conv.visitor_id;
  ELSE
    v_email := NULLIF(btrim(p_conv.customer_email), '');
  END IF;

  RETURN jsonb_build_object(
    'id', p_conv.id,
    'status', p_conv.status,
    'handoff_status', p_conv.handoff_status,
    'ai_enabled', p_conv.ai_enabled,
    'ai_assist', p_conv.ai_assist,
    'handoff_reason', p_conv.handoff_reason,
    'assigned_agent_id', p_conv.assigned_agent_id,
    'assigned_agent_name', v_agent_name,
    'assigned_agent_avatar', v_agent_avatar,
    'handoff_mode', v_handoff_mode,
    'has_active_agents', v_has_agents,
    'estimated_wait_minutes', v_est_wait_min,
    'next_open_label', CASE WHEN v_next_open IS NOT NULL THEN v_next_open ->> 'label' ELSE NULL END,
    'next_open_at', CASE WHEN v_next_open IS NOT NULL THEN v_next_open -> 'open_at' ELSE NULL END,
    'customer_email', v_email,
    'csat_rating', to_jsonb(p_conv) -> 'csat_rating',
    'created_at', p_conv.created_at,
    'updated_at', p_conv.updated_at
  );
END;
$$;

-- Update fn_widget_heartbeat and fn_widget_update_visitor to mirror customer_last_seen_at & customer_email onto open conversations
CREATE OR REPLACE FUNCTION public.fn_widget_heartbeat(
  p_visitor_id UUID,
  p_token TEXT,
  p_current_url TEXT DEFAULT NULL,
  p_page_title TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_time_on_page INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_widget_auth(p_visitor_id, p_token);
  PERFORM public.fn_visitor_heartbeat(
    p_visitor_id,
    left(p_current_url, 2000),
    left(p_page_title, 300),
    left(p_referrer, 2000),
    greatest(0, least(coalesce(p_time_on_page, 0), 86400))
  );

  UPDATE public.conversations
     SET customer_last_seen_at = now()
   WHERE visitor_id = p_visitor_id
     AND status <> 'closed'
     AND (customer_last_seen_at IS NULL OR customer_last_seen_at < now() - interval '15 seconds');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_widget_update_visitor(
  p_visitor_id UUID,
  p_token TEXT,
  p_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_current_url TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.visitor_sessions;
  v_name TEXT := nullif(left(btrim(coalesce(p_name, '')), 120), '');
  v_email TEXT := nullif(left(btrim(coalesce(p_email, '')), 254), '');
  v_url TEXT := nullif(left(coalesce(p_current_url, ''), 2000), '');
  v_ua TEXT := nullif(left(coalesce(p_user_agent, ''), 500), '');
  v_location TEXT := nullif(left(btrim(coalesce(p_location, '')), 200), '');
  v_done BOOLEAN := false;
BEGIN
  v_session := public.fn_widget_auth(p_visitor_id, p_token);
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'email_invalid' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_upsert_visitor' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      EXECUTE 'SELECT 1 FROM (SELECT public.fn_upsert_visitor(p_id => $1, p_name => $2, p_email => $3, p_current_url => $4,'
              ' p_user_agent => $5, p_ip_address => NULL, p_location => $6, p_workspace_id => $7)) x'
        USING p_visitor_id, v_name, v_email, v_url, v_ua, v_location, v_session.workspace_id;
      v_done := true;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Widget] fn_upsert_visitor failed: %', SQLERRM;
    END;
  END IF;

  IF NOT v_done THEN
    UPDATE public.visitors
       SET name = coalesce(v_name, name),
           email = coalesce(v_email, email),
           current_page_url = coalesce(v_url, current_page_url),
           location = coalesce(v_location, location),
           last_seen_at = now()
     WHERE id = p_visitor_id;
  END IF;

  IF v_email IS NOT NULL THEN
    UPDATE public.conversations
       SET customer_email = v_email
     WHERE visitor_id = p_visitor_id
       AND COALESCE(customer_email, '') IS DISTINCT FROM v_email;
  END IF;
END;
$$;

-- Widget RPC: confirm handoff ([Connect to agent])
CREATE OR REPLACE FUNCTION public.fn_widget_request_handoff(
  p_visitor_id UUID,
  p_token TEXT,
  p_conversation_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations;
BEGIN
  PERFORM public.fn_widget_auth(p_visitor_id, p_token);
  v_conv := public.fn_widget_conversation(p_visitor_id, p_conversation_id);
  PERFORM set_config('zentry.widget_verified', 'on', true);
  PERFORM set_config('zentry.handoff_rpc', 'on', true);
  RETURN public.request_handoff(v_conv.id, p_reason, NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_widget_request_handoff(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_widget_request_handoff(UUID, TEXT, UUID, TEXT)
  TO anon, authenticated, service_role;

-- Widget RPC: toggle AI assist while waiting in offline_queued ([Ask AI while you wait])
CREATE OR REPLACE FUNCTION public.fn_widget_set_ai_assist(
  p_visitor_id UUID,
  p_token TEXT,
  p_conversation_id UUID,
  p_enabled BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations;
  v_updated public.conversations%ROWTYPE;
BEGIN
  PERFORM public.fn_widget_auth(p_visitor_id, p_token);
  v_conv := public.fn_widget_conversation(p_visitor_id, p_conversation_id);
  PERFORM set_config('zentry.handoff_rpc', 'on', true);

  UPDATE public.conversations
     SET ai_assist = COALESCE(p_enabled, true),
         ai_enabled = COALESCE(p_enabled, true),
         ai_mode = CASE WHEN COALESCE(p_enabled, true) THEN 'autopilot' ELSE 'disabled' END,
         updated_at = now()
   WHERE id = v_conv.id
     AND handoff_status = 'offline_queued'
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_offline_queued', 'status', v_conv.handoff_status);
  END IF;

  PERFORM public.fn_log_conversation_event(
    v_conv.id,
    v_conv.workspace_id,
    'ai_assist_toggled',
    'customer',
    p_visitor_id,
    jsonb_build_object('ai_assist', COALESCE(p_enabled, true))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_updated.handoff_status,
    'ai_assist', v_updated.ai_assist,
    'conversation', public.fn_widget_conversation_json(v_updated)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_widget_set_ai_assist(UUID, TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_widget_set_ai_assist(UUID, TEXT, UUID, BOOLEAN)
  TO anon, authenticated, service_role;

-- Widget RPC: customer clicks [My issue is solved]
CREATE OR REPLACE FUNCTION public.fn_widget_mark_resolved(
  p_visitor_id UUID,
  p_token TEXT,
  p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations;
BEGIN
  PERFORM public.fn_widget_auth(p_visitor_id, p_token);
  v_conv := public.fn_widget_conversation(p_visitor_id, p_conversation_id);
  PERFORM set_config('zentry.widget_verified', 'on', true);
  PERFORM set_config('zentry.handoff_rpc', 'on', true);
  RETURN public.mark_resolved(v_conv.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_widget_mark_resolved(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_widget_mark_resolved(UUID, TEXT, UUID)
  TO anon, authenticated, service_role;
