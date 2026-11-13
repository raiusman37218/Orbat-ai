"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const cors_1 = require("./cors");
const configuration_1 = require("../../config/configuration");
(0, vitest_1.describe)('Backend CORS allowlist & Vercel configuration', () => {
    const originalEnv = { ...process.env };
    (0, vitest_1.beforeEach)(() => {
        process.env = { ...originalEnv };
    });
    (0, vitest_1.afterEach)(() => {
        process.env = originalEnv;
    });
    (0, vitest_1.it)('normalizes origins by stripping trailing slashes and adding protocol', () => {
        (0, vitest_1.expect)((0, cors_1.normalizeOriginEntry)('https://orbat-web.vercel.app/')).toBe('https://orbat-web.vercel.app');
        (0, vitest_1.expect)((0, cors_1.normalizeOriginEntry)('orbat-web.vercel.app/')).toBe('https://orbat-web.vercel.app');
        (0, vitest_1.expect)((0, cors_1.normalizeOriginEntry)('localhost:3000/')).toBe('http://localhost:3000');
        (0, vitest_1.expect)((0, cors_1.normalizeOriginEntry)('https://*.vercel.app/')).toBe('https://*.vercel.app');
        (0, vitest_1.expect)((0, cors_1.normalizeOriginEntry)('*')).toBeNull();
    });
    (0, vitest_1.it)('matches exact, trailing-slash, and wildcard subdomain Vercel origins safely', () => {
        const allowlist = (0, cors_1.parseCorsAllowlist)({
            NODE_ENV: 'production',
            CORS_ORIGIN: 'https://orbat-front.vercel.app/, https://*.orbatai.com',
            FRONTEND_URL: 'https://preview.example.com',
        });
        (0, vitest_1.expect)((0, cors_1.isOriginAllowed)(undefined, allowlist)).toBe(true);
        (0, vitest_1.expect)((0, cors_1.isOriginAllowed)('https://orbat-front.vercel.app', allowlist)).toBe(true);
        (0, vitest_1.expect)((0, cors_1.isOriginAllowed)('https://preview.example.com', allowlist)).toBe(true);
        (0, vitest_1.expect)((0, cors_1.isOriginAllowed)('https://app.orbatai.com', allowlist)).toBe(true);
        (0, vitest_1.expect)((0, cors_1.isOriginAllowed)('https://sub.app.orbatai.com', allowlist)).toBe(true);
        (0, vitest_1.expect)((0, cors_1.isOriginAllowed)('https://evil-orbatai.com', allowlist)).toBe(false);
        (0, vitest_1.expect)((0, cors_1.isOriginAllowed)('http://app.orbatai.com', allowlist)).toBe(false);
        (0, vitest_1.expect)((0, cors_1.isOriginAllowed)('https://evil.vercel.app', allowlist)).toBe(false);
    });
    (0, vitest_1.it)('fails closed in production when CORS_ORIGIN is wildcard "*" without explicit origins', () => {
        const { origin } = (0, cors_1.buildCorsOptions)({
            NODE_ENV: 'production',
            CORS_ORIGIN: '*',
        });
        let allowed;
        origin('https://attacker.com', (_err, result) => {
            allowed = result;
        });
        (0, vitest_1.expect)(allowed).toBe(false);
    });
    (0, vitest_1.it)('falls back JWT_REFRESH_SECRET to JWT_SECRET and omits Redis URL on Vercel when unset', () => {
        process.env.NODE_ENV = 'production';
        process.env.VERCEL = '1';
        process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6_valid_secret';
        delete process.env.JWT_REFRESH_SECRET;
        delete process.env.REDIS_URL;
        process.env.FRONTEND_URL = 'https://orbat-front.vercel.app/';
        const cfg = (0, configuration_1.default)();
        (0, vitest_1.expect)(cfg.isVercel).toBe(true);
        (0, vitest_1.expect)(cfg.database.maxPoolSize).toBe(5);
        (0, vitest_1.expect)(cfg.jwt.refreshSecret).toBe(process.env.JWT_SECRET);
        (0, vitest_1.expect)(cfg.redis.url).toBeUndefined();
        (0, vitest_1.expect)(cfg.google.callbackUrl).toBe('https://orbat-front.vercel.app/auth/callback');
    });
});
//# sourceMappingURL=cors.spec.js.map