import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from '../src/common/guards/tenant.guard';
import { ConversationsService } from '../src/conversations/conversations.service';
import { MessagesService } from '../src/messages/messages.service';
import { AttachmentsService } from '../src/attachments/attachments.service';
import { RealtimeGateway } from '../src/realtime/realtime.gateway';
import { RealtimeService } from '../src/realtime/realtime.service';

describe('Multi-Tenant Isolation Verification', () => {
  let tenantGuard: TenantGuard;
  let conversationsService: ConversationsService;
  let messagesService: MessagesService;
  let attachmentsService: AttachmentsService;
  let realtimeGateway: RealtimeGateway;
  let mockDb: any;
  let mockStorage: any;

  const WORKSPACE_A = '11111111-1111-1111-1111-111111111111';
  const WORKSPACE_B = '22222222-2222-2222-2222-222222222222';
  const CONVERSATION_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(),
    };
    mockStorage = {
      getPresignedUploadUrl: vi.fn(),
      getPresignedDownloadUrl: vi.fn(),
      deleteFile: vi.fn(),
      getFileMetadata: vi.fn(),
    };

    const mockReflector: any = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    };
    tenantGuard = new TenantGuard(mockReflector);
    conversationsService = new ConversationsService(mockDb);
    messagesService = new MessagesService(mockDb);
    attachmentsService = new AttachmentsService(mockDb, mockStorage);

    const realtimeService = new RealtimeService();
    realtimeGateway = new RealtimeGateway(
      { verifyAsync: vi.fn() } as any,
      { get: vi.fn() } as any,
      realtimeService,
      messagesService,
      mockDb,
    );
  });

  function createMockContext(request: any): any {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: vi.fn(),
      getClass: vi.fn(),
    };
  }

  describe('TenantGuard Boundary Enforcement', () => {
    it('should REJECT an agent from Workspace A trying to access Workspace B via URL parameter', () => {
      const mockContext = createMockContext({
        params: { workspaceId: WORKSPACE_B },
        user: {
          id: 'agent-1',
          email: 'agent@corp-a.com',
          role: 'agent',
          workspaceId: WORKSPACE_A, // Belongs to Workspace A!
        },
      });

      expect(() => tenantGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should REJECT an agent from Workspace A trying to access Workspace B via x-workspace-id header', () => {
      const mockContext = createMockContext({
        params: {},
        headers: { 'x-workspace-id': WORKSPACE_B },
        user: {
          id: 'agent-1',
          email: 'agent@corp-a.com',
          role: 'agent',
          workspaceId: WORKSPACE_A,
        },
      });

      expect(() => tenantGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should ALLOW access when workspaceId matches agent authenticated workspace', () => {
      const mockContext = createMockContext({
        params: { workspaceId: WORKSPACE_A },
        user: {
          id: 'agent-1',
          email: 'agent@corp-a.com',
          role: 'agent',
          workspaceId: WORKSPACE_A,
        },
      });

      expect(tenantGuard.canActivate(mockContext)).toBe(true);
    });
  });

  describe('Conversations Cross-Tenant Protection', () => {
    it('should throw NotFoundException when Workspace A queries Conversation of Workspace B', async () => {
      // DB returns empty when scoped by workspace_id = WORKSPACE_A
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        conversationsService.getConversationById(WORKSPACE_A, CONVERSATION_B),
      ).rejects.toThrow(NotFoundException);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE c.id = $1 AND c.workspace_id = $2'),
        [CONVERSATION_B, WORKSPACE_A],
      );
    });
  });

  describe('Messages Cross-Tenant Protection', () => {
    it('should prevent sending messages to conversations outside the tenant workspace', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // Conversation not found in Workspace A

      await expect(
        messagesService.sendMessage(WORKSPACE_A, CONVERSATION_B, {
          content: 'Malicious probe',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent fetching messages for conversations outside tenant workspace', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        messagesService.getMessages(WORKSPACE_A, CONVERSATION_B),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Storage & Attachments Cross-Tenant Protection', () => {
    it('should prevent agent in Workspace A from downloading files of Workspace B', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // Attachment not in Workspace A

      await expect(
        attachmentsService.getDownloadUrl(WORKSPACE_A, 'att-of-tenant-b'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent agent in Workspace A from deleting files of Workspace B', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        attachmentsService.deleteAttachment(WORKSPACE_A, 'att-of-tenant-b'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('WebSocket Cross-Tenant Protection', () => {
    it('should reject socket subscription to conversation outside tenant workspace', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const mockSocket: any = {
        data: { workspaceId: WORKSPACE_A, type: 'agent' },
        join: vi.fn(),
      };

      await expect(
        realtimeGateway.handleJoinConversation(mockSocket, {
          conversationId: CONVERSATION_B,
        }),
      ).rejects.toThrow();

      expect(mockSocket.join).not.toHaveBeenCalled();
    });
  });
});
