import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { LlmProvider, LlmCompletionRequest, LlmCompletionResponse } from '../interfaces/llm-provider.interface';
import { OpenAiProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import { MockFallbackProvider } from './mock-fallback.provider';
export declare class AiGatewayProvider implements LlmProvider {
    private readonly config;
    private readonly openai;
    private readonly anthropic;
    private readonly gemini;
    private readonly compatible;
    private readonly mock;
    private readonly db?;
    readonly providerName = "ai-gateway";
    private readonly logger;
    constructor(config: ConfigService, openai: OpenAiProvider, anthropic: AnthropicProvider, gemini: GeminiProvider, compatible: OpenAiCompatibleProvider, mock: MockFallbackProvider, db?: DatabaseService | undefined);
    generateCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
    generateEmbeddings(texts: string[]): Promise<number[][]>;
    private executeWithRetry;
    private dispatchToProvider;
    private loadWorkspaceConfig;
    private buildCandidateChain;
}
