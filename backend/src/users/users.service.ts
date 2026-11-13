import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly db: DatabaseService) {}

  async getAgents(workspaceId: string) {
    const result = await this.db.query(
      `SELECT id, name, email, avatar_url, role, status, is_active, max_open_tickets, created_at
       FROM public.agents
       WHERE workspace_id = $1
       ORDER BY role = 'owner' DESC, created_at ASC`,
      [workspaceId],
    );
    return result.rows;
  }

  async getAgentById(workspaceId: string, agentId: string) {
    const result = await this.db.query(
      `SELECT id, name, email, avatar_url, role, status, is_active, max_open_tickets, created_at
       FROM public.agents
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`,
      [agentId, workspaceId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Agent with ID ${agentId} not found in this workspace.`);
    }

    return result.rows[0];
  }

  async createAgent(workspaceId: string, dto: CreateAgentDto, actor: AuthenticatedUser) {
    // Only owner or admin can add team members
    if (actor.role !== 'owner' && actor.role !== 'admin' && !actor.isSuperAdmin) {
      throw new ForbiddenException('Only workspace owners and admins can add team members.');
    }

    const emailNormalized = dto.email.trim().toLowerCase();

    // Check if email already exists globally in any workspace
    const existing = await this.db.query(
      'SELECT id, workspace_id FROM public.agents WHERE LOWER(email) = $1 LIMIT 1',
      [emailNormalized],
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].workspace_id === workspaceId) {
        throw new ConflictException('This user is already a member of this workspace.');
      }
      throw new ConflictException('This email is already associated with another workspace account.');
    }

    // Default or user-provided password
    const rawPassword = dto.password || Math.random().toString(36).slice(-10) + 'Orbat1!';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const result = await this.db.query(
      `INSERT INTO public.agents (id, name, email, role, status, workspace_id, password_hash, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, 'offline', $4, $5, true)
       RETURNING id, name, email, role, status, is_active, created_at`,
      [dto.name.trim(), emailNormalized, dto.role, workspaceId, passwordHash],
    );

    this.logger.log(`New agent created: ${emailNormalized} (Role: ${dto.role}) in workspace ${workspaceId}`);
    return {
      ...result.rows[0],
      initialPassword: dto.password ? undefined : rawPassword, // returned once if generated
    };
  }

  async updateAgent(
    workspaceId: string,
    agentId: string,
    dto: UpdateAgentDto,
    actor: AuthenticatedUser,
  ) {
    const targetAgent = await this.getAgentById(workspaceId, agentId);

    // Guard: Nobody can change the owner's role or deactivate the owner except the owner themselves
    if (targetAgent.role === 'owner' && dto.role && dto.role !== 'owner' && actor.id !== agentId) {
      throw new ForbiddenException('Cannot modify the workspace owner role.');
    }

    // Guard: Only owner can grant admin/owner roles
    if (dto.role && (dto.role === 'admin' || dto.role === 'owner') && actor.role !== 'owner' && !actor.isSuperAdmin) {
      throw new ForbiddenException('Only the workspace owner can promote users to Admin or Owner.');
    }

    const fields: string[] = [];
    const values: any[] = [];
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
    return result.rows[0];
  }

  async updateMyStatus(workspaceId: string, agentId: string, status: 'online' | 'away' | 'offline') {
    const result = await this.db.query(
      `UPDATE public.agents
       SET status = $1
       WHERE id = $2 AND workspace_id = $3
       RETURNING id, name, email, status`,
      [status, agentId, workspaceId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Agent not found.');
    }

    // Sync agent_status table (table constraint allows 'online' or 'away')
    const manualStatus = status === 'offline' ? 'away' : status;
    await this.db.query(
      `INSERT INTO public.agent_status (agent_id, workspace_id, manual_status, last_heartbeat)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (agent_id, workspace_id)
       DO UPDATE SET manual_status = $3, last_heartbeat = now()`,
      [agentId, workspaceId, manualStatus],
    ).catch(() => {});

    return result.rows[0];
  }

  async deactivateAgent(workspaceId: string, agentId: string, actor: AuthenticatedUser) {
    if (actor.id === agentId) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    const agent = await this.getAgentById(workspaceId, agentId);
    if (agent.role === 'owner') {
      throw new ForbiddenException('Cannot deactivate the workspace owner.');
    }

    await this.db.query(
      `UPDATE public.agents
       SET is_active = false, status = 'offline', deactivated_at = now()
       WHERE id = $1 AND workspace_id = $2`,
      [agentId, workspaceId],
    );

    return { success: true, message: `Agent ${agent.name} has been deactivated.` };
  }
}

