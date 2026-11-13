import { OnWorkerEvent, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueuesService } from '../queues.service';

export abstract class BaseQueueProcessor extends WorkerHost {
  protected constructor(protected readonly queuesService?: QueuesService) {
    super();
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<any> | undefined, error: Error) {
    if (!job) return;
    const maxAttempts = job.opts?.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts && this.queuesService) {
      await this.queuesService.recordDeadLetterJob({
        queueName: job.queueName,
        jobId: job.id,
        jobName: job.name,
        workspaceId: job.data?.workspaceId || null,
        payload: job.data,
        errorMessage: error?.message || 'Unknown worker failure',
        attemptsMade: job.attemptsMade,
      });
    }
  }
}

