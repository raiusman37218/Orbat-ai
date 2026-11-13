import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/types/tenant-context';

describe('MessagesService', () => {
  let service: MessagesService;
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
    service = new MessagesService(mockDb as DatabaseService);
  });

  describe('getMessages', () => {
    it('should throw NotFoundException if conversation not found in workspace', async () => {
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });

      await expect(service.getMessages('ws-1', 'conv-404')).rejects.toThrow(NotFoundException);
    });

    it('should return message list when conversation belongs to workspace', async () => {
      mockDb.query = vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'conv-1' }] }) // conv check
        .mockResolvedValueOnce({
          rows: [
            { id: 'm1', content: 'Hello', sender_type: 'visitor' },
            { id: 'm2', content: 'Hi there!', sender_type: 'agent' },
          ],
        });

      const messages = await service.getMessages('ws-1', 'conv-1');
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Hello');
    });
  });

  describe('sendMessage', () => {
    it('should return existing message if idempotency key matches', async () => {
      mockDb.query = vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'conv-1' }] }) // conv check
        .mockResolvedValueOnce({
          rows: [{ id: 'existing-msg', content: 'Duplicate test', created_at: '2026-11-09T10:00:00Z' }],
        });

      const result = await service.sendMessage(
        'ws-1',
        'conv-1',
        { content: 'Duplicate test', idempotencyKey: 'idem-123' },
        mockAgent,
      );

      expect(result.id).toBe('existing-msg');
    });
  });
});

