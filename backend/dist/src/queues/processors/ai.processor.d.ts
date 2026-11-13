import { Job } from 'bullmq';
import { AiTaskPayload } from '../queue.constants';
import { AiEngineService } from '../../ai-engine/ai-engine.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';
export declare class AiProcessor extends BaseQueueProcessor {
    private readonly aiEngine?;
    private readonly logger;
    constructor(aiEngine?: AiEngineService | undefined, queuesService?: QueuesService);
    process(job: Job<AiTaskPayload>): Promise<any>;
}
