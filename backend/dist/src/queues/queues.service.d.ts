import { Queue, JobsOptions } from 'bullmq';
import { AiTaskPayload, NotificationPayload, AutomationPayload, WebhookPayload } from './queue.constants';
export declare class QueuesService {
    private readonly aiQueue;
    private readonly notificationsQueue;
    private readonly automationsQueue;
    private readonly webhooksQueue;
    private readonly logger;
    constructor(aiQueue: Queue, notificationsQueue: Queue, automationsQueue: Queue, webhooksQueue: Queue);
    enqueueAiTask(data: AiTaskPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    enqueueNotification(data: NotificationPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    enqueueAutomation(data: AutomationPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    enqueueWebhook(data: WebhookPayload, opts?: JobsOptions): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
    getQueueMetrics(): Promise<{
        "ai-processing": {
            [index: string]: number;
        };
        notifications: {
            [index: string]: number;
        };
        automations: {
            [index: string]: number;
        };
        webhooks: {
            [index: string]: number;
        };
    }>;
}
