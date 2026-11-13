"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WebhooksProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
let WebhooksProcessor = WebhooksProcessor_1 = class WebhooksProcessor extends bullmq_1.WorkerHost {
    constructor() {
        super(...arguments);
        this.logger = new common_1.Logger(WebhooksProcessor_1.name);
    }
    async process(job) {
        const { event, endpointUrl, payload } = job.data;
        this.logger.log(`Dispatching webhook event ${event} to ${endpointUrl}`);
        return {
            delivered: true,
            statusCode: 200,
            endpointUrl,
            event,
        };
    }
};
exports.WebhooksProcessor = WebhooksProcessor;
exports.WebhooksProcessor = WebhooksProcessor = WebhooksProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_WEBHOOKS, {
        concurrency: 5,
    })
], WebhooksProcessor);
//# sourceMappingURL=webhooks.processor.js.map