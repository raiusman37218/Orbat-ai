'use client';

import {
  resolveClientBackendBaseUrl,
  resolveClientSocketUrl,
} from '../backend-url';

export interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: string;
  workspaceId: string | null;
  avatarUrl?: string | null;
  isSuperAdmin: boolean;
}

export interface BackendWorkspace {
  id: string;
  name: string;
  brandColor?: string;
  slug?: string;
  logoUrl?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: string;
  user: BackendUser;
  workspace: BackendWorkspace | null;
}

export function isBackendAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

export function getBackendBaseUrl(): string {
  return resolveClientBackendBaseUrl();
}

const SAME_ORIGIN_BACKEND_PROXY = '/api/backend/api/v1';

async function fetchAuthEndpoint(path: string, init?: RequestInit): Promise<Response> {
  const primaryBase = getBackendBaseUrl();
  try {
    const res = await fetch(`${primaryBase}${path}`, init);
    if (
      res.status >= 502 &&
      primaryBase !== SAME_ORIGIN_BACKEND_PROXY &&
      typeof window !== 'undefined'
    ) {
      return await fetch(`${SAME_ORIGIN_BACKEND_PROXY}${path}`, init);
    }
    return res;
  } catch (err) {
    if (primaryBase !== SAME_ORIGIN_BACKEND_PROXY && typeof window !== 'undefined') {
      return await fetch(`${SAME_ORIGIN_BACKEND_PROXY}${path}`, init);
    }
    throw err;
  }
}

export function getBackendSocketUrl(): string {
  return resolveClientSocketUrl() || '';
}

function setBrowserCookie(name: string, value: string, maxAgeSeconds = 604800) {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function getBrowserCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(';');
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (part.startsWith(prefix)) {
      return part.slice(prefix.length);
    }
  }
  return null;
}

function parseJsonCookie<T>(raw: string | null): T | null {
  if (!raw) return null;
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
    candidates.push(decodeURIComponent(decodeURIComponent(raw)));
  } catch {
    // ignore malformed URI sequence
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function saveAuthSession(data: AuthResponse) {
  if (typeof window === 'undefined') return;

  try {
    if (data.accessToken) {
      localStorage.setItem('orbat_access_token', data.accessToken);
      setBrowserCookie('orbat_access_token', data.accessToken, 604800);
    }
    if (data.refreshToken) {
      localStorage.setItem('orbat_refresh_token', data.refreshToken);
      setBrowserCookie('orbat_refresh_token', data.refreshToken, 2592000);
    }
    if (data.user) {
      const userJson = JSON.stringify(data.user);
      localStorage.setItem('orbat_user', userJson);
      setBrowserCookie('orbat_user', userJson, 604800);
    }
    if (data.workspace) {
      const wsJson = JSON.stringify(data.workspace);
      localStorage.setItem('orbat_workspace', wsJson);
      setBrowserCookie('orbat_workspace', wsJson, 604800);
    }
  } catch (err) {
    console.error('Failed to save auth session:', err);
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('orbat_access_token');
    localStorage.removeItem('orbat_refresh_token');
    localStorage.removeItem('orbat_user');
    localStorage.removeItem('orbat_workspace');
    setBrowserCookie('orbat_access_token', '', 0);
    setBrowserCookie('orbat_refresh_token', '', 0);
    setBrowserCookie('orbat_user', '', 0);
    setBrowserCookie('orbat_workspace', '', 0);
  } catch (err) {
    console.error('Failed to clear auth session:', err);
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const rawCookie = getBrowserCookie('orbat_access_token');
  if (rawCookie) {
    let decoded = rawCookie.trim();
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // keep raw trimmed value
    }
    if (decoded) {
      try {
        if (localStorage.getItem('orbat_access_token') !== decoded) {
          localStorage.setItem('orbat_access_token', decoded);
        }
      } catch {
        // ignore storage quota errors
      }
      return decoded;
    }
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  const rawCookie = getBrowserCookie('orbat_refresh_token');
  if (rawCookie) {
    let decoded = rawCookie.trim();
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // keep raw trimmed value
    }
    if (decoded) {
      try {
        if (localStorage.getItem('orbat_refresh_token') !== decoded) {
          localStorage.setItem('orbat_refresh_token', decoded);
        }
      } catch {
        // ignore
      }
      return decoded;
    }
  }
  return localStorage.getItem('orbat_refresh_token');
}

export function getStoredUser(): BackendUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromCookie = parseJsonCookie<BackendUser>(getBrowserCookie('orbat_user'));
    if (fromCookie) {
      localStorage.setItem('orbat_user', JSON.stringify(fromCookie));
      return fromCookie;
    }
    const raw = localStorage.getItem('orbat_user');
    return raw ? (JSON.parse(raw) as BackendUser) : null;
  } catch {
    return null;
  }
}

export function getStoredWorkspace(): BackendWorkspace | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromCookie = parseJsonCookie<BackendWorkspace>(getBrowserCookie('orbat_workspace'));
    if (fromCookie) {
      localStorage.setItem('orbat_workspace', JSON.stringify(fromCookie));
      return fromCookie;
    }
    const raw = localStorage.getItem('orbat_workspace');
    return raw ? (JSON.parse(raw) as BackendWorkspace) : null;
  } catch {
    return null;
  }
}

let inFlightRefresh: Promise<string | null> | null = null;

export async function refreshBackendSession(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        const res = await fetchAuthEndpoint('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            clearAuthSession();
          }
          return null;
        }
        const json = await res.json().catch(() => null);
        const tokens = (json?.data ?? json) as Partial<AuthResponse> | null;
        if (!tokens?.accessToken) return null;
        saveAuthSession({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || refreshToken,
          user: tokens.user || (getStoredUser() as BackendUser),
          workspace: tokens.workspace !== undefined ? tokens.workspace : getStoredWorkspace(),
        });
        return tokens.accessToken;
      } catch {
        return null;
      } finally {
        inFlightRefresh = null;
      }
    })();
  }

  return inFlightRefresh;
}

export class MfaRequiredError extends Error {
  readonly requiresMfa = true;
  constructor(message = 'Enter the 6-digit code from your authenticator app.') {
    super(message);
    this.name = 'MfaRequiredError';
  }
}

export class EmailVerificationRequiredError extends Error {
  readonly emailVerified = false;
  constructor(message = 'Please verify your email address with the 6-digit code before signing in.') {
    super(message);
    this.name = 'EmailVerificationRequiredError';
  }
}

export async function backendLogin(
  email: string,
  password: string,
  totpCode?: string,
): Promise<AuthResponse> {
  const payload: Record<string, string> = {
    email: email.trim().toLowerCase(),
    password,
  };
  if (totpCode && totpCode.trim()) {
    payload.totpCode = totpCode.trim();
  }

  const res = await fetchAuthEndpoint('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const rawMsg = body?.message || body?.error;
    const message = Array.isArray(rawMsg)
      ? rawMsg.join(', ')
      : rawMsg || `Login failed (${res.status}). Please check your credentials and backend connection.`;

    if (body?.requiresMfa === true) {
      throw new MfaRequiredError(message);
    }
    if (body?.emailVerified === false) {
      throw new EmailVerificationRequiredError(message);
    }
    throw new Error(message);
  }

  const data: AuthResponse = body?.data || body;
  saveAuthSession(data);
  return data;
}

export async function backendSignup(
  name: string,
  email: string,
  password: string,
  workspaceName?: string
): Promise<AuthResponse> {
  const res = await fetchAuthEndpoint('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      workspaceName: workspaceName?.trim() || `${name.trim()}'s Workspace`,
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message || `Signup failed (${res.status}). Please try again.`;
    throw new Error(message);
  }

  const data: AuthResponse = body?.data || body;
  saveAuthSession(data);
  return data;
}

export async function backendGoogleAuth(payload: {
  code?: string;
  idToken?: string;
  credential?: string;
  redirectUri?: string;
}): Promise<AuthResponse> {
  const res = await fetchAuthEndpoint('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message || `Google authentication failed (${res.status}).`;
    throw new Error(message);
  }

  const data: AuthResponse = body?.data || body;
  saveAuthSession(data);
  return data;
}

export async function backendGetGoogleUrl(state?: string): Promise<{ configured: boolean; url: string | null; message?: string }> {
  try {
    const query = new URLSearchParams();
    if (typeof window !== 'undefined') {
      query.set('redirectUri', `${window.location.origin}/auth/callback`);
    }
    if (state) {
      query.set('state', state);
    }
    const qs = query.toString();
    const res = await fetchAuthEndpoint(`/auth/google/url${qs ? `?${qs}` : ''}`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      return {
        configured: false,
        url: null,
        message: body?.message || `Backend returned status ${res.status}`,
      };
    }
    return body.data || body;
  } catch (err: unknown) {
    return {
      configured: false,
      url: null,
      message: err instanceof Error ? err.message : 'Failed to load Google OAuth URL.',
    };
  }
}

export async function backendGetMe(): Promise<BackendUser> {
  let token = getAuthToken() || (await refreshBackendSession());
  if (!token) throw new Error('Not authenticated.');

  let res = await fetchAuthEndpoint('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    const refreshed = await refreshBackendSession();
    if (refreshed) {
      token = refreshed;
      res = await fetchAuthEndpoint('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) clearAuthSession();
    throw new Error(body?.message || 'Failed to fetch user profile.');
  }

  const profile = (body?.data || body) as BackendUser & { workspace?: BackendWorkspace | null };
  if (typeof window !== 'undefined' && profile) {
    const existing = getStoredUser();
    const mergedUser: BackendUser = {
      ...(existing || {}),
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      workspaceId: profile.workspaceId,
      avatarUrl: profile.avatarUrl ?? existing?.avatarUrl,
      isSuperAdmin: profile.isSuperAdmin ?? existing?.isSuperAdmin,
    };
    localStorage.setItem('orbat_user', JSON.stringify(mergedUser));
    setBrowserCookie('orbat_user', JSON.stringify(mergedUser), 604800);
  }
  return profile;
}

