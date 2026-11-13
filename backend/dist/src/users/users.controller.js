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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const users_service_1 = require("./users.service");
const create_agent_dto_1 = require("./dto/create-agent.dto");
const update_agent_dto_1 = require("./dto/update-agent.dto");
const current_workspace_decorator_1 = require("../common/decorators/current-workspace.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
let UsersController = class UsersController {
    constructor(usersService) {
        this.usersService = usersService;
    }
    async getAgents(workspaceId) {
        return this.usersService.getAgents(workspaceId);
    }
    async getAgentById(workspaceId, agentId) {
        return this.usersService.getAgentById(workspaceId, agentId);
    }
    async createAgent(workspaceId, dto, actor) {
        return this.usersService.createAgent(workspaceId, dto, actor);
    }
    async updateMyStatus(workspaceId, actor, status) {
        return this.usersService.updateMyStatus(workspaceId, actor.id, status);
    }
    async updateAgent(workspaceId, agentId, dto, actor) {
        return this.usersService.updateAgent(workspaceId, agentId, dto, actor);
    }
    async deactivateAgent(workspaceId, agentId, actor) {
        return this.usersService.deactivateAgent(workspaceId, agentId, actor);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all agents and team members in current workspace' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of agents returned.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getAgents", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get agent profile by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Agent details returned.' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Agent not found.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getAgentById", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('owner', 'admin'),
    (0, swagger_1.ApiOperation)({ summary: 'Create or invite a new agent to the workspace' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Agent created successfully.' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Email already exists.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_agent_dto_1.CreateAgentDto, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "createAgent", null);
__decorate([
    (0, common_1.Patch)('me/status'),
    (0, swagger_1.ApiOperation)({ summary: 'Update current agent status (online, away, offline)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Status updated.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateMyStatus", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('owner', 'admin'),
    (0, swagger_1.ApiOperation)({ summary: 'Update agent profile or permissions' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Agent updated successfully.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_agent_dto_1.UpdateAgentDto, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateAgent", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('owner', 'admin'),
    (0, swagger_1.ApiOperation)({ summary: 'Deactivate an agent' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Agent deactivated.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "deactivateAgent", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Users & Team'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map