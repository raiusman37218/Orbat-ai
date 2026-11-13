import { Server } from 'socket.io';
export declare class RealtimeService {
    private readonly logger;
    private server;
    setServer(server: Server): void;
    emitToConversation(conversationId: string, event: string, data: any): boolean;
    emitToWorkspace(workspaceId: string, event: string, data: any): boolean;
    emitToUser(userId: string, event: string, data: any): boolean;
    broadcastTyping(conversationId: string, data: {
        userId: string;
        userName: string;
        isTyping: boolean;
    }): boolean;
    broadcastPresence(workspaceId: string, data: {
        userId: string;
        status: 'online' | 'away' | 'offline';
    }): boolean;
}
