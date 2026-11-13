import { Job } from 'bullmq';
import { KnowledgeIndexingPayload } from '../queue.constants';
import { DatabaseService } from '../../database/database.service';
import { LlmProvider } from '../../ai-engine/interfaces/llm-provider.interface';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';
export declare class KnowledgeIndexingProcessor extends BaseQueueProcessor {
    private readonly db?;
    private readonly llm?;
    private readonly logger;
    constructor(db?: DatabaseService | undefined, llm?: LlmProvider | undefined, queuesService?: QueuesService);
    process(job: Job<KnowledgeIndexingPayload>): Promise<any>;
}
