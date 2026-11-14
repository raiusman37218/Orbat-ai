import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, resolveBaseUrl, sanitizeNextPath } from './route';

const fakeAuthState = vi.hoisted(() => ({
  workspaceId: 'ws-123' as string | null,
}));

describe('M-7 Auth Callback Security', () => {
  const origEnv = process.env.NEXT_PUBLIC_PLATFORM_HOSTS;
  let fetchSpy: { mockRestore: () => void } | undefined;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_PLATFORM_HOSTS = 'app.zentry.com,zentry.com';
    fakeAuthState.workspaceId = 'ws-123';
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          data: {
            accessToken: 'jwt-access-token',
            refreshToken: 'jwt-refresh-token',
            user: {
              id: 'user-123',
              email: 'agent@example.com',
              name: 'Agent',
              role: 'owner',
              workspaceId: fakeAuthState.workspaceId,
            },
            workspace: fakeAuthState.workspaceId ? { id: fakeAuthState.workspaceId, name: 'Test WS' } : null,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    process.env.NEXT_PUBLIC_PLATFORM_HOSTS = origEnv;
  });

  describe('sanitizeNextPath', () => {
    it('accepts valid relative paths', () => {
      expect(sanitizeNextPath('/app')).toBe('/app');
      expect(sanitizeNextPath('/app/inbox')).toBe('/app/inbox');
      expect(sanitizeNextPath('/tickets/123?sort=asc')).toBe('/tickets/123?sort=asc');
      expect(sanitizeNextPath('/')).toBe('/');
    });

    it('rejects paths starting with // or /\\ (protocol-relative and Windows separator)', () => {
      expect(sanitizeNextPath('//evil.com')).toBe('/app');
      expect(sanitizeNextPath('///evil.com')).toBe('/app');
      expect(sanitizeNextPath('/\\evil.com')).toBe('/app');
      expect(sanitizeNextPath('/\\\\evil.com')).toBe('/app');
    });

    it('rejects paths containing ://', () => {
      expect(sanitizeNextPath('https://evil.com')).toBe('/app');
      expect(sanitizeNextPath('http://evil.com')).toBe('/app');
      expect(sanitizeNextPath('/redirect?target=https://evil.com')).toBe('/app');
      expect(sanitizeNextPath('/path://test')).toBe('/app');
    });

    it('rejects paths containing @', () => {
      expect(sanitizeNextPath('/@attacker')).toBe('/app');
      expect(sanitizeNextPath('/foo@evil.com')).toBe('/app');
      expect(sanitizeNextPath('/test?email=user@example.com')).toBe('/app');
    });

    it('rejects non-slash paths and empty/null/undefined values', () => {
      expect(sanitizeNextPath('javascript:alert(1)')).toBe('/app');
      expect(sanitizeNextPath('app')).toBe('/app');
      expect(sanitizeNextPath('')).toBe('/app');
      expect(sanitizeNextPath(null)).toBe('/app');
      expect(sanitizeNextPath(undefined)).toBe('/app');
    });
  });

  describe('resolveBaseUrl', () => {
    it('uses x-forwarded-host if listed in NEXT_PUBLIC_PLATFORM_HOSTS', () => {
      const req = new Request('http://internal-gateway:8080/auth/callback', {
        headers: { 'x-forwarded-host': 'app.zentry.com' },
      });
      expect(resolveBaseUrl(req, 'http://internal-gateway:8080')).toBe('https://app.zentry.com');
    });

    it('is case-insensitive for allowed host matching', () => {
      const req = new Request('http://internal-gateway:8080/auth/callback', {
        headers: { 'x-forwarded-host': 'APP.ZENTRY.COM' },
      });
      expect(resolveBaseUrl(req, 'http://internal-gateway:8080')).toBe('https://APP.ZENTRY.COM');
    });

    it('falls back to request origin if x-forwarded-host is not listed', () => {
      const req = new Request('https://original-site.com/auth/callback', {
        headers: { 'x-forwarded-host': 'evil-attacker.com' },
      });
      expect(resolveBaseUrl(req, 'https://original-site.com')).toBe('https://original-site.com');
    });

    it('falls back to request origin if x-forwarded-host is missing', () => {
      const req = new Request('https://original-site.com/auth/callback');
      expect(resolveBaseUrl(req, 'https://original-site.com')).toBe('https://original-site.com');
    });

    it('falls back to request origin if NEXT_PUBLIC_PLATFORM_HOSTS is empty', () => {
      process.env.NEXT_PUBLIC_PLATFORM_HOSTS = '';
      const req = new Request('https://original-site.com/auth/callback', {
        headers: { 'x-forwarded-host': 'app.zentry.com' },
      });
      expect(resolveBaseUrl(req, 'https://original-site.com')).toBe('https://original-site.com');
    });
  });

  describe('GET route handler', () => {
    it('defaults successful Google auth to /app (not legacy /dashboard)', async () => {
      const req = new Request('https://app.zentry.com/auth/callback?code=valid_code', {
        headers: { 'x-forwarded-host': 'app.zentry.com' },
      });
      const res = await GET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.zentry.com/app');
    });

    it('redirects to safe next path with allowed host', async () => {
      const req = new Request(
        'https://app.zentry.com/auth/callback?code=valid_code&next=/tickets/456',
        {
          headers: { 'x-forwarded-host': 'app.zentry.com' },
        }
      );
      const res = await GET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.zentry.com/tickets/456');
    });

    it('honors next carried inside Google OAuth state when explicit next is omitted', async () => {
      const state = encodeURIComponent('mode=signup&next=%2Fapp%2Finbox');
      const req = new Request(
        `https://app.zentry.com/auth/callback?code=valid_code&state=${state}`,
        {
          headers: { 'x-forwarded-host': 'app.zentry.com' },
        }
      );
      const res = await GET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.zentry.com/app/inbox');
    });

    it('routes Google signup OAuth error back to /signup instead of /login', async () => {
      const state = encodeURIComponent('mode=signup&next=%2Fapp');
      const req = new Request(
        `https://app.zentry.com/auth/callback?error=access_denied&state=${state}`,
        {
          headers: { 'x-forwarded-host': 'app.zentry.com' },
        }
      );
      const res = await GET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.zentry.com/signup?error=access_denied');
    });

    it('sanitizes open-redirect next parameter to /app', async () => {
      const req = new Request(
        'https://app.zentry.com/auth/callback?code=valid_code&next=//evil.com',
        {
          headers: { 'x-forwarded-host': 'app.zentry.com' },
        }
      );
      const res = await GET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.zentry.com/app');
    });

    it('rejects unlisted forwarded host and falls back to origin', async () => {
      const req = new Request(
        'https://app.zentry.com/auth/callback?code=valid_code&next=/app',
        {
          headers: { 'x-forwarded-host': 'evil.com' },
        }
      );
      const res = await GET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.zentry.com/app');
    });
  });
});
