import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeBackendBaseUrl,
  normalizeSocketBaseUrl,
  resolveClientBackendBaseUrl,
  resolveServerBackendBaseUrl,
  resolveClientSocketUrl,
} from './backend-url';
import { GET, POST } from '@/app/api/backend/[...path]/route';

describe('backend-url & Vercel proxy routing', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    delete process.env.BACKEND_URL;
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.VERCEL;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it('normalizes trailing slashes, bare hostnames, and /api/v1 suffixes', () => {
    expect(normalizeBackendBaseUrl('https://orbat-api.vercel.app/')).toBe('https://orbat-api.vercel.app/api/v1');
    expect(normalizeBackendBaseUrl('orbat-api.vercel.app')).toBe('https://orbat-api.vercel.app/api/v1');
    expect(normalizeBackendBaseUrl('localhost:4000')).toBe('http://localhost:4000/api/v1');
    expect(normalizeBackendBaseUrl('https://orbat-api.vercel.app/api/v1/')).toBe(
      'https://orbat-api.vercel.app/api/v1',
    );
    expect(normalizeSocketBaseUrl('https://orbat-api.vercel.app/api/v1/')).toBe('https://orbat-api.vercel.app');
    expect(normalizeSocketBaseUrl('/api/backend')).toBeNull();
  });

  it('routes browser requests to same-origin /api/backend proxy on Vercel when NEXT_PUBLIC_BACKEND_URL is missing', () => {
    process.env.VERCEL = '1';
    expect(resolveClientBackendBaseUrl()).toBe('/api/backend/api/v1');
    expect(resolveServerBackendBaseUrl()).toBeNull();
    expect(resolveClientSocketUrl()).toBeNull();
  });

  it('prefers explicit BACKEND_URL on server and NEXT_PUBLIC_SOCKET_URL for realtime', () => {
    process.env.VERCEL = '1';
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api-rest.vercel.app';
    process.env.BACKEND_URL = 'https://internal-api.vercel.app';
    process.env.NEXT_PUBLIC_SOCKET_URL = 'https://ws.orbatai.com/';

    expect(resolveClientBackendBaseUrl()).toBe('https://api-rest.vercel.app/api/v1');
    expect(resolveServerBackendBaseUrl()).toBe('https://internal-api.vercel.app/api/v1');
    expect(resolveClientSocketUrl()).toBe('https://ws.orbatai.com');
  });

  it('/api/backend proxy returns 503 JSON when backend URL is not configured on Vercel', async () => {
    process.env.VERCEL = '1';
    const res = await GET(new Request('https://front.vercel.app/api/backend/health') as any, {
      params: Promise.resolve({ path: ['health'] }),
    });
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('backend_not_configured');
  });

  it('/api/backend proxy strips duplicate /api/v1 and forwards Authorization & JSON body', async () => {
    process.env.BACKEND_URL = 'https://back.vercel.app/';
    const fetchSpy = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchSpy as any;

    const req = new Request('https://front.vercel.app/api/backend/api/v1/auth/login?foo=1', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer tok-123',
      },
      body: JSON.stringify({ email: 'a@b.com' }),
    });

    const res = await POST(req as any, {
      params: Promise.resolve({ path: ['api', 'v1', 'auth', 'login'] }),
    });

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('https://back.vercel.app/api/v1/auth/login?foo=1');
    const forwardedHeaders = fetchSpy.mock.calls[0][1].headers as Headers;
    expect(forwardedHeaders.get('authorization')).toBe('Bearer tok-123');
  });
});

