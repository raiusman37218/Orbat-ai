"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const conversations_service_1 = require("./conversations.service");
(0, vitest_1.describe)('ConversationsService', () => {
    let service;
    let mockDb;
    const mockAgent = {
        id: 'agent-1',
        email: 'agent@example.com',
        name: 'Agent Smith',
        role: 'agent',
        workspaceId: 'ws-1',
    };
    (0, vitest_1.beforeEach)(() => {
        mockDb = {
            query: vitest_1.vi.fn(),
            transaction: vitest_1.vi.fn(),
        };
        service = new conversations_service_1.ConversationsService(mockDb);
    });
    (0, vitest_1.describe)('getConversationById', () => {
        (0, vitest_1.it)('should throw NotFoundException if conversation not found in workspace', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({ rows: [] });
            await (0, vitest_1.expect)(service.getConversationById('ws-1', 'conv-404')).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)('should return conversation details when found', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({
                rows: [
                    {
                        id: 'conv-1',
                        status: 'open',
                        priority: 'high',
                        handoff_status: 'waiting_for_agent',
                        visitor_name: 'Jane Doe',
                    },
                ],
            });
            const result = await service.getConversationById('ws-1', 'conv-1');
            (0, vitest_1.expect)(result.status).toBe('open');
            (0, vitest_1.expect)(result.visitor_name).toBe('Jane Doe');
        });
    });
    (0, vitest_1.describe)('claimHandoff', () => {
        (0, vitest_1.it)('should throw ConflictException if already claimed by someone else', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({ rows: [] });
            await (0, vitest_1.expect)(service.claimHandoff('ws-1', 'conv-1', mockAgent)).rejects.toThrow(common_1.ConflictException);
        });
        (0, vitest_1.it)('should assign conversation to agent and update status to agent_active', async () => {
            mockDb.query = vitest_1.vi
                .fn()
                .mockResolvedValueOnce({
                rows: [{ id: 'conv-1', assigned_agent_id: 'agent-1', handoff_status: 'agent_active' }],
            })
                .mockResolvedValueOnce({ rows: [] });
            const result = await service.claimHandoff('ws-1', 'conv-1', mockAgent);
            (0, vitest_1.expect)(result.assigned_agent_id).toBe('agent-1');
            (0, vitest_1.expect)(result.handoff_status).toBe('agent_active');
        });
    });
});
//# sourceMappingURL=conversations.service.spec.js.map