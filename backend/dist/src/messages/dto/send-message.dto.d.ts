export declare class SendMessageDto {
    content?: string;
    senderType?: 'agent' | 'visitor' | 'system' | 'ai';
    isInternal?: boolean;
    attachmentUrl?: string;
    replyToMessageId?: string;
    idempotencyKey?: string;
}
