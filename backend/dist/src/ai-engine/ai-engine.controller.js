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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiEngineController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ai_engine_service_1 = require("./ai-engine.service");
const ai_usage_service_1 = require("./ai-usage.service");
const generate_reply_dto_1 = require("./dto/generate-reply.dto");
let AiEngineController = class AiEngineController {
    constructor(aiService, aiUsage) {
        this.aiService = aiService;
        this.aiUsage = aiUsage;
    }
    async generateReply(workspaceId, dto) {
        return this.aiService.generateBotResponse(workspaceId, dto.conversationId, dto.triggerMessage, dto.triggerMessageId);
    }
    async copilotSuggest(workspaceId, conversationId) {
        return this.aiService.suggestCopilotReply(workspaceId, conversationId);
    }
    async summarize(workspaceId, conversationId) {
        return this.aiService.summarizeConversation(workspaceId, conversationId);
    }
    async getUsageMetrics(workspaceId) {
        return this.aiUsage.getWorkspaceAiMetrics(workspaceId);
    }
};
exports.AiEngineController = AiEngineController;
__decorate([
    (0, common_1.Post)('generate-reply'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate grounded AI bot reply for conversation' }),
    __param(0, (0, common_1.Param)('workspaceId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generate_reply_dto_1.GenerateAiReplyDto]),
    __metadata("design:returntype", Promise)
], AiEngineController.prototype, "generateReply", null);
__decorate([
    (0, common_1.Post)('conversations/:id/copilot-suggest'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate agent copilot reply suggestions' }),
    __param(0, (0, common_1.Param)('workspaceId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AiEngineController.prototype, "copilotSuggest", null);
__decorate([
    (0, common_1.Post)('conversations/:id/summarize'),
    (0, swagger_1.ApiOperation)({ summary: 'Summarize conversation messages for handoff' }),
    __param(0, (0, common_1.Param)('workspaceId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AiEngineController.prototype, "summarize", null);
__decorate([
    (0, common_1.Get)('usage'),
    (0, swagger_1.ApiOperation)({ summary: 'Get workspace AI token usage and accounting metrics' }),
    __param(0, (0, common_1.Param)('workspaceId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AiEngineController.prototype, "getUsageMetrics", null);
exports.AiEngineController = AiEngineController = __decorate([
    (0, swagger_1.ApiTags)('AI Engine'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('workspaces/:workspaceId/ai'),
    __metadata("design:paramtypes", [ai_engine_service_1.AiEngineService,
        ai_usage_service_1.AiUsageService])
], AiEngineController);
//# sourceMappingURL=ai-engine.controller.js.map