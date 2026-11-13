import { Processor } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_MESSAGE_DELIVERY, MessageDeliveryPayload } from '../queue.constants';
import { OutboxService } from '../../realtime/outbox.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';

@Processor(QUEUE_MESSAGE_DELIVERY, {
  concurrency: 10,
  lockDuration: 15_000,
})
export class MessageDeliveryProcessor extends BaseQueueProcessor {
  private readonly logger = new Logger(MessageDeliveryProcessor.name);

  constructor(
    @Optional() private readonly outbox?: OutboxService,
    @Optional() queuesService?: QueuesService,
  ) {
    super(queuesService);
  }

  async process(job: Job<MessageDeliveryPayload>): Promise<any> {
    const batchSize = Math.min(Math.max(1, job.data.batchSize || 50), 200);
    if (!this.outbox) {
      return { relayed: 0, failed: 0, skipped: 'outbox_unavailable' };
    }

    const result = await this.outbox.relayPendingEvents(batchSize);
    this.logger.debug(`Message delivery job ${job.id}: relayed=${result.relayed}, failed=${result.failed}`);
    return result;
  }
}

