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
exports.WidgetController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../common/decorators/public.decorator");
const widget_service_1 = require("./widget.service");
let WidgetController = class WidgetController {
    constructor(widgetService) {
        this.widgetService = widgetService;
    }
    async getConfig(workspaceId) {
        return this.widgetService.getConfig(workspaceId);
    }
    async getAgents(workspaceId) {
        return this.widgetService.getAgents(workspaceId);
    }
    async session(body) {
        return this.widgetService.createOrVerifySession(body);
    }
    async listConversations(visitorId, token) {
        return this.widgetService.listConversations(visitorId, token);
    }
    async startConversation(body) {
        return this.widgetService.startConversation(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, Boolean(body.forceNew ?? body.p_force_new));
    }
    async getMessages(conversationId, visitorId, token) {
        return this.widgetService.getMessages(visitorId, token, conversationId);
    }
    async sendMessage(conversationId, body) {
        return this.widgetService.sendMessage(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, conversationId, body.content ?? body.p_content ?? '', body.attachmentUrl ?? body.p_attachment_url ?? null);
    }
    async requestHandoff(conversationId, body) {
        return this.widgetService.requestHandoff(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, conversationId, body.reason ?? body.p_reason ?? null);
    }
    async setAiAssist(conversationId, body) {
        return this.widgetService.setAiAssist(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, conversationId, body.enabled ?? body.p_enabled ?? true);
    }
    async setTopic(conversationId, body) {
        return this.widgetService.setTopic(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, conversationId, body.topic ?? body.p_topic ?? '');
    }
    async markResolved(conversationId, body) {
        return this.widgetService.markResolved(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, conversationId);
    }
    async saveWelcome(conversationId, body) {
        return this.widgetService.saveWelcome(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, conversationId, body.content ?? body.p_content ?? '');
    }
    async heartbeat(body) {
        return this.widgetService.heartbeat(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, body);
    }
    async recordPage(body) {
        return this.widgetService.recordPage(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, body);
    }
    async updateMeta(body) {
        return this.widgetService.updateMeta(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, body);
    }
    async updateVisitor(body) {
        return this.widgetService.updateVisitor(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, body);
    }
    async offline(body) {
        return this.widgetService.markOffline(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token);
    }
    async mark(body) {
        return this.widgetService.markMessages(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, body.conversationId ?? body.p_conversation_id, body.read ?? body.p_read ?? true);
    }
    async submitCsat(body) {
        return this.widgetService.submitCsat(body.visitorId ?? body.p_visitor_id, body.token ?? body.p_token, body.conversationId ?? body.p_conversation_id, body.rating, body.feedback ?? null);
    }
    async rpc(fnName, body) {
        return this.widgetService.invokeWhitelistedRpc(fnName, body || {});
    }
};
exports.WidgetController = WidgetController;
__decorate([
    (0, common_1.Get)('config'),
    (0, swagger_1.ApiOperation)({ summary: 'Get public widget configuration for a workspace' }),
    __param(0, (0, common_1.Query)('workspaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Get)('agents'),
    (0, swagger_1.ApiOperation)({ summary: 'Get sanitized workspace agent presence and avatars for widget' }),
    __param(0, (0, common_1.Query)('workspaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "getAgents", null);
__decorate([
    (0, common_1.Post)('session'),
    (0, swagger_1.ApiOperation)({ summary: 'Create or verify visitor session token for widget' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "session", null);
__decorate([
    (0, common_1.Get)('conversations'),
    (0, swagger_1.ApiOperation)({ summary: 'List visitor conversations' }),
    __param(0, (0, common_1.Query)('visitorId')),
    __param(1, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "listConversations", null);
__decorate([
    (0, common_1.Post)('conversations/start'),
    (0, swagger_1.ApiOperation)({ summary: 'Start or resume visitor conversation' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "startConversation", null);
__decorate([
    (0, common_1.Get)('conversations/:id/messages'),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch visitor conversation messages' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('visitorId')),
    __param(2, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages'),
    (0, swagger_1.ApiOperation)({ summary: 'Send visitor message via widget' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('conversations/:id/handoff'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "requestHandoff", null);
__decorate([
    (0, common_1.Post)('conversations/:id/ai-assist'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "setAiAssist", null);
__decorate([
    (0, common_1.Post)('conversations/:id/topic'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "setTopic", null);
__decorate([
    (0, common_1.Post)('conversations/:id/resolve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "markResolved", null);
__decorate([
    (0, common_1.Post)('conversations/:id/welcome'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "saveWelcome", null);
__decorate([
    (0, common_1.Post)('heartbeat'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "heartbeat", null);
__decorate([
    (0, common_1.Post)('pageview'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "recordPage", null);
__decorate([
    (0, common_1.Post)('meta'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "updateMeta", null);
__decorate([
    (0, common_1.Post)('visitor'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "updateVisitor", null);
__decorate([
    (0, common_1.Post)('offline'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "offline", null);
__decorate([
    (0, common_1.Post)('mark'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "mark", null);
__decorate([
    (0, common_1.Post)('csat'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "submitCsat", null);
__decorate([
    (0, common_1.Post)('rpc/:fnName'),
    (0, swagger_1.ApiOperation)({ summary: 'Execute a whitelisted fn_widget_* RPC cleanly through NestJS' }),
    __param(0, (0, common_1.Param)('fnName')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WidgetController.prototype, "rpc", null);
exports.WidgetController = WidgetController = __decorate([
    (0, swagger_1.ApiTags)('Widget'),
    (0, public_decorator_1.Public)(),
    (0, common_1.Controller)('widget'),
    __metadata("design:paramtypes", [widget_service_1.WidgetService])
], WidgetController);
//# sourceMappingURL=widget.controller.js.map