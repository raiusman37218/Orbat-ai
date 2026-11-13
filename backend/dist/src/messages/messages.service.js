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
var MessagesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const realtime_service_1 = require("../realtime/realtime.service");
const outbox_service_1 = require("../realtime/outbox.service");
const realtime_emit_context_1 = require("../realtime/realtime-emit.context");
let MessagesService = MessagesService_1 = class MessagesService {
    constructor(db, realtime, outbox) {
        this.db = db;
        this.realtime = realtime;
        this.outbox = outbox;
        this.logger = new common_1.Logger(MessagesService_1.name);
    }
    async getMessages(workspaceId, conversationId, limit = 50, before) {
        const conv = await this.db.query('SELECT id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1', [conversationId, workspaceId]);
        if (conv.rows.length === 0) {
            throw new common_1.NotFoundException(`Conversation ${conversationId} not found.`);
        }
        const clampedLimit = Math.min(Math.max(1, Math.floor(limit || 50)), 100);
        const conditions = ['m.conversation_id = $1'];
        const params = [conversationId];
        let idx = 2;
        if (before) {
            conditions.push(`m.created_at < $${idx++}`);
            params.push(before);
        }
        params.push(clampedLimit);
        const sql = `
      SELECT * FROM (
        SELECT m.id, m.conversation_id, m.sender_type, m.sender_id, m.content,
               m.attachment_url, m.is_internal, m.reply_to_message_id,
               m.delivered_at, m.read_at, m.metadata, m.created_at,
               a.name as sender_agent_name, a.avatar_url as sender_agent_avatar
        FROM public.messages m
        LEFT JOIN public.agents a ON a.id = m.sender_id AND m.sender_type = 'agent'
        WHERE ${conditions.join(' AND ')}
        ORDER BY m.created_at DESC
        LIMIT $${idx}
      ) latest
      ORDER BY latest.created_at ASC
    `;
        const result = await this.db.query(sql, params);
        return result.rows;
    }
    async sendMessage(workspaceId, conversationId, dto, sender) {
        const convRes = await this.db.query(`SELECT id, status, ai_mode, assigned_agent_id, visitor_id
       FROM public.conversations
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`, [conversationId, workspaceId]);
        if (convRes.rows.length === 0) {
            throw new common_1.NotFoundException(`Conversation ${conversationId} not found.`);
        }
        const conv = convRes.rows[0];
        if (dto.idempotencyKey) {
            const existingMsg = await this.db.query(`SELECT id, conversation_id, sender_type, content, created_at
         FROM public.messages
         WHERE conversation_id = $1 AND metadata->>'idempotency_key' = $2
         LIMIT 1`, [conversationId, dto.idempotencyKey]);
            if (existingMsg.rows.length > 0) {
                return existingMsg.rows[0];
            }
        }
        const isInternal = Boolean(dto.isInternal);
        let senderType;
        if (sender) {
            if (sender.role === 'light_agent' && !isInternal) {
                throw new common_1.ForbiddenException('Light agents can only post internal notes.');
            }
            const isAdmin = sender.role === 'owner' || sender.role === 'admin' || Boolean(sender.isSuperAdmin);
            senderType = dto.senderType === 'system' && isAdmin ? 'system' : 'agent';
        }
        else {
            senderType =
                dto.senderType === 'ai' || dto.senderType === 'system' || dto.senderType === 'visitor'
                    ? dto.senderType
                    : 'visitor';
        }
        const senderId = sender?.id || (senderType === 'visitor' ? conv.visitor_id : null);
        const content = (dto.content || '').trim();
        const attachmentUrl = dto.attachmentUrl || null;
        if (!content && !attachmentUrl) {
            throw new common_1.BadRequestException('Message content or attachmentUrl is required.');
        }
        const metadata = {};
        if (dto.idempotencyKey) {
            metadata.idempotency_key = dto.idempotencyKey;
        }
        const txResult = await this.db.transaction(async (client) => {
            const msgRes = await client.query(`INSERT INTO public.messages (
           conversation_id, sender_type, sender_id, content,
           attachment_url, is_internal, reply_to_message_id, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, conversation_id, sender_type, sender_id, content,
                   attachment_url, is_internal, reply_to_message_id, metadata, created_at`, [
                conversationId,
                senderType,
                senderId,
                content,
                attachmentUrl,
                isInternal,
                dto.replyToMessageId || null,
                JSON.stringify(metadata),
            ]);
            const message = msgRes.rows[0];
            if (senderType === 'agent' && !isInternal) {
                await client.query(`UPDATE public.conversations
           SET updated_at = now(),
               status = CASE WHEN status = 'closed' THEN 'open' ELSE status END,
               assigned_agent_id = COALESCE(assigned_agent_id, $1),
               first_agent_reply_at = COALESCE(first_agent_reply_at, now()),
               ai_mode = 'disabled',
               ai_enabled = false,
               ai_paused_reason = 'human_reply',
               ai_needs_attention_at = NULL,
               handoff_status = 'agent_active'
           WHERE id = $2 AND workspace_id = $3`, [senderId, conversationId, workspaceId]);
            }
            else if (senderType === 'visitor') {
                await client.query(`UPDATE public.conversations
           SET updated_at = now(),
               status = 'open'
           WHERE id = $1 AND workspace_id = $2`, [conversationId, workspaceId]);
            }
            else if (senderType === 'ai') {
                await client.query(`UPDATE public.conversations
           SET updated_at = now()
           WHERE id = $1 AND workspace_id = $2`, [conversationId, workspaceId]);
            }
            const enriched = {
                ...message,
                sender_agent_name: senderType === 'agent' ? sender?.name || null : null,
                sender_agent_avatar: null,
            };
            const rooms = [`conversation:${conversationId}`];
            if (!isInternal)
                rooms.push(`workspace:${workspaceId}`);
            const outboxId = this.outbox
                ? await this.outbox.recordInTransaction(client, {
                    workspaceId,
                    conversationId,
                    eventName: 'message:new',
                    rooms,
                    payload: enriched,
                })
                : null;
            return { enriched, outboxId };
        });
        const enrichedMessage = txResult.enriched;
        if ((0, realtime_emit_context_1.shouldSuppressDirectRealtimeEmit)()) {
            (0, realtime_emit_context_1.trackSuppressContextOutboxId)(txResult.outboxId);
        }
        else if (this.realtime) {
            const sentConv = this.realtime.emitToConversation(conversationId, 'message:new', enrichedMessage);
            let sentWs = true;
            if (!isInternal) {
                sentWs = this.realtime.emitToWorkspace(workspaceId, 'message:new', enrichedMessage);
                this.realtime.emitToWorkspace(workspaceId, 'conversation:updated', {
                    conversationId,
                    lastMessage: enrichedMessage,
                });
            }
            if (txResult.outboxId && sentConv && sentWs) {
                await this.outbox?.markPublished(txResult.outboxId).catch(() => { });
            }
        }
        return enrichedMessage;
    }
    async editMessage(workspaceId, conversationId, messageId, dto, actor) {
        const convRes = await this.db.query('SELECT id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1', [conversationId, workspaceId]);
        if (convRes.rows.length === 0) {
            throw new common_1.NotFoundException(`Conversation ${conversationId} not found.`);
        }
        const msgRes = await this.db.query('SELECT id, sender_id, sender_type FROM public.messages WHERE id = $1 AND conversation_id = $2 LIMIT 1', [messageId, conversationId]);
        if (msgRes.rows.length === 0) {
            throw new common_1.NotFoundException(`Message ${messageId} not found.`);
        }
        const existing = msgRes.rows[0];
        const isAdmin = actor.role === 'owner' || actor.role === 'admin' || actor.isSuperAdmin;
        if (!isAdmin && (!existing.sender_id || existing.sender_id !== actor.id)) {
            throw new common_1.ForbiddenException('You can only edit your own messages.');
        }
        const updatedRes = await this.db.query(`UPDATE public.messages
       SET content = $1,
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('edited_at', now())
       WHERE id = $2 AND conversation_id = $3
       RETURNING id, conversation_id, sender_type, sender_id, content,
                 attachment_url, is_internal, reply_to_message_id, metadata, created_at`, [dto.content.trim(), messageId, conversationId]);
        const updated = updatedRes.rows[0];
        this.realtime?.emitToConversation(conversationId, 'message:updated', updated);
        this.realtime?.emitToWorkspace(workspaceId, 'message:updated', updated);
        return updated;
    }
    async deleteMessage(workspaceId, conversationId, messageId, actor) {
        const convRes = await this.db.query('SELECT id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1', [conversationId, workspaceId]);
        if (convRes.rows.length === 0) {
            throw new common_1.NotFoundException(`Conversation ${conversationId} not found.`);
        }
        const msgRes = await this.db.query('SELECT id, sender_id, sender_type FROM public.messages WHERE id = $1 AND conversation_id = $2 LIMIT 1', [messageId, conversationId]);
        if (msgRes.rows.length === 0) {
            throw new common_1.NotFoundException(`Message ${messageId} not found.`);
        }
        const existing = msgRes.rows[0];
        const isAdmin = actor.role === 'owner' || actor.role === 'admin' || actor.isSuperAdmin;
        if (!isAdmin && (!existing.sender_id || existing.sender_id !== actor.id)) {
            throw new common_1.ForbiddenException('You can only delete your own messages.');
        }
        await this.db.query('DELETE FROM public.messages WHERE id = $1 AND conversation_id = $2', [messageId, conversationId]);
        const payload = { id: messageId, conversationId };
        this.realtime?.emitToConversation(conversationId, 'message:deleted', payload);
        this.realtime?.emitToWorkspace(workspaceId, 'message:deleted', payload);
        return { deleted: true, ...payload };
    }
    async markAsRead(workspaceId, conversationId, senderType = 'agent') {
        const targetSender = senderType === 'agent' ? 'visitor' : 'agent';
        const result = await this.db.query(`UPDATE public.messages
       SET read_at = now()
       WHERE conversation_id = $1
         AND sender_type = $2
         AND read_at IS NULL
         AND conversation_id IN (SELECT id FROM public.conversations WHERE workspace_id = $3)
       RETURNING id, read_at`, [conversationId, targetSender, workspaceId]);
        if (this.realtime &&
            !(0, realtime_emit_context_1.shouldSuppressDirectRealtimeEmit)() &&
            result.rowCount &&
            result.rowCount > 0) {
            this.realtime.emitToConversation(conversationId, 'message:read', {
                conversationId,
                readBy: senderType,
                markedCount: result.rowCount,
                readAt: new Date().toISOString(),
            });
        }
        return { markedCount: result.rowCount };
    }
    async markAsDelivered(workspaceId, conversationId) {
        const result = await this.db.query(`UPDATE public.messages
       SET delivered_at = now()
       WHERE conversation_id = $1
         AND delivered_at IS NULL
         AND conversation_id IN (SELECT id FROM public.conversations WHERE workspace_id = $2)
       RETURNING id, delivered_at`, [conversationId, workspaceId]);
        return { markedCount: result.rowCount };
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = MessagesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => realtime_service_1.RealtimeService))),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => outbox_service_1.OutboxService))),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        realtime_service_1.RealtimeService,
        outbox_service_1.OutboxService])
], MessagesService);
//# sourceMappingURL=messages.service.js.map