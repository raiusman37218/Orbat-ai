/**
 * Pure URL sanitization and base-origin resolution helpers for OAuth callbacks.
 */

export function sanitizeNextPath(raw: string | null | undefined, fallback = '/app'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return fallback;
  }
  if (raw.includes('://') || raw.includes('@')) {
    return fallback;
  }
  return raw;
}

/**
 * Resolves the base URL for redirects.
 * Uses `x-forwarded-host` only if it is listed in `NEXT_PUBLIC_PLATFORM_HOSTS`
 * (comma-separated); otherwise uses the request origin.
 */
export function resolveBaseUrl(request: Request, origin: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const allowedHosts = (process.env.NEXT_PUBLIC_PLATFORM_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    const host = forwardedHost.trim().toLowerCase();
    if (allowedHosts.includes(host)) {
      return `https://${forwardedHost.trim()}`;
    }
  }
  const isInternalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(origin);
  const configuredAppUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  if (isInternalOrigin && /^https?:\/\//i.test(configuredAppUrl)) {
    return configuredAppUrl;
  }
  return origin;
}
