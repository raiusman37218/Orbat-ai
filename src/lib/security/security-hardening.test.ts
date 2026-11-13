import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  lookup: vi.fn(),
  guardConversation: vi.fn(),
  guardMember: vi.fn(),
  guardWorkspace: vi.fn(),
  serviceFrom: vi.fn(),
  learnFromHumanAgentReply: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: mocks.cookiesGet,
  }),
}));

vi.mock('node:dns/promises', () => ({
  lookup: mocks.lookup,
}));

vi.mock('@/lib/team/route-guard', () => ({
  guardConversation: mocks.guardConversation,
  guardMember: mocks.guardMember,
  guardWorkspace: mocks.guardWorkspace,
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/pg/service', () => ({
  serviceClient: () => ({
    from: mocks.serviceFrom,
  }),
}));

vi.mock('@/lib/ai/learning/human-reinforce', () => ({
  learnFromHumanAgentReply: mocks.learnFromHumanAgentReply,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/csat/token', () => ({
  verifyCsatToken: vi.fn((ticketId: string, _ws: string, token: string) => token === `valid-${ticketId}`),
}));

vi.mock('@/lib/request-origin', () => ({
  getRequestOrigin: vi.fn().mockResolvedValue('https://app.orbat.test'),
}));

vi.mock('@/lib/ai/translator', () => ({
  SUPPORTED_LANGUAGES: { en: { name: 'English' }, es: { name: 'Spanish' } },
  detectLanguage: vi.fn(() => ({ code: 'es', name: 'Spanish' })),
  translateToEnglish: vi.fn(async ({ text }: { text: string }) => ({
    englishText: `en:${text}`,
    detectedLanguageCode: 'es',
    detectedLanguageName: 'Spanish',
    isOriginalEnglish: false,
  })),
  translateFromEnglish: vi.fn(async ({ text }: { text: string }) => ({ translatedText: text })),
  translateAgentReply: vi.fn(async ({ text }: { text: string }) => ({ translatedText: text })),
}));

import { decodeNestJwtPayload } from '@/lib/auth/session-user';
import { validateProviderBaseUrl } from '@/lib/security/url-guard';
import { POST as lemonWebhook } from '@/app/api/webhooks/lemonsqueezy/route';
import { POST as reinforcePost } from '@/app/api/ai/reinforce/route';
import { POST as translatePost } from '@/app/api/translation/translate/route';
import { GET as csatGet } from '@/app/api/csat/rate/route';
import { POST as dispatchPost } from '@/app/api/notifications/dispatch/route';

function signJwt(payload: Record<string, unknown>, secret: string, alg = 'HS256'): string {
  const h = Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

describe('Group A security hardening', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalLemonSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const originalAllowLocal = process.env.ALLOW_LOCAL_LLM_URLS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.JWT_SECRET;
    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    delete process.env.ALLOW_LOCAL_LLM_URLS;
  });

  afterEach(() => {
    if (originalJwtSecret !== undefined) process.env.JWT_SECRET = originalJwtSecret;
    else delete process.env.JWT_SECRET;
    if (originalLemonSecret !== undefined) process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = originalLemonSecret;
    else delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    if (originalAllowLocal !== undefined) process.env.ALLOW_LOCAL_LLM_URLS = originalAllowLocal;
    else delete process.env.ALLOW_LOCAL_LLM_URLS;
  });

  describe('decodeNestJwtPayload', () => {
    it('fails closed when JWT_SECRET is unset', () => {
      const token = signJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 }, 'any');
      expect(decodeNestJwtPayload(token)).toBeNull();
    });

    it('rejects alg=none, wrong signature, missing exp, expired exp, and malformed tokens', () => {
      process.env.JWT_SECRET = 'super-strong-test-jwt-secret-123456';
      const now = Math.floor(Date.now() / 1000);

      const algNone = signJwt({ sub: 'u1', exp: now + 300 }, process.env.JWT_SECRET, 'none');
      expect(decodeNestJwtPayload(algNone)).toBeNull();

      const badSig = signJwt({ sub: 'u1', exp: now + 300 }, 'wrong-secret');
      expect(decodeNestJwtPayload(badSig)).toBeNull();

      const noExp = signJwt({ sub: 'u1' }, process.env.JWT_SECRET);
      expect(decodeNestJwtPayload(noExp)).toBeNull();

      const expired = signJwt({ sub: 'u1', exp: now - 10 }, process.env.JWT_SECRET);
      expect(decodeNestJwtPayload(expired)).toBeNull();

      expect(decodeNestJwtPayload('not.a.jwt')).toBeNull();
    });

    it('accepts valid HS256 tokens with future exp', () => {
      process.env.JWT_SECRET = 'super-strong-test-jwt-secret-123456';
      const token = signJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 300 }, process.env.JWT_SECRET);
      expect(decodeNestJwtPayload(token)).toMatchObject({ sub: 'u1' });
    });
  });

  describe('POST /api/webhooks/lemonsqueezy', () => {
    it('fails closed with 500 when no webhook signing secret is configured', async () => {
      mocks.serviceFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { billing_settings: {} } }),
          }),
        }),
      });
      const req = new NextRequest('http://localhost/api/webhooks/lemonsqueezy', {
        method: 'POST',
        body: JSON.stringify({ meta: { event_name: 'subscription_created' }, data: {} }),
      });
      const res = await lemonWebhook(req);
      expect(res.status).toBe(500);
    });

    it('rejects requests missing x-signature with 401 when secret is configured', async () => {
      process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = 'ls_secret_123';
      mocks.serviceFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { billing_settings: {} } }),
          }),
        }),
      });
      const req = new NextRequest('http://localhost/api/webhooks/lemonsqueezy', {
        method: 'POST',
        body: JSON.stringify({ meta: { event_name: 'subscription_created' }, data: {} }),
      });
      const res = await lemonWebhook(req);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/ai/reinforce', () => {
    it('enforces conversation reply permission and workspace consistency', async () => {
      mocks.guardConversation.mockResolvedValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const unauthReq = new NextRequest('http://localhost/api/ai/reinforce', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'ws-1',
          conversationId: 'conv-1',
          agentMessageId: 'msg-1',
          agentContent: 'hello',
        }),
      });
      expect((await reinforcePost(unauthReq)).status).toBe(401);

      mocks.guardConversation.mockResolvedValueOnce({
        ok: true,
        workspaceId: 'ws-actual',
        access: { agent: { workspace_id: 'ws-actual' } },
      });
      const crossWsReq = new NextRequest('http://localhost/api/ai/reinforce', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'ws-other',
          conversationId: 'conv-1',
          agentMessageId: 'msg-1',
          agentContent: 'hello',
        }),
      });
      expect((await reinforcePost(crossWsReq)).status).toBe(403);
      expect(mocks.learnFromHumanAgentReply).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/translation/translate', () => {
    it('guards requested workspaceId instead of using caller-agnostic guardMember', async () => {
      mocks.guardWorkspace.mockResolvedValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
      });
      const req = new NextRequest('http://localhost/api/translation/translate', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Hola',
          direction: 'to_english',
          workspaceId: 'ws-victim',
        }),
      });
      const res = await translatePost(req);
      expect(res.status).toBe(403);
      expect(mocks.guardWorkspace).toHaveBeenCalledWith('ws-victim', 'view');
      expect(mocks.guardMember).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/csat/rate', () => {
    it('rejects GET when token is omitted or invalid and allows valid signed token', async () => {
      mocks.serviceFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'ticket-1',
                number: 42,
                subject: 'Confidential Refund',
                status: 'solved',
                workspace_id: 'ws-1',
                csat_rating: null,
                csat_comment: null,
                csat_rated_at: null,
                workspace: { id: 'ws-1', name: 'Acme' },
              },
              error: null,
            }),
          }),
        }),
      });

      const noToken = await csatGet(new NextRequest('http://localhost/api/csat/rate?ticket_id=ticket-1'));
      expect(noToken.status).toBe(403);

      const badToken = await csatGet(new NextRequest('http://localhost/api/csat/rate?ticket_id=ticket-1&token=forged'));
      expect(badToken.status).toBe(403);

      const ok = await csatGet(new NextRequest('http://localhost/api/csat/rate?ticket_id=ticket-1&token=valid-ticket-1'));
      expect(ok.status).toBe(200);
      const body = await ok.json();
      expect(body.ticket.subject).toBe('Confidential Refund');
    });
  });

  describe('SSRF protection on notifications test_slack & provider baseUrl', () => {
    it('blocks private IP and metadata webhook URLs in test_slack', async () => {
      mocks.guardMember.mockResolvedValue({ ok: true, access: { agent: { workspace_id: 'ws-1' } } });
      for (const badUrl of [
        'http://hooks.slack.com/services/a/b/c',
        'https://127.0.0.1/hook',
        'https://169.254.169.254/latest/meta-data',
        'https://localhost/internal',
      ]) {
        const req = new NextRequest('http://localhost/api/notifications/dispatch', {
          method: 'POST',
          body: JSON.stringify({ event: 'test_slack', webhook_url: badUrl }),
        });
        const res = await dispatchPost(req);
        expect(res.status).toBe(400);
      }

      mocks.lookup.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);
      const rebindReq = new NextRequest('http://localhost/api/notifications/dispatch', {
        method: 'POST',
        body: JSON.stringify({ event: 'test_slack', webhook_url: 'https://evil-rebind.example/hook' }),
      });
      expect((await dispatchPost(rebindReq)).status).toBe(400);
    });

    it('restricts custom compatible baseUrl to public https unless ALLOW_LOCAL_LLM_URLS=true', () => {
      expect(validateProviderBaseUrl('https://169.254.169.254/v1').ok).toBe(false);
      expect(validateProviderBaseUrl('http://localhost:11434/v1').ok).toBe(false);
      expect(validateProviderBaseUrl('https://openrouter.ai/api/v1').ok).toBe(true);

      process.env.ALLOW_LOCAL_LLM_URLS = 'true';
      expect(validateProviderBaseUrl('http://localhost:11434/v1').ok).toBe(true);
    });
  });
});
