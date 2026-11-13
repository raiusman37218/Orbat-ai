import 'server-only';
import { NextResponse } from 'next/server';
import { queryRows } from '@/lib/db';
import type { PgAgentAuthRecord } from '@/lib/auth/postgres-auth';
import { signNestJwt, signNestRefreshJwt } from '@/lib/auth/session-user';

export const AUTH_COOKIE_NAMES = [
  'orbat_access_token',
  'orbat_refresh_token',
  'orbat_user',
  'orbat_workspace',
] as const;

export interface AuthSessionBundle {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: '7d';
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    workspaceId: string | null;
    avatarUrl?: string | null;
    isSuperAdmin: boolean;
  };
  workspace: {
    id: string;
    name: string;
    brandColor: string | null;
  } | null;
}

export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0].trim() === 'https';
  return req.url.startsWith('https://');
}

export async function mintAuthSessionBundle(
  agent: Pick<
    PgAgentAuthRecord,
    'id' | 'email' | 'name' | 'role' | 'workspace_id' | 'workspace_name' | 'brand_color' | 'is_super_admin' | 'token_version'
  >,
): Promise<AuthSessionBundle> {
  let isSuperAdmin = agent.is_super_admin === true;
  if (!isSuperAdmin) {
    try {
      const accessRows = await queryRows<{ role: string }>(
        'SELECT role FROM public.platform_access WHERE user_id = $1 LIMIT 1',
        [agent.id],
      );
      if (accessRows.length > 0) isSuperAdmin = true;
    } catch {
      // platform_access table optional
    }
  }

  let avatarUrl: string | null = null;
  try {
    const avatarRows = await queryRows<{ avatar_url: string | null }>(
      'SELECT avatar_url FROM public.agents WHERE id = $1 LIMIT 1',
      [agent.id],
    );
    avatarUrl = avatarRows[0]?.avatar_url ?? null;
  } catch {
    // ignore
  }

  const tokenVersion = Number(agent.token_version || 1);
  const accessToken = signNestJwt({
    sub: agent.id,
    email: agent.email,
    workspaceId: agent.workspace_id,
    role: agent.role || 'owner',
    name: agent.name,
    tv: tokenVersion,
    isSuperAdmin,
  });

  const refreshToken = signNestRefreshJwt(agent.id, tokenVersion);

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: '7d',
    user: {
      id: agent.id,
      email: agent.email,
      name: agent.name,
      role: agent.role || 'owner',
      workspaceId: agent.workspace_id,
      avatarUrl,
      isSuperAdmin,
    },
    workspace: agent.workspace_id
      ? {
          id: agent.workspace_id,
          name: agent.workspace_name || 'Workspace',
          brandColor: agent.brand_color || null,
        }
      : null,
  };
}

export function applyAuthSessionCookies(
  res: NextResponse,
  bundle: AuthSessionBundle,
  req: Request,
): void {
  const cookieOpts = {
    path: '/',
    maxAge: 604800,
    sameSite: 'lax' as const,
    secure: isSecureRequest(req),
  };

  res.cookies.set('orbat_access_token', bundle.accessToken, cookieOpts);
  res.cookies.set('orbat_refresh_token', bundle.refreshToken, {
    ...cookieOpts,
    maxAge: 2592000,
  });
  res.cookies.set('orbat_user', JSON.stringify(bundle.user), cookieOpts);
  if (bundle.workspace) {
    res.cookies.set('orbat_workspace', JSON.stringify(bundle.workspace), cookieOpts);
  } else {
    res.cookies.set('orbat_workspace', '', { ...cookieOpts, maxAge: 0 });
  }
}

export function clearAuthSessionCookies(res: NextResponse, req: Request): void {
  const cookieOpts = {
    path: '/',
    maxAge: 0,
    sameSite: 'lax' as const,
    secure: isSecureRequest(req),
  };
  for (const name of AUTH_COOKIE_NAMES) {
    res.cookies.set(name, '', cookieOpts);
  }
}

export async function loadAgentAuthRecordById(
  agentId: string,
): Promise<PgAgentAuthRecord | null> {
  const rows = await queryRows<PgAgentAuthRecord>(
    `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id,
            w.name AS workspace_name, w.brand_color,
            a.password_hash, a.is_active, a.is_super_admin,
            COALESCE(a.email_verified, true) AS email_verified,
            COALESCE(a.token_version, 1) AS token_version,
            COALESCE(a.totp_enabled, false) AS totp_enabled
     FROM public.agents a
     LEFT JOIN public.workspaces w ON w.id = a.workspace_id
     WHERE a.id = $1
     LIMIT 1`,
    [agentId],
  ).catch(() => []);

  if (rows.length > 0) return rows[0];

  const accts = await queryRows<{
    id: string;
    email: string;
    name: string | null;
    email_confirmed_at: string | null;
  }>(
    `SELECT id, email, name, email_confirmed_at
     FROM public.auth_accounts
     WHERE id = $1
     LIMIT 1`,
    [agentId],
  ).catch(() => []);

  if (accts.length === 0) return null;
  const a = accts[0];
  return {
    id: a.id,
    name: a.name || a.email.split('@')[0],
    email: a.email,
    role: 'owner',
    status: 'online',
    workspace_id: null,
    workspace_name: null,
    brand_color: null,
    password_hash: null,
    is_active: true,
    is_super_admin: false,
    email_verified: Boolean(a.email_confirmed_at),
    token_version: 1,
    totp_enabled: false,
  };
}

