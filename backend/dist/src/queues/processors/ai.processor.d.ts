import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AiTaskPayload } from '../queue.constants';
export declare class AiProcessor extends WorkerHost {
    private readonly logger;
    process(job: Job<AiTaskPayload>): Promise<any>;
}
