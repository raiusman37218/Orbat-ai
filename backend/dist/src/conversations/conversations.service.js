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
var ConversationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const realtime_service_1 = require("../realtime/realtime.service");
let ConversationsService = ConversationsService_1 = class ConversationsService {
    constructor(db, realtime) {
        this.db = db;
        this.realtime = realtime;
        this.logger = new common_1.Logger(ConversationsService_1.name);
    }
    async getConversations(workspaceId, query) {
        const page = query.page || 1;
        const limit = query.limit || 30;
        const offset = (page - 1) * limit;
        const conditions = ['c.workspace_id = $1'];
        const params = [workspaceId];
        let idx = 2;
        if (query.status && query.status !== 'all') {
            conditions.push(`c.status = $${idx++}`);
            params.push(query.status);
        }
        if (query.handoffStatus) {
            conditions.push(`c.handoff_status = $${idx++}`);
            params.push(query.handoffStatus);
        }
        if (query.unassigned) {
            conditions.push(`c.assigned_agent_id IS NULL`);
        }
        else if (query.assignedAgentId) {
            conditions.push(`c.assigned_agent_id = $${idx++}`);
            params.push(query.assignedAgentId);
        }
        if (query.channel) {
            conditions.push(`c.channel = $${idx++}`);
            params.push(query.channel);
        }
        if (query.q) {
            conditions.push(`(v.name ILIKE $${idx} OR v.email ILIKE $${idx} OR c.summary ILIKE $${idx})`);
            params.push(`%${query.q.trim()}%`);
            idx++;
        }
        const whereClause = conditions.join(' AND ');
        const countRes = await this.db.query(`SELECT COUNT(*) as total
       FROM public.conversations c
       LEFT JOIN public.visitors v ON v.id = c.visitor_id
       WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0]?.total || '0', 10);
        const listRes = await this.db.query(`SELECT c.id, c.workspace_id, c.visitor_id, c.assigned_agent_id,
              c.status, c.priority, c.channel, c.channel_metadata, c.handoff_status,
              c.ai_mode, c.ai_enabled, c.ai_assist, c.ai_paused_reason,
              c.ai_needs_attention_at, c.ai_resumed_at,
              c.handoff_reason, c.handoff_summary, c.handoff_requested_at, c.handoff_offered_at,
              c.first_agent_reply_at, c.snoozed_until, c.current_ticket_id,
              c.summary, c.sentiment, c.tags, c.created_at, c.updated_at, c.closed_at,
              v.id as visitor_id, v.name as visitor_name, v.email as visitor_email,
              v.current_page_url as visitor_page_url, v.location as visitor_location,
              v.ip_location_city, v.ip_location_country,
              v.device as visitor_device, v.browser as visitor_browser,
              v.language as visitor_language, v.timezone as visitor_timezone,
              v.last_seen_at as visitor_last_seen_at,
              v.is_online as visitor_is_online,
              a.id as agent_id, a.name as agent_name, a.avatar_url as agent_avatar_url,
              (
                SELECT json_build_object(
                  'id', m.id,
                  'content', m.content,
                  'sender_type', m.sender_type,
                  'sender_id', m.sender_id,
                  'is_internal', m.is_internal,
                  'read_at', m.read_at,
                  'created_at', m.created_at
                )
                FROM public.messages m
                WHERE m.conversation_id = c.id AND m.is_internal IS NOT TRUE
                ORDER BY m.created_at DESC
                LIMIT 1
              ) as last_message,
              (
                SELECT COUNT(*)
                FROM public.messages m
                WHERE m.conversation_id = c.id AND m.read_at IS NULL AND m.sender_type = 'visitor'
              ) as unread_count
       FROM public.conversations c
       LEFT JOIN public.visitors v ON v.id = c.visitor_id
       LEFT JOIN public.agents a ON a.id = c.assigned_agent_id
       WHERE ${whereClause}
       ORDER BY c.updated_at DESC
       LIMIT $${idx++} OFFSET $${idx}`, [...params, limit, offset]);
        return {
            items: listRes.rows,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async getConversationById(workspaceId, conversationId) {
        const result = await this.db.query(`SELECT c.id, c.workspace_id, c.visitor_id, c.assigned_agent_id,
              c.status, c.priority, c.channel, c.channel_metadata, c.handoff_status,
              c.ai_mode, c.ai_enabled, c.ai_assist, c.ai_paused_reason,
              c.ai_needs_attention_at, c.ai_resumed_at,
              c.handoff_reason, c.handoff_summary, c.handoff_requested_at, c.handoff_offered_at,
              c.first_agent_reply_at, c.snoozed_until, c.current_ticket_id,
              c.summary, c.sentiment, c.tags, c.csat_rating, c.csat_feedback,
              c.created_at, c.updated_at, c.closed_at,
              v.id as visitor_id, v.name as visitor_name, v.email as visitor_email,
              v.current_page_url as visitor_page_url, v.location as visitor_location,
              v.ip_location_city, v.ip_location_country,
              v.device as visitor_device, v.browser as visitor_browser,
              v.language as visitor_language, v.timezone as visitor_timezone,
              v.last_seen_at as visitor_last_seen_at, v.is_online as visitor_is_online,
              a.id as agent_id, a.name as agent_name, a.avatar_url as agent_avatar, a.role as agent_role
       FROM public.conversations c
       LEFT JOIN public.visitors v ON v.id = c.visitor_id
       LEFT JOIN public.agents a ON a.id = c.assigned_agent_id
       WHERE c.id = $1 AND c.workspace_id = $2
       LIMIT 1`, [conversationId, workspaceId]);
        if (result.rows.length === 0) {
            throw new common_1.NotFoundException(`Conversation with ID ${conversationId} not found.`);
        }
        return result.rows[0];
    }
    async createConversation(workspaceId, dto) {
        const visitor = await this.db.query('SELECT id FROM public.visitors WHERE id = $1 AND workspace_id = $2 LIMIT 1', [dto.visitorId, workspaceId]);
        if (visitor.rows.length === 0) {
            throw new common_1.BadRequestException('Visitor does not exist in this workspace.');
        }
        const created = await this.db.transaction(async (client) => {
            const convRes = await client.query(`INSERT INTO public.conversations (
           workspace_id, visitor_id, channel, priority, status, handoff_status, ai_mode, tags
         )
         VALUES ($1, $2, $3, $4, 'open', 'bot_active', 'autopilot', $5)
         RETURNING id, workspace_id, visitor_id, assigned_agent_id, channel, priority, status, handoff_status, ai_mode, ai_enabled, tags, created_at, updated_at`, [workspaceId, dto.visitorId, dto.channel || 'web', dto.priority || 'normal', dto.tags || []]);
            const conversation = convRes.rows[0];
            if (dto.initialMessage?.trim()) {
                await client.query(`INSERT INTO public.messages (conversation_id, sender_type, content, sender_id)
           VALUES ($1, 'visitor', $2, $3)`, [conversation.id, dto.initialMessage.trim(), dto.visitorId]);
            }
            return conversation;
        });
        this.realtime?.emitToWorkspace(workspaceId, 'conversation:created', created);
        return created;
    }
    async updateConversation(workspaceId, conversationId, dto) {
        await this.getConversationById(workspaceId, conversationId);
        const fields = ['updated_at = now()'];
        const values = [];
        let idx = 1;
        if (dto.status !== undefined) {
            fields.push(`status = $${idx++}`);
            values.push(dto.status);
            if (dto.status === 'closed') {
                fields.push(`closed_at = now()`);
                fields.push(`last_resolved_at = now()`);
                fields.push(`handoff_status = 'resolved'`);
                fields.push(`snoozed_until = NULL`);
            }
            else {
                fields.push(`closed_at = NULL`);
                if (dto.status !== 'snoozed' && dto.snoozedUntil === undefined) {
                    fields.push(`snoozed_until = NULL`);
                }
            }
        }
        if (dto.priority !== undefined) {
            fields.push(`priority = $${idx++}`);
            values.push(dto.priority);
        }
        if (dto.aiMode !== undefined) {
            fields.push(`ai_mode = $${idx++}`);
            values.push(dto.aiMode);
            const aiEnabled = dto.aiMode !== 'disabled';
            fields.push(`ai_enabled = ${aiEnabled}`);
            if (!aiEnabled) {
                fields.push(`ai_paused_reason = COALESCE(ai_paused_reason, 'agent_paused')`);
            }
            else {
                fields.push(`ai_paused_reason = NULL`);
                fields.push(`ai_needs_attention_at = NULL`);
                fields.push(`ai_resumed_at = now()`);
            }
        }
        if (dto.handoffStatus !== undefined) {
            fields.push(`handoff_status = $${idx++}`);
            values.push(dto.handoffStatus);
        }
        if (dto.assignedAgentId !== undefined) {
            if (dto.assignedAgentId) {
                const agentCheck = await this.db.query('SELECT id FROM public.agents WHERE id = $1 AND workspace_id = $2 AND is_active = true LIMIT 1', [dto.assignedAgentId, workspaceId]);
                if (agentCheck.rows.length === 0) {
                    throw new common_1.BadRequestException('Target agent is not active or does not belong to this workspace.');
                }
            }
            fields.push(`assigned_agent_id = $${idx++}`);
            values.push(dto.assignedAgentId);
        }
        if (dto.snoozedUntil !== undefined) {
            fields.push(`snoozed_until = $${idx++}`);
            values.push(dto.snoozedUntil);
        }
        if (dto.tags !== undefined) {
            fields.push(`tags = $${idx++}`);
            values.push(dto.tags);
        }
        values.push(conversationId, workspaceId);
        const sql = `
      UPDATE public.conversations
      SET ${fields.join(', ')}
      WHERE id = $${idx++} AND workspace_id = $${idx}
      RETURNING id, workspace_id, status, priority, ai_mode, ai_enabled, ai_paused_reason,
                handoff_status, assigned_agent_id, snoozed_until, tags, updated_at, closed_at
    `;
        const result = await this.db.query(sql, values);
        const updated = result.rows[0];
        if (updated) {
            this.realtime?.emitToConversation(conversationId, 'conversation:updated', updated);
            this.realtime?.emitToWorkspace(workspaceId, 'conversation:updated', {
                conversationId,
                ...updated,
            });
        }
        return updated;
    }
    async assignConversation(workspaceId, conversationId, agentId, actor) {
        await this.getConversationById(workspaceId, conversationId);
        if (agentId) {
            const agentCheck = await this.db.query('SELECT id, name FROM public.agents WHERE id = $1 AND workspace_id = $2 AND is_active = true LIMIT 1', [agentId, workspaceId]);
            if (agentCheck.rows.length === 0) {
                throw new common_1.BadRequestException('Target agent is not active or does not belong to this workspace.');
            }
        }
        const updated = await this.db.transaction(async (client) => {
            const result = await client.query(`UPDATE public.conversations
         SET assigned_agent_id = $1, updated_at = now()
         WHERE id = $2 AND workspace_id = $3
         RETURNING id, assigned_agent_id, updated_at`, [agentId, conversationId, workspaceId]);
            await client.query(`INSERT INTO public.conversation_events (conversation_id, workspace_id, type, actor_type, actor_id, meta)
         VALUES ($1, $2, 'agent_claim', 'agent', $3, $4)`, [conversationId, workspaceId, actor.id, JSON.stringify({ assignedAgentId: agentId })]);
            return result.rows[0];
        });
        if (updated) {
            this.realtime?.emitToConversation(conversationId, 'conversation:updated', updated);
            this.realtime?.emitToWorkspace(workspaceId, 'conversation:updated', {
                conversationId,
                ...updated,
            });
        }
        return updated;
    }
    async claimHandoff(workspaceId, conversationId, agent) {
        const result = await this.db.query(`UPDATE public.conversations
       SET assigned_agent_id = $1,
           handoff_status = 'agent_active',
           ai_enabled = false,
           ai_mode = 'disabled',
           ai_paused_reason = 'agent_paused',
           first_agent_reply_at = COALESCE(first_agent_reply_at, now()),
           updated_at = now()
       WHERE id = $2 AND workspace_id = $3 AND (assigned_agent_id IS NULL OR assigned_agent_id = $1)
       RETURNING id, assigned_agent_id, handoff_status, ai_enabled, ai_mode`, [agent.id, conversationId, workspaceId]);
        if (result.rows.length === 0) {
            throw new common_1.ConflictException('Conversation has already been claimed by another agent.');
        }
        const sysMsgRes = await this.db.query(`INSERT INTO public.messages (conversation_id, sender_type, content, sender_id, is_internal)
       VALUES ($1, 'system', $2, $3, false)
       RETURNING id, conversation_id, sender_type, sender_id, content, is_internal, created_at`, [conversationId, `${agent.name} joined the conversation`, agent.id]);
        const sysMsg = sysMsgRes?.rows?.[0];
        if (sysMsg) {
            this.realtime?.emitToConversation(conversationId, 'message:new', sysMsg);
        }
        this.realtime?.emitToWorkspace(workspaceId, 'conversation:updated', {
            conversationId,
            ...result.rows[0],
            ...(sysMsg ? { lastMessage: sysMsg } : {}),
        });
        return result.rows[0];
    }
    async returnToAi(workspaceId, conversationId, agent) {
        await this.getConversationById(workspaceId, conversationId);
        const result = await this.db.query(`UPDATE public.conversations
       SET handoff_status = 'bot_active',
           ai_enabled = true,
           ai_mode = 'autopilot',
           ai_paused_reason = NULL,
           ai_needs_attention_at = NULL,
           ai_resumed_at = now(),
           assigned_agent_id = NULL,
           updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING id, handoff_status, ai_enabled, ai_mode, assigned_agent_id`, [conversationId, workspaceId]);
        const sysMsgRes = await this.db.query(`INSERT INTO public.messages (conversation_id, sender_type, content, sender_id, is_internal)
       VALUES ($1, 'system', $2, $3, false)
       RETURNING id, conversation_id, sender_type, sender_id, content, is_internal, created_at`, [conversationId, `${agent.name} returned the conversation to the AI assistant`, agent.id]);
        const sysMsg = sysMsgRes?.rows?.[0];
        if (sysMsg) {
            this.realtime?.emitToConversation(conversationId, 'message:new', sysMsg);
        }
        this.realtime?.emitToWorkspace(workspaceId, 'conversation:updated', {
            conversationId,
            ...result.rows[0],
            ...(sysMsg ? { lastMessage: sysMsg } : {}),
        });
        return result.rows[0];
    }
    async requestHandoff(workspaceId, conversationId, reason, summary) {
        const result = await this.db.query(`UPDATE public.conversations
       SET handoff_status = 'waiting_for_agent',
           handoff_reason = COALESCE($1, handoff_reason),
           handoff_summary = COALESCE($2, handoff_summary),
           handoff_requested_at = now(),
           ai_needs_attention_at = now(),
           updated_at = now()
       WHERE id = $3 AND workspace_id = $4
       RETURNING id, handoff_status, handoff_reason, handoff_requested_at`, [reason || 'User requested human support', summary || null, conversationId, workspaceId]);
        if (result.rows.length === 0) {
            throw new common_1.NotFoundException(`Conversation with ID ${conversationId} not found.`);
        }
        this.realtime?.emitToWorkspace(workspaceId, 'conversation:updated', {
            conversationId,
            ...result.rows[0],
        });
        this.realtime?.emitToConversation(conversationId, 'conversation:updated', result.rows[0]);
        return result.rows[0];
    }
    async closeConversation(workspaceId, conversationId, _agent) {
        const result = await this.db.query(`UPDATE public.conversations
       SET status = 'closed',
           handoff_status = 'resolved',
           closed_at = now(),
           last_resolved_at = now(),
           snoozed_until = NULL,
           updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING id, status, handoff_status, closed_at`, [conversationId, workspaceId]);
        if (result.rows.length === 0) {
            throw new common_1.NotFoundException('Conversation not found.');
        }
        this.realtime?.emitToWorkspace(workspaceId, 'conversation:updated', {
            conversationId,
            ...result.rows[0],
        });
        this.realtime?.emitToConversation(conversationId, 'conversation:updated', result.rows[0]);
        return result.rows[0];
    }
    async bulkUpdate(workspaceId, dto, _actor) {
        if (!dto.ids || dto.ids.length === 0) {
            return { updatedCount: 0, items: [] };
        }
        let sql;
        let params;
        switch (dto.action) {
            case 'resolve':
                sql = `
          UPDATE public.conversations
          SET status = 'closed',
              handoff_status = 'resolved',
              closed_at = now(),
              last_resolved_at = now(),
              snoozed_until = NULL,
              updated_at = now()
          WHERE workspace_id = $1 AND id = ANY($2::uuid[])
          RETURNING id, status, handoff_status, assigned_agent_id, tags, closed_at, updated_at
        `;
                params = [workspaceId, dto.ids];
                break;
            case 'reopen':
                sql = `
          UPDATE public.conversations
          SET status = 'open',
              closed_at = NULL,
              snoozed_until = NULL,
              updated_at = now()
          WHERE workspace_id = $1 AND id = ANY($2::uuid[])
          RETURNING id, status, handoff_status, assigned_agent_id, tags, closed_at, updated_at
        `;
                params = [workspaceId, dto.ids];
                break;
            case 'assign': {
                if (dto.agentId) {
                    const agentCheck = await this.db.query('SELECT id FROM public.agents WHERE id = $1 AND workspace_id = $2 AND is_active = true LIMIT 1', [dto.agentId, workspaceId]);
                    if (agentCheck.rows.length === 0) {
                        throw new common_1.BadRequestException('Target agent is not active or does not belong to this workspace.');
                    }
                }
                sql = `
          UPDATE public.conversations
          SET assigned_agent_id = $1,
              updated_at = now()
          WHERE workspace_id = $2 AND id = ANY($3::uuid[])
          RETURNING id, status, handoff_status, assigned_agent_id, tags, closed_at, updated_at
        `;
                params = [dto.agentId ?? null, workspaceId, dto.ids];
                break;
            }
            case 'spam':
                sql = `
          UPDATE public.conversations
          SET status = 'closed',
              handoff_status = 'resolved',
              closed_at = now(),
              last_resolved_at = now(),
              snoozed_until = NULL,
              tags = CASE
                WHEN 'spam' = ANY(COALESCE(tags, ARRAY[]::text[])) THEN COALESCE(tags, ARRAY[]::text[])
                ELSE array_append(COALESCE(tags, ARRAY[]::text[]), 'spam')
              END,
              updated_at = now()
          WHERE workspace_id = $1 AND id = ANY($2::uuid[])
          RETURNING id, status, handoff_status, assigned_agent_id, tags, closed_at, updated_at
        `;
                params = [workspaceId, dto.ids];
                break;
        }
        const result = await this.db.query(sql, params);
        for (const row of result.rows) {
            this.realtime?.emitToWorkspace(workspaceId, 'conversation:updated', {
                conversationId: row.id,
                ...row,
            });
            this.realtime?.emitToConversation(row.id, 'conversation:updated', row);
        }
        return {
            updatedCount: result.rows.length,
            items: result.rows,
        };
    }
    async getHandovers(workspaceId, days = 14, limit = 300) {
        const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 14;
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 300;
        const since = new Date(Date.now() - safeDays * 86_400_000).toISOString();
        const result = await this.db.query(`SELECT m.id,
              m.content,
              m.created_at,
              m.reply_to_message_id,
              m.metadata,
              q.content AS question_content,
              c.id AS conversation_id,
              c.workspace_id,
              c.status,
              c.priority,
              c.channel,
              c.ai_paused_reason,
              c.ai_needs_attention_at,
              c.channel_metadata,
              c.assigned_agent_id,
              v.name AS visitor_name,
              v.email AS visitor_email
       FROM public.messages m
       INNER JOIN public.conversations c ON c.id = m.conversation_id
       LEFT JOIN public.visitors v ON v.id = c.visitor_id
       LEFT JOIN public.messages q ON q.id = m.reply_to_message_id
       WHERE m.is_internal = true
         AND (m.metadata->>'is_handover') = 'true'
         AND c.workspace_id = $1
         AND m.created_at >= $2
       ORDER BY m.created_at DESC
       LIMIT $3`, [workspaceId, since, safeLimit]);
        return result.rows.map((r) => ({
            id: r.id,
            content: r.content,
            created_at: r.created_at,
            reply_to_message_id: r.reply_to_message_id,
            metadata: r.metadata,
            question_content: r.question_content || null,
            conversation: {
                id: r.conversation_id,
                workspace_id: r.workspace_id,
                status: r.status,
                priority: r.priority,
                channel: r.channel,
                ai_paused_reason: r.ai_paused_reason,
                ai_needs_attention_at: r.ai_needs_attention_at,
                channel_metadata: r.channel_metadata,
                assigned_agent_id: r.assigned_agent_id,
                visitor: r.visitor_name || r.visitor_email ? { name: r.visitor_name, email: r.visitor_email } : null,
            },
        }));
    }
    async skipHandoff(workspaceId, conversationId, agent) {
        await this.getConversationById(workspaceId, conversationId);
        const updated = await this.db.transaction(async (client) => {
            const convRes = await client.query(`SELECT id, workspace_id, handoff_status, skipped_agent_ids, ring_broadcast
         FROM public.conversations
         WHERE id = $1 AND workspace_id = $2
         FOR UPDATE`, [conversationId, workspaceId]);
            const conv = convRes.rows[0];
            if (!conv || conv.handoff_status !== 'waiting_for_agent') {
                return { ok: false, reason: 'not_waiting', status: conv?.handoff_status || null };
            }
            const prevSkipped = Array.isArray(conv.skipped_agent_ids) ? conv.skipped_agent_ids : [];
            const nextSkipped = Array.from(new Set([...prevSkipped, agent.id]));
            await client.query(`INSERT INTO public.conversation_events (conversation_id, workspace_id, type, actor_type, actor_id, meta)
         VALUES ($1, $2, 'skipped', 'agent', $3, $4)`, [conversationId, workspaceId, agent.id, JSON.stringify({ skipped_count: nextSkipped.length })]);
            if (conv.ring_broadcast) {
                await client.query(`UPDATE public.conversations
           SET skipped_agent_ids = $1::uuid[], updated_at = now()
           WHERE id = $2 AND workspace_id = $3`, [nextSkipped, conversationId, workspaceId]);
                return { ok: true, status: 'waiting_for_agent', broadcast: true };
            }
            let nextAgentId = null;
            try {
                const nextRes = await client.query(`SELECT public.fn_pick_next_handoff_agent($1::uuid, $2::uuid[]) AS next_agent`, [workspaceId, nextSkipped]);
                nextAgentId = nextRes.rows[0]?.next_agent || null;
            }
            catch {
                nextAgentId = null;
            }
            if (nextAgentId) {
                const updRes = await client.query(`UPDATE public.conversations
           SET skipped_agent_ids = $1::uuid[],
               ringing_agent_id = $2,
               ring_started_at = now(),
               ring_broadcast = false,
               updated_at = now()
           WHERE id = $3 AND workspace_id = $4
           RETURNING id, skipped_agent_ids, ringing_agent_id, ring_broadcast, handoff_status, updated_at`, [nextSkipped, nextAgentId, conversationId, workspaceId]);
                return { ok: true, nextAgentId, updated: updRes.rows[0] };
            }
            const updRes = await client.query(`UPDATE public.conversations
         SET skipped_agent_ids = $1::uuid[],
             ringing_agent_id = NULL,
             ring_broadcast = true,
             updated_at = now()
         WHERE id = $2 AND workspace_id = $3
         RETURNING id, skipped_agent_ids, ringing_agent_id, ring_broadcast, handoff_status, updated_at`, [nextSkipped, conversationId, workspaceId]);
            return { ok: true, broadcast: true, updated: updRes.rows[0] };
        });
        if (updated?.updated) {
            this.realtime?.emitToWorkspace(workspaceId, 'conversation:updated', {
                conversationId,
                ...updated.updated,
            });
        }
        return updated;
    }
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = ConversationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => realtime_service_1.RealtimeService))),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        realtime_service_1.RealtimeService])
], ConversationsService);
//# sourceMappingURL=conversations.service.js.map