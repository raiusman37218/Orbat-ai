import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import {
  QUEUE_AI_PROCESSING,
  QUEUE_MESSAGE_DELIVERY,
  QUEUE_EMAIL_PROCESSING,
  QUEUE_WEBHOOKS,
  QUEUE_AUTOMATIONS,
  QUEUE_KNOWLEDGE_INDEXING,
  QUEUE_NOTIFICATIONS,
  QUEUE_ANALYTICS,
  AiTaskPayload,
  MessageDeliveryPayload,
  EmailProcessingPayload,
  WebhookPayload,
  AutomationPayload,
  KnowledgeIndexingPayload,
  NotificationPayload,
  AnalyticsPayload,
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
    @Optional()
    @InjectQueue(QUEUE_MESSAGE_DELIVERY)
    private readonly messageDeliveryQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_EMAIL_PROCESSING)
    private readonly emailQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_KNOWLEDGE_INDEXING)
    private readonly knowledgeQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_ANALYTICS)
    private readonly analyticsQueue?: Queue,
    @Optional()
    private readonly db?: DatabaseService,
  ) {}

  private withIdempotency(idempotencyKey?: string, opts?: JobsOptions): JobsOptions | undefined {
    if (!idempotencyKey) return opts;
    return {
      jobId: idempotencyKey,
      ...opts,
    };
  }

  async enqueueAiTask(data: AiTaskPayload, opts?: JobsOptions) {
    const job = await this.aiQueue.add(data.taskType, data, {
      priority: data.taskType === 'generate_reply' ? 1 : 5,
      ...this.withIdempotency(data.idempotencyKey, opts),
    });
    this.logger.log(`Enqueued AI task ${data.taskType} (${job.id}) for conversation ${data.conversationId}`);
    return job;
  }

  async enqueueMessageDelivery(data: MessageDeliveryPayload, opts?: JobsOptions) {
    if (!this.messageDeliveryQueue) {
      throw new Error('message-delivery queue is not registered');
    }
    const job = await this.messageDeliveryQueue.add('relay_outbox', data, {
      priority: 1,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      ...this.withIdempotency(data.idempotencyKey, opts),
    });
    return job;
  }

  async enqueueEmailProcessing(data: EmailProcessingPayload, opts?: JobsOptions) {
    if (!this.emailQueue) {
      throw new Error('email-processing queue is not registered');
    }
    const job = await this.emailQueue.add(data.action, data, {
      attempts: 4,
      backoff: { type: 'exponential', delay: 3000 },
      ...this.withIdempotency(data.idempotencyKey, opts),
    });
    return job;
  }

  async enqueueNotification(data: NotificationPayload, opts?: JobsOptions) {
    const job = await this.notificationsQueue.add(
      data.template,
      data,
      this.withIdempotency(data.idempotencyKey, opts),
    );
    this.logger.log(`Enqueued notification ${data.template} (${job.id}) to ${data.recipientEmail}`);
    return job;
  }

  async enqueueAutomation(data: AutomationPayload, opts?: JobsOptions) {
    const job = await this.automationsQueue.add(
      data.action,
      data,
      this.withIdempotency(data.idempotencyKey, opts),
    );
    this.logger.log(`Enqueued automation ${data.action} (${job.id}) for workspace ${data.workspaceId}`);
    return job;
  }

  async enqueueKnowledgeIndexing(data: KnowledgeIndexingPayload, opts?: JobsOptions) {
    if (!this.knowledgeQueue) {
      throw new Error('knowledge-indexing queue is not registered');
    }
    const job = await this.knowledgeQueue.add(data.action, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      ...this.withIdempotency(data.idempotencyKey, opts),
    });
    return job;
  }

  async enqueueWebhook(data: WebhookPayload, opts?: JobsOptions) {
    const job = await this.webhooksQueue.add(data.event, data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 3000 },
      ...this.withIdempotency(data.idempotencyKey, opts),
    });
    this.logger.log(`Enqueued webhook event ${data.event} (${job.id}) to ${data.endpointUrl}`);
    return job;
  }

  async enqueueAnalytics(data: AnalyticsPayload, opts?: JobsOptions) {
    if (!this.analyticsQueue) {
      throw new Error('analytics queue is not registered');
    }
    return this.analyticsQueue.add(data.eventType, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      ...this.withIdempotency(data.idempotencyKey, opts),
    });
  }

  async recordDeadLetterJob(entry: {
    queueName: string;
    jobId?: string;
    jobName?: string;
    workspaceId?: string | null;
    payload: any;
    errorMessage: string;
    attemptsMade: number;
  }): Promise<void> {
    this.logger.error(
      `[DLQ] Queue=${entry.queueName} Job=${entry.jobId || 'unknown'} (${entry.jobName || 'job'}) exhausted retries (${entry.attemptsMade}): ${entry.errorMessage}`,
    );
    if (!this.db) return;

    try {
      await this.db.query(
        `INSERT INTO public.dead_letter_jobs (
           queue_name, job_id, job_name, workspace_id, payload, error_message, attempts_made
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.queueName,
          entry.jobId || null,
          entry.jobName || null,
          entry.workspaceId || null,
          JSON.stringify(entry.payload || {}),
          entry.errorMessage.slice(0, 1000),
          entry.attemptsMade,
        ],
      );
    } catch (err: any) {
      if (err?.code !== '42P01') {
        this.logger.warn(`Failed persisting DLQ record: ${err?.message || err}`);
      }
    }
  }

  async getQueueMetrics() {
    const pairs: Array<[string, Queue | undefined]> = [
      [QUEUE_AI_PROCESSING, this.aiQueue],
      [QUEUE_MESSAGE_DELIVERY, this.messageDeliveryQueue],
      [QUEUE_EMAIL_PROCESSING, this.emailQueue],
      [QUEUE_WEBHOOKS, this.webhooksQueue],
      [QUEUE_AUTOMATIONS, this.automationsQueue],
      [QUEUE_KNOWLEDGE_INDEXING, this.knowledgeQueue],
      [QUEUE_NOTIFICATIONS, this.notificationsQueue],
      [QUEUE_ANALYTICS, this.analyticsQueue],
    ];

    const entries = await Promise.all(
      pairs.map(async ([name, q]) => [name, q ? await q.getJobCounts() : null] as const),
    );

    const out: Record<string, any> = {};
    for (const [name, counts] of entries) {
      if (counts !== null) {
        out[name] = counts;
      }
    }
    return out;
  }
}
