import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let mockDb: Partial<DatabaseService>;
  let mockJwt: Partial<JwtService>;
  let mockConfig: Partial<ConfigService>;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(),
    };
    mockJwt = {
      signAsync: vi.fn().mockResolvedValue('mock_token'),
      verifyAsync: vi.fn(),
    };
    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'jwt.secret') return 'test_secret';
        if (key === 'jwt.expiresIn') return '7d';
        if (key === 'jwt.refreshSecret') return 'test_refresh_secret';
        if (key === 'jwt.refreshExpiresIn') return '30d';
        return null;
      }),
    };

    service = new AuthService(
      mockDb as DatabaseService,
      mockJwt as JwtService,
      mockConfig as ConfigService,
    );
  });

  describe('login', () => {
    it('should throw UnauthorizedException when agent is not found', async () => {
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });

      await expect(
        service.login({ email: 'unknown@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password hash does not match', async () => {
      const realHash = await bcrypt.hash('correct_password', 4);
      mockDb.query = vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'agent-1',
            email: 'test@example.com',
            name: 'Test Agent',
            role: 'agent',
            workspace_id: 'ws-1',
            password_hash: realHash,
            is_active: true,
          },
        ],
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong_password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens and user details on valid password', async () => {
      const realHash = await bcrypt.hash('correct_password', 4);
      mockDb.query = vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'agent-1',
            email: 'test@example.com',
            name: 'Test Agent',
            role: 'owner',
            workspace_id: 'ws-1',
            workspace_name: 'Acme Corp',
            brand_color: '#3B82F6',
            password_hash: realHash,
            is_active: true,
            is_super_admin: false,
          },
        ],
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'correct_password',
      });

      expect(result.accessToken).toBe('mock_token');
      expect(result.refreshToken).toBe('mock_token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.workspace?.name).toBe('Acme Corp');
    });
  });

  describe('signup', () => {
    it('should throw ConflictException if agent email already exists', async () => {
      mockDb.query = vi.fn().mockResolvedValue({ rows: [{ id: 'existing-id' }] });

      await expect(
        service.signup({
          email: 'exists@example.com',
          password: 'password123',
          name: 'Jane Doe',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});

