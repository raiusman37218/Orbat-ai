import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryRowsMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/lib/db', () => ({
  queryRows: (...args: any[]) => queryRowsMock(...args),
}));

vi.mock('@/lib/supabase/service', () => ({
  serviceClient: () => ({
    rpc: (...args: any[]) => rpcMock(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: async () => ({ data: [], error: null }),
          }),
          eq: () => ({
            order: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

import { executeWidgetFallback, WidgetFallbackHttpError } from './proxy-fallback';

const WS_ID = '11111111-1111-4111-8111-111111111111';
const VISITOR_ID = '22222222-2222-4222-8222-222222222222';
const CONV_ID = '33333333-3333-4333-8333-333333333333';

describe('executeWidgetFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://noop.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('returns workspace config for GET config when Neon returns row', async () => {
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

  it('falls back to Supabase when configured and workspace does not exist in Neon', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    const sbCfg = { id: WS_ID, name: 'Zen-try' };
    queryRowsMock
      .mockResolvedValueOnce([{ data: null }]) // Neon fn_get_workspace_config
      .mockResolvedValueOnce([]); // neonRecordExists('workspaces', WS_ID) -> false
    rpcMock.mockResolvedValueOnce({ data: sbCfg, error: null });

    const res = await executeWidgetFallback('rpc/fn_get_workspace_config', 'POST', new URLSearchParams(), {
      p_workspace_id: WS_ID,
    });

    expect(res).toEqual(sbCfg);
    expect(rpcMock).toHaveBeenCalledWith('fn_get_workspace_config', { p_workspace_id: WS_ID });
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

