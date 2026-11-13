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
exports.MessagesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const messages_service_1 = require("./messages.service");
const send_message_dto_1 = require("./dto/send-message.dto");
const update_message_dto_1 = require("./dto/update-message.dto");
const current_workspace_decorator_1 = require("../common/decorators/current-workspace.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let MessagesController = class MessagesController {
    constructor(messagesService) {
        this.messagesService = messagesService;
    }
    async getMessages(workspaceId, conversationId, limit, before) {
        return this.messagesService.getMessages(workspaceId, conversationId, limit ? Number(limit) : 50, before);
    }
    async sendMessage(workspaceId, conversationId, dto, user) {
        return this.messagesService.sendMessage(workspaceId, conversationId, dto, user);
    }
    async editMessage(workspaceId, conversationId, messageId, dto, user) {
        return this.messagesService.editMessage(workspaceId, conversationId, messageId, dto, user);
    }
    async deleteMessage(workspaceId, conversationId, messageId, user) {
        return this.messagesService.deleteMessage(workspaceId, conversationId, messageId, user);
    }
    async markAsRead(workspaceId, conversationId) {
        return this.messagesService.markAsRead(workspaceId, conversationId, 'agent');
    }
    async markAsDelivered(workspaceId, conversationId) {
        return this.messagesService.markAsDelivered(workspaceId, conversationId);
    }
};
exports.MessagesController = MessagesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get messages for a conversation thread' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of messages returned.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('before')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, String]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Send a message or internal note in a conversation' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Message created and delivered.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, send_message_dto_1.SendMessageDto, Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Patch)(':messageId'),
    (0, swagger_1.ApiOperation)({ summary: 'Edit a message in a conversation' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Message updated.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Param)('messageId')),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_message_dto_1.UpdateMessageDto, Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "editMessage", null);
__decorate([
    (0, common_1.Delete)(':messageId'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a message in a conversation' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Message deleted.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Param)('messageId')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "deleteMessage", null);
__decorate([
    (0, common_1.Post)('read'),
    (0, swagger_1.ApiOperation)({ summary: 'Mark messages in conversation as read' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Read receipts recorded.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Post)('deliver'),
    (0, swagger_1.ApiOperation)({ summary: 'Mark messages in conversation as delivered' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Delivery receipts recorded.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "markAsDelivered", null);
exports.MessagesController = MessagesController = __decorate([
    (0, swagger_1.ApiTags)('Messages'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('conversations/:conversationId/messages'),
    __metadata("design:paramtypes", [messages_service_1.MessagesService])
], MessagesController);
//# sourceMappingURL=messages.controller.js.map