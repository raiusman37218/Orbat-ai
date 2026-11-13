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
const queue_constants_1 = require("./queue.constants");
let QueuesService = QueuesService_1 = class QueuesService {
    constructor(aiQueue, notificationsQueue, automationsQueue, webhooksQueue) {
        this.aiQueue = aiQueue;
        this.notificationsQueue = notificationsQueue;
        this.automationsQueue = automationsQueue;
        this.webhooksQueue = webhooksQueue;
        this.logger = new common_1.Logger(QueuesService_1.name);
    }
    async enqueueAiTask(data, opts) {
        const job = await this.aiQueue.add(data.taskType, data, {
            priority: data.taskType === 'generate_reply' ? 1 : 5,
            ...opts,
        });
        this.logger.log(`Enqueued AI task ${data.taskType} (${job.id}) for conversation ${data.conversationId}`);
        return job;
    }
    async enqueueNotification(data, opts) {
        const job = await this.notificationsQueue.add(data.template, data, opts);
        this.logger.log(`Enqueued notification ${data.template} (${job.id}) to ${data.recipientEmail}`);
        return job;
    }
    async enqueueAutomation(data, opts) {
        const job = await this.automationsQueue.add(data.action, data, opts);
        this.logger.log(`Enqueued automation ${data.action} (${job.id}) for workspace ${data.workspaceId}`);
        return job;
    }
    async enqueueWebhook(data, opts) {
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
            [queue_constants_1.QUEUE_AI_PROCESSING]: aiCounts,
            [queue_constants_1.QUEUE_NOTIFICATIONS]: notifCounts,
            [queue_constants_1.QUEUE_AUTOMATIONS]: autoCounts,
            [queue_constants_1.QUEUE_WEBHOOKS]: hookCounts,
        };
    }
};
exports.QueuesService = QueuesService;
exports.QueuesService = QueuesService = QueuesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_AI_PROCESSING)),
    __param(1, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_NOTIFICATIONS)),
    __param(2, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_AUTOMATIONS)),
    __param(3, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_WEBHOOKS)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue])
], QueuesService);
//# sourceMappingURL=queues.service.js.map