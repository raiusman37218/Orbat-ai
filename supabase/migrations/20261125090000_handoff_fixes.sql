-- ============================================================================
-- Migration: 20261125090000_handoff_fixes.sql
--
-- Fixes to the AI -> human handoff (20261124090000_handoff_foundation.sql and
-- 20261124110000_widget_handoff_json.sql), found when the whole flow was
-- traced end to end:
--
--   1. 20261124110000 replaced the widget's conversation payload with a short
--      one, so the widget never got the estimated wait, the next office-hours
--      opening or the visitor's email, and it was handed the agents-only AI
--      summary. The full payload is restored, without the summary.
--   2. The widget only sees message metadata keys that fn_widget_message_json
--      copies. The bot marks an offer with `handoff_offered` / `offer_handoff`,
--      neither of which was copied, so the [Connect to agent] button never
--      appeared.
--   3. first_agent_reply_at was stamped only after a handoff request, but every
--      public agent reply moves a conversation to agent_active. requeue_stale()
--      treats "agent_active and no first reply for 3 minutes" as an agent who
--      accepted and went quiet, so an ordinary conversation an agent was
--      already answering was taken away from them three minutes later. The
--      reply is now always stamped, and existing rows are backfilled.
--   4. A second handoff kept the first one's handoff_requested_at and
--      first_agent_reply_at (both were COALESCEd), which broke the first-reply
--      timeout and the wait estimate. Entering the queue now restarts both,
--      and clears any old assignee: claim_conversation() only claims an
--      unassigned conversation, so a conversation that had been auto-assigned
--      before the bot took over could never be claimed by anyone.
--   5. The admin screen offers "broadcast" routing, which the database never
--      honoured; it now rings every available agent at once.
--   6. Ring signals went out on public Realtime channels carrying the
--      customer's name, first message and the AI summary, readable by anyone
--      who knows a workspace or agent id (both reach the browser). They now
--      carry ids only; the dashboard reads the details through RLS. The same
--      applies to the reopen alert, which carried the message text.
--   7. Holidays entered in Settings -> Business hours are stored in
--      handoff_settings.office_hours.holidays, which office-hours checks never
--      read. They now count alongside workspace_holidays.
--   8. Handoff emails went to an Edge Function that does not exist whenever
--      the Supabase URL secret was present; the app route is tried first.
--      Agent replies are no longer pushed to an email route on every insert:
--      /api/cron/unread-notifications already emails customers the replies
--      they have not read.
--   9. After any agent reply, the inbox's "AI on" switch was undone by the
--      sync trigger (agent_active forces the bot off). Switching it on now
--      hands the conversation back to the bot, like return_to_ai().
--  10. New chats were never auto-assigned while the bot is on, even in a
--      workspace that turned auto-assignment on explicitly.
--   9 and 10 were caught by the existing bot-control, routing and
--   ticket-rules database tests, which 20261124090000 broke.
--
-- Idempotent: CREATE OR REPLACE, DROP TRIGGER IF EXISTS, guarded backfills.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7. Holidays from both places
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_handoff_is_holiday(p_ws UUID, p_day DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_sla_is_holiday(p_ws, p_day)
      OR EXISTS (
        SELECT 1
          FROM public.workspaces w,
               jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(w.handoff_settings #> '{office_hours,holidays}') = 'array'
                      THEN w.handoff_settings #> '{office_hours,holidays}'
                      ELSE '[]'::jsonb END
               ) AS h(day)
         WHERE w.id = p_ws
           AND h.day = to_char(p_day, 'YYYY-MM-DD')
      );
$$;

REVOKE EXECUTE ON FUNCTION public.fn_handoff_is_holiday(UUID, DATE) FROM PUBLIC, anon, authenticated;

-- Office-hours checks with both holiday sources (bodies otherwise unchanged)
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

  IF public.fn_handoff_is_holiday(p_workspace_id, v_date) THEN
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
    IF NOT public.fn_handoff_is_holiday(p_workspace_id, v_today) THEN
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
    IF NOT public.fn_handoff_is_holiday(p_workspace_id, v_d) THEN
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


-- ----------------------------------------------------------------------------
-- 6. Ring signals: ids only on the public Realtime channels
--
-- realtime.send(..., private => false) reaches anyone subscribed to the
-- topic, and workspace and agent ids are not secrets. The dashboard turns a
-- signal into a popup by reading the conversation through RLS. The full
-- payload still goes to the notify-agent Edge Function (server to server)
-- when one is configured.
-- ----------------------------------------------------------------------------
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
  v_signal JSONB;
  v_supa_url TEXT;
  v_srv_key TEXT;
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
  IF NOT FOUND OR v_conv.workspace_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE((w.handoff_settings ->> 'ring_timeout_seconds')::int, 45)
    INTO v_timeout_sec
    FROM public.workspaces w
   WHERE w.id = v_conv.workspace_id;

  v_signal := jsonb_build_object(
    'event', p_event_type,
    'conversation_id', v_conv.id,
    'workspace_id', v_conv.workspace_id,
    'handoff_status', v_conv.handoff_status,
    'ringing_agent_id', v_conv.ringing_agent_id,
    'ring_started_at', v_conv.ring_started_at,
    'ring_broadcast', v_conv.ring_broadcast,
    'ring_timeout_seconds', v_timeout_sec,
    'assigned_agent_id', v_conv.assigned_agent_id
  );

  BEGIN
    IF v_conv.ringing_agent_id IS NOT NULL AND p_event_type = 'ring' THEN
      PERFORM realtime.send(v_signal, 'ring', 'agent:' || v_conv.ringing_agent_id::text, false);
    END IF;
    PERFORM realtime.send(v_signal, p_event_type, 'queue:' || v_conv.workspace_id::text, false);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF p_event_type IN ('ring', 'broadcast') AND EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'net'
  ) THEN
    BEGIN
      SELECT decrypted_secret INTO v_supa_url
        FROM vault.decrypted_secrets WHERE name = 'zentry_supabase_url' LIMIT 1;
      SELECT decrypted_secret INTO v_srv_key
        FROM vault.decrypted_secrets WHERE name = 'zentry_service_role_key' LIMIT 1;

      IF v_supa_url IS NOT NULL AND v_srv_key IS NOT NULL THEN
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

        PERFORM net.http_post(
          url := rtrim(v_supa_url, '/') || '/functions/v1/notify-agent',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_srv_key
          ),
          body := v_signal || jsonb_build_object(
            'customer_name', COALESCE(v_visitor_name, 'Visitor'),
            'first_message', COALESCE(v_first_msg, ''),
            'handoff_reason', v_conv.handoff_reason,
            'handoff_summary', v_conv.handoff_summary
          )
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

-- ----------------------------------------------------------------------------
-- 8. Handoff emails: the app route first (it exists; the Edge Function may not)
-- ----------------------------------------------------------------------------
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
      RETURN;
    END IF;

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
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_dispatch_handoff_email_alert(JSONB)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. A person's reply: always stamp the first reply; no email per insert
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_human_reply_takes_over()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations%ROWTYPE;
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
           first_agent_reply_at = COALESCE(first_agent_reply_at, NEW.created_at, now()),
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
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_human_reply_takes_over() FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 4 + 5. Entering the queue starts a fresh handoff
--
-- Runs after trg_ab_sync_handoff_and_ai_state (BEFORE triggers fire in name
-- order) on every writer: request_handoff(), the widget wrapper, the bot.
-- Re-queues from agent_active (requeue_stale) are not a new request and are
-- left alone.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_handoff_queue_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.handoff_status IN ('waiting_for_agent', 'offline_queued')
     AND OLD.handoff_status IN ('bot_active', 'handoff_offered', 'resolved') THEN
    NEW.handoff_requested_at := now();
    NEW.first_agent_reply_at := NULL;
    NEW.unanswered_alert_sent_at := NULL;
    IF NEW.assigned_agent_id IS NOT NULL THEN
      NEW.previous_agent_id := NEW.assigned_agent_id;
      NEW.assigned_agent_id := NULL;
    END IF;

    IF NEW.handoff_status = 'waiting_for_agent' AND EXISTS (
      SELECT 1 FROM public.workspaces w
       WHERE w.id = NEW.workspace_id
         AND w.handoff_settings ->> 'routing_mode' = 'broadcast'
    ) THEN
      NEW.ringing_agent_id := NULL;
      NEW.ring_broadcast := true;
      NEW.ring_started_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ac_handoff_queue_entry ON public.conversations;
CREATE TRIGGER trg_ac_handoff_queue_entry
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  WHEN (NEW.handoff_status IS DISTINCT FROM OLD.handoff_status)
  EXECUTE FUNCTION public.fn_handoff_queue_entry();

-- ----------------------------------------------------------------------------
-- 2. The offer flag reaches the widget
-- ----------------------------------------------------------------------------
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
      'handoff_offered', j #> '{metadata,handoff_offered}',
      'offer_handoff', j #> '{metadata,offer_handoff}',
      'ai_assist_answer', j #> '{metadata,ai_assist_answer}',
      'assigned_agent_id', j #> '{metadata,assigned_agent_id}',
      'assigned_agent_name', j #> '{metadata,assigned_agent_name}',
      'assigned_agent_avatar', j #> '{metadata,assigned_agent_avatar}',
      'agent_name', j #> '{metadata,agent_name}',
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

-- ----------------------------------------------------------------------------
-- 6. Reopen alert without the message text (body otherwise unchanged)
-- ----------------------------------------------------------------------------
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
                'previous_agent_id', v_prev_agent
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
-- 1. The widget's full conversation payload (as in 20261124090000; never the
--    agents-only handoff_summary)
-- ----------------------------------------------------------------------------
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

REVOKE EXECUTE ON FUNCTION public.fn_widget_conversation_json(public.conversations)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. A person switching the bot back on hands the conversation back to it
--
-- fn_sync_handoff_and_ai_state forced ai_mode back to 'disabled' in
-- agent_active, and every public agent reply now lands there, so the inbox's
-- "AI on" switch stopped working after the first reply
-- (bot-control.db.test.ts "turning the bot back on"). A switch-on while a
-- person has the conversation, or while it is queued for one, now means what
-- return_to_ai() means. The widget's AI-assist switch in the offline queue
-- turns ai_assist on with it and keeps the conversation queued.
-- ----------------------------------------------------------------------------
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

  IF NEW.ai_mode IS DISTINCT FROM OLD.ai_mode
     AND COALESCE(NEW.ai_mode, 'autopilot') <> 'disabled'
     AND NEW.handoff_status IS NOT DISTINCT FROM OLD.handoff_status
     AND (NEW.handoff_status IN ('agent_active', 'waiting_for_agent')
          OR (NEW.handoff_status = 'offline_queued' AND NOT COALESCE(NEW.ai_assist, false))) THEN
    NEW.handoff_status := 'bot_active';
    NEW.ringing_agent_id := NULL;
    NEW.ring_started_at := NULL;
    NEW.ring_broadcast := false;
    NEW.skipped_agent_ids := '{}'::uuid[];
    NEW.ai_assist := false;
  END IF;

  -- Keep status ('closed') <-> handoff_status ('resolved') in sync
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

-- ----------------------------------------------------------------------------
-- 10. Auto-assignment the workspace switched on still happens
--
-- 20261124090000 stopped assigning new chats whenever the bot is on, which
-- also ignored a workspace that explicitly turned "auto-assign new chats" on
-- in Settings (routing.db.test.ts, ticket-rules.db.test.ts). The bot still
-- answers first either way: an assignee does not switch it off, only a
-- person's reply does, and entering the handoff queue clears the assignee
-- (fn_handoff_queue_entry) so the chat can be claimed. Without an explicit
-- setting, a bot-first chat stays unassigned until it is claimed.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auto_assign_conversation_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_assign JSONB;
  v_ai_settings JSONB;
  v_explicit BOOLEAN;
  v_ai_on BOOLEAN;
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

  v_explicit := (v_auto_assign ->> 'enabled')::boolean;
  IF v_explicit IS FALSE THEN
    RETURN NEW;
  END IF;

  -- The app reads ai_settings.enabled; is_enabled is accepted too.
  v_ai_on := COALESCE((v_ai_settings ->> 'enabled')::boolean, (v_ai_settings ->> 'is_enabled')::boolean, true);
  IF v_explicit IS NULL AND v_ai_on AND COALESCE(NEW.handoff_status, 'bot_active') = 'bot_active' THEN
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

-- ----------------------------------------------------------------------------
-- Backfills for rows written while the bugs above were live
-- ----------------------------------------------------------------------------

-- 3. agent_active rows a person already answered, so requeue_stale() does not
--    take them away for "no first reply".
WITH answered AS (
  SELECT c.id,
         min(m.created_at) AS first_at
    FROM public.conversations c
    JOIN public.messages m ON m.conversation_id = c.id
   WHERE c.handoff_status = 'agent_active'
     AND c.first_agent_reply_at IS NULL
     AND m.sender_type = 'agent'
     AND m.sender_id IS NOT NULL
     AND NOT COALESCE(m.is_internal, false)
     AND COALESCE(m.metadata ->> 'is_welcome', '') <> 'true'
     AND m.created_at >= COALESCE(c.handoff_requested_at, '-infinity'::timestamptz)
   GROUP BY c.id
)
UPDATE public.conversations c
   SET first_agent_reply_at = a.first_at
  FROM answered a
 WHERE c.id = a.id
   AND c.first_agent_reply_at IS NULL;

-- 4. Queued conversations still carrying an assignee from before the bot took
--    over cannot be claimed; the queue means nobody has them yet.
UPDATE public.conversations
   SET previous_agent_id = assigned_agent_id,
       assigned_agent_id = NULL
 WHERE handoff_status IN ('waiting_for_agent', 'offline_queued')
   AND assigned_agent_id IS NOT NULL;
