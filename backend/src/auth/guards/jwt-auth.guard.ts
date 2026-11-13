import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AgentRole, AuthenticatedUser } from '../../common/types/tenant-context';
import { DatabaseService } from '../../database/database.service';

interface CachedAgentState {
  isActive: boolean;
  role: AgentRole;
  workspaceId: string;
  isSuperAdmin: boolean;
  tokenVersion: number;
  workspaceSuspended: boolean;
  workspaceDeleted: boolean;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const agentStateCache = new Map<string, CachedAgentState>();

export function invalidateAuthStateCache(agentId: string): void {
  agentStateCache.delete(agentId);
}

export function clearAuthStateCache(): void {
  agentStateCache.clear();
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    @Optional() private readonly db?: DatabaseService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing. Please provide a Bearer token.');
    }

    try {
      const secret = this.configService.get<string>('jwt.secret');
      const payload = await this.jwtService.verifyAsync(token, { secret });
      const userId = String(payload.sub || payload.id || '');
      let role: AgentRole = payload.role;
      let workspaceId: string = payload.workspaceId || payload.workspace_id;
      let isSuperAdmin = Boolean(payload.isSuperAdmin || payload.is_super_admin);

      if (!userId) {
        throw new UnauthorizedException('Token missing subject.');
      }

      if (this.db) {
        const now = Date.now();
        let cached = agentStateCache.get(userId);
        if (cached && typeof payload.tv === 'number' && cached.tokenVersion !== payload.tv) {
          agentStateCache.delete(userId);
          cached = undefined;
        }
        if (!cached || cached.expiresAt <= now) {
          const res = await this.db.query(
            `SELECT a.is_active, COALESCE(a.token_version, 1) AS token_version, a.role, a.workspace_id, a.is_super_admin,
                    w.is_suspended, w.deleted_at
             FROM public.agents a
             LEFT JOIN public.workspaces w ON w.id = a.workspace_id
             WHERE a.id = $1
             LIMIT 1`,
            [userId],
          );
          if (res?.rows) {
            if (res.rows.length === 0) {
              agentStateCache.delete(userId);
              throw new UnauthorizedException('Agent account no longer exists.');
            }
            const row = res.rows[0];
            cached = {
              isActive: row.is_active !== false,
              role: row.role as AgentRole,
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
            throw new UnauthorizedException('Agent account is deactivated.');
          }
          if (typeof payload.tv === 'number' && cached.tokenVersion !== payload.tv) {
            agentStateCache.delete(userId);
            throw new UnauthorizedException('Session has been revoked.');
          }
          if (cached.workspaceDeleted || (cached.workspaceSuspended && !cached.isSuperAdmin)) {
            throw new UnauthorizedException('Workspace access is suspended or unavailable.');
          }
          role = cached.role || role;
          workspaceId = cached.workspaceId || workspaceId;
          isSuperAdmin = cached.isSuperAdmin;
        }
      }

      // Attach typed user payload to request
      request.user = {
        id: userId,
        email: payload.email,
        name: payload.name,
        role,
        workspaceId,
        isSuperAdmin,
      } as AuthenticatedUser;

      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(`Invalid or expired authentication token: ${err.message}`);
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}

