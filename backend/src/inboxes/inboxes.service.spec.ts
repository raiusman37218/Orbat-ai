import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InboxesService } from './inboxes.service';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/types/tenant-context';

describe('InboxesService', () => {
  let service: InboxesService;
  let mockDb: Partial<DatabaseService>;

  const mockAgent: AuthenticatedUser = {
    id: 'agent-1',
    email: 'agent@example.com',
    name: 'Agent Smith',
    role: 'agent',
    workspaceId: 'ws-1',
  };

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    service = new InboxesService(mockDb as DatabaseService);
  });

  describe('getInboxOverview', () => {
    it('should aggregate queue counts for the current user and workspace', async () => {
      mockDb.query = vi.fn().mockResolvedValue({
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
      expect(overview.myAssigned).toBe(3);
      expect(overview.unassigned).toBe(7);
      expect(overview.waitingHandoff).toBe(2);
      expect(overview.offlineQueued).toBe(1);
      expect(overview.botActive).toBe(15);
      expect(overview.closedToday).toBe(10);
    });
  });

  describe('autoAssignNext', () => {
    it('should assign to least-loaded online agent', async () => {
      mockDb.query = vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: 'agent-least-busy', name: 'Bob', active_load: '1' }],
        })
        .mockResolvedValueOnce({ rows: [] }); // update conv

      const result = await service.autoAssignNext('ws-1', 'conv-1');
      expect(result.assigned).toBe(true);
      expect(result.agent?.id).toBe('agent-least-busy');
    });

    it('should return assigned: false if no online agents exist', async () => {
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });

      const result = await service.autoAssignNext('ws-1', 'conv-1');
      expect(result.assigned).toBe(false);
      expect(result.reason).toBe('No available online agents.');
    });
  });
});

