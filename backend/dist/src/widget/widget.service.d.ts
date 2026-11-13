import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
export declare class WidgetService {
    private readonly db;
    private readonly realtime?;
    private readonly logger;
    constructor(db: DatabaseService, realtime?: RealtimeService);
    private assertUuid;
    private assertToken;
    private mapPgError;
    private runRpc;
    private emitConversationEvent;
    getConfig(workspaceId: string): Promise<any>;
    getAgents(workspaceId: string): Promise<any>;
    createOrVerifySession(body: {
        workspaceId?: string;
        p_workspace_id?: string;
        visitorId?: string;
        p_visitor_id?: string;
        token?: string | null;
        p_token?: string | null;
    }): Promise<any>;
    listConversations(visitorId: string, token: string): Promise<any>;
    startConversation(visitorId: string, token: string, forceNew?: boolean): Promise<any>;
    getMessages(visitorId: string, token: string, conversationId: string): Promise<any>;
    sendMessage(visitorId: string, token: string, conversationId: string, content: string, attachmentUrl?: string | null): Promise<any>;
    heartbeat(visitorId: string, token: string, body: Record<string, any>): Promise<{
        ok: boolean;
    }>;
    recordPage(visitorId: string, token: string, body: Record<string, any>): Promise<{
        ok: boolean;
    }>;
    updateMeta(visitorId: string, token: string, body: Record<string, any>): Promise<{
        ok: boolean;
    }>;
    updateVisitor(visitorId: string, token: string, body: Record<string, any>): Promise<{
        ok: boolean;
    }>;
    markOffline(visitorId: string, token: string): Promise<{
        ok: boolean;
    }>;
    markMessages(visitorId: string, token: string, conversationId: string, read?: boolean): Promise<{
        ok: boolean;
    }>;
    requestHandoff(visitorId: string, token: string, conversationId: string, reason?: string | null): Promise<any>;
    setAiAssist(visitorId: string, token: string, conversationId: string, enabled?: boolean): Promise<any>;
    setTopic(visitorId: string, token: string, conversationId: string, topic: string): Promise<any>;
    markResolved(visitorId: string, token: string, conversationId: string): Promise<any>;
    saveWelcome(visitorId: string, token: string, conversationId: string, content: string): Promise<any>;
    submitCsat(visitorId: string, token: string, conversationId: string, rating: number, feedback?: string | null): Promise<any>;
    invokeWhitelistedRpc(fnName: string, body: Record<string, any>): Promise<any>;
}
