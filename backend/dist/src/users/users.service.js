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
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const database_service_1 = require("../database/database.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let UsersService = UsersService_1 = class UsersService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(UsersService_1.name);
    }
    async getAgents(workspaceId) {
        const result = await this.db.query(`SELECT id, name, email, avatar_url, role, status, is_active, max_open_tickets, created_at
       FROM public.agents
       WHERE workspace_id = $1
       ORDER BY role = 'owner' DESC, created_at ASC`, [workspaceId]);
        return result.rows;
    }
    async getAgentById(workspaceId, agentId) {
        const result = await this.db.query(`SELECT id, name, email, avatar_url, role, status, is_active, max_open_tickets, created_at
       FROM public.agents
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`, [agentId, workspaceId]);
        if (result.rows.length === 0) {
            throw new common_1.NotFoundException(`Agent with ID ${agentId} not found in this workspace.`);
        }
        return result.rows[0];
    }
    async createAgent(workspaceId, dto, actor) {
        if (actor.role !== 'owner' && actor.role !== 'admin' && !actor.isSuperAdmin) {
            throw new common_1.ForbiddenException('Only workspace owners and admins can add team members.');
        }
        const emailNormalized = dto.email.trim().toLowerCase();
        const existing = await this.db.query('SELECT id, workspace_id FROM public.agents WHERE LOWER(email) = $1 LIMIT 1', [emailNormalized]);
        if (existing.rows.length > 0) {
            if (existing.rows[0].workspace_id === workspaceId) {
                throw new common_1.ConflictException('This user is already a member of this workspace.');
            }
            throw new common_1.ConflictException('This email is already associated with another workspace account.');
        }
        const rawPassword = dto.password || Math.random().toString(36).slice(-10) + 'Orbat1!';
        const passwordHash = await bcrypt.hash(rawPassword, 10);
        const result = await this.db.query(`INSERT INTO public.agents (id, name, email, role, status, workspace_id, password_hash, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, 'offline', $4, $5, true)
       RETURNING id, name, email, role, status, is_active, created_at`, [dto.name.trim(), emailNormalized, dto.role, workspaceId, passwordHash]);
        this.logger.log(`New agent created: ${emailNormalized} (Role: ${dto.role}) in workspace ${workspaceId}`);
        return {
            ...result.rows[0],
            initialPassword: dto.password ? undefined : rawPassword,
        };
    }
    async updateAgent(workspaceId, agentId, dto, actor) {
        const targetAgent = await this.getAgentById(workspaceId, agentId);
        if (targetAgent.role === 'owner' && dto.role && dto.role !== 'owner' && actor.id !== agentId) {
            throw new common_1.ForbiddenException('Cannot modify the workspace owner role.');
        }
        if (dto.role && (dto.role === 'admin' || dto.role === 'owner') && actor.role !== 'owner' && !actor.isSuperAdmin) {
            throw new common_1.ForbiddenException('Only the workspace owner can promote users to Admin or Owner.');
        }
        const fields = [];
        const values = [];
        let idx = 1;
        if (dto.name !== undefined) {
            fields.push(`name = $${idx++}`);
            values.push(dto.name.trim());
        }
        if (dto.avatarUrl !== undefined) {
            fields.push(`avatar_url = $${idx++}`);
            values.push(dto.avatarUrl.trim());
        }
        if (dto.role !== undefined) {
            fields.push(`role = $${idx++}`);
            values.push(dto.role);
        }
        if (dto.status !== undefined) {
            fields.push(`status = $${idx++}`);
            values.push(dto.status);
        }
        if (dto.isActive !== undefined) {
            fields.push(`is_active = $${idx++}`);
            values.push(dto.isActive);
            if (!dto.isActive) {
                fields.push(`deactivated_at = now()`);
            }
        }
        if (dto.maxOpenTickets !== undefined) {
            fields.push(`max_open_tickets = $${idx++}`);
            values.push(dto.maxOpenTickets);
        }
        if (fields.length === 0) {
            return targetAgent;
        }
        values.push(agentId, workspaceId);
        const sql = `
      UPDATE public.agents
      SET ${fields.join(', ')}
      WHERE id = $${idx++} AND workspace_id = $${idx}
      RETURNING id, name, email, avatar_url, role, status, is_active, max_open_tickets, created_at
    `;
        const result = await this.db.query(sql, values);
        (0, jwt_auth_guard_1.invalidateAuthStateCache)(agentId);
        return result.rows[0];
    }
    async updateMyStatus(workspaceId, agentId, status) {
        const result = await this.db.query(`UPDATE public.agents
       SET status = $1
       WHERE id = $2 AND workspace_id = $3
       RETURNING id, name, email, status`, [status, agentId, workspaceId]);
        if (result.rows.length === 0) {
            throw new common_1.NotFoundException('Agent not found.');
        }
        const manualStatus = status === 'offline' ? 'away' : status;
        await this.db.query(`INSERT INTO public.agent_status (agent_id, workspace_id, manual_status, last_heartbeat, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT (agent_id)
       DO UPDATE SET workspace_id = $2, manual_status = $3, last_heartbeat = now(), updated_at = now()`, [agentId, workspaceId, manualStatus]).catch(() => { });
        return result.rows[0];
    }
    async deactivateAgent(workspaceId, agentId, actor) {
        if (actor.id === agentId) {
            throw new common_1.BadRequestException('You cannot deactivate your own account.');
        }
        const agent = await this.getAgentById(workspaceId, agentId);
        if (agent.role === 'owner') {
            throw new common_1.ForbiddenException('Cannot deactivate the workspace owner.');
        }
        await this.db.query(`UPDATE public.agents
       SET is_active = false, status = 'offline', deactivated_at = now()
       WHERE id = $1 AND workspace_id = $2`, [agentId, workspaceId]);
        (0, jwt_auth_guard_1.invalidateAuthStateCache)(agentId);
        return { success: true, message: `Agent ${agent.name} has been deactivated.` };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], UsersService);
//# sourceMappingURL=users.service.js.map