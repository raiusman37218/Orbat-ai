import { Queue, JobsOptions } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { AiTaskPayload, MessageDeliveryPayload, EmailProcessingPayload, WebhookPayload, AutomationPayload, KnowledgeIndexingPayload, NotificationPayload, AnalyticsPayload } from './queue.constants';
export declare class QueuesService {
    private readonly aiQueue;
    private readonly notificationsQueue;
    private readonly automationsQueue;
    private readonly webhooksQueue;
    private readonly messageDeliveryQueue?;
    private readonly emailQueue?;
    private readonly knowledgeQueue?;
    private readonly analyticsQueue?;
    private readonly db?;
    private readonly logger;
    constructor(aiQueue: Queue, notificationsQueue: Queue, automationsQueue: Queue, webhooksQueue: Queue, messageDeliveryQueue?: Queue | undefined, emailQueue?: Queue | undefined, knowledgeQueue?: Queue | undefined, analyticsQueue?: Queue | undefined, db?: DatabaseService | undefined);
    private withIdempotency;
    enqueueAiTask(data: AiTaskPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    enqueueMessageDelivery(data: MessageDeliveryPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    enqueueEmailProcessing(data: EmailProcessingPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    enqueueNotification(data: NotificationPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    enqueueAutomation(data: AutomationPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    enqueueKnowledgeIndexing(data: KnowledgeIndexingPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    enqueueWebhook(data: WebhookPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    enqueueAnalytics(data: AnalyticsPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    recordDeadLetterJob(entry: {
        queueName: string;
        jobId?: string;
        jobName?: string;
        workspaceId?: string | null;
        payload: any;
        errorMessage: string;
        attemptsMade: number;
    }): Promise<void>;
    getQueueMetrics(): Promise<Record<string, any>>;
}
