import { Processor } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_ANALYTICS, AnalyticsPayload } from '../queue.constants';
import { DatabaseService } from '../../database/database.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';

@Processor(QUEUE_ANALYTICS, {
  concurrency: 3,
  lockDuration: 30_000,
})
export class AnalyticsProcessor extends BaseQueueProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(
    @Optional() private readonly db?: DatabaseService,
    @Optional() queuesService?: QueuesService,
  ) {
    super(queuesService);
  }

  async process(job: Job<AnalyticsPayload>): Promise<any> {
    const { workspaceId, eventType } = job.data;
    if (!this.db) {
      return { workspaceId, eventType, skipped: true };
    }

    const summary = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
         COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_count,
         COUNT(*) FILTER (WHERE ai_enabled = true)::int AS ai_handled_count
       FROM public.conversations
       WHERE workspace_id = $1`,
      [workspaceId],
    );

    const row = summary.rows[0] || {};
    this.logger.log(`Analytics rollup (${eventType}) completed for workspace ${workspaceId}`);
    return { workspaceId, eventType, metrics: row };
  }
}

