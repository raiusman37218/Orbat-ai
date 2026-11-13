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
var WebhooksProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksProcessor = void 0;
const crypto = require("node:crypto");
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
const url_safety_1 = require("../../common/security/url-safety");
const queues_service_1 = require("../queues.service");
const base_processor_1 = require("./base.processor");
let WebhooksProcessor = WebhooksProcessor_1 = class WebhooksProcessor extends base_processor_1.BaseQueueProcessor {
    constructor(queuesService) {
        super(queuesService);
        this.logger = new common_1.Logger(WebhooksProcessor_1.name);
    }
    async process(job) {
        const { event, endpointUrl, payload, secretKey, workspaceId } = job.data;
        const verifiedUrl = await (0, url_safety_1.resolveAndVerifyPublicHttpsUrl)(endpointUrl);
        const body = JSON.stringify({
            event,
            workspaceId,
            timestamp: new Date().toISOString(),
            data: payload,
        });
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'OrbatAI-Webhook-Worker/1.0',
            'X-Orbat-Event': event,
        };
        if (secretKey) {
            headers['X-Orbat-Signature'] = crypto
                .createHmac('sha256', secretKey)
                .update(body)
                .digest('hex');
        }
        const res = await fetch(verifiedUrl.toString(), {
            method: 'POST',
            headers,
            body,
            redirect: 'manual',
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`Webhook target returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }
        this.logger.log(`Delivered webhook ${event} (${job.id}) -> HTTP ${res.status}`);
        return {
            delivered: true,
            statusCode: res.status,
            event,
        };
    }
};
exports.WebhooksProcessor = WebhooksProcessor;
exports.WebhooksProcessor = WebhooksProcessor = WebhooksProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_WEBHOOKS, {
        concurrency: 5,
        lockDuration: 30_000,
    }),
    __param(0, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [queues_service_1.QueuesService])
], WebhooksProcessor);
//# sourceMappingURL=webhooks.processor.js.map