import { DatabaseService } from '../database/database.service';
export interface TokenUsageRecord {
    workspaceId: string;
    conversationId?: string;
    botMessageId?: string;
    provider: string;
    model: string;
    purpose: 'reply_generation' | 'retrieval_query' | 'grounding_eval' | 'copilot_suggest' | 'summarization';
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
    isBillableReply?: boolean;
    metadata?: Record<string, any>;
}
export declare class AiUsageService {
    private readonly db;
    private readonly logger;
    constructor(db: DatabaseService);
    recordTokenUsage(record: TokenUsageRecord): Promise<void>;
    recordBillableReply(workspaceId: string, conversationId: string, botMessageId: string): Promise<void>;
    checkQuota(workspaceId: string): Promise<{
        allowed: boolean;
        used: number;
        limit: number;
    }>;
    getWorkspaceAiMetrics(workspaceId: string): Promise<{
        totalCalls: number;
        billableReplies: number;
        totalPromptTokens: number;
        totalCompletionTokens: number;
        totalTokens: number;
        totalCostUsd: number;
    }>;
}
