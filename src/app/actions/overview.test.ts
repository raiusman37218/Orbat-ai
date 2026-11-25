import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mockQueryRows = vi.fn();
const mockGetWorkspaceAccess = vi.fn();

vi.mock('@/lib/db', () => ({
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
}));

vi.mock('@/lib/team/access', () => ({
  getWorkspaceAccess: (...args: unknown[]) => mockGetWorkspaceAccess(...args),
}));

import { listRecentActivityAction } from './overview';

describe('listRecentActivityAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspaceAccess.mockResolvedValue({ role: 'owner' });
  });

  it('returns sorted real Postgres events across all 6 support sources with links and strict workspace isolation', async () => {
    const sqlCalls: Array<{ sql: string; params: unknown[] }> = [];

    mockQueryRows.mockImplementation(async (sql: string, params: unknown[]) => {
      sqlCalls.push({ sql, params });

      if (sql.includes('FROM public.conversation_events')) {
        return [
          {
            id: 'ce-1',
            conversation_id: 'conv-1',
            type: 'request_handoff',
            meta: { reason: 'Billing dispute' },
            created_at: '2026-11-16T18:05:00Z',
            visitor_name: 'Sara Khan',
            handoff_reason: null,
          },
        ];
      }
      if (sql.includes("status IN ('solved', 'closed')")) {
        return [
          {
            id: 't-10',
            number: 104,
            subject: 'Refund approved',
            solved_at: '2026-11-16T18:02:00Z',
            first_agent_reply_at: null,
          },
        ];
      }
      if (sql.includes('FROM public.sla_events')) {
        return [
          {
            id: 'se-1',
            ticket_id: 't-11',
            metric: 'first_reply',
            event: 'breached',
            occurred_at: '2026-11-16T18:06:00Z',
            ticket_number: 105,
            ticket_subject: 'API outage',
          },
        ];
      }
      if (sql.includes('sla_next_warn_at')) {
        return [
          // Duplicate of se-1 should be deduped, while t-12 warning should appear
          {
            id: 't-11',
            number: 105,
            subject: 'API outage',
            sla_next_metric: 'first_reply',
            sla_breached_at: '2026-11-16T18:06:00Z',
            sla_next_warn_at: null,
          },
          {
            id: 't-12',
            number: 106,
            subject: 'Webhook delay',
            sla_next_metric: 'resolution',
            sla_breached_at: null,
            sla_next_warn_at: '2026-11-16T18:01:00Z',
          },
        ];
      }
      if (sql.includes('FROM public.articles')) {
        return [
          {
            id: 'art-1',
            title: 'Configuring SSO with Okta',
            updated_at: '2026-11-16T17:55:00Z',
            created_at: '2026-11-16T17:50:00Z',
          },
        ];
      }
      if (sql.includes("csat_rating = 'bad'")) {
        return [
          {
            id: 't-13',
            number: 107,
            subject: 'Slow response',
            csat_comment: 'Waited too long',
            csat_rated_at: '2026-11-16T18:04:00Z',
          },
        ];
      }
      if (sql.includes('FROM public.survey_responses')) {
        return [
          // Duplicate ticket t-13 skipped cleanly
          {
            id: 'sr-dup',
            ticket_id: 't-13',
            conversation_id: null,
            score: 1,
            comment: 'Waited too long',
            customer_name: 'Bilal',
            created_at: '2026-11-16T18:04:00Z',
          },
        ];
      }
      if (sql.includes('FROM public.ai_verification_logs')) {
        return [
          {
            id: 'ver-1',
            agent_name: 'Nova Bot',
            topic: 'Pricing',
            customer_question: 'Do you offer annual discounts?',
            verdict: 'blocked_fixed',
            human_review: null,
            created_at: '2026-11-16T18:07:00Z',
          },
        ];
      }
      return [];
    });

    const items = await listRecentActivityAction('ws-alpha', 15);

    expect(mockGetWorkspaceAccess).toHaveBeenCalledWith('ws-alpha', 'view');
    for (const c of sqlCalls) {
      expect(c.sql).toContain('workspace_id = $1');
      expect(c.params[0]).toBe('ws-alpha');
    }

    // Verify descending timestamp sort and 7 unique events across all 6 sources
    expect(items).toHaveLength(7);
    expect(items[0]).toMatchObject({
      kind: 'ai_flagged',
      tone: 'bad',
      href: '/app/ai-quality',
    });
    expect(items[1]).toMatchObject({
      kind: 'sla',
      tone: 'bad',
      href: '/app/tickets?id=t-11',
    });
    expect(items[2]).toMatchObject({
      kind: 'handoff',
      tone: 'warn',
      href: '/app/inbox?c=conv-1',
    });
    expect(items.some((i) => i.kind === 'low_csat' && i.href === '/app/tickets?id=t-13')).toBe(true);
    expect(items.some((i) => i.kind === 'ticket_solved' && i.tone === 'ai')).toBe(true);
    expect(items.some((i) => i.kind === 'sla' && i.tone === 'warn' && i.href === '/app/tickets?id=t-12')).toBe(true);
    expect(items.some((i) => i.kind === 'kb_published' && i.href === '/app/knowledge')).toBe(true);
  });

  it('returns an empty list cleanly for an empty workspace', async () => {
    mockQueryRows.mockResolvedValue([]);
    const items = await listRecentActivityAction('ws-empty');
    expect(items).toEqual([]);
  });

  it('fails closed when workspace access is denied', async () => {
    mockGetWorkspaceAccess.mockRejectedValue(new Error('Forbidden'));
    await expect(listRecentActivityAction('ws-other')).rejects.toThrow('Forbidden');
    expect(mockQueryRows).not.toHaveBeenCalled();
  });
});
