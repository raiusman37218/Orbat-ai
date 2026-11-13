"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const realtime_gateway_1 = require("./realtime.gateway");
const realtime_service_1 = require("./realtime.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
(0, vitest_1.describe)('Realtime & Guard Security Hardening', () => {
    let gateway;
    let realtimeService;
    let mockJwt;
    let mockConfig;
    let mockMessagesService;
    let mockDb;
    let mockServer;
    const WS_ID = '11111111-1111-4111-8111-111111111111';
    const VISITOR_ID = '22222222-2222-4222-8222-222222222222';
    const CONV_ID = '33333333-3333-4333-8333-333333333333';
    (0, vitest_1.beforeEach)(() => {
        (0, jwt_auth_guard_1.clearAuthStateCache)();
        mockJwt = { verifyAsync: vitest_1.vi.fn() };
        mockConfig = { get: vitest_1.vi.fn().mockReturnValue('test-secret-with-sufficient-length-for-jwt') };
        mockMessagesService = { sendMessage: vitest_1.vi.fn(), markAsRead: vitest_1.vi.fn() };
        mockDb = { query: vitest_1.vi.fn(), transaction: vitest_1.vi.fn() };
        mockServer = { to: vitest_1.vi.fn().mockReturnThis(), emit: vitest_1.vi.fn() };
        realtimeService = new realtime_service_1.RealtimeService();
        realtimeService.setServer(mockServer);
        gateway = new realtime_gateway_1.RealtimeGateway(mockJwt, mockConfig, realtimeService, mockMessagesService, mockDb);
        gateway.afterInit(mockServer);
    });
    (0, vitest_1.it)('rejects visitor socket missing visitorToken', async () => {
        const socket = {
            id: 'sock-no-token',
            handshake: { auth: { visitorId: VISITOR_ID, workspaceId: WS_ID }, headers: {} },
            data: {},
            disconnect: vitest_1.vi.fn(),
            join: vitest_1.vi.fn(),
        };
        await gateway.handleConnection(socket);
        (0, vitest_1.expect)(socket.disconnect).toHaveBeenCalledWith(true);
        (0, vitest_1.expect)(socket.data.type).toBeUndefined();
    });
    (0, vitest_1.it)('rejects visitor socket when fn_widget_auth fails or workspace mismatches', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [] });
        const socket = {
            id: 'sock-bad-token',
            handshake: {
                auth: { visitorId: VISITOR_ID, visitorToken: 'vtok_tampered', workspaceId: WS_ID },
                headers: {},
            },
            data: {},
            disconnect: vitest_1.vi.fn(),
            join: vitest_1.vi.fn(),
        };
        await gateway.handleConnection(socket);
        (0, vitest_1.expect)(socket.disconnect).toHaveBeenCalledWith(true);
        (0, vitest_1.expect)(socket.data.visitorId).toBeUndefined();
    });
    (0, vitest_1.it)('rejects deactivated agent WebSocket connection', async () => {
        mockJwt.verifyAsync.mockResolvedValueOnce({
            sub: 'ag-deactivated',
            email: 'gone@example.com',
            role: 'agent',
            workspaceId: WS_ID,
        });
        mockDb.query.mockResolvedValueOnce({
            rows: [{ is_active: false, role: 'agent', workspace_id: WS_ID, is_super_admin: false }],
        });
        const socket = {
            id: 'sock-deactivated',
            handshake: { auth: { token: 'valid-jwt' }, headers: {} },
            data: {},
            disconnect: vitest_1.vi.fn(),
            join: vitest_1.vi.fn(),
        };
        await gateway.handleConnection(socket);
        (0, vitest_1.expect)(socket.disconnect).toHaveBeenCalledWith(true);
        (0, vitest_1.expect)(socket.join).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('blocks unauthorized typing:start and typing:stop across conversations', async () => {
        mockDb.query.mockResolvedValue({ rows: [] });
        const socket = {
            data: {
                type: 'visitor',
                workspaceId: WS_ID,
                visitorId: VISITOR_ID,
            },
            rooms: new Set(),
            to: vitest_1.vi.fn().mockReturnThis(),
            emit: vitest_1.vi.fn(),
        };
        await (0, vitest_1.expect)(gateway.handleTypingStart(socket, { conversationId: CONV_ID })).rejects.toThrow(websockets_1.WsException);
        await (0, vitest_1.expect)(gateway.handleTypingStop(socket, { conversationId: CONV_ID })).rejects.toThrow(websockets_1.WsException);
        (0, vitest_1.expect)(socket.emit).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('blocks visitor A from sending a message to visitor B conversation in same workspace', async () => {
        mockDb.query.mockResolvedValueOnce({
            rows: [{ id: CONV_ID, visitor_id: '44444444-4444-4444-8444-444444444444' }],
        });
        const socket = {
            data: {
                type: 'visitor',
                workspaceId: WS_ID,
                visitorId: VISITOR_ID,
            },
            rooms: new Set(),
        };
        await (0, vitest_1.expect)(gateway.handleSendMessage(socket, { conversationId: CONV_ID, content: 'hijack' })).rejects.toThrow(websockets_1.WsException);
        (0, vitest_1.expect)(mockMessagesService.sendMessage).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('rejects deactivated agents in JwtAuthGuard and honors cache invalidation', async () => {
        const reflector = { getAllAndOverride: vitest_1.vi.fn().mockReturnValue(false) };
        const guard = new jwt_auth_guard_1.JwtAuthGuard(mockJwt, mockConfig, reflector, mockDb);
        const makeCtx = () => ({
            getHandler: vitest_1.vi.fn(),
            getClass: vitest_1.vi.fn(),
            switchToHttp: () => ({
                getRequest: () => ({ headers: { authorization: 'Bearer jwt-token' } }),
            }),
        });
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
        await (0, vitest_1.expect)(guard.canActivate(makeCtx())).resolves.toBe(true);
        (0, jwt_auth_guard_1.invalidateAuthStateCache)('ag-1');
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
        await (0, vitest_1.expect)(guard.canActivate(makeCtx())).rejects.toThrow(common_1.UnauthorizedException);
    });
});
//# sourceMappingURL=realtime.security.spec.js.map