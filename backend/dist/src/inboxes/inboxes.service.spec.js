"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const inboxes_service_1 = require("./inboxes.service");
(0, vitest_1.describe)('InboxesService', () => {
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
        };
        service = new inboxes_service_1.InboxesService(mockDb);
    });
    (0, vitest_1.describe)('getInboxOverview', () => {
        (0, vitest_1.it)('should aggregate queue counts for the current user and workspace', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({
                rows: [
                    {
                        my_assigned: '3',
                        unassigned: '7',
                        waiting_handoff: '2',
                        offline_queued: '1',
                        bot_active: '15',
                        closed_today: '10',
                    },
                ],
            });
            const overview = await service.getInboxOverview('ws-1', mockAgent);
            (0, vitest_1.expect)(overview.myAssigned).toBe(3);
            (0, vitest_1.expect)(overview.unassigned).toBe(7);
            (0, vitest_1.expect)(overview.waitingHandoff).toBe(2);
            (0, vitest_1.expect)(overview.offlineQueued).toBe(1);
            (0, vitest_1.expect)(overview.botActive).toBe(15);
            (0, vitest_1.expect)(overview.closedToday).toBe(10);
        });
    });
    (0, vitest_1.describe)('autoAssignNext', () => {
        (0, vitest_1.it)('should assign to least-loaded online agent', async () => {
            mockDb.query = vitest_1.vi
                .fn()
                .mockResolvedValueOnce({
                rows: [{ id: 'agent-least-busy', name: 'Bob', active_load: '1' }],
            })
                .mockResolvedValueOnce({ rows: [] });
            const result = await service.autoAssignNext('ws-1', 'conv-1');
            (0, vitest_1.expect)(result.assigned).toBe(true);
            (0, vitest_1.expect)(result.agent?.id).toBe('agent-least-busy');
        });
        (0, vitest_1.it)('should return assigned: false if no online agents exist', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({ rows: [] });
            const result = await service.autoAssignNext('ws-1', 'conv-1');
            (0, vitest_1.expect)(result.assigned).toBe(false);
            (0, vitest_1.expect)(result.reason).toBe('No available online agents.');
        });
    });
});
//# sourceMappingURL=inboxes.service.spec.js.map