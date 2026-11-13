import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_AUTOMATIONS, AutomationPayload } from '../queue.constants';

@Processor(QUEUE_AUTOMATIONS, {
  concurrency: 5,
})
export class AutomationsProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationsProcessor.name);

  async process(job: Job<AutomationPayload>): Promise<any> {
    const { action, workspaceId, targetId } = job.data;
    this.logger.log(`Executing automation job ${job.id} (${action}) for workspace ${workspaceId}`);

    switch (action) {
      case 'check_sla':
        return { action, checked: true, breachedCount: 0 };
      case 'auto_close_inactive':
        return { action, closedCount: 0 };
      default:
        return { action, executed: true };
    }
  }
}

