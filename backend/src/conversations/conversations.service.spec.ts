import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/types/tenant-context';

describe('ConversationsService', () => {
  let service: ConversationsService;
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
      transaction: vi.fn(),
    };
    service = new ConversationsService(mockDb as DatabaseService);
  });

  describe('getConversationById', () => {
    it('should throw NotFoundException if conversation not found in workspace', async () => {
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });

      await expect(service.getConversationById('ws-1', 'conv-404')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return conversation details when found', async () => {
      mockDb.query = vi.fn().mockResolvedValue({
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
      expect(result.status).toBe('open');
      expect(result.visitor_name).toBe('Jane Doe');
    });
  });

  describe('claimHandoff', () => {
    it('should throw ConflictException if already claimed by someone else', async () => {
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });

      await expect(service.claimHandoff('ws-1', 'conv-1', mockAgent)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should assign conversation to agent and update status to agent_active', async () => {
      mockDb.query = vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: 'conv-1', assigned_agent_id: 'agent-1', handoff_status: 'agent_active' }],
        })
        .mockResolvedValueOnce({ rows: [] }); // system message insert

      const result = await service.claimHandoff('ws-1', 'conv-1', mockAgent);
      expect(result.assigned_agent_id).toBe('agent-1');
      expect(result.handoff_status).toBe('agent_active');
    });
  });
});

