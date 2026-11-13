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
var MessageDeliveryProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageDeliveryProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
const outbox_service_1 = require("../../realtime/outbox.service");
const queues_service_1 = require("../queues.service");
const base_processor_1 = require("./base.processor");
let MessageDeliveryProcessor = MessageDeliveryProcessor_1 = class MessageDeliveryProcessor extends base_processor_1.BaseQueueProcessor {
    constructor(outbox, queuesService) {
        super(queuesService);
        this.outbox = outbox;
        this.logger = new common_1.Logger(MessageDeliveryProcessor_1.name);
    }
    async process(job) {
        const batchSize = Math.min(Math.max(1, job.data.batchSize || 50), 200);
        if (!this.outbox) {
            return { relayed: 0, failed: 0, skipped: 'outbox_unavailable' };
        }
        const result = await this.outbox.relayPendingEvents(batchSize);
        this.logger.debug(`Message delivery job ${job.id}: relayed=${result.relayed}, failed=${result.failed}`);
        return result;
    }
};
exports.MessageDeliveryProcessor = MessageDeliveryProcessor;
exports.MessageDeliveryProcessor = MessageDeliveryProcessor = MessageDeliveryProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_MESSAGE_DELIVERY, {
        concurrency: 10,
        lockDuration: 15_000,
    }),
    __param(0, (0, common_1.Optional)()),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [outbox_service_1.OutboxService,
        queues_service_1.QueuesService])
], MessageDeliveryProcessor);
//# sourceMappingURL=message-delivery.processor.js.map