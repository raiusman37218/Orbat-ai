import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';
export declare class MessagesController {
    private readonly messagesService;
    constructor(messagesService: MessagesService);
    getMessages(workspaceId: string, conversationId: string, limit?: number, before?: string): Promise<any[]>;
    sendMessage(workspaceId: string, conversationId: string, dto: SendMessageDto, user: AuthenticatedUser): Promise<any>;
    editMessage(workspaceId: string, conversationId: string, messageId: string, dto: UpdateMessageDto, user: AuthenticatedUser): Promise<any>;
    deleteMessage(workspaceId: string, conversationId: string, messageId: string, user: AuthenticatedUser): Promise<{
        id: string;
        conversationId: string;
        deleted: boolean;
    }>;
    markAsRead(workspaceId: string, conversationId: string): Promise<{
        markedCount: number;
    }>;
    markAsDelivered(workspaceId: string, conversationId: string): Promise<{
        markedCount: number;
    }>;
}
