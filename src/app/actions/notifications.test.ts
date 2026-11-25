import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  workspaceAccess: vi.fn(),
  query: vi.fn(),
  queryRows: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/team/access', () => ({
  AccessError: class AccessError extends Error {
    status: number;
    constructor(message: string, status = 403) {
      super(message);
      this.status = status;
    }
  },
  getWorkspaceAccess: (...args: unknown[]) => mocks.workspaceAccess(...args),
}));

vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => mocks.query(...args),
  queryRows: (...args: unknown[]) => mocks.queryRows(...args),
}));

vi.mock('@/lib/pg/service', () => ({
  hasServiceRole: () => false,
  serviceClient: () => ({}),
}));

vi.mock('@/lib/channels/dispatcher', () => ({
  dispatchOutboundMessage: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/lib/agent/engines/langgraph-engine', () => ({
  resumeLangGraphAgentRun: vi.fn(),
}));

vi.mock('@/lib/agent/engines/adk-engine', () => ({
  resumeAdkAgentRun: vi.fn(),
}));

vi.mock('@/lib/email/smtp', () => ({
  isValidEmail: () => true,
  sendSmtpEmail: vi.fn(),
  teamMessageEmail: vi.fn(),
}));

vi.mock('@/lib/email/workspace-smtp', () => ({
  loadWorkspaceSmtp: vi.fn(async () => null),
}));

vi.mock('next/server', () => ({
  after: vi.fn(),
  NextResponse: { json: vi.fn() },
}));

import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  sendTestNotificationAction,
} from '@/app/actions/notifications';
import { sendDashboardMessageAction } from '@/app/actions/inbox';
import { replyToTicketAction } from '@/app/actions/tickets';
import * as dataNotifications from '@/lib/data/notifications';

const WS_A = '11111111-1111-4111-8111-111111111111';
const AGENT_ME = '22222222-2222-4222-8222-222222222222';
const AGENT_SARA = '33333333-3333-4333-8333-333333333333';
const NOTIF_1 = '44444444-4444-4444-8444-444444444444';
const CONV_1 = '55555555-5555-4555-8555-555555555555';
const TICKET_1 = '66666666-6666-4666-8666-666666666666';

describe('notifications server actions & mention wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceAccess.mockResolvedValue({
      supabase: {},
      user: { id: AGENT_ME },
      agent: { id: AGENT_ME, name: 'Mina', role: 'admin', workspace_id: WS_A },
      role: 'admin',
    });
    mocks.query.mockResolvedValue({ rowCount: 1 });
  });

  it('re-exports the server actions from src/lib/data/notifications.ts', () => {
    expect(dataNotifications.listNotificationsAction).toBe(listNotificationsAction);
    expect(dataNotifications.markNotificationReadAction).toBe(markNotificationReadAction);
    expect(dataNotifications.markAllNotificationsReadAction).toBe(markAllNotificationsReadAction);
    expect(dataNotifications.sendTestNotificationAction).toBe(sendTestNotificationAction);
  });

  it('listNotificationsAction returns unreadCount + recent items scoped to workspace and recipient', async () => {
    mocks.queryRows
      .mockResolvedValueOnce([{ unread_count: 3 }])
      .mockResolvedValueOnce([
        {
          id: NOTIF_1,
          workspace_id: WS_A,
          recipient_agent_id: null,
          kind: 'handoff',
          title: 'AI handoff requested',
          body: 'Customer asked for billing support',
          href: `/app/inbox?c=${CONV_1}`,
          read_at: null,
          created_at: '2026-11-17T04:00:00.000Z',
        },
        {
          id: '77777777-7777-4777-8777-777777777777',
          workspace_id: WS_A,
          recipient_agent_id: AGENT_ME,
          kind: 'mention',
          title: 'Sara mentioned you',
          body: '@Mina take a look',
          href: `/app/tickets?id=${TICKET_1}`,
          read_at: '2026-11-17T04:10:00.000Z',
          created_at: '2026-11-17T03:50:00.000Z',
        },
      ]);

    const res = await listNotificationsAction(WS_A, 25);

    expect(mocks.workspaceAccess).toHaveBeenCalledWith(WS_A, 'view');
    expect(res.unreadCount).toBe(3);
    expect(res.items).toHaveLength(2);
    expect(res.items[0]).toMatchObject({
      id: NOTIF_1,
      kind: 'handoff',
      unread: true,
      readAt: null,
      href: `/app/inbox?c=${CONV_1}`,
    });
    expect(res.items[1]).toMatchObject({
      kind: 'mention',
      unread: false,
      recipientAgentId: AGENT_ME,
    });
    expect(mocks.queryRows).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('recipient_agent_id IS NULL OR recipient_agent_id = $2'),
      [WS_A, AGENT_ME, 25],
    );
  });

  it('markNotificationReadAction validates id and updates read_at scoped to workspace and recipient', async () => {
    await expect(markNotificationReadAction(WS_A, 'bad-id')).rejects.toThrow('Invalid notification id.');

    const res = await markNotificationReadAction(WS_A, NOTIF_1);
    expect(res).toEqual({ success: true });
    expect(mocks.workspaceAccess).toHaveBeenCalledWith(WS_A, 'view');
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE public.workspace_notifications'),
      [NOTIF_1, WS_A, AGENT_ME],
    );
  });

  it('markAllNotificationsReadAction marks all caller-visible unread rows in workspace read', async () => {
    const res = await markAllNotificationsReadAction(WS_A);
    expect(res).toEqual({ success: true });
    expect(mocks.workspaceAccess).toHaveBeenCalledWith(WS_A, 'view');
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('AND read_at IS NULL'),
      [WS_A, AGENT_ME],
    );
  });

  it('sendTestNotificationAction enforces manage_settings capability and inserts a system alert', async () => {
    mocks.workspaceAccess.mockRejectedValueOnce(new Error('Forbidden: as an agent you cannot change workspace settings.'));
    await expect(sendTestNotificationAction(WS_A)).rejects.toThrow(/Forbidden/);
    expect(mocks.workspaceAccess).toHaveBeenCalledWith(WS_A, 'manage_settings');

    mocks.queryRows.mockResolvedValueOnce([
      {
        id: NOTIF_1,
        workspace_id: WS_A,
        recipient_agent_id: AGENT_ME,
        kind: 'system',
        title: 'Diagnostic test alert',
        body: 'Triggered by Mina from System states to verify persistent notifications.',
        href: '/app/states',
        read_at: null,
        created_at: '2026-11-17T04:15:00.000Z',
      },
    ]);

    const res = await sendTestNotificationAction(WS_A);
    expect(res.success).toBe(true);
    expect(res.notification).toMatchObject({
      kind: 'system',
      title: 'Diagnostic test alert',
      href: '/app/states',
      unread: true,
    });
  });

  it('sendDashboardMessageAction notifies @mentioned agents on internal Inbox notes', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: CONV_1, status: 'open', channel_metadata: {} },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }
        if (table === 'messages') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'msg-1', conversation_id: CONV_1, content: 'Hi @Sara', is_internal: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    mocks.workspaceAccess.mockResolvedValueOnce({
      supabase: supabaseMock,
      user: { id: AGENT_ME },
      agent: { id: AGENT_ME, name: 'Mina', role: 'agent', workspace_id: WS_A },
      role: 'agent',
    });

    mocks.queryRows
      .mockResolvedValueOnce([
        { id: AGENT_ME, name: 'Mina' },
        { id: AGENT_SARA, name: 'Sara' },
      ])
      .mockResolvedValueOnce([
        {
          id: NOTIF_1,
          workspace_id: WS_A,
          recipient_agent_id: AGENT_SARA,
          kind: 'mention',
          title: 'Mina mentioned you in an Inbox note',
          body: 'Hi @Sara please check',
          href: `/app/inbox?c=${CONV_1}`,
          read_at: null,
          created_at: '2026-11-17T04:20:00.000Z',
        },
      ]);

    await sendDashboardMessageAction(WS_A, {
      conversationId: CONV_1,
      content: 'Hi @Sara please check',
      isInternal: true,
    });

    expect(mocks.queryRows).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO public.workspace_notifications'),
      [
        WS_A,
        AGENT_SARA,
        'mention',
        'Mina mentioned you in an Inbox note',
        'Hi @Sara please check',
        `/app/inbox?c=${CONV_1}`,
      ],
    );
  });

  it('replyToTicketAction notifies @mentioned agents on internal Ticket notes', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'tickets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: TICKET_1,
                      number: 1042,
                      subject: 'Refund failure',
                      status: 'open',
                      conversation_id: CONV_1,
                      channel: 'chat',
                      requester_id: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'msg-2' }, error: null }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    mocks.workspaceAccess.mockResolvedValueOnce({
      supabase: supabaseMock,
      user: { id: AGENT_ME },
      agent: { id: AGENT_ME, name: 'Mina', role: 'light_agent', workspace_id: WS_A },
      role: 'light_agent',
    });

    mocks.queryRows
      .mockResolvedValueOnce([
        { id: AGENT_ME, name: 'Mina' },
        { id: AGENT_SARA, name: 'Sara' },
      ])
      .mockResolvedValueOnce([
        {
          id: NOTIF_1,
          workspace_id: WS_A,
          recipient_agent_id: AGENT_SARA,
          kind: 'mention',
          title: 'Mina mentioned you on Ticket #1042',
          body: '@Sara check invoice',
          href: `/app/tickets?id=${TICKET_1}`,
          read_at: null,
          created_at: '2026-11-17T04:25:00.000Z',
        },
      ]);

    await replyToTicketAction(WS_A, TICKET_1, {
      body: '@Sara check invoice',
      internal: true,
    });

    expect(mocks.queryRows).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO public.workspace_notifications'),
      [
        WS_A,
        AGENT_SARA,
        'mention',
        'Mina mentioned you on Ticket #1042',
        '@Sara check invoice',
        `/app/tickets?id=${TICKET_1}`,
      ],
    );
  });
});
