import { NextResponse } from 'next/server';
import { query, queryRows } from '@/lib/db';
import {
  authenticatePgPassword,
  unsealTotpSecret,
  verifyTotpCode,
} from '@/lib/auth/postgres-auth';
import {
  applyAuthSessionCookies,
  mintAuthSessionBundle,
} from '@/lib/auth/session-cookies';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const totpCode = typeof body?.totpCode === 'string' ? body.totpCode.trim() : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 },
      );
    }

    const authResult = await authenticatePgPassword(email, password);
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error, emailVerified: authResult.emailVerified },
        { status: authResult.status },
      );
    }

    const agent = authResult.agent;

    if (agent.totp_enabled) {
      if (!totpCode) {
        return NextResponse.json(
          { error: 'Two-factor authentication code is required.', requiresMfa: true },
          { status: 403 },
        );
      }

      const secretRows = await queryRows<{ totp_secret_encrypted: string | null }>(
        'SELECT totp_secret_encrypted FROM public.agents WHERE id = $1 LIMIT 1',
        [agent.id],
      ).catch(() => []);

      const sealed = secretRows[0]?.totp_secret_encrypted;
      if (!sealed) {
        return NextResponse.json(
          { error: 'Two-factor configuration is incomplete. Contact support.' },
          { status: 500 },
        );
      }

      const secret = unsealTotpSecret(sealed);
      if (!verifyTotpCode(secret, totpCode)) {
        return NextResponse.json(
          { error: 'Invalid authenticator code.', requiresMfa: true },
          { status: 401 },
        );
      }
    }

    await query('UPDATE public.agents SET last_seen_at = now() WHERE id = $1', [
      agent.id,
    ]).catch(() => {});

    const bundle = await mintAuthSessionBundle(agent);
    const res = NextResponse.json(bundle);
    applyAuthSessionCookies(res, bundle, req);
    return res;
  } catch (err: any) {
    console.error('[POST /api/auth/login] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Sign in failed.' },
      { status: 500 },
    );
  }
}

