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
 * When deployed on a non-localhost domain without NEXT_PUBLIC_BACKEND_URL baked in,
 * routes through `/api/backend/api/v1` so server-side `BACKEND_URL` or clear error reporting works.
 */
export function resolveClientBackendBaseUrl(): string {
  const configured = normalizeBackendBaseUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
  if (configured) return configured;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return '/api/backend/api/v1';
    }
  }

  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
    return '/api/backend/api/v1';
  }

  return LOCAL_DEFAULT_BACKEND_URL;
}

/**
 * Server-side Backend REST API base URL (`.../api/v1`).
 * Checks runtime `BACKEND_URL` first, then `NEXT_PUBLIC_BACKEND_URL`.
 * Returns `null` on Vercel/production when unconfigured so callers never stall on `localhost:4000`.
 */
export function resolveServerBackendBaseUrl(): string | null {
  const configured = normalizeBackendBaseUrl(
    process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL,
  );
  if (configured) return configured;

  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
  if (isVercel || process.env.NODE_ENV === 'production') {
    return null;
  }

  return LOCAL_DEFAULT_BACKEND_URL;
}

/**
 * Client Socket.IO base URL (without `/api/v1`).
 * Returns `null` in production when no Socket/Backend URL is configured.
 */
export function resolveClientSocketUrl(): string | null {
  const configured = normalizeSocketBaseUrl(
    process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_BACKEND_URL,
  );
  if (configured) return configured;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return LOCAL_DEFAULT_SOCKET_URL;
    }
    return null;
  }

  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
    ? null
    : LOCAL_DEFAULT_SOCKET_URL;
}

