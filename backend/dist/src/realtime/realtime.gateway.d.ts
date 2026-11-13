import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';
import { MessagesService } from '../messages/messages.service';
import { DatabaseService } from '../database/database.service';
export declare class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwtService;
    private readonly configService;
    private readonly realtimeService;
    private readonly messagesService;
    private readonly db;
    private readonly logger;
    server: Server;
    constructor(jwtService: JwtService, configService: ConfigService, realtimeService: RealtimeService, messagesService: MessagesService, db: DatabaseService);
    afterInit(server: Server): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleJoinConversation(client: Socket, payload: {
        conversationId: string;
    }): Promise<{
        status: string;
        conversationId: string;
    }>;
    handleLeaveConversation(client: Socket, payload: {
        conversationId: string;
    }): Promise<{
        status: string;
        conversationId: string;
    }>;
    handleSendMessage(client: Socket, payload: {
        conversationId: string;
        content: string;
        attachmentUrl?: string;
        isInternal?: boolean;
        replyToMessageId?: string;
        idempotencyKey?: string;
    }): Promise<{
        success: boolean;
        message: any;
    }>;
    handleTypingStart(client: Socket, payload: {
        conversationId: string;
    }): void;
    handleTypingStop(client: Socket, payload: {
        conversationId: string;
    }): void;
    handleMessageRead(client: Socket, payload: {
        conversationId: string;
    }): Promise<{
        markedCount: number;
    }>;
}
