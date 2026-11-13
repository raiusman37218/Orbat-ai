import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { bumpAgentTokenVersion } from '@/lib/auth/postgres-auth';
import { sessionUser } from '@/lib/auth/session-user';
import {
  applyAuthSessionCookies,
  clearAuthSessionCookies,
  loadAgentAuthRecordById,
  mintAuthSessionBundle,
} from '@/lib/auth/session-cookies';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const scope =
      body?.scope === 'others' || body?.scope === 'global' ? body.scope : 'local';

    const user = await sessionUser();

    if (user && (scope === 'others' || scope === 'global')) {
      const nextVersion = await bumpAgentTokenVersion(user.id).catch(() => 1);
      if (scope === 'others') {
        const record = await loadAgentAuthRecordById(user.id);
        if (record) {
          const bundle = await mintAuthSessionBundle({
            ...record,
            token_version: nextVersion,
          });
          const res = NextResponse.json({ ok: true, scope, ...bundle });
          applyAuthSessionCookies(res, bundle, req);
          return res;
        }
        return NextResponse.json({ ok: true, scope });
      }
    }

    if (user) {
      await query('UPDATE public.agents SET status = $1 WHERE id = $2', [
        'offline',
        user.id,
      ]).catch(() => {});
    }

    const res = NextResponse.json({ ok: true, scope });
    clearAuthSessionCookies(res, req);
    return res;
  } catch (err: any) {
    console.error('[POST /api/auth/logout] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Could not sign out.' },
      { status: 500 },
    );
  }
}

