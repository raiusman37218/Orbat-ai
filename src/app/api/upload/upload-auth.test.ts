import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  guardMemberResult: { ok: false } as {
    ok: boolean;
    access?: { user: { id: string } };
    response?: NextResponse;
  },
  verifyVisitorResult: null as { visitorId: string; workspaceId: string | null } | null,
}));

vi.mock('@/lib/team/route-guard', () => ({
  guardMember: vi.fn(async () => mocks.guardMemberResult),
}));

vi.mock('@/lib/widget/visitor-token', () => ({
  verifyVisitorToken: vi.fn(async () => mocks.verifyVisitorResult),
}));

vi.mock('@/lib/cloudinary', () => ({
  isCloudinaryConfigured: () => true,
  uploadToCloudinary: async () => ({
    secure_url: 'https://res.cloudinary.com/test/image/upload/v1234/chat_attachments/test.jpg',
    public_id: 'chat_attachments/test',
    bytes: 1024,
    width: 200,
    height: 200,
  }),
}));

import { OPTIONS as signOptions, POST as signPost } from './sign/route';
import { OPTIONS as uploadOptions, POST as uploadPost } from './route';

describe('M-15b Upload Routes Authorization and CORS', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    process.env.CLOUDINARY_API_KEY = 'demo-key';
    process.env.CLOUDINARY_API_SECRET = 'demo-secret';
    mocks.guardMemberResult = { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    mocks.verifyVisitorResult = null;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  describe('CORS and OPTIONS preflight', () => {
    it('/api/upload/sign OPTIONS returns 204 with visitor headers allowed', async () => {
      const res = await signOptions();
      expect(res.status).toBe(204);
      const allowHeaders = res.headers.get('Access-Control-Allow-Headers') || '';
      expect(allowHeaders).toContain('x-zentry-visitor');
      expect(allowHeaders).toContain('x-zentry-visitor-token');
    });

    it('/api/upload OPTIONS returns 204 with visitor headers allowed', async () => {
      const res = await uploadOptions();
      expect(res.status).toBe(204);
      const allowHeaders = res.headers.get('Access-Control-Allow-Headers') || '';
      expect(allowHeaders).toContain('x-zentry-visitor');
      expect(allowHeaders).toContain('x-zentry-visitor-token');
    });
  });

  describe('/api/upload/sign authorization matrix', () => {
    it('no auth → 401', async () => {
      mocks.guardMemberResult = { ok: false };
      mocks.verifyVisitorResult = null;

      const req = new Request('http://localhost/api/upload/sign', { method: 'POST' });
      const res = await signPost(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('wrong visitor token → 401', async () => {
      mocks.guardMemberResult = { ok: false };
      mocks.verifyVisitorResult = null; // Token verification failed

      const req = new Request('http://localhost/api/upload/sign', {
        method: 'POST',
        headers: {
          'x-zentry-visitor': 'visitor-uuid-1234',
          'x-zentry-visitor-token': 'wrong-token-value',
        },
      });
      const res = await signPost(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('valid visitor → allowed', async () => {
      mocks.guardMemberResult = { ok: false };
      mocks.verifyVisitorResult = { visitorId: 'visitor-uuid-1234', workspaceId: 'ws-1' };

      const req = new Request('http://localhost/api/upload/sign', {
        method: 'POST',
        headers: {
          'x-zentry-visitor': 'visitor-uuid-1234',
          'x-zentry-visitor-token': 'valid-session-token-64chars',
        },
      });
      const res = await signPost(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.signature).toBeDefined();
      expect(body.apiKey).toBe('demo-key');
      expect(body.cloudName).toBe('demo-cloud');
    });

    it('member → allowed', async () => {
      mocks.guardMemberResult = { ok: true, access: { user: { id: 'agent-1' } } };
      mocks.verifyVisitorResult = null;

      const req = new Request('http://localhost/api/upload/sign', { method: 'POST' });
      const res = await signPost(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.signature).toBeDefined();
    });
  });

  describe('/api/upload authorization matrix', () => {
    function makeUploadRequest(headers: Record<string, string> = {}) {
      const formData = new FormData();
      const file = new File(['dummy image content'], 'photo.jpg', { type: 'image/jpeg' });
      formData.append('file', file);
      return new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      });
    }

    it('no auth → 401', async () => {
      mocks.guardMemberResult = { ok: false };
      mocks.verifyVisitorResult = null;

      const req = makeUploadRequest();
      const res = await uploadPost(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('wrong visitor token → 401', async () => {
      mocks.guardMemberResult = { ok: false };
      mocks.verifyVisitorResult = null;

      const req = makeUploadRequest({
        'x-zentry-visitor': 'visitor-uuid-1234',
        'x-zentry-visitor-token': 'wrong-token',
      });
      const res = await uploadPost(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('valid visitor → allowed', async () => {
      mocks.guardMemberResult = { ok: false };
      mocks.verifyVisitorResult = { visitorId: 'visitor-uuid-1234', workspaceId: 'ws-1' };

      const req = makeUploadRequest({
        'x-zentry-visitor': 'visitor-uuid-1234',
        'x-zentry-visitor-token': 'valid-session-token-64chars',
      });
      const res = await uploadPost(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toContain('https://res.cloudinary.com');
    });

    it('member → allowed', async () => {
      mocks.guardMemberResult = { ok: true, access: { user: { id: 'agent-1' } } };
      mocks.verifyVisitorResult = null;

      const req = makeUploadRequest();
      const res = await uploadPost(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toContain('https://res.cloudinary.com');
    });
  });

  describe('audio voice-note uploads', () => {
    it('strips codec parameters from audio/webm;codecs=opus and returns audio metadata', async () => {
      mocks.guardMemberResult = { ok: true, access: { user: { id: 'agent-1' } } };
      mocks.verifyVisitorResult = null;

      const fd = new FormData();
      const audioBlob = new File([new Uint8Array([1, 2, 3, 4])], 'voice-note.webm', {
        type: 'audio/webm;codecs=opus',
      });
      fd.append('file', audioBlob);
      fd.append('durationSec', '14');

      const req = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: fd,
      });
      const res = await uploadPost(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isAudio).toBe(true);
      expect(body.mimeType).toBe('audio/webm');
      expect(body.durationSec).toBe(14);
      expect(body.url).toContain('https://res.cloudinary.com');
    });

    it('rejects audio files exceeding 10 MB with 400', async () => {
      mocks.guardMemberResult = { ok: true, access: { user: { id: 'agent-1' } } };
      mocks.verifyVisitorResult = null;

      const oversized = new Uint8Array(10 * 1024 * 1024 + 128);
      const fd = new FormData();
      fd.append(
        'file',
        new File([oversized], 'long-voice.ogg', { type: 'audio/ogg;codecs=opus' }),
      );

      const req = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: fd,
      });
      const res = await uploadPost(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/10\s*MB/i);
    });

    it('rejects disallowed executable file types with 400', async () => {
      mocks.guardMemberResult = { ok: true, access: { user: { id: 'agent-1' } } };
      mocks.verifyVisitorResult = null;

      const fd = new FormData();
      fd.append(
        'file',
        new File([new Uint8Array([77, 90])], 'payload.exe', {
          type: 'application/x-msdownload',
        }),
      );

      const req = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: fd,
      });
      const res = await uploadPost(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('not permitted');
    });
  });
});
