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
var RealtimeGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const realtime_service_1 = require("./realtime.service");
const outbox_service_1 = require("./outbox.service");
const messages_service_1 = require("../messages/messages.service");
const database_service_1 = require("../database/database.service");
const realtime_emit_context_1 = require("./realtime-emit.context");
let RealtimeGateway = RealtimeGateway_1 = class RealtimeGateway {
    constructor(jwtService, configService, realtimeService, messagesService, db, outbox) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.realtimeService = realtimeService;
        this.messagesService = messagesService;
        this.db = db;
        this.outbox = outbox;
        this.logger = new common_1.Logger(RealtimeGateway_1.name);
    }
    afterInit(server) {
        this.realtimeService.setServer(server);
        this.logger.log('RealtimeGateway initialized on namespace /realtime');
    }
    async handleConnection(client) {
        try {
            const rawToken = client.handshake.auth?.token ||
                (client.handshake.headers?.authorization
                    ? client.handshake.headers.authorization.replace('Bearer ', '')
                    : null);
            const visitorId = client.handshake.auth?.visitorId;
            const visitorToken = client.handshake.auth?.visitorToken ||
                client.handshake.headers?.['x-zentry-visitor-token'];
            const workspaceId = client.handshake.auth?.workspaceId ||
                client.handshake.headers?.['x-workspace-id'];
            if (rawToken) {
                const jwtSecret = this.configService.get('jwt.secret');
                const payload = await this.jwtService.verifyAsync(rawToken, {
                    secret: jwtSecret,
                });
                let resolvedRole = payload.role;
                let resolvedWorkspaceId = payload.workspaceId || payload.workspace_id;
                const dbCheck = await this.db.query(`SELECT a.is_active, COALESCE(a.token_version, 1) AS token_version, a.role, a.workspace_id, a.is_super_admin, w.is_suspended, w.deleted_at
           FROM public.agents a
           LEFT JOIN public.workspaces w ON w.id = a.workspace_id
           WHERE a.id = $1
           LIMIT 1`, [payload.sub]);
                if (dbCheck?.rows) {
                    const row = dbCheck.rows[0];
                    if (!row ||
                        row.is_active === false ||
                        (typeof payload.tv === 'number' && Number(row.token_version ?? 1) !== payload.tv) ||
                        row.deleted_at != null ||
                        (row.is_suspended === true && !row.is_super_admin)) {
                        this.logger.warn(`Deactivated or suspended agent socket rejected: ${payload.sub}`);
                        client.disconnect(true);
                        return;
                    }
                    resolvedRole = row.role || resolvedRole;
                    resolvedWorkspaceId = row.workspace_id || resolvedWorkspaceId;
                }
                const data = {
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
                client.join(`workspace:${resolvedWorkspaceId}`);
                client.join(`user:${payload.sub}`);
                this.logger.log(`Agent connected: ${payload.email} (Workspace: ${resolvedWorkspaceId}, Socket: ${client.id})`);
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
                const authRes = await this.db.query(`SELECT visitor_id, workspace_id FROM public.fn_widget_auth($1::uuid, $2::text) LIMIT 1`, [String(visitorId), String(visitorToken)]);
                const sessionRow = authRes?.rows?.[0];
                if (!sessionRow || sessionRow.workspace_id !== String(workspaceId)) {
                    this.logger.warn(`Invalid visitor token or workspace mismatch on socket ${client.id}`);
                    client.disconnect(true);
                    return;
                }
                const data = {
                    type: 'visitor',
                    workspaceId: String(workspaceId),
                    visitorId: String(visitorId),
                };
                client.data = data;
                this.logger.log(`Visitor connected: ${visitorId} (Workspace: ${workspaceId}, Socket: ${client.id})`);
                return;
            }
            this.logger.warn(`Unauthenticated connection rejected for socket ${client.id}`);
            client.disconnect(true);
        }
        catch (err) {
            this.logger.warn(`Connection auth error for socket ${client.id}: ${err.message}`);
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
        const data = client.data;
        if (data?.type === 'agent' && data.user) {
            this.realtimeService.broadcastPresence(data.workspaceId, {
                userId: data.user.sub,
                status: 'offline',
            });
            this.logger.log(`Agent disconnected: ${data.user.email} (${client.id})`);
        }
        else {
            this.logger.log(`Socket disconnected: ${client.id}`);
        }
    }
    async handleJoinConversation(client, payload) {
        const data = client.data;
        if (!data?.workspaceId) {
            throw new websockets_1.WsException('Unauthorized');
        }
        const { conversationId } = payload;
        if (!conversationId) {
            throw new websockets_1.WsException('conversationId is required');
        }
        const conv = await this.db.query(`SELECT id, workspace_id, visitor_id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1`, [conversationId, data.workspaceId]);
        if (conv.rows.length === 0) {
            throw new websockets_1.WsException('Conversation not found in workspace');
        }
        if (data.type === 'visitor' && conv.rows[0].visitor_id !== data.visitorId) {
            throw new websockets_1.WsException('Unauthorized access to this conversation');
        }
        await client.join(`conversation:${conversationId}`);
        return { status: 'joined', conversationId };
    }
    async handleLeaveConversation(client, payload) {
        const { conversationId } = payload;
        if (conversationId) {
            await client.leave(`conversation:${conversationId}`);
        }
        return { status: 'left', conversationId };
    }
    async handleSendMessage(client, payload) {
        const data = client.data;
        if (!data?.workspaceId) {
            throw new websockets_1.WsException('Unauthorized');
        }
        const isAgent = data.type === 'agent';
        const sender = isAgent
            ? {
                id: data.user.sub,
                email: data.user.email,
                name: data.user.name || 'Agent',
                role: data.user.role,
                workspaceId: data.workspaceId,
            }
            : undefined;
        const isInternal = isAgent ? Boolean(payload.isInternal) : false;
        const authorized = await this.verifyConversationAccess(client, data, payload.conversationId);
        if (!authorized) {
            throw new websockets_1.WsException('Unauthorized access to this conversation');
        }
        const recordedOutboxIds = [];
        const message = await realtime_emit_context_1.realtimeSuppressContext.run({ suppressDirectEmit: true, recordedOutboxIds }, () => this.messagesService.sendMessage(data.workspaceId, payload.conversationId, {
            content: payload.content,
            senderType: isAgent ? 'agent' : 'visitor',
            attachmentUrl: payload.attachmentUrl,
            isInternal,
            replyToMessageId: payload.replyToMessageId,
            idempotencyKey: payload.idempotencyKey,
        }, sender));
        this.server
            .to(`conversation:${payload.conversationId}`)
            .emit('message:new', message);
        if (!isInternal) {
            this.server
                .to(`workspace:${data.workspaceId}`)
                .emit('conversation:updated', {
                conversationId: payload.conversationId,
                lastMessage: message,
            });
        }
        if (this.outbox && recordedOutboxIds.length > 0) {
            await Promise.all(recordedOutboxIds.map((outboxId) => this.outbox.markPublished(outboxId).catch(() => { })));
        }
        return { success: true, message };
    }
    async verifyConversationAccess(client, data, conversationId) {
        if (!data?.workspaceId || !conversationId)
            return false;
        if (client.rooms && typeof client.rooms.has === 'function' && client.rooms.has(`conversation:${conversationId}`)) {
            return true;
        }
        const conv = await this.db.query('SELECT id, visitor_id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1', [conversationId, data.workspaceId]);
        if (!conv?.rows || conv.rows.length === 0)
            return false;
        if (data.type === 'visitor' && conv.rows[0].visitor_id !== data.visitorId) {
            return false;
        }
        return true;
    }
    async handleTypingStart(client, payload) {
        const data = client.data;
        if (!data?.workspaceId || !payload?.conversationId)
            return;
        if (!(await this.verifyConversationAccess(client, data, payload.conversationId))) {
            throw new websockets_1.WsException('Unauthorized access to this conversation');
        }
        client.to(`conversation:${payload.conversationId}`).emit('typing:update', {
            conversationId: payload.conversationId,
            userId: data?.user?.sub || data?.visitorId || 'unknown',
            userName: data?.user?.name || (data?.type === 'agent' ? 'Agent' : 'Visitor'),
            isTyping: true,
            timestamp: new Date().toISOString(),
        });
    }
    async handleTypingStop(client, payload) {
        const data = client.data;
        if (!data?.workspaceId || !payload?.conversationId)
            return;
        if (!(await this.verifyConversationAccess(client, data, payload.conversationId))) {
            throw new websockets_1.WsException('Unauthorized access to this conversation');
        }
        client.to(`conversation:${payload.conversationId}`).emit('typing:update', {
            conversationId: payload.conversationId,
            userId: data?.user?.sub || data?.visitorId || 'unknown',
            userName: data?.user?.name || (data?.type === 'agent' ? 'Agent' : 'Visitor'),
            isTyping: false,
            timestamp: new Date().toISOString(),
        });
    }
    async handleMessageRead(client, payload) {
        const data = client.data;
        if (!data?.workspaceId || !payload?.conversationId)
            return;
        if (!(await this.verifyConversationAccess(client, data, payload.conversationId))) {
            throw new websockets_1.WsException('Unauthorized access to this conversation');
        }
        const result = await realtime_emit_context_1.realtimeSuppressContext.run({ suppressDirectEmit: true }, () => this.messagesService.markAsRead(data.workspaceId, payload.conversationId, data.type === 'agent' ? 'agent' : 'visitor'));
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
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RealtimeGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('conversation:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleJoinConversation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('conversation:leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleLeaveConversation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:send'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing:start'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleTypingStart", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing:stop'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleTypingStop", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:read'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleMessageRead", null);
exports.RealtimeGateway = RealtimeGateway = RealtimeGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        namespace: '/realtime',
    }),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => messages_service_1.MessagesService))),
    __param(5, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        realtime_service_1.RealtimeService,
        messages_service_1.MessagesService,
        database_service_1.DatabaseService,
        outbox_service_1.OutboxService])
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map