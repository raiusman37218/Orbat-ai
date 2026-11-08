-- ============================================================================
-- Migration: 20261126090000_handoff_queue_like_intercom.sql
--
-- A visitor who pressed [Connect to agent] during office hours was put in the
-- offline queue ("our team is offline") unless some agent passed every check
-- of fn_is_agent_available at that second: marked Online in agent_status, a
-- heartbeat in the last 90 s, input in the last 15 minutes, and fewer than
-- max_concurrent_chats chats in agent_active. The last check counted every
-- open conversation the agent had ever replied to (a public reply moves a
-- conversation to agent_active), against a default of 4 that also applied to
-- agents with "no limit" in Team settings. In a busy workspace that is nearly
-- always false, so nearly every handoff was told the team was offline while
-- people were at their desks.
--
-- The rule now works the way Intercom's does:
--   * outside office hours (or handoff_mode = 'email_only'): offline queue,
--     with the next opening time, as before;
--   * inside office hours: always the team queue (waiting_for_agent). The best
--     available agent is rung first; if nobody passes the availability checks
--     the chat rings every open dashboard at once (ring_broadcast). If nobody
--     takes it within queue_timeout_seconds (default 5 minutes),
--     requeue_stale() moves it to the offline queue and emails the owner, as
--     before.
--   * capacity counts only chats that came through a handoff and were active
--     in the last 24 hours, not every conversation an agent ever answered.
--
-- Idempotent: CREATE OR REPLACE only.
-- ============================================================================

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
     AND c.handoff_status = 'agent_active'
     AND c.handoff_requested_at IS NOT NULL
     AND c.updated_at >= now() - interval '24 hours';
$$;

-- request_handoff: unchanged except where it decides between the team queue
-- and the offline queue (see above), and ring_broadcast when nobody is
-- individually available.
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

  IF v_handoff_mode = 'email_only' OR NOT v_in_hours THEN
    v_offline_reason := CASE
      WHEN v_handoff_mode = 'email_only' THEN 'email_only'
      WHEN NOT v_in_hours THEN 'outside_office_hours'
      ELSE 'outside_office_hours'
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
         ring_broadcast = (v_next_agent IS NULL),
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
