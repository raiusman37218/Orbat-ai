import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryRowsMock = vi.fn();

vi.mock('@/lib/db', () => ({
  queryRows: (...args: any[]) => queryRowsMock(...args),
}));

import { executeWidgetFallback, WidgetFallbackHttpError } from './proxy-fallback';

const WS_ID = '11111111-1111-4111-8111-111111111111';
const VISITOR_ID = '22222222-2222-4222-8222-222222222222';
const CONV_ID = '33333333-3333-4333-8333-333333333333';

describe('executeWidgetFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
  });

  it('returns workspace config for GET config when PostgreSQL returns row', async () => {
    const mockCfg = { id: WS_ID, name: 'Acme Support', brand_color: '#2563eb' };
    queryRowsMock.mockResolvedValueOnce([{ data: mockCfg }]);

    const res = await executeWidgetFallback(
      'config',
      'GET',
      new URLSearchParams({ workspaceId: WS_ID }),
      {}
    );

    expect(res).toEqual(mockCfg);
    expect(queryRowsMock).toHaveBeenCalledWith(
      'SELECT public.fn_get_workspace_config($1::uuid) AS data',
      [WS_ID]
    );
  });

  it('throws 404 WidgetFallbackHttpError when workspace config is null', async () => {
    queryRowsMock.mockResolvedValueOnce([{ data: null }]);

    await expect(
      executeWidgetFallback('rpc/fn_get_workspace_config', 'POST', new URLSearchParams(), {
        p_workspace_id: WS_ID,
      })
    ).rejects.toMatchObject({
      status: 404,
      message: 'Workspace not found or unavailable.',
    });
  });

  it('attaches socket_url to workspace config when backend socket URL is configured', async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://rt.orbatai.com/api/v1';
    queryRowsMock.mockResolvedValueOnce([{ data: { id: WS_ID, name: 'Zen-try' } }]);

    const res = await executeWidgetFallback('rpc/fn_get_workspace_config', 'POST', new URLSearchParams(), {
      p_workspace_id: WS_ID,
    });

    expect(res).toEqual({ id: WS_ID, name: 'Zen-try', socket_url: 'https://rt.orbatai.com' });
  });

  it('rejects invalid UUID and unsupported RPC functions with 400', async () => {
    await expect(
      executeWidgetFallback('config', 'GET', new URLSearchParams({ workspaceId: 'bad-id' }), {})
    ).rejects.toBeInstanceOf(WidgetFallbackHttpError);

    await expect(
      executeWidgetFallback('rpc/fn_not_allowed', 'POST', new URLSearchParams(), {})
    ).rejects.toMatchObject({ status: 400 });
  });

  it('validates CSAT rating range cleanly', async () => {
    await expect(
      executeWidgetFallback('csat', 'POST', new URLSearchParams(), {
        visitorId: VISITOR_ID,
        token: 'tok-1',
        conversationId: CONV_ID,
        rating: 6,
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('maps Postgres rate_limited errors to 429', async () => {
    queryRowsMock.mockRejectedValueOnce({ code: 'P0001', message: 'rate_limited' });

    await expect(
      executeWidgetFallback('rpc/fn_widget_session', 'POST', new URLSearchParams(), {
        p_workspace_id: WS_ID,
        p_visitor_id: VISITOR_ID,
        p_token: null,
      })
    ).rejects.toMatchObject({ status: 429 });
  });
});

