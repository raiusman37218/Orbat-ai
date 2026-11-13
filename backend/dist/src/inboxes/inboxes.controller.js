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
exports.InboxesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const inboxes_service_1 = require("./inboxes.service");
const current_workspace_decorator_1 = require("../common/decorators/current-workspace.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let InboxesController = class InboxesController {
    constructor(inboxesService) {
        this.inboxesService = inboxesService;
    }
    async getOverview(workspaceId, user) {
        return this.inboxesService.getInboxOverview(workspaceId, user);
    }
    async getMyAssigned(workspaceId, user, page, limit) {
        return this.inboxesService.getMyAssigned(workspaceId, user, page ? Number(page) : 1, limit ? Number(limit) : 25);
    }
    async getUnassigned(workspaceId, page, limit) {
        return this.inboxesService.getUnassigned(workspaceId, page ? Number(page) : 1, limit ? Number(limit) : 25);
    }
    async getWaitingHandoff(workspaceId, page, limit) {
        return this.inboxesService.getWaitingHandoff(workspaceId, page ? Number(page) : 1, limit ? Number(limit) : 25);
    }
    async autoAssign(workspaceId, conversationId) {
        return this.inboxesService.autoAssignNext(workspaceId, conversationId);
    }
};
exports.InboxesController = InboxesController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, swagger_1.ApiOperation)({ summary: 'Get summary counts for all inbox queues (my assigned, unassigned, waiting handoff, etc.)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Overview counts returned.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InboxesController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)('my-assigned'),
    (0, swagger_1.ApiOperation)({ summary: 'Get open conversations assigned to the current agent' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated list of assigned conversations.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], InboxesController.prototype, "getMyAssigned", null);
__decorate([
    (0, common_1.Get)('unassigned'),
    (0, swagger_1.ApiOperation)({ summary: 'Get unassigned open conversations waiting for triage' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated list of unassigned conversations.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", Promise)
], InboxesController.prototype, "getUnassigned", null);
__decorate([
    (0, common_1.Get)('waiting-handoff'),
    (0, swagger_1.ApiOperation)({ summary: 'Get conversations waiting for human agent handoff or in offline queue' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of handoff conversations.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", Promise)
], InboxesController.prototype, "getWaitingHandoff", null);
__decorate([
    (0, common_1.Post)(':conversationId/auto-assign'),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger round-robin / workload-based auto assignment to next available agent' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Auto-assignment result.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], InboxesController.prototype, "autoAssign", null);
exports.InboxesController = InboxesController = __decorate([
    (0, swagger_1.ApiTags)('Inboxes & Queues'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('inboxes'),
    __metadata("design:paramtypes", [inboxes_service_1.InboxesService])
], InboxesController);
//# sourceMappingURL=inboxes.controller.js.map