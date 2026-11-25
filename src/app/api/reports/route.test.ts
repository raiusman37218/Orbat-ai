import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGuardWorkspace = vi.fn();

vi.mock('@/lib/team/route-guard', () => ({
  guardWorkspace: (...args: unknown[]) => mockGuardWorkspace(...args),
}));

import { GET } from './route';

interface TableMap {
  workspaces?: Array<Record<string, unknown>>;
  reporting_events?: Array<Record<string, unknown>>;
  sla_events?: Array<Record<string, unknown>>;
  agents?: Array<Record<string, unknown>>;
  ticket_groups?: Array<Record<string, unknown>>;
  conversation_events?: Array<Record<string, unknown>>;
  ai_agents?: Array<Record<string, unknown>>;
  ai_verification_logs?: Array<Record<string, unknown>>;
  tickets?: Array<Record<string, unknown>>;
  conversations?: Array<Record<string, unknown>>;
}

function createFakeSupabase(tables: TableMap, recordedWorkspaceFilters: string[]) {
  return {
    from: (table: keyof TableMap) => {
      let rows = [...(tables[table] ?? [])];
      const filters: Record<string, unknown> = {};
      let isHead = false;

      const chain = {
        select: (_cols?: string, opts?: { head?: boolean }) => {
          isHead = Boolean(opts?.head);
          return chain;
        },
        eq: (col: string, val: unknown) => {
          if (col === 'workspace_id' && typeof val === 'string') {
            recordedWorkspaceFilters.push(`${table}:${val}`);
          }
          filters[col] = val;
          return chain;
        },
        in: (col: string, vals: unknown[]) => {
          rows = rows.filter((r) => vals.includes(r[col]));
          return chain;
        },
        is: (col: string, val: unknown) => {
          rows = rows.filter((r) => (val === null ? r[col] == null : r[col] === val));
          return chain;
        },
        gte: (col: string, val: string) => {
          rows = rows.filter((r) => String(r[col] ?? '') >= val);
          return chain;
        },
        lte: (col: string, val: string) => {
          rows = rows.filter((r) => String(r[col] ?? '') <= val);
          return chain;
        },
        lt: (col: string, val: string) => {
          rows = rows.filter((r) => String(r[col] ?? '') < val);
          return chain;
        },
        order: () => chain,
        maybeSingle: async () => {
          const filtered = applyEq(rows, filters);
          return { data: filtered[0] ?? null, error: null };
        },
        then: (
          resolve: (v: { data: Array<Record<string, unknown>>; count?: number; error: null }) => unknown,
        ) => {
          const filtered = applyEq(rows, filters);
          return Promise.resolve({
            data: isHead ? [] : filtered,
            count: filtered.length,
            error: null,
          }).then(resolve);
        },
      };

      return chain;
    },
  };
}

function applyEq(rows: Array<Record<string, unknown>>, filters: Record<string, unknown>) {
  return rows.filter((row) =>
    Object.entries(filters).every(([k, v]) => row[k] === v),
  );
}

describe('GET /api/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests missing workspace_id', async () => {
    const req = new NextRequest('http://localhost/api/reports');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('supports range=today in workspace timezone with stacked split, channel AI rate, per-agent stats, ROI & action queue', async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const recordedWorkspaceFilters: string[] = [];

    const supabase = createFakeSupabase(
      {
        workspaces: [
          {
            id: 'ws-1',
            timezone: 'Asia/Karachi',
            ai_settings: { avg_handle_minutes: 12, agent_hourly_rate_usd: 30 },
            company_profile: {},
          },
        ],
        reporting_events: [
          {
            id: 1,
            workspace_id: 'ws-1',
            ticket_id: 't-1',
            event_type: 'ticket_created',
            occurred_at: twoHoursAgo,
            agent_id: null,
            group_id: null,
            channel: 'web',
            priority: 'normal',
            tags: ['pricing'],
            duration_seconds: null,
            csat_rating: null,
            csat_comment: null,
            metadata: {},
          },
          {
            id: 2,
            workspace_id: 'ws-1',
            ticket_id: 't-1',
            event_type: 'ticket_solved',
            occurred_at: oneHourAgo,
            agent_id: null,
            group_id: null,
            channel: 'web',
            priority: 'normal',
            tags: ['pricing'],
            duration_seconds: 420,
            csat_rating: null,
            csat_comment: null,
            metadata: {},
          },
          {
            id: 3,
            workspace_id: 'ws-1',
            ticket_id: 't-1',
            event_type: 'bot_resolved',
            occurred_at: oneHourAgo,
            agent_id: null,
            group_id: null,
            channel: 'web',
            priority: 'normal',
            tags: ['pricing'],
            duration_seconds: null,
            csat_rating: null,
            csat_comment: null,
            metadata: {},
          },
          {
            id: 4,
            workspace_id: 'ws-1',
            ticket_id: 't-2',
            event_type: 'ticket_created',
            occurred_at: oneHourAgo,
            agent_id: 'human-1',
            group_id: null,
            channel: 'whatsapp',
            priority: 'urgent',
            tags: [],
            duration_seconds: null,
            csat_rating: null,
            csat_comment: null,
            metadata: {},
          },
        ],
        sla_events: [],
        agents: [{ id: 'human-1', workspace_id: 'ws-1', name: 'Ali', email: 'ali@example.com', role: 'owner' }],
        ticket_groups: [],
        conversation_events: [],
        ai_agents: [
          {
            id: 'ai-primary',
            workspace_id: 'ws-1',
            name: 'Nova Frontline',
            role_title: 'Support Specialist',
            status: 'live',
            is_primary: true,
            channels: ['web', 'whatsapp'],
          },
          {
            id: 'ai-billing',
            workspace_id: 'ws-1',
            name: 'Atlas Billing',
            role_title: 'Refund & Billing Guard',
            status: 'draft',
            is_primary: false,
            channels: ['email'],
          },
        ],
        ai_verification_logs: [
          {
            id: 'v-1',
            workspace_id: 'ws-1',
            agent_id: null,
            verdict: 'supported',
            human_review: null,
            confidence: 0.94,
            created_at: oneHourAgo,
          },
          {
            id: 'v-2',
            workspace_id: 'ws-1',
            agent_id: 'ai-billing',
            verdict: 'needs_review',
            human_review: null,
            confidence: 0.62,
            created_at: oneHourAgo,
          },
        ],
        tickets: [
          {
            id: 't-2',
            workspace_id: 'ws-1',
            status: 'open',
            sla_breached_at: oneHourAgo,
            sla_state: 'running',
            sla_next_warn_at: null,
          },
        ],
        conversations: [
          {
            id: 'c-2',
            workspace_id: 'ws-1',
            status: 'open',
            handoff_status: 'waiting_for_agent',
          },
        ],
      },
      recordedWorkspaceFilters,
    );

    mockGuardWorkspace.mockResolvedValue({
      ok: true,
      access: { supabase },
    });

    const req = new NextRequest('http://localhost/api/reports?workspace_id=ws-1&range=today&include_previous=1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.granularity).toBe('hour');
    expect(body.timeZone).toBe('Asia/Karachi');
    expect(body.meta.timezone).toBe('Asia/Karachi');
    expect(body.createdVsSolved).toHaveLength(24);

    const totalAi = body.createdVsSolved.reduce((s: number, p: { aiResolved: number }) => s + p.aiResolved, 0);
    const totalOpen = body.createdVsSolved.reduce((s: number, p: { stillOpen: number }) => s + p.stillOpen, 0);
    expect(totalAi).toBe(1);
    expect(totalOpen).toBe(1);

    const webChannel = body.channelBreakdown.find((c: { key: string }) => c.key === 'web');
    const waChannel = body.channelBreakdown.find((c: { key: string }) => c.key === 'whatsapp');
    expect(webChannel.aiResolutionPct).toBe(100);
    expect(waChannel.aiResolutionPct).toBe(0);

    expect(body.aiAgents).toHaveLength(2);
    expect(body.aiAgents[0]).toMatchObject({
      id: 'ai-primary',
      name: 'Nova Frontline',
      totalReplies: 1,
      supportedCount: 1,
      groundingPct: 100,
    });
    expect(body.aiAgents[1]).toMatchObject({
      id: 'ai-billing',
      totalReplies: 1,
      flaggedCount: 1,
      groundingPct: 0,
    });

    expect(body.roi).toEqual({
      aiResolvedCount: 1,
      avgHandleMinutes: 12,
      hourlyRateUsd: 30,
      hoursSaved: 0.2,
      costSavedUsd: 6,
    });

    expect(body.actionQueue).toEqual({
      urgentSlaCount: 1,
      breachedCount: 1,
      breachingSoonCount: 0,
      aiQualityFlagsCount: 1,
      waitingHandoffsCount: 1,
    });

    // Strict workspace isolation: every query scoped to ws-1
    expect(recordedWorkspaceFilters.some((f) => f === 'reporting_events:ws-1')).toBe(true);
    expect(recordedWorkspaceFilters.some((f) => f === 'ai_agents:ws-1')).toBe(true);
    expect(recordedWorkspaceFilters.some((f) => f === 'ai_verification_logs:ws-1')).toBe(true);
  });

  it('handles empty workspaces cleanly without errors', async () => {
    const supabase = createFakeSupabase({}, []);
    mockGuardWorkspace.mockResolvedValue({ ok: true, access: { supabase } });

    const req = new NextRequest('http://localhost/api/reports?workspace_id=ws-empty&range=today');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.summary.totalCreated).toBe(0);
    expect(body.createdVsSolved).toHaveLength(24);
    expect(body.channelBreakdown).toEqual([]);
    expect(body.aiAgents).toEqual([]);
    expect(body.roi.hoursSaved).toBe(0);
    expect(body.roi.costSavedUsd).toBe(0);
    expect(body.actionQueue).toEqual({
      urgentSlaCount: 0,
      breachedCount: 0,
      breachingSoonCount: 0,
      aiQualityFlagsCount: 0,
      waitingHandoffsCount: 0,
    });
  });
});
