"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const queues_service_1 = require("./queues.service");
const webhooks_processor_1 = require("./processors/webhooks.processor");
const knowledge_indexing_processor_1 = require("./processors/knowledge-indexing.processor");
const queue_constants_1 = require("./queue.constants");
(0, vitest_1.describe)('8-Queue Architecture, Idempotency, Webhooks SSRF & DLQ', () => {
    const originalFetch = global.fetch;
    (0, vitest_1.afterEach)(() => {
        global.fetch = originalFetch;
        vitest_1.vi.restoreAllMocks();
    });
    function makeQueue() {
        return {
            add: vitest_1.vi.fn().mockResolvedValue({ id: 'job-1' }),
            getJobCounts: vitest_1.vi.fn().mockResolvedValue({ active: 0, waiting: 0 }),
        };
    }
    (0, vitest_1.it)('registers and exposes metrics across all 8 queues and forwards idempotencyKey as jobId', async () => {
        const qAi = makeQueue();
        const qNotif = makeQueue();
        const qAuto = makeQueue();
        const qHook = makeQueue();
        const qMsg = makeQueue();
        const qEmail = makeQueue();
        const qKb = makeQueue();
        const qAnalytics = makeQueue();
        const mockDb = { query: vitest_1.vi.fn().mockResolvedValue({ rows: [] }) };
        const service = new queues_service_1.QueuesService(qAi, qNotif, qAuto, qHook, qMsg, qEmail, qKb, qAnalytics, mockDb);
        await service.enqueueMessageDelivery({
            workspaceId: 'ws-1',
            conversationId: 'conv-1',
            idempotencyKey: 'msg-dedup-1',
        });
        (0, vitest_1.expect)(qMsg.add).toHaveBeenCalledWith('relay_outbox', vitest_1.expect.any(Object), vitest_1.expect.objectContaining({ jobId: 'msg-dedup-1' }));
        await service.enqueueKnowledgeIndexing({
            workspaceId: 'ws-1',
            knowledgeId: 'kb-1',
            action: 'reindex_document',
            idempotencyKey: 'kb-dedup-1',
        });
        (0, vitest_1.expect)(qKb.add).toHaveBeenCalledWith('reindex_document', vitest_1.expect.any(Object), vitest_1.expect.objectContaining({ jobId: 'kb-dedup-1' }));
        const metrics = await service.getQueueMetrics();
        (0, vitest_1.expect)(Object.keys(metrics).sort()).toEqual([
            queue_constants_1.QUEUE_AI_PROCESSING,
            queue_constants_1.QUEUE_ANALYTICS,
            queue_constants_1.QUEUE_AUTOMATIONS,
            queue_constants_1.QUEUE_EMAIL_PROCESSING,
            queue_constants_1.QUEUE_KNOWLEDGE_INDEXING,
            queue_constants_1.QUEUE_MESSAGE_DELIVERY,
            queue_constants_1.QUEUE_NOTIFICATIONS,
            queue_constants_1.QUEUE_WEBHOOKS,
        ].sort());
    });
    (0, vitest_1.it)('blocks private metadata / localhost URLs in WebhooksProcessor (SSRF)', async () => {
        const fetchMock = vitest_1.vi.fn();
        global.fetch = fetchMock;
        const processor = new webhooks_processor_1.WebhooksProcessor();
        await (0, vitest_1.expect)(processor.process({
            id: 'w-1',
            data: {
                workspaceId: 'ws-1',
                endpointUrl: 'https://169.254.169.254/latest/meta-data',
                event: 'message.created',
                payload: {},
            },
        })).rejects.toThrow(/private/i);
        (0, vitest_1.expect)(fetchMock).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('records dead-letter job when retries are exhausted', async () => {
        const mockDb = { query: vitest_1.vi.fn().mockResolvedValue({ rows: [] }) };
        const service = new queues_service_1.QueuesService(makeQueue(), makeQueue(), makeQueue(), makeQueue(), undefined, undefined, undefined, undefined, mockDb);
        const processor = new webhooks_processor_1.WebhooksProcessor(service);
        await processor.onFailed({
            id: 'w-fail-1',
            queueName: queue_constants_1.QUEUE_WEBHOOKS,
            name: 'message.created',
            attemptsMade: 5,
            opts: { attempts: 5 },
            data: { workspaceId: 'ws-1', endpointUrl: 'https://example.com/hook' },
        }, new Error('Target returned 500'));
        (0, vitest_1.expect)(mockDb.query).toHaveBeenCalledWith(vitest_1.expect.stringContaining('INSERT INTO public.dead_letter_jobs'), vitest_1.expect.arrayContaining([queue_constants_1.QUEUE_WEBHOOKS, 'w-fail-1', 'message.created', 'ws-1']));
    });
    (0, vitest_1.it)('indexes knowledge base chunks with 768-dim embeddings via fn_store_bot_knowledge_chunks', async () => {
        const mockDb = {
            query: vitest_1.vi
                .fn()
                .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'kb-1',
                        workspace_id: 'ws-1',
                        title: 'Shipping Policy',
                        content: 'Orders ship within 24 hours worldwide.',
                        content_version: 3,
                    },
                ],
            })
                .mockResolvedValueOnce({ rows: [{ stored: true }] }),
        };
        const mockLlm = {
            providerName: 'gemini',
            generateCompletion: vitest_1.vi.fn(),
            generateEmbeddings: vitest_1.vi.fn().mockResolvedValue([Array(768).fill(0.01)]),
        };
        const processor = new knowledge_indexing_processor_1.KnowledgeIndexingProcessor(mockDb, mockLlm);
        const res = await processor.process({
            id: 'kb-job-1',
            data: {
                workspaceId: 'ws-1',
                knowledgeId: 'kb-1',
                action: 'reindex_document',
            },
        });
        (0, vitest_1.expect)(res.indexed).toBe(true);
        (0, vitest_1.expect)(mockDb.query).toHaveBeenNthCalledWith(2, vitest_1.expect.stringContaining('fn_store_bot_knowledge_chunks'), ['kb-1', 3, vitest_1.expect.stringContaining('"chunk_index":0'), null]);
    });
});
//# sourceMappingURL=queues-workers.spec.js.map