import { describe, expect, it, vi } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';
import {
  BaseLlm,
  type BaseLlmConnection,
  type LlmRequest,
  type LlmResponse,
} from '@google/adk';
import {
  buildRuleBasedAgentPromptDraft,
  detectAgentChannelConflicts,
  isToolAllowedInConfig,
  toRetrievedChunkSummaries,
} from '@/lib/ai/agent-templates';
import { runLangGraphAgent } from './engines/langgraph-engine';
import { runAdkAgent } from './engines/adk-engine';
import type { DbQueryFn, SearchKnowledgeFn } from './tools/registry';

const WS_A = '11111111-1111-4111-8111-111111111111';
const VISITOR_1 = '33333333-3333-4333-8333-333333333333';

function makeMockRag(score = 0.95): SearchKnowledgeFn {
  return vi.fn(async () => ({
    text: '[CHUNK 1]\nArticle: Enterprise Pricing\nSection: Pricing & Billing\nEnterprise annual plans start at $299/month with dedicated SLA.',
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
        content: 'Enterprise annual plans start at $299/month with dedicated SLA.',
        similarity: 0.91,
        keyword_score: 0.87,
        combined_score: score,
      },
    ],
  }));
}

function makeTrackingDb(sqlCalls: string[]): DbQueryFn {
  return (async <T extends Record<string, unknown>>(sql: string) => {
    sqlCalls.push(sql);
    if (sql.includes('FROM public.visitors')) {
      return [{ id: VISITOR_1, name: 'Sara Khan', email: 'sara@acme.test', segment: 'vip', plan: 'pro' }] as unknown as T[];
    }
    return [] as T[];
  }) as DbQueryFn;
}

class AdkToolCheckLlm extends BaseLlm {
  public seenToolNames: string[] = [];

  constructor() {
    super({ model: 'mock-adk-part8' });
  }

  async connect(): Promise<BaseLlmConnection> {
    throw new Error('unsupported');
  }

  async *generateContentAsync(llmRequest: LlmRequest): AsyncGenerator<LlmResponse, void> {
    this.seenToolNames.push(...Object.keys(llmRequest.toolsDict || {}));
    yield {
      content: {
        role: 'model',
        parts: [
          {
            text: 'Enterprise annual pricing starts at $299/month and includes a dedicated SLA.',
          },
        ],
      },
      turnComplete: true,
    };
  }
}

describe('Part 8: Simple/Advanced Builder Helpers, Channel Conflicts, Tool Permissions & Chunk Summaries', () => {
  describe('Pure Builder Helpers', () => {
    it('builds role-tailored prompt drafts for sales and billing goals', () => {
      const salesDraft = buildRuleBasedAgentPromptDraft({
        goal: 'Qualify enterprise pricing leads and book product demos.',
        agentName: 'Aria',
        industry: 'B2B SaaS',
        channels: ['web', 'whatsapp'],
      });
      expect(salesDraft.roleTitle).toContain('Sales');
      expect(salesDraft.answerMode).toBe('agent');
      expect(salesDraft.systemPrompt).toContain('Aria');
      expect(salesDraft.systemPrompt).toContain('web, whatsapp');
      expect(salesDraft.systemPrompt.toLowerCase()).toContain('crm deals');

      const billingDraft = buildRuleBasedAgentPromptDraft({
        goal: 'Handle refund requests, invoice corrections, and subscription cancellations.',
        agentName: 'Bilal',
      });
      expect(billingDraft.roleTitle).toContain('Billing');
      expect(billingDraft.answerMode).toBe('strict');
      expect(billingDraft.guardrails.some((g) => g.toLowerCase().includes('approval'))).toBe(true);
    });

    it('detects overlapping catch-all live channel conflicts while ignoring paused or keyword-filtered peers', () => {
      const conflicts = detectAgentChannelConflicts({
        currentAgentId: 'agent-self',
        currentStatus: 'draft',
        currentChannels: ['web', 'email'],
        currentRoutingRules: { keywords: [], intents: [] },
        allAgents: [
          {
            id: 'agent-self',
            name: 'Self Agent',
            status: 'live',
            isPrimary: true,
            channels: ['web', 'email'],
            routingRules: { keywords: [], intents: [] },
          },
          {
            id: 'agent-peer-overlap',
            name: 'General Bot',
            status: 'live',
            isPrimary: false,
            channels: ['web', 'whatsapp'],
            routingRules: { keywords: [], intents: [] },
          },
          {
            id: 'agent-peer-paused',
            name: 'Paused Bot',
            status: 'paused',
            isPrimary: false,
            channels: ['email'],
            routingRules: { keywords: [], intents: [] },
          },
          {
            id: 'agent-peer-filtered',
            name: 'Billing Bot',
            status: 'live',
            isPrimary: false,
            channels: ['email'],
            routingRules: { keywords: ['refund'], intents: ['billing'] },
          },
        ],
      });

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.agentId).toBe('agent-peer-overlap');
      expect(conflicts[0]?.sharedChannels).toEqual(['web']);

      const resolvedWithKeywords = detectAgentChannelConflicts({
        currentAgentId: 'agent-self',
        currentStatus: 'live',
        currentChannels: ['web'],
        currentRoutingRules: { keywords: ['sales'], intents: [] },
        allAgents: [
          {
            id: 'agent-peer-overlap',
            name: 'General Bot',
            status: 'live',
            isPrimary: false,
            channels: ['web'],
            routingRules: { keywords: [], intents: [] },
          },
        ],
      });
      expect(resolvedWithKeywords).toHaveLength(0);
    });

    it('enforces isToolAllowedInConfig defaults and required tools, and formats chunk summaries safely', () => {
      expect(isToolAllowedInConfig(undefined, 'crm_create_or_update_deal')).toBe(true);
      expect(isToolAllowedInConfig([], 'crm_get_customer_360')).toBe(true);
      expect(isToolAllowedInConfig(['search_knowledge'], 'search_knowledge')).toBe(true);
      expect(isToolAllowedInConfig(['search_knowledge'], 'escalate_to_team_group')).toBe(true);
      expect(isToolAllowedInConfig(['search_knowledge'], 'request_human_approval')).toBe(true);
      expect(isToolAllowedInConfig(['search_knowledge'], 'crm_get_customer_360')).toBe(false);
      expect(isToolAllowedInConfig(['search_knowledge'], 'crm_create_or_update_deal')).toBe(false);
      expect(isToolAllowedInConfig(['search_knowledge'], 'crm_create_followup_task')).toBe(false);
      expect(isToolAllowedInConfig(['search_knowledge', 'crm_get_customer_360'], 'crm_get_customer_360')).toBe(true);

      expect(toRetrievedChunkSummaries([])).toEqual([]);
      const longText = 'X'.repeat(260);
      const chunks = toRetrievedChunkSummaries(
        [
          {
            id: 'c1',
            article_title: 'Pricing Guide',
            section_name: 'Billing',
            combined_score: 1.4,
            content: `   Hello   world   ${longText}`,
          },
          {
            id: 'c2',
            similarity: -0.2,
            content: 'Second chunk',
          },
        ],
        1,
      );
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.score).toBe(1);
      expect(chunks[0]?.snippet.length).toBeLessThanOrEqual(220);
      expect(chunks[0]?.snippet.endsWith('...')).toBe(true);
    });
  });

  describe('Runtime Tool Permission Enforcement & X-Ray Chunk Previews', () => {
    it('enforces engineConfig.allowedTools in LangGraph and returns retrievedChunks previews', async () => {
      const restrictedSqlCalls: string[] = [];
      const restrictedRes = await runLangGraphAgent(
        {
          workspaceId: WS_A,
          workspaceName: 'Acme Cloud',
          conversationId: 'conv-lg-restricted',
          visitorId: VISITOR_1,
          visitorName: 'Sara Khan',
          channel: 'web',
          message: 'Can you share your enterprise pricing quote so we can upgrade?',
          history: [],
          dryRun: true,
          agent: {
            id: 'agent-lg-restricted',
            name: 'Docs Only LG',
            engineType: 'langgraph',
            engineConfig: { allowedTools: ['search_knowledge'] },
            ragConfig: { mode: 'standard', citations: true },
          },
          autonomyPolicies: [
            { id: 'pol-1', topic: 'Pricing & Billing', level: 4, locked: false, lockReason: null },
          ],
        },
        {
          checkpointer: new MemorySaver(),
          services: {
            dbQuery: makeTrackingDb(restrictedSqlCalls),
            searchKnowledgeFn: makeMockRag(0.95),
            getSectionNamesFn: async () => ['Pricing & Billing'],
            generateReplyFn: async () => 'Enterprise annual plans start at $299/month.',
          },
        },
      );

      expect(restrictedSqlCalls.some((s) => s.includes('FROM public.visitors'))).toBe(false);
      expect(restrictedRes.executedTools.some((t) => t.toolName === 'crm_get_customer_360')).toBe(false);
      expect(restrictedRes.executedTools.some((t) => t.toolName === 'crm_create_or_update_deal')).toBe(false);
      expect(restrictedRes.retrievedChunks).toHaveLength(1);
      expect(restrictedRes.retrievedChunks?.[0]?.articleTitle).toBe('Enterprise Pricing');
      expect(restrictedRes.retrievedChunks?.[0]?.score).toBe(0.95);

      const defaultSqlCalls: string[] = [];
      const defaultRes = await runLangGraphAgent(
        {
          workspaceId: WS_A,
          workspaceName: 'Acme Cloud',
          conversationId: 'conv-lg-default',
          visitorId: VISITOR_1,
          visitorName: 'Sara Khan',
          channel: 'web',
          message: 'Can you share your enterprise pricing quote so we can upgrade?',
          history: [],
          dryRun: true,
          agent: {
            id: 'agent-lg-default',
            name: 'Full Tools LG',
            engineType: 'langgraph',
            ragConfig: { mode: 'standard', citations: true },
          },
          autonomyPolicies: [
            { id: 'pol-1', topic: 'Pricing & Billing', level: 4, locked: false, lockReason: null },
          ],
        },
        {
          checkpointer: new MemorySaver(),
          services: {
            dbQuery: makeTrackingDb(defaultSqlCalls),
            searchKnowledgeFn: makeMockRag(0.95),
            getSectionNamesFn: async () => ['Pricing & Billing'],
            generateReplyFn: async () => 'Enterprise annual plans start at $299/month.',
          },
        },
      );

      expect(defaultSqlCalls.some((s) => s.includes('FROM public.visitors'))).toBe(true);
      expect(defaultRes.executedTools.some((t) => t.toolName === 'crm_get_customer_360')).toBe(true);
      expect(defaultRes.executedTools.some((t) => t.toolName === 'crm_create_or_update_deal')).toBe(true);
    });

    it('enforces engineConfig.allowedTools in Google ADK and returns retrievedChunks previews', async () => {
      const restrictedSqlCalls: string[] = [];
      const restrictedLlm = new AdkToolCheckLlm();

      const res = await runAdkAgent(
        {
          workspaceId: WS_A,
          workspaceName: 'Acme Cloud',
          conversationId: 'conv-adk-restricted',
          visitorId: VISITOR_1,
          visitorName: 'Sara Khan',
          channel: 'web',
          message: 'Can you give me a formal quote and enterprise pricing details?',
          history: [],
          dryRun: true,
          agent: {
            id: 'agent-adk-restricted',
            name: 'Docs Only ADK',
            engineType: 'adk',
            engineConfig: { allowedTools: ['search_knowledge'] },
            ragConfig: { mode: 'standard', citations: true },
          },
          autonomyPolicies: [
            { id: 'pol-1', topic: 'Pricing & Billing', level: 4, locked: false, lockReason: null },
          ],
        },
        {
          services: {
            customLlm: restrictedLlm,
            dbQuery: makeTrackingDb(restrictedSqlCalls),
            searchKnowledgeFn: makeMockRag(0.93),
            getSectionNamesFn: async () => ['Pricing & Billing'],
          },
        },
      );

      expect(restrictedSqlCalls.some((s) => s.includes('FROM public.visitors'))).toBe(false);
      expect(res.executedTools.some((t) => t.toolName === 'crm_get_customer_360')).toBe(false);
      expect(res.executedTools.some((t) => t.toolName === 'crm_create_or_update_deal')).toBe(false);
      expect(restrictedLlm.seenToolNames).not.toContain('crm_get_customer_360');
      expect(restrictedLlm.seenToolNames).not.toContain('crm_create_or_update_deal');
      expect(res.retrievedChunks).toHaveLength(1);
      expect(res.retrievedChunks?.[0]?.articleTitle).toBe('Enterprise Pricing');
      expect(res.retrievedChunks?.[0]?.score).toBe(0.93);
    });
  });
});
