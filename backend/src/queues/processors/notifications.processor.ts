import { Processor } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NOTIFICATIONS, NotificationPayload } from '../queue.constants';
import { DatabaseService } from '../../database/database.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';

@Processor(QUEUE_NOTIFICATIONS, {
  concurrency: 10,
  lockDuration: 20_000,
})
export class NotificationsProcessor extends BaseQueueProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @Optional() private readonly db?: DatabaseService,
    @Optional() queuesService?: QueuesService,
  ) {
    super(queuesService);
  }

  async process(job: Job<NotificationPayload>): Promise<any> {
    const { workspaceId, template, recipientEmail, subject, context } = job.data;
    this.logger.log(`Dispatching notification [${template}] for workspace ${workspaceId}: "${subject}"`);

    if (this.db) {
      const suppressed = await this.db
        .query(
          `SELECT 1 FROM public.email_suppressions WHERE workspace_id = $1 AND email = $2 LIMIT 1`,
          [workspaceId, recipientEmail.toLowerCase()],
        )
        .catch(() => ({ rows: [] }));
      if (suppressed.rows.length > 0) {
        return { sent: false, suppressed: true, template };
      }
    }

    if (this.queuesService) {
      await this.queuesService.enqueueEmailProcessing({
        workspaceId,
        action: 'send_outbound',
        to: recipientEmail,
        subject,
        text: `[${template}] ${subject}`,
        metadata: { template, context },
        idempotencyKey: job.data.idempotencyKey ? `email-${job.data.idempotencyKey}` : undefined,
      });
    }

    return {
      queuedForDelivery: true,
      template,
      timestamp: new Date().toISOString(),
    };
  }
}
