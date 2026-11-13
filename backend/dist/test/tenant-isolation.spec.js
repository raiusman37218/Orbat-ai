"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const tenant_guard_1 = require("../src/common/guards/tenant.guard");
const conversations_service_1 = require("../src/conversations/conversations.service");
const messages_service_1 = require("../src/messages/messages.service");
const attachments_service_1 = require("../src/attachments/attachments.service");
const realtime_gateway_1 = require("../src/realtime/realtime.gateway");
const realtime_service_1 = require("../src/realtime/realtime.service");
(0, vitest_1.describe)('Multi-Tenant Isolation Verification', () => {
    let tenantGuard;
    let conversationsService;
    let messagesService;
    let attachmentsService;
    let realtimeGateway;
    let mockDb;
    let mockStorage;
    const WORKSPACE_A = '11111111-1111-1111-1111-111111111111';
    const WORKSPACE_B = '22222222-2222-2222-2222-222222222222';
    const CONVERSATION_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    (0, vitest_1.beforeEach)(() => {
        mockDb = {
            query: vitest_1.vi.fn(),
            transaction: vitest_1.vi.fn(),
        };
        mockStorage = {
            getPresignedUploadUrl: vitest_1.vi.fn(),
            getPresignedDownloadUrl: vitest_1.vi.fn(),
            deleteFile: vitest_1.vi.fn(),
            getFileMetadata: vitest_1.vi.fn(),
        };
        const mockReflector = {
            getAllAndOverride: vitest_1.vi.fn().mockReturnValue(false),
        };
        tenantGuard = new tenant_guard_1.TenantGuard(mockReflector);
        conversationsService = new conversations_service_1.ConversationsService(mockDb);
        messagesService = new messages_service_1.MessagesService(mockDb);
        attachmentsService = new attachments_service_1.AttachmentsService(mockDb, mockStorage);
        const realtimeService = new realtime_service_1.RealtimeService();
        realtimeGateway = new realtime_gateway_1.RealtimeGateway({ verifyAsync: vitest_1.vi.fn() }, { get: vitest_1.vi.fn() }, realtimeService, messagesService, mockDb);
    });
    function createMockContext(request) {
        return {
            switchToHttp: () => ({
                getRequest: () => request,
            }),
            getHandler: vitest_1.vi.fn(),
            getClass: vitest_1.vi.fn(),
        };
    }
    (0, vitest_1.describe)('TenantGuard Boundary Enforcement', () => {
        (0, vitest_1.it)('should REJECT an agent from Workspace A trying to access Workspace B via URL parameter', () => {
            const mockContext = createMockContext({
                params: { workspaceId: WORKSPACE_B },
                user: {
                    id: 'agent-1',
                    email: 'agent@corp-a.com',
                    role: 'agent',
                    workspaceId: WORKSPACE_A,
                },
            });
            (0, vitest_1.expect)(() => tenantGuard.canActivate(mockContext)).toThrow(common_1.ForbiddenException);
        });
        (0, vitest_1.it)('should REJECT an agent from Workspace A trying to access Workspace B via x-workspace-id header', () => {
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
            (0, vitest_1.expect)(() => tenantGuard.canActivate(mockContext)).toThrow(common_1.ForbiddenException);
        });
        (0, vitest_1.it)('should ALLOW access when workspaceId matches agent authenticated workspace', () => {
            const mockContext = createMockContext({
                params: { workspaceId: WORKSPACE_A },
                user: {
                    id: 'agent-1',
                    email: 'agent@corp-a.com',
                    role: 'agent',
                    workspaceId: WORKSPACE_A,
                },
            });
            (0, vitest_1.expect)(tenantGuard.canActivate(mockContext)).toBe(true);
        });
    });
    (0, vitest_1.describe)('Conversations Cross-Tenant Protection', () => {
        (0, vitest_1.it)('should throw NotFoundException when Workspace A queries Conversation of Workspace B', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            await (0, vitest_1.expect)(conversationsService.getConversationById(WORKSPACE_A, CONVERSATION_B)).rejects.toThrow(common_1.NotFoundException);
            (0, vitest_1.expect)(mockDb.query).toHaveBeenCalledWith(vitest_1.expect.stringContaining('WHERE c.id = $1 AND c.workspace_id = $2'), [CONVERSATION_B, WORKSPACE_A]);
        });
    });
    (0, vitest_1.describe)('Messages Cross-Tenant Protection', () => {
        (0, vitest_1.it)('should prevent sending messages to conversations outside the tenant workspace', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            await (0, vitest_1.expect)(messagesService.sendMessage(WORKSPACE_A, CONVERSATION_B, {
                content: 'Malicious probe',
            })).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)('should prevent fetching messages for conversations outside tenant workspace', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            await (0, vitest_1.expect)(messagesService.getMessages(WORKSPACE_A, CONVERSATION_B)).rejects.toThrow(common_1.NotFoundException);
        });
    });
    (0, vitest_1.describe)('Storage & Attachments Cross-Tenant Protection', () => {
        (0, vitest_1.it)('should prevent agent in Workspace A from downloading files of Workspace B', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            await (0, vitest_1.expect)(attachmentsService.getDownloadUrl(WORKSPACE_A, 'att-of-tenant-b')).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)('should prevent agent in Workspace A from deleting files of Workspace B', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            await (0, vitest_1.expect)(attachmentsService.deleteAttachment(WORKSPACE_A, 'att-of-tenant-b')).rejects.toThrow(common_1.NotFoundException);
        });
    });
    (0, vitest_1.describe)('WebSocket Cross-Tenant Protection', () => {
        (0, vitest_1.it)('should reject socket subscription to conversation outside tenant workspace', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            const mockSocket = {
                data: { workspaceId: WORKSPACE_A, type: 'agent' },
                join: vitest_1.vi.fn(),
            };
            await (0, vitest_1.expect)(realtimeGateway.handleJoinConversation(mockSocket, {
                conversationId: CONVERSATION_B,
            })).rejects.toThrow();
            (0, vitest_1.expect)(mockSocket.join).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=tenant-isolation.spec.js.map