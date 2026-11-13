import 'server-only';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, queryRows } from '@/lib/db';
import { decryptSecret, encryptSecret, hasEncryptionKey } from '@/lib/channels/crypto';

export interface PgAuthUser {
  id: string;
  email: string;
  name?: string | null;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown>;
  created_at?: string;
}

export interface PgAgentAuthRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  brand_color: string | null;
  password_hash: string | null;
  is_active: boolean | null;
  is_super_admin: boolean | null;
  email_verified: boolean | null;
  token_version: number;
  totp_enabled: boolean;
}

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function parseMeta(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function findPgAuthUserByEmail(email: string): Promise<PgAuthUser | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  try {
    const accountRows = await queryRows<{
      id: string;
      email: string;
      name: string | null;
      email_confirmed_at: string | Date | null;
      raw_user_meta_data: unknown;
      created_at: string | Date | null;
    }>(
      `SELECT id, email, name, email_confirmed_at, raw_user_meta_data, created_at
       FROM public.auth_accounts
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [normalized],
    );

    if (accountRows.length > 0) {
      const r = accountRows[0];
      const meta = parseMeta(r.raw_user_meta_data);
      if (r.name && !meta.name) meta.name = r.name;
      return {
        id: r.id,
        email: r.email,
        name: r.name,
        email_confirmed_at: r.email_confirmed_at ? new Date(r.email_confirmed_at).toISOString() : null,
        user_metadata: meta,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      };
    }
  } catch (err: any) {
    // Allow fallback to public.agents if auth_accounts migration hasn't run yet
    if (!String(err?.message || '').includes('auth_accounts')) {
      throw err;
    }
  }

  const agentRows = await queryRows<{
    id: string;
    email: string;
    name: string | null;
    created_at: string | Date | null;
    email_verified?: boolean | null;
    email_confirmed_at?: string | Date | null;
  }>(
    `SELECT id, email, name, created_at
     FROM public.agents
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalized],
  );

  if (agentRows.length === 0) return null;
  const agent = agentRows[0];
  let confirmedAt: string | null = agent.created_at ? new Date(agent.created_at).toISOString() : new Date().toISOString();

  try {
    const verRows = await queryRows<{ email_verified: boolean | null; email_confirmed_at: string | Date | null }>(
      'SELECT email_verified, email_confirmed_at FROM public.agents WHERE id = $1 LIMIT 1',
      [agent.id],
    );
    if (verRows.length > 0) {
      if (verRows[0].email_verified === false) {
        confirmedAt = null;
      } else if (verRows[0].email_confirmed_at) {
        confirmedAt = new Date(verRows[0].email_confirmed_at).toISOString();
      }
    }
  } catch {
    // Column optional before migration
  }

  return {
    id: agent.id,
    email: agent.email,
    name: agent.name,
    email_confirmed_at: confirmedAt,
    user_metadata: agent.name ? { name: agent.name } : {},
    created_at: agent.created_at ? new Date(agent.created_at).toISOString() : undefined,
  };
}

export async function findPgAuthUserById(userId: string): Promise<PgAuthUser | null> {
  const cleanId = (userId || '').trim();
  if (!cleanId) return null;

  try {
    const rows = await queryRows<{
      id: string;
      email: string;
      name: string | null;
      email_confirmed_at: string | Date | null;
      raw_user_meta_data: unknown;
      created_at: string | Date | null;
    }>(
      `SELECT id, email, name, email_confirmed_at, raw_user_meta_data, created_at
       FROM public.auth_accounts
       WHERE id = $1
       LIMIT 1`,
      [cleanId],
    );
    if (rows.length > 0) {
      const r = rows[0];
      const meta = parseMeta(r.raw_user_meta_data);
      if (r.name && !meta.name) meta.name = r.name;
      return {
        id: r.id,
        email: r.email,
        name: r.name,
        email_confirmed_at: r.email_confirmed_at ? new Date(r.email_confirmed_at).toISOString() : null,
        user_metadata: meta,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      };
    }
  } catch {
    // Fall through to agents
  }

  const agentRows = await queryRows<{
    id: string;
    email: string;
    name: string | null;
    created_at: string | Date | null;
  }>('SELECT id, email, name, created_at FROM public.agents WHERE id = $1 LIMIT 1', [cleanId]);

  if (agentRows.length === 0) return null;
  const a = agentRows[0];
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    email_confirmed_at: a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString(),
    user_metadata: a.name ? { name: a.name } : {},
    created_at: a.created_at ? new Date(a.created_at).toISOString() : undefined,
  };
}

export async function createPgAuthUser(params: {
  id?: string;
  email: string;
  password?: string;
  email_confirm?: boolean;
  user_metadata?: Record<string, unknown>;
}): Promise<{ data: { user: PgAuthUser | null }; error: { message: string } | null }> {
  const normalized = normalizeEmail(params.email);
  if (!normalized || !normalized.includes('@')) {
    return { data: { user: null }, error: { message: 'Valid email is required.' } };
  }

  const existing = await findPgAuthUserByEmail(normalized);
  if (existing) {
    return {
      data: { user: null },
      error: { message: 'An account with this email address has already been registered.' },
    };
  }

  const id = params.id || crypto.randomUUID();
  const rawSecret = params.password || crypto.randomBytes(32).toString('base64url');
  const passwordHash = await bcrypt.hash(rawSecret, 10);
  const confirmedAt = params.email_confirm ? new Date().toISOString() : null;
  const meta = { ...(params.user_metadata || {}) };
  const name = typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : normalized.split('@')[0];
  if (!meta.name) meta.name = name;

  try {
    await query(
      `INSERT INTO public.auth_accounts (id, email, password_hash, name, email_confirmed_at, raw_user_meta_data)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [id, normalized, passwordHash, name, confirmedAt, JSON.stringify(meta)],
    );
  } catch (err: any) {
    if (String(err?.code) === '23505') {
      return {
        data: { user: null },
        error: { message: 'An account with this email address has already been registered.' },
      };
    }
    return { data: { user: null }, error: { message: err?.message || 'Failed to create user account.' } };
  }

  // Keep auth.users stub in sync if present for legacy foreign keys in local dev DBs
  try {
    await query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
      [id, normalized, JSON.stringify(meta)],
    );
  } catch {
    // auth.users is optional after 20261128090000 migration
  }

  return {
    data: {
      user: {
        id,
        email: normalized,
        name,
        email_confirmed_at: confirmedAt,
        user_metadata: meta,
        created_at: new Date().toISOString(),
      },
    },
    error: null,
  };
}

export async function updatePgAuthUser(
  userId: string,
  patch: {
    email_confirm?: boolean;
    password?: string;
    user_metadata?: Record<string, unknown>;
  },
): Promise<{ data: { user: PgAuthUser | null }; error: { message: string } | null }> {
  const cleanId = (userId || '').trim();
  if (!cleanId) {
    return { data: { user: null }, error: { message: 'User ID is required.' } };
  }

  try {
    const sets: string[] = ['updated_at = now()'];
    const values: unknown[] = [];
    let idx = 1;

    let newHash: string | null = null;
    if (patch.password) {
      newHash = await bcrypt.hash(patch.password, 10);
      sets.push(`password_hash = $${idx++}`);
      values.push(newHash);
    }

    const nowIso = new Date().toISOString();
    if (patch.email_confirm === true) {
      sets.push(`email_confirmed_at = COALESCE(email_confirmed_at, $${idx++})`);
      values.push(nowIso);
    }

    if (patch.user_metadata) {
      sets.push(`raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || $${idx++}::jsonb`);
      values.push(JSON.stringify(patch.user_metadata));
      if (typeof patch.user_metadata.name === 'string' && patch.user_metadata.name.trim()) {
        sets.push(`name = $${idx++}`);
        values.push(patch.user_metadata.name.trim());
      }
    }

    values.push(cleanId);
    await query(`UPDATE public.auth_accounts SET ${sets.join(', ')} WHERE id = $${idx}`, values);

    // Mirror email confirmation / password / name updates onto public.agents if row already exists
    const agentSets: string[] = [];
    const agentVals: unknown[] = [];
    let aIdx = 1;
    if (patch.email_confirm === true) {
      agentSets.push(`email_verified = true`, `email_confirmed_at = COALESCE(email_confirmed_at, $${aIdx++})`);
      agentVals.push(nowIso);
    }
    if (newHash) {
      agentSets.push(`password_hash = $${aIdx++}`);
      agentVals.push(newHash);
    }
    if (typeof patch.user_metadata?.name === 'string' && patch.user_metadata.name.trim()) {
      agentSets.push(`name = $${aIdx++}`);
      agentVals.push(patch.user_metadata.name.trim());
    }
    if (agentSets.length > 0) {
      agentVals.push(cleanId);
      await query(`UPDATE public.agents SET ${agentSets.join(', ')} WHERE id = $${aIdx}`, agentVals).catch(() => {});
    }

    const updated = await findPgAuthUserById(cleanId);
    return { data: { user: updated }, error: null };
  } catch (err: any) {
    return { data: { user: null }, error: { message: err?.message || 'Failed to update user.' } };
  }
}

export async function deletePgAuthUser(userId: string): Promise<void> {
  const cleanId = (userId || '').trim();
  if (!cleanId) return;
  await query('DELETE FROM public.auth_accounts WHERE id = $1', [cleanId]).catch(() => {});
  await query('DELETE FROM auth.users WHERE id = $1', [cleanId]).catch(() => {});
}

export async function getPgPasswordHashForUser(userId: string, email?: string): Promise<string | null> {
  const rows = await queryRows<{ password_hash: string | null }>(
    `SELECT password_hash FROM public.auth_accounts WHERE id = $1 OR LOWER(email) = LOWER($2) LIMIT 1`,
    [userId, email || ''],
  ).catch(() => []);
  return rows[0]?.password_hash || null;
}

export async function syncAuthAccountToAgent(params: {
  id: string;
  email: string;
  name: string;
  role: string;
  workspaceId: string | null;
  status?: string;
}): Promise<void> {
  const existingHash = await getPgPasswordHashForUser(params.id, params.email);
  await query(
    `INSERT INTO public.agents (id, email, name, role, status, workspace_id, password_hash, is_active, email_verified, email_confirmed_at, token_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, now(), 1)
     ON CONFLICT (id) DO UPDATE SET
       name = COALESCE(NULLIF(EXCLUDED.name, ''), public.agents.name),
       role = EXCLUDED.role,
       workspace_id = COALESCE(EXCLUDED.workspace_id, public.agents.workspace_id),
       password_hash = COALESCE(public.agents.password_hash, EXCLUDED.password_hash),
       is_active = true,
       email_verified = true`,
    [
      params.id,
      normalizeEmail(params.email),
      params.name,
      params.role,
      params.status || 'online',
      params.workspaceId,
      existingHash,
    ],
  );
}

export async function authenticatePgPassword(
  email: string,
  password: string,
): Promise<
  | { ok: true; agent: PgAgentAuthRecord }
  | { ok: false; status: 401 | 403; error: string; emailVerified?: boolean }
> {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    return { ok: false, status: 401, error: 'Email and password are required.' };
  }

  let rows: PgAgentAuthRecord[] = [];
  try {
    rows = await queryRows<PgAgentAuthRecord>(
      `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id,
              w.name AS workspace_name, w.brand_color,
              a.password_hash, a.is_active, a.is_super_admin,
              COALESCE(a.email_verified, true) AS email_verified,
              COALESCE(a.token_version, 1) AS token_version,
              COALESCE(a.totp_enabled, false) AS totp_enabled
       FROM public.agents a
       LEFT JOIN public.workspaces w ON w.id = a.workspace_id
       WHERE LOWER(a.email) = $1
       LIMIT 1`,
      [normalized],
    );
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('token_version') || msg.includes('totp_enabled') || msg.includes('email_verified')) {
      rows = await queryRows<any>(
        `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id,
                w.name AS workspace_name, w.brand_color,
                a.password_hash, a.is_active, a.is_super_admin
         FROM public.agents a
         LEFT JOIN public.workspaces w ON w.id = a.workspace_id
         WHERE LOWER(a.email) = $1
         LIMIT 1`,
        [normalized],
      ).then((r) =>
        r.map((row) => ({
          ...row,
          email_verified: true,
          token_version: 1,
          totp_enabled: false,
        })),
      );
    } else {
      throw err;
    }
  }

  if (rows.length > 0) {
    const agent = rows[0];
    if (agent.is_active === false) {
      return {
        ok: false,
        status: 403,
        error: 'Your account has been deactivated. Please contact your workspace administrator.',
      };
    }

    let hash = agent.password_hash;
    if (!hash) {
      hash = await getPgPasswordHashForUser(agent.id, agent.email);
      if (hash) {
        await query('UPDATE public.agents SET password_hash = $1 WHERE id = $2 AND password_hash IS NULL', [
          hash,
          agent.id,
        ]).catch(() => {});
      }
    }

    if (!hash) {
      return {
        ok: false,
        status: 401,
        error: 'This account uses Google Sign-In. Please sign in with Google.',
      };
    }

    const match = await bcrypt.compare(password, hash);
    if (!match) {
      return { ok: false, status: 401, error: 'Invalid email or password.' };
    }

    if (agent.email_verified === false) {
      return {
        ok: false,
        status: 403,
        emailVerified: false,
        error: 'Please verify your email address with the 6-digit code before signing in.',
      };
    }

    return { ok: true, agent };
  }

  // User signed up and staged in auth_accounts, not yet onboarded into public.agents
  try {
    const staged = await queryRows<{
      id: string;
      email: string;
      name: string | null;
      password_hash: string;
      email_confirmed_at: string | null;
    }>(
      `SELECT id, email, name, password_hash, email_confirmed_at
       FROM public.auth_accounts
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [normalized],
    );

    if (staged.length > 0) {
      const acct = staged[0];
      const match = await bcrypt.compare(password, acct.password_hash);
      if (!match) {
        return { ok: false, status: 401, error: 'Invalid email or password.' };
      }
      if (!acct.email_confirmed_at) {
        return {
          ok: false,
          status: 403,
          emailVerified: false,
          error: 'Email not confirmed. Please enter the 6-digit verification code sent to your inbox.',
        };
      }
      return {
        ok: true,
        agent: {
          id: acct.id,
          name: acct.name || normalized.split('@')[0],
          email: acct.email,
          role: 'owner',
          status: 'online',
          workspace_id: null,
          workspace_name: null,
          brand_color: null,
          password_hash: acct.password_hash,
          is_active: true,
          is_super_admin: false,
          email_verified: true,
          token_version: 1,
          totp_enabled: false,
        },
      };
    }
  } catch {
    // auth_accounts absent
  }

  return { ok: false, status: 401, error: 'Invalid email or password.' };
}

export async function bumpAgentTokenVersion(agentId: string): Promise<number> {
  const rows = await queryRows<{ token_version: number }>(
    `UPDATE public.agents
     SET token_version = COALESCE(token_version, 1) + 1
     WHERE id = $1
     RETURNING token_version`,
    [agentId],
  );
  return Number(rows[0]?.token_version ?? 1);
}

// ============================================================================
// Pure Node crypto RFC 6238 TOTP (Google Authenticator / Authy compatible)
// ============================================================================

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = (input || '').toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function buildOtpAuthUri(params: { secret: string; email: string; issuer?: string }): string {
  const issuer = params.issuer || 'Orbat AI';
  const label = encodeURIComponent(`${issuer}:${params.email}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(params.secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function generateTotpToken(secret: string, timeMs = Date.now(), stepSeconds = 30, digits = 6): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timeMs / 1000 / stepSeconds);
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
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function verifyTotpCode(secret: string, code: string, window = 1, timeMs = Date.now()): boolean {
  const normalized = (code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;

  const targetBuf = Buffer.from(normalized, 'utf8');
  for (let delta = -window; delta <= window; delta++) {
    const candidate = generateTotpToken(secret, timeMs + delta * 30_000);
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (
      candidateBuf.length === targetBuf.length &&
      crypto.timingSafeEqual(candidateBuf, targetBuf)
    ) {
      return true;
    }
  }
  return false;
}

function getTotpFallbackKey(): Buffer {
  const jwtSecret = (process.env.JWT_SECRET || '').trim();
  if (!jwtSecret) {
    throw new Error('Configure CHANNEL_ENCRYPTION_KEY or JWT_SECRET to store 2FA secrets.');
  }
  return crypto.createHash('sha256').update(`orbat:totp:${jwtSecret}`).digest();
}

export function sealTotpSecret(secret: string): string {
  if (hasEncryptionKey()) {
    return encryptSecret(secret);
  }
  const key = getTotpFallbackKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v2jwt', iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function unsealTotpSecret(sealed: string): string {
  if ((sealed || '').startsWith('v1:')) {
    return decryptSecret<string>(sealed);
  }
  const [version, iv, tag, data] = (sealed || '').split(':');
  if (version !== 'v2jwt' || !iv || !tag || data === undefined) {
    throw new Error('Unrecognised 2FA secret format.');
  }
  const key = getTotpFallbackKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

