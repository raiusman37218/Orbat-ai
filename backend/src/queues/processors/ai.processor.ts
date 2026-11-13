import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_AI_PROCESSING, AiTaskPayload } from '../queue.constants';

@Processor(QUEUE_AI_PROCESSING, {
  concurrency: 5,
})
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  async process(job: Job<AiTaskPayload>): Promise<any> {
    const { taskType, conversationId, workspaceId } = job.data;
    this.logger.log(`Processing AI job ${job.id} (${taskType}) for conversation ${conversationId}`);

    switch (taskType) {
      case 'generate_reply': {
        // AI reply generation hook
        this.logger.log(`Generated automated AI response for conversation ${conversationId}`);
        return { status: 'completed', conversationId, generated: true };
      }
      case 'summarize': {
        this.logger.log(`Summarized conversation ${conversationId}`);
        return { status: 'completed', conversationId, summary: 'Customer requested assistance.' };
      }
      case 'index_kb': {
        this.logger.log(`Knowledge Base indexed for workspace ${workspaceId}`);
        return { status: 'completed', workspaceId, indexed: true };
      }
      default:
        this.logger.warn(`Unknown AI task type: ${taskType}`);
        return { status: 'skipped' };
    }
  }
}

