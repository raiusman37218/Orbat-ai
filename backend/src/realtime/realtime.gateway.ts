import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger, forwardRef, Inject, Optional } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';
import { OutboxService } from './outbox.service';
import { MessagesService } from '../messages/messages.service';
import { DatabaseService } from '../database/database.service';
import { AgentRole } from '../common/types/tenant-context';
import { realtimeSuppressContext } from './realtime-emit.context';

interface SocketUserData {
  type: 'agent' | 'visitor';
  workspaceId: string;
  user?: {
    sub: string;
    id: string;
    email: string;
    name?: string;
    role: AgentRole;
    workspaceId: string;
  };
  visitorId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly realtimeService: RealtimeService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    private readonly db: DatabaseService,
    @Optional()
    private readonly outbox?: OutboxService,
  ) {}

  afterInit(server: Server) {
    this.realtimeService.setServer(server);
    this.logger.log('RealtimeGateway initialized on namespace /realtime');
  }

  async handleConnection(client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization
          ? client.handshake.headers.authorization.replace('Bearer ', '')
          : null);

      const visitorId = client.handshake.auth?.visitorId;
      const visitorToken =
        client.handshake.auth?.visitorToken ||
        client.handshake.headers?.['x-zentry-visitor-token'];
      const workspaceId =
        client.handshake.auth?.workspaceId ||
        client.handshake.headers?.['x-workspace-id'];

      if (rawToken) {
        // Authenticate agent JWT and confirm active agent/workspace state when DB is available
        const jwtSecret = this.configService.get<string>('jwt.secret');
        const payload = await this.jwtService.verifyAsync(rawToken, {
          secret: jwtSecret,
        });

        let resolvedRole = payload.role as AgentRole;
        let resolvedWorkspaceId = payload.workspaceId || payload.workspace_id;
        const dbCheck = await this.db.query(
          `SELECT a.is_active, COALESCE(a.token_version, 1) AS token_version, a.role, a.workspace_id, a.is_super_admin, w.is_suspended, w.deleted_at
           FROM public.agents a
           LEFT JOIN public.workspaces w ON w.id = a.workspace_id
           WHERE a.id = $1
           LIMIT 1`,
          [payload.sub],
        );
        if (dbCheck?.rows) {
          const row = dbCheck.rows[0];
          if (
            !row ||
            row.is_active === false ||
            (typeof payload.tv === 'number' && Number(row.token_version ?? 1) !== payload.tv) ||
            row.deleted_at != null ||
            (row.is_suspended === true && !row.is_super_admin)
          ) {
            this.logger.warn(`Deactivated or suspended agent socket rejected: ${payload.sub}`);
            client.disconnect(true);
            return;
          }
          resolvedRole = (row.role as AgentRole) || resolvedRole;
          resolvedWorkspaceId = row.workspace_id || resolvedWorkspaceId;
        }

        const data: SocketUserData = {
          type: 'agent',
          workspaceId: resolvedWorkspaceId,
          user: {
            sub: payload.sub,
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            role: resolvedRole,
            workspaceId: resolvedWorkspaceId,
          },
        };
        client.data = data;

        // Auto-join workspace and user rooms
        client.join(`workspace:${resolvedWorkspaceId}`);
        client.join(`user:${payload.sub}`);

        this.logger.log(
          `Agent connected: ${payload.email} (Workspace: ${resolvedWorkspaceId}, Socket: ${client.id})`,
        );

        // Notify workspace members about online presence
        this.realtimeService.broadcastPresence(resolvedWorkspaceId, {
          userId: payload.sub,
          status: 'online',
        });
        return;
      }

      if (visitorId && visitorToken && workspaceId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(String(visitorId)) || !uuidRegex.test(String(workspaceId))) {
          this.logger.warn(`Invalid visitor/workspace UUID format on socket ${client.id}`);
          client.disconnect(true);
          return;
        }

        const authRes = await this.db.query(
          `SELECT visitor_id, workspace_id FROM public.fn_widget_auth($1::uuid, $2::text) LIMIT 1`,
          [String(visitorId), String(visitorToken)],
        );
        const sessionRow = authRes?.rows?.[0];
        if (!sessionRow || sessionRow.workspace_id !== String(workspaceId)) {
          this.logger.warn(`Invalid visitor token or workspace mismatch on socket ${client.id}`);
          client.disconnect(true);
          return;
        }

        const data: SocketUserData = {
          type: 'visitor',
          workspaceId: String(workspaceId),
          visitorId: String(visitorId),
        };
        client.data = data;

        this.logger.log(
          `Visitor connected: ${visitorId} (Workspace: ${workspaceId}, Socket: ${client.id})`,
        );
        return;
      }

      // No credentials provided -> reject
      this.logger.warn(`Unauthenticated connection rejected for socket ${client.id}`);
      client.disconnect(true);
    } catch (err: any) {
      this.logger.warn(`Connection auth error for socket ${client.id}: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const data = client.data as SocketUserData;
    if (data?.type === 'agent' && data.user) {
      this.realtimeService.broadcastPresence(data.workspaceId, {
        userId: data.user.sub,
        status: 'offline',
      });
      this.logger.log(`Agent disconnected: ${data.user.email} (${client.id})`);
    } else {
      this.logger.log(`Socket disconnected: ${client.id}`);
    }
  }

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const data = client.data as SocketUserData;
    if (!data?.workspaceId) {
      throw new WsException('Unauthorized');
    }

    const { conversationId } = payload;
    if (!conversationId) {
      throw new WsException('conversationId is required');
    }

    // Verify workspace access and ownership
    const conv = await this.db.query(
      `SELECT id, workspace_id, visitor_id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [conversationId, data.workspaceId],
    );

    if (conv.rows.length === 0) {
      throw new WsException('Conversation not found in workspace');
    }

    if (data.type === 'visitor' && conv.rows[0].visitor_id !== data.visitorId) {
      throw new WsException('Unauthorized access to this conversation');
    }

    await client.join(`conversation:${conversationId}`);
    return { status: 'joined', conversationId };
  }

  @SubscribeMessage('conversation:leave')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const { conversationId } = payload;
    if (conversationId) {
      await client.leave(`conversation:${conversationId}`);
    }
    return { status: 'left', conversationId };
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      conversationId: string;
      content: string;
      attachmentUrl?: string;
      isInternal?: boolean;
      replyToMessageId?: string;
      idempotencyKey?: string;
    },
  ) {
    const data = client.data as SocketUserData;
    if (!data?.workspaceId) {
      throw new WsException('Unauthorized');
    }

    const isAgent = data.type === 'agent';
    const sender = isAgent
      ? {
          id: data.user!.sub,
          email: data.user!.email,
          name: data.user!.name || 'Agent',
          role: data.user!.role,
          workspaceId: data.workspaceId,
        }
      : undefined;

    // Visitors can never post internal notes
    const isInternal = isAgent ? Boolean(payload.isInternal) : false;

    const authorized = await this.verifyConversationAccess(client, data, payload.conversationId);
    if (!authorized) {
      throw new WsException('Unauthorized access to this conversation');
    }

    const recordedOutboxIds: string[] = [];
    const message = await realtimeSuppressContext.run(
      { suppressDirectEmit: true, recordedOutboxIds },
      () =>
        this.messagesService.sendMessage(
          data.workspaceId,
          payload.conversationId,
          {
            content: payload.content,
            senderType: isAgent ? 'agent' : 'visitor',
            attachmentUrl: payload.attachmentUrl,
            isInternal,
            replyToMessageId: payload.replyToMessageId,
            idempotencyKey: payload.idempotencyKey,
          },
          sender,
        ),
    );

    // Broadcast to the conversation room
    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit('message:new', message);

    // If message is external, notify workspace inbox queues
    if (!isInternal) {
      this.server
        .to(`workspace:${data.workspaceId}`)
        .emit('conversation:updated', {
          conversationId: payload.conversationId,
          lastMessage: message,
        });
    }

    if (this.outbox && recordedOutboxIds.length > 0) {
      await Promise.all(
        recordedOutboxIds.map((outboxId) => this.outbox!.markPublished(outboxId).catch(() => {})),
      );
    }

    return { success: true, message };
  }

  private async verifyConversationAccess(
    client: Socket,
    data: SocketUserData,
    conversationId: string,
  ): Promise<boolean> {
    if (!data?.workspaceId || !conversationId) return false;
    if (client.rooms && typeof client.rooms.has === 'function' && client.rooms.has(`conversation:${conversationId}`)) {
      return true;
    }
    const conv = await this.db.query(
      'SELECT id, visitor_id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1',
      [conversationId, data.workspaceId],
    );
    if (!conv?.rows || conv.rows.length === 0) return false;
    if (data.type === 'visitor' && conv.rows[0].visitor_id !== data.visitorId) {
      return false;
    }
    return true;
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const data = client.data as SocketUserData;
    if (!data?.workspaceId || !payload?.conversationId) return;
    if (!(await this.verifyConversationAccess(client, data, payload.conversationId))) {
      throw new WsException('Unauthorized access to this conversation');
    }

    client.to(`conversation:${payload.conversationId}`).emit('typing:update', {
      conversationId: payload.conversationId,
      userId: data?.user?.sub || data?.visitorId || 'unknown',
      userName: data?.user?.name || (data?.type === 'agent' ? 'Agent' : 'Visitor'),
      isTyping: true,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const data = client.data as SocketUserData;
    if (!data?.workspaceId || !payload?.conversationId) return;
    if (!(await this.verifyConversationAccess(client, data, payload.conversationId))) {
      throw new WsException('Unauthorized access to this conversation');
    }

    client.to(`conversation:${payload.conversationId}`).emit('typing:update', {
      conversationId: payload.conversationId,
      userId: data?.user?.sub || data?.visitorId || 'unknown',
      userName: data?.user?.name || (data?.type === 'agent' ? 'Agent' : 'Visitor'),
      isTyping: false,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const data = client.data as SocketUserData;
    if (!data?.workspaceId || !payload?.conversationId) return;
    if (!(await this.verifyConversationAccess(client, data, payload.conversationId))) {
      throw new WsException('Unauthorized access to this conversation');
    }

    const result = await realtimeSuppressContext.run(
      { suppressDirectEmit: true },
      () =>
        this.messagesService.markAsRead(
          data.workspaceId,
          payload.conversationId,
          data.type === 'agent' ? 'agent' : 'visitor',
        ),
    );

    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit('message:read', {
        conversationId: payload.conversationId,
        readBy: data.type,
        markedCount: result.markedCount,
        readAt: new Date().toISOString(),
      });

    return result;
  }
}
