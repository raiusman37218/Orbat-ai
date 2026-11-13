import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async onModuleInit() {
    // Ensure password_hash column and id default exist on agents table for native auth
    try {
      await this.db.query(`
        ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS password_hash TEXT;
        ALTER TABLE public.agents ALTER COLUMN id SET DEFAULT gen_random_uuid();
        ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_id_fkey;
        CREATE INDEX IF NOT EXISTS idx_agents_email ON public.agents (LOWER(email));
        ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;
      `);
      this.logger.log('Native auth schema verified (password_hash, id default, and constraints checked).');
    } catch (err: any) {
      this.logger.warn(`Could not verify native auth columns on startup: ${err.message}`);
    }
  }

  async signup(dto: SignupDto) {
    const emailNormalized = dto.email.trim().toLowerCase();

    // Check if agent already exists
    const existing = await this.db.query(
      'SELECT id FROM public.agents WHERE LOWER(email) = $1 LIMIT 1',
      [emailNormalized],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException('An account with this email address already exists.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.db.transaction(async (client) => {
      // 1. Create workspace
      const workspaceName = dto.workspaceName?.trim() || `${dto.name.trim()}'s Workspace`;
      const wsResult = await client.query(
        `INSERT INTO public.workspaces (name, brand_color, greeting_title, greeting_message, owner_id)
         VALUES ($1, $2, $3, $4, NULL)
         RETURNING id, name, brand_color`,
        [workspaceName, '#4f46e5', 'Welcome to Orbat AI', 'How can we help you today?'],
      );
      const workspace = wsResult.rows[0];

      // 2. Create agent with role owner
      const agentResult = await client.query(
        `INSERT INTO public.agents (id, name, email, role, status, workspace_id, password_hash, is_active)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true)
         RETURNING id, name, email, role, workspace_id, status, is_super_admin`,
        [dto.name.trim(), emailNormalized, 'owner', 'online', workspace.id, passwordHash],
      );
      const agent = agentResult.rows[0];

      // 3. Update workspace owner_id to actual agent id
      try {
        await client.query(
          'UPDATE public.workspaces SET owner_id = $1 WHERE id = $2',
          [agent.id, workspace.id],
        );
      } catch (e) {
        // If owner_id FK still exists on auth.users, ignore updating owner_id or let it remain NULL
      }

      // 4. Generate JWT tokens
      const userPayload: AuthenticatedUser = {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        workspaceId: agent.workspace_id,
        isSuperAdmin: Boolean(agent.is_super_admin),
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

  async login(dto: LoginDto) {
    const emailNormalized = dto.email.trim().toLowerCase();

    // Query agent by email
    const result = await this.db.query(
      `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id, a.password_hash,
              a.is_active, a.is_super_admin, w.name as workspace_name, w.brand_color
       FROM public.agents a
       LEFT JOIN public.workspaces w ON w.id = a.workspace_id
       WHERE LOWER(a.email) = $1
       LIMIT 1`,
      [emailNormalized],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const agent = result.rows[0];

    // Check account active status
    if (agent.is_active === false) {
      throw new ForbiddenException('Your account has been deactivated. Please contact your workspace administrator.');
    }

    // Verify password hash
    if (!agent.password_hash) {
      throw new UnauthorizedException(
        'This account was created via Google OAuth. Please sign in with Google.',
      );
    }

    const isMatch = await bcrypt.compare(dto.password, agent.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Generate tokens
    const userPayload: AuthenticatedUser = {
      id: agent.id,
      email: agent.email,
      name: agent.name,
      role: agent.role,
      workspaceId: agent.workspace_id,
      isSuperAdmin: Boolean(agent.is_super_admin),
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

  /**
   * Authenticate or register with Google OAuth (code, idToken, or credential)
   */
  async googleAuth(dto: GoogleAuthDto) {
    let email: string | null = null;
    let name: string | null = null;
    let picture: string | null = null;

    const token = dto.idToken || dto.credential;

    if (dto.code) {
      const clientId = this.configService.get<string>('google.clientId') || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = this.configService.get<string>('google.clientSecret') || process.env.GOOGLE_CLIENT_SECRET;
      const callbackUrl =
        this.configService.get<string>('google.callbackUrl') ||
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:3000/auth/callback';

      if (!clientId || !clientSecret) {
        throw new UnauthorizedException(
          'Google OAuth credentials are not configured on the backend. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env',
        );
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
        throw new UnauthorizedException('Failed to exchange Google authorization code.');
      }

      const tokenData = await tokenRes.json();
      if (tokenData.id_token) {
        const payloadRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokenData.id_token}`);
        if (payloadRes.ok) {
          const payload = await payloadRes.json();
          email = payload.email;
          name = payload.name;
          picture = payload.picture;
        }
      }
    } else if (token) {
      const payloadRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      if (!payloadRes.ok) {
        throw new UnauthorizedException('Invalid Google ID token or credential.');
      }
      const payload = await payloadRes.json();
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } else if (dto.accessToken) {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${dto.accessToken}` },
      });
      if (!userRes.ok) {
        throw new UnauthorizedException('Failed to fetch Google userinfo.');
      }
      const user = await userRes.json();
      email = user.email;
      name = user.name;
      picture = user.picture;
    } else {
      throw new BadRequestException('Please provide a Google code, idToken, or credential.');
    }

    if (!email) {
      throw new UnauthorizedException('Could not retrieve email from Google profile.');
    }

    const emailNormalized = email.trim().toLowerCase();

    // Check if agent already exists in Neon PostgreSQL
    const existing = await this.db.query(
      `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id, a.is_active,
              a.is_super_admin, w.name as workspace_name, w.brand_color
       FROM public.agents a
       LEFT JOIN public.workspaces w ON w.id = a.workspace_id
       WHERE LOWER(a.email) = $1
       LIMIT 1`,
      [emailNormalized],
    );

    if (existing.rows.length > 0) {
      const agent = existing.rows[0];
      if (agent.is_active === false) {
        throw new ForbiddenException('Your account has been deactivated. Please contact your workspace administrator.');
      }

      const userPayload: AuthenticatedUser = {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        workspaceId: agent.workspace_id,
        isSuperAdmin: Boolean(agent.is_super_admin),
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

    // New Google User -> Create Workspace and Agent in Neon PostgreSQL
    return this.db.transaction(async (client) => {
      const userName = name?.trim() || emailNormalized.split('@')[0];
      const workspaceName = `${userName}'s Workspace`;

      const wsResult = await client.query(
        `INSERT INTO public.workspaces (name, brand_color, greeting_title, greeting_message, owner_id)
         VALUES ($1, $2, $3, $4, NULL)
         RETURNING id, name, brand_color`,
        [workspaceName, '#4f46e5', 'Welcome to Orbat AI', 'How can we help you today?'],
      );
      const workspace = wsResult.rows[0];

      const agentResult = await client.query(
        `INSERT INTO public.agents (id, name, email, role, status, workspace_id, avatar_url, is_active)
         VALUES (gen_random_uuid(), $1, $2, 'owner', 'online', $3, $4, true)
         RETURNING id, name, email, role, workspace_id, status, is_super_admin`,
        [userName, emailNormalized, workspace.id, picture || null],
      );
      const agent = agentResult.rows[0];

      try {
        await client.query('UPDATE public.workspaces SET owner_id = $1 WHERE id = $2', [agent.id, workspace.id]);
      } catch (e) {}

      const userPayload: AuthenticatedUser = {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        workspaceId: agent.workspace_id,
        isSuperAdmin: Boolean(agent.is_super_admin),
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

  getGoogleAuthUrl() {
    const clientId = this.configService.get<string>('google.clientId') || process.env.GOOGLE_CLIENT_ID;
    const callbackUrl =
      this.configService.get<string>('google.callbackUrl') ||
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:3000/auth/callback';

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

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
      const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: refreshSecret,
      });

      // Verify agent is still active in database
      const result = await this.db.query(
        'SELECT id, name, email, role, workspace_id, is_active, is_super_admin FROM public.agents WHERE id = $1 LIMIT 1',
        [payload.sub],
      );

      if (result.rows.length === 0 || result.rows[0].is_active === false) {
        throw new UnauthorizedException('User account no longer active.');
      }

      const agent = result.rows[0];
      const userPayload: AuthenticatedUser = {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        workspaceId: agent.workspace_id,
        isSuperAdmin: Boolean(agent.is_super_admin),
      };

      const tokens = await this.generateTokens(userPayload);
      return {
        ...tokens,
        user: userPayload,
      };
    } catch (err: any) {
      throw new UnauthorizedException(`Invalid or expired refresh token: ${err.message}`);
    }
  }

  async getMe(userId: string) {
    const result = await this.db.query(
      `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id, a.is_super_admin,
              w.name as workspace_name, w.brand_color, w.slug, w.logo_url
       FROM public.agents a
       LEFT JOIN public.workspaces w ON w.id = a.workspace_id
       WHERE a.id = $1
       LIMIT 1`,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('User profile not found.');
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

  private async generateTokens(user: AuthenticatedUser) {
    const jwtSecret = this.configService.get<string>('jwt.secret');
    const jwtExpiresIn = this.configService.get<string>('jwt.expiresIn');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn');

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: user.workspaceId,
      isSuperAdmin: user.isSuperAdmin,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn,
      }),
      this.jwtService.signAsync(
        { sub: user.id },
        {
          secret: refreshSecret,
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: jwtExpiresIn,
    };
  }
}
