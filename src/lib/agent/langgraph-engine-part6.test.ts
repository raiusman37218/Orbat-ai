import { describe, expect, it, vi } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';
import {
  buildLangChainAgentTools,
  executeAgentTool,
  type DbQueryFn,
  type SearchKnowledgeFn,
} from './tools/registry';
import {
  resumeLangGraphAgentRun,
  runLangGraphAgent,
} from './engines/langgraph-engine';
import { answerWithExternalAgent } from './external-agent';

const WS_A = '11111111-1111-4111-8111-111111111111';
const WS_B = '22222222-2222-4222-8222-222222222222';
const VISITOR_1 = '33333333-3333-4333-8333-333333333333';

function makeMockRag(): SearchKnowledgeFn {
  return vi.fn(async () => ({
    text: '[CHUNK 1]\nArticle: Enterprise Pricing\nSection: Pricing & Billing\nAnnual enterprise plans start at $299/month with SLA.',
    sources: [
      {
        id: 'art-pricing-1',
        title: 'Enterprise Pricing',
        slug: 'enterprise-pricing',
        url: '/help/test/enterprise-pricing',
        kind: 'article' as const,
      },
    ],
    used: [
      {
        id: 'art-pricing-1',
        title: 'Enterprise Pricing',
        source: 'article' as const,
      },
    ],
    belowThreshold: false,
    confidence: 'high' as const,
    chunks: [
      {
        id: 'chunk-pricing-1',
        article_id: 'art-pricing-1',
        article_title: 'Enterprise Pricing',
        section_name: 'Pricing & Billing',
        article_slug: 'enterprise-pricing',
        chunk_index: 0,
        content: 'Annual enterprise plans start at $299/month with SLA.',
        similarity: 0.92,
        keyword_score: 0.85,
        combined_score: 0.94,
      },
    ],
  }));
}

describe('Part 6: Unified CRM Tools & LangGraph Built-In Engine', () => {
  describe('Unified CRM & Support Tool Registry', () => {
    it('enforces Zod schema validation and strict workspaceId isolation on all CRM queries', async () => {
      const sqlCalls: Array<{ sql: string; params: unknown[] }> = [];
      const mockDb: DbQueryFn = async <T extends Record<string, unknown>>(
        sql: string,
        params: unknown[] = [],
      ) => {
        sqlCalls.push({ sql, params });
        if (sql.includes('FROM public.visitors')) {
          return [{ id: VISITOR_1, name: 'Sara Khan', segment: 'vip', plan: 'pro' }] as unknown as T[];
        }
        if (sql.includes('INSERT INTO public.crm_deals')) {
          return [{ id: 'deal-1', title: params[2], stage: params[3] }] as unknown as T[];
        }
        return [] as T[];
      };

      const invalidDeal = await executeAgentTool(
        { workspaceId: WS_A, dbQuery: mockDb },
        'crm_create_or_update_deal',
        { title: 'Bad Deal', stage: 'invalid_stage', valueCents: -50 },
      );
      expect(invalidDeal.ok).toBe(false);
      expect(invalidDeal.error).toBeTruthy();

      await expect(
        executeAgentTool({ workspaceId: '' }, 'crm_get_customer_360', { visitorId: VISITOR_1 }),
      ).rejects.toThrow(/Workspace isolation violation/);

      const crmLookup = await executeAgentTool(
        { workspaceId: WS_A, visitorId: VISITOR_1, dbQuery: mockDb },
        'crm_get_customer_360',
        {},
      );
      expect(crmLookup.ok).toBe(true);
      expect(sqlCalls.length).toBeGreaterThanOrEqual(4);
      for (const call of sqlCalls) {
        expect(call.params[0]).toBe(WS_A);
        expect(call.sql).toContain('workspace_id = $1');
      }

      const dryDeal = await executeAgentTool(
        { workspaceId: WS_A, visitorId: VISITOR_1, dryRun: true, dbQuery: mockDb },
        'crm_create_or_update_deal',
        { title: 'Dry Run Deal', stage: 'qualified', valueCents: 150000 },
      );
      expect(dryDeal.ok).toBe(true);
      expect(dryDeal.summary).toContain('[Dry Run]');
      expect(sqlCalls.some((c) => c.sql.includes('INSERT INTO public.crm_deals'))).toBe(false);

      const lcTools = buildLangChainAgentTools({
        workspaceId: WS_A,
        visitorId: VISITOR_1,
        dbQuery: mockDb,
      });
      expect(lcTools.map((t) => t.name)).toContain('crm_create_or_update_deal');
      const invoked = await lcTools
        .find((t) => t.name === 'crm_create_or_update_deal')!
        .invoke({ title: 'Enterprise Renewal', stage: 'proposal', valueCents: 29900 });
      expect(JSON.parse(invoked).ok).toBe(true);
      expect(sqlCalls.some((c) => c.sql.includes('INSERT INTO public.crm_deals'))).toBe(true);
    });
  });

  describe('Built-In LangGraph StateGraph + Checkpoint Pause & Resume', () => {
    it('completes immediately without interrupt under Autonomous Trust Ladder policy', async () => {
      const checkpointer = new MemorySaver();
      const searchKnowledgeFn = makeMockRag();
      const mockDb: DbQueryFn = async <T extends Record<string, unknown>>() => [] as T[];

      const res = await runLangGraphAgent(
        {
          workspaceId: WS_A,
          workspaceName: 'Acme Cloud',
          conversationId: 'conv-auto-1',
          visitorMessageId: 'msg-1',
          visitorId: VISITOR_1,
          visitorName: 'Bilal',
          channel: 'web',
          message: 'How do I connect a webhook to my workspace?',
          history: [],
          agent: {
            id: 'agent-1',
            name: 'Support Concierge',
            engineType: 'langgraph',
            ragConfig: { mode: 'standard', citations: true },
          },
          autonomyPolicies: [
            {
              id: 'pol-1',
              topic: 'General inquiries',
              level: 4,
              locked: false,
              lockReason: null,
            },
          ],
        },
        {
          checkpointer,
          services: {
            dbQuery: mockDb,
            searchKnowledgeFn,
            getSectionNamesFn: async () => ['General inquiries'],
            generateReplyFn: async () => 'You can configure webhooks under Settings -> Integrations.',
          },
        },
      );

      expect(res.engineUsed).toBe('langgraph');
      expect(res.action).toBe('reply');
      expect(res.shouldHandover).toBe(false);
      expect(res.replyText).toContain('webhooks');
      expect(res.citedArticles).toHaveLength(1);
      expect(res.trace.map((t) => t.node)).toEqual([
        'understand_and_route',
        'retrieve_rag',
        'plan_or_tool',
        'policy_approval_gate',
        'finalize_reply',
      ]);
    });

    it('pauses at LangGraph interrupt checkpoint under Suggest policy and executes staged CRM deal upon approve resume', async () => {
      const checkpointer = new MemorySaver();
      const dbWrites: Array<{ sql: string; params: unknown[] }> = [];
      const mockDb: DbQueryFn = async <T extends Record<string, unknown>>(
        sql: string,
        params: unknown[] = [],
      ) => {
        if (sql.includes('INSERT INTO public.crm_deals') || sql.includes('INSERT INTO public.crm_tasks')) {
          dbWrites.push({ sql, params });
          return [{ id: 'deal-new-1', title: params[2], stage: params[3] }] as unknown as T[];
        }
        return [] as T[];
      };

      const paused = await runLangGraphAgent(
        {
          workspaceId: WS_A,
          workspaceName: 'Acme Cloud',
          conversationId: 'conv-pause-1',
          visitorMessageId: 'msg-pause-1',
          visitorId: VISITOR_1,
          visitorName: 'Nadia',
          channel: 'web',
          message: 'Can I get an enterprise quote and custom annual pricing?',
          history: [],
          agent: {
            id: 'agent-sales',
            name: 'Enterprise SDR',
            engineType: 'langgraph',
            ragConfig: { mode: 'standard', citations: true },
          },
          autonomyPolicies: [
            {
              id: 'pol-billing',
              topic: 'Billing & refunds',
              level: 2,
              locked: false,
              lockReason: null,
            },
          ],
        },
        {
          checkpointer,
          services: {
            dbQuery: mockDb,
            searchKnowledgeFn: makeMockRag(),
            getSectionNamesFn: async () => ['Pricing & Billing'],
            generateReplyFn: async () =>
              'Enterprise annual pricing starts at $299/month; our sales lead can prepare a custom quote.',
          },
        },
      );

      expect(paused.action).toBe('awaiting_approval');
      expect(paused.pendingApproval).toBeTruthy();
      expect(paused.pendingApproval?.pendingActions.some((a) => a.toolName === 'crm_create_or_update_deal')).toBe(
        true,
      );
      // Critical safety check: NO CRM writes executed before human approval!
      expect(dbWrites).toHaveLength(0);

      // Cross-workspace resume must fail
      await expect(
        resumeLangGraphAgentRun({
          workspaceId: WS_B,
          threadId: paused.threadId,
          approved: true,
          checkpointer,
          services: { dbQuery: mockDb },
        }),
      ).rejects.toThrow(/Workspace isolation violation/);

      // Approved resume from same workspace commits the staged deal and sends edited reply
      const resumed = await resumeLangGraphAgentRun({
        workspaceId: WS_A,
        threadId: paused.threadId,
        approved: true,
        editedReply: 'Approved: Enterprise annual pricing starts at $299/mo with 20% annual discount.',
        resolvedBy: 'teammate-1',
        checkpointer,
        services: { dbQuery: mockDb },
      });

      expect(resumed.action).toBe('reply');
      expect(resumed.replyText).toContain('20% annual discount');
      expect(dbWrites.some((w) => w.sql.includes('INSERT INTO public.crm_deals'))).toBe(true);
      expect(resumed.executedTools.some((t) => t.toolName === 'crm_create_or_update_deal' && t.ok)).toBe(true);
    });

    it('cancels staged CRM writes and escalates cleanly when human reviewer rejects draft', async () => {
      const checkpointer = new MemorySaver();
      const dbWrites: Array<{ sql: string }> = [];
      const mockDb: DbQueryFn = async <T extends Record<string, unknown>>(sql: string) => {
        if (sql.includes('INSERT INTO public.crm_')) dbWrites.push({ sql });
        return [] as T[];
      };

      const paused = await runLangGraphAgent(
        {
          workspaceId: WS_A,
          conversationId: 'conv-reject-1',
          visitorMessageId: 'msg-reject-1',
          visitorId: VISITOR_1,
          channel: 'web',
          message: 'I want an enterprise demo and refund on my last invoice',
          history: [],
          agent: { id: 'agent-1', name: 'Support Agent', engineType: 'langgraph' },
          autonomyPolicies: [
            { id: 'pol-1', topic: 'Billing & refunds', level: 2, locked: false, lockReason: null },
          ],
        },
        {
          checkpointer,
          services: {
            dbQuery: mockDb,
            searchKnowledgeFn: makeMockRag(),
            getSectionNamesFn: async () => [],
            generateReplyFn: async () => 'Proposed refund response',
          },
        },
      );

      expect(paused.action).toBe('awaiting_approval');
      const rejected = await resumeLangGraphAgentRun({
        workspaceId: WS_A,
        threadId: paused.threadId,
        approved: false,
        resolvedBy: 'teammate-1',
        checkpointer,
        services: { dbQuery: mockDb },
      });

      expect(rejected.action).toBe('escalate');
      expect(rejected.shouldHandover).toBe(true);
      expect(dbWrites).toHaveLength(0);
    });

    it('runs in non-blocking dryRun mode for Playground tests', async () => {
      const res = await runLangGraphAgent(
        {
          workspaceId: WS_A,
          conversationId: 'playground-ws-a',
          channel: 'playground',
          message: 'What does Enterprise pricing include?',
          history: [],
          dryRun: true,
          agent: { id: 'agent-1', name: 'Playground Bot', engineType: 'langgraph' },
          autonomyPolicies: [
            { id: 'pol-1', topic: 'Billing & refunds', level: 2, locked: false, lockReason: null },
          ],
        },
        {
          checkpointer: new MemorySaver(),
          services: {
            searchKnowledgeFn: makeMockRag(),
            generateReplyFn: async () => 'Enterprise includes SLA and dedicated onboarding.',
          },
        },
      );

      expect(res.action).toBe('reply');
      expect(res.replyText).toContain('SLA');
      expect(res.trace.some((t) => t.node === 'policy_approval_gate' && t.status === 'paused')).toBe(
        true,
      );
    });
  });

  describe('Optional External Webhook Bridge', () => {
    it('rejects private/unsafe per-agent webhook URLs and returns null for built-in fallback', async () => {
      const unsafe = await answerWithExternalAgent(
        {
          workspaceId: WS_A,
          conversationId: 'conv-ext-1',
          incomingMessage: 'Hello',
          channel: 'web',
          turns: [],
          perAgentWebhookUrl: 'https://127.0.0.1/webhook',
        },
        null,
      );
      expect(unsafe).toBeNull();
    });
  });
});
