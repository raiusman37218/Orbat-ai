import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationPayload } from '../queue.constants';
export declare class NotificationsProcessor extends WorkerHost {
    private readonly logger;
    process(job: Job<NotificationPayload>): Promise<any>;
}
