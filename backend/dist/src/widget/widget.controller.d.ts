import { WidgetService } from './widget.service';
export declare class WidgetController {
    private readonly widgetService;
    constructor(widgetService: WidgetService);
    getConfig(workspaceId: string): Promise<any>;
    getAgents(workspaceId: string): Promise<any>;
    getHelp(workspaceId: string): Promise<{
        sections: any[];
        articles: any[];
    }>;
    session(body: Record<string, any>): Promise<any>;
    listConversations(visitorId: string, token: string): Promise<any>;
    startConversation(body: Record<string, any>): Promise<any>;
    getMessages(conversationId: string, visitorId: string, token: string): Promise<any>;
    sendMessage(conversationId: string, body: Record<string, any>): Promise<any>;
    requestHandoff(conversationId: string, body: Record<string, any>): Promise<any>;
    setAiAssist(conversationId: string, body: Record<string, any>): Promise<any>;
    setTopic(conversationId: string, body: Record<string, any>): Promise<any>;
    markResolved(conversationId: string, body: Record<string, any>): Promise<any>;
    saveWelcome(conversationId: string, body: Record<string, any>): Promise<any>;
    heartbeat(body: Record<string, any>): Promise<{
        ok: boolean;
    }>;
    recordPage(body: Record<string, any>): Promise<{
        ok: boolean;
    }>;
    updateMeta(body: Record<string, any>): Promise<{
        ok: boolean;
    }>;
    updateVisitor(body: Record<string, any>): Promise<{
        ok: boolean;
    }>;
    offline(body: Record<string, any>): Promise<{
        ok: boolean;
    }>;
    mark(body: Record<string, any>): Promise<{
        ok: boolean;
    }>;
    submitCsat(body: Record<string, any>): Promise<any>;
    rpc(fnName: string, body: Record<string, any>): Promise<any>;
}
