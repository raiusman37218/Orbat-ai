import { OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';
export declare class AuthService implements OnModuleInit {
    private readonly db;
    private readonly jwtService;
    private readonly configService;
    private readonly logger;
    constructor(db: DatabaseService, jwtService: JwtService, configService: ConfigService);
    onModuleInit(): Promise<void>;
    signup(dto: SignupDto): Promise<{
        user: AuthenticatedUser;
        workspace: {
            id: any;
            name: any;
            brandColor: any;
        };
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: string;
    }>;
    login(dto: LoginDto): Promise<{
        user: AuthenticatedUser;
        workspace: {
            id: any;
            name: any;
            brandColor: any;
        };
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: string;
    }>;
    googleAuth(dto: GoogleAuthDto): Promise<{
        user: AuthenticatedUser;
        workspace: {
            id: any;
            name: any;
            brandColor: any;
        };
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: string;
    }>;
    getGoogleAuthUrl(): {
        configured: boolean;
        url: any;
        message: string;
    } | {
        configured: boolean;
        url: string;
        message?: undefined;
    };
    refreshToken(dto: RefreshTokenDto): Promise<{
        user: AuthenticatedUser;
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: string;
    }>;
    getMe(userId: string): Promise<{
        id: any;
        name: any;
        email: any;
        role: any;
        status: any;
        workspaceId: any;
        workspaceName: any;
        brandColor: any;
        isSuperAdmin: boolean;
        workspace: {
            id: any;
            name: any;
            brandColor: any;
            slug: any;
            logoUrl: any;
        };
    }>;
    private generateTokens;
}
