import { Processor } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_EMAIL_PROCESSING, EmailProcessingPayload } from '../queue.constants';
import { DatabaseService } from '../../database/database.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';

@Processor(QUEUE_EMAIL_PROCESSING, {
  concurrency: 5,
  lockDuration: 30_000,
})
export class EmailProcessingProcessor extends BaseQueueProcessor {
  private readonly logger = new Logger(EmailProcessingProcessor.name);

  constructor(
    @Optional() private readonly db?: DatabaseService,
    @Optional() queuesService?: QueuesService,
  ) {
    super(queuesService);
  }

  async process(job: Job<EmailProcessingPayload>): Promise<any> {
    const { workspaceId, action, to, subject, rawEmailId } = job.data;

    if (action === 'process_inbound') {
      if (this.db && rawEmailId) {
        const res = await this.db.query(
          `SELECT id FROM public.email_inbound_log WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
          [rawEmailId, workspaceId],
        );
        return { processed: res.rows.length > 0, rawEmailId };
      }
      return { processed: true, action };
    }

    if (!to) {
      return { sent: false, reason: 'missing_recipient' };
    }

    if (this.db) {
      const suppressed = await this.db
        .query(
          'SELECT 1 FROM public.email_suppressions WHERE workspace_id = $1 AND email = $2 LIMIT 1',
          [workspaceId, to.toLowerCase()],
        )
        .catch(() => ({ rows: [] }));
      if (suppressed.rows.length > 0) {
        return { sent: false, reason: 'suppressed_recipient' };
      }
    }

    const relayUrl = process.env.INTERNAL_EMAIL_RELAY_URL;
    const internalToken = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
    if (relayUrl && internalToken) {
      const res = await fetch(relayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': internalToken,
        },
        body: JSON.stringify(job.data),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        throw new Error(`Email relay HTTP ${res.status}`);
      }
      return { sent: true, via: 'internal_relay' };
    }

    this.logger.log(`Recorded outbound email job ${job.id} (${subject || 'Notification'}) for workspace ${workspaceId}`);
    return { sent: false, reason: 'smtp_relay_not_configured' };
  }
}

