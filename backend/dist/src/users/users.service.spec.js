"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const users_service_1 = require("./users.service");
(0, vitest_1.describe)('UsersService', () => {
    let service;
    let mockDb;
    const mockActor = {
        id: 'agent-owner',
        email: 'owner@example.com',
        name: 'Owner Agent',
        role: 'owner',
        workspaceId: 'ws-1',
    };
    (0, vitest_1.beforeEach)(() => {
        mockDb = {
            query: vitest_1.vi.fn(),
        };
        service = new users_service_1.UsersService(mockDb);
    });
    (0, vitest_1.describe)('createAgent', () => {
        (0, vitest_1.it)('should throw ForbiddenException if actor is not owner or admin', async () => {
            const nonAdminActor = {
                ...mockActor,
                role: 'agent',
            };
            await (0, vitest_1.expect)(service.createAgent('ws-1', { name: 'New Agent', email: 'new@example.com', role: 'agent' }, nonAdminActor)).rejects.toThrow(common_1.ForbiddenException);
        });
        (0, vitest_1.it)('should throw ConflictException if agent email already exists', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({
                rows: [{ id: 'existing-id', workspace_id: 'ws-1' }],
            });
            await (0, vitest_1.expect)(service.createAgent('ws-1', { name: 'New Agent', email: 'exists@example.com', role: 'agent' }, mockActor)).rejects.toThrow(common_1.ConflictException);
        });
        (0, vitest_1.it)('should insert agent and return generated password if not provided', async () => {
            mockDb.query = vitest_1.vi
                .fn()
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'new-agent-1',
                        name: 'John Smith',
                        email: 'john@example.com',
                        role: 'agent',
                        status: 'offline',
                        is_active: true,
                    },
                ],
            });
            const result = await service.createAgent('ws-1', { name: 'John Smith', email: 'john@example.com', role: 'agent' }, mockActor);
            (0, vitest_1.expect)(result.id).toBe('new-agent-1');
            (0, vitest_1.expect)(result.email).toBe('john@example.com');
            (0, vitest_1.expect)(result.initialPassword).toBeDefined();
        });
    });
    (0, vitest_1.describe)('updateMyStatus', () => {
        (0, vitest_1.it)('should update agent status in database', async () => {
            mockDb.query = vitest_1.vi
                .fn()
                .mockResolvedValueOnce({
                rows: [{ id: 'agent-1', name: 'John', email: 'john@example.com', status: 'online' }],
            })
                .mockResolvedValueOnce({ rows: [] });
            const result = await service.updateMyStatus('ws-1', 'agent-1', 'online');
            (0, vitest_1.expect)(result.status).toBe('online');
        });
    });
});
//# sourceMappingURL=users.service.spec.js.map