import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AiGatewayProvider } from './providers/ai-gateway.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { MockFallbackProvider } from './providers/mock-fallback.provider';
import { HybridRetrievalService } from './retrieval/hybrid-retrieval.service';

describe('AI Gateway Multi-Provider & Hybrid Vector+FTS RAG', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.TOGETHER_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.VLLM_BASE_URL;
    delete process.env.CUSTOM_LLM_BASE_URL;
    delete process.env.ALLOW_LOCAL_LLM_URLS;
    delete process.env.ALLOW_MOCK_AI;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeGateway(mockDb?: any) {
    const config: any = { get: vi.fn((k: string) => (k === 'nodeEnv' ? process.env.NODE_ENV : undefined)) };
    return new AiGatewayProvider(
      config,
      new OpenAiProvider(config),
      new AnthropicProvider(config),
      new GeminiProvider(config),
      new OpenAiCompatibleProvider(),
      new MockFallbackProvider(),
      mockDb,
    );
  }

  it('routes to Gemini using x-goog-api-key header (never query string)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Hello from Gemini' }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      }),
    });
    global.fetch = fetchMock as any;

    const gateway = makeGateway();
    const res = await gateway.generateCompletion({
      provider: 'gemini',
      apiKey: 'gm-secret-key',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(res.provider).toBe('gemini');
    expect(res.content).toBe('Hello from Gemini');
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).not.toContain('key=');
    expect(calledInit.headers['x-goog-api-key']).toBe('gm-secret-key');
  });

  it('falls back to secondary provider when primary returns 503', async () => {
    process.env.DEEPSEEK_API_KEY = 'ds-key';
    process.env.GROQ_API_KEY = 'gq-key';

    const fetchMock = vi.fn(async (url: any) => {
      if (String(url).includes('deepseek.com')) {
        return { ok: false, status: 503, text: async () => 'Service Unavailable' } as any;
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Handled by Groq fallback' } }],
          usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        }),
      } as any;
    });
    global.fetch = fetchMock as any;

    const gateway = makeGateway();
    const res = await gateway.generateCompletion({
      provider: 'deepseek',
      messages: [{ role: 'user', content: 'Need help' }],
    });

    expect(res.provider).toBe('groq');
    expect(res.content).toBe('Handled by Groq fallback');
  });

  it('blocks private/loopback compatible base URLs when ALLOW_LOCAL_LLM_URLS is unset', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    process.env.NODE_ENV = 'production';

    const gateway = makeGateway();
    await expect(
      gateway.generateCompletion({
        provider: 'compatible',
        baseUrl: 'http://127.0.0.1:11434/v1',
        messages: [{ role: 'user', content: 'Test' }],
      }),
    ).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks MockFallbackProvider in production when no live AI provider is configured', async () => {
    process.env.NODE_ENV = 'production';
    const gateway = makeGateway();

    await expect(
      gateway.generateCompletion({ messages: [{ role: 'user', content: 'Hello' }] }),
    ).rejects.toThrow(/No AI provider succeeded/);
  });

  it('combines pgvector HNSW similarity and FTS via Reciprocal Rank Fusion scoped to workspace_id', async () => {
    const vector768 = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
    const mockDb: any = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { chunk_id: 'c-vec', knowledge_id: 'k-1', title: 'Refunds', content: '30 day guarantee', sim: 0.91 },
            { chunk_id: 'c-both', knowledge_id: 'k-2', title: 'Billing', content: 'Invoice portal', sim: 0.85 },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { chunk_id: 'c-both', knowledge_id: 'k-2', title: 'Billing', content: 'Invoice portal', rank: 0.95 },
            { chunk_id: 'c-fts', knowledge_id: 'k-3', title: 'Plans', content: 'Monthly plans', rank: 0.7 },
          ],
        }),
    };

    const retrieval = new HybridRetrievalService(mockDb);
    const chunks = await retrieval.retrieveChunks('ws-1', 'billing invoice guarantee', vector768, 3);

    expect(chunks[0].chunkId).toBe('c-both');
    expect(mockDb.query.mock.calls[0][1][0]).toBe('ws-1');
    expect(mockDb.query.mock.calls[1][1][1]).toBe('ws-1');
  });
});

