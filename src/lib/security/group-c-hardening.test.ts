import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearCustomDomainRoutingCacheForTest,
  extractHostname,
  isReservedHelpRewritePath,
  resolveHelpRewritePath,
} from '@/lib/help/custom-domain-routing';
import {
  advisoryLockKeysForConversation,
  verifyAutoRespondCaller,
  withConversationAdvisoryLock,
} from '@/lib/ai/auto-respond-guard';

describe('Custom Help Center domain & subdomain routing', () => {
  afterEach(() => {
    clearCustomDomainRoutingCacheForTest();
  });

  it('extracts lowercase hostname without port and supports IPv6 brackets', () => {
    expect(extractHostname('Help.Acme.com:443')).toBe('help.acme.com');
    expect(extractHostname('[::1]:3000')).toBe('[::1]');
  });

  it('never rewrites reserved app, API, static asset, or existing /help paths', () => {
    expect(isReservedHelpRewritePath('/api/health')).toBe(true);
    expect(isReservedHelpRewritePath('/_next/static/app.js')).toBe(true);
    expect(isReservedHelpRewritePath('/help/my-ws')).toBe(true);
    expect(isReservedHelpRewritePath('/dashboard/inbox')).toBe(true);
    expect(isReservedHelpRewritePath('/admin')).toBe(true);
    expect(isReservedHelpRewritePath('/favicon.ico')).toBe(true);
    expect(isReservedHelpRewritePath('/logo.png')).toBe(true);
    expect(isReservedHelpRewritePath('/sitemap.xml')).toBe(false);
    expect(isReservedHelpRewritePath('/getting-started')).toBe(false);
  });

  it('rewrites <slug>.orbathelp.com subdomains cleanly to /help/<slug>', async () => {
    await expect(resolveHelpRewritePath('acme-co.orbathelp.com', '/')).resolves.toBe('/help/acme-co');
    await expect(
      resolveHelpRewritePath('acme-co.orbathelp.com:443', '/billing/refunds'),
    ).resolves.toBe('/help/acme-co/billing/refunds');
    await expect(
      resolveHelpRewritePath('acme-co.orbathelp.com', '/sitemap.xml'),
    ).resolves.toBe('/help/acme-co/sitemap.xml');
  });

  it('rewrites verified customer custom domains and strips www. consistently', async () => {
    const lookup = vi.fn(async (cleanHost: string) =>
      cleanHost === 'help.acme.com' ? 'acme-help' : null,
    );

    await expect(
      resolveHelpRewritePath('www.help.acme.com', '/', lookup),
    ).resolves.toBe('/help/acme-help');
    await expect(
      resolveHelpRewritePath('help.acme.com', '/article-one', lookup),
    ).resolves.toBe('/help/acme-help/article-one');
    expect(lookup).toHaveBeenCalledWith('help.acme.com');
  });

  it('skips rewriting platform hosts and reserved routes', async () => {
    const lookup = vi.fn(async () => 'should-not-resolve');
    await expect(resolveHelpRewritePath('localhost:3000', '/', lookup)).resolves.toBeNull();
    await expect(resolveHelpRewritePath('orbatai.com', '/', lookup)).resolves.toBeNull();
    await expect(resolveHelpRewritePath('preview.vercel.app', '/', lookup)).resolves.toBeNull();
    await expect(resolveHelpRewritePath('help.acme.com', '/api/health', lookup)).resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('Auto-Respond caller authentication & cross-instance advisory lock', () => {
  const prevSecret = process.env.INTERNAL_API_SECRET;
  const prevEnforce = process.env.ENFORCE_WIDGET_VISITOR_TOKEN;

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = prevSecret;

    if (prevEnforce === undefined) delete process.env.ENFORCE_WIDGET_VISITOR_TOKEN;
    else process.env.ENFORCE_WIDGET_VISITOR_TOKEN = prevEnforce;
  });

  it('authorizes internal server callers with matching x-internal-secret', async () => {
    process.env.INTERNAL_API_SECRET = 'internal-test-secret-123';
    process.env.ENFORCE_WIDGET_VISITOR_TOKEN = 'true';

    const req = new Request('https://orbatai.com/api/ai/auto-respond', {
      method: 'POST',
      headers: { 'x-internal-secret': 'internal-test-secret-123' },
    });

    const result = await verifyAutoRespondCaller({
      request: req,
      workspaceId: 'ws-1',
      convVisitorId: 'vis-1',
      supabase: { rpc: vi.fn() },
      resolveSessionAgent: async () => null,
    });

    expect(result).toEqual({ authorized: true, mode: 'internal_secret' });
  });

  it('authorizes widget callers with valid visitor_token verified via fn_widget_auth', async () => {
    process.env.ENFORCE_WIDGET_VISITOR_TOKEN = 'true';
    const rpc = vi.fn().mockResolvedValue({ data: { authenticated: true }, error: null });

    const req = new Request('https://orbatai.com/api/ai/auto-respond', { method: 'POST' });
    const result = await verifyAutoRespondCaller({
      request: req,
      workspaceId: 'ws-1',
      convVisitorId: 'vis-1',
      visitorToken: 'tok-valid',
      supabase: { rpc },
      resolveSessionAgent: async () => null,
    });

    expect(rpc).toHaveBeenCalledWith('fn_widget_auth', {
      p_visitor_id: 'vis-1',
      p_visitor_token: 'tok-valid',
    });
    expect(result).toEqual({ authorized: true, mode: 'visitor_token' });
  });

  it('denies unauthenticated callers when ENFORCE_WIDGET_VISITOR_TOKEN=true and grants grace otherwise', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { authenticated: false }, error: null });
    const req = new Request('https://orbatai.com/api/ai/auto-respond', { method: 'POST' });

    process.env.ENFORCE_WIDGET_VISITOR_TOKEN = 'true';
    const denied = await verifyAutoRespondCaller({
      request: req,
      workspaceId: 'ws-1',
      convVisitorId: 'vis-1',
      visitorToken: 'bad-token',
      supabase: { rpc },
      resolveSessionAgent: async () => null,
    });
    expect(denied.authorized).toBe(false);
    expect(denied.mode).toBe('enforced_denied');

    process.env.ENFORCE_WIDGET_VISITOR_TOKEN = 'false';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const grace = await verifyAutoRespondCaller({
      request: req,
      workspaceId: 'ws-1',
      convVisitorId: 'vis-1',
      supabase: { rpc },
      resolveSessionAgent: async () => null,
    });
    warnSpy.mockRestore();
    expect(grace).toEqual({ authorized: true, mode: 'grace_legacy' });
  });

  it('coordinates conversation single-flight via PostgreSQL advisory lock and always unlocks', async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const release = vi.fn();
    const fakePool = {
      connect: vi.fn(async () => ({
        query: vi.fn(async (sql: string, params?: unknown[]) => {
          queries.push({ sql, params });
          if (sql.includes('pg_try_advisory_lock')) {
            return { rows: [{ acquired: true }] };
          }
          return { rows: [] };
        }),
        release,
      })),
    };

    const [k1, k2] = advisoryLockKeysForConversation('conv-123');
    const out = await withConversationAdvisoryLock('conv-123', async () => 'done', fakePool);

    expect(out).toEqual({ acquired: true, result: 'done' });
    expect(queries[0]).toEqual({
      sql: 'SELECT pg_try_advisory_lock($1, $2) AS acquired',
      params: [k1, k2],
    });
    expect(queries[1]).toEqual({
      sql: 'SELECT pg_advisory_unlock($1, $2)',
      params: [k1, k2],
    });
    expect(release).toHaveBeenCalledTimes(1);

    const busyPool = {
      connect: vi.fn(async () => ({
        query: vi.fn(async () => ({ rows: [{ acquired: false }] })),
        release: vi.fn(),
      })),
    };
    const work = vi.fn();
    const busy = await withConversationAdvisoryLock('conv-123', work, busyPool);
    expect(busy).toEqual({ acquired: false });
    expect(work).not.toHaveBeenCalled();
  });
});

describe('Group C security, transaction, and SaaS neutrality regressions', () => {
  it('removes agents(*) / password_hash leaks from /api/analytics', () => {
    const analyticsPath = path.resolve(process.cwd(), 'src/app/api/analytics/route.ts');
    const src = fs.readFileSync(analyticsPath, 'utf-8');
    expect(src).not.toContain('agents(*)');
    expect(src).not.toContain("from('agents').select('*')");
    expect(src).toContain('id, name, avatar_url, email, role, status');
  });

  it('executes /api/conversations/merge inside a PostgreSQL transaction with row locks', () => {
    const mergePath = path.resolve(process.cwd(), 'src/app/api/conversations/merge/route.ts');
    const src = fs.readFileSync(mergePath, 'utf-8');
    expect(src).toContain('BEGIN');
    expect(src).toContain('FOR UPDATE');
    expect(src).toContain('COMMIT');
    expect(src).toContain('ROLLBACK');
  });

  it('keeps AI retrieval, coverage, and router prompts domain-neutral for multi-tenant SaaS', () => {
    for (const rel of [
      'src/lib/ai/semantic-retrieval.ts',
      'src/lib/ai/coverage.ts',
      'src/lib/ai/router-assist.ts',
    ]) {
      const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf-8');
      expect(content.toLowerCase()).not.toContain('prop-trading');
      expect(content.toLowerCase()).not.toContain('prop firm');
    }
  });
});

