"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const queues_service_1 = require("./queues.service");
const queue_constants_1 = require("./queue.constants");
(0, vitest_1.describe)('QueuesService', () => {
    let service;
    let mockAiQueue;
    let mockNotificationsQueue;
    let mockAutomationsQueue;
    let mockWebhooksQueue;
    (0, vitest_1.beforeEach)(() => {
        mockAiQueue = {
            add: vitest_1.vi.fn().mockResolvedValue({ id: 'job-ai-1' }),
            getJobCounts: vitest_1.vi.fn().mockResolvedValue({ active: 1, waiting: 0 }),
        };
        mockNotificationsQueue = {
            add: vitest_1.vi.fn().mockResolvedValue({ id: 'job-notif-1' }),
            getJobCounts: vitest_1.vi.fn().mockResolvedValue({ active: 0, waiting: 2 }),
        };
        mockAutomationsQueue = {
            add: vitest_1.vi.fn().mockResolvedValue({ id: 'job-auto-1' }),
            getJobCounts: vitest_1.vi.fn().mockResolvedValue({ active: 0, waiting: 0 }),
        };
        mockWebhooksQueue = {
            add: vitest_1.vi.fn().mockResolvedValue({ id: 'job-hook-1' }),
            getJobCounts: vitest_1.vi.fn().mockResolvedValue({ active: 0, waiting: 0 }),
        };
        service = new queues_service_1.QueuesService(mockAiQueue, mockNotificationsQueue, mockAutomationsQueue, mockWebhooksQueue);
    });
    (0, vitest_1.it)('should enqueue AI tasks with high priority for reply generation', async () => {
        const job = await service.enqueueAiTask({
            workspaceId: 'ws-1',
            conversationId: 'conv-1',
            taskType: 'generate_reply',
        });
        (0, vitest_1.expect)(job.id).toBe('job-ai-1');
        (0, vitest_1.expect)(mockAiQueue.add).toHaveBeenCalledWith('generate_reply', vitest_1.expect.objectContaining({ conversationId: 'conv-1' }), vitest_1.expect.objectContaining({ priority: 1 }));
    });
    (0, vitest_1.it)('should enqueue notification tasks', async () => {
        const job = await service.enqueueNotification({
            workspaceId: 'ws-1',
            recipientEmail: 'agent@company.com',
            subject: 'New message assigned',
            template: 'agent_assigned',
            context: { ticketId: '123' },
        });
        (0, vitest_1.expect)(job.id).toBe('job-notif-1');
        (0, vitest_1.expect)(mockNotificationsQueue.add).toHaveBeenCalledWith('agent_assigned', vitest_1.expect.objectContaining({ recipientEmail: 'agent@company.com' }), undefined);
    });
    (0, vitest_1.it)('should enqueue automation jobs', async () => {
        const job = await service.enqueueAutomation({
            workspaceId: 'ws-1',
            action: 'check_sla',
        });
        (0, vitest_1.expect)(job.id).toBe('job-auto-1');
        (0, vitest_1.expect)(mockAutomationsQueue.add).toHaveBeenCalledWith('check_sla', vitest_1.expect.objectContaining({ action: 'check_sla' }), undefined);
    });
    (0, vitest_1.it)('should enqueue webhook jobs with retry backoff', async () => {
        const job = await service.enqueueWebhook({
            workspaceId: 'ws-1',
            endpointUrl: 'https://example.com/webhook',
            event: 'message.created',
            payload: { id: 'msg-1' },
        });
        (0, vitest_1.expect)(job.id).toBe('job-hook-1');
        (0, vitest_1.expect)(mockWebhooksQueue.add).toHaveBeenCalledWith('message.created', vitest_1.expect.objectContaining({ endpointUrl: 'https://example.com/webhook' }), vitest_1.expect.objectContaining({ attempts: 5 }));
    });
    (0, vitest_1.it)('should return aggregated metrics across all queues', async () => {
        const metrics = await service.getQueueMetrics();
        (0, vitest_1.expect)(metrics[queue_constants_1.QUEUE_AI_PROCESSING]).toEqual({ active: 1, waiting: 0 });
        (0, vitest_1.expect)(metrics[queue_constants_1.QUEUE_NOTIFICATIONS]).toEqual({ active: 0, waiting: 2 });
    });
});
//# sourceMappingURL=queues.service.spec.js.map