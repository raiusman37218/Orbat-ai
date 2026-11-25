/**
 * Client-safe portal types and pure helpers (zero Node.js imports).
 * Shared by Client Components (`HelpCenterScreen`, `CustomerPortalScreen`) and
 * Server Actions (`public-portal.ts`, `portal-helpers.ts`).
 */

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

export function parseTicketNumberQuery(input: string): number | null {
  const cleaned = input.trim().toUpperCase().replace(/^TCK-?/, '').replace(/^#/, '');
  if (!/^\d{1,10}$/.test(cleaned)) return null;
  const num = Number.parseInt(cleaned, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}
