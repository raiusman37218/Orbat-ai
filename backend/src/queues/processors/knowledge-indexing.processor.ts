import { Processor } from '@nestjs/bullmq';
import { Inject, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_KNOWLEDGE_INDEXING, KnowledgeIndexingPayload } from '../queue.constants';
import { DatabaseService } from '../../database/database.service';
import { LLM_PROVIDER, LlmProvider } from '../../ai-engine/interfaces/llm-provider.interface';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';

function chunkDocumentText(text: string, maxChars = 900, overlap = 120): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + maxChars);
    if (end < normalized.length) {
      const breakIdx = normalized.lastIndexOf('\n\n', end);
      if (breakIdx > start + 200) {
        end = breakIdx;
      }
    }
    const piece = normalized.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

@Processor(QUEUE_KNOWLEDGE_INDEXING, {
  concurrency: 2,
  lockDuration: 120_000,
})
export class KnowledgeIndexingProcessor extends BaseQueueProcessor {
  private readonly logger = new Logger(KnowledgeIndexingProcessor.name);

  constructor(
    @Optional() private readonly db?: DatabaseService,
    @Optional() @Inject(LLM_PROVIDER) private readonly llm?: LlmProvider,
    @Optional() queuesService?: QueuesService,
  ) {
    super(queuesService);
  }

  async process(job: Job<KnowledgeIndexingPayload>): Promise<any> {
    const { workspaceId, knowledgeId, action } = job.data;
    if (!this.db) {
      return { workspaceId, knowledgeId, skipped: true, reason: 'database_unavailable' };
    }

    if (action === 'delete_document') {
      await this.db.query(
        'DELETE FROM public.bot_knowledge_chunks WHERE knowledge_id = $1 AND workspace_id = $2',
        [knowledgeId, workspaceId],
      );
      return { deleted: true, knowledgeId };
    }

    const rowRes = await this.db.query(
      `SELECT id, workspace_id, title, content, content_version
       FROM public.bot_knowledge
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`,
      [knowledgeId, workspaceId],
    );
    const entry = rowRes?.rows?.[0];
    if (!entry) {
      return { skipped: true, reason: 'knowledge_entry_not_found', knowledgeId };
    }

    const textChunks = chunkDocumentText(`${entry.title}\n\n${entry.content}`);
    let embeddings: Array<number[] | null> = textChunks.map(() => null);

    if (textChunks.length > 0 && this.llm?.generateEmbeddings) {
      try {
        const vectors = await this.llm.generateEmbeddings(textChunks);
        embeddings = textChunks.map((_, idx) =>
          Array.isArray(vectors[idx]) && vectors[idx].length === 768 ? vectors[idx] : null,
        );
      } catch (err: any) {
        this.logger.warn(`Embedding generation failed for ${knowledgeId}; storing FTS chunks: ${err?.message}`);
      }
    }

    const payload = textChunks.map((content, chunkIndex) => ({
      chunk_index: chunkIndex,
      content,
      token_count: Math.ceil(content.length / 4),
      embedding: embeddings[chunkIndex],
    }));

    const storedRes = await this.db.query(
      'SELECT public.fn_store_bot_knowledge_chunks($1::uuid, $2::int, $3::jsonb, $4::text) AS stored',
      [knowledgeId, entry.content_version, JSON.stringify(payload), null],
    );

    return {
      indexed: Boolean(storedRes?.rows?.[0]?.stored),
      knowledgeId,
      chunkCount: payload.length,
    };
  }
}

