import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { query, queryRows } from '@/lib/db';
import {
  decodeNestJwtPayload,
  signNestJwt,
  signNestRefreshJwt,
} from '@/lib/auth/session-user';

export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

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

interface AgentRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  brand_color: string | null;
  password_hash: string | null;
  is_active: boolean | null;
  is_super_admin: boolean | null;
  email_verified: boolean | null;
  token_version: number;
  avatar_url?: string | null;
}

function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0].trim() === 'https';
  return req.url.startsWith('https://');
}

function applyAuthCookies(
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

async function buildSessionBundle(agent: {
  id: string;
  email: string;
  name: string;
  role: string;
  workspace_id: string | null;
  workspace_name: string | null;
  brand_color: string | null;
  is_super_admin: boolean | null;
  token_version: number;
  avatar_url?: string | null;
}): Promise<AuthSessionBundle> {
  let isSuperAdmin = agent.is_super_admin === true;
  if (!isSuperAdmin) {
    try {
      const accessRows = await queryRows<{ role: string }>(
        'SELECT role FROM public.platform_access WHERE user_id = $1 LIMIT 1',
        [agent.id],
      );
      if (accessRows.length > 0) isSuperAdmin = true;
    } catch {
      // platform_access optional
    }
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
      avatarUrl: agent.avatar_url ?? null,
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

async function loadAgentById(agentId: string): Promise<AgentRecord | null> {
  const rows = await queryRows<AgentRecord>(
    `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id,
            w.name AS workspace_name, w.brand_color,
            a.password_hash, a.is_active, a.is_super_admin, a.avatar_url,
            COALESCE(a.email_verified, true) AS email_verified,
            COALESCE(a.token_version, 1) AS token_version
     FROM public.agents a
     LEFT JOIN public.workspaces w ON w.id = a.workspace_id
     WHERE a.id = $1
     LIMIT 1`,
    [agentId],
  ).catch(() => []);
  return rows[0] || null;
}

async function ensureAgentWorkspace(
  agent: AgentRecord,
  preferredWorkspaceName?: string,
): Promise<AgentRecord> {
  if (agent.workspace_id && agent.workspace_name) {
    return agent;
  }
  if (agent.workspace_id) {
    const wsRows = await queryRows<{ id: string; name: string; brand_color: string | null }>(
      'SELECT id, name, brand_color FROM public.workspaces WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
      [agent.workspace_id],
    ).catch(() => []);
    if (wsRows.length > 0) {
      return {
        ...agent,
        workspace_id: wsRows[0].id,
        workspace_name: wsRows[0].name,
        brand_color: wsRows[0].brand_color,
      };
    }
  }

  const baseName =
    preferredWorkspaceName?.trim() || `${agent.name?.trim() || agent.email.split('@')[0]}'s Workspace`;
  const wsRows = await queryRows<{ id: string; name: string; brand_color: string | null }>(
    `INSERT INTO public.workspaces (name, brand_color, greeting_title, greeting_message, owner_id)
     VALUES ($1, $2, $3, $4, NULL)
     RETURNING id, name, brand_color`,
    [baseName, '#163300', 'Welcome to Orbat AI', 'How can we help you today?'],
  );
  const workspace = wsRows[0];
  await query('UPDATE public.workspaces SET owner_id = $1 WHERE id = $2', [
    agent.id,
    workspace.id,
  ]).catch(() => {});
  await query('UPDATE public.agents SET workspace_id = $1 WHERE id = $2', [
    workspace.id,
    agent.id,
  ]).catch(() => {});

  return {
    ...agent,
    workspace_id: workspace.id,
    workspace_name: workspace.name,
    brand_color: workspace.brand_color,
  };
}

export async function resolveGoogleOAuthCredentials(): Promise<GoogleOAuthCredentials> {
  let clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
  let clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  let callbackUrl = (process.env.GOOGLE_CALLBACK_URL || '').trim();

  if (!clientId || !clientSecret) {
    try {
      const rows = await queryRows<{ oauth_settings: Record<string, any> | null }>(
        `SELECT oauth_settings FROM public.platform_settings WHERE id = 'default' LIMIT 1`,
      );
      const oauth = rows?.[0]?.oauth_settings;
      if (oauth && typeof oauth === 'object') {
        if (!clientId && typeof oauth.google_client_id === 'string') {
          clientId = oauth.google_client_id.trim();
        }
        if (!clientSecret && typeof oauth.google_client_secret === 'string') {
          clientSecret = oauth.google_client_secret.trim();
        }
        if (!callbackUrl && typeof oauth.google_callback_url === 'string') {
          callbackUrl = oauth.google_callback_url.trim();
        }
      }
    } catch {
      // Ignore if platform_settings is unavailable or mocked without oauth_settings
    }
  }

  return {
    clientId,
    clientSecret,
    callbackUrl,
  };
}

export function resolveEffectiveGoogleCallbackUrl(params: {
  requestedRedirectUri?: string | null;
  requestOrigin?: string | null;
  configuredCallbackUrl?: string | null;
}): string {
  const { requestedRedirectUri, requestOrigin, configuredCallbackUrl } = params;

  if (requestedRedirectUri) {
    try {
      const parsed = new URL(requestedRedirectUri.trim());
      if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.pathname.endsWith('/auth/callback')
      ) {
        return `${parsed.origin}${parsed.pathname}`;
      }
    } catch {
      // Ignore invalid requestedRedirectUri
    }
  }

  if (requestOrigin) {
    try {
      const parsed = new URL(requestOrigin.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${parsed.origin}/auth/callback`;
      }
    } catch {
      // Ignore invalid requestOrigin
    }
  }

  if (configuredCallbackUrl && /^https?:\/\//i.test(configuredCallbackUrl.trim())) {
    return configuredCallbackUrl.trim();
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (appUrl && /^https?:\/\//i.test(appUrl)) {
    return `${appUrl.replace(/\/+$/, '')}/auth/callback`;
  }

  return 'http://localhost:3000/auth/callback';
}

export async function getGoogleAuthUrlFallback(params: {
  redirectUri?: string | null;
  state?: string | null;
  requestOrigin?: string | null;
}): Promise<{ configured: boolean; url: string | null; message?: string }> {
  const creds = await resolveGoogleOAuthCredentials();
  if (!creds.clientId) {
    return {
      configured: false,
      url: null,
      message: 'Google OAuth is not configured yet.',
    };
  }

  const callbackUrl = resolveEffectiveGoogleCallbackUrl({
    requestedRedirectUri: params.redirectUri,
    requestOrigin: params.requestOrigin,
    configuredCallbackUrl: creds.callbackUrl,
  });

  const search = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  const cleanState = typeof params.state === 'string' ? params.state.trim().slice(0, 512) : '';
  if (cleanState) {
    search.set('state', cleanState);
  }

  return {
    configured: true,
    url: `https://accounts.google.com/o/oauth2/v2/auth?${search.toString()}`,
  };
}

export async function exchangeGoogleOAuthAndSignIn(
  dto: {
    code?: string;
    idToken?: string;
    credential?: string;
    accessToken?: string;
    redirectUri?: string;
  },
  requestOrigin?: string | null,
): Promise<AuthSessionBundle & { isNewUser: boolean }> {
  const creds = await resolveGoogleOAuthCredentials();
  if (!creds.clientId) {
    throw new Error('Google OAuth client ID is not configured.');
  }

  let email: string | null = null;
  let name: string | null = null;
  let picture: string | null = null;

  const verifyGoogleIdToken = async (idToken: string) => {
    const payloadRes = await fetch('https://oauth2.googleapis.com/tokeninfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken }).toString(),
    });
    if (!payloadRes.ok) {
      throw new Error('Invalid Google ID token or credential.');
    }
    const payload = await payloadRes.json();
    const audMatches = payload.aud === creds.clientId || payload.azp === creds.clientId;
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!audMatches || !emailVerified) {
      throw new Error('Google token audience or email verification check failed.');
    }
    return payload;
  };

  const token = dto.idToken || dto.credential;

  if (dto.code) {
    if (!creds.clientSecret) {
      throw new Error('Google OAuth client secret is not configured.');
    }
    const callbackUrl = resolveEffectiveGoogleCallbackUrl({
      requestedRedirectUri: dto.redirectUri,
      requestOrigin,
      configuredCallbackUrl: creds.callbackUrl,
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: dto.code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      throw new Error(`Failed to exchange Google authorization code${errText ? `: ${errText}` : '.'}`);
    }

    const tokenData = await tokenRes.json();
    if (tokenData.id_token) {
      const payload = await verifyGoogleIdToken(tokenData.id_token);
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } else if (tokenData.access_token) {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userRes.ok) {
        throw new Error('Failed to fetch Google user profile.');
      }
      const user = await userRes.json();
      if (user.email_verified !== true && user.email_verified !== 'true') {
        throw new Error('Google account email is not verified.');
      }
      email = user.email;
      name = user.name;
      picture = user.picture;
    }
  } else if (token) {
    const payload = await verifyGoogleIdToken(token);
    email = payload.email;
    name = payload.name;
    picture = payload.picture;
  } else if (dto.accessToken) {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${dto.accessToken}` },
    });
    if (!userRes.ok) {
      throw new Error('Failed to fetch Google user profile.');
    }
    const user = await userRes.json();
    if (user.email_verified !== true && user.email_verified !== 'true') {
      throw new Error('Google account email is not verified.');
    }
    email = user.email;
    name = user.name;
    picture = user.picture;
  } else {
    throw new Error('Please provide a Google authorization code or token.');
  }

  if (!email) {
    throw new Error('Could not retrieve email from Google profile.');
  }

  const emailNormalized = email.trim().toLowerCase();

  const existing = await queryRows<AgentRecord>(
    `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id,
            w.name AS workspace_name, w.brand_color,
            a.password_hash, a.is_active, a.is_super_admin, a.avatar_url,
            COALESCE(a.email_verified, true) AS email_verified,
            COALESCE(a.token_version, 1) AS token_version
     FROM public.agents a
     LEFT JOIN public.workspaces w ON w.id = a.workspace_id
     WHERE LOWER(a.email) = $1
     LIMIT 1`,
    [emailNormalized],
  );

  if (existing.length > 0) {
    const agent = existing[0];
    if (agent.is_active === false) {
      throw new Error('Your account has been deactivated. Please contact your workspace administrator.');
    }

    await query(
      `UPDATE public.agents
       SET email_verified = true,
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           avatar_url = COALESCE(avatar_url, $2),
           last_seen_at = now()
       WHERE id = $1`,
      [agent.id, picture || null],
    ).catch(() => {});

    const hydrated = await ensureAgentWorkspace(agent);
    const bundle = await buildSessionBundle({
      ...hydrated,
      avatar_url: hydrated.avatar_url || picture || null,
    });
    return {
      ...bundle,
      isNewUser: false,
    };
  }

  const userName = name?.trim() || emailNormalized.split('@')[0];
  const workspaceName = `${userName}'s Workspace`;

  const wsRows = await queryRows<{ id: string; name: string; brand_color: string | null }>(
    `INSERT INTO public.workspaces (name, brand_color, greeting_title, greeting_message, owner_id)
     VALUES ($1, $2, $3, $4, NULL)
     RETURNING id, name, brand_color`,
    [workspaceName, '#163300', 'Welcome to Orbat AI', 'How can we help you today?'],
  );
  const workspace = wsRows[0];

  const agentRows = await queryRows<{
    id: string;
    name: string;
    email: string;
    role: string;
    workspace_id: string;
    status: string | null;
    is_super_admin: boolean | null;
  }>(
    `INSERT INTO public.agents (
       id, name, email, role, status, workspace_id, avatar_url, is_active,
       email_verified, email_confirmed_at, token_version
     )
     VALUES ($1, $2, $3, 'owner', 'online', $4, $5, true, true, now(), 1)
     RETURNING id, name, email, role, workspace_id, status, is_super_admin`,
    [crypto.randomUUID(), userName, emailNormalized, workspace.id, picture || null],
  );
  const agent = agentRows[0];

  await query('UPDATE public.workspaces SET owner_id = $1 WHERE id = $2', [
    agent.id,
    workspace.id,
  ]).catch(() => {});

  const bundle = await buildSessionBundle({
    id: agent.id,
    name: agent.name,
    email: agent.email,
    role: agent.role,
    workspace_id: workspace.id,
    workspace_name: workspace.name,
    brand_color: workspace.brand_color,
    is_super_admin: agent.is_super_admin,
    token_version: 1,
    avatar_url: picture || null,
  });

  return {
    ...bundle,
    isNewUser: true,
  };
}

export async function handleBackendAuthFallback(
  subPath: string,
  method: string,
  req: Request,
): Promise<NextResponse | null> {
  const clean = subPath.replace(/^\/+|\/+$/g, '').toLowerCase();
  const reqUrl = new URL(req.url);

  if (method === 'GET' && clean === 'auth/google/url') {
    const redirectUri = reqUrl.searchParams.get('redirectUri');
    const state = reqUrl.searchParams.get('state');
    const data = await getGoogleAuthUrlFallback({
      redirectUri,
      state,
      requestOrigin: reqUrl.origin,
    });
    return NextResponse.json({ success: true, data });
  }

  if (method === 'POST' && clean === 'auth/google') {
    try {
      const body = await req.json().catch(() => ({}));
      const bundle = await exchangeGoogleOAuthAndSignIn(body || {}, reqUrl.origin);
      const res = NextResponse.json({ success: true, data: bundle });
      applyAuthCookies(res, bundle, req);
      return res;
    } catch (err: any) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 401,
          message: err?.message || 'Google authentication failed.',
        },
        { status: 401 },
      );
    }
  }

  if (method === 'POST' && clean === 'auth/login') {
    try {
      const body = await req.json().catch(() => ({}));
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      if (!email || !password) {
        return NextResponse.json(
          { success: false, statusCode: 401, message: 'Email and password are required.' },
          { status: 401 },
        );
      }

      const rows = await queryRows<AgentRecord>(
        `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id,
                w.name AS workspace_name, w.brand_color,
                a.password_hash, a.is_active, a.is_super_admin, a.avatar_url,
                COALESCE(a.email_verified, true) AS email_verified,
                COALESCE(a.token_version, 1) AS token_version
         FROM public.agents a
         LEFT JOIN public.workspaces w ON w.id = a.workspace_id
         WHERE LOWER(a.email) = $1
         LIMIT 1`,
        [email],
      );

      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, statusCode: 401, message: 'Invalid email or password.' },
          { status: 401 },
        );
      }

      const agent = rows[0];
      if (agent.is_active === false) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 403,
            message: 'Your account has been deactivated. Please contact your workspace administrator.',
          },
          { status: 403 },
        );
      }

      if (!agent.password_hash) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 401,
            message: 'This account uses Google Sign-In. Please continue with Google.',
          },
          { status: 401 },
        );
      }

      const matches = await bcrypt.compare(password, agent.password_hash);
      if (!matches) {
        return NextResponse.json(
          { success: false, statusCode: 401, message: 'Invalid email or password.' },
          { status: 401 },
        );
      }

      await query('UPDATE public.agents SET last_seen_at = now() WHERE id = $1', [agent.id]).catch(
        () => {},
      );
      const bundle = await buildSessionBundle(agent);
      const res = NextResponse.json({ success: true, data: bundle });
      applyAuthCookies(res, bundle, req);
      return res;
    } catch (err: any) {
      return NextResponse.json(
        { success: false, statusCode: 500, message: err?.message || 'Login failed.' },
        { status: 500 },
      );
    }
  }

  if (method === 'POST' && clean === 'auth/signup') {
    try {
      const body = await req.json().catch(() => ({}));
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      const workspaceName =
        typeof body?.workspaceName === 'string' && body.workspaceName.trim()
          ? body.workspaceName.trim()
          : `${name || 'My'}'s Workspace`;

      if (!name || !email || !password) {
        return NextResponse.json(
          { success: false, statusCode: 400, message: 'Name, email, and password are required.' },
          { status: 400 },
        );
      }

      const existing = await queryRows<AgentRecord>(
        `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id,
                w.name AS workspace_name, w.brand_color,
                a.password_hash, a.is_active, a.is_super_admin, a.avatar_url,
                COALESCE(a.email_verified, true) AS email_verified,
                COALESCE(a.token_version, 1) AS token_version
         FROM public.agents a
         LEFT JOIN public.workspaces w ON w.id = a.workspace_id
         WHERE LOWER(a.email) = $1
         LIMIT 1`,
        [email],
      );
      if (existing.length > 0) {
        const existingAgent = existing[0];
        if (existingAgent.is_active === false) {
          return NextResponse.json(
            {
              success: false,
              statusCode: 403,
              message: 'Your account has been deactivated. Please contact your workspace administrator.',
            },
            { status: 403 },
          );
        }

        const passwordMatches = existingAgent.password_hash
          ? await bcrypt.compare(password, existingAgent.password_hash)
          : false;

        if (!existingAgent.password_hash || passwordMatches) {
          const updateFields: string[] = [];
          const updateParams: any[] = [existingAgent.id];
          if (!existingAgent.password_hash) {
            const passwordHash = await bcrypt.hash(password, 10);
            updateParams.push(passwordHash);
            updateFields.push(`password_hash = $${updateParams.length}`);
          }
          if (name && name !== existingAgent.name) {
            updateParams.push(name);
            updateFields.push(`name = $${updateParams.length}`);
          }
          if (updateFields.length > 0) {
            await query(
              `UPDATE public.agents SET ${updateFields.join(', ')}, last_seen_at = now() WHERE id = $1`,
              updateParams,
            ).catch(() => {});
          }

          const hydrated = await ensureAgentWorkspace(
            { ...existingAgent, name: name || existingAgent.name },
            workspaceName,
          );
          const bundle = await buildSessionBundle(hydrated);
          const res = NextResponse.json({ success: true, data: bundle }, { status: 200 });
          applyAuthCookies(res, bundle, req);
          return res;
        }

        return NextResponse.json(
          {
            success: false,
            statusCode: 409,
            message: 'An account with this email address already exists.',
          },
          { status: 409 },
        );
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const wsRows = await queryRows<{ id: string; name: string; brand_color: string | null }>(
        `INSERT INTO public.workspaces (name, brand_color, greeting_title, greeting_message, owner_id)
         VALUES ($1, $2, $3, $4, NULL)
         RETURNING id, name, brand_color`,
        [workspaceName, '#163300', 'Welcome to Orbat AI', 'How can we help you today?'],
      );
      const workspace = wsRows[0];

      const agentRows = await queryRows<{
        id: string;
        name: string;
        email: string;
        role: string;
        workspace_id: string;
        is_super_admin: boolean | null;
      }>(
        `INSERT INTO public.agents (
           id, name, email, role, status, workspace_id, password_hash, is_active,
           email_verified, email_confirmed_at, token_version
         )
         VALUES ($1, $2, $3, 'owner', 'online', $4, $5, true, true, now(), 1)
         RETURNING id, name, email, role, workspace_id, is_super_admin`,
        [crypto.randomUUID(), name, email, workspace.id, passwordHash],
      );
      const agent = agentRows[0];

      await query('UPDATE public.workspaces SET owner_id = $1 WHERE id = $2', [
        agent.id,
        workspace.id,
      ]).catch(() => {});

      const bundle = await buildSessionBundle({
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        brand_color: workspace.brand_color,
        is_super_admin: agent.is_super_admin,
        token_version: 1,
      });

      const res = NextResponse.json({ success: true, data: bundle }, { status: 201 });
      applyAuthCookies(res, bundle, req);
      return res;
    } catch (err: any) {
      return NextResponse.json(
        { success: false, statusCode: 500, message: err?.message || 'Signup failed.' },
        { status: 500 },
      );
    }
  }

  if (method === 'POST' && clean === 'auth/refresh') {
    try {
      const body = await req.json().catch(() => ({}));
      const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken.trim() : '';
      if (!refreshToken) {
        return NextResponse.json(
          { success: false, statusCode: 401, message: 'Refresh token is required.' },
          { status: 401 },
        );
      }
      const payload = decodeNestJwtPayload(refreshToken);
      const userId = String(payload?.sub || payload?.id || '').trim();
      if (!payload || !userId) {
        return NextResponse.json(
          { success: false, statusCode: 401, message: 'Invalid or expired refresh token.' },
          { status: 401 },
        );
      }
      const agent = await loadAgentById(userId);
      if (!agent || agent.is_active === false) {
        return NextResponse.json(
          { success: false, statusCode: 401, message: 'Account not found or inactive.' },
          { status: 401 },
        );
      }
      const bundle = await buildSessionBundle(agent);
      const res = NextResponse.json({ success: true, data: bundle });
      applyAuthCookies(res, bundle, req);
      return res;
    } catch (err: any) {
      return NextResponse.json(
        { success: false, statusCode: 401, message: err?.message || 'Token refresh failed.' },
        { status: 401 },
      );
    }
  }

  if (method === 'GET' && clean === 'auth/me') {
    try {
      const authHeader = req.headers.get('authorization') || '';
      const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!bearerToken) {
        return NextResponse.json(
          { success: false, statusCode: 401, message: 'Unauthorized.' },
          { status: 401 },
        );
      }
      const payload = decodeNestJwtPayload(bearerToken);
      const userId = String(payload?.sub || payload?.id || '').trim();
      if (!payload || !userId) {
        return NextResponse.json(
          { success: false, statusCode: 401, message: 'Invalid or expired access token.' },
          { status: 401 },
        );
      }
      const agent = await loadAgentById(userId);
      if (!agent || agent.is_active === false) {
        return NextResponse.json(
          { success: false, statusCode: 401, message: 'User not found.' },
          { status: 401 },
        );
      }
      const bundle = await buildSessionBundle(agent);
      return NextResponse.json({
        success: true,
        data: {
          ...bundle.user,
          workspace: bundle.workspace,
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, statusCode: 401, message: err?.message || 'Unauthorized.' },
        { status: 401 },
      );
    }
  }

  return null;
}
