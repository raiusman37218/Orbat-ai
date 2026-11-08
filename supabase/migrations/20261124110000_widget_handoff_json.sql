-- ============================================================================
-- Migration: 20261124110000_widget_handoff_json.sql
-- Description: Expose handoff fields safely in fn_widget_conversation_json
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_widget_conversation_json(p_conv public.conversations)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p_conv.id,
    'status', p_conv.status,
    'csat_rating', to_jsonb(p_conv) -> 'csat_rating',
    'handoff_status', COALESCE(p_conv.handoff_status, 'bot_active'),
    'handoff_summary', p_conv.handoff_summary,
    'handoff_reason', p_conv.handoff_reason,
    'ai_assist', COALESCE(p_conv.ai_assist, false),
    'assigned_agent_id', p_conv.assigned_agent_id,
    'created_at', p_conv.created_at,
    'updated_at', p_conv.updated_at
  )
$$;

REVOKE EXECUTE ON FUNCTION public.fn_widget_conversation_json(public.conversations) FROM PUBLIC, anon, authenticated;
