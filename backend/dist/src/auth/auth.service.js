"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = require("bcryptjs");
const database_service_1 = require("../database/database.service");
const cors_1 = require("../common/security/cors");
let AuthService = AuthService_1 = class AuthService {
    constructor(db, jwtService, configService) {
        this.db = db;
        this.jwtService = jwtService;
        this.configService = configService;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async signup(dto) {
        const emailNormalized = dto.email.trim().toLowerCase();
        const existing = await this.db.query('SELECT id FROM public.agents WHERE LOWER(email) = $1 LIMIT 1', [emailNormalized]);
        if (existing.rows.length > 0) {
            throw new common_1.ConflictException('An account with this email address already exists.');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        return this.db.transaction(async (client) => {
            const workspaceName = dto.workspaceName?.trim() || `${dto.name.trim()}'s Workspace`;
            const wsResult = await client.query(`INSERT INTO public.workspaces (name, brand_color, greeting_title, greeting_message, owner_id)
         VALUES ($1, $2, $3, $4, NULL)
         RETURNING id, name, brand_color`, [workspaceName, '#4f46e5', 'Welcome to Orbat AI', 'How can we help you today?']);
            const workspace = wsResult.rows[0];
            const agentResult = await client.query(`INSERT INTO public.agents (id, name, email, role, status, workspace_id, password_hash, is_active)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true)
         RETURNING id, name, email, role, workspace_id, status, is_super_admin`, [dto.name.trim(), emailNormalized, 'owner', 'online', workspace.id, passwordHash]);
            const agent = agentResult.rows[0];
            try {
                await client.query('UPDATE public.workspaces SET owner_id = $1 WHERE id = $2', [agent.id, workspace.id]);
            }
            catch (e) {
            }
            const userPayload = {
                id: agent.id,
                email: agent.email,
                name: agent.name,
                role: agent.role,
                workspaceId: agent.workspace_id,
                isSuperAdmin: Boolean(agent.is_super_admin),
                tokenVersion: 1,
            };
            const tokens = await this.generateTokens(userPayload);
            return {
                ...tokens,
                user: userPayload,
                workspace: {
                    id: workspace.id,
                    name: workspace.name,
                    brandColor: workspace.brand_color,
                },
            };
        });
    }
    async login(dto) {
        const emailNormalized = dto.email.trim().toLowerCase();
        const result = await this.db.query(`SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id, a.password_hash,
              a.is_active, a.is_super_admin, COALESCE(a.email_verified, true) AS email_verified,
              COALESCE(a.token_version, 1) AS token_version,
              w.name as workspace_name, w.brand_color
       FROM public.agents a
       LEFT JOIN public.workspaces w ON w.id = a.workspace_id
       WHERE LOWER(a.email) = $1
       LIMIT 1`, [emailNormalized]);
        if (result.rows.length === 0) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        const agent = result.rows[0];
        if (agent.is_active === false) {
            throw new common_1.ForbiddenException('Your account has been deactivated. Please contact your workspace administrator.');
        }
        if (agent.email_verified === false) {
            throw new common_1.ForbiddenException('Please verify your email address before signing in.');
        }
        if (!agent.password_hash) {
            throw new common_1.UnauthorizedException('This account was created via Google OAuth. Please sign in with Google.');
        }
        const isMatch = await bcrypt.compare(dto.password, agent.password_hash);
        if (!isMatch) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        const userPayload = {
            id: agent.id,
            email: agent.email,
            name: agent.name,
            role: agent.role,
            workspaceId: agent.workspace_id,
            isSuperAdmin: Boolean(agent.is_super_admin),
            tokenVersion: Number(agent.token_version ?? 1),
        };
        const tokens = await this.generateTokens(userPayload);
        return {
            ...tokens,
            user: userPayload,
            workspace: agent.workspace_id
                ? {
                    id: agent.workspace_id,
                    name: agent.workspace_name,
                    brandColor: agent.brand_color,
                }
                : null,
        };
    }
    async googleAuth(dto) {
        let email = null;
        let name = null;
        let picture = null;
        const token = dto.idToken || dto.credential;
        const googleClientId = (this.configService.get('google.clientId') ||
            process.env.GOOGLE_CLIENT_ID ||
            '').trim();
        if (!googleClientId) {
            throw new common_1.UnauthorizedException('Google OAuth client ID is not configured on the backend.');
        }
        const verifyGoogleIdToken = async (idToken) => {
            const payloadRes = await fetch('https://oauth2.googleapis.com/tokeninfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ id_token: idToken }).toString(),
            });
            if (!payloadRes.ok) {
                throw new common_1.UnauthorizedException('Invalid Google ID token or credential.');
            }
            const payload = await payloadRes.json();
            const audMatches = payload.aud === googleClientId || payload.azp === googleClientId;
            const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
            if (!audMatches || !emailVerified) {
                throw new common_1.UnauthorizedException('Google token audience or email verification check failed.');
            }
            return payload;
        };
        if (dto.code) {
            const clientId = googleClientId;
            const clientSecret = this.configService.get('google.clientSecret') || process.env.GOOGLE_CLIENT_SECRET;
            const callbackUrl = this.resolveGoogleCallbackUrl(dto.redirectUri);
            if (!clientId || !clientSecret) {
                throw new common_1.UnauthorizedException('Google OAuth credentials are not configured on the backend. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env');
            }
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code: dto.code,
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: callbackUrl,
                    grant_type: 'authorization_code',
                }),
            });
            if (!tokenRes.ok) {
                const errText = await tokenRes.text();
                this.logger.error(`Google token exchange failed: ${errText}`);
                throw new common_1.UnauthorizedException('Failed to exchange Google authorization code.');
            }
            const tokenData = await tokenRes.json();
            if (tokenData.id_token) {
                const payload = await verifyGoogleIdToken(tokenData.id_token);
                email = payload.email;
                name = payload.name;
                picture = payload.picture;
            }
        }
        else if (token) {
            const payload = await verifyGoogleIdToken(token);
            email = payload.email;
            name = payload.name;
            picture = payload.picture;
        }
        else if (dto.accessToken) {
            const tokenInfoRes = await fetch('https://oauth2.googleapis.com/tokeninfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ access_token: dto.accessToken }).toString(),
            });
            if (!tokenInfoRes.ok) {
                throw new common_1.UnauthorizedException('Invalid Google access token.');
            }
            const tokenInfo = await tokenInfoRes.json();
            if (tokenInfo.aud !== googleClientId && tokenInfo.azp !== googleClientId) {
                throw new common_1.UnauthorizedException('Google access token audience mismatch.');
            }
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${dto.accessToken}` },
            });
            if (!userRes.ok) {
                throw new common_1.UnauthorizedException('Failed to fetch Google userinfo.');
            }
            const user = await userRes.json();
            if (user.email_verified !== true && user.email_verified !== 'true') {
                throw new common_1.UnauthorizedException('Google account email is not verified.');
            }
            email = user.email;
            name = user.name;
            picture = user.picture;
        }
        else {
            throw new common_1.BadRequestException('Please provide a Google code, idToken, or credential.');
        }
        if (!email) {
            throw new common_1.UnauthorizedException('Could not retrieve email from Google profile.');
        }
        const emailNormalized = email.trim().toLowerCase();
        const existing = await this.db.query(`SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id, a.is_active,
              a.is_super_admin, COALESCE(a.token_version, 1) AS token_version,
              w.name as workspace_name, w.brand_color
       FROM public.agents a
       LEFT JOIN public.workspaces w ON w.id = a.workspace_id
       WHERE LOWER(a.email) = $1
       LIMIT 1`, [emailNormalized]);
        if (existing.rows.length > 0) {
            const agent = existing.rows[0];
            if (agent.is_active === false) {
                throw new common_1.ForbiddenException('Your account has been deactivated. Please contact your workspace administrator.');
            }
            const userPayload = {
                id: agent.id,
                email: agent.email,
                name: agent.name,
                role: agent.role,
                workspaceId: agent.workspace_id,
                isSuperAdmin: Boolean(agent.is_super_admin),
                tokenVersion: Number(agent.token_version ?? 1),
            };
            const tokens = await this.generateTokens(userPayload);
            return {
                ...tokens,
                user: userPayload,
                workspace: agent.workspace_id
                    ? {
                        id: agent.workspace_id,
                        name: agent.workspace_name,
                        brandColor: agent.brand_color,
                    }
                    : null,
            };
        }
        return this.db.transaction(async (client) => {
            const userName = name?.trim() || emailNormalized.split('@')[0];
            const workspaceName = `${userName}'s Workspace`;
            const wsResult = await client.query(`INSERT INTO public.workspaces (name, brand_color, greeting_title, greeting_message, owner_id)
         VALUES ($1, $2, $3, $4, NULL)
         RETURNING id, name, brand_color`, [workspaceName, '#4f46e5', 'Welcome to Orbat AI', 'How can we help you today?']);
            const workspace = wsResult.rows[0];
            const agentResult = await client.query(`INSERT INTO public.agents (id, name, email, role, status, workspace_id, avatar_url, is_active)
         VALUES (gen_random_uuid(), $1, $2, 'owner', 'online', $3, $4, true)
         RETURNING id, name, email, role, workspace_id, status, is_super_admin`, [userName, emailNormalized, workspace.id, picture || null]);
            const agent = agentResult.rows[0];
            try {
                await client.query('UPDATE public.workspaces SET owner_id = $1 WHERE id = $2', [agent.id, workspace.id]);
            }
            catch (e) { }
            const userPayload = {
                id: agent.id,
                email: agent.email,
                name: agent.name,
                role: agent.role,
                workspaceId: agent.workspace_id,
                isSuperAdmin: Boolean(agent.is_super_admin),
                tokenVersion: 1,
            };
            const tokens = await this.generateTokens(userPayload);
            return {
                ...tokens,
                user: userPayload,
                workspace: {
                    id: workspace.id,
                    name: workspace.name,
                    brandColor: workspace.brand_color,
                },
            };
        });
    }
    resolveGoogleCallbackUrl(requestedRedirectUri) {
        const configuredCallback = (process.env.GOOGLE_CALLBACK_URL || '').trim();
        const fallbackCallback = configuredCallback ||
            (() => {
                const fromConfig = this.configService.get('google.callbackUrl');
                return fromConfig && /^https?:\/\//i.test(fromConfig)
                    ? fromConfig
                    : 'http://localhost:3000/auth/callback';
            })();
        if (!requestedRedirectUri) {
            return fallbackCallback;
        }
        try {
            const parsed = new URL(requestedRedirectUri.trim());
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return fallbackCallback;
            }
            if (!parsed.pathname.endsWith('/auth/callback')) {
                return fallbackCallback;
            }
            const allowlist = (0, cors_1.parseCorsAllowlist)(process.env);
            let configuredCallbackOrigin = null;
            try {
                configuredCallbackOrigin = new URL(fallbackCallback).origin.toLowerCase();
            }
            catch {
                configuredCallbackOrigin = null;
            }
            if ((0, cors_1.isOriginAllowed)(parsed.origin, allowlist) ||
                (configuredCallbackOrigin !== null && parsed.origin.toLowerCase() === configuredCallbackOrigin)) {
                return `${parsed.origin}${parsed.pathname}`;
            }
        }
        catch {
        }
        return fallbackCallback;
    }
    getGoogleAuthUrl(requestedRedirectUri) {
        const clientId = this.configService.get('google.clientId') || process.env.GOOGLE_CLIENT_ID;
        const callbackUrl = this.resolveGoogleCallbackUrl(requestedRedirectUri);
        if (!clientId) {
            return {
                configured: false,
                url: null,
                message: 'Google OAuth is not configured on the backend yet.',
            };
        }
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: callbackUrl,
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            prompt: 'consent',
        });
        return {
            configured: true,
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        };
    }
    async refreshToken(dto) {
        try {
            const refreshSecret = this.configService.get('jwt.refreshSecret');
            const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
                secret: refreshSecret,
            });
            const result = await this.db.query(`SELECT id, name, email, role, workspace_id, is_active, is_super_admin,
                COALESCE(token_version, 1) AS token_version
         FROM public.agents WHERE id = $1 LIMIT 1`, [payload.sub]);
            if (result.rows.length === 0 || result.rows[0].is_active === false) {
                throw new common_1.UnauthorizedException('User account no longer active.');
            }
            const agent = result.rows[0];
            const currentVersion = Number(agent.token_version ?? 1);
            if (typeof payload.tv === 'number' && currentVersion !== payload.tv) {
                throw new common_1.UnauthorizedException('Session has been revoked.');
            }
            const userPayload = {
                id: agent.id,
                email: agent.email,
                name: agent.name,
                role: agent.role,
                workspaceId: agent.workspace_id,
                isSuperAdmin: Boolean(agent.is_super_admin),
                tokenVersion: currentVersion,
            };
            const tokens = await this.generateTokens(userPayload);
            return {
                ...tokens,
                user: userPayload,
            };
        }
        catch (err) {
            throw new common_1.UnauthorizedException(`Invalid or expired refresh token: ${err.message}`);
        }
    }
    async getMe(userId) {
        const result = await this.db.query(`SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id, a.is_super_admin,
              w.name as workspace_name, w.brand_color, w.slug, w.logo_url
       FROM public.agents a
       LEFT JOIN public.workspaces w ON w.id = a.workspace_id
       WHERE a.id = $1
       LIMIT 1`, [userId]);
        if (result.rows.length === 0) {
            throw new common_1.NotFoundException('User profile not found.');
        }
        const agent = result.rows[0];
        return {
            id: agent.id,
            name: agent.name,
            email: agent.email,
            role: agent.role,
            status: agent.status,
            workspaceId: agent.workspace_id,
            workspaceName: agent.workspace_name,
            brandColor: agent.brand_color,
            isSuperAdmin: Boolean(agent.is_super_admin),
            workspace: agent.workspace_id
                ? {
                    id: agent.workspace_id,
                    name: agent.workspace_name,
                    brandColor: agent.brand_color,
                    slug: agent.slug,
                    logoUrl: agent.logo_url,
                }
                : null,
        };
    }
    async generateTokens(user) {
        const jwtSecret = this.configService.get('jwt.secret');
        const jwtExpiresIn = this.configService.get('jwt.expiresIn');
        const refreshSecret = this.configService.get('jwt.refreshSecret');
        const refreshExpiresIn = this.configService.get('jwt.refreshExpiresIn');
        const tokenVersion = typeof user.tokenVersion === 'number' ? user.tokenVersion : 1;
        const payload = {
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            workspaceId: user.workspaceId,
            isSuperAdmin: user.isSuperAdmin,
            tv: tokenVersion,
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: jwtSecret,
                expiresIn: jwtExpiresIn,
            }),
            this.jwtService.signAsync({ sub: user.id, tv: tokenVersion }, {
                secret: refreshSecret,
                expiresIn: refreshExpiresIn,
            }),
        ]);
        return {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: jwtExpiresIn,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map