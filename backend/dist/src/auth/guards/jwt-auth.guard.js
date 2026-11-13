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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthGuard = void 0;
exports.invalidateAuthStateCache = invalidateAuthStateCache;
exports.clearAuthStateCache = clearAuthStateCache;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const database_service_1 = require("../../database/database.service");
const CACHE_TTL_MS = 30_000;
const agentStateCache = new Map();
function invalidateAuthStateCache(agentId) {
    agentStateCache.delete(agentId);
}
function clearAuthStateCache() {
    agentStateCache.clear();
}
let JwtAuthGuard = class JwtAuthGuard {
    constructor(jwtService, configService, reflector, db) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.reflector = reflector;
        this.db = db;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        if (!token) {
            throw new common_1.UnauthorizedException('Authentication token is missing. Please provide a Bearer token.');
        }
        try {
            const secret = this.configService.get('jwt.secret');
            const payload = await this.jwtService.verifyAsync(token, { secret });
            const userId = String(payload.sub || payload.id || '');
            let role = payload.role;
            let workspaceId = payload.workspaceId || payload.workspace_id;
            let isSuperAdmin = Boolean(payload.isSuperAdmin || payload.is_super_admin);
            if (!userId) {
                throw new common_1.UnauthorizedException('Token missing subject.');
            }
            if (this.db) {
                const now = Date.now();
                let cached = agentStateCache.get(userId);
                if (cached && typeof payload.tv === 'number' && cached.tokenVersion !== payload.tv) {
                    agentStateCache.delete(userId);
                    cached = undefined;
                }
                if (!cached || cached.expiresAt <= now) {
                    const res = await this.db.query(`SELECT a.is_active, COALESCE(a.token_version, 1) AS token_version, a.role, a.workspace_id, a.is_super_admin,
                    w.is_suspended, w.deleted_at
             FROM public.agents a
             LEFT JOIN public.workspaces w ON w.id = a.workspace_id
             WHERE a.id = $1
             LIMIT 1`, [userId]);
                    if (res?.rows) {
                        if (res.rows.length === 0) {
                            agentStateCache.delete(userId);
                            throw new common_1.UnauthorizedException('Agent account no longer exists.');
                        }
                        const row = res.rows[0];
                        cached = {
                            isActive: row.is_active !== false,
                            role: row.role,
                            workspaceId: row.workspace_id,
                            isSuperAdmin: Boolean(row.is_super_admin),
                            tokenVersion: Number(row.token_version ?? 1),
                            workspaceSuspended: Boolean(row.is_suspended),
                            workspaceDeleted: row.deleted_at != null,
                            expiresAt: now + CACHE_TTL_MS,
                        };
                        agentStateCache.set(userId, cached);
                    }
                }
                if (cached) {
                    if (!cached.isActive) {
                        throw new common_1.UnauthorizedException('Agent account is deactivated.');
                    }
                    if (typeof payload.tv === 'number' && cached.tokenVersion !== payload.tv) {
                        agentStateCache.delete(userId);
                        throw new common_1.UnauthorizedException('Session has been revoked.');
                    }
                    if (cached.workspaceDeleted || (cached.workspaceSuspended && !cached.isSuperAdmin)) {
                        throw new common_1.UnauthorizedException('Workspace access is suspended or unavailable.');
                    }
                    role = cached.role || role;
                    workspaceId = cached.workspaceId || workspaceId;
                    isSuperAdmin = cached.isSuperAdmin;
                }
            }
            request.user = {
                id: userId,
                email: payload.email,
                name: payload.name,
                role,
                workspaceId,
                isSuperAdmin,
            };
            return true;
        }
        catch (err) {
            if (err instanceof common_1.UnauthorizedException)
                throw err;
            throw new common_1.UnauthorizedException(`Invalid or expired authentication token: ${err.message}`);
        }
    }
    extractTokenFromHeader(request) {
        const authHeader = request.headers.authorization;
        if (!authHeader)
            return undefined;
        const [type, token] = authHeader.split(' ');
        return type === 'Bearer' ? token : undefined;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        core_1.Reflector,
        database_service_1.DatabaseService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map