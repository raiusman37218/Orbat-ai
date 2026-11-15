/**
 * Helpers for resolving and normalizing the separate Backend API & Socket.IO URLs
 * across Vercel client bundles, Next.js server routes, and local development.
 */

const LOCAL_DEFAULT_BACKEND_URL = 'http://localhost:4000/api/v1';
const LOCAL_DEFAULT_SOCKET_URL = 'http://localhost:4000';

function normalizeOriginOrUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const isLocal = /^((localhost|127\.0\.0\.1)(:\d+)?(\/|$))/i.test(trimmed);
  return `${isLocal ? 'http' : 'https'}://${trimmed}`;
}

export function isLocalhostUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url.trim());
}

function isNonLocalBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return Boolean(host && host !== 'localhost' && host !== '127.0.0.1');
}

function isProductionOrVercelServer(): boolean {
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
  return isVercel || process.env.NODE_ENV === 'production';
}

export function normalizeBackendBaseUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const normalized = normalizeOriginOrUrl(raw);
  if (!normalized) return null;
  return /\/api\/v1$/i.test(normalized) ? normalized : `${normalized}/api/v1`;
}

export function normalizeSocketBaseUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const normalized = normalizeOriginOrUrl(raw);
  if (!normalized || normalized.startsWith('/')) return null;
  return normalized.replace(/\/api\/v1$/i, '').replace(/\/+$/, '');
}

/**
 * Browser-safe Backend REST API base URL (`.../api/v1`).
 * When deployed on a non-localhost domain without NEXT_PUBLIC_BACKEND_URL baked in
 * (or when NEXT_PUBLIC_BACKEND_URL was accidentally left as localhost from .env.local),
 * routes through `/api/backend/api/v1` so built-in Next.js handlers or server-side BACKEND_URL work.
 */
export function resolveClientBackendBaseUrl(): string {
  const nonLocal = isNonLocalBrowser() || isProductionOrVercelServer();
  const configured = normalizeBackendBaseUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
  if (configured && !(nonLocal && isLocalhostUrl(configured))) {
    return configured;
  }

  if (nonLocal) {
    return '/api/backend/api/v1';
  }

  return LOCAL_DEFAULT_BACKEND_URL;
}

/**
 * Server-side Backend REST API base URL (`.../api/v1`).
 * Checks runtime `BACKEND_URL` first, then `NEXT_PUBLIC_BACKEND_URL`.
 * Returns `null` on Vercel/production when unconfigured or left as localhost
 * so callers immediately use the built-in Next.js database fallback instead of failing on localhost:4000.
 */
export function resolveServerBackendBaseUrl(): string | null {
  const isProdOrVercel = isProductionOrVercelServer();
  const configured = normalizeBackendBaseUrl(
    process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL,
  );
  if (configured && !(isProdOrVercel && isLocalhostUrl(configured))) {
    return configured;
  }

  if (isProdOrVercel) {
    return null;
  }

  return LOCAL_DEFAULT_BACKEND_URL;
}

/**
 * Client Socket.IO base URL (without `/api/v1`).
 * Returns `null` in production when no Socket/Backend URL is configured or when left as localhost.
 */
export function resolveClientSocketUrl(): string | null {
  const nonLocal = isNonLocalBrowser() || isProductionOrVercelServer();
  const configured = normalizeSocketBaseUrl(
    process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_BACKEND_URL,
  );
  if (configured && !(nonLocal && isLocalhostUrl(configured))) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return LOCAL_DEFAULT_SOCKET_URL;
    }
    return null;
  }

  return isProdOrVercelFallback();
}

function isProdOrVercelFallback(): string | null {
  return isProductionOrVercelServer() ? null : LOCAL_DEFAULT_SOCKET_URL;
}
