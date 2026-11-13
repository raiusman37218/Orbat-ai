const DEV_FALLBACK_JWT_SECRET = 'orbat_ai_dev_only_jwt_secret_never_use_in_prod';
const DEV_FALLBACK_REFRESH_SECRET = 'orbat_ai_dev_only_refresh_secret_never_use_in_prod';

function assertStrongSecret(secret: string, envName: string): string {
  if (
    !secret ||
    secret.length < 32 ||
    secret.startsWith('orbat_ai_') ||
    secret.startsWith('replace-') ||
    secret.startsWith('replace_')
  ) {
    throw new Error(
      `${envName} must be explicitly configured with at least 32 random characters in production.`,
    );
  }
  return secret;
}

function resolveJwtSecret(envName: 'JWT_SECRET' | 'JWT_REFRESH_SECRET', devFallback: string): string {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const raw = (process.env[envName] || '').trim();

  if (nodeEnv === 'production') {
    if (!raw && envName === 'JWT_REFRESH_SECRET') {
      // Allow single shared JWT_SECRET when JWT_REFRESH_SECRET is omitted so separate Vercel deployments align cleanly
      const primary = (process.env.JWT_SECRET || '').trim();
      return assertStrongSecret(primary, 'JWT_REFRESH_SECRET');
    }
    return assertStrongSecret(raw, envName);
  }

  return raw || devFallback;
}

function resolveDefaultFrontendCallbackUrl(): string {
  const rawExplicit = (process.env.GOOGLE_CALLBACK_URL || '').trim();
  if (rawExplicit) return rawExplicit;

  const rawFrontend = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (rawFrontend) {
    const clean = rawFrontend.replace(/\/+$/, '');
    const withProto = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    return `${withProto}/auth/callback`;
  }

  return 'http://localhost:3000/auth/callback';
}

export default () => {
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
  const explicitRedisUrl = (process.env.REDIS_URL || '').trim();
  const explicitMaxPool = parseInt(process.env.DATABASE_MAX_POOL_SIZE || '', 10);

  return {
    port: parseInt(process.env.PORT || '4000', 10) || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
    isVercel,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    frontendUrl: (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim() || undefined,
    database: {
      url: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' || Boolean(process.env.DATABASE_URL?.includes('sslmode=require')),
      sslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
      maxPoolSize: Number.isFinite(explicitMaxPool) && explicitMaxPool > 0 ? explicitMaxPool : isVercel ? 5 : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
    jwt: {
      secret: resolveJwtSecret('JWT_SECRET', DEV_FALLBACK_JWT_SECRET),
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      refreshSecret: resolveJwtSecret('JWT_REFRESH_SECRET', DEV_FALLBACK_REFRESH_SECRET),
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: resolveDefaultFrontendCallbackUrl(),
    },
    redis: {
      url: explicitRedisUrl || undefined,
    },
    storage: {
      accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'orbat-chat-uploads',
      publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL,
    },
  };
};
