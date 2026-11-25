/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completePasswordResetAction,
  getSignupVerificationRequirementAction,
  requestPasswordResetAction,
  sendSignupVerificationCodeAction,
  verifySignupCodeAction,
} from './auth-verification';
import {
  generate6DigitCode,
  timingSafeCodeCheck,
} from '@/lib/auth/verification-code';

vi.mock('server-only', () => ({}));

// Mock dependencies
const mockServiceClient = vi.fn();
const mockSendSmtpEmail = vi.fn();
const mockLoadWorkspaceSmtp = vi.fn();
const mockSessionUser = vi.fn();
const mockGetRequestOrigin = vi.fn();
const mockBumpAgentTokenVersion = vi.fn();
const dbBridge = {
  query: null as any,
  queryRows: null as any,
};
const authBridge = {
  getUsers: (): any[] => [],
  updateUserById: null as any,
  createUser: null as any,
};

vi.mock('@/lib/db', () => ({
  query: (...args: any[]) => dbBridge.query(...args),
  queryRows: (...args: any[]) => dbBridge.queryRows(...args),
}));

vi.mock('@/lib/pg/service', () => ({
  serviceClient: () => mockServiceClient(),
}));

vi.mock('@/lib/auth/postgres-auth', () => ({
  findPgAuthUserByEmail: async (email: string) => {
    const clean = email.trim().toLowerCase();
    return authBridge.getUsers().find((u) => u.email.toLowerCase() === clean) || null;
  },
  findPgAuthUserById: async (id: string) =>
    authBridge.getUsers().find((u) => u.id === id) || null,
  createPgAuthUser: async (attrs: any) => authBridge.createUser(attrs),
  updatePgAuthUser: async (id: string, attrs: any) => authBridge.updateUserById(id, attrs),
  bumpAgentTokenVersion: (...args: any[]) => mockBumpAgentTokenVersion(...args),
}));

vi.mock('@/lib/auth/session-user', () => ({
  sessionUser: (...args: any[]) => mockSessionUser(...args),
}));

vi.mock('@/lib/request-origin', () => ({
  getRequestOrigin: (...args: any[]) => mockGetRequestOrigin(...args),
}));

vi.mock('@/lib/email/workspace-smtp', () => ({
  isSmtpReady: (smtp: any) => Boolean(smtp?.enabled && smtp?.host && smtp?.user && smtp?.pass),
  loadWorkspaceSmtp: (...args: any[]) => mockLoadWorkspaceSmtp(...args),
}));

vi.mock('@/lib/email/smtp', () => ({
  isValidEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  sendSmtpEmail: (...args: any[]) => mockSendSmtpEmail(...args),
  verificationCodeEmail: vi.fn(() => ({
    subject: 'Verification Code',
    html: '<p>Code</p>',
    text: 'Code',
  })),
  passwordResetEmail: vi.fn(({ resetUrl }: { resetUrl: string }) => ({
    subject: 'Reset your Orbat AI password',
    html: `<p><a href="${resetUrl}">Reset password</a></p>`,
    text: `Reset URL: ${resetUrl}`,
  })),
}));

describe('auth-verification action suite', () => {
  let fakeUsers: any[] = [];
  let fakeAgents: any[] = [];
  let fakeVerifications: any[] = [];
  let fakeResetTokens: any[] = [];
  let fakePlatformSettings: any;
  let fakeWorkspaces: any[] = [];
  let updateUserByIdSpy: any;
  let createUserSpy: any;
  const origNodeEnv = process.env.NODE_ENV;
  const origDemoPreview = process.env.ORBAT_DEMO_AUTH_PREVIEW;
  const origRequireEmail = process.env.PLATFORM_REQUIRE_EMAIL_VERIFICATION;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeUsers = [];
    fakeAgents = [];
    fakeVerifications = [];
    fakeResetTokens = [];
    fakeWorkspaces = [];
    fakePlatformSettings = {
      platform_name: 'Orbat AI',
      smtp_settings: {
        host: 'smtp.test.com',
        port: 587,
        user: 'support@test.com',
        pass: 'secret',
        enabled: true,
      },
      default_features: {},
    };

    mockGetRequestOrigin.mockResolvedValue('https://app.orbatai.test');
    mockLoadWorkspaceSmtp.mockResolvedValue(null);
    mockSessionUser.mockResolvedValue(null);
    mockBumpAgentTokenVersion.mockImplementation(async (agentId: string) => {
      const ag = fakeAgents.find((a) => a.id === agentId);
      if (ag) ag.token_version = (ag.token_version || 1) + 1;
      return ag?.token_version || 2;
    });

    dbBridge.queryRows = vi.fn(async (sql: string, params: any[] = []) => {
      if (sql.includes('FROM public.agents') && sql.includes('WHERE LOWER(email)')) {
        const clean = String(params[0] || '').toLowerCase();
        return fakeAgents.filter((a) => a.email.toLowerCase() === clean).slice(0, 1);
      }
      if (sql.includes('FROM public.workspaces WHERE id = $1')) {
        const ws = fakeWorkspaces.find((w) => w.id === params[0]);
        return ws ? [ws] : [];
      }
      if (sql.includes('COUNT(*)::text AS cnt') && sql.includes('FROM public.password_reset_tokens')) {
        const clean = String(params[0] || '').toLowerCase();
        const cutoff = Date.now() - 60 * 60 * 1000;
        const cnt = fakeResetTokens.filter(
          (r) => r.email.toLowerCase() === clean && new Date(r.created_at).getTime() >= cutoff,
        ).length;
        return [{ cnt: String(cnt) }];
      }
      if (
        sql.includes('UPDATE public.password_reset_tokens') &&
        sql.includes('RETURNING id, user_id, email')
      ) {
        const hash = params[0];
        const now = Date.now();
        const row = fakeResetTokens.find(
          (r) => r.token_hash === hash && r.used_at === null && new Date(r.expires_at).getTime() > now,
        );
        if (!row) return [];
        row.used_at = new Date().toISOString();
        return [{ id: row.id, user_id: row.user_id, email: row.email }];
      }
      if (sql.includes('SELECT used_at, expires_at') && sql.includes('FROM public.password_reset_tokens')) {
        const row = fakeResetTokens.find((r) => r.token_hash === params[0]);
        return row ? [{ used_at: row.used_at, expires_at: row.expires_at }] : [];
      }
      return [];
    });

    dbBridge.query = vi.fn(async (sql: string, params: any[] = []) => {
      if (sql.includes('UPDATE public.password_reset_tokens') && sql.includes('AND used_at IS NULL')) {
        const [userId, cleanEmail] = params;
        const nowIso = new Date().toISOString();
        for (const r of fakeResetTokens) {
          if ((r.user_id === userId || r.email.toLowerCase() === String(cleanEmail).toLowerCase()) && !r.used_at) {
            r.used_at = nowIso;
          }
        }
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO public.password_reset_tokens')) {
        const [userId, email, tokenHash, expiresAt] = params;
        fakeResetTokens.push({
          id: 'prt-' + (fakeResetTokens.length + 1),
          user_id: userId,
          email,
          token_hash: tokenHash,
          expires_at: expiresAt,
          used_at: null,
          created_at: new Date().toISOString(),
        });
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('UPDATE public.agents') && sql.includes('SET password_hash = $1')) {
        const [hash, id, email] = params;
        for (const ag of fakeAgents) {
          if (ag.id === id || ag.email.toLowerCase() === String(email || '').toLowerCase()) {
            ag.password_hash = hash;
            ag.email_verified = true;
          }
        }
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('UPDATE public.agents') && sql.includes('token_version =')) {
        const [email, excludeId] = params;
        for (const ag of fakeAgents) {
          if (ag.email.toLowerCase() === String(email || '').toLowerCase() && ag.id !== excludeId) {
            ag.token_version = (ag.token_version || 1) + 1;
          }
        }
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    updateUserByIdSpy = vi.fn(async (id: string, attrs: any) => {
      const u = fakeUsers.find((x) => x.id === id);
      const nextHash = attrs?.password ? await bcrypt.hash(attrs.password, 4) : undefined;
      if (u) {
        Object.assign(u, attrs);
        if (nextHash) u.password_hash = nextHash;
      }
      const ag = fakeAgents.find((x) => x.id === id);
      if (ag && nextHash) {
        ag.password_hash = nextHash;
      }
      return { data: { user: u }, error: null };
    });

    createUserSpy = vi.fn(async (attrs: any) => {
      const exists = fakeUsers.find((x) => x.email.toLowerCase() === attrs.email.toLowerCase());
      if (exists) {
        return { data: null, error: { message: 'User already registered' } };
      }
      const newUser = { id: 'user-' + Math.random(), ...attrs };
      fakeUsers.push(newUser);
      return { data: { user: newUser }, error: null };
    });

    authBridge.getUsers = () => fakeUsers;
    authBridge.updateUserById = updateUserByIdSpy;
    authBridge.createUser = createUserSpy;

    // Mock PG service client
    mockServiceClient.mockReturnValue({
      auth: {
        admin: {
          listUsers: vi.fn(async ({ page = 1, perPage = 1000 } = {}) => {
            const start = (page - 1) * perPage;
            const users = fakeUsers.slice(start, start + perPage);
            return { data: { users }, error: null };
          }),
          updateUserById: updateUserByIdSpy,
          createUser: createUserSpy,
        },
      },
      from: vi.fn((table: string) => {
        if (table === 'email_verifications') {
          return {
            select: vi.fn(() => {
              let rows = [...fakeVerifications];
              const queryObj: any = {
                eq: vi.fn((col: string, val: any) => {
                  rows = rows.filter((r) => r[col] === val);
                  return queryObj;
                }),
                gte: vi.fn((col: string, val: any) => {
                  rows = rows.filter((r) => new Date(r[col]).getTime() >= new Date(val).getTime());
                  return queryObj;
                }),
                gt: vi.fn((col: string, val: any) => {
                  rows = rows.filter((r) => new Date(r[col]).getTime() > new Date(val).getTime());
                  return queryObj;
                }),
                order: vi.fn((col: string, { ascending }: { ascending: boolean }) => {
                  rows.sort((a, b) => {
                    const diff = new Date(a[col]).getTime() - new Date(b[col]).getTime();
                    return ascending ? diff : -diff;
                  });
                  return queryObj;
                }),
                limit: vi.fn((n: number) => {
                  rows = rows.slice(0, n);
                  return queryObj;
                }),
                maybeSingle: vi.fn(async () => ({
                  data: rows[0] || null,
                  error: null,
                })),
                then: (resolve: any) => resolve({ data: rows, error: null }),
              };
              return queryObj;
            }),
            insert: vi.fn(async (row: any) => {
              const newRecord = {
                id: 'ev-' + Math.random(),
                created_at: new Date().toISOString(),
                attempts: 0,
                locked_until: null,
                ...row,
              };
              fakeVerifications.push(newRecord);
              return { data: newRecord, error: null };
            }),
            update: vi.fn((updates: any) => ({
              eq: vi.fn(async (col: string, val: any) => {
                const targets = fakeVerifications.filter((r) => r[col] === val);
                targets.forEach((r) => Object.assign(r, updates));
                return { data: targets, error: null };
              }),
            })),
            delete: vi.fn(() => {
              const delObj: any = {
                eq: vi.fn((col: string, val: any) => {
                  fakeVerifications = fakeVerifications.filter((r) => r[col] !== val);
                  return delObj;
                }),
                lt: vi.fn((col: string, val: any) => {
                  fakeVerifications = fakeVerifications.filter(
                    (r) => new Date(r[col]).getTime() >= new Date(val).getTime(),
                  );
                  return delObj;
                }),
                then: (resolve: any) => resolve({ error: null }),
              };
              return delObj;
            }),
          };
        }

        if (table === 'platform_settings') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: fakePlatformSettings,
                  error: null,
                })),
              })),
            })),
          };
        }

        return {} as any;
      }),
      rpc: vi.fn(async () => ({ data: true, error: null })),
    });

    mockSendSmtpEmail.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.stubEnv('NODE_ENV', origNodeEnv || 'test');
    process.env.ORBAT_DEMO_AUTH_PREVIEW = origDemoPreview;
    process.env.PLATFORM_REQUIRE_EMAIL_VERIFICATION = origRequireEmail;
  });

  // 1. Code is 6 digits
  it('generates a 6-digit code with crypto.randomInt', () => {
    for (let i = 0; i < 50; i++) {
      const code = generate6DigitCode();
      expect(code).toMatch(/^\d{6}$/);
      const num = parseInt(code, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThan(1000000);
    }
  });

  // 2. Existing account handling:
  // Unconfirmed account sends code and never calls updateUserById with password or createUser.
  it('resend / send for an unconfirmed account sends a code and never calls updateUserById with a password', async () => {
    fakeUsers.push({
      id: 'existing-unconfirmed-id',
      email: 'agent@victim.test',
      email_confirmed_at: null,
      user_metadata: { name: 'Victim' },
    });

    const res = await sendSignupVerificationCodeAction({
      email: 'agent@victim.test',
      name: 'Victim',
      password: 'new-password-attempt-123',
    });

    expect(res.success).toBe(true);
    expect(res.email).toBe('agent@victim.test');
    // Ensure createUser was not called
    expect(createUserSpy).not.toHaveBeenCalled();
    // Ensure updateUserById was never called with a password
    expect(updateUserByIdSpy).not.toHaveBeenCalled();
    // Ensure verification code was stored in email_verifications and email sent
    expect(fakeVerifications.length).toBe(1);
    expect(mockSendSmtpEmail).toHaveBeenCalled();
  });

  // Confirmed account is refused without any updateUserById or createUser call
  it('refuses confirmed existing account without calling updateUserById or createUser', async () => {
    fakeUsers.push({
      id: 'existing-confirmed-id',
      email: 'owner@victim.test',
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { name: 'Victim Owner' },
    });

    const res = await sendSignupVerificationCodeAction({
      email: 'owner@victim.test',
      name: 'Attacker',
      password: 'new-password-123',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('An account with this email already exists');
    expect(updateUserByIdSpy).not.toHaveBeenCalled();
    expect(createUserSpy).not.toHaveBeenCalled();
  });

  // 3. Brute force: after 5 wrong attempts, locked for 15 minutes; the 6th wrong attempt is locked
  it('locks for 15 minutes after 5 wrong tries; the 6th wrong attempt is locked', async () => {
    fakeVerifications.push({
      id: 'ev-test',
      email: 'user@test.com',
      code: '654321',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
    });

    // 1st wrong attempt
    let res = await verifySignupCodeAction({ email: 'user@test.com', code: '000001' });
    expect(res.success).toBe(false);
    expect(fakeVerifications[0].attempts).toBe(1);
    expect(res.error).toContain('Invalid or expired verification code');

    // 2nd wrong attempt
    res = await verifySignupCodeAction({ email: 'user@test.com', code: '000002' });
    expect(res.success).toBe(false);
    expect(fakeVerifications[0].attempts).toBe(2);

    // 3rd wrong attempt
    res = await verifySignupCodeAction({ email: 'user@test.com', code: '000003' });
    expect(res.success).toBe(false);
    expect(fakeVerifications[0].attempts).toBe(3);

    // 4th wrong attempt
    res = await verifySignupCodeAction({ email: 'user@test.com', code: '000004' });
    expect(res.success).toBe(false);
    expect(fakeVerifications[0].attempts).toBe(4);

    // 5th wrong attempt -> triggers 15 minute lock
    res = await verifySignupCodeAction({ email: 'user@test.com', code: '000005' });
    expect(res.success).toBe(false);
    expect(fakeVerifications[0].attempts).toBe(5);
    expect(fakeVerifications[0].locked_until).not.toBeNull();
    expect(res.error).toContain('locked for 15 minutes');

    // 6th attempt -> immediately locked, even with correct code!
    res = await verifySignupCodeAction({ email: 'user@test.com', code: '654321' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('locked for 15 minutes');
  });

  // 4. Resend throttle works (1 per 60s, 5 per hour)
  it('throttles resending within 60 seconds', async () => {
    // 1st send succeeds
    const res1 = await sendSignupVerificationCodeAction({
      email: 'newuser@test.com',
      name: 'New User',
    });
    expect(res1.success).toBe(true);

    // Immediate second send fails (within 60s)
    const res2 = await sendSignupVerificationCodeAction({
      email: 'newuser@test.com',
      name: 'New User',
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toMatch(/wait \d+ seconds/i);
  });

  it('limits sending to at most 5 codes per hour', async () => {
    const baseTime = Date.now() - 50 * 60 * 1000; // 50 mins ago
    // Seed 5 codes in the past hour
    for (let i = 0; i < 5; i++) {
      fakeVerifications.push({
        id: `ev-old-${i}`,
        email: 'limituser@test.com',
        code: `10000${i}`,
        created_at: new Date(baseTime + i * 2 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        attempts: 0,
        locked_until: null,
      });
    }

    // 6th request within the hour should be blocked
    const res = await sendSignupVerificationCodeAction({
      email: 'limituser@test.com',
      name: 'Limit User',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Too many verification codes requested');
  });

  // 5. Timing-safe comparison check
  it('timingSafeCodeCheck securely verifies matching codes', () => {
    expect(timingSafeCodeCheck('123456', '123456')).toBe(true);
    expect(timingSafeCodeCheck('123456', '123457')).toBe(false);
    expect(timingSafeCodeCheck('12345', '123456')).toBe(false);
    expect(timingSafeCodeCheck('', '123456')).toBe(false);
  });

  // 6. Fail closed: if email cannot be sent, return an error
  it('fails closed when SMTP delivery fails', async () => {
    mockSendSmtpEmail.mockResolvedValueOnce({
      success: false,
      error: 'SMTP connection refused',
    });

    const res = await sendSignupVerificationCodeAction({
      email: 'test@failclosed.com',
      name: 'Fail User',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('SMTP connection refused');
  });

  // 7. Successful verification activates user and resets count
  it('activates user on correct code and removes verification row', async () => {
    fakeUsers.push({
      id: 'target-user-id',
      email: 'success@test.com',
      email_confirm: false,
    });

    fakeVerifications.push({
      id: 'ev-success',
      email: 'success@test.com',
      code: '789123',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      attempts: 2,
      locked_until: null,
      created_at: new Date().toISOString(),
    });

    const res = await verifySignupCodeAction({
      email: 'success@test.com',
      code: '789123',
    });

    expect(res.success).toBe(true);
    expect(updateUserByIdSpy).toHaveBeenCalledWith('target-user-id', { email_confirm: true });
    expect(fakeVerifications.length).toBe(0);
  });

  // 8. IP rate limiting (10 an hour per IP)
  it('enforces IP rate limiting (10 per hour)', async () => {
    mockServiceClient.mockReturnValue({
      auth: {
        admin: {
          listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
          updateUserById: updateUserByIdSpy,
          createUser: createUserSpy,
        },
      },
      from: vi.fn(() => ({}) as any),
      rpc: vi.fn(async () => ({ data: false, error: null })),
    });

    const res = await sendSignupVerificationCodeAction({
      email: 'rate-limit@ip.com',
      name: 'Rate Limited IP User',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Too many verification codes requested from this IP');
  });

  // 9. Password reset token generation, SMTP email dispatch, hash update, expiry, and replay prevention
  it('generates a hashed 30-min reset token, sends email via SMTP, updates bcrypt password, and blocks replay', async () => {
    const oldHash = await bcrypt.hash('OldPassword123!', 4);
    fakeAgents.push({
      id: 'agent-reset-1',
      name: 'Farhan Lead',
      email: 'farhan@acme.io',
      workspace_id: 'ws-1',
      password_hash: oldHash,
      is_active: true,
      token_version: 2,
    });
    fakeUsers.push({
      id: 'agent-reset-1',
      email: 'farhan@acme.io',
      name: 'Farhan Lead',
      password_hash: oldHash,
      email_confirmed_at: null,
    });

    const reqRes = await requestPasswordResetAction('farhan@acme.io');
    expect(reqRes.success).toBe(true);
    expect(reqRes.delivery).toBe('email');
    expect(reqRes.devResetUrl).toBeUndefined();
    expect(fakeResetTokens).toHaveLength(1);
    expect(fakeResetTokens[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    const ttlMs = new Date(fakeResetTokens[0].expires_at).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(29 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(30 * 60 * 1000 + 2000);

    expect(mockSendSmtpEmail).toHaveBeenCalledTimes(1);
    const sentMail = mockSendSmtpEmail.mock.calls[0][1];
    const urlMatch = String(sentMail.text || '').match(/https:\/\/app\.orbatai\.test\/forgot\?token=([^\s]+)/);
    expect(urlMatch).not.toBeNull();
    const rawToken = decodeURIComponent(urlMatch![1]);

    // Verify stored hash matches SHA-256 of raw token (plaintext never persisted)
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    expect(fakeResetTokens[0].token_hash).toBe(expectedHash);

    // Complete password reset
    const completeRes = await completePasswordResetAction(rawToken, 'FreshStrongPass99!');
    expect(completeRes.success).toBe(true);

    // Password hash actually changed and verifies via bcrypt
    const updatedHash = fakeAgents[0].password_hash;
    expect(updatedHash).not.toBe(oldHash);
    expect(await bcrypt.compare('FreshStrongPass99!', updatedHash)).toBe(true);
    expect(fakeAgents[0].token_version).toBeGreaterThan(2);

    // Replay with exact same single-use token is blocked
    const replayRes = await completePasswordResetAction(rawToken, 'AnotherPassword99!');
    expect(replayRes.success).toBe(false);
    expect(replayRes.error).toContain('already been used');
  });

  it('rejects expired, invalid, and too-short password reset attempts', async () => {
    fakeAgents.push({
      id: 'agent-exp-1',
      name: 'Expired User',
      email: 'expired@acme.io',
      is_active: true,
    });
    const expiredRaw = 'expired-demo-token-abc';
    fakeResetTokens.push({
      id: 'prt-exp',
      user_id: 'agent-exp-1',
      email: 'expired@acme.io',
      token_hash: crypto.createHash('sha256').update(expiredRaw).digest('hex'),
      expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      used_at: null,
      created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    });

    const expRes = await completePasswordResetAction(expiredRaw, 'ValidPassword99!');
    expect(expRes.success).toBe(false);
    expect(expRes.error).toContain('expired');

    const badRes = await completePasswordResetAction('totally-unknown-token', 'ValidPassword99!');
    expect(badRes.success).toBe(false);
    expect(badRes.error).toContain('Invalid or expired');

    const shortRes = await completePasswordResetAction(expiredRaw, 'short');
    expect(shortRes.success).toBe(false);
    expect(shortRes.error).toContain('at least 8 characters');
  });

  it('never leaks reset tokens in production when SMTP is disabled, while allowing dev preview locally', async () => {
    fakePlatformSettings = { smtp_settings: { enabled: false }, default_features: {} };
    fakeAgents.push({
      id: 'agent-nosmtp-1',
      name: 'No Smtp',
      email: 'nosmtp@acme.io',
      workspace_id: 'ws-nosmtp',
      is_active: true,
    });

    // Dev mode: explicit dev_preview link allowed when SMTP missing
    vi.stubEnv('NODE_ENV', 'test');
    const devRes = await requestPasswordResetAction('nosmtp@acme.io');
    expect(devRes.success).toBe(true);
    expect(devRes.delivery).toBe('dev_preview');
    expect(devRes.devResetUrl).toContain('/forgot?token=');

    // Production without SMTP and without admin demo session: fail closed, never leak token
    vi.stubEnv('NODE_ENV', 'production');
    process.env.ORBAT_DEMO_AUTH_PREVIEW = 'true';
    mockSessionUser.mockResolvedValue(null);
    const prodRes = await requestPasswordResetAction('nosmtp@acme.io');
    expect(prodRes.success).toBe(false);
    expect(prodRes.delivery).toBe('smtp_unconfigured');
    expect(prodRes.devResetUrl).toBeUndefined();
  });

  it('resolves signup email verification requirement from env, platform defaults, and workspace policy', async () => {
    delete process.env.PLATFORM_REQUIRE_EMAIL_VERIFICATION;
    expect((await getSignupVerificationRequirementAction()).required).toBe(false);

    process.env.PLATFORM_REQUIRE_EMAIL_VERIFICATION = 'true';
    expect((await getSignupVerificationRequirementAction()).required).toBe(true);
    delete process.env.PLATFORM_REQUIRE_EMAIL_VERIFICATION;

    fakePlatformSettings.default_features = { require_email_verification: true };
    expect((await getSignupVerificationRequirementAction()).required).toBe(true);
    fakePlatformSettings.default_features = {};

    fakeWorkspaces.push({
      id: 'ws-strict-otp',
      security_policies: { requireEmailVerification: true },
    });
    expect((await getSignupVerificationRequirementAction('ws-strict-otp')).required).toBe(true);
  });
});
