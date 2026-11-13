import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/types/tenant-context';

@Injectable()
export class InboxesService {
  private readonly logger = new Logger(InboxesService.name);

  constructor(private readonly db: DatabaseService) {}

  async getInboxOverview(workspaceId: string, user: AuthenticatedUser) {
    const stats = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open' AND assigned_agent_id = $1) as my_assigned,
         COUNT(*) FILTER (WHERE status = 'open' AND assigned_agent_id IS NULL) as unassigned,
         COUNT(*) FILTER (WHERE handoff_status = 'waiting_for_agent') as waiting_handoff,
         COUNT(*) FILTER (WHERE handoff_status = 'offline_queued') as offline_queued,
         COUNT(*) FILTER (WHERE handoff_status = 'bot_active' AND status = 'open') as bot_active,
         COUNT(*) FILTER (WHERE status = 'closed' AND closed_at >= CURRENT_DATE) as closed_today
       FROM public.conversations
       WHERE workspace_id = $2`,
      [user.id, workspaceId],
    );

    const row = stats.rows[0];
    return {
      myAssigned: parseInt(row?.my_assigned || '0', 10),
      unassigned: parseInt(row?.unassigned || '0', 10),
      waitingHandoff: parseInt(row?.waiting_handoff || '0', 10),
      offlineQueued: parseInt(row?.offline_queued || '0', 10),
      botActive: parseInt(row?.bot_active || '0', 10),
      closedToday: parseInt(row?.closed_today || '0', 10),
    };
  }

  async getMyAssigned(workspaceId: string, user: AuthenticatedUser, page = 1, limit = 25) {
    const offset = (page - 1) * limit;

    const [countRes, listRes] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) as total
         FROM public.conversations
         WHERE workspace_id = $1 AND assigned_agent_id = $2 AND status = 'open'`,
        [workspaceId, user.id],
      ),
      this.db.query(
        `SELECT c.id, c.status, c.priority, c.channel, c.handoff_status, c.summary,
                c.updated_at, c.created_at,
                v.id as visitor_id, v.name as visitor_name, v.email as visitor_email, v.is_online as visitor_is_online,
                (
                  SELECT json_build_object('id', m.id, 'content', m.content, 'created_at', m.created_at)
                  FROM public.messages m
                  WHERE m.conversation_id = c.id AND m.is_internal IS NOT TRUE
                  ORDER BY m.created_at DESC LIMIT 1
                ) as last_message,
                (
                  SELECT COUNT(*)
                  FROM public.messages m
                  WHERE m.conversation_id = c.id AND m.read_at IS NULL AND m.sender_type = 'visitor'
                ) as unread_count
         FROM public.conversations c
         LEFT JOIN public.visitors v ON v.id = c.visitor_id
         WHERE c.workspace_id = $1 AND c.assigned_agent_id = $2 AND c.status = 'open'
         ORDER BY c.updated_at DESC
         LIMIT $3 OFFSET $4`,
        [workspaceId, user.id, limit, offset],
      ),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    return {
      items: listRes.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUnassigned(workspaceId: string, page = 1, limit = 25) {
    const offset = (page - 1) * limit;

    const [countRes, listRes] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) as total
         FROM public.conversations
         WHERE workspace_id = $1 AND assigned_agent_id IS NULL AND status = 'open'`,
        [workspaceId],
      ),
      this.db.query(
        `SELECT c.id, c.status, c.priority, c.channel, c.handoff_status, c.summary,
                c.updated_at, c.created_at,
                v.id as visitor_id, v.name as visitor_name, v.email as visitor_email, v.is_online as visitor_is_online,
                (
                  SELECT json_build_object('id', m.id, 'content', m.content, 'created_at', m.created_at)
                  FROM public.messages m
                  WHERE m.conversation_id = c.id AND m.is_internal IS NOT TRUE
                  ORDER BY m.created_at DESC LIMIT 1
                ) as last_message
         FROM public.conversations c
         LEFT JOIN public.visitors v ON v.id = c.visitor_id
         WHERE c.workspace_id = $1 AND c.assigned_agent_id IS NULL AND c.status = 'open'
         ORDER BY c.updated_at DESC
         LIMIT $2 OFFSET $3`,
        [workspaceId, limit, offset],
      ),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    return {
      items: listRes.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getWaitingHandoff(workspaceId: string, page = 1, limit = 25) {
    const offset = (page - 1) * limit;

    const [countRes, listRes] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) as total
         FROM public.conversations
         WHERE workspace_id = $1 AND handoff_status IN ('waiting_for_agent', 'offline_queued')`,
        [workspaceId],
      ),
      this.db.query(
        `SELECT c.id, c.status, c.priority, c.channel, c.handoff_status, c.handoff_reason,
                c.handoff_summary, c.handoff_requested_at, c.updated_at, c.created_at,
                v.id as visitor_id, v.name as visitor_name, v.email as visitor_email, v.is_online as visitor_is_online,
                (
                  SELECT json_build_object('id', m.id, 'content', m.content, 'created_at', m.created_at)
                  FROM public.messages m
                  WHERE m.conversation_id = c.id AND m.is_internal IS NOT TRUE
                  ORDER BY m.created_at DESC LIMIT 1
                ) as last_message
         FROM public.conversations c
         LEFT JOIN public.visitors v ON v.id = c.visitor_id
         WHERE c.workspace_id = $1 AND c.handoff_status IN ('waiting_for_agent', 'offline_queued')
         ORDER BY c.handoff_requested_at ASC NULLS LAST, c.updated_at DESC
         LIMIT $2 OFFSET $3`,
        [workspaceId, limit, offset],
      ),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    return {
      items: listRes.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async autoAssignNext(workspaceId: string, conversationId: string) {
    // Pick least-loaded online agent in workspace
    const agentRes = await this.db.query(
      `SELECT a.id, a.name, COUNT(c.id) as active_load
       FROM public.agents a
       LEFT JOIN public.conversations c ON c.assigned_agent_id = a.id AND c.status = 'open'
       WHERE a.workspace_id = $1 AND a.is_active = true AND a.status = 'online' AND a.role != 'light_agent'
       GROUP BY a.id, a.name
       ORDER BY active_load ASC, a.created_at ASC
       LIMIT 1`,
      [workspaceId],
    );

    if (agentRes.rows.length === 0) {
      return { assigned: false, reason: 'No available online agents.' };
    }

    const nextAgent = agentRes.rows[0];

    await this.db.query(
      `UPDATE public.conversations
       SET assigned_agent_id = $1, updated_at = now()
       WHERE id = $2 AND workspace_id = $3`,
      [nextAgent.id, conversationId, workspaceId],
    );

    return {
      assigned: true,
      agent: { id: nextAgent.id, name: nextAgent.name },
    };
  }
}

