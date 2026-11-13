import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { query, queryRows } from '@/lib/db';
import {
  buildOtpAuthUri,
  generateTotpSecret,
  sealTotpSecret,
  unsealTotpSecret,
  verifyTotpCode,
} from '@/lib/auth/postgres-auth';
import { sessionUser } from '@/lib/auth/session-user';

export async function GET() {
  try {
    const user = await sessionUser();
    if (!user) {
      return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 });
    }

    const rows = await queryRows<{
      totp_enabled: boolean | null;
      totp_enrolled_at: string | Date | null;
    }>(
      `SELECT COALESCE(totp_enabled, false) AS totp_enabled, totp_enrolled_at
       FROM public.agents
       WHERE id = $1
       LIMIT 1`,
      [user.id],
    );

    const enabled = Boolean(rows[0]?.totp_enabled);
    const factors = enabled
      ? [
          {
            id: 'totp',
            status: 'verified',
            enrolledAt: rows[0]?.totp_enrolled_at
              ? new Date(rows[0].totp_enrolled_at).toISOString()
              : null,
          },
        ]
      : [];

    return NextResponse.json({ factors });
  } catch (err: any) {
    console.error('[GET /api/auth/mfa] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Could not inspect two-factor status.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await sessionUser();
    if (!user) {
      return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const action = body?.action;

    if (action === 'enroll') {
      const agents = await queryRows<{ id: string; email: string }>(
        'SELECT id, email FROM public.agents WHERE id = $1 LIMIT 1',
        [user.id],
      );
      if (agents.length === 0) {
        return NextResponse.json({ error: 'Agent profile not found.' }, { status: 404 });
      }

      const secret = generateTotpSecret();
      const otpauthUri = buildOtpAuthUri({
        secret,
        email: agents[0].email,
        issuer: 'Orbat AI',
      });
      const qrCode = await QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 });
      const sealed = sealTotpSecret(secret);

      await query(
        `UPDATE public.agents
         SET totp_secret_encrypted = $1,
             totp_enabled = false
         WHERE id = $2`,
        [sealed, user.id],
      );

      return NextResponse.json({
        id: 'totp',
        totp: {
          qr_code: qrCode,
          secret,
          uri: otpauthUri,
        },
      });
    }

    if (action === 'verify') {
      const code = typeof body?.code === 'string' ? body.code.replace(/\s+/g, '') : '';
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { error: 'Enter the 6-digit code from your authenticator app.' },
          { status: 400 },
        );
      }

      const rows = await queryRows<{ totp_secret_encrypted: string | null }>(
        'SELECT totp_secret_encrypted FROM public.agents WHERE id = $1 LIMIT 1',
        [user.id],
      );
      const sealed = rows[0]?.totp_secret_encrypted;
      if (!sealed) {
        return NextResponse.json(
          { error: 'No pending two-factor setup found. Start setup again.' },
          { status: 400 },
        );
      }

      const secret = unsealTotpSecret(sealed);
      if (!verifyTotpCode(secret, code)) {
        return NextResponse.json(
          { error: 'That code did not match. Try the next one.' },
          { status: 400 },
        );
      }

      await query(
        `UPDATE public.agents
         SET totp_enabled = true,
             totp_enrolled_at = COALESCE(totp_enrolled_at, now())
         WHERE id = $1`,
        [user.id],
      );

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported MFA action.' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/auth/mfa] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Two-factor operation failed.' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const user = await sessionUser();
    if (!user) {
      return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 });
    }

    await query(
      `UPDATE public.agents
       SET totp_enabled = false,
           totp_secret_encrypted = NULL,
           totp_enrolled_at = NULL
       WHERE id = $1`,
      [user.id],
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[DELETE /api/auth/mfa] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Could not turn off two-factor authentication.' },
      { status: 500 },
    );
  }
}

