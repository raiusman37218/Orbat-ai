import { Job } from 'bullmq';
import { NotificationPayload } from '../queue.constants';
import { DatabaseService } from '../../database/database.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';
export declare class NotificationsProcessor extends BaseQueueProcessor {
    private readonly db?;
    private readonly logger;
    constructor(db?: DatabaseService | undefined, queuesService?: QueuesService);
    process(job: Job<NotificationPayload>): Promise<any>;
}
