import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { queryRows } from '@/lib/db';

export interface SessionUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  workspaceId?: string;
  isSuperAdmin?: boolean;
  tokenVersion?: number;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Verifies HS256 JWT tokens issued by Orbat AI backend/server using JWT_SECRET.
 * Fails closed when JWT_SECRET is absent, algorithm != HS256, signature fails,
 * or exp claim is missing/expired.
 */
export function decodeNestJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return null;
    }

    const headerRaw = Buffer.from(parts[0], 'base64url').toString('utf8');
    const header = JSON.parse(headerRaw);
    if (!header || typeof header !== 'object' || header.alg !== 'HS256') {
      return null;
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    const actualSig = Buffer.from(parts[2], 'base64url');
    if (
      actualSig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(actualSig, expectedSig)
    ) {
      return null;
    }

    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== 'object') return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function signNestJwt(
  payload: Record<string, unknown>,
  expiresInSeconds = 60 * 60 * 24 * 7,
  secretOverride?: string
): string {
  const secret = (secretOverride ?? process.env.JWT_SECRET ?? '').trim();
  if (!secret) {
    throw new Error('JWT_SECRET is not configured on the server.');
  }
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const headerPart = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadPart = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest();
  return `${headerPart}.${payloadPart}.${base64UrlEncode(signature)}`;
}

export function signNestRefreshJwt(userId: string, tokenVersion = 1, expiresInSeconds = 60 * 60 * 24 * 30): string {
  const secret = (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET / JWT_SECRET is not configured on the server.');
  }
  return signNestJwt({ sub: userId, tv: tokenVersion }, expiresInSeconds, secret);
}

async function extractSessionTokenFromRequest(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get('orbat_access_token')?.value;
    if (cookieToken) return cookieToken;
  } catch {
    // cookies() unavailable outside request context (e.g. unit tests)
  }

  try {
    const headerList = await headers();
    const authHeader = headerList.get('authorization');
    if (authHeader) {
      const [scheme, token] = authHeader.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && token) {
        return token;
      }
    }
  } catch {
    // headers() unavailable outside request context
  }

  return null;
}

/**
 * Resolves the authenticated session user purely from Orbat AI HS256 JWT cookies
 * or Bearer headers, backed by PostgreSQL active/token_version verification.
 * Accepts an optional unused argument for gradual signature compatibility.
 */
export async function sessionUser(_unused?: unknown): Promise<SessionUser | null> {
  const token = await extractSessionTokenFromRequest();
  if (!token) return null;

  const payload = decodeNestJwtPayload(token);
  const userId = String(payload?.sub || payload?.id || '').trim();
  if (!payload || !userId) return null;

  const user: SessionUser = {
    id: userId,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
    workspaceId:
      typeof payload.workspaceId === 'string'
        ? payload.workspaceId
        : typeof payload.workspace_id === 'string'
          ? payload.workspace_id
          : undefined,
    isSuperAdmin: Boolean(payload.isSuperAdmin || payload.is_super_admin),
    tokenVersion: typeof payload.tv === 'number' ? payload.tv : undefined,
  };

  const hasDb = Boolean((process.env.DATABASE_URL || '').trim() || (process.env.TEST_DATABASE_URL || '').trim());
  if (hasDb && (!process.env.VITEST || Boolean(process.env.TEST_DATABASE_URL))) {
    try {
      const rows = await queryRows<{
        is_active: boolean | null;
        token_version: number | null;
        role: string | null;
        workspace_id: string | null;
        is_super_admin: boolean | null;
      }>(
        'SELECT is_active, COALESCE(token_version, 1) AS token_version, role, workspace_id, is_super_admin FROM public.agents WHERE id = $1 LIMIT 1',
        [userId]
      );
      if (rows.length === 0) {
        return null;
      }
      const row = rows[0];
      if (row.is_active === false) {
        return null;
      }
      if (typeof payload.tv === 'number' && Number(row.token_version ?? 1) !== payload.tv) {
        return null;
      }
      if (row.role) user.role = row.role;
      if (row.workspace_id) user.workspaceId = row.workspace_id;
      if (row.is_super_admin != null) user.isSuperAdmin = Boolean(row.is_super_admin);
      if (row.token_version != null) user.tokenVersion = Number(row.token_version);
    } catch (err: any) {
      // If token_version column is not migrated yet on a dev DB, still validate is_active cleanly
      const msg = String(err?.message || '');
      if (msg.includes('token_version')) {
        try {
          const rows = await queryRows<{ is_active: boolean | null }>(
            'SELECT is_active FROM public.agents WHERE id = $1 LIMIT 1',
            [userId]
          );
          if (rows.length === 0 || rows[0]?.is_active === false) return null;
        } catch {
          // Allow JWT verification to stand if DB pool is transiently unavailable in edge/dev
        }
      }
    }
  }

  return user;
}

