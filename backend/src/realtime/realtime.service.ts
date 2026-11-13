import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
    this.logger.log('Socket.IO Server instance registered in RealtimeService.');
  }

  isReady(): boolean {
    return Boolean(this.server);
  }

  emitToConversation(conversationId: string, event: string, data: any) {
    if (!this.server) {
      this.logger.warn(`Cannot emit '${event}' to conversation:${conversationId} — Socket.IO server not initialized`);
      return false;
    }
    this.server.to(`conversation:${conversationId}`).emit(event, data);
    return true;
  }

  emitToWorkspace(workspaceId: string, event: string, data: any) {
    if (!this.server) {
      this.logger.warn(`Cannot emit '${event}' to workspace:${workspaceId} — Socket.IO server not initialized`);
      return false;
    }
    this.server.to(`workspace:${workspaceId}`).emit(event, data);
    return true;
  }

  emitToUser(userId: string, event: string, data: any) {
    if (!this.server) {
      this.logger.warn(`Cannot emit '${event}' to user:${userId} — Socket.IO server not initialized`);
      return false;
    }
    this.server.to(`user:${userId}`).emit(event, data);
    return true;
  }

  broadcastTyping(conversationId: string, data: { userId: string; userName: string; isTyping: boolean }) {
    return this.emitToConversation(conversationId, 'typing:update', {
      conversationId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastPresence(workspaceId: string, data: { userId: string; status: 'online' | 'away' | 'offline' }) {
    return this.emitToWorkspace(workspaceId, 'presence:update', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}

