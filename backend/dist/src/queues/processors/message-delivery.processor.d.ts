import { Job } from 'bullmq';
import { MessageDeliveryPayload } from '../queue.constants';
import { OutboxService } from '../../realtime/outbox.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';
export declare class MessageDeliveryProcessor extends BaseQueueProcessor {
    private readonly outbox?;
    private readonly logger;
    constructor(outbox?: OutboxService | undefined, queuesService?: QueuesService);
    process(job: Job<MessageDeliveryPayload>): Promise<any>;
}
