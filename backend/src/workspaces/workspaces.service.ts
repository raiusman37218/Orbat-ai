import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

function sanitizeAiSettings(aiSettings: any): any {
  if (!aiSettings || typeof aiSettings !== 'object') return aiSettings;
  const copy: Record<string, any> = {};
  for (const [k, v] of Object.entries(aiSettings)) {
    if (/(api_?key|secret|token|password)/i.test(k)) {
      if (typeof v === 'string' && v.trim()) {
        copy[`has_${k}`] = true;
        copy[`${k}_last4`] = v.trim().slice(-4);
      }
      continue;
    }
    copy[k] = v;
  }
  return copy;
}

function sanitizeWorkspaceRow(row: any) {
  if (!row || typeof row !== 'object') return row;
  if ('ai_settings' in row) {
    return { ...row, ai_settings: sanitizeAiSettings(row.ai_settings) };
  }
  return row;
}

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(private readonly db: DatabaseService) {}

  async getWorkspace(workspaceId: string) {
    const result = await this.db.query(
      `SELECT id, name, website_url, brand_color, logo_url, greeting_title, greeting_message,
              widget_position, widget_icon, slug, custom_domain, custom_domain_status,
              business_hours, ai_settings, timezone, language, handoff_settings, plan,
              is_suspended, created_at
       FROM public.workspaces
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [workspaceId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found.`);
    }

    return sanitizeWorkspaceRow(result.rows[0]);
  }

  async updateWorkspace(workspaceId: string, dto: UpdateWorkspaceDto) {
    // Verify workspace exists
    await this.getWorkspace(workspaceId);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(dto.name.trim());
    }
    if (dto.websiteUrl !== undefined) {
      fields.push(`website_url = $${idx++}`);
      values.push(dto.websiteUrl.trim());
    }
    if (dto.brandColor !== undefined) {
      fields.push(`brand_color = $${idx++}`);
      values.push(dto.brandColor.trim());
    }
    if (dto.logoUrl !== undefined) {
      fields.push(`logo_url = $${idx++}`);
      values.push(dto.logoUrl.trim());
    }
    if (dto.greetingTitle !== undefined) {
      fields.push(`greeting_title = $${idx++}`);
      values.push(dto.greetingTitle.trim());
    }
    if (dto.greetingMessage !== undefined) {
      fields.push(`greeting_message = $${idx++}`);
      values.push(dto.greetingMessage.trim());
    }
    if (dto.widgetPosition !== undefined) {
      fields.push(`widget_position = $${idx++}`);
      values.push(dto.widgetPosition);
    }
    if (dto.timezone !== undefined) {
      fields.push(`timezone = $${idx++}`);
      values.push(dto.timezone);
    }
    if (dto.language !== undefined) {
      fields.push(`language = $${idx++}`);
      values.push(dto.language);
    }
    if (dto.businessHours !== undefined) {
      fields.push(`business_hours = $${idx++}`);
      values.push(JSON.stringify(dto.businessHours));
    }
    if (dto.aiSettings !== undefined) {
      fields.push(`ai_settings = $${idx++}`);
      values.push(JSON.stringify(dto.aiSettings));
    }
    if (dto.handoffSettings !== undefined) {
      fields.push(`handoff_settings = $${idx++}`);
      values.push(JSON.stringify(dto.handoffSettings));
    }

    if (fields.length === 0) {
      return this.getWorkspace(workspaceId);
    }

    values.push(workspaceId);
    const sql = `
      UPDATE public.workspaces
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, name, website_url, brand_color, logo_url, greeting_title, greeting_message,
                widget_position, timezone, language, business_hours, ai_settings, handoff_settings
    `;

    const result = await this.db.query(sql, values);
    return sanitizeWorkspaceRow(result.rows[0]);
  }

  async getMembers(workspaceId: string) {
    const result = await this.db.query(
      `SELECT id, name, email, avatar_url, role, status, is_active, max_open_tickets, created_at
       FROM public.agents
       WHERE workspace_id = $1 AND is_active = true
       ORDER BY created_at ASC`,
      [workspaceId],
    );
    return result.rows;
  }

  async getWorkspaceStats(workspaceId: string) {
    const [convStats, agentStats, visitorStats] = await Promise.all([
      this.db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'open') as open_conversations,
           COUNT(*) FILTER (WHERE status = 'closed') as closed_conversations,
           COUNT(*) FILTER (WHERE handoff_status = 'waiting_for_agent') as waiting_handoffs,
           COUNT(*) FILTER (WHERE handoff_status = 'offline_queued') as offline_queued
         FROM public.conversations
         WHERE workspace_id = $1`,
        [workspaceId],
      ),
      this.db.query(
        `SELECT
           COUNT(*) as total_agents,
           COUNT(*) FILTER (WHERE status = 'online') as online_agents,
           COUNT(*) FILTER (WHERE status = 'away') as away_agents
         FROM public.agents
         WHERE workspace_id = $1 AND is_active = true`,
        [workspaceId],
      ),
      this.db.query(
        `SELECT
           COUNT(*) as total_visitors,
           COUNT(*) FILTER (WHERE is_online = true) as online_visitors
         FROM public.visitors
         WHERE workspace_id = $1`,
        [workspaceId],
      ),
    ]);

    return {
      conversations: {
        open: parseInt(convStats.rows[0]?.open_conversations || '0', 10),
        closed: parseInt(convStats.rows[0]?.closed_conversations || '0', 10),
        waitingHandoff: parseInt(convStats.rows[0]?.waiting_handoffs || '0', 10),
        offlineQueued: parseInt(convStats.rows[0]?.offline_queued || '0', 10),
      },
      agents: {
        total: parseInt(agentStats.rows[0]?.total_agents || '0', 10),
        online: parseInt(agentStats.rows[0]?.online_agents || '0', 10),
        away: parseInt(agentStats.rows[0]?.away_agents || '0', 10),
      },
      visitors: {
        total: parseInt(visitorStats.rows[0]?.total_visitors || '0', 10),
        online: parseInt(visitorStats.rows[0]?.online_visitors || '0', 10),
      },
    };
  }
}

