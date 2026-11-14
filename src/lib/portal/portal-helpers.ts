import crypto from 'node:crypto';

export type PortalHelpLang = 'en' | 'ur' | 'es';
export type PortalCsatChoice = 'bad' | 'okay' | 'good' | 'great';

export interface PortalSessionPayload {
  workspaceId: string;
  email: string;
  name?: string | null;
  visitorIds: string[];
  issuedAt: number;
  expiresAt: number;
}

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

export function mapTicketStatusToPortalStep(status: string | null | undefined): {
  step: 0 | 1 | 2;
  label: 'Received' | 'In progress' | 'Solved';
  bucket: 'open' | 'solved';
} {
  const normalized = (status || 'new').trim().toLowerCase();
  if (normalized === 'solved' || normalized === 'closed') {
    return { step: 2, label: 'Solved', bucket: 'solved' };
  }
  if (normalized === 'open' || normalized === 'pending' || normalized === 'hold') {
    return { step: 1, label: 'In progress', bucket: 'open' };
  }
  return { step: 0, label: 'Received', bucket: 'open' };
}

export function mapFourButtonCsatToDb(rating: PortalCsatChoice): {
  ticketRating: 'good' | 'bad';
  score10: 1 | 5 | 8 | 10;
  label: string;
} {
  switch (rating) {
    case 'bad':
      return { ticketRating: 'bad', score10: 1, label: 'Bad' };
    case 'okay':
      return { ticketRating: 'bad', score10: 5, label: 'Okay' };
    case 'good':
      return { ticketRating: 'good', score10: 8, label: 'Good' };
    case 'great':
      return { ticketRating: 'good', score10: 10, label: 'Great' };
  }
}

export function normalizeHelpLang(lang?: string | null): {
  lang: PortalHelpLang;
  dir: 'ltr' | 'rtl';
} {
  const normalized = (lang || 'en').trim().toLowerCase();
  if (normalized === 'ur' || normalized === 'urdu') {
    return { lang: 'ur', dir: 'rtl' };
  }
  if (normalized === 'es' || normalized === 'spanish') {
    return { lang: 'es', dir: 'ltr' };
  }
  return { lang: 'en', dir: 'ltr' };
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

export function parseTicketNumberQuery(input: string): number | null {
  const cleaned = input.trim().toUpperCase().replace(/^TCK-?/, '').replace(/^#/, '');
  if (!/^\d{1,10}$/.test(cleaned)) return null;
  const num = Number.parseInt(cleaned, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}
