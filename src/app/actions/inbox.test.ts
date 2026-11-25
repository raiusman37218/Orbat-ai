import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignConversationGroupAction,
  deleteConversationViewAction,
  getConversationAiSummaryAction,
  getVisitorLifetimeStatsAction,
  resumeAgentApprovalAction,
  saveConversationViewAction,
  searchAndFilterConversationsAction,
  updateVisitorNotesAction,
} from './inbox';

vi.mock('server-only', () => ({}));

const mocks = {
  workspaceAccess: vi.fn(),
  query: vi.fn(),
  queryRows: vi.fn(),
  createClient: vi.fn(),
  resumeLangGraphAgentRun: vi.fn(),
  resumeAdkAgentRun: vi.fn(),
  dispatchOutboundMessage: vi.fn(),
};

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

vi.mock('@/lib/pg/server', () => ({
  createClient: (...args: unknown[]) => mocks.createClient(...args),
}));

vi.mock('@/lib/agent/engines/langgraph-engine', () => ({
  resumeLangGraphAgentRun: (...args: unknown[]) => mocks.resumeLangGraphAgentRun(...args),
}));

vi.mock('@/lib/agent/engines/adk-engine', () => ({
  resumeAdkAgentRun: (...args: unknown[]) => mocks.resumeAdkAgentRun(...args),
}));

vi.mock('@/lib/channels/dispatcher', () => ({
  dispatchOutboundMessage: (...args: unknown[]) => mocks.dispatchOutboundMessage(...args),
}));

const WS_A = '11111111-1111-4111-8111-111111111111';
const AGENT_ID = '22222222-2222-4222-8222-222222222222';
const GROUP_BILLING = '33333333-3333-4333-8333-333333333333';
const CONV_1 = '44444444-4444-4444-8444-444444444444';
const CONV_2 = '55555555-5555-4555-8555-555555555555';
const VISITOR_1 = '66666666-6666-4666-8666-666666666666';
const VIEW_1 = '77777777-7777-4777-8777-777777777777';

interface SqlCall {
  sql: string;
  params: unknown[];
}

describe('inbox scale, team inboxes, saved views & approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceAccess.mockResolvedValue({
      supabase: {},
      user: { id: AGENT_ID },
      role: 'admin',
    });
    mocks.query.mockResolvedValue({ rowCount: 1 });
    mocks.dispatchOutboundMessage.mockResolvedValue({ ok: true });
    mocks.resumeLangGraphAgentRun.mockResolvedValue({
      replyText: 'Approved refund of $49.00.',
      executedTools: [{ toolName: 'issue_refund', ok: true, summary: 'Refund issued' }],
    });
    mocks.resumeAdkAgentRun.mockResolvedValue({
      replyText: 'ADK approved reply.',
      executedTools: [],
    });
  });

  describe('searchAndFilterConversationsAction', () => {
    it('enforces workspace isolation, full-text message search, group_id filter, and cursor pagination', async () => {
      const captured: SqlCall[] = [];
      mocks.queryRows.mockImplementation(async (sql: string, params: unknown[] = []) => {
        captured.push({ sql, params });
        if (sql.includes("to_regclass('public.ai_agent_runs')")) {
          return [{ exists: true }];
        }
        if (sql.includes('open_count')) {
          return [
            {
              open_count: 14,
              mine_count: 4,
              unassigned_count: 3,
              ai_count: 5,
              waiting_count: 2,
              waiting_approval_count: 1,
              snoozed_count: 1,
              resolved_count: 9,
              all_count: 24,
            },
          ];
        }
        if (sql.includes('GROUP BY c.group_id')) {
          return [{ group_id: GROUP_BILLING, cnt: 6 }];
        }
        if (sql.includes('SELECT COUNT(*)::int AS cnt')) {
          return [{ cnt: 3 }];
        }
        // Main paginated rows query returns limit + 1 (limit=1 -> 2 rows)
        return [
          {
            id: CONV_1,
            workspace_id: WS_A,
            visitor_id: VISITOR_1,
            channel: 'whatsapp',
            status: 'open',
            priority: 'high',
            group_id: GROUP_BILLING,
            tags: ['refund'],
            updated_at: '2026-11-16T10:00:00.000Z',
            created_at: '2026-11-16T09:00:00.000Z',
            effective_activity_at: '2026-11-16T10:00:00.000Z',
            visitor_name: 'Ayesha Khan',
            visitor_email: 'ayesha@example.com',
            last_msg_content: 'Please check my refund status',
            last_msg_sender_type: 'visitor',
            unread_count: 2,
          },
          {
            id: CONV_2,
            workspace_id: WS_A,
            visitor_id: VISITOR_1,
            channel: 'web',
            status: 'open',
            priority: 'normal',
            group_id: GROUP_BILLING,
            tags: [],
            updated_at: '2026-11-16T08:00:00.000Z',
            created_at: '2026-11-16T07:00:00.000Z',
            effective_activity_at: '2026-11-16T08:00:00.000Z',
            visitor_name: 'Bilal',
            visitor_email: null,
            last_msg_content: 'Hi',
            last_msg_sender_type: 'visitor',
            unread_count: 0,
          },
        ];
      });

      const res = await searchAndFilterConversationsAction(WS_A, {
        view: 'waiting_approval',
        channel: 'whatsapp',
        groupId: GROUP_BILLING,
        search: 'refund',
        sort: 'newest',
        limit: 1,
      });

      expect(mocks.workspaceAccess).toHaveBeenCalledWith(WS_A);
      expect(res.conversations).toHaveLength(1);
      expect(res.conversations[0]?.id).toBe(CONV_1);
      expect(res.conversations[0]?.group_id).toBe(GROUP_BILLING);
      expect(res.hasMore).toBe(true);
      expect(typeof res.nextCursor).toBe('string');
      expect(res.total).toBe(3);
      expect(res.counts.waiting_approval).toBe(1);
      expect(res.groupCounts[GROUP_BILLING]).toBe(6);

      const mainQuery = captured.find((c) => c.sql.includes('ORDER BY'));
      expect(mainQuery?.sql).toContain('c.workspace_id = $1');
      expect(mainQuery?.sql).toContain('c.group_id =');
      expect(mainQuery?.sql).toContain("to_tsvector('simple'");
      expect(mainQuery?.sql).toContain('ar.status IN (\'paused_approval\', \'waiting_approval\')');
      expect(mainQuery?.params[0]).toBe(WS_A);
      expect(mainQuery?.params).toContain(GROUP_BILLING);
      expect(mainQuery?.params).toContain('refund');

      // Verify nextCursor is decoded cleanly on subsequent page request
      captured.length = 0;
      await searchAndFilterConversationsAction(WS_A, {
        view: 'open',
        sort: 'newest',
        cursor: res.nextCursor,
        limit: 1,
      });
      const page2Query = captured.find((c) => c.sql.includes('ORDER BY'));
      expect(page2Query?.sql).toContain('::timestamptz');
      expect(page2Query?.params).toContain(CONV_1);
    });
  });

  describe('assignConversationGroupAction', () => {
    it('rejects groups belonging to another workspace', async () => {
      mocks.queryRows.mockResolvedValueOnce([]); // group lookup returns empty
      await expect(
        assignConversationGroupAction(WS_A, CONV_1, GROUP_BILLING),
      ).rejects.toThrow('Team group not found in this workspace.');
    });

    it('updates conversation.group_id when group belongs to the workspace', async () => {
      mocks.queryRows
        .mockResolvedValueOnce([{ id: GROUP_BILLING }])
        .mockResolvedValueOnce([{ id: CONV_1 }]);

      const result = await assignConversationGroupAction(WS_A, CONV_1, GROUP_BILLING);
      expect(result).toEqual({ groupId: GROUP_BILLING });
      expect(mocks.queryRows).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE public.conversations'),
        [GROUP_BILLING, CONV_1, WS_A],
      );
    });
  });

  describe('conversation_views CRUD', () => {
    it('forbids agents from creating shared views but allows admins', async () => {
      mocks.workspaceAccess.mockResolvedValueOnce({
        supabase: {},
        user: { id: AGENT_ID },
        role: 'agent',
      });

      await expect(
        saveConversationViewAction(WS_A, {
          name: 'All VIPs',
          shared: true,
        }),
      ).rejects.toThrow('Only admins can share conversation views');

      mocks.queryRows.mockResolvedValueOnce([
        {
          id: VIEW_1,
          name: 'Billing Urgent',
          owner_id: null,
          filters: { view: 'open', groupId: GROUP_BILLING },
          sort: { field: 'priority', direction: 'desc' },
        },
      ]);

      const saved = await saveConversationViewAction(WS_A, {
        name: 'Billing Urgent',
        shared: true,
        filters: { view: 'open', groupId: GROUP_BILLING },
        sort: { field: 'priority', direction: 'desc' },
      });

      expect(saved.id).toBe(VIEW_1);
      expect(saved.ownerId).toBeNull();
    });

    it('deletes a saved view scoped by workspace_id', async () => {
      mocks.queryRows.mockResolvedValueOnce([{ id: VIEW_1, owner_id: AGENT_ID }]);
      await deleteConversationViewAction(WS_A, VIEW_1);
      expect(mocks.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.conversation_views WHERE id = $1 AND workspace_id = $2'),
        [VIEW_1, WS_A],
      );
    });
  });

  describe('updateVisitorNotesAction', () => {
    it('updates visitors.notes scoped to workspace_id and rejects missing records', async () => {
      mocks.queryRows.mockResolvedValueOnce([{ notes: 'VIP founder account' }]);
      const ok = await updateVisitorNotesAction(WS_A, VISITOR_1, '  VIP founder account  ');
      expect(ok).toEqual({ notes: 'VIP founder account' });
      expect(mocks.queryRows).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.visitors'),
        ['VIP founder account', VISITOR_1, WS_A],
      );

      mocks.queryRows.mockResolvedValueOnce([]);
      await expect(updateVisitorNotesAction(WS_A, VISITOR_1, 'note')).rejects.toThrow(
        'Customer record not found in this workspace.',
      );
    });
  });

  describe('AI summary & lifetime stats aggregation', () => {
    it('returns normalized confidence %, estimated cost, pending approval run, and lifetime CSAT', async () => {
      mocks.queryRows
        .mockResolvedValueOnce([
          { confidence: 0.91, agent_name: 'Billing Specialist', metadata: { engine: 'langgraph' } },
        ])
        .mockResolvedValueOnce([{ total_cost: '0.004215', latest_model: 'gemini-2.5-flash' }])
        .mockResolvedValueOnce([
          {
            id: 'run-1',
            thread_id: 'lg:ws:conv:1',
            agent_id: 'agent-ai-1',
            engine_type: 'langgraph',
            topic: 'Refunds',
            pending_action: {
              reason: 'Refund exceeds $25 auto-approval limit',
              pendingActions: [{ toolName: 'issue_refund', summary: 'Refund $49.00', args: {} }],
            },
            draft_reply: 'I can process your $49.00 refund right away.',
            created_at: '2026-11-16T11:00:00.000Z',
            agent_name: 'Billing Specialist',
          },
        ]);

      const summary = await getConversationAiSummaryAction(WS_A, CONV_1);
      expect(summary.latestConfidencePct).toBe(91);
      expect(summary.estimatedCostUsd).toBe(0.004215);
      expect(summary.agentName).toBe('Billing Specialist');
      expect(summary.engineUsed).toBe('langgraph');
      expect(summary.pendingApprovalRun?.draftReply).toContain('$49.00');

      mocks.queryRows
        .mockResolvedValueOnce([{ id: VISITOR_1 }])
        .mockResolvedValueOnce([
          { resolved_cnt: 4, avg_frt_sec: '47.6', csat_sum: '14', csat_cnt: 3 },
        ])
        .mockResolvedValueOnce([{ survey_sum: '5', survey_cnt: 1 }]);

      const lifetime = await getVisitorLifetimeStatsAction(WS_A, VISITOR_1, 'ayesha@example.com');
      expect(lifetime).toEqual({
        lifetimeCsatAvg: 4.8,
        csatCount: 4,
        avgFirstReplySec: 48,
        totalResolvedCount: 4,
      });
    });
  });

  describe('resumeAgentApprovalAction', () => {
    function buildSupabaseMock(convChannel = 'whatsapp') {
      const msgInsertSelect = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'msg-delivered-1' }, error: null }),
      });
      const convUpdateChain = {
        eq: vi.fn().mockReturnThis(),
      };
      convUpdateChain.eq.mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }));

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'conversations') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: CONV_1,
                        workspace_id: WS_A,
                        channel: convChannel,
                        status: 'open',
                        channel_metadata: {},
                        assigned_agent_id: null,
                        agent_id: null,
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
              update: vi.fn().mockReturnValue(convUpdateChain),
            };
          }
          if (table === 'messages') {
            return {
              insert: vi.fn().mockReturnValue({ select: msgInsertSelect }),
            };
          }
          return {};
        }),
      };
      return supabase;
    }

    it('approves waiting run, delivers outbound message, and marks run completed', async () => {
      const supabase = buildSupabaseMock('whatsapp');
      mocks.workspaceAccess.mockResolvedValueOnce({
        supabase,
        user: { id: AGENT_ID },
        role: 'admin',
      });
      mocks.queryRows.mockResolvedValueOnce([{ draft_reply: 'Draft reply', status: 'waiting_approval' }]);

      const result = await resumeAgentApprovalAction(WS_A, {
        conversationId: CONV_1,
        threadId: 'lg:thread:1',
        approved: true,
        editedReply: 'Edited approved refund reply.',
      });

      expect(result.status).toBe('approved');
      expect(result.deliveredMessageId).toBe('msg-delivered-1');
      expect(mocks.dispatchOutboundMessage).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: CONV_1, channel: 'whatsapp' }),
      );
      expect(mocks.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.ai_agent_runs'),
        [WS_A, 'lg:thread:1', 'completed', 'Approved refund of $49.00.', AGENT_ID],
      );
    });

    it('rejects draft, pauses autopilot for human takeover, and marks run rejected', async () => {
      const supabase = buildSupabaseMock('web');
      mocks.workspaceAccess.mockResolvedValueOnce({
        supabase,
        user: { id: AGENT_ID },
        role: 'agent',
      });
      mocks.queryRows.mockResolvedValueOnce([{ draft_reply: 'Draft reply', status: 'waiting_approval' }]);

      const result = await resumeAgentApprovalAction(WS_A, {
        conversationId: CONV_1,
        threadId: 'lg:thread:2',
        approved: false,
      });

      expect(result.status).toBe('rejected');
      expect(result.deliveredMessageId).toBeNull();
      expect(mocks.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.ai_agent_runs'),
        [WS_A, 'lg:thread:2', 'rejected', null, AGENT_ID],
      );
    });
  });
});
