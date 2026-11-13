"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ai_gateway_provider_1 = require("./providers/ai-gateway.provider");
const openai_provider_1 = require("./providers/openai.provider");
const anthropic_provider_1 = require("./providers/anthropic.provider");
const gemini_provider_1 = require("./providers/gemini.provider");
const openai_compatible_provider_1 = require("./providers/openai-compatible.provider");
const mock_fallback_provider_1 = require("./providers/mock-fallback.provider");
const hybrid_retrieval_service_1 = require("./retrieval/hybrid-retrieval.service");
(0, vitest_1.describe)('AI Gateway Multi-Provider & Hybrid Vector+FTS RAG', () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;
    (0, vitest_1.beforeEach)(() => {
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
    (0, vitest_1.afterEach)(() => {
        process.env = originalEnv;
        global.fetch = originalFetch;
        vitest_1.vi.restoreAllMocks();
    });
    function makeGateway(mockDb) {
        const config = { get: vitest_1.vi.fn((k) => (k === 'nodeEnv' ? process.env.NODE_ENV : undefined)) };
        return new ai_gateway_provider_1.AiGatewayProvider(config, new openai_provider_1.OpenAiProvider(config), new anthropic_provider_1.AnthropicProvider(config), new gemini_provider_1.GeminiProvider(config), new openai_compatible_provider_1.OpenAiCompatibleProvider(), new mock_fallback_provider_1.MockFallbackProvider(), mockDb);
    }
    (0, vitest_1.it)('routes to Gemini using x-goog-api-key header (never query string)', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                candidates: [{ content: { parts: [{ text: 'Hello from Gemini' }] } }],
                usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
            }),
        });
        global.fetch = fetchMock;
        const gateway = makeGateway();
        const res = await gateway.generateCompletion({
            provider: 'gemini',
            apiKey: 'gm-secret-key',
            messages: [{ role: 'user', content: 'Hi' }],
        });
        (0, vitest_1.expect)(res.provider).toBe('gemini');
        (0, vitest_1.expect)(res.content).toBe('Hello from Gemini');
        const [calledUrl, calledInit] = fetchMock.mock.calls[0];
        (0, vitest_1.expect)(String(calledUrl)).not.toContain('key=');
        (0, vitest_1.expect)(calledInit.headers['x-goog-api-key']).toBe('gm-secret-key');
    });
    (0, vitest_1.it)('falls back to secondary provider when primary returns 503', async () => {
        process.env.DEEPSEEK_API_KEY = 'ds-key';
        process.env.GROQ_API_KEY = 'gq-key';
        const fetchMock = vitest_1.vi.fn(async (url) => {
            if (String(url).includes('deepseek.com')) {
                return { ok: false, status: 503, text: async () => 'Service Unavailable' };
            }
            return {
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Handled by Groq fallback' } }],
                    usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
                }),
            };
        });
        global.fetch = fetchMock;
        const gateway = makeGateway();
        const res = await gateway.generateCompletion({
            provider: 'deepseek',
            messages: [{ role: 'user', content: 'Need help' }],
        });
        (0, vitest_1.expect)(res.provider).toBe('groq');
        (0, vitest_1.expect)(res.content).toBe('Handled by Groq fallback');
    });
    (0, vitest_1.it)('blocks private/loopback compatible base URLs when ALLOW_LOCAL_LLM_URLS is unset', async () => {
        const fetchMock = vitest_1.vi.fn();
        global.fetch = fetchMock;
        process.env.NODE_ENV = 'production';
        const gateway = makeGateway();
        await (0, vitest_1.expect)(gateway.generateCompletion({
            provider: 'compatible',
            baseUrl: 'http://127.0.0.1:11434/v1',
            messages: [{ role: 'user', content: 'Test' }],
        })).rejects.toThrow();
        (0, vitest_1.expect)(fetchMock).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('blocks MockFallbackProvider in production when no live AI provider is configured', async () => {
        process.env.NODE_ENV = 'production';
        const gateway = makeGateway();
        await (0, vitest_1.expect)(gateway.generateCompletion({ messages: [{ role: 'user', content: 'Hello' }] })).rejects.toThrow(/No AI provider succeeded/);
    });
    (0, vitest_1.it)('combines pgvector HNSW similarity and FTS via Reciprocal Rank Fusion scoped to workspace_id', async () => {
        const vector768 = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
        const mockDb = {
            query: vitest_1.vi
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
        const retrieval = new hybrid_retrieval_service_1.HybridRetrievalService(mockDb);
        const chunks = await retrieval.retrieveChunks('ws-1', 'billing invoice guarantee', vector768, 3);
        (0, vitest_1.expect)(chunks[0].chunkId).toBe('c-both');
        (0, vitest_1.expect)(mockDb.query.mock.calls[0][1][0]).toBe('ws-1');
        (0, vitest_1.expect)(mockDb.query.mock.calls[1][1][1]).toBe('ws-1');
    });
});
//# sourceMappingURL=ai-gateway.spec.js.map