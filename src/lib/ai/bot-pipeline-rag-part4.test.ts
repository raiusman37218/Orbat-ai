import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RetrievedChunk } from '@/types/database';

const WORKSPACE_ID = 'ws-pipeline-part4';
const HELP_URL = 'https://acme.help.example';

const testState = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  semanticChunks: [] as RetrievedChunk[],
  cacheLookupCalls: 0,
  cacheSaveCalls: 0,
  cachedHit: null as null | {
    answerText: string;
    sourceArticleIds: string[];
    citation: { id: string; title: string; slug: string | null; url: string | null; kind?: 'article' | 'knowledge' } | null;
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
    from: (table: string) => query(testState.tables[table] ?? []),
    rpc: (fn: string) => {
      if (fn === 'fn_assistant_notes') return Promise.resolve({ data: testState.tables.notes ?? [], error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
}

vi.mock('@/lib/pg/service', () => ({ serviceClient: () => fakeSupabase(), hasServiceRole: () => true }));

vi.mock('@/lib/ai/answer-cache', () => ({
  lookupBotAnswerCache: vi.fn(async () => {
    testState.cacheLookupCalls += 1;
    return testState.cachedHit;
  }),
  saveBotAnswerCache: vi.fn(async () => {
    testState.cacheSaveCalls += 1;
  }),
}));

vi.mock('@/lib/ai/semantic-retrieval', () => ({
  BOT_KNOWLEDGE_SECTION: 'Team knowledge',
  generateEmbeddings: vi.fn(async () => [[0.11, 0.22, 0.33]]),
  hybridSearchWorkspaceChunks: vi.fn(async ({ sectionIds }: { sectionIds?: string[] | null }) => {
    if (!Array.isArray(sectionIds)) return testState.semanticChunks;
    if (sectionIds.length === 0) return [];
    const articles = (testState.tables.articles || []) as Array<{ id: string; section_id: string | null }>;
    return testState.semanticChunks.filter((c) => {
      const a = articles.find((row) => row.id === c.article_id);
      return Boolean(a?.section_id && sectionIds.includes(a.section_id));
    });
  }),
  buildSemanticModelContext: vi.fn(
    async ({
      visitorMessage,
      knowledgeScope,
    }: {
      visitorMessage: string;
      knowledgeScope?: { allArticles?: boolean; sectionIds?: string[]; includeBotKnowledge?: boolean } | null;
    }) => {
      const articles = (testState.tables.articles || []) as Array<{ id: string; section_id: string | null }>;
      const scoped = testState.semanticChunks.filter((c) => {
        if (!knowledgeScope) return true;
        if (c.source === 'knowledge') return knowledgeScope.includeBotKnowledge !== false;
        if (knowledgeScope.allArticles !== false) return true;
        const art = articles.find((a) => a.id === c.article_id);
        return Boolean(art?.section_id && (knowledgeScope.sectionIds || []).includes(art.section_id));
      });
      if (!scoped.length) {
        return { text: '', used: [], rewrittenQuery: visitorMessage, queries: [visitorMessage], queryEmbedding: [0.11, 0.22, 0.33], chunks: [], belowThreshold: true };
      }
      return {
        text: scoped
          .map((c, i) => `[CHUNK ${i + 1}]\nArticle: ${c.article_title}\nSection: ${c.section_name}\n\n${c.content}`)
          .join('\n\n---\n\n'),
        used: scoped.map((c) => ({ id: c.article_id, title: c.article_title, source: (c.source ?? 'article') as 'article' | 'knowledge' })),
        rewrittenQuery: visitorMessage,
        queries: [visitorMessage],
        queryEmbedding: [0.11, 0.22, 0.33],
        chunks: scoped,
        belowThreshold: false,
      };
    },
  ),
}));

vi.mock('@/lib/ai/learning/policy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/learning/policy')>();
  return { ...actual, pickPolicyArm: async () => 'standard' };
});

vi.mock('@/lib/ai/platform-gateway', () => ({
  getPlatformAiConfigServerOnly: vi.fn(async () => ({
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: 'test-key',
  })),
  executePlatformAiReply: vi.fn(async ({ request }: { request: { system: string } }) => {
    // Echo grounded strict response or agent response based on the prompt contents we received
    if (request.system.includes('Refund Policy') || request.system.includes('Refunds take 5 days')) {
      return { ok: true, text: 'Refunds take 5 days. [SOURCE: 1]' };
    }
    return { ok: true, text: '[NOT_COVERED]' };
  }),
}));

vi.mock('@/lib/ai/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/provider')>();
  return { ...actual, chat: vi.fn(async () => ({ text: 'Refunds take 5 days. [SOURCE: 1]' })) };
});

import { generateHelpDeskResponseWithHandover } from '@/lib/ai/anthropic';
import { invalidateHelpIndex } from '@/lib/ai/help-answer';
import { executePlatformAiReply } from '@/lib/ai/platform-gateway';

describe('Part 4 end-to-end runtime scoping & cache isolation', () => {
  beforeEach(() => {
    testState.cacheLookupCalls = 0;
    testState.cacheSaveCalls = 0;
    testState.cachedHit = null;
    testState.semanticChunks = [
      {
        id: 'chk-refund',
        article_id: 'art-refund',
        article_title: 'Refund Policy',
        section_name: 'Billing',
        article_slug: 'refund-policy',
        chunk_index: 0,
        content: 'Refunds take 5 days after approval.',
        similarity: 0.92,
        keyword_score: 0.9,
        combined_score: 0.91,
      },
    ];
    testState.tables = {
      workspaces: [{ id: WORKSPACE_ID, plan: 'pro', status: 'active' }],
      help_sections: [
        { id: 'sec-billing', name: 'Billing' },
        { id: 'sec-tech', name: 'Technical' },
      ],
      articles: [
        {
          id: 'art-refund',
          title: 'Refund Policy',
          slug: 'refund-policy',
          summary: 'Refund timing.',
          content: 'Refunds take 5 days after approval.',
          category: 'Billing',
          section_id: 'sec-billing',
        },
        {
          id: 'art-api',
          title: 'API Keys Guide',
          slug: 'api-keys-guide',
          summary: 'How to rotate keys.',
          content: 'Rotate API keys in workspace settings.',
          category: 'Technical',
          section_id: 'sec-tech',
        },
      ],
      bot_knowledge: [],
      notes: [],
    };
    invalidateHelpIndex(WORKSPACE_ID);
    vi.clearAllMocks();
  });

  it('bypasses workspace answer cache when agent knowledgeScope is restricted to prevent cross-collection leaks', async () => {
    // Seed a cached answer from another collection in the workspace
    testState.cachedHit = {
      answerText: 'Cached Refund Policy answer',
      sourceArticleIds: ['art-refund'],
      citation: { id: 'art-refund', title: 'Refund Policy', slug: 'refund-policy', url: `${HELP_URL}/refund-policy` },
    };

    const res = await generateHelpDeskResponseWithHandover({
      workspaceId: WORKSPACE_ID,
      conversationId: 'conv-restricted',
      incomingMessage: 'How long do refunds take?',
      answerMode: 'strict',
      helpCenterUrl: HELP_URL,
      knowledgeScope: { allArticles: false, sectionIds: ['sec-tech'], includeBotKnowledge: false },
      ragConfig: { mode: 'standard', topK: 6, rerank: false, minScore: 0.25, citations: true },
    });

    expect(testState.cacheLookupCalls).toBe(0);
    expect(testState.cacheSaveCalls).toBe(0);
    expect(res.cached).toBeUndefined();
    expect(res.shouldHandover).toBe(true);
    expect(res.canAnswerFromDocs).toBe(false);
    expect(res.replyText).not.toContain('Cached Refund Policy');
  });

  it('prevents cross-collection disclosure in agent mode and honors ragConfig.citations = false in strict mode', async () => {
    // Agent mode scoped strictly to Technical cannot read Billing article
    const agentModeRestricted = await generateHelpDeskResponseWithHandover({
      workspaceId: WORKSPACE_ID,
      conversationId: 'conv-agent-restricted',
      incomingMessage: 'How long do refunds take?',
      answerMode: 'agent',
      helpCenterUrl: HELP_URL,
      knowledgeScope: { allArticles: false, sectionIds: ['sec-tech'], includeBotKnowledge: false },
    });

    expect(agentModeRestricted.shouldHandover).toBe(true);
    const seenSystems = vi
      .mocked(executePlatformAiReply)
      .mock.calls.map((c) => c[0]?.request?.system || '')
      .join('\n');
    expect(seenSystems).not.toContain('Refunds take 5 days');

    // Unrestricted strict mode uses cache AND hides citation footer when ragConfig.citations is false
    const noCitationsStrict = await generateHelpDeskResponseWithHandover({
      workspaceId: WORKSPACE_ID,
      conversationId: 'conv-no-cite',
      incomingMessage: 'How long do refunds take?',
      answerMode: 'strict',
      helpCenterUrl: HELP_URL,
      knowledgeScope: { allArticles: true, sectionIds: [], includeBotKnowledge: true },
      ragConfig: { mode: 'standard', topK: 6, rerank: false, minScore: 0.25, citations: false },
    });

    expect(testState.cacheLookupCalls).toBe(1);
    expect(testState.cacheSaveCalls).toBe(1);
    expect(noCitationsStrict.shouldHandover).toBe(false);
    expect(noCitationsStrict.citation).toBeNull();
    expect(noCitationsStrict.replyText).not.toContain('https://acme.help.example');
  });
});
