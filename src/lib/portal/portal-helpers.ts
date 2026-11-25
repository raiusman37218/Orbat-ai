import crypto from 'node:crypto';
import type { PortalSessionPayload } from './portal-types';

export {
  mapFourButtonCsatToDb,
  mapTicketStatusToPortalStep,
  normalizeHelpLang,
  parseTicketNumberQuery,
  type PortalCsatChoice,
  type PortalHelpLang,
  type PortalSessionPayload,
} from './portal-types';

export const PORTAL_SESSION_COOKIE = 'orbat_portal_session';
export const PORTAL_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function resolvePortalSigningSecret(): string {
  const configured =
    process.env.PORTAL_SESSION_SECRET ||
    process.env.JWT_SECRET ||
    process.env.CHANNEL_ENCRYPTION_KEY;
  if (configured && configured.trim().length >= 16) {
    return configured.trim();
  }
  const dbSeed = process.env.DATABASE_URL || 'orbat-local-portal-dev-key';
  return crypto.createHash('sha256').update(`orbat-portal:${dbSeed}`).digest('hex');
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function fromBase64Url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export function signPortalSessionToken(
  payload: PortalSessionPayload,
  secret: string = resolvePortalSigningSecret(),
): string {
  const encoded = toBase64Url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyPortalSessionToken(
  token: string | null | undefined,
  secret: string = resolvePortalSigningSecret(),
  nowMs: number = Date.now(),
): PortalSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encoded).toString('utf8')) as Partial<PortalSessionPayload>;
    if (
      !parsed ||
      typeof parsed.workspaceId !== 'string' ||
      typeof parsed.email !== 'string' ||
      !Array.isArray(parsed.visitorIds) ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }
    if (parsed.expiresAt <= nowMs) return null;
    return {
      workspaceId: parsed.workspaceId,
      email: parsed.email.trim().toLowerCase(),
      name: typeof parsed.name === 'string' ? parsed.name : null,
      visitorIds: parsed.visitorIds.filter((id): id is string => typeof id === 'string'),
      issuedAt: typeof parsed.issuedAt === 'number' ? parsed.issuedAt : nowMs,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function hashPortalOtp(
  email: string,
  code: string,
  secret: string = resolvePortalSigningSecret(),
): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${email.trim().toLowerCase()}:${code.trim()}`)
    .digest('hex');
}
