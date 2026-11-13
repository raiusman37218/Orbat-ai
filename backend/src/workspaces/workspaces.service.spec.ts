import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { DatabaseService } from '../database/database.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let mockDb: Partial<DatabaseService>;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    service = new WorkspacesService(mockDb as DatabaseService);
  });

  describe('getWorkspace', () => {
    it('should throw NotFoundException if workspace does not exist', async () => {
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });

      await expect(service.getWorkspace('ws-unknown')).rejects.toThrow(NotFoundException);
    });

    it('should return workspace details when found', async () => {
      const mockWs = {
        id: 'ws-1',
        name: 'Acme Corp',
        brand_color: '#3B82F6',
        greeting_title: 'Welcome',
      };
      mockDb.query = vi.fn().mockResolvedValue({ rows: [mockWs] });

      const result = await service.getWorkspace('ws-1');
      expect(result.name).toBe('Acme Corp');
      expect(result.brand_color).toBe('#3B82F6');
    });
  });

  describe('getWorkspaceStats', () => {
    it('should aggregate conversation and agent metrics correctly', async () => {
      mockDb.query = vi
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
      expect(stats.conversations.open).toBe(5);
      expect(stats.conversations.waitingHandoff).toBe(2);
      expect(stats.agents.online).toBe(3);
      expect(stats.visitors.online).toBe(12);
    });
  });
});

