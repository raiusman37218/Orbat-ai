"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const messages_service_1 = require("./messages.service");
(0, vitest_1.describe)('MessagesService', () => {
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
        service = new messages_service_1.MessagesService(mockDb);
    });
    (0, vitest_1.describe)('getMessages', () => {
        (0, vitest_1.it)('should throw NotFoundException if conversation not found in workspace', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({ rows: [] });
            await (0, vitest_1.expect)(service.getMessages('ws-1', 'conv-404')).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)('should return message list when conversation belongs to workspace', async () => {
            mockDb.query = vitest_1.vi
                .fn()
                .mockResolvedValueOnce({ rows: [{ id: 'conv-1' }] })
                .mockResolvedValueOnce({
                rows: [
                    { id: 'm1', content: 'Hello', sender_type: 'visitor' },
                    { id: 'm2', content: 'Hi there!', sender_type: 'agent' },
                ],
            });
            const messages = await service.getMessages('ws-1', 'conv-1');
            (0, vitest_1.expect)(messages).toHaveLength(2);
            (0, vitest_1.expect)(messages[0].content).toBe('Hello');
        });
    });
    (0, vitest_1.describe)('sendMessage', () => {
        (0, vitest_1.it)('should return existing message if idempotency key matches', async () => {
            mockDb.query = vitest_1.vi
                .fn()
                .mockResolvedValueOnce({ rows: [{ id: 'conv-1' }] })
                .mockResolvedValueOnce({
                rows: [{ id: 'existing-msg', content: 'Duplicate test', created_at: '2026-11-09T10:00:00Z' }],
            });
            const result = await service.sendMessage('ws-1', 'conv-1', { content: 'Duplicate test', idempotencyKey: 'idem-123' }, mockAgent);
            (0, vitest_1.expect)(result.id).toBe('existing-msg');
        });
    });
});
//# sourceMappingURL=messages.service.spec.js.map