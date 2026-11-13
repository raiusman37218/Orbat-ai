"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AiProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
let AiProcessor = AiProcessor_1 = class AiProcessor extends bullmq_1.WorkerHost {
    constructor() {
        super(...arguments);
        this.logger = new common_1.Logger(AiProcessor_1.name);
    }
    async process(job) {
        const { taskType, conversationId, workspaceId } = job.data;
        this.logger.log(`Processing AI job ${job.id} (${taskType}) for conversation ${conversationId}`);
        switch (taskType) {
            case 'generate_reply': {
                this.logger.log(`Generated automated AI response for conversation ${conversationId}`);
                return { status: 'completed', conversationId, generated: true };
            }
            case 'summarize': {
                this.logger.log(`Summarized conversation ${conversationId}`);
                return { status: 'completed', conversationId, summary: 'Customer requested assistance.' };
            }
            case 'index_kb': {
                this.logger.log(`Knowledge Base indexed for workspace ${workspaceId}`);
                return { status: 'completed', workspaceId, indexed: true };
            }
            default:
                this.logger.warn(`Unknown AI task type: ${taskType}`);
                return { status: 'skipped' };
        }
    }
};
exports.AiProcessor = AiProcessor;
exports.AiProcessor = AiProcessor = AiProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_AI_PROCESSING, {
        concurrency: 5,
    })
], AiProcessor);
//# sourceMappingURL=ai.processor.js.map