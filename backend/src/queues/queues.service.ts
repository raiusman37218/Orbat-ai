import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import {
  QUEUE_AI_PROCESSING,
  QUEUE_NOTIFICATIONS,
  QUEUE_AUTOMATIONS,
  QUEUE_WEBHOOKS,
  AiTaskPayload,
  NotificationPayload,
  AutomationPayload,
  WebhookPayload,
} from './queue.constants';

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectQueue(QUEUE_AI_PROCESSING)
    private readonly aiQueue: Queue,
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE_AUTOMATIONS)
    private readonly automationsQueue: Queue,
    @InjectQueue(QUEUE_WEBHOOKS)
    private readonly webhooksQueue: Queue,
  ) {}

  async enqueueAiTask(data: AiTaskPayload, opts?: JobsOptions) {
    const job = await this.aiQueue.add(data.taskType, data, {
      priority: data.taskType === 'generate_reply' ? 1 : 5,
      ...opts,
    });
    this.logger.log(`Enqueued AI task ${data.taskType} (${job.id}) for conversation ${data.conversationId}`);
    return job;
  }

  async enqueueNotification(data: NotificationPayload, opts?: JobsOptions) {
    const job = await this.notificationsQueue.add(data.template, data, opts);
    this.logger.log(`Enqueued notification ${data.template} (${job.id}) to ${data.recipientEmail}`);
    return job;
  }

  async enqueueAutomation(data: AutomationPayload, opts?: JobsOptions) {
    const job = await this.automationsQueue.add(data.action, data, opts);
    this.logger.log(`Enqueued automation ${data.action} (${job.id}) for workspace ${data.workspaceId}`);
    return job;
  }

  async enqueueWebhook(data: WebhookPayload, opts?: JobsOptions) {
    const job = await this.webhooksQueue.add(data.event, data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 3000 },
      ...opts,
    });
    this.logger.log(`Enqueued webhook event ${data.event} (${job.id}) to ${data.endpointUrl}`);
    return job;
  }

  async getQueueMetrics() {
    const [aiCounts, notifCounts, autoCounts, hookCounts] = await Promise.all([
      this.aiQueue.getJobCounts(),
      this.notificationsQueue.getJobCounts(),
      this.automationsQueue.getJobCounts(),
      this.webhooksQueue.getJobCounts(),
    ]);

    return {
      [QUEUE_AI_PROCESSING]: aiCounts,
      [QUEUE_NOTIFICATIONS]: notifCounts,
      [QUEUE_AUTOMATIONS]: autoCounts,
      [QUEUE_WEBHOOKS]: hookCounts,
    };
  }
}

