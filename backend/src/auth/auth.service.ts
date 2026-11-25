import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';
import { isOriginAllowed, parseCorsAllowlist } from '../common/security/cors';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

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
      let preferredAgentId: string | null = null;
      await client.query('SAVEPOINT sp_auth_acct');
      try {
        const acctRes = await client.query(
          'SELECT id FROM public.auth_accounts WHERE LOWER(email) = $1 LIMIT 1',
          [emailNormalized],
        );
        preferredAgentId = acctRes.rows[0]?.id || null;
        await client.query('RELEASE SAVEPOINT sp_auth_acct');
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT sp_auth_acct').catch(() => {});
      }

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
         VALUES (COALESCE($7::uuid, gen_random_uuid()), $1, $2, $3, $4, $5, $6, true)
         RETURNING id, name, email, role, workspace_id, status, is_super_admin`,
        [dto.name.trim(), emailNormalized, 'owner', 'online', workspace.id, passwordHash, preferredAgentId],
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

  async login(dto: LoginDto) {
    const emailNormalized = dto.email.trim().toLowerCase();

    // Query agent by email
    const result = await this.db.query(
      `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id, a.password_hash,
              a.is_active, a.is_super_admin, COALESCE(a.email_verified, true) AS email_verified,
              COALESCE(a.token_version, 1) AS token_version,
              COALESCE(a.totp_enabled, false) AS totp_enabled,
              a.totp_secret_encrypted,
              w.name as workspace_name, w.brand_color
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

    if (agent.email_verified === false) {
      throw new ForbiddenException({
        message: 'Please verify your email address before signing in.',
        emailVerified: false,
      });
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

    if (agent.totp_enabled) {
      const code = typeof dto.totpCode === 'string' ? dto.totpCode.trim() : '';
      if (!code) {
        throw new ForbiddenException({
          message: 'Two-factor authentication code is required.',
          requiresMfa: true,
        });
      }
      const sealed = agent.totp_secret_encrypted;
      if (!sealed) {
        throw new UnauthorizedException('Two-factor configuration is incomplete.');
      }
      const secret = this.unsealTotpSecret(sealed);
      if (!this.verifyTotpCode(secret, code)) {
        throw new UnauthorizedException({
          message: 'Invalid authenticator code.',
          requiresMfa: true,
        });
      }
    }

    // Generate tokens
    const userPayload: AuthenticatedUser = {
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

  /**
   * Authenticate or register with Google OAuth (code, idToken, or credential)
   */
  async googleAuth(dto: GoogleAuthDto) {
    let email: string | null = null;
    let name: string | null = null;
    let picture: string | null = null;

    const token = dto.idToken || dto.credential;
    const googleClientId = (
      this.configService.get<string>('google.clientId') ||
      process.env.GOOGLE_CLIENT_ID ||
      ''
    ).trim();

    if (!googleClientId) {
      throw new UnauthorizedException('Google OAuth client ID is not configured on the backend.');
    }

    const verifyGoogleIdToken = async (idToken: string) => {
      const payloadRes = await fetch('https://oauth2.googleapis.com/tokeninfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id_token: idToken }).toString(),
      });
      if (!payloadRes.ok) {
        throw new UnauthorizedException('Invalid Google ID token or credential.');
      }
      const payload = await payloadRes.json();
      const audMatches = payload.aud === googleClientId || payload.azp === googleClientId;
      const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
      if (!audMatches || !emailVerified) {
        throw new UnauthorizedException('Google token audience or email verification check failed.');
      }
      return payload;
    };

    if (dto.code) {
      const clientId = googleClientId;
      const clientSecret = this.configService.get<string>('google.clientSecret') || process.env.GOOGLE_CLIENT_SECRET;
      const callbackUrl = this.resolveGoogleCallbackUrl(dto.redirectUri);

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
        const payload = await verifyGoogleIdToken(tokenData.id_token);
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
      } else if (tokenData.access_token) {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (!userRes.ok) {
          throw new UnauthorizedException('Failed to fetch Google userinfo.');
        }
        const user = await userRes.json();
        if (user.email_verified !== true && user.email_verified !== 'true') {
          throw new UnauthorizedException('Google account email is not verified.');
        }
        email = user.email;
        name = user.name;
        picture = user.picture;
      }
    } else if (token) {
      const payload = await verifyGoogleIdToken(token);
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } else if (dto.accessToken) {
      const tokenInfoRes = await fetch('https://oauth2.googleapis.com/tokeninfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ access_token: dto.accessToken }).toString(),
      });
      if (!tokenInfoRes.ok) {
        throw new UnauthorizedException('Invalid Google access token.');
      }
      const tokenInfo = await tokenInfoRes.json();
      if (tokenInfo.aud !== googleClientId && tokenInfo.azp !== googleClientId) {
        throw new UnauthorizedException('Google access token audience mismatch.');
      }

      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${dto.accessToken}` },
      });
      if (!userRes.ok) {
        throw new UnauthorizedException('Failed to fetch Google userinfo.');
      }
      const user = await userRes.json();
      if (user.email_verified !== true && user.email_verified !== 'true') {
        throw new UnauthorizedException('Google account email is not verified.');
      }
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
              a.is_super_admin, COALESCE(a.token_version, 1) AS token_version,
              w.name as workspace_name, w.brand_color
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

      // Google has verified ownership of this email address; backfill avatar / verification metadata cleanly.
      try {
        await this.db.query(
          `UPDATE public.agents
           SET email_verified = true,
               email_confirmed_at = COALESCE(email_confirmed_at, now()),
               avatar_url = COALESCE(avatar_url, $2)
           WHERE id = $1`,
          [agent.id, picture || null],
        );
      } catch (e: any) {
        this.logger.warn(`Non-fatal Google profile metadata sync skipped for agent ${agent.id}: ${e?.message}`);
      }

      const userPayload: AuthenticatedUser = {
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
        isNewUser: false,
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
        `INSERT INTO public.agents (
           id, name, email, role, status, workspace_id, avatar_url, is_active,
           email_verified, email_confirmed_at, token_version
         )
         VALUES (gen_random_uuid(), $1, $2, 'owner', 'online', $3, $4, true, true, now(), 1)
         RETURNING id, name, email, role, workspace_id, status, is_super_admin`,
        [userName, emailNormalized, workspace.id, picture || null],
      );
      const agent = agentResult.rows[0];

      await client.query('SAVEPOINT sp_workspace_owner');
      try {
        await client.query('UPDATE public.workspaces SET owner_id = $1 WHERE id = $2', [agent.id, workspace.id]);
        await client.query('RELEASE SAVEPOINT sp_workspace_owner');
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT sp_workspace_owner');
      }

      const userPayload: AuthenticatedUser = {
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
        isNewUser: true,
        user: userPayload,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          brandColor: workspace.brand_color,
        },
      };
    });
  }

  private resolveGoogleCallbackUrl(requestedRedirectUri?: string): string {
    const configuredCallback = (process.env.GOOGLE_CALLBACK_URL || '').trim();
    const fallbackCallback =
      configuredCallback ||
      (() => {
        const fromConfig = this.configService.get<string>('google.callbackUrl');
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

      const allowlist = parseCorsAllowlist(process.env);
      let configuredCallbackOrigin: string | null = null;
      try {
        configuredCallbackOrigin = new URL(fallbackCallback).origin.toLowerCase();
      } catch {
        configuredCallbackOrigin = null;
      }

      if (
        isOriginAllowed(parsed.origin, allowlist) ||
        (configuredCallbackOrigin !== null && parsed.origin.toLowerCase() === configuredCallbackOrigin)
      ) {
        return `${parsed.origin}${parsed.pathname}`;
      }
    } catch {
      // Invalid redirectUri falls back to configured callback URL
    }

    return fallbackCallback;
  }

  getGoogleAuthUrl(requestedRedirectUri?: string, requestedState?: string) {
    const clientId = this.configService.get<string>('google.clientId') || process.env.GOOGLE_CLIENT_ID;
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

    const cleanState = typeof requestedState === 'string' ? requestedState.trim().slice(0, 512) : '';
    if (cleanState) {
      params.set('state', cleanState);
    }

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
        `SELECT id, name, email, role, workspace_id, is_active, is_super_admin,
                COALESCE(token_version, 1) AS token_version
         FROM public.agents WHERE id = $1 LIMIT 1`,
        [payload.sub],
      );

      if (result.rows.length === 0 || result.rows[0].is_active === false) {
        throw new UnauthorizedException('User account no longer active.');
      }

      const agent = result.rows[0];
      const currentVersion = Number(agent.token_version ?? 1);
      if (typeof payload.tv === 'number' && currentVersion !== payload.tv) {
        throw new UnauthorizedException('Session has been revoked.');
      }

      const userPayload: AuthenticatedUser = {
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
      this.jwtService.signAsync(
        { sub: user.id, tv: tokenVersion },
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

  private unsealTotpSecret(sealed: string): string {
    const parts = (sealed || '').split(':');
    const [version, ivB64, tagB64, dataB64] = parts;
    if (!ivB64 || !tagB64 || dataB64 === undefined) {
      throw new UnauthorizedException('Unrecognised 2FA secret format.');
    }

    let key: Buffer;
    if (version === 'v1') {
      const rawKey = (process.env.CHANNEL_ENCRYPTION_KEY || '').trim();
      if (!rawKey) {
        throw new UnauthorizedException('2FA encryption key is not configured on backend.');
      }
      key = /^[0-9a-f]{64}$/i.test(rawKey)
        ? Buffer.from(rawKey, 'hex')
        : Buffer.from(rawKey, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      const plain = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
      return JSON.parse(plain) as string;
    }

    if (version === 'v2jwt') {
      const configuredJwt = (
        this.configService.get<string>('jwt.secret') ||
        process.env.JWT_SECRET ||
        ''
      ).trim();
      const dbUrl = (process.env.DATABASE_URL || '').trim();
      const jwtSecret =
        configuredJwt ||
        (dbUrl ? crypto.createHmac('sha256', 'orbat-jwt-signing-key-v1').update(dbUrl).digest('hex') : '');
      if (!jwtSecret) {
        throw new UnauthorizedException('JWT secret is missing for 2FA verification.');
      }
      key = crypto.createHash('sha256').update(`orbat:totp:${jwtSecret}`).digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
    }

    throw new UnauthorizedException('Unsupported 2FA secret format.');
  }

  private verifyTotpCode(secret: string, code: string, window = 1, timeMs = Date.now()): boolean {
    const normalized = (code || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(normalized)) return false;

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = (secret || '').toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i++) {
      const idx = alphabet.indexOf(clean[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    const key = Buffer.from(bytes);
    const targetBuf = Buffer.from(normalized, 'utf8');

    for (let delta = -window; delta <= window; delta++) {
      const counter = Math.floor((timeMs + delta * 30_000) / 1000 / 30);
      const counterBuf = Buffer.alloc(8);
      counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
      counterBuf.writeUInt32BE(counter >>> 0, 4);

      const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
      const offset = hmac[hmac.length - 1] & 0x0f;
      const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
      const candidate = String(binary % 1_000_000).padStart(6, '0');
      const candidateBuf = Buffer.from(candidate, 'utf8');
      if (candidateBuf.length === targetBuf.length && crypto.timingSafeEqual(candidateBuf, targetBuf)) {
        return true;
      }
    }
    return false;
  }
}
