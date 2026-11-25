import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  rpcImpl: vi.fn<(fn: string, args?: unknown) => Promise<{ data: number; error: null }>>(
    async () => ({ data: 0, error: null }),
  ),
  processOutbox: vi.fn<(opts?: unknown) => Promise<{ sent: number; failed: number }>>(
    async () => ({ sent: 2, failed: 0 }),
  ),
}));

function buildFakeClient() {
  return {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let op: 'select' | 'insert' = 'select';
      let insertPayload: Row | null = null;
      let orderSpec: { col: string; ascending: boolean } | null = null;
      let limitNum: number | null = null;

      const exec = () => {
        const rows = (mocks.tables[table] ||= []);
        if (op === 'insert' && insertPayload) {
          const stored: Row = {
            id: crypto.randomUUID(),
            read_at: null,
            created_at: new Date().toISOString(),
            ...insertPayload,
          };
          rows.push(stored);
          return { data: [stored], error: null };
        }
        let res = rows.filter((r) => filters.every((f) => f(r)));
        if (orderSpec) {
          const { col, ascending } = orderSpec;
          res = [...res].sort((a, b) => {
            const av = Number(a[col] ?? 0);
            const bv = Number(b[col] ?? 0);
            if (!Number.isNaN(av) && !Number.isNaN(bv)) {
              return ascending ? av - bv : bv - av;
            }
            return ascending
              ? String(a[col] ?? '').localeCompare(String(b[col] ?? ''))
              : String(b[col] ?? '').localeCompare(String(a[col] ?? ''));
          });
        }
        if (limitNum != null) {
          res = res.slice(0, limitNum);
        }
        return { data: res, error: null };
      };

      const builder: Record<string, unknown> = {
        select: () => builder,
        insert: (row: Row) => {
          op = 'insert';
          insertPayload = row;
          return builder;
        },
        eq: (col: string, val: unknown) => {
          filters.push((r) => r[col] === val);
          return builder;
        },
        gt: (col: string, val: number) => {
          filters.push((r) => Number(r[col] ?? 0) > val);
          return builder;
        },
        in: (col: string, vals: unknown[]) => {
          filters.push((r) => vals.includes(r[col]));
          return builder;
        },
        is: (col: string, val: unknown) => {
          filters.push((r) => (r[col] ?? null) === val);
          return builder;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          orderSpec = { col, ascending: opts?.ascending !== false };
          return builder;
        },
        limit: (n: number) => {
          limitNum = n;
          return builder;
        },
        maybeSingle: async () => {
          const { data, error } = exec();
          return { data: data[0] ?? null, error };
        },
        then: (
          resolve: (v: { data: Row[]; error: null }) => unknown,
          reject?: (e: unknown) => unknown,
        ) => Promise.resolve(exec()).then(resolve, reject),
      };
      return builder;
    },
    rpc: (fn: string, args?: unknown) => mocks.rpcImpl(fn, args),
  };
}

const fakeClient = buildFakeClient();

vi.mock('@/lib/pg/service', () => ({
  hasServiceRole: () => true,
  serviceClient: () => fakeClient,
}));

vi.mock('@/lib/automation/outbox', () => ({
  processAutomationOutbox: (...args: unknown[]) => mocks.processOutbox(...args),
}));

import {
  createWorkspaceNotification,
  getLatestSlaEventId,
  notifyInternalNoteMentions,
  sanitizeNotificationHref,
  syncSlaEventNotifications,
} from './workspace-notifications';
import { GET as slaCronGet } from '@/app/api/cron/sla/route';

const WS_ID = '11111111-1111-4111-8111-111111111111';
const AGENT_AUTHOR = '22222222-2222-4222-8222-222222222222';
const AGENT_SARA = '33333333-3333-4333-8333-333333333333';
const AGENT_ALI = '44444444-4444-4444-8444-444444444444';
const AGENT_INACTIVE = '55555555-5555-4555-8555-555555555555';
const TICKET_1 = '66666666-6666-4666-8666-666666666666';
const TICKET_2 = '77777777-7777-4777-8777-777777777777';

describe('workspace-notifications helper & cron SLA integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tables = {
      workspace_notifications: [],
      agents: [
        { id: AGENT_AUTHOR, workspace_id: WS_ID, name: 'Mina', is_active: true },
        { id: AGENT_SARA, workspace_id: WS_ID, name: 'Sara', is_active: true },
        { id: AGENT_ALI, workspace_id: WS_ID, name: 'Ali Khan', is_active: true },
        { id: AGENT_INACTIVE, workspace_id: WS_ID, name: 'Inactive Bob', is_active: false },
      ],
      sla_events: [],
      tickets: [],
    };
  });

  it('sanitizes notification hrefs against open redirects', () => {
    expect(sanitizeNotificationHref('/app/inbox?c=123')).toBe('/app/inbox?c=123');
    expect(sanitizeNotificationHref('https://evil.example/phish')).toBe('/app');
    expect(sanitizeNotificationHref('//evil.example')).toBe('/app');
    expect(sanitizeNotificationHref('javascript:alert(1)')).toBe('/app');
    expect(sanitizeNotificationHref('')).toBe('/app');
  });

  it('creates workspace notifications with trimmed fields and null recipient for workspace-wide alerts', async () => {
    const created = await createWorkspaceNotification({
      workspaceId: WS_ID,
      recipientAgentId: null,
      kind: 'handoff',
      title: '  New handoff waiting  ',
      body: 'Visitor asked for billing help.',
      href: '/app/inbox?c=abc',
    });

    expect(created).toMatchObject({
      workspaceId: WS_ID,
      recipientAgentId: null,
      kind: 'handoff',
      title: 'New handoff waiting',
      body: 'Visitor asked for billing help.',
      href: '/app/inbox?c=abc',
      unread: true,
      readAt: null,
    });
    expect(mocks.tables.workspace_notifications).toHaveLength(1);
  });

  it('notifies mentioned active teammates in internal notes while skipping author and inactive users', async () => {
    const created = await notifyInternalNoteMentions({
      workspaceId: WS_ID,
      authorId: AGENT_AUTHOR,
      authorName: 'Mina',
      content: 'Hey @Ali Khan and @Sara and @Mina and @Inactive Bob, please review this.',
      href: '/app/inbox?c=conv-9',
      contextLabel: 'in an Inbox note',
    });

    expect(created).toHaveLength(2);
    expect(created.map((n) => n.recipientAgentId).sort()).toEqual([AGENT_SARA, AGENT_ALI].sort());
    expect(created.every((n) => n.kind === 'mention')).toBe(true);
    expect(created[0]?.title).toBe('Mina mentioned you in an Inbox note');
    expect(created[0]?.href).toBe('/app/inbox?c=conv-9');
  });

  it('skips agent queries when internal note contains no @mention and no explicit mention ids', async () => {
    const created = await notifyInternalNoteMentions({
      workspaceId: WS_ID,
      authorId: AGENT_AUTHOR,
      authorName: 'Mina',
      content: 'Plain internal note with email support@example.com? Wait—no space before @',
      href: '/app/tickets?id=t1',
    });
    expect(created).toEqual([]);
  });

  it('creates sla_warning and sla_breach notifications in /api/cron/sla without duplicating prior events', async () => {
    mocks.tables.sla_events = [
      {
        id: 10,
        workspace_id: WS_ID,
        ticket_id: TICKET_1,
        metric: 'first_reply',
        event: 'warning',
        policy_name: 'Old Policy',
        assignee_id: AGENT_SARA,
        superseded_at: null,
      },
    ];
    mocks.tables.tickets = [
      { id: TICKET_1, number: 401, subject: 'Refund inquiry' },
      { id: TICKET_2, number: 402, subject: 'Account locked' },
    ];

    mocks.rpcImpl.mockImplementationOnce(async () => {
      mocks.tables.sla_events.push(
        {
          id: 11,
          workspace_id: WS_ID,
          ticket_id: TICKET_1,
          metric: 'first_reply',
          event: 'warning',
          policy_name: 'VIP SLA',
          assignee_id: AGENT_SARA,
          superseded_at: null,
        },
        {
          id: 12,
          workspace_id: WS_ID,
          ticket_id: TICKET_2,
          metric: 'resolution',
          event: 'breached',
          policy_name: 'VIP SLA',
          assignee_id: null,
          superseded_at: null,
        },
        {
          id: 13,
          workspace_id: WS_ID,
          ticket_id: TICKET_2,
          metric: 'first_reply',
          event: 'met',
          policy_name: 'VIP SLA',
          assignee_id: null,
          superseded_at: null,
        },
      );
      return { data: 2, error: null };
    });

    process.env.CRON_SECRET = 'cron-secret-test';
    const unauth = await slaCronGet(new Request('http://localhost/api/cron/sla'));
    expect(unauth.status).toBe(401);

    const okRes = await slaCronGet(
      new Request('http://localhost/api/cron/sla', {
        headers: { authorization: 'Bearer cron-secret-test' },
      }),
    );
    expect(okRes.status).toBe(200);
    const body = (await okRes.json()) as { events: number; notificationsCreated: number };
    expect(body.events).toBe(2);
    expect(body.notificationsCreated).toBe(2);

    const notifs = mocks.tables.workspace_notifications;
    expect(notifs).toHaveLength(2);
    expect(notifs[0]).toMatchObject({
      workspace_id: WS_ID,
      recipient_agent_id: AGENT_SARA,
      kind: 'sla_warning',
      title: 'SLA warning on Ticket #401',
      href: `/app/tickets?id=${TICKET_1}`,
    });
    expect(notifs[1]).toMatchObject({
      workspace_id: WS_ID,
      recipient_agent_id: null,
      kind: 'sla_breach',
      title: 'SLA breached on Ticket #402',
      href: `/app/tickets?id=${TICKET_2}`,
    });

    // Re-running sync with latest id produces 0 duplicate notifications
    const latest = await getLatestSlaEventId();
    expect(latest).toBe(13);
    const rerun = await syncSlaEventNotifications({ lastEventId: latest });
    expect(rerun.created).toBe(0);
  });
});
