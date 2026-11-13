import { DatabaseService } from '../database/database.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';
import { RealtimeService } from '../realtime/realtime.service';
import { OutboxService } from '../realtime/outbox.service';
export declare class MessagesService {
    private readonly db;
    private readonly realtime?;
    private readonly outbox?;
    private readonly logger;
    constructor(db: DatabaseService, realtime?: RealtimeService | undefined, outbox?: OutboxService | undefined);
    getMessages(workspaceId: string, conversationId: string, limit?: number, before?: string): Promise<any[]>;
    sendMessage(workspaceId: string, conversationId: string, dto: SendMessageDto, sender?: AuthenticatedUser): Promise<any>;
    editMessage(workspaceId: string, conversationId: string, messageId: string, dto: UpdateMessageDto, actor: AuthenticatedUser): Promise<any>;
    deleteMessage(workspaceId: string, conversationId: string, messageId: string, actor: AuthenticatedUser): Promise<{
        id: string;
        conversationId: string;
        deleted: boolean;
    }>;
    markAsRead(workspaceId: string, conversationId: string, senderType?: 'agent' | 'visitor'): Promise<{
        markedCount: number | null;
    }>;
    markAsDelivered(workspaceId: string, conversationId: string): Promise<{
        markedCount: number | null;
    }>;
}
