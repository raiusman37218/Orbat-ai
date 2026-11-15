import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RetrievedChunk } from '@/types/database';

const WS_ID = 'ws-part5-adv-rag';

const state = vi.hoisted(() => ({
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  articleChunks: [] as RetrievedChunk[],
  articleChunkRows: [] as Array<{
    workspace_id: string;
    article_id: string;
    chunk_index: number;
    content: string;
  }>,
  botKnowledgeChunks: [] as Array<Record<string, unknown>>,
  botKnowledgeRows: [] as Array<{
    workspace_id: string;
    knowledge_id: string;
    chunk_index: number;
    content: string;
  }>,
  weakPrimaryOnFirstPass: false,
  chatImpl: null as null | ((prompt: string, system: string) => Promise<{ text: string }>),
}));

function filterTableRows<T extends Record<string, unknown>>(
  rows: T[],
  filters: Array<{ col: string; val: unknown; op: 'eq' | 'in' }>,
): T[] {
  return rows.filter((row) =>
    filters.every((f) => {
      const cell = row[f.col];
      if (f.op === 'eq') return cell === f.val;
      if (f.op === 'in' && Array.isArray(f.val)) return f.val.includes(cell);
      return true;
    }),
  );
}

function fakeSupabase() {
  const fromTable = (table: string) => {
    const filters: Array<{ col: string; val: unknown; op: 'eq' | 'in' }> = [];
    const rows =
      table === 'article_chunks'
        ? state.articleChunkRows
        : table === 'bot_knowledge_chunks'
          ? state.botKnowledgeRows
          : [];
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = (col: string, val: unknown) => {
      filters.push({ col, val, op: 'eq' });
      return builder;
    };
    builder.in = (col: string, val: unknown[]) => {
      filters.push({ col, val, op: 'in' });
      return builder;
    };
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: filterTableRows(rows as Record<string, unknown>[], filters), error: null });
    return builder;
  };

  return {
    from: fromTable,
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      if (fn === 'fn_hybrid_search_chunks') {
        const q = String(args.p_query_text || '').toLowerCase();
        if (state.weakPrimaryOnFirstPass) {
          // Relaxed corrective retry strips punctuation and blends content terms ('fast' without '?')
          if (q.includes('fast') && !q.includes('?')) {
            return Promise.resolve({ data: state.articleChunks, error: null });
          }
          return Promise.resolve({
            data: state.articleChunks.map((c) => ({
              ...c,
              similarity: 0.12,
              keyword_score: 0.05,
              combined_score: 0.11,
            })),
            error: null,
          });
        }
        return Promise.resolve({ data: state.articleChunks, error: null });
      }
      if (fn === 'fn_hybrid_search_bot_knowledge') {
        return Promise.resolve({ data: state.botKnowledgeChunks, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    },
  };
}

vi.mock('@/lib/pg/service', () => ({
  serviceClient: () => fakeSupabase(),
  hasServiceRole: () => true,
}));

vi.mock('@/lib/ai/platform-gateway', () => ({
  getPlatformAiConfigServerOnly: vi.fn(async () => null),
}));

vi.mock('@/lib/ai/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/provider')>();
  return {
    ...actual,
    isConfigured: (cfg?: { apiKey?: string | null } | null) => Boolean(cfg?.apiKey),
    chat: vi.fn(async (_cfg: unknown, req: { system: string; messages: { content: string }[] }) => {
      const lastMsg = req.messages[req.messages.length - 1]?.content || '';
      if (state.chatImpl) {
        const res = await state.chatImpl(lastMsg, req.system);
        return { text: res.text, provider: 'openai', model: 'mock-gpt' };
      }
      if (/retrieval relevance judge/i.test(req.system)) {
        return { text: '[{"index":0,"score":0.18},{"index":1,"score":0.95}]', provider: 'openai', model: 'mock-gpt' };
      }
      if (/hypothetical|Help Center excerpt/i.test(req.system)) {
        return {
          text: 'To complete identity KYC verification, upload a valid government photo ID and selfie under Account Verification.',
          provider: 'openai',
          model: 'mock-gpt',
        };
      }
      return { text: '["identity KYC verification upload ID"]', provider: 'openai', model: 'mock-gpt' };
    }),
  };
});

import { normalizeAgentRagConfig, resolveEffectiveRagOptions } from '@/lib/ai/agent-templates';
import { buildHydePassage, rerankRetrievedChunks } from '@/lib/ai/reranker';
import { buildSemanticModelContext, expandAdjacentChunks } from '@/lib/ai/semantic-retrieval';

function makeChunk(overrides: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    id: 'chunk-1',
    article_id: 'art-1',
    chunk_index: 1,
    article_title: 'General Policy',
    section_name: 'Billing',
    article_slug: 'general-policy',
    content: 'Article: General Policy\nSection: Billing\n\nStandard support policy.',
    similarity: 0.62,
    keyword_score: 0.35,
    combined_score: 0.56,
    source: 'article',
    ...overrides,
  };
}

describe('Part 5: Advanced RAG (HyDE, Reranker, Parent-Child, Corrective Gate)', () => {
  beforeEach(() => {
    state.rpcCalls = [];
    state.articleChunks = [];
    state.articleChunkRows = [];
    state.botKnowledgeChunks = [];
    state.botKnowledgeRows = [];
    state.weakPrimaryOnFirstPass = false;
    state.chatImpl = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes('/embeddings')) {
          const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
          const inputs = Array.isArray(parsedBody.input) ? parsedBody.input : [parsedBody.input || 'q'];
          const vec = Array.from({ length: 768 }, (_, idx) => (idx === 0 ? 0.9 : 0.01));
          return new Response(
            JSON.stringify({ data: inputs.map((_: unknown, index: number) => ({ index, embedding: vec })) }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves effective Advanced RAG sub-flags cleanly without altering standard defaults', () => {
    expect(normalizeAgentRagConfig({ mode: 'advanced', topK: 8, rerank: true })).toEqual({
      mode: 'advanced',
      topK: 8,
      rerank: true,
      minScore: 0.25,
      citations: true,
    });

    expect(resolveEffectiveRagOptions({ mode: 'standard' })).toMatchObject({
      mode: 'standard',
      rerank: false,
      hyde: false,
      parentChild: false,
      correctiveFallback: false,
    });

    expect(resolveEffectiveRagOptions({ mode: 'advanced' })).toMatchObject({
      mode: 'advanced',
      rerank: true,
      hyde: true,
      parentChild: true,
      correctiveFallback: true,
    });

    expect(
      resolveEffectiveRagOptions({ mode: 'advanced', hyde: false, parentChild: true, rerank: false }),
    ).toMatchObject({
      mode: 'advanced',
      rerank: false,
      hyde: false,
      parentChild: true,
      correctiveFallback: true,
    });
  });

  it('reranks chunks via deterministic lexical+vector scoring offline and via LLM scores when configured', async () => {
    const chunks = [
      makeChunk({
        id: 'c-generic',
        article_id: 'art-generic',
        article_title: 'General Newsletter FAQ',
        content: 'Sign up for weekly company updates and changelog alerts.',
        similarity: 0.58,
        combined_score: 0.54,
      }),
      makeChunk({
        id: 'c-refund',
        article_id: 'art-refund',
        article_title: 'Refund Policy & Window',
        content: 'Customers can request a full refund within 14 days via Billing Settings.',
        similarity: 0.55,
        combined_score: 0.51,
      }),
    ];

    const offline = await rerankRetrievedChunks({
      query: 'How many days for billing refund request?',
      chunks,
      topK: 2,
      providerConfig: null,
    });
    expect(offline.reranked).toBe(true);
    expect(offline.usedLlm).toBe(false);
    expect(offline.chunks[0].id).toBe('c-refund');

    const online = await rerankRetrievedChunks({
      query: 'refund window',
      chunks,
      topK: 2,
      providerConfig: { provider: 'openai', apiKey: 'sk-test-123' },
    });
    expect(online.reranked).toBe(true);
    expect(online.usedLlm).toBe(true);
    expect(online.chunks[0].id).toBe('c-refund');
  });

  it('generates HyDE passages when configured and degrades gracefully when unconfigured', async () => {
    const empty = await buildHydePassage({ question: 'How do I verify KYC?', providerConfig: null });
    expect(empty).toBeNull();

    const hyde = await buildHydePassage({
      question: 'How do I verify KYC?',
      providerConfig: { provider: 'openai', apiKey: 'sk-test-123' },
    });
    expect(hyde).toContain('KYC verification');
  });

  it('stitches adjacent neighbor chunks without duplicating article headers or leaking Bot Knowledge', async () => {
    state.articleChunkRows = [
      {
        workspace_id: WS_ID,
        article_id: 'art-1',
        chunk_index: 0,
        content: 'Article: Payout Tiers\nSection: Finance\n\nTier 1 allows $1,000 daily payout.',
      },
      {
        workspace_id: WS_ID,
        article_id: 'art-1',
        chunk_index: 2,
        content: 'Article: Payout Tiers\nSection: Finance\n\nTier 3 unlocks instant wire transfers.',
      },
    ];
    state.botKnowledgeRows = [
      {
        workspace_id: WS_ID,
        knowledge_id: 'kb-1',
        chunk_index: 0,
        content: 'Secret internal margin rule.',
      },
    ];

    const expanded = await expandAdjacentChunks({
      workspaceId: WS_ID,
      includeBotKnowledge: false,
      chunks: [
        makeChunk({
          id: 'c-1',
          article_id: 'art-1',
          chunk_index: 1,
          content: 'Article: Payout Tiers\nSection: Finance\n\nTier 2 raises daily limit to $5,000.',
        }),
        makeChunk({
          id: 'c-kb',
          article_id: 'kb-1',
          chunk_index: 1,
          source: 'knowledge',
          content: 'Internal VIP note.',
        }),
      ],
    });

    expect(expanded.expandedCount).toBe(1);
    expect(expanded.chunks[0].content).toContain('[Previous section]');
    expect(expanded.chunks[0].content).toContain('Tier 1 allows $1,000 daily payout.');
    expect(expanded.chunks[0].content).toContain('[Continuation]');
    expect(expanded.chunks[0].content).toContain('Tier 3 unlocks instant wire transfers.');
    expect(expanded.chunks[1].content).not.toContain('Secret internal margin rule.');
  });

  it('executes full Advanced RAG pipeline with wider candidate pool, Corrective retry, Reranker, and Parent expansion', async () => {
    state.weakPrimaryOnFirstPass = true;
    state.articleChunks = [
      makeChunk({
        id: 'art-kyc-0',
        article_id: 'art-kyc',
        chunk_index: 1,
        article_title: 'KYC Identity Verification',
        section_name: 'Compliance',
        content:
          'Article: KYC Identity Verification\nSection: Compliance\n\nUpload a passport and selfie for KYC review.',
        similarity: 0.71,
        keyword_score: 0.45,
        combined_score: 0.68,
      }),
    ];
    state.articleChunkRows = [
      {
        workspace_id: WS_ID,
        article_id: 'art-kyc',
        chunk_index: 0,
        content:
          'Article: KYC Identity Verification\nSection: Compliance\n\nBefore trading live, KYC must be approved.',
      },
    ];

    const ctx = await buildSemanticModelContext({
      workspaceId: WS_ID,
      visitorMessage: 'kyc??? need help fast!!',
      limit: 4,
      providerConfig: { provider: 'openai', apiKey: 'sk-test-123' },
      ragConfig: {
        mode: 'advanced',
        topK: 4,
        rerank: true,
        hyde: true,
        parentChild: true,
        correctiveFallback: true,
      },
    });

    expect(ctx.belowThreshold).toBe(false);
    expect(ctx.ragTrace.mode).toBe('advanced');
    expect(ctx.ragTrace.hydeUsed).toBe(true);
    expect(ctx.ragTrace.correctiveRetried).toBe(true);
    expect(ctx.ragTrace.parentExpanded).toBe(true);
    expect(ctx.text).toContain('Before trading live, KYC must be approved.');

    const chunkCallLimits = state.rpcCalls
      .filter((c) => c.fn === 'fn_hybrid_search_chunks')
      .map((c) => Number(c.args.p_limit || 0));
    expect(Math.max(...chunkCallLimits)).toBeGreaterThanOrEqual(15);
  });
});
