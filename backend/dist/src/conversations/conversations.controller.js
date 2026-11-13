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
exports.ConversationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const conversations_service_1 = require("./conversations.service");
const query_conversations_dto_1 = require("./dto/query-conversations.dto");
const create_conversation_dto_1 = require("./dto/create-conversation.dto");
const update_conversation_dto_1 = require("./dto/update-conversation.dto");
const bulk_update_conversations_dto_1 = require("./dto/bulk-update-conversations.dto");
const current_workspace_decorator_1 = require("../common/decorators/current-workspace.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let ConversationsController = class ConversationsController {
    constructor(conversationsService) {
        this.conversationsService = conversationsService;
    }
    async getConversations(workspaceId, query) {
        return this.conversationsService.getConversations(workspaceId, query);
    }
    async bulkUpdateConversations(workspaceId, dto, actor) {
        return this.conversationsService.bulkUpdate(workspaceId, dto, actor);
    }
    async getConversationById(workspaceId, conversationId) {
        return this.conversationsService.getConversationById(workspaceId, conversationId);
    }
    async createConversation(workspaceId, dto) {
        return this.conversationsService.createConversation(workspaceId, dto);
    }
    async updateConversation(workspaceId, conversationId, dto) {
        return this.conversationsService.updateConversation(workspaceId, conversationId, dto);
    }
    async assignConversation(workspaceId, conversationId, agentId, actor) {
        return this.conversationsService.assignConversation(workspaceId, conversationId, agentId, actor);
    }
    async claimHandoff(workspaceId, conversationId, agent) {
        return this.conversationsService.claimHandoff(workspaceId, conversationId, agent);
    }
    async returnToAi(workspaceId, conversationId, agent) {
        return this.conversationsService.returnToAi(workspaceId, conversationId, agent);
    }
    async closeConversation(workspaceId, conversationId, agent) {
        return this.conversationsService.closeConversation(workspaceId, conversationId, agent);
    }
};
exports.ConversationsController = ConversationsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List conversation threads with pagination and status filters' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated list of conversations.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, query_conversations_dto_1.QueryConversationsDto]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "getConversations", null);
__decorate([
    (0, common_1.Post)('bulk'),
    (0, swagger_1.ApiOperation)({ summary: 'Bulk resolve, reopen, assign, or mark spam for conversations' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Bulk conversation action completed.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, bulk_update_conversations_dto_1.BulkUpdateConversationsDto, Object]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "bulkUpdateConversations", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get full conversation thread details by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Conversation thread returned.' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Conversation not found.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "getConversationById", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new conversation thread' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Conversation created.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_conversation_dto_1.CreateConversationDto]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "createConversation", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update conversation status, priority, or tags' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Conversation updated.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_conversation_dto_1.UpdateConversationDto]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "updateConversation", null);
__decorate([
    (0, common_1.Post)(':id/assign'),
    (0, swagger_1.ApiOperation)({ summary: 'Assign conversation to an agent (or unassign)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Conversation assignment updated.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('agentId')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "assignConversation", null);
__decorate([
    (0, common_1.Post)(':id/claim'),
    (0, swagger_1.ApiOperation)({ summary: 'Claim waiting handoff conversation for current agent' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Conversation claimed.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "claimHandoff", null);
__decorate([
    (0, common_1.Post)(':id/return-to-ai'),
    (0, swagger_1.ApiOperation)({ summary: 'Return human-handled conversation back to AI assistant' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returned to AI bot.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "returnToAi", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    (0, swagger_1.ApiOperation)({ summary: 'Close and resolve conversation' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Conversation closed.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "closeConversation", null);
exports.ConversationsController = ConversationsController = __decorate([
    (0, swagger_1.ApiTags)('Conversations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('conversations'),
    __metadata("design:paramtypes", [conversations_service_1.ConversationsService])
], ConversationsController);
//# sourceMappingURL=conversations.controller.js.map