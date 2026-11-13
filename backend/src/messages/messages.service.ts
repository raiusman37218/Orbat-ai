import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';
import { RealtimeService } from '../realtime/realtime.service';
import { OutboxService } from '../realtime/outbox.service';
import {
  shouldSuppressDirectRealtimeEmit,
  trackSuppressContextOutboxId,
} from '../realtime/realtime-emit.context';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly db: DatabaseService,
    @Optional()
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtime?: RealtimeService,
    @Optional()
    @Inject(forwardRef(() => OutboxService))
    private readonly outbox?: OutboxService,
  ) {}

  async getMessages(
    workspaceId: string,
    conversationId: string,
    limit: number = 50,
    before?: string,
  ) {
    // 1. Verify conversation belongs to workspace
    const conv = await this.db.query(
      'SELECT id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1',
      [conversationId, workspaceId],
    );
    if (conv.rows.length === 0) {
      throw new NotFoundException(`Conversation ${conversationId} not found.`);
    }

    const clampedLimit = Math.min(Math.max(1, Math.floor(limit || 50)), 100);
    const conditions: string[] = ['m.conversation_id = $1'];
    const params: any[] = [conversationId];
    let idx = 2;

    if (before) {
      conditions.push(`m.created_at < $${idx++}`);
      params.push(before);
    }

    params.push(clampedLimit);
    // Fetch the newest page DESC and wrap in ascending chronological order for chat rendering.
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

  async sendMessage(
    workspaceId: string,
    conversationId: string,
    dto: SendMessageDto,
    sender?: AuthenticatedUser,
  ) {
    // 1. Verify conversation belongs to workspace
    const convRes = await this.db.query(
      `SELECT id, status, ai_mode, assigned_agent_id, visitor_id
       FROM public.conversations
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`,
      [conversationId, workspaceId],
    );

    if (convRes.rows.length === 0) {
      throw new NotFoundException(`Conversation ${conversationId} not found.`);
    }
    const conv = convRes.rows[0];

    // 2. Idempotency check if key provided
    if (dto.idempotencyKey) {
      const existingMsg = await this.db.query(
        `SELECT id, conversation_id, sender_type, content, created_at
         FROM public.messages
         WHERE conversation_id = $1 AND metadata->>'idempotency_key' = $2
         LIMIT 1`,
        [conversationId, dto.idempotencyKey],
      );
      if (existingMsg.rows.length > 0) {
        return existingMsg.rows[0];
      }
    }

    const isInternal = Boolean(dto.isInternal);
    let senderType: 'agent' | 'visitor' | 'system' | 'ai';
    if (sender) {
      if (sender.role === 'light_agent' && !isInternal) {
        throw new ForbiddenException('Light agents can only post internal notes.');
      }
      const isAdmin = sender.role === 'owner' || sender.role === 'admin' || Boolean(sender.isSuperAdmin);
      senderType = dto.senderType === 'system' && isAdmin ? 'system' : 'agent';
    } else {
      senderType =
        dto.senderType === 'ai' || dto.senderType === 'system' || dto.senderType === 'visitor'
          ? dto.senderType
          : 'visitor';
    }
    const senderId = sender?.id || (senderType === 'visitor' ? conv.visitor_id : null);
    const content = (dto.content || '').trim();
    const attachmentUrl = dto.attachmentUrl || null;

    if (!content && !attachmentUrl) {
      throw new BadRequestException('Message content or attachmentUrl is required.');
    }

    const metadata: Record<string, any> = {};
    if (dto.idempotencyKey) {
      metadata.idempotency_key = dto.idempotencyKey;
    }

    const txResult = await this.db.transaction(async (client) => {
      // 3. Insert message
      const msgRes = await client.query(
        `INSERT INTO public.messages (
           conversation_id, sender_type, sender_id, content,
           attachment_url, is_internal, reply_to_message_id, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, conversation_id, sender_type, sender_id, content,
                   attachment_url, is_internal, reply_to_message_id, metadata, created_at`,
        [
          conversationId,
          senderType,
          senderId,
          content,
          attachmentUrl,
          isInternal,
          dto.replyToMessageId || null,
          JSON.stringify(metadata),
        ],
      );
      const message = msgRes.rows[0];

      // 4. Update conversation state:
      // If human agent replies publicly: bump updated_at, reopen if closed, assign agent, pause AI auto-reply.
      // AI/bot replies bump updated_at without pausing AI.
      if (senderType === 'agent' && !isInternal) {
        await client.query(
          `UPDATE public.conversations
           SET updated_at = now(),
               status = CASE WHEN status = 'closed' THEN 'open' ELSE status END,
               assigned_agent_id = COALESCE(assigned_agent_id, $1),
               first_agent_reply_at = COALESCE(first_agent_reply_at, now()),
               ai_mode = 'disabled',
               ai_enabled = false,
               ai_paused_reason = 'human_reply',
               ai_needs_attention_at = NULL,
               handoff_status = 'agent_active'
           WHERE id = $2 AND workspace_id = $3`,
          [senderId, conversationId, workspaceId],
        );
      } else if (senderType === 'visitor') {
        await client.query(
          `UPDATE public.conversations
           SET updated_at = now(),
               status = 'open'
           WHERE id = $1 AND workspace_id = $2`,
          [conversationId, workspaceId],
        );
      } else if (senderType === 'ai') {
        await client.query(
          `UPDATE public.conversations
           SET updated_at = now()
           WHERE id = $1 AND workspace_id = $2`,
          [conversationId, workspaceId],
        );
      }

      const enriched = {
        ...message,
        sender_agent_name: senderType === 'agent' ? sender?.name || null : null,
        sender_agent_avatar: null,
      };

      const rooms = [`conversation:${conversationId}`];
      if (!isInternal) rooms.push(`workspace:${workspaceId}`);

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

      if (shouldSuppressDirectRealtimeEmit()) {
        trackSuppressContextOutboxId(txResult.outboxId);
      } else if (this.realtime) {
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
        await this.outbox?.markPublished(txResult.outboxId).catch(() => {});
      }
    }

    return enrichedMessage;
  }

  async editMessage(
    workspaceId: string,
    conversationId: string,
    messageId: string,
    dto: UpdateMessageDto,
    actor: AuthenticatedUser,
  ) {
    const convRes = await this.db.query(
      'SELECT id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1',
      [conversationId, workspaceId],
    );
    if (convRes.rows.length === 0) {
      throw new NotFoundException(`Conversation ${conversationId} not found.`);
    }

    const msgRes = await this.db.query(
      'SELECT id, sender_id, sender_type FROM public.messages WHERE id = $1 AND conversation_id = $2 LIMIT 1',
      [messageId, conversationId],
    );
    if (msgRes.rows.length === 0) {
      throw new NotFoundException(`Message ${messageId} not found.`);
    }

    const existing = msgRes.rows[0];
    const isAdmin = actor.role === 'owner' || actor.role === 'admin' || actor.isSuperAdmin;
    if (!isAdmin && (!existing.sender_id || existing.sender_id !== actor.id)) {
      throw new ForbiddenException('You can only edit your own messages.');
    }

    const updatedRes = await this.db.query(
      `UPDATE public.messages
       SET content = $1,
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('edited_at', now())
       WHERE id = $2 AND conversation_id = $3
       RETURNING id, conversation_id, sender_type, sender_id, content,
                 attachment_url, is_internal, reply_to_message_id, metadata, created_at`,
      [dto.content.trim(), messageId, conversationId],
    );
    const updated = updatedRes.rows[0];

    this.realtime?.emitToConversation(conversationId, 'message:updated', updated);
    this.realtime?.emitToWorkspace(workspaceId, 'message:updated', updated);

    return updated;
  }

  async deleteMessage(
    workspaceId: string,
    conversationId: string,
    messageId: string,
    actor: AuthenticatedUser,
  ) {
    const convRes = await this.db.query(
      'SELECT id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1',
      [conversationId, workspaceId],
    );
    if (convRes.rows.length === 0) {
      throw new NotFoundException(`Conversation ${conversationId} not found.`);
    }

    const msgRes = await this.db.query(
      'SELECT id, sender_id, sender_type FROM public.messages WHERE id = $1 AND conversation_id = $2 LIMIT 1',
      [messageId, conversationId],
    );
    if (msgRes.rows.length === 0) {
      throw new NotFoundException(`Message ${messageId} not found.`);
    }

    const existing = msgRes.rows[0];
    const isAdmin = actor.role === 'owner' || actor.role === 'admin' || actor.isSuperAdmin;
    if (!isAdmin && (!existing.sender_id || existing.sender_id !== actor.id)) {
      throw new ForbiddenException('You can only delete your own messages.');
    }

    await this.db.query(
      'DELETE FROM public.messages WHERE id = $1 AND conversation_id = $2',
      [messageId, conversationId],
    );

    const payload = { id: messageId, conversationId };
    this.realtime?.emitToConversation(conversationId, 'message:deleted', payload);
    this.realtime?.emitToWorkspace(workspaceId, 'message:deleted', payload);

    return { deleted: true, ...payload };
  }

  async markAsRead(
    workspaceId: string,
    conversationId: string,
    senderType: 'agent' | 'visitor' = 'agent',
  ) {
    // If agent is reading, mark visitor/ai messages as read
    // If visitor is reading, mark agent/ai messages as read
    const targetSender = senderType === 'agent' ? 'visitor' : 'agent';

    const result = await this.db.query(
      `UPDATE public.messages
       SET read_at = now()
       WHERE conversation_id = $1
         AND sender_type = $2
         AND read_at IS NULL
         AND conversation_id IN (SELECT id FROM public.conversations WHERE workspace_id = $3)
       RETURNING id, read_at`,
      [conversationId, targetSender, workspaceId],
    );

    if (
      this.realtime &&
      !shouldSuppressDirectRealtimeEmit() &&
      result.rowCount &&
      result.rowCount > 0
    ) {
      this.realtime.emitToConversation(conversationId, 'message:read', {
        conversationId,
        readBy: senderType,
        markedCount: result.rowCount,
        readAt: new Date().toISOString(),
      });
    }

    return { markedCount: result.rowCount };
  }

  async markAsDelivered(workspaceId: string, conversationId: string) {
    const result = await this.db.query(
      `UPDATE public.messages
       SET delivered_at = now()
       WHERE conversation_id = $1
         AND delivered_at IS NULL
         AND conversation_id IN (SELECT id FROM public.conversations WHERE workspace_id = $2)
       RETURNING id, delivered_at`,
      [conversationId, workspaceId],
    );

    return { markedCount: result.rowCount };
  }
}

