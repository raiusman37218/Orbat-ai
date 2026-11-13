import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryRows: vi.fn(),
}));

import {
  base32Decode,
  base32Encode,
  buildOtpAuthUri,
  generateTotpSecret,
  generateTotpToken,
  sealTotpSecret,
  unsealTotpSecret,
  verifyTotpCode,
} from './postgres-auth';

describe('postgres-auth TOTP helpers', () => {
  const originalJwt = process.env.JWT_SECRET;
  const originalChannelKey = process.env.CHANNEL_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-totp';
    delete process.env.CHANNEL_ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwt;
    if (originalChannelKey) process.env.CHANNEL_ENCRYPTION_KEY = originalChannelKey;
    else delete process.env.CHANNEL_ENCRYPTION_KEY;
  });

  it('matches RFC 6238 SHA-1 6-digit test vector at T=59s', () => {
    // RFC 6238 ASCII secret "12345678901234567890" -> expected TOTP at t=59s (step=30): 287082
    const secret = base32Encode(Buffer.from('12345678901234567890', 'ascii'));
    expect(base32Decode(secret).toString('ascii')).toBe('12345678901234567890');
    expect(generateTotpToken(secret, 59_000, 30, 6)).toBe('287082');
    expect(verifyTotpCode(secret, '287082', 1, 59_000)).toBe(true);
    expect(verifyTotpCode(secret, '287082', 1, 89_000)).toBe(true); // +1 window allowed
    expect(verifyTotpCode(secret, '000000', 1, 59_000)).toBe(false);
  });

  it('generates valid secrets, otpauth URIs, and verifies live tokens', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const uri = buildOtpAuthUri({ secret, email: 'agent@orbat.ai' });
    expect(uri).toContain('otpauth://totp/Orbat%20AI%3Aagent%40orbat.ai');
    expect(uri).toContain(`secret=${secret}`);

    const now = Date.now();
    const token = generateTotpToken(secret, now);
    expect(verifyTotpCode(secret, token, 1, now)).toBe(true);
    expect(verifyTotpCode(secret, '12345', 1, now)).toBe(false);
  });

  it('seals and unseals TOTP secrets with CHANNEL_ENCRYPTION_KEY or JWT_SECRET fallback', () => {
    const secret = generateTotpSecret();
    const sealedJwt = sealTotpSecret(secret);
    expect(sealedJwt.startsWith('v2jwt:')).toBe(true);
    expect(unsealTotpSecret(sealedJwt)).toBe(secret);

    process.env.CHANNEL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    const sealedChannel = sealTotpSecret(secret);
    expect(sealedChannel.startsWith('v1:')).toBe(true);
    expect(unsealTotpSecret(sealedChannel)).toBe(secret);
  });
});

