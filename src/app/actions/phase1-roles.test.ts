/**
 * Role and workspace isolation verification for Phase 1 actions
 * (Tickets deletion/counts, Customers CRM, and Voice/Calls).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ME = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OWNER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TARGET = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

type Query = { table: string; ops: [string, ...unknown[]][] };
const fake = vi.hoisted(() => ({
  me: { role: 'agent', workspace_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', is_active: true, is_super_admin: false },
  isOwner: false,
  sqlCalls: [] as string[],
}));

vi.mock('@/lib/db', () => ({
  queryRows: async (sql: string) => {
    fake.sqlCalls.push(sql);
    return [];
  },
}));

const has = (q: Query, ...op: unknown[]) => q.ops.some((o) => JSON.stringify(o) === JSON.stringify(op));

vi.mock('@/lib/pg/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: ME } } }) },
    from: (table: string) => {
      const q: Query = { table, ops: [] };
      const proxy: unknown = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === 'then') {
              if (q.table === 'agents' && has(q, 'eq', 'id', ME)) {
                return (r: (v: unknown) => void) => r({ data: { id: ME, name: 'Me', ...fake.me }, error: null });
              }
              if (q.table === 'workspaces') {
                const id = q.ops.find((o) => o[0] === 'eq' && o[1] === 'id')?.[2];
                return (r: (v: unknown) => void) =>
                  r({ data: { id, owner_id: fake.isOwner && id === WS ? ME : OWNER }, error: null });
              }
              return (r: (v: unknown) => void) => r({ data: [], error: null, count: 0 });
            }
            return (...args: unknown[]) => {
              q.ops.push([prop, ...args]);
              return proxy;
            };
          },
        },
      );
      return proxy;
    },
    rpc: async () => ({ data: 0, error: null }),
  }),
}));

vi.mock('@/lib/pg/service', () => ({
  hasServiceRole: () => true,
  serviceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => ({ data: [], error: null }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          in: async () => ({ error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/session-user', () => ({
  sessionUser: async () => ({ id: ME }),
}));
vi.mock('@/lib/email/smtp', () => ({ isValidEmail: () => true, sendSmtpEmail: vi.fn() }));
vi.mock('next/server', () => ({ after: vi.fn(), NextResponse: { json: vi.fn() } }));

import * as tickets from '@/app/actions/tickets';
import * as customers from '@/app/actions/customers';
import * as voice from '@/app/actions/voice';
import type { Role } from '@/lib/team/permissions';

type Who = Role | 'deactivated' | 'outsider';
const ALL: Who[] = ['owner', 'admin', 'agent', 'light_agent'];
const WORKERS: Who[] = ['owner', 'admin', 'agent'];
const ADMINS: Who[] = ['owner', 'admin'];
const WHO: Who[] = ['owner', 'admin', 'agent', 'light_agent', 'deactivated', 'outsider'];

function become(who: Who) {
  fake.isOwner = who === 'owner';
  fake.me = {
    role: who === 'owner' ? 'owner' : who === 'deactivated' || who === 'outsider' ? 'agent' : who,
    workspace_id: who === 'outsider' ? OTHER_WS : WS,
    is_active: who !== 'deactivated',
    is_super_admin: false,
  };
}

async function check(call: () => Promise<unknown>, allowed: Who[]) {
  for (const who of WHO) {
    become(who);
    fake.sqlCalls = [];
    const res = await call().then(
      () => 'ok',
      (e: Error) => e.message,
    );
    if (allowed.includes(who)) {
      expect(res, `${who} should pass guard`).not.toMatch(/Forbidden|Unauthorized/);
    } else {
      expect(res, `${who} should be rejected`).toMatch(/Forbidden/);
      expect(fake.sqlCalls, `${who} executed domain SQL after refusal`).toEqual([]);
    }
  }
}

beforeEach(() => {
  fake.sqlCalls = [];
  become('agent');
});

describe('Phase 1 actions role matrix & isolation', () => {
  it('enforces deleteTicketsAction & counts', async () => {
    await check(() => tickets.getTicketTabCountsAction(WS), ALL);
    await check(() => tickets.listTicketRequestersAction(WS), ALL);
    await check(() => tickets.deleteTicketsAction(WS, [TARGET]), WORKERS);
  });

  it('enforces Customers CRM role permissions', async () => {
    await check(() => customers.getCustomersBootstrapAction(WS), ALL);
    await check(() => customers.listCustomersAction(WS, {}), ALL);
    await check(() => customers.addCustomerNoteAction(WS, TARGET, 'Hello note'), ALL);
    await check(() => customers.createCustomerAction(WS, { name: 'Jane', email: 'jane@example.com' }), WORKERS);
    await check(() => customers.updateCustomerAction(WS, TARGET, { segment: 'vip' }), WORKERS);
    await check(() => customers.addCustomerOrderAction(WS, TARGET, { orderNumber: '#100', totalCents: 2500 }), WORKERS);
    await check(() => customers.createCustomerSegmentAction(WS, { name: 'VIPs', filters: { segmentKey: 'vip' } }), WORKERS);
  });

  it('enforces Voice / Calls role permissions', async () => {
    await check(() => voice.getVoiceBootstrapAction(WS), ALL);
    await check(() => voice.takeOverVoiceCallAction(WS, TARGET), WORKERS);
    await check(() => voice.createVoiceCampaignAction(WS, { name: 'Callbacks', totalContacts: 10 }), WORKERS);
    await check(() => voice.updateVoiceSettingsAction(WS, { piiRedaction: true }), ADMINS);
    await check(() => voice.rotateVoiceWebhookSecretAction(WS), ADMINS);
  });
});
