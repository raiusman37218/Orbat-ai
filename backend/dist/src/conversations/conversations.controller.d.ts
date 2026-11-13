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
    bulkUpdateConversations(workspaceId: string, dto: BulkUpdateConversationsDto, actor: AuthenticatedUser): Promise<{
        updatedCount: number;
        items: any[];
    }>;
    getConversationById(workspaceId: string, conversationId: string): Promise<any>;
    createConversation(workspaceId: string, dto: CreateConversationDto): Promise<any>;
    updateConversation(workspaceId: string, conversationId: string, dto: UpdateConversationDto): Promise<any>;
    assignConversation(workspaceId: string, conversationId: string, agentId: string | null, actor: AuthenticatedUser): Promise<any>;
    claimHandoff(workspaceId: string, conversationId: string, agent: AuthenticatedUser): Promise<any>;
    returnToAi(workspaceId: string, conversationId: string, agent: AuthenticatedUser): Promise<any>;
    closeConversation(workspaceId: string, conversationId: string, agent: AuthenticatedUser): Promise<any>;
}
