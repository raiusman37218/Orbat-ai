import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
        expiresIn: string | undefined;
    }>;
    login(dto: LoginDto): Promise<{
        user: AuthenticatedUser;
        workspace: {
            id: any;
            name: any;
            brandColor: any;
        } | null;
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: string | undefined;
    }>;
    googleAuth(dto: GoogleAuthDto): Promise<{
        user: AuthenticatedUser;
        workspace: {
            id: any;
            name: any;
            brandColor: any;
        } | null;
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: string | undefined;
    }>;
    getGoogleAuthUrl(redirectUri?: string): {
        configured: boolean;
        url: null;
        message: string;
    } | {
        configured: boolean;
        url: string;
        message?: undefined;
    };
    refresh(dto: RefreshTokenDto): Promise<{
        user: AuthenticatedUser;
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: string | undefined;
    }>;
    getMe(user: AuthenticatedUser): Promise<{
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
        } | null;
    }>;
}
