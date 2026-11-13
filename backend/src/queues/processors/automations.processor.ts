import { Processor } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_AUTOMATIONS, AutomationPayload } from '../queue.constants';
import { DatabaseService } from '../../database/database.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';

@Processor(QUEUE_AUTOMATIONS, {
  concurrency: 5,
  lockDuration: 30_000,
})
export class AutomationsProcessor extends BaseQueueProcessor {
  private readonly logger = new Logger(AutomationsProcessor.name);

  constructor(
    @Optional() private readonly db?: DatabaseService,
    @Optional() queuesService?: QueuesService,
  ) {
    super(queuesService);
  }

  async process(job: Job<AutomationPayload>): Promise<any> {
    const { action, workspaceId, targetId, inactivityMinutes } = job.data;
    this.logger.log(`Executing automation job ${job.id} (${action}) for workspace ${workspaceId}`);

    if (!this.db) {
      return { action, skipped: true, reason: 'database_unavailable' };
    }

    switch (action) {
      case 'check_sla': {
        const res = await this.db.query(
          `SELECT id
           FROM public.conversations
           WHERE workspace_id = $1
             AND status IN ('open', 'pending')
             AND first_agent_reply_at IS NULL
             AND created_at < now() - interval '15 minutes'
           LIMIT 100`,
          [workspaceId],
        );
        return { action, checked: true, breachedCount: res.rows.length, conversationIds: res.rows.map((r) => r.id) };
      }
      case 'auto_close_inactive': {
        const mins = Math.min(Math.max(5, Number(inactivityMinutes || 1440)), 43200);
        const res = await this.db.query(
          `UPDATE public.conversations
           SET status = 'closed', closed_at = now(), updated_at = now()
           WHERE workspace_id = $1
             AND status IN ('open', 'pending')
             AND updated_at < now() - ($2 || ' minutes')::interval
           RETURNING id`,
          [workspaceId, String(mins)],
        );
        return { action, closedCount: res.rows.length };
      }
      case 'run_macro': {
        if (!targetId) {
          return { action, executed: false, reason: 'missing_targetId' };
        }
        return { action, targetId, executed: true };
      }
      default:
        return { action, executed: false, reason: 'unsupported_action' };
    }
  }
}
