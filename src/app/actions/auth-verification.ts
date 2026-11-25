'use server';

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { query, queryRows } from '@/lib/db';
import { serviceClient } from '@/lib/pg/service';
import {
  bumpAgentTokenVersion,
  createPgAuthUser,
  updatePgAuthUser,
} from '@/lib/auth/postgres-auth';
import { sessionUser } from '@/lib/auth/session-user';
import { clientIpOf } from '@/lib/geo';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestOrigin } from '@/lib/request-origin';
import {
  sendSmtpEmail,
  verificationCodeEmail,
  passwordResetEmail,
  isValidEmail,
} from '@/lib/email/smtp';
import { isSmtpReady, loadWorkspaceSmtp } from '@/lib/email/workspace-smtp';
import { SMTPSettingsConfig } from '@/types/database';
import { userError } from '@/lib/errors/user-error';
import {
  generate6DigitCode,
  timingSafeCodeCheck,
  findAuthUserByEmail,
} from '@/lib/auth/verification-code';

const PASSWORD_RESET_TTL_MINUTES = 30;
const MIN_RESET_PASSWORD_LENGTH = 8;

const gResetSchema = globalThis as unknown as {
  __orbatPasswordResetTablePromise?: Promise<void>;
};

async function ensurePasswordResetTokensTable(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  if (!gResetSchema.__orbatPasswordResetTablePromise) {
    gResetSchema.__orbatPasswordResetTablePromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           user_id UUID NOT NULL,
           email TEXT NOT NULL,
           token_hash TEXT NOT NULL UNIQUE,
           expires_at TIMESTAMPTZ NOT NULL,
           used_at TIMESTAMPTZ,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash
         ON public.password_reset_tokens (token_hash)`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email_created
         ON public.password_reset_tokens (LOWER(email), created_at DESC)`,
      );
    })().catch(() => {
      gResetSchema.__orbatPasswordResetTablePromise = undefined;
    });
  }
  await gResetSchema.__orbatPasswordResetTablePromise;
}

function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

async function resolveClientIpSafe(): Promise<string> {
  try {
    const headerList = await headers();
    return clientIpOf(headerList) || 'unknown';
  } catch {
    return 'unknown';
  }
}

export interface PasswordResetRequestResult {
  success: boolean;
  delivery?: 'email' | 'dev_preview' | 'smtp_unconfigured' | 'smtp_failed' | 'noop';
  message?: string;
  error?: string;
  devResetUrl?: string;
  expiresMinutes?: number;
}

export interface PasswordResetCompleteResult {
  success: boolean;
  error?: string;
}

/**
 * Resolves whether email OTP verification should be required before completing signup.
 * Checks `PLATFORM_REQUIRE_EMAIL_VERIFICATION` env, platform defaults, or optional workspace security policy.
 */
export async function getSignupVerificationRequirementAction(
  workspaceId?: string | null,
): Promise<{ required: boolean }> {
  const envFlag = (
    process.env.PLATFORM_REQUIRE_EMAIL_VERIFICATION ||
    process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION ||
    ''
  )
    .trim()
    .toLowerCase();
  if (envFlag === 'true' || envFlag === '1') {
    return { required: true };
  }

  try {
    const supabaseAdmin = serviceClient();
    const { data: platformData } = await supabaseAdmin
      .from('platform_settings')
      .select('default_features')
      .eq('id', 'default')
      .maybeSingle();

    const df = (platformData?.default_features || {}) as Record<string, unknown>;
    if (df.require_email_verification === true || df.email_verification === true) {
      return { required: true };
    }
  } catch {
    // Non-fatal fallback
  }

  const wsId = (workspaceId || '').trim();
  if (wsId) {
    try {
      const wsRows = await queryRows<{ security_policies: Record<string, unknown> | null }>(
        `SELECT security_policies FROM public.workspaces WHERE id = $1 LIMIT 1`,
        [wsId],
      );
      const sec = wsRows[0]?.security_policies || {};
      if (sec.requireEmailVerification === true || sec.require_email_verification === true) {
        return { required: true };
      }
    } catch {
      // Non-fatal fallback
    }
  }

  return { required: false };
}

/**
 * Server Action: Start user registration and dispatch 6-digit OTP verification email from ZenTry
 */
export async function sendSignupVerificationCodeAction(params: {
  email: string;
  name: string;
  password?: string;
}): Promise<{ success: boolean; error?: string; email?: string; warning?: string; code?: string }> {
  try {
    const normalizedEmail = (params.email || '').trim().toLowerCase();
    const cleanName = (params.name || '').trim();

    if (!isValidEmail(normalizedEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (!cleanName) {
      return { success: false, error: 'Please enter your full name or company name.' };
    }

    const supabaseAdmin = serviceClient();

    // 1. Check existing account.
    // - Existing account WITH email_confirmed_at -> refuse ("already exists, sign in or reset password").
    // - Existing account WITHOUT email_confirmed_at -> do NOT create user and do NOT call updateUserById with password.
    //   Just send a new code. When it is verified, the account keeps the password it was created with.
    const existingUser = await findAuthUserByEmail(normalizedEmail);
    if (existingUser?.email_confirmed_at) {
      throw userError('An account with this email already exists. Sign in, or use "Forgot password".');
    }

    // 2. IP rate limit: 10 verification requests an hour per IP
    let clientIp = 'unknown';
    try {
      const headerList = await headers();
      clientIp = clientIpOf(headerList) || 'unknown';
    } catch {}

    const ipAllowed = await checkRateLimit(`signup_ip:${clientIp}`, 10, 3600);
    if (!ipAllowed) {
      return {
        success: false,
        error: 'Too many verification codes requested from this IP. Please try again later.',
      };
    }

    // 3. Rate limit sending: no more than 1 code per 60 seconds and 5 per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentCodes } = await supabaseAdmin
      .from('email_verifications')
      .select('created_at, locked_until')
      .eq('email', normalizedEmail)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });

    const rows = recentCodes || [];

    if (rows.length > 0) {
      const mostRecentTime = new Date(rows[0].created_at).getTime();
      const elapsedSeconds = (Date.now() - mostRecentTime) / 1000;
      if (elapsedSeconds < 60) {
        const waitSec = Math.ceil(60 - elapsedSeconds);
        return {
          success: false,
          error: `Please wait ${waitSec} second${waitSec === 1 ? '' : 's'} before requesting another verification code.`,
        };
      }
    }

    if (rows.length >= 5) {
      return {
        success: false,
        error: 'Too many verification codes requested. Please try again in an hour.',
      };
    }

    // Create user unconfirmed in Supabase Auth if this is a fresh registration and password is provided.
    // If an unconfirmed user already exists, do NOT create a user and do NOT call updateUserById with a password.
    if (!existingUser && params.password) {
      const { error: createError } = await createPgAuthUser({
        email: normalizedEmail,
        password: params.password,
        email_confirm: false,
        user_metadata: { name: cleanName },
      });

      if (createError) {
        if (/already registered|already exists/i.test(createError.message)) {
          throw userError('An account with this email already exists. Sign in, or use "Forgot password".');
        }
        console.error('[Verification] Error creating staged user:', createError);
        return { success: false, error: createError.message };
      }
    }

    // 3. Generate cryptographically sound 6-digit OTP Code
    const code = generate6DigitCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    // Reset wrong attempt counts and unlocks when a new code is sent
    await supabaseAdmin
      .from('email_verifications')
      .update({ attempts: 0, locked_until: null })
      .eq('email', normalizedEmail);

    // Save fresh code
    const { error: insertError } = await supabaseAdmin
      .from('email_verifications')
      .insert({
        email: normalizedEmail,
        code,
        expires_at: expiresAt,
        attempts: 0,
        locked_until: null,
      });

    if (insertError) {
      console.error('[Verification] Error storing verification code:', insertError);
      return { success: false, error: 'Failed to generate verification code. Please try again.' };
    }

    // 4. Dispatch official ZenTry verification email via Platform SMTP
    const { data: platformData } = await supabaseAdmin
      .from('platform_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    const smtpConfig = platformData?.smtp_settings as SMTPSettingsConfig | null;

    let emailSent = false;
    let sendError: string | undefined = undefined;

    if (smtpConfig && smtpConfig.user && smtpConfig.pass && smtpConfig.enabled) {
      const email = verificationCodeEmail({
        code,
        name: cleanName,
        platformName: platformData?.platform_name || 'Zen-try',
        platformUrl: platformData?.platform_url || 'https://orbatai.com',
      });

      const sendResult = await sendSmtpEmail(smtpConfig, {
        to: normalizedEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: { 'Auto-Submitted': 'auto-generated' },
      });

      if (!sendResult.success) {
        console.error('[Verification] SMTP dispatch failed:', sendResult.error);
        sendError = sendResult.error || 'Failed to dispatch verification email.';
      } else {
        emailSent = true;
      }
    } else {
      console.warn('[Verification] Platform SMTP not configured yet. Code generated:', code);
      sendError = 'Platform email delivery is not configured or active.';
    }

    // Fail closed: if email cannot be sent, return an error.
    // Never return code in production (already gated by NODE_ENV).
    if (!emailSent) {
      return {
        success: false,
        error: sendError || 'Failed to dispatch verification email.',
        code: process.env.NODE_ENV !== 'production' ? code : undefined,
      };
    }

    return {
      success: true,
      email: normalizedEmail,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Verification] Unexpected error sending code:', err);
    return { success: false, error: message || 'Failed to dispatch verification email.' };
  }
}

/**
 * Server Action: Verify 6-digit OTP code entered/pasted by user
 */
export async function verifySignupCodeAction(params: {
  email: string;
  code: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = (params.email || '').trim().toLowerCase();
    const cleanCode = (params.code || '').replace(/\D/g, '').trim();

    if (!normalizedEmail) {
      return { success: false, error: 'Email address is missing.' };
    }

    if (cleanCode.length !== 6) {
      return { success: false, error: 'Please enter a valid 6-digit verification code.' };
    }

    const supabaseAdmin = serviceClient();

    // 1. Look up latest verification record for this email
    const { data: record, error: lookupError } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError || !record) {
      return {
        success: false,
        error: 'Invalid or expired verification code. Please check your email or request a new one.',
      };
    }

    // 2. Check if locked out due to too many failed attempts (5 wrong tries locks for 15 minutes)
    if (record.locked_until && new Date(record.locked_until).getTime() > Date.now()) {
      return {
        success: false,
        error: 'Too many wrong attempts. This email is locked for 15 minutes.',
      };
    }

    // 3. Timing-safe comparison and expiration check
    const isExpired = new Date(record.expires_at).getTime() <= Date.now();
    const isValid = !isExpired && timingSafeCodeCheck(cleanCode, record.code);

    if (!isValid) {
      const newAttempts = (record.attempts || 0) + 1;
      const shouldLock = newAttempts >= 5;
      const lockTimestamp = shouldLock
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;

      await supabaseAdmin
        .from('email_verifications')
        .update({
          attempts: newAttempts,
          locked_until: lockTimestamp,
        })
        .eq('id', record.id);

      if (shouldLock) {
        return {
          success: false,
          error: 'Too many wrong attempts. This email is locked for 15 minutes.',
        };
      }

      return {
        success: false,
        error: 'Invalid or expired verification code. Please check your email or request a new one.',
      };
    }

    // 4. Code is valid! Delete verification records for this email
    await supabaseAdmin
      .from('email_verifications')
      .delete()
      .eq('email', normalizedEmail);

    // 5. Mark user confirmed in pure PostgreSQL auth accounts / agents
    const targetUser = await findAuthUserByEmail(normalizedEmail);

    if (targetUser) {
      const { error: confirmError } = await updatePgAuthUser(
        targetUser.id,
        { email_confirm: true }
      );

      if (confirmError) {
        console.error('[Verification] Error confirming user email:', confirmError);
        return { success: false, error: 'Failed to activate user account. Please try again.' };
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Verification] Error verifying code:', err);
    return { success: false, error: message || 'Verification failed.' };
  }
}

/**
 * Server Action: Resend fresh 6-digit OTP code to user
 */
export async function resendSignupVerificationCodeAction(params: {
  email: string;
  name?: string;
}): Promise<{ success: boolean; error?: string; email?: string; warning?: string; code?: string }> {
  return sendSignupVerificationCodeAction({
    email: params.email,
    name: params.name || 'Business Owner',
  });
}

/**
 * Generates a 30-minute single-use password reset token (stored as SHA-256 hash)
 * and sends a reset link via configured Platform/Workspace SMTP.
 * In non-production mode (or explicit admin-gated demo mode) when SMTP is unconfigured,
 * returns an honest status and `devResetUrl`; in production without SMTP, fails closed without leaking tokens.
 */
export async function requestPasswordResetAction(
  emailOrInput: string | { email: string },
): Promise<PasswordResetRequestResult> {
  try {
    const rawEmail = typeof emailOrInput === 'string' ? emailOrInput : emailOrInput?.email || '';
    const normalizedEmail = rawEmail.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const clientIp = await resolveClientIpSafe();
    const ipAllowed = await checkRateLimit(`pwd_reset_ip:${clientIp}`, 10, 3600);
    if (!ipAllowed) {
      return {
        success: false,
        error: 'Too many password reset requests from this IP. Please try again later.',
      };
    }

    await ensurePasswordResetTokensTable();

    const [authUser, agentRows] = await Promise.all([
      findAuthUserByEmail(normalizedEmail),
      queryRows<{
        id: string;
        name: string | null;
        email: string;
        workspace_id: string | null;
        is_active: boolean | null;
      }>(
        `SELECT id, name, email, workspace_id, COALESCE(is_active, true) AS is_active
         FROM public.agents
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [normalizedEmail],
      ).catch(() => []),
    ]);

    const agent = agentRows[0] ?? null;
    const targetUserId = agent?.id || authUser?.id || null;
    const targetName =
      agent?.name ||
      authUser?.name ||
      (typeof authUser?.user_metadata?.name === 'string' ? authUser.user_metadata.name : null);

    if (!targetUserId || agent?.is_active === false) {
      return {
        success: true,
        delivery: 'noop',
        expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
        message: 'If an account exists for that email, a password reset link is on its way.',
      };
    }

    const recentRows = await queryRows<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM public.password_reset_tokens
       WHERE LOWER(email) = $1
         AND created_at >= now() - interval '60 minutes'`,
      [normalizedEmail],
    );
    if (Number(recentRows[0]?.cnt || 0) >= 5) {
      return {
        success: false,
        error: 'Too many password reset requests. Please try again in an hour.',
      };
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();

    await query(
      `UPDATE public.password_reset_tokens
       SET used_at = now()
       WHERE (user_id = $1 OR LOWER(email) = $2)
         AND used_at IS NULL`,
      [targetUserId, normalizedEmail],
    );

    await query(
      `INSERT INTO public.password_reset_tokens (user_id, email, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [targetUserId, normalizedEmail, tokenHash, expiresAt],
    );

    const origin = (await getRequestOrigin().catch(() => 'http://localhost:3000')) || 'http://localhost:3000';
    const resetUrl = `${origin.replace(/\/+$/, '')}/forgot?token=${encodeURIComponent(rawToken)}`;

    const supabaseAdmin = serviceClient();
    let platformData: Record<string, unknown> | null = null;
    try {
      const res = await supabaseAdmin
        .from('platform_settings')
        .select('smtp_settings, platform_name, email_brand_color, email_logo_url')
        .eq('id', 'default')
        .maybeSingle();
      platformData =
        res?.data && typeof res.data === 'object' ? (res.data as Record<string, unknown>) : null;
    } catch {
      platformData = null;
    }

    const platformSmtp = (platformData?.smtp_settings as SMTPSettingsConfig | null | undefined) ?? null;
    let activeSmtp: SMTPSettingsConfig | null = isSmtpReady(platformSmtp) ? platformSmtp : null;

    if (!activeSmtp && agent?.workspace_id) {
      activeSmtp = await loadWorkspaceSmtp(agent.workspace_id).catch(() => null);
    }

    if (activeSmtp) {
      const mail = passwordResetEmail({
        resetUrl,
        name: targetName,
        platformName:
          typeof platformData?.platform_name === 'string' && platformData.platform_name
            ? platformData.platform_name
            : 'Orbat AI',
        brandColor:
          typeof platformData?.email_brand_color === 'string'
            ? platformData.email_brand_color
            : null,
        logoUrl:
          typeof platformData?.email_logo_url === 'string'
            ? platformData.email_logo_url
            : null,
        expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
      });

      const sendRes = await sendSmtpEmail(activeSmtp, {
        to: normalizedEmail,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: { 'Auto-Submitted': 'auto-generated' },
      });

      if (!sendRes.success) {
        return {
          success: false,
          delivery: 'smtp_failed',
          error: sendRes.error || 'Could not send password reset email.',
        };
      }

      return {
        success: true,
        delivery: 'email',
        expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
        message: 'If an account exists for that email, a password reset link is on its way.',
      };
    }

    const isProd = process.env.NODE_ENV === 'production';
    let allowDemoPreview = !isProd;
    if (isProd && process.env.ORBAT_DEMO_AUTH_PREVIEW === 'true') {
      const caller = await sessionUser().catch(() => null);
      const role = String(caller?.role || '').toLowerCase();
      allowDemoPreview = Boolean(caller && (role === 'owner' || role === 'admin' || caller.isSuperAdmin));
    }

    if (allowDemoPreview) {
      return {
        success: true,
        delivery: 'dev_preview',
        expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
        message:
          'SMTP email delivery is not configured in local dev/demo mode. Use the single-use reset link below (valid for 30 minutes).',
        devResetUrl: resetUrl,
      };
    }

    return {
      success: false,
      delivery: 'smtp_unconfigured',
      error:
        'Password reset email delivery (SMTP) is not configured yet. Ask your workspace or platform administrator to configure SMTP.',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Password Reset Request] Error:', err);
    return {
      success: false,
      error: message || 'Could not start password reset. Please try again.',
    };
  }
}

/**
 * Validates a single-use reset token, updates the user's bcrypt password hash across
 * auth accounts and agent records, and bumps token_version to revoke older sessions.
 */
export async function completePasswordResetAction(
  tokenOrInput: string | { token: string; newPassword: string },
  maybeNewPassword?: string,
): Promise<PasswordResetCompleteResult> {
  try {
    const rawToken = typeof tokenOrInput === 'string' ? tokenOrInput : tokenOrInput?.token || '';
    const newPassword =
      typeof tokenOrInput === 'string' ? maybeNewPassword || '' : tokenOrInput?.newPassword || '';

    const cleanToken = rawToken.trim();
    if (!cleanToken) {
      return { success: false, error: 'Password reset link is missing a valid token.' };
    }

    if (newPassword.length < MIN_RESET_PASSWORD_LENGTH) {
      return {
        success: false,
        error: `New password must be at least ${MIN_RESET_PASSWORD_LENGTH} characters long.`,
      };
    }

    await ensurePasswordResetTokensTable();

    const tokenHash = hashResetToken(cleanToken);
    const claimedRows = await queryRows<{ id: string; user_id: string; email: string }>(
      `UPDATE public.password_reset_tokens
       SET used_at = now()
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > now()
       RETURNING id, user_id, email`,
      [tokenHash],
    );

    const claimed = claimedRows[0];
    if (!claimed) {
      const existingRows = await queryRows<{ used_at: string | Date | null; expires_at: string | Date }>(
        `SELECT used_at, expires_at
         FROM public.password_reset_tokens
         WHERE token_hash = $1
         LIMIT 1`,
        [tokenHash],
      ).catch(() => []);

      const existing = existingRows[0];
      if (existing?.used_at) {
        return {
          success: false,
          error: 'This password reset link has already been used. Request a new one.',
        };
      }
      if (existing?.expires_at && new Date(existing.expires_at).getTime() <= Date.now()) {
        return {
          success: false,
          error: 'This password reset link has expired (valid for 30 minutes). Request a new one.',
        };
      }
      return {
        success: false,
        error: 'Invalid or expired password reset link.',
      };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update both auth_accounts and agents (by ID or normalized email) so both credential flows stay synced.
    const updateRes = await updatePgAuthUser(claimed.user_id, {
      password: newPassword,
      email_confirm: true,
    });
    if (updateRes.error) {
      return { success: false, error: updateRes.error.message || 'Could not update password.' };
    }

    await query(
      `UPDATE public.agents
       SET password_hash = $1,
           email_verified = true,
           email_confirmed_at = COALESCE(email_confirmed_at, now())
       WHERE (id = $2 OR LOWER(email) = LOWER($3))`,
      [passwordHash, claimed.user_id, claimed.email],
    ).catch(() => {});

    await bumpAgentTokenVersion(claimed.user_id).catch(() => 1);
    await query(
      `UPDATE public.agents
       SET token_version = COALESCE(token_version, 1) + 1
       WHERE LOWER(email) = LOWER($1) AND id <> $2`,
      [claimed.email, claimed.user_id],
    ).catch(() => {});

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Password Reset Complete] Error:', err);
    return {
      success: false,
      error: message || 'Could not reset your password. Please try again.',
    };
  }
}
