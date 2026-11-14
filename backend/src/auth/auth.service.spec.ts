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

  describe('googleAuth', () => {
    it('should reject Google idToken when aud does not match GOOGLE_CLIENT_ID', async () => {
      (mockConfig.get as any) = vi.fn((key: string) => {
        if (key === 'google.clientId') return 'expected-client-id.apps.googleusercontent.com';
        return 'test_secret';
      });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aud: 'attacker-other-app.apps.googleusercontent.com',
          email: 'victim@example.com',
          email_verified: true,
        }),
      } as any);

      await expect(
        service.googleAuth({ idToken: 'fake-google-id-token' }),
      ).rejects.toThrow(UnauthorizedException);

      fetchSpy.mockRestore();
    });

    it('should reject Google idToken when email_verified is false', async () => {
      (mockConfig.get as any) = vi.fn((key: string) => {
        if (key === 'google.clientId') return 'expected-client-id.apps.googleusercontent.com';
        return 'test_secret';
      });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aud: 'expected-client-id.apps.googleusercontent.com',
          email: 'unverified@example.com',
          email_verified: false,
        }),
      } as any);

      await expect(
        service.googleAuth({ idToken: 'fake-google-id-token' }),
      ).rejects.toThrow(UnauthorizedException);

      fetchSpy.mockRestore();
    });

    it('creates workspace and owner agent on new Google signup and returns isNewUser: true', async () => {
      (mockConfig.get as any) = vi.fn((key: string) => {
        if (key === 'google.clientId') return 'expected-client-id.apps.googleusercontent.com';
        if (key === 'jwt.secret') return 'test_secret';
        if (key === 'jwt.expiresIn') return '7d';
        if (key === 'jwt.refreshSecret') return 'test_refresh_secret';
        if (key === 'jwt.refreshExpiresIn') return '30d';
        return null;
      });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aud: 'expected-client-id.apps.googleusercontent.com',
          email: 'NewFounder@Example.com',
          name: 'New Founder',
          picture: 'https://example.com/avatar.png',
          email_verified: true,
        }),
      } as any);

      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });
      const txQueries: Array<{ sql: string; params?: unknown[] }> = [];
      mockDb.transaction = vi.fn(async (cb: any) => {
        const fakeClient = {
          query: vi.fn(async (sql: string, params?: unknown[]) => {
            txQueries.push({ sql, params });
            if (sql.includes('INSERT INTO public.workspaces')) {
              return { rows: [{ id: 'ws-new', name: "New Founder's Workspace", brand_color: '#4f46e5' }] };
            }
            if (sql.includes('INSERT INTO public.agents')) {
              return {
                rows: [
                  {
                    id: 'agent-new',
                    name: 'New Founder',
                    email: 'newfounder@example.com',
                    role: 'owner',
                    workspace_id: 'ws-new',
                    status: 'online',
                    is_super_admin: false,
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return cb(fakeClient);
      });

      const result = await service.googleAuth({ idToken: 'valid-google-id-token' });

      expect(result.isNewUser).toBe(true);
      expect(result.accessToken).toBe('mock_token');
      expect(result.user.email).toBe('newfounder@example.com');
      expect(result.user.role).toBe('owner');
      expect(result.workspace?.id).toBe('ws-new');
      expect(txQueries.some((q) => q.sql.includes('INSERT INTO public.workspaces'))).toBe(true);
      expect(txQueries.some((q) => q.sql.includes('INSERT INTO public.agents'))).toBe(true);
      expect(txQueries.some((q) => q.sql.includes('UPDATE public.workspaces SET owner_id'))).toBe(true);

      fetchSpy.mockRestore();
    });

    it('preserves OAuth state and exact redirect_uri in getGoogleAuthUrl', () => {
      (mockConfig.get as any) = vi.fn((key: string) => {
        if (key === 'google.clientId') return 'expected-client-id.apps.googleusercontent.com';
        return 'http://localhost:3000/auth/callback';
      });
      const res = service.getGoogleAuthUrl(
        'http://localhost:3000/auth/callback',
        'mode=signup&next=%2Fapp',
      );
      expect(res.configured).toBe(true);
      const parsed = new URL(res.url!);
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/callback');
      expect(parsed.searchParams.get('state')).toBe('mode=signup&next=%2Fapp');
    });
  });
});

