import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WebhookPayload } from '../queue.constants';
export declare class WebhooksProcessor extends WorkerHost {
    private readonly logger;
    process(job: Job<WebhookPayload>): Promise<any>;
}
