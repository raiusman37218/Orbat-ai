import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { DatabaseService } from '../database/database.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let mockDb: Partial<DatabaseService>;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    service = new ContactsService(mockDb as DatabaseService);
  });

  describe('getContactById', () => {
    it('should throw NotFoundException if visitor not found in workspace', async () => {
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });

      await expect(service.getContactById('ws-1', 'vis-404')).rejects.toThrow(NotFoundException);
    });

    it('should return visitor details and page history when found', async () => {
      mockDb.query = vi
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
      expect(result.name).toBe('John Customer');
      expect(result.pageHistory).toHaveLength(1);
      expect(result.pageHistory[0].url).toBe('/pricing');
    });
  });
});

