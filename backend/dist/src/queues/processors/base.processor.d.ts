import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueuesService } from '../queues.service';
export declare abstract class BaseQueueProcessor extends WorkerHost {
    protected readonly queuesService?: QueuesService | undefined;
    protected constructor(queuesService?: QueuesService | undefined);
    onFailed(job: Job<any> | undefined, error: Error): Promise<void>;
}
