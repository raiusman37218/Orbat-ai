import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildCorsOptions,
  isOriginAllowed,
  normalizeOriginEntry,
  parseCorsAllowlist,
} from './cors';
import configuration from '../../config/configuration';

describe('Backend CORS allowlist & Vercel configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('normalizes origins by stripping trailing slashes and adding protocol', () => {
    expect(normalizeOriginEntry('https://orbat-web.vercel.app/')).toBe('https://orbat-web.vercel.app');
    expect(normalizeOriginEntry('orbat-web.vercel.app/')).toBe('https://orbat-web.vercel.app');
    expect(normalizeOriginEntry('localhost:3000/')).toBe('http://localhost:3000');
    expect(normalizeOriginEntry('https://*.vercel.app/')).toBe('https://*.vercel.app');
    expect(normalizeOriginEntry('*')).toBeNull();
  });

  it('matches exact, trailing-slash, and wildcard subdomain Vercel origins safely', () => {
    const allowlist = parseCorsAllowlist({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://orbat-front.vercel.app/, https://*.orbatai.com',
      FRONTEND_URL: 'https://preview.example.com',
    });

    expect(isOriginAllowed(undefined, allowlist)).toBe(true);
    expect(isOriginAllowed('https://orbat-front.vercel.app', allowlist)).toBe(true);
    expect(isOriginAllowed('https://preview.example.com', allowlist)).toBe(true);
    expect(isOriginAllowed('https://app.orbatai.com', allowlist)).toBe(true);
    expect(isOriginAllowed('https://sub.app.orbatai.com', allowlist)).toBe(true);

    // Must never allow base domain spoof or mismatched scheme
    expect(isOriginAllowed('https://evil-orbatai.com', allowlist)).toBe(false);
    expect(isOriginAllowed('http://app.orbatai.com', allowlist)).toBe(false);
    expect(isOriginAllowed('https://evil.vercel.app', allowlist)).toBe(false);
  });

  it('fails closed in production when CORS_ORIGIN is wildcard "*" without explicit origins', () => {
    const { origin } = buildCorsOptions({
      NODE_ENV: 'production',
      CORS_ORIGIN: '*',
    });

    let allowed: boolean | undefined;
    origin('https://attacker.com', (_err, result) => {
      allowed = result;
    });
    expect(allowed).toBe(false);
  });

  it('falls back JWT_REFRESH_SECRET to JWT_SECRET and omits Redis URL on Vercel when unset', () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6_valid_secret';
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.REDIS_URL;
    process.env.FRONTEND_URL = 'https://orbat-front.vercel.app/';

    const cfg = configuration();
    expect(cfg.isVercel).toBe(true);
    expect(cfg.database.maxPoolSize).toBe(5);
    expect(cfg.jwt.refreshSecret).toBe(process.env.JWT_SECRET);
    expect(cfg.redis.url).toBeUndefined();
    expect(cfg.google.callbackUrl).toBe('https://orbat-front.vercel.app/auth/callback');
  });
});

