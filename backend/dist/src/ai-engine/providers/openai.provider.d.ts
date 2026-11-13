import { ConfigService } from '@nestjs/config';
import { LlmProvider, LlmCompletionRequest, LlmCompletionResponse } from '../interfaces/llm-provider.interface';
export declare class OpenAiProvider implements LlmProvider {
    private readonly config;
    readonly providerName = "openai";
    private readonly logger;
    private readonly apiKey?;
    constructor(config: ConfigService);
    generateCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
    generateEmbeddings(texts: string[]): Promise<number[][]>;
}
