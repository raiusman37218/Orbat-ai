import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueuesService } from './queues.service';
import {
  QUEUE_AI_PROCESSING,
  QUEUE_NOTIFICATIONS,
  QUEUE_AUTOMATIONS,
  QUEUE_WEBHOOKS,
} from './queue.constants';

describe('QueuesService', () => {
  let service: QueuesService;
  let mockAiQueue: any;
  let mockNotificationsQueue: any;
  let mockAutomationsQueue: any;
  let mockWebhooksQueue: any;

  beforeEach(() => {
    mockAiQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-ai-1' }),
      getJobCounts: vi.fn().mockResolvedValue({ active: 1, waiting: 0 }),
    };
    mockNotificationsQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-notif-1' }),
      getJobCounts: vi.fn().mockResolvedValue({ active: 0, waiting: 2 }),
    };
    mockAutomationsQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-auto-1' }),
      getJobCounts: vi.fn().mockResolvedValue({ active: 0, waiting: 0 }),
    };
    mockWebhooksQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-hook-1' }),
      getJobCounts: vi.fn().mockResolvedValue({ active: 0, waiting: 0 }),
    };

    service = new QueuesService(
      mockAiQueue,
      mockNotificationsQueue,
      mockAutomationsQueue,
      mockWebhooksQueue,
    );
  });

  it('should enqueue AI tasks with high priority for reply generation', async () => {
    const job = await service.enqueueAiTask({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      taskType: 'generate_reply',
    });

    expect(job.id).toBe('job-ai-1');
    expect(mockAiQueue.add).toHaveBeenCalledWith(
      'generate_reply',
      expect.objectContaining({ conversationId: 'conv-1' }),
      expect.objectContaining({ priority: 1 }),
    );
  });

  it('should enqueue notification tasks', async () => {
    const job = await service.enqueueNotification({
      workspaceId: 'ws-1',
      recipientEmail: 'agent@company.com',
      subject: 'New message assigned',
      template: 'agent_assigned',
      context: { ticketId: '123' },
    });

    expect(job.id).toBe('job-notif-1');
    expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
      'agent_assigned',
      expect.objectContaining({ recipientEmail: 'agent@company.com' }),
      undefined,
    );
  });

  it('should enqueue automation jobs', async () => {
    const job = await service.enqueueAutomation({
      workspaceId: 'ws-1',
      action: 'check_sla',
    });

    expect(job.id).toBe('job-auto-1');
    expect(mockAutomationsQueue.add).toHaveBeenCalledWith(
      'check_sla',
      expect.objectContaining({ action: 'check_sla' }),
      undefined,
    );
  });

  it('should enqueue webhook jobs with retry backoff', async () => {
    const job = await service.enqueueWebhook({
      workspaceId: 'ws-1',
      endpointUrl: 'https://example.com/webhook',
      event: 'message.created',
      payload: { id: 'msg-1' },
    });

    expect(job.id).toBe('job-hook-1');
    expect(mockWebhooksQueue.add).toHaveBeenCalledWith(
      'message.created',
      expect.objectContaining({ endpointUrl: 'https://example.com/webhook' }),
      expect.objectContaining({ attempts: 5 }),
    );
  });

  it('should return aggregated metrics across all queues', async () => {
    const metrics = await service.getQueueMetrics();
    expect(metrics[QUEUE_AI_PROCESSING]).toEqual({ active: 1, waiting: 0 });
    expect(metrics[QUEUE_NOTIFICATIONS]).toEqual({ active: 0, waiting: 2 });
  });
});

