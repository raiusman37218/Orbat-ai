import { DatabaseService } from '../database/database.service';
import { LlmProvider } from './interfaces/llm-provider.interface';
import { HybridRetrievalService } from './retrieval/hybrid-retrieval.service';
import { AiUsageService } from './ai-usage.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
export declare class AiEngineService {
    private readonly db;
    private readonly llm;
    private readonly retrieval;
    private readonly usage;
    private readonly messagesService;
    private readonly conversationsService;
    private readonly logger;
    constructor(db: DatabaseService, llm: LlmProvider, retrieval: HybridRetrievalService, usage: AiUsageService, messagesService: MessagesService, conversationsService: ConversationsService);
    generateBotResponse(workspaceId: string, conversationId: string, triggerMessage: string, triggerMessageId?: string): Promise<{
        replied: boolean;
        reason: string;
        message?: undefined;
        chunksUsed?: undefined;
    } | {
        replied: boolean;
        message: any;
        chunksUsed: number;
        reason?: undefined;
    }>;
    suggestCopilotReply(workspaceId: string, conversationId: string): Promise<{
        suggestions: string[];
    }>;
    summarizeConversation(workspaceId: string, conversationId: string): Promise<{
        summary: string;
    }>;
    private logReplyEvent;
}
