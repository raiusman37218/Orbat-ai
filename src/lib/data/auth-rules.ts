/* Pure helpers shared by the sign-in pages (server) and forms (client).
   Kept out of auth.ts, which is client-only. */

/* Only same-site paths, so ?redirect= can't send people to another site. */
export function safeRedirect(raw: string | null | undefined, fallback = '/app'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (raw.includes('://') || raw.includes('@')) return fallback;
  return raw;
}

export type OAuthAuthMode = 'login' | 'signup';

export function buildOAuthState(mode: OAuthAuthMode, next = '/app'): string {
  const params = new URLSearchParams();
  params.set('mode', mode === 'signup' ? 'signup' : 'login');
  params.set('next', safeRedirect(next, '/app'));
  return params.toString();
}

export function parseOAuthState(raw: string | null | undefined): {
  mode: OAuthAuthMode;
  next: string;
} {
  if (!raw || typeof raw !== 'string') {
    return { mode: 'login', next: '/app' };
  }
  const params = new URLSearchParams(raw);
  const mode: OAuthAuthMode = params.get('mode') === 'signup' ? 'signup' : 'login';
  const next = safeRedirect(params.get('next'), '/app');
  return { mode, next };
}

export function authPathForMode(mode: OAuthAuthMode): '/login' | '/signup' {
  return mode === 'signup' ? '/signup' : '/login';
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/* 0–4, matching the four bars in Auth.dc.html. */
export function passwordScore(pw: string): number {
  let score = 0;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}
