import { describe, expect, it } from 'vitest';
import {
  hashPortalOtp,
  mapFourButtonCsatToDb,
  mapTicketStatusToPortalStep,
  normalizeHelpLang,
  parseTicketNumberQuery,
  signPortalSessionToken,
  verifyPortalSessionToken,
} from './portal-helpers';

describe('portal-helpers', () => {
  const secret = 'test-portal-signing-secret-123456';

  it('signs and verifies portal session tokens and rejects tampered or expired tokens', () => {
    const now = 1_700_000_000_000;
    const token = signPortalSessionToken(
      {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        email: 'Customer@Example.com',
        name: 'Ayesha',
        visitorIds: ['22222222-2222-2222-2222-222222222222'],
        issuedAt: now,
        expiresAt: now + 60_000,
      },
      secret,
    );

    const valid = verifyPortalSessionToken(token, secret, now + 1_000);
    expect(valid).not.toBeNull();
    expect(valid?.email).toBe('customer@example.com');
    expect(valid?.visitorIds).toHaveLength(1);

    const tampered = `${token.slice(0, -4)}zzzz`;
    expect(verifyPortalSessionToken(tampered, secret, now + 1_000)).toBeNull();
    expect(verifyPortalSessionToken(token, 'wrong-secret-00000000', now + 1_000)).toBeNull();
    expect(verifyPortalSessionToken(token, secret, now + 120_000)).toBeNull();
  });

  it('maps ticket statuses onto the 3-step portal tracker', () => {
    expect(mapTicketStatusToPortalStep('new')).toEqual({
      step: 0,
      label: 'Received',
      bucket: 'open',
    });
    expect(mapTicketStatusToPortalStep('pending')).toEqual({
      step: 1,
      label: 'In progress',
      bucket: 'open',
    });
    expect(mapTicketStatusToPortalStep('solved')).toEqual({
      step: 2,
      label: 'Solved',
      bucket: 'solved',
    });
    expect(mapTicketStatusToPortalStep('closed')).toEqual({
      step: 2,
      label: 'Solved',
      bucket: 'solved',
    });
  });

  it('preserves 4-level CSAT scores while respecting binary ticket constraint', () => {
    expect(mapFourButtonCsatToDb('bad')).toEqual({
      ticketRating: 'bad',
      score10: 1,
      label: 'Bad',
    });
    expect(mapFourButtonCsatToDb('okay')).toEqual({
      ticketRating: 'bad',
      score10: 5,
      label: 'Okay',
    });
    expect(mapFourButtonCsatToDb('good')).toEqual({
      ticketRating: 'good',
      score10: 8,
      label: 'Good',
    });
    expect(mapFourButtonCsatToDb('great')).toEqual({
      ticketRating: 'good',
      score10: 10,
      label: 'Great',
    });
  });

  it('normalizes language direction and ticket lookup formats', () => {
    expect(normalizeHelpLang('ur')).toEqual({ lang: 'ur', dir: 'rtl' });
    expect(normalizeHelpLang('es')).toEqual({ lang: 'es', dir: 'ltr' });
    expect(normalizeHelpLang('unknown')).toEqual({ lang: 'en', dir: 'ltr' });

    expect(parseTicketNumberQuery('TCK-1042')).toBe(1042);
    expect(parseTicketNumberQuery('#98')).toBe(98);
    expect(parseTicketNumberQuery('1042')).toBe(1042);
    expect(parseTicketNumberQuery('abc')).toBeNull();

    expect(hashPortalOtp('A@B.COM', '123456', secret)).toBe(
      hashPortalOtp('a@b.com', ' 123456 ', secret),
    );
  });
});
