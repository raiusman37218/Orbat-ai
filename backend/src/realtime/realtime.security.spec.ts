import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WsException } from '@nestjs/websockets';
import { UnauthorizedException } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { JwtAuthGuard, clearAuthStateCache, invalidateAuthStateCache } from '../auth/guards/jwt-auth.guard';

describe('Realtime & Guard Security Hardening', () => {
  let gateway: RealtimeGateway;
  let realtimeService: RealtimeService;
  let mockJwt: any;
  let mockConfig: any;
  let mockMessagesService: any;
  let mockDb: any;
  let mockServer: any;

  const WS_ID = '11111111-1111-4111-8111-111111111111';
  const VISITOR_ID = '22222222-2222-4222-8222-222222222222';
  const CONV_ID = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    clearAuthStateCache();
    mockJwt = { verifyAsync: vi.fn() };
    mockConfig = { get: vi.fn().mockReturnValue('test-secret-with-sufficient-length-for-jwt') };
    mockMessagesService = { sendMessage: vi.fn(), markAsRead: vi.fn() };
    mockDb = { query: vi.fn(), transaction: vi.fn() };
    mockServer = { to: vi.fn().mockReturnThis(), emit: vi.fn() };

    realtimeService = new RealtimeService();
    realtimeService.setServer(mockServer);

    gateway = new RealtimeGateway(
      mockJwt,
      mockConfig,
      realtimeService,
      mockMessagesService,
      mockDb,
    );
    gateway.afterInit(mockServer);
  });

  it('rejects visitor socket missing visitorToken', async () => {
    const socket: any = {
      id: 'sock-no-token',
      handshake: { auth: { visitorId: VISITOR_ID, workspaceId: WS_ID }, headers: {} },
      data: {},
      disconnect: vi.fn(),
      join: vi.fn(),
    };

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.data.type).toBeUndefined();
  });

  it('rejects visitor socket when fn_widget_auth fails or workspace mismatches', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    const socket: any = {
      id: 'sock-bad-token',
      handshake: {
        auth: { visitorId: VISITOR_ID, visitorToken: 'vtok_tampered', workspaceId: WS_ID },
        headers: {},
      },
      data: {},
      disconnect: vi.fn(),
      join: vi.fn(),
    };

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.data.visitorId).toBeUndefined();
  });

  it('rejects deactivated agent WebSocket connection', async () => {
    mockJwt.verifyAsync.mockResolvedValueOnce({
      sub: 'ag-deactivated',
      email: 'gone@example.com',
      role: 'agent',
      workspaceId: WS_ID,
    });
    mockDb.query.mockResolvedValueOnce({
      rows: [{ is_active: false, role: 'agent', workspace_id: WS_ID, is_super_admin: false }],
    });

    const socket: any = {
      id: 'sock-deactivated',
      handshake: { auth: { token: 'valid-jwt' }, headers: {} },
      data: {},
      disconnect: vi.fn(),
      join: vi.fn(),
    };

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('blocks unauthorized typing:start and typing:stop across conversations', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    const socket: any = {
      data: {
        type: 'visitor',
        workspaceId: WS_ID,
        visitorId: VISITOR_ID,
      },
      rooms: new Set(),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    await expect(
      gateway.handleTypingStart(socket, { conversationId: CONV_ID }),
    ).rejects.toThrow(WsException);

    await expect(
      gateway.handleTypingStop(socket, { conversationId: CONV_ID }),
    ).rejects.toThrow(WsException);

    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('blocks visitor A from sending a message to visitor B conversation in same workspace', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: CONV_ID, visitor_id: '44444444-4444-4444-8444-444444444444' }],
    });

    const socket: any = {
      data: {
        type: 'visitor',
        workspaceId: WS_ID,
        visitorId: VISITOR_ID,
      },
      rooms: new Set(),
    };

    await expect(
      gateway.handleSendMessage(socket, { conversationId: CONV_ID, content: 'hijack' }),
    ).rejects.toThrow(WsException);
    expect(mockMessagesService.sendMessage).not.toHaveBeenCalled();
  });

  it('rejects deactivated agents in JwtAuthGuard and honors cache invalidation', async () => {
    const reflector: any = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const guard = new JwtAuthGuard(mockJwt, mockConfig, reflector, mockDb);

    const makeCtx = () =>
      ({
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization: 'Bearer jwt-token' } }),
        }),
      }) as any;

    mockJwt.verifyAsync.mockResolvedValue({
      sub: 'ag-1',
      email: 'ag@example.com',
      role: 'agent',
      workspaceId: WS_ID,
    });
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          is_active: true,
          role: 'agent',
          workspace_id: WS_ID,
          is_super_admin: false,
          is_suspended: false,
          deleted_at: null,
        },
      ],
    });

    await expect(guard.canActivate(makeCtx())).resolves.toBe(true);

    invalidateAuthStateCache('ag-1');
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          is_active: false,
          role: 'agent',
          workspace_id: WS_ID,
          is_super_admin: false,
          is_suspended: false,
          deleted_at: null,
        },
      ],
    });

    await expect(guard.canActivate(makeCtx())).rejects.toThrow(UnauthorizedException);
  });
});

