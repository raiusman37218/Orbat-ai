import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

describe('Realtime Module', () => {
  let gateway: RealtimeGateway;
  let service: RealtimeService;
  let mockServer: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockMessagesService: any;
  let mockDb: any;

  beforeEach(() => {
    mockServer = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    service = new RealtimeService();
    service.setServer(mockServer);

    mockJwtService = {
      verifyAsync: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn().mockReturnValue('test-jwt-secret'),
    };

    mockMessagesService = {
      sendMessage: vi.fn(),
      markAsRead: vi.fn().mockResolvedValue({ markedCount: 2 }),
    };

    mockDb = {
      query: vi.fn(),
    };

    gateway = new RealtimeGateway(
      mockJwtService,
      mockConfigService,
      service,
      mockMessagesService,
      mockDb,
    );
    gateway.server = mockServer;
  });

  describe('RealtimeService', () => {
    it('should emit to conversation room', () => {
      service.emitToConversation('conv-1', 'test:event', { foo: 'bar' });
      expect(mockServer.to).toHaveBeenCalledWith('conversation:conv-1');
      expect(mockServer.emit).toHaveBeenCalledWith('test:event', { foo: 'bar' });
    });

    it('should emit to workspace room', () => {
      service.emitToWorkspace('ws-1', 'workspace:event', { ok: true });
      expect(mockServer.to).toHaveBeenCalledWith('workspace:ws-1');
      expect(mockServer.emit).toHaveBeenCalledWith('workspace:event', { ok: true });
    });

    it('should broadcast typing and presence updates', () => {
      service.broadcastTyping('conv-1', { userId: 'u-1', userName: 'Alice', isTyping: true });
      expect(mockServer.to).toHaveBeenCalledWith('conversation:conv-1');
      expect(mockServer.emit).toHaveBeenCalledWith('typing:update', expect.objectContaining({
        conversationId: 'conv-1',
        isTyping: true,
      }));

      service.broadcastPresence('ws-1', { userId: 'u-1', status: 'online' });
      expect(mockServer.to).toHaveBeenCalledWith('workspace:ws-1');
      expect(mockServer.emit).toHaveBeenCalledWith('presence:update', expect.objectContaining({
        userId: 'u-1',
        status: 'online',
      }));
    });
  });

  describe('RealtimeGateway Connection & Authentication', () => {
    it('should authenticate agent socket and join workspace room', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'agent-123',
        email: 'agent@example.com',
        role: 'agent',
        workspaceId: 'ws-1',
        name: 'Agent Smith',
      });

      const mockSocket: any = {
        id: 'sock-1',
        handshake: {
          auth: { token: 'valid-agent-token' },
          headers: {},
        },
        data: {},
        join: vi.fn(),
        disconnect: vi.fn(),
      };

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.data.type).toBe('agent');
      expect(mockSocket.data.workspaceId).toBe('ws-1');
      expect(mockSocket.join).toHaveBeenCalledWith('workspace:ws-1');
      expect(mockSocket.join).toHaveBeenCalledWith('user:agent-123');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should authenticate visitor socket with visitorId and workspaceId', async () => {
      const mockSocket: any = {
        id: 'sock-2',
        handshake: {
          auth: { visitorId: 'vis-456', workspaceId: 'ws-1' },
          headers: {},
        },
        data: {},
        join: vi.fn(),
        disconnect: vi.fn(),
      };

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.data.type).toBe('visitor');
      expect(mockSocket.data.visitorId).toBe('vis-456');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated connections', async () => {
      const mockSocket: any = {
        id: 'sock-3',
        handshake: { auth: {}, headers: {} },
        data: {},
        join: vi.fn(),
        disconnect: vi.fn(),
      };

      await gateway.handleConnection(mockSocket);
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('Conversation events & messaging', () => {
    it('should allow joining a valid conversation within workspace', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'conv-1', workspace_id: 'ws-1', visitor_id: 'vis-1' }],
      });

      const mockSocket: any = {
        data: { workspaceId: 'ws-1', type: 'agent' },
        join: vi.fn(),
      };

      const res = await gateway.handleJoinConversation(mockSocket, { conversationId: 'conv-1' });
      expect(res.status).toBe('joined');
      expect(mockSocket.join).toHaveBeenCalledWith('conversation:conv-1');
    });

    it('should send a message, save via MessagesService, and broadcast', async () => {
      const mockMsg = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        content: 'Hello world',
        sender_type: 'agent',
      };
      mockMessagesService.sendMessage.mockResolvedValue(mockMsg);

      const mockSocket: any = {
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

      expect(res.success).toBe(true);
      expect(mockMessagesService.sendMessage).toHaveBeenCalledWith(
        'ws-1',
        'conv-1',
        expect.objectContaining({ content: 'Hello world', senderType: 'agent' }),
        expect.any(Object),
      );
      expect(mockServer.to).toHaveBeenCalledWith('conversation:conv-1');
      expect(mockServer.emit).toHaveBeenCalledWith('message:new', mockMsg);
    });

    it('should mark messages as read and broadcast to room', async () => {
      const mockSocket: any = {
        data: { workspaceId: 'ws-1', type: 'agent' },
      };

      const res = await gateway.handleMessageRead(mockSocket, { conversationId: 'conv-1' });
      expect(res?.markedCount).toBe(2);
      expect(mockServer.to).toHaveBeenCalledWith('conversation:conv-1');
      expect(mockServer.emit).toHaveBeenCalledWith('message:read', expect.objectContaining({
        conversationId: 'conv-1',
        readBy: 'agent',
        markedCount: 2,
      }));
    });
  });
});

