import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from './health.controller';
import { DatabaseService } from '../database/database.service';

describe('HealthController', () => {
  let controller: HealthController;
  let mockDbService: Partial<DatabaseService>;

  beforeEach(() => {
    mockDbService = {
      ping: vi.fn().mockResolvedValue({ ok: true, latencyMs: 5 }),
    };
    controller = new HealthController(mockDbService as DatabaseService);
  });

  it('should return alive status for liveness probe', () => {
    expect(controller.liveness()).toEqual({ status: 'alive' });
  });

  it('should return ready status when database ping succeeds', async () => {
    const ready = await controller.readiness();
    expect(ready).toEqual({ status: 'ready', database: 'connected' });
  });

  it('should return not_ready status when database ping fails', async () => {
    mockDbService.ping = vi.fn().mockResolvedValue({ ok: false, latencyMs: 10, error: 'Connection failed' });
    const ready = await controller.readiness();
    expect(ready).toEqual({ status: 'not_ready', database: 'Connection failed' });
  });

  it('should return system metrics and database connection on health check', async () => {
    const health = await controller.check();
    expect(health.status).toBe('ok');
    expect(health.database.connected).toBe(true);
    expect(health.system).toBeDefined();
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});

