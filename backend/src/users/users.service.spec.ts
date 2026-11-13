import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/types/tenant-context';

describe('UsersService', () => {
  let service: UsersService;
  let mockDb: Partial<DatabaseService>;

  const mockActor: AuthenticatedUser = {
    id: 'agent-owner',
    email: 'owner@example.com',
    name: 'Owner Agent',
    role: 'owner',
    workspaceId: 'ws-1',
  };

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    service = new UsersService(mockDb as DatabaseService);
  });

  describe('createAgent', () => {
    it('should throw ForbiddenException if actor is not owner or admin', async () => {
      const nonAdminActor: AuthenticatedUser = {
        ...mockActor,
        role: 'agent',
      };

      await expect(
        service.createAgent(
          'ws-1',
          { name: 'New Agent', email: 'new@example.com', role: 'agent' },
          nonAdminActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if agent email already exists', async () => {
      mockDb.query = vi.fn().mockResolvedValue({
        rows: [{ id: 'existing-id', workspace_id: 'ws-1' }],
      });

      await expect(
        service.createAgent(
          'ws-1',
          { name: 'New Agent', email: 'exists@example.com', role: 'agent' },
          mockActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should insert agent and return generated password if not provided', async () => {
      mockDb.query = vi
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // check email uniqueness
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

      const result = await service.createAgent(
        'ws-1',
        { name: 'John Smith', email: 'john@example.com', role: 'agent' },
        mockActor,
      );

      expect(result.id).toBe('new-agent-1');
      expect(result.email).toBe('john@example.com');
      expect(result.initialPassword).toBeDefined();
    });
  });

  describe('updateMyStatus', () => {
    it('should update agent status in database', async () => {
      mockDb.query = vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: 'agent-1', name: 'John', email: 'john@example.com', status: 'online' }],
        })
        .mockResolvedValueOnce({ rows: [] }); // agent_status upsert

      const result = await service.updateMyStatus('ws-1', 'agent-1', 'online');
      expect(result.status).toBe('online');
    });
  });
});

