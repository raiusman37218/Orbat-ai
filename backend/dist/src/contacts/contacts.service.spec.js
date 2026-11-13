"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const contacts_service_1 = require("./contacts.service");
(0, vitest_1.describe)('ContactsService', () => {
    let service;
    let mockDb;
    (0, vitest_1.beforeEach)(() => {
        mockDb = {
            query: vitest_1.vi.fn(),
        };
        service = new contacts_service_1.ContactsService(mockDb);
    });
    (0, vitest_1.describe)('getContactById', () => {
        (0, vitest_1.it)('should throw NotFoundException if visitor not found in workspace', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({ rows: [] });
            await (0, vitest_1.expect)(service.getContactById('ws-1', 'vis-404')).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)('should return visitor details and page history when found', async () => {
            mockDb.query = vitest_1.vi
                .fn()
                .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'vis-1',
                        name: 'John Customer',
                        email: 'customer@example.com',
                        is_online: true,
                    },
                ],
            })
                .mockResolvedValueOnce({
                rows: [{ id: 'p1', url: '/pricing', duration_seconds: 45 }],
            });
            const result = await service.getContactById('ws-1', 'vis-1');
            (0, vitest_1.expect)(result.name).toBe('John Customer');
            (0, vitest_1.expect)(result.pageHistory).toHaveLength(1);
            (0, vitest_1.expect)(result.pageHistory[0].url).toBe('/pricing');
        });
    });
});
//# sourceMappingURL=contacts.service.spec.js.map