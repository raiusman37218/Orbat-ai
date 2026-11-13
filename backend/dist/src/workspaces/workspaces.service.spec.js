"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const workspaces_service_1 = require("./workspaces.service");
(0, vitest_1.describe)('WorkspacesService', () => {
    let service;
    let mockDb;
    (0, vitest_1.beforeEach)(() => {
        mockDb = {
            query: vitest_1.vi.fn(),
        };
        service = new workspaces_service_1.WorkspacesService(mockDb);
    });
    (0, vitest_1.describe)('getWorkspace', () => {
        (0, vitest_1.it)('should throw NotFoundException if workspace does not exist', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({ rows: [] });
            await (0, vitest_1.expect)(service.getWorkspace('ws-unknown')).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)('should return workspace details when found', async () => {
            const mockWs = {
                id: 'ws-1',
                name: 'Acme Corp',
                brand_color: '#3B82F6',
                greeting_title: 'Welcome',
            };
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({ rows: [mockWs] });
            const result = await service.getWorkspace('ws-1');
            (0, vitest_1.expect)(result.name).toBe('Acme Corp');
            (0, vitest_1.expect)(result.brand_color).toBe('#3B82F6');
        });
    });
    (0, vitest_1.describe)('getWorkspaceStats', () => {
        (0, vitest_1.it)('should aggregate conversation and agent metrics correctly', async () => {
            mockDb.query = vitest_1.vi
                .fn()
                .mockResolvedValueOnce({
                rows: [{ open_conversations: '5', closed_conversations: '20', waiting_handoffs: '2', offline_queued: '1' }],
            })
                .mockResolvedValueOnce({
                rows: [{ total_agents: '4', online_agents: '3', away_agents: '1' }],
            })
                .mockResolvedValueOnce({
                rows: [{ total_visitors: '150', online_visitors: '12' }],
            });
            const stats = await service.getWorkspaceStats('ws-1');
            (0, vitest_1.expect)(stats.conversations.open).toBe(5);
            (0, vitest_1.expect)(stats.conversations.waitingHandoff).toBe(2);
            (0, vitest_1.expect)(stats.agents.online).toBe(3);
            (0, vitest_1.expect)(stats.visitors.online).toBe(12);
        });
    });
});
//# sourceMappingURL=workspaces.service.spec.js.map