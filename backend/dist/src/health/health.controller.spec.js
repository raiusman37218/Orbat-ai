"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const health_controller_1 = require("./health.controller");
(0, vitest_1.describe)('HealthController', () => {
    let controller;
    let mockDbService;
    (0, vitest_1.beforeEach)(() => {
        mockDbService = {
            ping: vitest_1.vi.fn().mockResolvedValue({ ok: true, latencyMs: 5 }),
        };
        controller = new health_controller_1.HealthController(mockDbService);
    });
    (0, vitest_1.it)('should return alive status for liveness probe', () => {
        (0, vitest_1.expect)(controller.liveness()).toEqual({ status: 'alive' });
    });
    (0, vitest_1.it)('should return ready status when database ping succeeds', async () => {
        const ready = await controller.readiness();
        (0, vitest_1.expect)(ready).toEqual({ status: 'ready', database: 'connected' });
    });
    (0, vitest_1.it)('should return not_ready status when database ping fails', async () => {
        mockDbService.ping = vitest_1.vi.fn().mockResolvedValue({ ok: false, latencyMs: 10, error: 'Connection failed' });
        const ready = await controller.readiness();
        (0, vitest_1.expect)(ready).toEqual({ status: 'not_ready', database: 'Connection failed' });
    });
    (0, vitest_1.it)('should return system metrics and database connection on health check', async () => {
        const health = await controller.check();
        (0, vitest_1.expect)(health.status).toBe('ok');
        (0, vitest_1.expect)(health.database.connected).toBe(true);
        (0, vitest_1.expect)(health.system).toBeDefined();
        (0, vitest_1.expect)(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
});
//# sourceMappingURL=health.controller.spec.js.map