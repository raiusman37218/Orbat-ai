import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mockQuery = vi.fn();
const mockQueryRows = vi.fn();
const mockSessionUser = vi.fn();
const mockAuthenticatePgPassword = vi.fn();
const mockBumpAgentTokenVersion = vi.fn();
const mockResendCode = vi.fn();

vi.mock('@/lib/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  queryRows: (...args: any[]) => mockQueryRows(...args),
}));

vi.mock('@/lib/auth/session-user', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session-user')>();
  return {
    ...actual,
    sessionUser: (...args: any[]) => mockSessionUser(...args),
  };
});

vi.mock('@/lib/auth/postgres-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/postgres-auth')>();
  return {
    ...actual,
    authenticatePgPassword: (...args: any[]) => mockAuthenticatePgPassword(...args),
    bumpAgentTokenVersion: (...args: any[]) => mockBumpAgentTokenVersion(...args),
  };
});

vi.mock('@/app/actions/auth-verification', () => ({
  resendSignupVerificationCodeAction: (...args: any[]) => mockResendCode(...args),
}));

import { GET as getProviders } from './providers/route';
import { POST as postLogin } from './login/route';
import { POST as postLogout } from './logout/route';
import { GET as getSession, POST as postSession } from './session/route';
import { GET as getSessions, POST as postSessions } from './sessions/route';
import { GET as getMfa, POST as postMfa, DELETE as deleteMfa } from './mfa/route';
import { generateTotpToken, sealTotpSecret } from '@/lib/auth/postgres-auth';

describe('Pure PostgreSQL Auth API Routes', () => {
  const prevJwt = process.env.JWT_SECRET;
  const prevGoogle = process.env.GOOGLE_CLIENT_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockQueryRows.mockReset();
    mockQueryRows.mockResolvedValue([]);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    mockSessionUser.mockReset();
    mockAuthenticatePgPassword.mockReset();
    mockBumpAgentTokenVersion.mockReset();
    mockResendCode.mockReset();
    process.env.JWT_SECRET = 'test-auth-secret-32-characters-long';
  });

  afterEach(() => {
    process.env.JWT_SECRET = prevJwt;
    process.env.GOOGLE_CLIENT_ID = prevGoogle;
  });

  it('GET /api/auth/providers reflects GOOGLE_CLIENT_ID availability', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const res1 = await getProviders();
    expect(await res1.json()).toEqual({ google: false, email: true });

    process.env.GOOGLE_CLIENT_ID = 'google-client-123';
    const res2 = await getProviders();
    expect(await res2.json()).toEqual({ google: true, email: true });
  });

  it('POST /api/auth/login enforces MFA TOTP when enabled and sets session cookies', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const sealed = sealTotpSecret(secret);

    mockAuthenticatePgPassword.mockResolvedValue({
      ok: true,
      agent: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Avery Agent',
        email: 'avery@orbat.ai',
        role: 'owner',
        status: 'online',
        workspace_id: '22222222-2222-4222-8222-222222222222',
        workspace_name: 'Acme Support',
        brand_color: '#635bff',
        password_hash: 'hash',
        is_active: true,
        is_super_admin: false,
        email_verified: true,
        token_version: 3,
        totp_enabled: true,
      },
    });
    mockQueryRows
      .mockResolvedValueOnce([{ totp_secret_encrypted: sealed }]) // okRes mfa secret check
      .mockResolvedValueOnce([]) // platform_access
      .mockResolvedValueOnce([{ avatar_url: null }]);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    // Missing TOTP triggers 403 requiresMfa
    const noMfaRes = await postLogin(
      new Request('https://app.orbat.ai/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'avery@orbat.ai', password: 'secret' }),
      }),
    );
    expect(noMfaRes.status).toBe(403);
    expect(await noMfaRes.json()).toMatchObject({ requiresMfa: true });

    // Valid TOTP succeeds & sets cookies
    const code = generateTotpToken(secret);
    const okRes = await postLogin(
      new Request('https://app.orbat.ai/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'avery@orbat.ai', password: 'secret', totpCode: code }),
      }),
    );
    expect(okRes.status).toBe(200);
    const body = await okRes.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user.email).toBe('avery@orbat.ai');
    expect(okRes.headers.get('set-cookie')).toContain('orbat_access_token=');
  });

  it('POST /api/auth/logout bumps token_version for others and clears cookies on local signout', async () => {
    mockSessionUser.mockResolvedValue({ id: 'agent-1', email: 'avery@orbat.ai' });
    mockBumpAgentTokenVersion.mockResolvedValue(4);
    mockQueryRows
      .mockResolvedValueOnce([
        {
          id: 'agent-1',
          name: 'Avery',
          email: 'avery@orbat.ai',
          role: 'owner',
          status: 'online',
          workspace_id: 'ws-1',
          workspace_name: 'Acme',
          brand_color: null,
          password_hash: null,
          is_active: true,
          is_super_admin: false,
          email_verified: true,
          token_version: 4,
          totp_enabled: false,
        },
      ])
      .mockResolvedValueOnce([]) // platform_access
      .mockResolvedValueOnce([{ avatar_url: null }]);

    const othersRes = await postLogout(
      new Request('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ scope: 'others' }),
      }),
    );
    expect(othersRes.status).toBe(200);
    expect(mockBumpAgentTokenVersion).toHaveBeenCalledWith('agent-1');
    expect(othersRes.headers.get('set-cookie')).toContain('orbat_access_token=');

    const localRes = await postLogout(
      new Request('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ scope: 'local' }),
      }),
    );
    expect(localRes.status).toBe(200);
    expect(localRes.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('GET /api/auth/session and POST resend verification code work', async () => {
    mockSessionUser.mockResolvedValueOnce(null);
    const unauth = await getSession();
    expect(unauth.status).toBe(401);

    mockSessionUser.mockResolvedValue({
      id: 'agent-1',
      email: 'avery@orbat.ai',
      name: 'Avery',
    });
    mockQueryRows
      .mockResolvedValueOnce([{ id: 'agent-1', email: 'avery@orbat.ai', name: 'Avery', workspace_id: 'ws-1' }])
      .mockResolvedValueOnce([{ email_verified: true, email_confirmed_at: '2026-11-13T00:00:00Z', totp_enabled: false }])
      .mockResolvedValueOnce([{ id: 'ws-1', name: 'Acme' }]);

    const ok = await getSession();
    expect(ok.status).toBe(200);
    const json = await ok.json();
    expect(json.authenticated).toBe(true);
    expect(json.emailConfirmed).toBe(true);
    expect(json.workspace.name).toBe('Acme');

    mockResendCode.mockResolvedValue({ success: true, email: 'avery@orbat.ai' });
    const resend = await postSession();
    expect(resend.status).toBe(200);
    expect(mockResendCode).toHaveBeenCalledWith({ email: 'avery@orbat.ai', name: 'Avery' });
  });

  it('GET and POST /api/auth/sessions inspect session and revoke other sessions', async () => {
    mockSessionUser.mockResolvedValue({ id: 'agent-1', email: 'avery@orbat.ai' });
    mockQueryRows.mockResolvedValueOnce([
      { email: 'avery@orbat.ai', last_seen_at: '2026-11-13T10:00:00.000Z', created_at: '2026-11-01T10:00:00.000Z' },
    ]);

    const infoRes = await getSessions();
    expect(infoRes.status).toBe(200);
    expect(await infoRes.json()).toEqual({
      email: 'avery@orbat.ai',
      lastSignIn: '2026-11-13T10:00:00.000Z',
    });

    mockBumpAgentTokenVersion.mockResolvedValue(2);
    mockQueryRows.mockResolvedValueOnce([]); // loadAgentAuthRecordById agents
    mockQueryRows.mockResolvedValueOnce([]); // loadAgentAuthRecordById auth_accounts
    const revokeRes = await postSessions(
      new Request('http://localhost:3000/api/auth/sessions', {
        method: 'POST',
        body: JSON.stringify({ action: 'sign_out_others' }),
      }),
    );
    expect(revokeRes.status).toBe(200);
    expect(mockBumpAgentTokenVersion).toHaveBeenCalledWith('agent-1');
  });

  it('GET / POST / DELETE /api/auth/mfa manage TOTP enrollment and verification', async () => {
    mockSessionUser.mockResolvedValue({ id: 'agent-1', email: 'avery@orbat.ai' });

    // Enroll generates QR PNG + encrypted secret
    mockQueryRows.mockResolvedValueOnce([{ id: 'agent-1', email: 'avery@orbat.ai' }]);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const enrollRes = await postMfa(
      new Request('http://localhost:3000/api/auth/mfa', {
        method: 'POST',
        body: JSON.stringify({ action: 'enroll' }),
      }),
    );
    expect(enrollRes.status).toBe(200);
    const enrolled = await enrollRes.json();
    expect(enrolled.totp.qr_code).toMatch(/^data:image\/png;base64,/);
    expect(enrolled.totp.secret).toMatch(/^[A-Z2-7]+$/);

    // Verify succeeds with matching TOTP code
    const sealed = sealTotpSecret(enrolled.totp.secret);
    mockQueryRows.mockResolvedValueOnce([{ totp_secret_encrypted: sealed }]);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const verifyRes = await postMfa(
      new Request('http://localhost:3000/api/auth/mfa', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify', code: generateTotpToken(enrolled.totp.secret) }),
      }),
    );
    expect(verifyRes.status).toBe(200);
    expect(await verifyRes.json()).toEqual({ ok: true });

    // GET reflects verified factor
    mockQueryRows.mockResolvedValueOnce([{ totp_enabled: true, totp_enrolled_at: '2026-11-13T12:00:00Z' }]);
    const listRes = await getMfa();
    expect(listRes.status).toBe(200);
    expect(await listRes.json()).toMatchObject({ factors: [{ id: 'totp', status: 'verified' }] });

    // DELETE disables TOTP
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const delRes = await deleteMfa();
    expect(delRes.status).toBe(200);
    expect(await delRes.json()).toEqual({ ok: true });
  });
});
