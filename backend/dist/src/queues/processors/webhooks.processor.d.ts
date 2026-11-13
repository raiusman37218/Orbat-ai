import { Job } from 'bullmq';
import { WebhookPayload } from '../queue.constants';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';
export declare class WebhooksProcessor extends BaseQueueProcessor {
    private readonly logger;
    constructor(queuesService?: QueuesService);
    process(job: Job<WebhookPayload>): Promise<any>;
}
