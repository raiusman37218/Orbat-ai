import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types/tenant-context';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new ForbiddenException('User is not authenticated.');
    }

    // Determine target workspace from params, headers, or query
    const targetWorkspaceId =
      request.params?.workspaceId ||
      request.headers['x-workspace-id'] ||
      request.query?.workspace_id ||
      request.query?.workspaceId ||
      request.body?.workspace_id ||
      request.body?.workspaceId ||
      user.workspaceId;

    if (!targetWorkspaceId) {
      throw new BadRequestException('Target workspace ID could not be identified.');
    }

    // Super admins can access any workspace; standard agents only their own workspace
    if (!user.isSuperAdmin && user.workspaceId !== targetWorkspaceId) {
      throw new ForbiddenException('Cross-tenant access denied: You do not belong to this workspace.');
    }

    // Bind verified workspaceId to request context
    request.workspaceId = targetWorkspaceId;
    return true;
  }
}

