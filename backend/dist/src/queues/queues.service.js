"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var QueuesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueuesService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const database_service_1 = require("../database/database.service");
const queue_constants_1 = require("./queue.constants");
let QueuesService = QueuesService_1 = class QueuesService {
    constructor(aiQueue, notificationsQueue, automationsQueue, webhooksQueue, messageDeliveryQueue, emailQueue, knowledgeQueue, analyticsQueue, db) {
        this.aiQueue = aiQueue;
        this.notificationsQueue = notificationsQueue;
        this.automationsQueue = automationsQueue;
        this.webhooksQueue = webhooksQueue;
        this.messageDeliveryQueue = messageDeliveryQueue;
        this.emailQueue = emailQueue;
        this.knowledgeQueue = knowledgeQueue;
        this.analyticsQueue = analyticsQueue;
        this.db = db;
        this.logger = new common_1.Logger(QueuesService_1.name);
    }
    withIdempotency(idempotencyKey, opts) {
        if (!idempotencyKey)
            return opts;
        return {
            jobId: idempotencyKey,
            ...opts,
        };
    }
    async enqueueAiTask(data, opts) {
        const job = await this.aiQueue.add(data.taskType, data, {
            priority: data.taskType === 'generate_reply' ? 1 : 5,
            ...this.withIdempotency(data.idempotencyKey, opts),
        });
        this.logger.log(`Enqueued AI task ${data.taskType} (${job.id}) for conversation ${data.conversationId}`);
        return job;
    }
    async enqueueMessageDelivery(data, opts) {
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
    async enqueueEmailProcessing(data, opts) {
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
    async enqueueNotification(data, opts) {
        const job = await this.notificationsQueue.add(data.template, data, this.withIdempotency(data.idempotencyKey, opts));
        this.logger.log(`Enqueued notification ${data.template} (${job.id}) to ${data.recipientEmail}`);
        return job;
    }
    async enqueueAutomation(data, opts) {
        const job = await this.automationsQueue.add(data.action, data, this.withIdempotency(data.idempotencyKey, opts));
        this.logger.log(`Enqueued automation ${data.action} (${job.id}) for workspace ${data.workspaceId}`);
        return job;
    }
    async enqueueKnowledgeIndexing(data, opts) {
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
    async enqueueWebhook(data, opts) {
        const job = await this.webhooksQueue.add(data.event, data, {
            attempts: 5,
            backoff: { type: 'exponential', delay: 3000 },
            ...this.withIdempotency(data.idempotencyKey, opts),
        });
        this.logger.log(`Enqueued webhook event ${data.event} (${job.id}) to ${data.endpointUrl}`);
        return job;
    }
    async enqueueAnalytics(data, opts) {
        if (!this.analyticsQueue) {
            throw new Error('analytics queue is not registered');
        }
        return this.analyticsQueue.add(data.eventType, data, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            ...this.withIdempotency(data.idempotencyKey, opts),
        });
    }
    async recordDeadLetterJob(entry) {
        this.logger.error(`[DLQ] Queue=${entry.queueName} Job=${entry.jobId || 'unknown'} (${entry.jobName || 'job'}) exhausted retries (${entry.attemptsMade}): ${entry.errorMessage}`);
        if (!this.db)
            return;
        try {
            await this.db.query(`INSERT INTO public.dead_letter_jobs (
           queue_name, job_id, job_name, workspace_id, payload, error_message, attempts_made
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                entry.queueName,
                entry.jobId || null,
                entry.jobName || null,
                entry.workspaceId || null,
                JSON.stringify(entry.payload || {}),
                entry.errorMessage.slice(0, 1000),
                entry.attemptsMade,
            ]);
        }
        catch (err) {
            if (err?.code !== '42P01') {
                this.logger.warn(`Failed persisting DLQ record: ${err?.message || err}`);
            }
        }
    }
    async getQueueMetrics() {
        const pairs = [
            [queue_constants_1.QUEUE_AI_PROCESSING, this.aiQueue],
            [queue_constants_1.QUEUE_MESSAGE_DELIVERY, this.messageDeliveryQueue],
            [queue_constants_1.QUEUE_EMAIL_PROCESSING, this.emailQueue],
            [queue_constants_1.QUEUE_WEBHOOKS, this.webhooksQueue],
            [queue_constants_1.QUEUE_AUTOMATIONS, this.automationsQueue],
            [queue_constants_1.QUEUE_KNOWLEDGE_INDEXING, this.knowledgeQueue],
            [queue_constants_1.QUEUE_NOTIFICATIONS, this.notificationsQueue],
            [queue_constants_1.QUEUE_ANALYTICS, this.analyticsQueue],
        ];
        const entries = await Promise.all(pairs.map(async ([name, q]) => [name, q ? await q.getJobCounts() : null]));
        const out = {};
        for (const [name, counts] of entries) {
            if (counts !== null) {
                out[name] = counts;
            }
        }
        return out;
    }
};
exports.QueuesService = QueuesService;
exports.QueuesService = QueuesService = QueuesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_AI_PROCESSING)),
    __param(1, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_NOTIFICATIONS)),
    __param(2, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_AUTOMATIONS)),
    __param(3, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_WEBHOOKS)),
    __param(4, (0, common_1.Optional)()),
    __param(4, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_MESSAGE_DELIVERY)),
    __param(5, (0, common_1.Optional)()),
    __param(5, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_EMAIL_PROCESSING)),
    __param(6, (0, common_1.Optional)()),
    __param(6, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_KNOWLEDGE_INDEXING)),
    __param(7, (0, common_1.Optional)()),
    __param(7, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_ANALYTICS)),
    __param(8, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        database_service_1.DatabaseService])
], QueuesService);
//# sourceMappingURL=queues.service.js.map