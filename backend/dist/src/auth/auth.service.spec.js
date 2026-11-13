"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const bcrypt = require("bcryptjs");
(0, vitest_1.describe)('AuthService', () => {
    let service;
    let mockDb;
    let mockJwt;
    let mockConfig;
    (0, vitest_1.beforeEach)(() => {
        mockDb = {
            query: vitest_1.vi.fn(),
            transaction: vitest_1.vi.fn(),
        };
        mockJwt = {
            signAsync: vitest_1.vi.fn().mockResolvedValue('mock_token'),
            verifyAsync: vitest_1.vi.fn(),
        };
        mockConfig = {
            get: vitest_1.vi.fn((key) => {
                if (key === 'jwt.secret')
                    return 'test_secret';
                if (key === 'jwt.expiresIn')
                    return '7d';
                if (key === 'jwt.refreshSecret')
                    return 'test_refresh_secret';
                if (key === 'jwt.refreshExpiresIn')
                    return '30d';
                return null;
            }),
        };
        service = new auth_service_1.AuthService(mockDb, mockJwt, mockConfig);
    });
    (0, vitest_1.describe)('login', () => {
        (0, vitest_1.it)('should throw UnauthorizedException when agent is not found', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({ rows: [] });
            await (0, vitest_1.expect)(service.login({ email: 'unknown@example.com', password: 'password123' })).rejects.toThrow(common_1.UnauthorizedException);
        });
        (0, vitest_1.it)('should throw UnauthorizedException when password hash does not match', async () => {
            const realHash = await bcrypt.hash('correct_password', 4);
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({
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
            await (0, vitest_1.expect)(service.login({ email: 'test@example.com', password: 'wrong_password' })).rejects.toThrow(common_1.UnauthorizedException);
        });
        (0, vitest_1.it)('should return tokens and user details on valid password', async () => {
            const realHash = await bcrypt.hash('correct_password', 4);
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({
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
            (0, vitest_1.expect)(result.accessToken).toBe('mock_token');
            (0, vitest_1.expect)(result.refreshToken).toBe('mock_token');
            (0, vitest_1.expect)(result.user.email).toBe('test@example.com');
            (0, vitest_1.expect)(result.workspace?.name).toBe('Acme Corp');
        });
    });
    (0, vitest_1.describe)('signup', () => {
        (0, vitest_1.it)('should throw ConflictException if agent email already exists', async () => {
            mockDb.query = vitest_1.vi.fn().mockResolvedValue({ rows: [{ id: 'existing-id' }] });
            await (0, vitest_1.expect)(service.signup({
                email: 'exists@example.com',
                password: 'password123',
                name: 'Jane Doe',
            })).rejects.toThrow(common_1.ConflictException);
        });
    });
    (0, vitest_1.describe)('googleAuth', () => {
        (0, vitest_1.it)('should reject Google idToken when aud does not match GOOGLE_CLIENT_ID', async () => {
            mockConfig.get = vitest_1.vi.fn((key) => {
                if (key === 'google.clientId')
                    return 'expected-client-id.apps.googleusercontent.com';
                return 'test_secret';
            });
            const fetchSpy = vitest_1.vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    aud: 'attacker-other-app.apps.googleusercontent.com',
                    email: 'victim@example.com',
                    email_verified: true,
                }),
            });
            await (0, vitest_1.expect)(service.googleAuth({ idToken: 'fake-google-id-token' })).rejects.toThrow(common_1.UnauthorizedException);
            fetchSpy.mockRestore();
        });
        (0, vitest_1.it)('should reject Google idToken when email_verified is false', async () => {
            mockConfig.get = vitest_1.vi.fn((key) => {
                if (key === 'google.clientId')
                    return 'expected-client-id.apps.googleusercontent.com';
                return 'test_secret';
            });
            const fetchSpy = vitest_1.vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    aud: 'expected-client-id.apps.googleusercontent.com',
                    email: 'unverified@example.com',
                    email_verified: false,
                }),
            });
            await (0, vitest_1.expect)(service.googleAuth({ idToken: 'fake-google-id-token' })).rejects.toThrow(common_1.UnauthorizedException);
            fetchSpy.mockRestore();
        });
    });
});
//# sourceMappingURL=auth.service.spec.js.map