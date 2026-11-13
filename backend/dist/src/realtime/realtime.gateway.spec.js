"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const realtime_gateway_1 = require("./realtime.gateway");
const realtime_service_1 = require("./realtime.service");
(0, vitest_1.describe)('Realtime Module', () => {
    let gateway;
    let service;
    let mockServer;
    let mockJwtService;
    let mockConfigService;
    let mockMessagesService;
    let mockDb;
    (0, vitest_1.beforeEach)(() => {
        mockServer = {
            to: vitest_1.vi.fn().mockReturnThis(),
            emit: vitest_1.vi.fn(),
        };
        service = new realtime_service_1.RealtimeService();
        service.setServer(mockServer);
        mockJwtService = {
            verifyAsync: vitest_1.vi.fn(),
        };
        mockConfigService = {
            get: vitest_1.vi.fn().mockReturnValue('test-jwt-secret'),
        };
        mockMessagesService = {
            sendMessage: vitest_1.vi.fn(),
            markAsRead: vitest_1.vi.fn().mockResolvedValue({ markedCount: 2 }),
        };
        mockDb = {
            query: vitest_1.vi.fn(),
        };
        gateway = new realtime_gateway_1.RealtimeGateway(mockJwtService, mockConfigService, service, mockMessagesService, mockDb);
        gateway.server = mockServer;
    });
    (0, vitest_1.describe)('RealtimeService', () => {
        (0, vitest_1.it)('should emit to conversation room', () => {
            service.emitToConversation('conv-1', 'test:event', { foo: 'bar' });
            (0, vitest_1.expect)(mockServer.to).toHaveBeenCalledWith('conversation:conv-1');
            (0, vitest_1.expect)(mockServer.emit).toHaveBeenCalledWith('test:event', { foo: 'bar' });
        });
        (0, vitest_1.it)('should emit to workspace room', () => {
            service.emitToWorkspace('ws-1', 'workspace:event', { ok: true });
            (0, vitest_1.expect)(mockServer.to).toHaveBeenCalledWith('workspace:ws-1');
            (0, vitest_1.expect)(mockServer.emit).toHaveBeenCalledWith('workspace:event', { ok: true });
        });
        (0, vitest_1.it)('should broadcast typing and presence updates', () => {
            service.broadcastTyping('conv-1', { userId: 'u-1', userName: 'Alice', isTyping: true });
            (0, vitest_1.expect)(mockServer.to).toHaveBeenCalledWith('conversation:conv-1');
            (0, vitest_1.expect)(mockServer.emit).toHaveBeenCalledWith('typing:update', vitest_1.expect.objectContaining({
                conversationId: 'conv-1',
                isTyping: true,
            }));
            service.broadcastPresence('ws-1', { userId: 'u-1', status: 'online' });
            (0, vitest_1.expect)(mockServer.to).toHaveBeenCalledWith('workspace:ws-1');
            (0, vitest_1.expect)(mockServer.emit).toHaveBeenCalledWith('presence:update', vitest_1.expect.objectContaining({
                userId: 'u-1',
                status: 'online',
            }));
        });
    });
    (0, vitest_1.describe)('RealtimeGateway Connection & Authentication', () => {
        (0, vitest_1.it)('should authenticate agent socket and join workspace room', async () => {
            mockJwtService.verifyAsync.mockResolvedValue({
                sub: 'agent-123',
                email: 'agent@example.com',
                role: 'agent',
                workspaceId: 'ws-1',
                name: 'Agent Smith',
            });
            const mockSocket = {
                id: 'sock-1',
                handshake: {
                    auth: { token: 'valid-agent-token' },
                    headers: {},
                },
                data: {},
                join: vitest_1.vi.fn(),
                disconnect: vitest_1.vi.fn(),
            };
            await gateway.handleConnection(mockSocket);
            (0, vitest_1.expect)(mockSocket.data.type).toBe('agent');
            (0, vitest_1.expect)(mockSocket.data.workspaceId).toBe('ws-1');
            (0, vitest_1.expect)(mockSocket.join).toHaveBeenCalledWith('workspace:ws-1');
            (0, vitest_1.expect)(mockSocket.join).toHaveBeenCalledWith('user:agent-123');
            (0, vitest_1.expect)(mockSocket.disconnect).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)('should authenticate visitor socket with visitorId and workspaceId', async () => {
            const mockSocket = {
                id: 'sock-2',
                handshake: {
                    auth: { visitorId: 'vis-456', workspaceId: 'ws-1' },
                    headers: {},
                },
                data: {},
                join: vitest_1.vi.fn(),
                disconnect: vitest_1.vi.fn(),
            };
            await gateway.handleConnection(mockSocket);
            (0, vitest_1.expect)(mockSocket.data.type).toBe('visitor');
            (0, vitest_1.expect)(mockSocket.data.visitorId).toBe('vis-456');
            (0, vitest_1.expect)(mockSocket.disconnect).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)('should reject unauthenticated connections', async () => {
            const mockSocket = {
                id: 'sock-3',
                handshake: { auth: {}, headers: {} },
                data: {},
                join: vitest_1.vi.fn(),
                disconnect: vitest_1.vi.fn(),
            };
            await gateway.handleConnection(mockSocket);
            (0, vitest_1.expect)(mockSocket.disconnect).toHaveBeenCalledWith(true);
        });
    });
    (0, vitest_1.describe)('Conversation events & messaging', () => {
        (0, vitest_1.it)('should allow joining a valid conversation within workspace', async () => {
            mockDb.query.mockResolvedValueOnce({
                rows: [{ id: 'conv-1', workspace_id: 'ws-1', visitor_id: 'vis-1' }],
            });
            const mockSocket = {
                data: { workspaceId: 'ws-1', type: 'agent' },
                join: vitest_1.vi.fn(),
            };
            const res = await gateway.handleJoinConversation(mockSocket, { conversationId: 'conv-1' });
            (0, vitest_1.expect)(res.status).toBe('joined');
            (0, vitest_1.expect)(mockSocket.join).toHaveBeenCalledWith('conversation:conv-1');
        });
        (0, vitest_1.it)('should send a message, save via MessagesService, and broadcast', async () => {
            const mockMsg = {
                id: 'msg-1',
                conversation_id: 'conv-1',
                content: 'Hello world',
                sender_type: 'agent',
            };
            mockMessagesService.sendMessage.mockResolvedValue(mockMsg);
            const mockSocket = {
                data: {
                    workspaceId: 'ws-1',
                    type: 'agent',
                    user: { sub: 'ag-1', email: 'ag@test.com', role: 'agent' },
                },
            };
            const res = await gateway.handleSendMessage(mockSocket, {
                conversationId: 'conv-1',
                content: 'Hello world',
            });
            (0, vitest_1.expect)(res.success).toBe(true);
            (0, vitest_1.expect)(mockMessagesService.sendMessage).toHaveBeenCalledWith('ws-1', 'conv-1', vitest_1.expect.objectContaining({ content: 'Hello world', senderType: 'agent' }), vitest_1.expect.any(Object));
            (0, vitest_1.expect)(mockServer.to).toHaveBeenCalledWith('conversation:conv-1');
            (0, vitest_1.expect)(mockServer.emit).toHaveBeenCalledWith('message:new', mockMsg);
        });
        (0, vitest_1.it)('should mark messages as read and broadcast to room', async () => {
            const mockSocket = {
                data: { workspaceId: 'ws-1', type: 'agent' },
            };
            const res = await gateway.handleMessageRead(mockSocket, { conversationId: 'conv-1' });
            (0, vitest_1.expect)(res?.markedCount).toBe(2);
            (0, vitest_1.expect)(mockServer.to).toHaveBeenCalledWith('conversation:conv-1');
            (0, vitest_1.expect)(mockServer.emit).toHaveBeenCalledWith('message:read', vitest_1.expect.objectContaining({
                conversationId: 'conv-1',
                readBy: 'agent',
                markedCount: 2,
            }));
        });
    });
});
//# sourceMappingURL=realtime.gateway.spec.js.map