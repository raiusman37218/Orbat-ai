import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export interface SessionUser {
  id: string;
  email?: string;
}

function decodeNestJwtPayload(token: string): Record<string, any> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const secret = process.env.JWT_SECRET;
  if (secret) {
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    const providedSig = Buffer.from(parts[2], 'base64url');
    if (
      expectedSig.length !== providedSig.length ||
      !crypto.timingSafeEqual(expectedSig, providedSig)
    ) {
      return null;
    }
  }

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp <= now) {
    return null;
  }
  return payload;
}

/**
 * The signed-in user from the request's session, for server guards.
 * Reads native NestJS JWT orbat_access_token cookie first.
 */
export async function sessionUser(supabase?: SupabaseClient): Promise<SessionUser | null> {
  // 1. Check native Orbat JWT token from cookies
  try {
    const cookieStore = await cookies();
    const nestToken = cookieStore.get('orbat_access_token')?.value;
    if (nestToken) {
      const payload = decodeNestJwtPayload(nestToken);
      const uid = payload?.sub || payload?.id;
      if (uid) {
        return {
          id: String(uid),
          email: typeof payload?.email === 'string' ? payload.email : undefined,
        };
      }
    }
  } catch {}

  // 2. Fallback for legacy Supabase session if present
  if (supabase) {
    try {
      if (typeof supabase.auth?.getClaims === 'function') {
        const { data, error } = await supabase.auth.getClaims();
        const claims = data?.claims as { sub?: unknown; email?: unknown } | undefined;
        if (!error && typeof claims?.sub === 'string' && claims.sub) {
          return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined };
        }
      }
      if (typeof supabase.auth?.getUser === 'function') {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          return { id: data.user.id, email: data.user.email ?? undefined };
        }
      }
    } catch {}
  }

  return null;
}
