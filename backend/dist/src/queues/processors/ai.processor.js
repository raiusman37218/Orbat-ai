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
var AiProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
const ai_engine_service_1 = require("../../ai-engine/ai-engine.service");
const queues_service_1 = require("../queues.service");
const base_processor_1 = require("./base.processor");
let AiProcessor = AiProcessor_1 = class AiProcessor extends base_processor_1.BaseQueueProcessor {
    constructor(aiEngine, queuesService) {
        super(queuesService);
        this.aiEngine = aiEngine;
        this.logger = new common_1.Logger(AiProcessor_1.name);
    }
    async process(job) {
        const { taskType, conversationId, workspaceId, triggerMessage, triggerMessageId, metadata } = job.data;
        this.logger.log(`Processing AI job ${job.id} (${taskType}) for conversation ${conversationId}`);
        switch (taskType) {
            case 'generate_reply': {
                if (!this.aiEngine) {
                    throw new Error('AiEngineService unavailable in worker context');
                }
                const promptText = String(triggerMessage || metadata?.content || '').trim();
                if (!promptText) {
                    return { status: 'skipped', reason: 'empty_trigger_message' };
                }
                return this.aiEngine.generateBotResponse(workspaceId, conversationId, promptText, triggerMessageId);
            }
            case 'summarize': {
                if (!this.aiEngine) {
                    throw new Error('AiEngineService unavailable in worker context');
                }
                return this.aiEngine.summarizeConversation(workspaceId, conversationId);
            }
            case 'index_kb': {
                if (this.queuesService && metadata?.knowledgeId) {
                    const queued = await this.queuesService.enqueueKnowledgeIndexing({
                        workspaceId,
                        knowledgeId: String(metadata.knowledgeId),
                        title: metadata.title,
                        content: metadata.content,
                        action: 'reindex_document',
                        idempotencyKey: `kb-${workspaceId}-${metadata.knowledgeId}`,
                    });
                    return { status: 'forwarded_to_knowledge_indexing', jobId: queued.id };
                }
                return { status: 'skipped', reason: 'missing_knowledge_id' };
            }
            case 'suggest_macros': {
                if (!this.aiEngine) {
                    throw new Error('AiEngineService unavailable in worker context');
                }
                return this.aiEngine.suggestCopilotReply(workspaceId, conversationId);
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
        concurrency: 3,
        lockDuration: 60_000,
    }),
    __param(0, (0, common_1.Optional)()),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [ai_engine_service_1.AiEngineService,
        queues_service_1.QueuesService])
], AiProcessor);
//# sourceMappingURL=ai.processor.js.map