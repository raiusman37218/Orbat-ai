import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AutomationPayload } from '../queue.constants';
export declare class AutomationsProcessor extends WorkerHost {
    private readonly logger;
    process(job: Job<AutomationPayload>): Promise<any>;
}
