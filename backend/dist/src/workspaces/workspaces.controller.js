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
exports.WorkspacesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const workspaces_service_1 = require("./workspaces.service");
const update_workspace_dto_1 = require("./dto/update-workspace.dto");
const current_workspace_decorator_1 = require("../common/decorators/current-workspace.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
let WorkspacesController = class WorkspacesController {
    constructor(workspacesService) {
        this.workspacesService = workspacesService;
    }
    async getCurrentWorkspace(workspaceId) {
        return this.workspacesService.getWorkspace(workspaceId);
    }
    async updateCurrentWorkspace(workspaceId, dto) {
        return this.workspacesService.updateWorkspace(workspaceId, dto);
    }
    async getMembers(workspaceId) {
        return this.workspacesService.getMembers(workspaceId);
    }
    async getStats(workspaceId) {
        return this.workspacesService.getWorkspaceStats(workspaceId);
    }
};
exports.WorkspacesController = WorkspacesController;
__decorate([
    (0, common_1.Get)('current'),
    (0, swagger_1.ApiOperation)({ summary: 'Get details of the current workspace' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Workspace details retrieved.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "getCurrentWorkspace", null);
__decorate([
    (0, common_1.Patch)('current'),
    (0, roles_decorator_1.Roles)('owner', 'admin'),
    (0, swagger_1.ApiOperation)({ summary: 'Update workspace branding, settings, or business hours (Owner / Admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Workspace updated successfully.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_workspace_dto_1.UpdateWorkspaceDto]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "updateCurrentWorkspace", null);
__decorate([
    (0, common_1.Get)('current/members'),
    (0, swagger_1.ApiOperation)({ summary: 'List all active agents in the current workspace' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of members returned.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "getMembers", null);
__decorate([
    (0, common_1.Get)('current/stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get live real-time metrics and conversation counters' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Aggregated workspace stats returned.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "getStats", null);
exports.WorkspacesController = WorkspacesController = __decorate([
    (0, swagger_1.ApiTags)('Workspaces'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('workspaces'),
    __metadata("design:paramtypes", [workspaces_service_1.WorkspacesService])
], WorkspacesController);
//# sourceMappingURL=workspaces.controller.js.map