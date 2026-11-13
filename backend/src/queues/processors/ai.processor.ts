import { Processor } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_AI_PROCESSING, AiTaskPayload } from '../queue.constants';
import { AiEngineService } from '../../ai-engine/ai-engine.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';

@Processor(QUEUE_AI_PROCESSING, {
  concurrency: 3,
  lockDuration: 60_000,
})
export class AiProcessor extends BaseQueueProcessor {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    @Optional() private readonly aiEngine?: AiEngineService,
    @Optional() queuesService?: QueuesService,
  ) {
    super(queuesService);
  }

  async process(job: Job<AiTaskPayload>): Promise<any> {
    const { taskType, conversationId, workspaceId, triggerMessage, triggerMessageId, metadata } = job.data;
    this.logger.log(`Processing AI job ${job.id} (${taskType}) for conversation ${conversationId}`);

    switch (taskType) {
      case 'generate_reply': {
        if (!this.aiEngine) {
          throw new Error('AiEngineService unavailable in worker context');
        }
        const promptText = String(triggerMessage || metadata?.content || '').trim();
        if (!promptText) {
          return { status: 'skipped', reason: 'empty_trigger_message' };
        }
        return this.aiEngine.generateBotResponse(workspaceId, conversationId, promptText, triggerMessageId);
      }
      case 'summarize': {
        if (!this.aiEngine) {
          throw new Error('AiEngineService unavailable in worker context');
        }
        return this.aiEngine.summarizeConversation(workspaceId, conversationId);
      }
      case 'index_kb': {
        if (this.queuesService && metadata?.knowledgeId) {
          const queued = await this.queuesService.enqueueKnowledgeIndexing({
            workspaceId,
            knowledgeId: String(metadata.knowledgeId),
            title: metadata.title,
            content: metadata.content,
            action: 'reindex_document',
            idempotencyKey: `kb-${workspaceId}-${metadata.knowledgeId}`,
          });
          return { status: 'forwarded_to_knowledge_indexing', jobId: queued.id };
        }
        return { status: 'skipped', reason: 'missing_knowledge_id' };
      }
      case 'suggest_macros': {
        if (!this.aiEngine) {
          throw new Error('AiEngineService unavailable in worker context');
        }
        return this.aiEngine.suggestCopilotReply(workspaceId, conversationId);
      }
      default:
        this.logger.warn(`Unknown AI task type: ${taskType}`);
        return { status: 'skipped' };
    }
  }
}
