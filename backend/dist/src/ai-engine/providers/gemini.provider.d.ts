import { ConfigService } from '@nestjs/config';
import { LlmProvider, LlmCompletionRequest, LlmCompletionResponse } from '../interfaces/llm-provider.interface';
export declare class GeminiProvider implements LlmProvider {
    private readonly config;
    readonly providerName = "gemini";
    private readonly logger;
    private readonly apiKey?;
    constructor(config: ConfigService);
    generateCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
    generateEmbeddings(texts: string[], apiKeyOverride?: string): Promise<number[][]>;
}
