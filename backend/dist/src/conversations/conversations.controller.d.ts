import { ConversationsService } from './conversations.service';
import { QueryConversationsDto } from './dto/query-conversations.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { BulkUpdateConversationsDto } from './dto/bulk-update-conversations.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';
export declare class ConversationsController {
    private readonly conversationsService;
    constructor(conversationsService: ConversationsService);
    getConversations(workspaceId: string, query: QueryConversationsDto): Promise<{
        items: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getHandovers(workspaceId: string, days?: string, limit?: string): Promise<{
        id: any;
        content: any;
        created_at: any;
        reply_to_message_id: any;
        metadata: any;
        question_content: any;
        conversation: {
            id: any;
            workspace_id: any;
            status: any;
            priority: any;
            channel: any;
            ai_paused_reason: any;
            ai_needs_attention_at: any;
            channel_metadata: any;
            assigned_agent_id: any;
            visitor: {
                name: any;
                email: any;
            };
        };
    }[]>;
    bulkUpdateConversations(workspaceId: string, dto: BulkUpdateConversationsDto, actor: AuthenticatedUser): Promise<{
        updatedCount: number;
        items: any[];
    }>;
    getConversationById(workspaceId: string, conversationId: string): Promise<any>;
    createConversation(workspaceId: string, dto: CreateConversationDto): Promise<any>;
    updateConversation(workspaceId: string, conversationId: string, dto: UpdateConversationDto): Promise<any>;
    assignConversation(workspaceId: string, conversationId: string, agentId: string | null, actor: AuthenticatedUser): Promise<any>;
    claimHandoff(workspaceId: string, conversationId: string, agent: AuthenticatedUser): Promise<any>;
    skipHandoff(workspaceId: string, conversationId: string, agent: AuthenticatedUser): Promise<{
        ok: boolean;
        reason: string;
        status: any;
        broadcast?: undefined;
        nextAgentId?: undefined;
        updated?: undefined;
    } | {
        ok: boolean;
        status: string;
        broadcast: boolean;
        reason?: undefined;
        nextAgentId?: undefined;
        updated?: undefined;
    } | {
        ok: boolean;
        nextAgentId: string;
        updated: any;
        reason?: undefined;
        status?: undefined;
        broadcast?: undefined;
    } | {
        ok: boolean;
        broadcast: boolean;
        updated: any;
        reason?: undefined;
        status?: undefined;
        nextAgentId?: undefined;
    }>;
    returnToAi(workspaceId: string, conversationId: string, agent: AuthenticatedUser): Promise<any>;
    closeConversation(workspaceId: string, conversationId: string, agent: AuthenticatedUser): Promise<any>;
}
