/**
 * Role matrix, workspace isolation, and validation tests for CRM Deals,
 * Sales Follow-up Tasks, and Companies server actions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ME = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OWNER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TARGET_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

type Query = { table: string; ops: [string, ...unknown[]][] };
const fake = vi.hoisted(() => ({
  me: { role: 'agent', workspace_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', is_active: true, is_super_admin: false },
  isOwner: false,
  sqlCalls: [] as Array<{ sql: string; params: unknown[] | undefined }>,
  respondSql: null as null | ((sql: string, params?: unknown[]) => unknown[]),
}));

vi.mock('@/lib/db', () => ({
  queryRows: async (sql: string, params?: unknown[]) => {
    fake.sqlCalls.push({ sql, params });
    if (fake.respondSql) return fake.respondSql(sql, params);
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

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/session-user', () => ({
  sessionUser: async () => ({ id: ME }),
}));
vi.mock('@/lib/email/smtp', () => ({ isValidEmail: () => true, sendSmtpEmail: vi.fn() }));

import * as customers from '@/app/actions/customers';
import type { Role } from '@/lib/team/permissions';

type Who = Role | 'deactivated' | 'outsider';
const ALL: Who[] = ['owner', 'admin', 'agent', 'light_agent'];
const WORKERS: Who[] = ['owner', 'admin', 'agent'];
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

async function checkRoleMatrix(call: () => Promise<unknown>, allowed: Who[]) {
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
  fake.respondSql = null;
  become('agent');
});

describe('CRM Sales extensions: role permissions & workspace isolation', () => {
  it('enforces view, edit_content, and add_note permissions for deals, tasks, and companies', async () => {
    await checkRoleMatrix(() => customers.getCrmPickerOptionsAction(WS), ALL);
    await checkRoleMatrix(() => customers.listCrmDealsAction(WS, {}), ALL);
    await checkRoleMatrix(() => customers.listCrmTasksAction(WS, {}), ALL);
    await checkRoleMatrix(() => customers.listCrmCompaniesAction(WS, {}), ALL);

    // Light agents may create/update tasks (add_note)
    await checkRoleMatrix(() => customers.createCrmTaskAction(WS, { title: 'Call lead' }), ALL);
    await checkRoleMatrix(() => customers.updateCrmTaskAction(WS, TARGET_ID, { status: 'completed' }), ALL);

    // Deals, companies, and deletions require edit_content (owner/admin/agent)
    await checkRoleMatrix(() => customers.createCrmDealAction(WS, { title: 'Enterprise License' }), WORKERS);
    await checkRoleMatrix(() => customers.updateCrmDealAction(WS, TARGET_ID, { stage: 'won' }), WORKERS);
    await checkRoleMatrix(() => customers.deleteCrmDealAction(WS, TARGET_ID), WORKERS);
    await checkRoleMatrix(() => customers.deleteCrmTaskAction(WS, TARGET_ID), WORKERS);
    await checkRoleMatrix(() => customers.createCrmCompanyAction(WS, { name: 'Acme Corp' }), WORKERS);
    await checkRoleMatrix(() => customers.updateCrmCompanyAction(WS, TARGET_ID, { name: 'Acme Updated' }), WORKERS);
    await checkRoleMatrix(() => customers.deleteCrmCompanyAction(WS, TARGET_ID), WORKERS);
  });
});

describe('CRM Sales validation and calculations', () => {
  it('validates deal inputs and computes pipeline win rate summary', async () => {
    await expect(customers.createCrmDealAction(WS, { title: '   ' })).rejects.toThrow('Give the deal a title.');
    await expect(customers.deleteCrmDealAction(WS, 'not-a-uuid')).rejects.toThrow('Invalid deal.');

    fake.respondSql = (sql) => {
      if (sql.includes('COUNT(*)::int AS total_deals')) {
        return [
          {
            total_deals: 5,
            open_deals: 2,
            won_deals: 2,
            lost_deals: 1,
            pipeline_value_cents: 500000,
            weighted_value_cents: 300000,
            won_value_cents: 400000,
            lost_value_cents: 100000,
          },
        ];
      }
      if (sql.includes('FROM public.crm_deals d')) {
        return [
          {
            id: TARGET_ID,
            workspace_id: WS,
            visitor_id: null,
            company_id: null,
            title: 'Annual Deal',
            stage: 'proposal',
            value_cents: 250000,
            currency: 'USD',
            probability: 80,
            expected_close_date: '2026-12-31',
            owner_id: ME,
            notes: null,
            closed_at: null,
            created_at: '2026-11-15T00:00:00Z',
            updated_at: '2026-11-15T00:00:00Z',
            visitor_name: null,
            visitor_email: null,
            company_name: 'Acme',
            owner_name: 'Me',
          },
        ];
      }
      return [];
    };

    const res = await customers.listCrmDealsAction(WS);
    expect(res.deals).toHaveLength(1);
    expect(res.deals[0].stage).toBe('proposal');
    expect(res.summary.winRatePercent).toBe(67);
    expect(res.summary.weightedValueCents).toBe(300000);
  });

  it('automatically updates deal probability and closed_at when moving to won', async () => {
    fake.respondSql = (sql) => {
      if (sql.startsWith('UPDATE public.crm_deals')) {
        return [{ id: TARGET_ID }];
      }
      if (sql.includes('FROM public.crm_deals d')) {
        return [
          {
            id: TARGET_ID,
            workspace_id: WS,
            visitor_id: null,
            company_id: null,
            title: 'Closed Deal',
            stage: 'won',
            value_cents: 150000,
            currency: 'USD',
            probability: 100,
            expected_close_date: null,
            owner_id: ME,
            notes: null,
            closed_at: '2026-11-15T12:00:00Z',
            created_at: '2026-11-01T00:00:00Z',
            updated_at: '2026-11-15T12:00:00Z',
            visitor_name: null,
            visitor_email: null,
            company_name: null,
            owner_name: 'Me',
          },
        ];
      }
      return [];
    };

    const updated = await customers.updateCrmDealAction(WS, TARGET_ID, { stage: 'won' });
    expect(updated.stage).toBe('won');
    expect(updated.probability).toBe(100);
    const updateCall = fake.sqlCalls.find((c) => c.sql.startsWith('UPDATE public.crm_deals'));
    expect(updateCall?.sql).toContain('closed_at');
    expect(updateCall?.sql).toContain('probability');
    expect(updateCall?.params).toContain(100);
  });

  it('validates task & company inputs', async () => {
    await expect(customers.createCrmTaskAction(WS, { title: '' })).rejects.toThrow('Give the task a title.');
    await expect(customers.createCrmTaskAction(WS, { title: 'Call', dueAt: 'not-a-date' })).rejects.toThrow(
      'Enter a valid due date.',
    );
    await expect(customers.createCrmCompanyAction(WS, { name: '  ' })).rejects.toThrow('Enter a company name.');
  });
});
