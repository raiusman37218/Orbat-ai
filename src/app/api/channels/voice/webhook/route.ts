import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { queryRows } from '@/lib/db';
import { redactVoicePii } from '@/lib/voice/redact';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Inbound carrier webhook for Twilio / Telnyx / SIP gateways.
 * Authenticates via per-workspace `voice_settings.webhook_secret` in header
 * `x-orbat-voice-secret`.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const workspaceId = String(url.searchParams.get('workspaceId') || body.workspaceId || '').trim();
  if (!UUID_RE.test(workspaceId)) {
    return NextResponse.json({ error: 'Valid workspaceId is required' }, { status: 400 });
  }

  const providedSecret = request.headers.get('x-orbat-voice-secret') || '';
  if (!providedSecret) {
    return NextResponse.json({ error: 'Missing webhook secret' }, { status: 401 });
  }

  const [settings] = await queryRows<{
    webhook_secret: string | null;
    pii_redaction: boolean;
    business_number: string | null;
    default_language: string;
  }>(
    `SELECT webhook_secret, pii_redaction, business_number, default_language
     FROM public.voice_settings
     WHERE workspace_id = $1
     LIMIT 1`,
    [workspaceId],
  );

  if (!settings?.webhook_secret || !safeEqualHex(providedSecret, settings.webhook_secret)) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
  }

  const event = String(body.event || 'call.started');
  const externalCallId = body.externalCallId ? String(body.externalCallId).slice(0, 128) : null;
  const callerPhone = String(body.callerPhone || body.from || '').trim().slice(0, 40);

  if (event === 'call.started') {
    if (!callerPhone) {
      return NextResponse.json({ error: 'callerPhone is required' }, { status: 400 });
    }
    const [matched] = await queryRows<{ id: string; name: string | null }>(
      'SELECT id, name FROM public.visitors WHERE workspace_id = $1 AND phone = $2 LIMIT 1',
      [workspaceId, callerPhone],
    );
    const [call] = await queryRows<{ id: string }>(
      `INSERT INTO public.voice_calls (
         workspace_id, visitor_id, external_call_id, direction, status, handler,
         caller_name, caller_phone, to_number, language, recording_consent, order_context
       ) VALUES ($1, $2, $3, $4, 'live', 'ai', $5, $6, $7, $8, $9, $10)
       ON CONFLICT (workspace_id, external_call_id) WHERE external_call_id IS NOT NULL
       DO UPDATE SET updated_at = now()
       RETURNING id`,
      [
        workspaceId,
        matched?.id ?? null,
        externalCallId,
        body.direction === 'outbound' ? 'outbound' : 'inbound',
        body.callerName ? String(body.callerName).slice(0, 120) : matched?.name ?? null,
        callerPhone,
        body.toNumber ? String(body.toNumber).slice(0, 40) : settings.business_number,
        String(body.language || settings.default_language || 'en').slice(0, 16),
        body.recordingConsent !== false,
        body.orderContext ? String(body.orderContext).slice(0, 120) : null,
      ],
    );
    return NextResponse.json({ ok: true, callId: call?.id });
  }

  // Locate existing call by callId or externalCallId scoped to workspaceId
  const callIdParam = body.callId && UUID_RE.test(String(body.callId)) ? String(body.callId) : null;
  const [targetCall] = callIdParam
    ? await queryRows<{ id: string; started_at: string }>(
        'SELECT id, started_at FROM public.voice_calls WHERE workspace_id = $1 AND id = $2 LIMIT 1',
        [workspaceId, callIdParam],
      )
    : externalCallId
      ? await queryRows<{ id: string; started_at: string }>(
          'SELECT id, started_at FROM public.voice_calls WHERE workspace_id = $1 AND external_call_id = $2 LIMIT 1',
          [workspaceId, externalCallId],
        )
      : [];

  if (!targetCall) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  if (event === 'call.transcript') {
    const rawText = String(body.transcript || '').trim();
    if (!rawText) return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
    const { text, redacted } = redactVoicePii(rawText, settings.pii_redaction);
    const speaker = ['caller', 'ai', 'agent', 'system'].includes(String(body.speaker))
      ? String(body.speaker)
      : 'caller';
    const offset = Math.max(0, Math.floor((Date.now() - new Date(targetCall.started_at).getTime()) / 1000));
    await queryRows(
      `INSERT INTO public.voice_call_turns (
         workspace_id, call_id, speaker, speaker_name, transcript, translated_text, redacted_pii, offset_seconds
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        workspaceId,
        targetCall.id,
        speaker,
        body.speakerName ? String(body.speakerName).slice(0, 80) : speaker,
        text,
        body.translatedText ? String(body.translatedText).slice(0, 1000) : null,
        redacted,
        offset,
      ],
    );
    return NextResponse.json({ ok: true, redacted });
  }

  if (event === 'call.ended') {
    const validStatus = ['ai_resolved', 'transferred', 'voicemail', 'callback_booked', 'ended', 'missed'].includes(
      String(body.status),
    )
      ? String(body.status)
      : 'ended';
    const duration = Math.max(0, Math.round(Number(body.durationSeconds) || 0));
    await queryRows(
      `UPDATE public.voice_calls
       SET status = $3,
           duration_seconds = GREATEST(duration_seconds, $4),
           recording_url = COALESCE($5, recording_url),
           ai_summary = COALESCE($6, ai_summary),
           ended_at = COALESCE(ended_at, now()),
           is_listening = false,
           updated_at = now()
       WHERE workspace_id = $1 AND id = $2`,
      [
        workspaceId,
        targetCall.id,
        validStatus,
        duration,
        body.recordingUrl ? String(body.recordingUrl).slice(0, 500) : null,
        body.aiSummary ? String(body.aiSummary).slice(0, 1000) : null,
      ],
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported event' }, { status: 400 });
}
