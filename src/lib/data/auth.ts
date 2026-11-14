'use client';

import {
  backendGetGoogleUrl,
  backendLogin,
  backendSignup,
  clearAuthSession,
} from '@/lib/api/backend-auth';
import { buildOAuthState, type OAuthAuthMode } from './auth-rules';

/* Sign-in, sign-up and sign-out for the new UI. Everything goes through the
   same NestJS endpoints as the old pages (src/lib/api/backend-auth.ts), which
   store the session in the `orbat_access_token` cookie that the Next server
   and src/proxy.ts read. */

export interface AuthProviders {
  google: boolean;
  /** No backend yet: see docs/design/BACKEND_GAPS.md. */
  microsoft: boolean;
  /** No backend yet: see docs/design/BACKEND_GAPS.md. */
  saml: boolean;
}

/* Google is configured on the NestJS backend (GOOGLE_CLIENT_ID in
   backend/.env), so ask the backend rather than the frontend's own env, which
   is what /api/auth/providers reads. backendGetGoogleUrl never throws. */
export async function getAuthProviders(): Promise<AuthProviders> {
  const google = await backendGetGoogleUrl();
  return { google: Boolean(google.configured && google.url), microsoft: false, saml: false };
}

export async function signIn(email: string, password: string): Promise<void> {
  await backendLogin(email, password);
}

export async function signUp(input: {
  name: string;
  company: string;
  email: string;
  password: string;
}): Promise<void> {
  // The backend creates the account and its workspace in one call.
  await backendSignup(input.name, input.email, input.password, input.company || undefined);
}

/* Sends the browser to Google. Resolves only if Google is not configured. */
export async function startGoogleSignIn(options?: {
  mode?: OAuthAuthMode;
  next?: string;
}): Promise<void> {
  const state = buildOAuthState(options?.mode ?? 'login', options?.next ?? '/app');
  const res = await backendGetGoogleUrl(state);
  if (res.configured && res.url) {
    window.location.href = res.url;
    return new Promise(() => {});
  }
  throw new Error(res.message || 'Google sign-in is not set up for this workspace yet.');
}

/* TODO(backend): there is no password-reset flow (no endpoint that emails a
   reset link, and no page that accepts one). Tracked in BACKEND_GAPS.md. */
export async function requestPasswordReset(email: string): Promise<void> {
  void email;
  throw new Error('Password reset by email isn’t available yet. Ask your workspace owner to reset it for you.');
}

/* TODO(backend): no SAML / SSO support. Tracked in BACKEND_GAPS.md. */
export async function startSso(workspace: string): Promise<void> {
  void workspace;
  throw new Error('Single sign-on isn’t available yet. Sign in with your email or Google instead.');
}

/* Same sign-out as the old dashboard: end the server session (clears the
   httpOnly cookies), then drop the tokens the browser keeps for the NestJS
   backend and its realtime socket. */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'local' }),
    });
  } catch (err) {
    console.error('[Sign Out]:', err);
  }
  clearAuthSession();
}
