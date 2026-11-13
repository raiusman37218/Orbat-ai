import { AiEngineService } from './ai-engine.service';
import { AiUsageService } from './ai-usage.service';
import { GenerateAiReplyDto } from './dto/generate-reply.dto';
export declare class AiEngineController {
    private readonly aiService;
    private readonly aiUsage;
    constructor(aiService: AiEngineService, aiUsage: AiUsageService);
    generateReply(workspaceId: string, dto: GenerateAiReplyDto): Promise<{
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
    copilotSuggest(workspaceId: string, conversationId: string): Promise<{
        suggestions: string[];
    }>;
    summarize(workspaceId: string, conversationId: string): Promise<{
        summary: string;
    }>;
    getUsageMetrics(workspaceId: string): Promise<{
        totalCalls: number;
        billableReplies: number;
        totalPromptTokens: number;
        totalCompletionTokens: number;
        totalTokens: number;
        totalCostUsd: number;
    }>;
}
