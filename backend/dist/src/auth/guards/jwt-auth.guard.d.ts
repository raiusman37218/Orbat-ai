import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
export declare function invalidateAuthStateCache(agentId: string): void;
export declare function clearAuthStateCache(): void;
export declare class JwtAuthGuard implements CanActivate {
    private readonly jwtService;
    private readonly configService;
    private readonly reflector;
    private readonly db?;
    constructor(jwtService: JwtService, configService: ConfigService, reflector: Reflector, db?: DatabaseService | undefined);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private extractTokenFromHeader;
}
