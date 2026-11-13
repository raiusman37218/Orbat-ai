export declare class BulkUpdateConversationsDto {
    ids: string[];
    action: 'resolve' | 'reopen' | 'assign' | 'spam';
    agentId?: string | null;
}
