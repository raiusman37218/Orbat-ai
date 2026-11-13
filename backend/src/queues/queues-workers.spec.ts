import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueuesService } from './queues.service';
import { WebhooksProcessor } from './processors/webhooks.processor';
import { KnowledgeIndexingProcessor } from './processors/knowledge-indexing.processor';
import {
  QUEUE_AI_PROCESSING,
  QUEUE_MESSAGE_DELIVERY,
  QUEUE_EMAIL_PROCESSING,
  QUEUE_WEBHOOKS,
  QUEUE_AUTOMATIONS,
  QUEUE_KNOWLEDGE_INDEXING,
  QUEUE_NOTIFICATIONS,
  QUEUE_ANALYTICS,
} from './queue.constants';

describe('8-Queue Architecture, Idempotency, Webhooks SSRF & DLQ', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeQueue() {
    return {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
      getJobCounts: vi.fn().mockResolvedValue({ active: 0, waiting: 0 }),
    } as any;
  }

  it('registers and exposes metrics across all 8 queues and forwards idempotencyKey as jobId', async () => {
    const qAi = makeQueue();
    const qNotif = makeQueue();
    const qAuto = makeQueue();
    const qHook = makeQueue();
    const qMsg = makeQueue();
    const qEmail = makeQueue();
    const qKb = makeQueue();
    const qAnalytics = makeQueue();
    const mockDb: any = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    const service = new QueuesService(
      qAi,
      qNotif,
      qAuto,
      qHook,
      qMsg,
      qEmail,
      qKb,
      qAnalytics,
      mockDb,
    );

    await service.enqueueMessageDelivery({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      idempotencyKey: 'msg-dedup-1',
    });
    expect(qMsg.add).toHaveBeenCalledWith(
      'relay_outbox',
      expect.any(Object),
      expect.objectContaining({ jobId: 'msg-dedup-1' }),
    );

    await service.enqueueKnowledgeIndexing({
      workspaceId: 'ws-1',
      knowledgeId: 'kb-1',
      action: 'reindex_document',
      idempotencyKey: 'kb-dedup-1',
    });
    expect(qKb.add).toHaveBeenCalledWith(
      'reindex_document',
      expect.any(Object),
      expect.objectContaining({ jobId: 'kb-dedup-1' }),
    );

    const metrics = await service.getQueueMetrics();
    expect(Object.keys(metrics).sort()).toEqual(
      [
        QUEUE_AI_PROCESSING,
        QUEUE_ANALYTICS,
        QUEUE_AUTOMATIONS,
        QUEUE_EMAIL_PROCESSING,
        QUEUE_KNOWLEDGE_INDEXING,
        QUEUE_MESSAGE_DELIVERY,
        QUEUE_NOTIFICATIONS,
        QUEUE_WEBHOOKS,
      ].sort(),
    );
  });

  it('blocks private metadata / localhost URLs in WebhooksProcessor (SSRF)', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    const processor = new WebhooksProcessor();
    await expect(
      processor.process({
        id: 'w-1',
        data: {
          workspaceId: 'ws-1',
          endpointUrl: 'https://169.254.169.254/latest/meta-data',
          event: 'message.created',
          payload: {},
        },
      } as any),
    ).rejects.toThrow(/private/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records dead-letter job when retries are exhausted', async () => {
    const mockDb: any = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const service = new QueuesService(
      makeQueue(),
      makeQueue(),
      makeQueue(),
      makeQueue(),
      undefined,
      undefined,
      undefined,
      undefined,
      mockDb,
    );

    const processor = new WebhooksProcessor(service);
    await processor.onFailed(
      {
        id: 'w-fail-1',
        queueName: QUEUE_WEBHOOKS,
        name: 'message.created',
        attemptsMade: 5,
        opts: { attempts: 5 },
        data: { workspaceId: 'ws-1', endpointUrl: 'https://example.com/hook' },
      } as any,
      new Error('Target returned 500'),
    );

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.dead_letter_jobs'),
      expect.arrayContaining([QUEUE_WEBHOOKS, 'w-fail-1', 'message.created', 'ws-1']),
    );
  });

  it('indexes knowledge base chunks with 768-dim embeddings via fn_store_bot_knowledge_chunks', async () => {
    const mockDb: any = {
      query: vi
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
    const mockLlm: any = {
      providerName: 'gemini',
      generateCompletion: vi.fn(),
      generateEmbeddings: vi.fn().mockResolvedValue([Array(768).fill(0.01)]),
    };

    const processor = new KnowledgeIndexingProcessor(mockDb, mockLlm);
    const res = await processor.process({
      id: 'kb-job-1',
      data: {
        workspaceId: 'ws-1',
        knowledgeId: 'kb-1',
        action: 'reindex_document',
      },
    } as any);

    expect(res.indexed).toBe(true);
    expect(mockDb.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('fn_store_bot_knowledge_chunks'),
      ['kb-1', 3, expect.stringContaining('"chunk_index":0'), null],
    );
  });
});

