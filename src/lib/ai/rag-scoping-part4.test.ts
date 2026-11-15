import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RetrievedChunk } from '@/types/database';

const WS_ID = 'ws-part4-scoping';

const dbState = vi.hoisted(() => ({
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  articleChunks: [] as RetrievedChunk[],
  botKnowledgeChunks: [] as Array<Record<string, unknown>>,
  tables: {
    help_sections: [] as Array<{ id: string; name: string }>,
    articles: [] as Array<{
      id: string;
      title: string;
      slug: string | null;
      summary: string | null;
      content: string;
      category: string | null;
      section_id: string | null;
    }>,
    bot_knowledge: [] as Array<{ id: string; title: string; content: string | null }>,
    notes: [] as Array<{ id: string; title: string; content: string | null; tags?: string[] }>,
  },
}));

function fakeSupabase() {
  const query = (rows: unknown[]) => {
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'or', 'filter', 'upsert']) {
      builder[m] = () => builder;
    }
    builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    builder.single = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
    return builder;
  };
  return {
    from: (table: string) => query((dbState.tables as Record<string, unknown[]>)[table] ?? []),
    rpc: (fn: string, args: Record<string, unknown>) => {
      dbState.rpcCalls.push({ fn, args });
      if (fn === 'fn_assistant_notes') {
        return Promise.resolve({ data: dbState.tables.notes, error: null });
      }
      if (fn === 'fn_hybrid_search_chunks') {
        const sectionFilter = args.p_section_ids as string[] | undefined;
        let rows = dbState.articleChunks;
        if (Array.isArray(sectionFilter)) {
          if (sectionFilter.length === 0) {
            rows = [];
          } else {
            rows = rows.filter((c) => {
              const art = dbState.tables.articles.find((a) => a.id === c.article_id);
              return Boolean(art?.section_id && sectionFilter.includes(art.section_id));
            });
          }
        }
        return Promise.resolve({ data: rows, error: null });
      }
      if (fn === 'fn_hybrid_search_bot_knowledge') {
        return Promise.resolve({ data: dbState.botKnowledgeChunks, error: null });
      }
      return Promise.resolve({ data: null, error: null });
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

import {
  isRestrictedKnowledgeScope,
  matchesKnowledgeScope,
  normalizeAgentRagConfig,
  normalizeEngineType,
} from '@/lib/ai/agent-templates';
import {
  buildSemanticModelContext,
  hybridSearchWorkspaceChunks,
} from '@/lib/ai/semantic-retrieval';
import {
  buildModelContext,
  invalidateHelpIndex,
  loadFullKnowledge,
} from '@/lib/ai/help-answer';

describe('Part 4: Standard RAG collection scoping & config normalizers', () => {
  beforeEach(() => {
    dbState.rpcCalls = [];
    dbState.articleChunks = [];
    dbState.botKnowledgeChunks = [];
    dbState.tables.help_sections = [
      { id: 'sec-billing', name: 'Billing' },
      { id: 'sec-tech', name: 'Technical' },
    ];
    dbState.tables.articles = [
      {
        id: 'art-refund',
        title: 'Refund & Payout Rules',
        slug: 'refund-payout-rules',
        summary: 'Billing refunds take 5 business days.',
        content: 'Billing refunds are processed within 5 business days to the original payment card.',
        category: 'Billing',
        section_id: 'sec-billing',
      },
      {
        id: 'art-webhook',
        title: 'Webhook Setup Guide',
        slug: 'webhook-setup',
        summary: 'How to connect workspace webhooks.',
        content: 'Configure HTTPS webhook endpoints inside Developer Settings with HMAC verification.',
        category: 'Technical',
        section_id: 'sec-tech',
      },
      {
        id: 'art-unassigned',
        title: 'Orphan Unassigned Note Article',
        slug: 'orphan-note',
        summary: null,
        content: 'Internal legacy release schedule details.',
        category: null,
        section_id: null,
      },
    ];
    dbState.tables.bot_knowledge = [
      {
        id: 'bk-1',
        title: 'VIP Discount Override',
        content: 'VIP refunds may include a secret 20% credit voucher.',
      },
    ];
    dbState.tables.notes = [];
    invalidateHelpIndex(WS_ID);
  });

  it('normalizes engine types, ragConfig bounds, and detects restricted knowledge scopes', () => {
    expect(normalizeEngineType('langgraph')).toBe('langgraph');
    expect(normalizeEngineType('adk')).toBe('adk');
    expect(normalizeEngineType('hybrid')).toBe('hybrid');
    expect(normalizeEngineType('unknown-value')).toBe('builtin');

    expect(normalizeAgentRagConfig()).toEqual({
      mode: 'standard',
      topK: 6,
      rerank: false,
      minScore: 0.25,
      citations: true,
    });
    expect(
      normalizeAgentRagConfig({ mode: 'advanced', topK: 99, minScore: 0.99, rerank: true, citations: false }),
    ).toEqual({
      mode: 'advanced',
      topK: 20,
      rerank: true,
      minScore: 0.95,
      citations: false,
    });

    expect(isRestrictedKnowledgeScope(null)).toBe(false);
    expect(isRestrictedKnowledgeScope({ allArticles: true, sectionIds: [], includeBotKnowledge: true })).toBe(false);
    expect(isRestrictedKnowledgeScope({ allArticles: false, sectionIds: ['sec-tech'], includeBotKnowledge: true })).toBe(
      true,
    );
    expect(isRestrictedKnowledgeScope({ allArticles: true, sectionIds: [], includeBotKnowledge: false })).toBe(true);

    expect(
      matchesKnowledgeScope(
        { id: 'art-refund', section_id: 'sec-billing' },
        { allArticles: false, sectionIds: ['sec-tech'], includeBotKnowledge: true },
      ),
    ).toBe(false);
    expect(
      matchesKnowledgeScope(
        { id: 'art-unassigned', section_id: null },
        { allArticles: false, sectionIds: ['sec-tech'], includeBotKnowledge: true },
      ),
    ).toBe(false);
    expect(
      matchesKnowledgeScope(
        { id: 'art-webhook', section_id: 'sec-tech' },
        { allArticles: false, sectionIds: ['sec-tech'], includeBotKnowledge: true },
      ),
    ).toBe(true);
    expect(
      matchesKnowledgeScope(
        { id: 'knowledge:bk-1', section_id: null },
        { allArticles: true, sectionIds: [], includeBotKnowledge: false },
      ),
    ).toBe(false);
  });

  it('forwards p_section_ids to fn_hybrid_search_chunks and short-circuits empty restricted section lists', async () => {
    dbState.articleChunks = [
      {
        id: 'chunk-b',
        article_id: 'art-refund',
        article_title: 'Refund & Payout Rules',
        section_name: 'Billing',
        article_slug: 'refund-payout-rules',
        chunk_index: 0,
        content: 'Billing refunds are processed within 5 business days.',
        similarity: 0.86,
        keyword_score: 0.9,
        combined_score: 0.87,
      },
      {
        id: 'chunk-t',
        article_id: 'art-webhook',
        article_title: 'Webhook Setup Guide',
        section_name: 'Technical',
        article_slug: 'webhook-setup',
        chunk_index: 0,
        content: 'Configure HTTPS webhook endpoints.',
        similarity: 0.84,
        keyword_score: 0.8,
        combined_score: 0.82,
      },
    ];

    // 1. Null sectionIds preserves 4-arg RPC shape (backward compatibility)
    const allHits = await hybridSearchWorkspaceChunks({
      workspaceId: WS_ID,
      queryText: 'refund',
      limit: 6,
      sectionIds: null,
    });
    expect(allHits).toHaveLength(2);
    expect(dbState.rpcCalls[0]?.args).not.toHaveProperty('p_section_ids');

    // 2. Empty sectionIds array short-circuits cleanly with ZERO RPC calls
    dbState.rpcCalls = [];
    const emptyHits = await hybridSearchWorkspaceChunks({
      workspaceId: WS_ID,
      queryText: 'refund',
      sectionIds: [],
    });
    expect(emptyHits).toEqual([]);
    expect(dbState.rpcCalls).toHaveLength(0);

    // 3. Section-restricted call forwards p_section_ids & filters chunks
    const techOnlyHits = await hybridSearchWorkspaceChunks({
      workspaceId: WS_ID,
      queryText: 'webhook',
      limit: 4,
      sectionIds: ['sec-tech'],
    });
    expect(dbState.rpcCalls[0]?.args.p_section_ids).toEqual(['sec-tech']);
    expect(techOnlyHits.map((c) => c.article_id)).toEqual(['art-webhook']);
  });

  it('excludes Bot knowledge RPC and out-of-scope sections in buildSemanticModelContext & enforces minScore', async () => {
    dbState.articleChunks = [
      {
        id: 'chunk-t',
        article_id: 'art-webhook',
        article_title: 'Webhook Setup Guide',
        section_name: 'Technical',
        article_slug: 'webhook-setup',
        chunk_index: 0,
        content: 'Configure HTTPS webhook endpoints.',
        similarity: 0.52,
        keyword_score: 0.4,
        combined_score: 0.48,
      },
    ];
    dbState.botKnowledgeChunks = [
      {
        id: 'bk-c-1',
        knowledge_id: 'bk-1',
        title: 'VIP Discount Override',
        chunk_index: 0,
        content: 'VIP refunds may include a secret 20% credit voucher.',
        similarity: 0.91,
        keyword_score: 1.0,
        combined_score: 0.94,
      },
    ];

    const resScoped = await buildSemanticModelContext({
      workspaceId: WS_ID,
      visitorMessage: 'webhook HMAC setup',
      messageEmbedding: [0.1, 0.2],
      knowledgeScope: { allArticles: false, sectionIds: ['sec-tech'], includeBotKnowledge: false },
    });

    expect(resScoped.belowThreshold).toBe(false);
    expect(resScoped.used.map((u) => u.id)).toEqual(['art-webhook']);
    expect(dbState.rpcCalls.some((c) => c.fn === 'fn_hybrid_search_bot_knowledge')).toBe(false);
    expect(dbState.rpcCalls.every((c) => c.args.p_section_ids !== undefined)).toBe(true);

    // Tighter per-agent minScore filters out 0.52/0.48 match
    const resBelow = await buildSemanticModelContext({
      workspaceId: WS_ID,
      visitorMessage: 'webhook HMAC setup',
      messageEmbedding: [0.1, 0.2],
      knowledgeScope: { allArticles: false, sectionIds: ['sec-tech'], includeBotKnowledge: false },
      minScore: 0.65,
    });
    expect(resBelow.belowThreshold).toBe(true);
    expect(resBelow.chunks).toEqual([]);

    // Completely disabled knowledge sources short-circuits without any RPC calls
    dbState.rpcCalls = [];
    const resNone = await buildSemanticModelContext({
      workspaceId: WS_ID,
      visitorMessage: 'webhook HMAC setup',
      knowledgeScope: { allArticles: false, sectionIds: [], includeBotKnowledge: false },
    });
    expect(resNone.belowThreshold).toBe(true);
    expect(dbState.rpcCalls).toHaveLength(0);
  });

  it('scopes loadFullKnowledge and BM25 keyword fallback inside buildModelContext with zero fallback leaks', async () => {
    // No pgvector chunks so buildModelContext falls back to keyword index
    dbState.articleChunks = [];
    dbState.botKnowledgeChunks = [];

    // 1. Billing question under Tech-only agent must NOT fall back to Billing article or Bot Knowledge
    const techCtx = await buildModelContext(WS_ID, 'How many business days do billing refunds take?', {
      articlesOnly: true,
      knowledgeScope: { allArticles: false, sectionIds: ['sec-tech'], includeBotKnowledge: false },
    });
    expect(techCtx.belowThreshold).toBe(true);
    expect(techCtx.sources).toEqual([]);
    expect(techCtx.text).not.toContain('5 business days');

    // 2. Empty restricted collection must NEVER fall back to workspace articles
    const fullEmpty = await loadFullKnowledge(WS_ID, {
      knowledgeScope: { allArticles: false, sectionIds: [], includeBotKnowledge: false },
    });
    expect(fullEmpty.sources).toEqual([]);
    expect(fullEmpty.text).toBe('');

    // 3. Tech + BotKnowledge exclusion inside loadFullKnowledge includes ONLY sec-tech articles
    const fullTechOnly = await loadFullKnowledge(WS_ID, {
      knowledgeScope: { allArticles: false, sectionIds: ['sec-tech'], includeBotKnowledge: false },
    });
    expect(fullTechOnly.sources.map((s) => s.id)).toEqual(['art-webhook']);
    expect(fullTechOnly.text).toContain('Webhook Setup Guide');
    expect(fullTechOnly.text).not.toContain('Refund & Payout Rules');
    expect(fullTechOnly.text).not.toContain('VIP Discount Override');
  });
});
