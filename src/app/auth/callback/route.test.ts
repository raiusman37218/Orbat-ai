import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, resolveBaseUrl, sanitizeNextPath } from './route';

const fakeAuthState = vi.hoisted(() => ({
  workspaceId: 'ws-123' as string | null,
}));

describe('M-7 Auth Callback Security', () => {
  const origEnv = process.env.NEXT_PUBLIC_PLATFORM_HOSTS;
  let fetchSpy: any;

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
      expect(sanitizeNextPath('/dashboard')).toBe('/dashboard');
      expect(sanitizeNextPath('/settings/team')).toBe('/settings/team');
      expect(sanitizeNextPath('/tickets/123?sort=asc')).toBe('/tickets/123?sort=asc');
      expect(sanitizeNextPath('/')).toBe('/');
    });

    it('rejects paths starting with // or /\\ (protocol-relative and Windows separator)', () => {
      expect(sanitizeNextPath('//evil.com')).toBe('/dashboard');
      expect(sanitizeNextPath('///evil.com')).toBe('/dashboard');
      expect(sanitizeNextPath('/\\evil.com')).toBe('/dashboard');
      expect(sanitizeNextPath('/\\\\evil.com')).toBe('/dashboard');
    });

    it('rejects paths containing ://', () => {
      expect(sanitizeNextPath('https://evil.com')).toBe('/dashboard');
      expect(sanitizeNextPath('http://evil.com')).toBe('/dashboard');
      expect(sanitizeNextPath('/redirect?target=https://evil.com')).toBe('/dashboard');
      expect(sanitizeNextPath('/path://test')).toBe('/dashboard');
    });

    it('rejects paths containing @', () => {
      expect(sanitizeNextPath('/@attacker')).toBe('/dashboard');
      expect(sanitizeNextPath('/foo@evil.com')).toBe('/dashboard');
      expect(sanitizeNextPath('/test?email=user@example.com')).toBe('/dashboard');
    });

    it('rejects non-slash paths and empty/null/undefined values', () => {
      expect(sanitizeNextPath('javascript:alert(1)')).toBe('/dashboard');
      expect(sanitizeNextPath('dashboard')).toBe('/dashboard');
      expect(sanitizeNextPath('')).toBe('/dashboard');
      expect(sanitizeNextPath(null)).toBe('/dashboard');
      expect(sanitizeNextPath(undefined)).toBe('/dashboard');
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

    it('sanitizes open-redirect next parameter to /dashboard', async () => {
      const req = new Request(
        'https://app.zentry.com/auth/callback?code=valid_code&next=//evil.com',
        {
          headers: { 'x-forwarded-host': 'app.zentry.com' },
        }
      );
      const res = await GET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.zentry.com/dashboard');
    });

    it('rejects unlisted forwarded host and falls back to origin', async () => {
      const req = new Request(
        'https://app.zentry.com/auth/callback?code=valid_code&next=/dashboard',
        {
          headers: { 'x-forwarded-host': 'evil.com' },
        }
      );
      const res = await GET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.zentry.com/dashboard');
    });
  });
});
