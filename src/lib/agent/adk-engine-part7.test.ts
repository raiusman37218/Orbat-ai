import { describe, expect, it, vi } from 'vitest';
import {
  BaseLlm,
  type BaseLlmConnection,
  type LlmRequest,
  type LlmResponse,
} from '@google/adk';
import type { DbQueryFn, SearchKnowledgeFn } from './tools/registry';
import { resolveEffectiveProviderConfig } from './engines/model-config';
import { resumeAdkAgentRun, runAdkAgent } from './engines/adk-engine';
import { executeAgentWithRouter, resolveAgentEngineChoice } from './engines/router';

const WS_A = '11111111-1111-4111-8111-111111111111';
const WS_B = '22222222-2222-4222-8222-222222222222';
const VISITOR_1 = '33333333-3333-4333-8333-333333333333';

function makeMockRag(content = 'Annual enterprise plans start at $299/month with SLA.'): SearchKnowledgeFn {
  return vi.fn(async () => ({
    text: `[CHUNK 1]\nArticle: Enterprise Pricing\nSection: Pricing & Billing\n${content}`,
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
        content,
        similarity: 0.93,
        keyword_score: 0.88,
        combined_score: 0.95,
      },
    ],
  }));
}

function makeMockDb(overrides?: {
  onDealInsert?: (params: unknown[]) => void;
  pausedRuns?: Map<string, Record<string, unknown>>;
}): DbQueryFn {
  const pausedRuns = overrides?.pausedRuns ?? new Map<string, Record<string, unknown>>();
  return (async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM public.visitors')) {
      return [{ id: VISITOR_1, name: 'Ayesha Ali', email: 'ayesha@acme.test', segment: 'vip', plan: 'pro' }] as unknown as T[];
    }
    if (sql.includes('INSERT INTO public.crm_deals')) {
      overrides?.onDealInsert?.(params);
      return [{ id: 'deal-adk-1', title: params[2], stage: params[3] }] as unknown as T[];
    }
    if (sql.includes('INSERT INTO public.ai_agent_runs')) {
      const threadId = String(params[5] ?? '');
      const status = String(params[6] ?? '');
      pausedRuns.set(threadId, {
        id: 'run-adk-1',
        workspace_id: params[0],
        conversation_id: params[1],
        visitor_message_id: params[2],
        agent_id: params[3],
        engine_type: params[4],
        thread_id: threadId,
        status,
        topic: params[7],
        pending_action: JSON.parse(String(params[8] || '{}')),
        draft_reply: params[9],
        trace: JSON.parse(String(params[11] || '[]')),
      });
      return [{ id: 'run-adk-1' }] as unknown as T[];
    }
    if (sql.includes('FROM public.ai_agent_runs') && sql.includes('WHERE thread_id')) {
      const threadId = String(params[0] ?? '');
      const ws = String(params[1] ?? '');
      const row = pausedRuns.get(threadId);
      if (row && row.workspace_id === ws) {
        return [row] as unknown as T[];
      }
      return [] as T[];
    }
    return [] as T[];
  }) as DbQueryFn;
}

class MockSubAgentAdkLlm extends BaseLlm {
  private step = 0;

  constructor() {
    super({ model: 'mock-adk-test' });
  }

  async connect(): Promise<BaseLlmConnection> {
    throw new Error('unsupported');
  }

  async *generateContentAsync(llmRequest: LlmRequest): AsyncGenerator<LlmResponse, void> {
    this.step += 1;
    const tools = llmRequest.toolsDict || {};

    if (this.step === 1 && tools.transfer_to_agent) {
      yield {
        content: {
          role: 'model',
          parts: [
            {
              functionCall: {
                id: 'adk_xfer_1',
                name: 'transfer_to_agent',
                args: { agent_name: 'crm_sales_specialist' },
              },
            },
          ],
        },
        turnComplete: true,
      };
      return;
    }

    if (this.step === 2 && tools.crm_get_customer_360) {
      yield {
        content: {
          role: 'model',
          parts: [
            {
              functionCall: {
                id: 'adk_crm_1',
                name: 'crm_get_customer_360',
                args: { visitorId: VISITOR_1 },
              },
            },
          ],
        },
        turnComplete: true,
      };
      return;
    }

    yield {
      content: {
        role: 'model',
        parts: [
          {
            text: 'Hi Ayesha! Your VIP Pro account is active and Enterprise annual pricing starts at $299/month.',
          },
        ],
      },
      turnComplete: true,
    };
  }
}

describe('Part 7: Google ADK Engine, Hybrid Auto-Router & Per-Agent Model Override', () => {
  it('runs real @google/adk LlmAgent + InMemoryRunner with specialist sub-agent delegation and unified CRM tools', async () => {
    const dbQuery = makeMockDb();
    const res = await runAdkAgent(
      {
        workspaceId: WS_A,
        workspaceName: 'Acme Cloud',
        conversationId: 'conv-adk-1',
        visitorId: VISITOR_1,
        visitorName: 'Ayesha Ali',
        channel: 'web',
        message: 'Can you check my account status and share enterprise pricing?',
        history: [],
        dryRun: true,
        agent: {
          id: 'agent-adk-1',
          name: 'Orbat Support',
          engineType: 'adk',
          ragConfig: { citations: true },
        },
        autonomyPolicies: [
          {
            id: 'pol-auto',
            topic: 'Pricing & Billing',
            level: 4,
            locked: false,
            lockReason: null,
          },
        ],
      },
      {
        services: {
          customLlm: new MockSubAgentAdkLlm(),
          dbQuery,
          searchKnowledgeFn: makeMockRag(),
          getSectionNamesFn: async () => ['Pricing & Billing'],
        },
      },
    );

    expect(res.engineUsed).toBe('adk');
    expect(res.action).toBe('reply');
    expect(res.usingModel).toBe(true);
    expect(res.replyText).toContain('Ayesha');
    expect(res.trace.some((t) => t.node === 'adk_transfer')).toBe(true);
    expect(res.trace.some((t) => t.summary.includes('crm_get_customer_360'))).toBe(true);
    expect(res.trace.some((t) => t.summary.includes('crm_sales_specialist'))).toBe(true);
    expect(res.citedArticles[0]?.title).toBe('Enterprise Pricing');
  });

  it('drives OrbatAdkLlm multi-turn JSON tool calling and falls back cleanly offline without a model key', async () => {
    let callNum = 0;
    const generateReplyFn = vi.fn(async () => {
      callNum += 1;
      if (callNum === 1) {
        return '{"tool_call":{"name":"search_knowledge","args":{"query":"Enterprise SLA"}}}';
      }
      return 'Our Enterprise SLA is backed by annual agreements starting at $299/month.';
    });

    const toolRes = await runAdkAgent(
      {
        workspaceId: WS_A,
        conversationId: 'conv-adk-json',
        channel: 'web',
        message: 'What is included in your SLA?',
        history: [],
        dryRun: true,
        agent: {
          id: 'agent-adk-2',
          name: 'KB Coordinator',
          engineType: 'adk',
          ragConfig: { citations: true },
        },
        autonomyPolicies: [
          {
            id: 'pol-auto',
            topic: 'General inquiries',
            level: 4,
            locked: false,
            lockReason: null,
          },
        ],
      },
      {
        services: {
          generateReplyFn,
          dbQuery: makeMockDb(),
          searchKnowledgeFn: makeMockRag(),
          getSectionNamesFn: async () => [],
        },
      },
    );

    expect(generateReplyFn).toHaveBeenCalledTimes(2);
    expect(toolRes.usingModel).toBe(true);
    expect(toolRes.replyText).toContain('$299/month');

    // Offline fallback with null model output still grounds in KB cleanly.
    const offlineRes = await runAdkAgent(
      {
        workspaceId: WS_A,
        conversationId: 'conv-adk-offline',
        channel: 'web',
        message: 'Tell me about enterprise pricing',
        history: [],
        dryRun: true,
        agent: { id: 'agent-adk-2', name: 'KB Coordinator', engineType: 'adk' },
        autonomyPolicies: [
          {
            id: 'pol-auto',
            topic: 'General inquiries',
            level: 4,
            locked: false,
            lockReason: null,
          },
        ],
      },
      {
        services: {
          generateReplyFn: async () => null,
          dbQuery: makeMockDb(),
          searchKnowledgeFn: makeMockRag(),
          getSectionNamesFn: async () => [],
        },
      },
    );

    expect(offlineRes.usingModel).toBe(false);
    expect(offlineRes.action).toBe('reply');
    expect(offlineRes.replyText).toContain('$299/month');
  });

  it('pauses ADK runs for Trust Ladder human approval and commits staged CRM deals only after workspace-scoped resume', async () => {
    const dealInserts: unknown[][] = [];
    const pausedRuns = new Map<string, Record<string, unknown>>();
    const dbQuery = makeMockDb({
      onDealInsert: (p) => dealInserts.push(p),
      pausedRuns,
    });

    const paused = await runAdkAgent(
      {
        workspaceId: WS_A,
        conversationId: 'conv-adk-pause',
        visitorId: VISITOR_1,
        visitorName: 'Ayesha Ali',
        channel: 'web',
        message: 'We want an annual enterprise quote for 40 seats.',
        history: [],
        dryRun: false,
        agent: {
          id: 'agent-adk-sales',
          name: 'Sales ADK',
          engineType: 'adk',
        },
        autonomyPolicies: [
          {
            id: 'pol-draft',
            topic: 'Pricing & Billing',
            level: 3,
            locked: false,
            lockReason: null,
          },
        ],
      },
      {
        services: {
          generateReplyFn: async () => 'We can prepare a 40-seat Enterprise annual quote right away.',
          dbQuery,
          searchKnowledgeFn: makeMockRag(),
          getSectionNamesFn: async () => ['Pricing & Billing'],
        },
      },
    );

    expect(paused.action).toBe('awaiting_approval');
    expect(paused.engineUsed).toBe('adk');
    expect(paused.pendingApproval?.pendingActions.length).toBeGreaterThan(0);
    // Deal MUST NOT be inserted before approval.
    expect(dealInserts).toHaveLength(0);

    // Cross-workspace resume must fail isolation check.
    await expect(
      resumeAdkAgentRun({
        workspaceId: WS_B,
        threadId: paused.threadId,
        approved: true,
        dbQuery,
      }),
    ).rejects.toThrow();

    // Same-workspace approval commits staged CRM deal cleanly.
    const resumed = await resumeAdkAgentRun({
      workspaceId: WS_A,
      threadId: paused.threadId,
      approved: true,
      editedReply: 'Approved: Here is your 40-seat Enterprise annual quote!',
      resolvedBy: 'user-reviewer-1',
      dbQuery,
    });

    expect(resumed.engineUsed).toBe('adk');
    expect(resumed.replyText).toBe('Approved: Here is your 40-seat Enterprise annual quote!');
    expect(dealInserts).toHaveLength(1);
    expect(dealInserts[0][0]).toBe(WS_A);
  });

  it('routes Hybrid mode dynamically between LangGraph and Google ADK and handles failover safely', async () => {
    const lgDecision = resolveAgentEngineChoice({
      engineType: 'hybrid',
      message: 'Please issue a refund and cancel my annual enterprise contract.',
    });
    expect(lgDecision.selectedEngine).toBe('langgraph');

    const adkDecision = resolveAgentEngineChoice({
      engineType: 'hybrid',
      message: 'Can you inspect my recent order status and API webhook setup troubleshooting steps?',
    });
    expect(adkDecision.selectedEngine).toBe('adk');

    const builtinDecision = resolveAgentEngineChoice({
      engineType: 'hybrid',
      message: 'Hello there',
      agent: { engineConfig: { fallbackEngine: 'builtin' } },
    });
    expect(builtinDecision.selectedEngine).toBe('builtin');

    // End-to-end executeAgentWithRouter running ADK via Hybrid mode
    const outcome = await executeAgentWithRouter(
      {
        workspaceId: WS_A,
        conversationId: 'conv-hybrid-1',
        channel: 'web',
        message: 'Check my subscription billing status and webhook integration details please',
        history: [],
        dryRun: true,
        agent: {
          id: 'agent-hybrid',
          name: 'Hybrid Pro',
          engineType: 'hybrid',
        },
        autonomyPolicies: [
          {
            id: 'pol-auto',
            topic: 'General inquiries',
            level: 4,
            locked: false,
            lockReason: null,
          },
        ],
      },
      {
        adk: {
          services: {
            generateReplyFn: async () => 'Hybrid -> ADK handled your integration check cleanly.',
            dbQuery: makeMockDb(),
            searchKnowledgeFn: makeMockRag(),
            getSectionNamesFn: async () => [],
          },
        },
      },
    );

    expect(outcome.decision.selectedEngine).toBe('adk');
    expect(outcome.result?.engineUsed).toBe('adk');
    expect(outcome.result?.replyText).toContain('Hybrid -> ADK');

    // Timeout / crash triggers safe failover without throwing
    const crashedOutcome = await executeAgentWithRouter(
      {
        workspaceId: WS_A,
        conversationId: 'conv-hybrid-failover',
        channel: 'web',
        message: 'Check my API webhook setup error',
        history: [],
        dryRun: true,
        agent: {
          id: 'agent-hybrid-err',
          name: 'Hybrid Guarded',
          engineType: 'adk',
          engineConfig: { fallbackEngine: 'builtin' },
        },
      },
      {
        adk: {
          services: {
            customLlm: new (class extends BaseLlm {
              constructor() {
                super({ model: 'broken' });
              }
              async connect(): Promise<BaseLlmConnection> {
                throw new Error('broken');
              }
              async *generateContentAsync(): AsyncGenerator<LlmResponse, void> {
                yield { turnComplete: true };
                throw new Error('Simulated timeout');
              }
            })(),
            dbQuery: makeMockDb(),
            searchKnowledgeFn: makeMockRag(),
          },
        },
      },
    );
    expect(crashedOutcome.result).not.toBeNull();
  });

  it('resolves per-agent modelConfig overrides safely with platform key inheritance and missing-key fallback', () => {
    const sameProvider = resolveEffectiveProviderConfig(
      { provider: 'google', model: 'gemini-3.8-flash', apiKey: 'plat-key-123' },
      { provider: 'google', model: 'gemini-3.8-pro', temperature: 0.1 },
    );
    expect(sameProvider.providerConfig?.model).toBe('gemini-3.8-pro');
    expect(sameProvider.providerConfig?.apiKey).toBe('plat-key-123');
    expect(sameProvider.overrideApplied).toBe(true);
    expect(sameProvider.temperature).toBe(0.1);

    const noKeyAltProvider = resolveEffectiveProviderConfig(
      { provider: 'anthropic', model: 'claude-opus-5', apiKey: 'plat-ant-key' },
      { provider: 'openai', model: 'gpt-5', temperature: 99 },
    );
    // Without OPENAI_API_KEY env var, safely inherits base platform config & clamps temperature
    if (!process.env.OPENAI_API_KEY) {
      expect(noKeyAltProvider.providerConfig?.provider).toBe('anthropic');
      expect(noKeyAltProvider.fallbackNote).toContain('openai');
    }
    expect(noKeyAltProvider.temperature).toBe(1.5);
  });
});
