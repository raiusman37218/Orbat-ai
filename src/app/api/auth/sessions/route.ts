import { NextResponse } from 'next/server';
import { queryRows } from '@/lib/db';
import { bumpAgentTokenVersion } from '@/lib/auth/postgres-auth';
import { sessionUser } from '@/lib/auth/session-user';
import {
  applyAuthSessionCookies,
  loadAgentAuthRecordById,
  mintAuthSessionBundle,
} from '@/lib/auth/session-cookies';

export async function GET() {
  try {
    const user = await sessionUser();
    if (!user) {
      return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 });
    }

    const rows = await queryRows<{
      email: string | null;
      last_seen_at: string | Date | null;
      created_at: string | Date | null;
    }>(
      'SELECT email, last_seen_at, created_at FROM public.agents WHERE id = $1 LIMIT 1',
      [user.id],
    ).catch(() => []);

    const row = rows[0];
    const lastSignInRaw = row?.last_seen_at ?? row?.created_at ?? null;
    return NextResponse.json({
      email: row?.email ?? user.email ?? null,
      lastSignIn: lastSignInRaw ? new Date(lastSignInRaw).toISOString() : null,
    });
  } catch (err: any) {
    console.error('[GET /api/auth/sessions] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Could not load session details.' },
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

    const body = await req.json().catch(() => ({}));
    if (body?.action !== 'sign_out_others') {
      return NextResponse.json({ error: 'Unsupported session action.' }, { status: 400 });
    }

    const nextVersion = await bumpAgentTokenVersion(user.id).catch(() => 1);
    const record = await loadAgentAuthRecordById(user.id);
    if (!record) {
      return NextResponse.json({ ok: true, tokenVersion: nextVersion });
    }

    const bundle = await mintAuthSessionBundle({
      ...record,
      token_version: nextVersion,
    });
    const res = NextResponse.json({ ok: true, tokenVersion: nextVersion, ...bundle });
    applyAuthSessionCookies(res, bundle, req);
    return res;
  } catch (err: any) {
    console.error('[POST /api/auth/sessions] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Could not sign out other sessions.' },
      { status: 500 },
    );
  }
}

