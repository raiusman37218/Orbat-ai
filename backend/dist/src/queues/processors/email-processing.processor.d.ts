import { Job } from 'bullmq';
import { EmailProcessingPayload } from '../queue.constants';
import { DatabaseService } from '../../database/database.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';
export declare class EmailProcessingProcessor extends BaseQueueProcessor {
    private readonly db?;
    private readonly logger;
    constructor(db?: DatabaseService | undefined, queuesService?: QueuesService);
    process(job: Job<EmailProcessingPayload>): Promise<any>;
}
