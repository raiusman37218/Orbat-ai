import { ConfigService } from '@nestjs/config';
import { LlmProvider, LlmCompletionRequest, LlmCompletionResponse } from '../interfaces/llm-provider.interface';
export declare class AnthropicProvider implements LlmProvider {
    private readonly config;
    readonly providerName = "anthropic";
    private readonly logger;
    private readonly apiKey?;
    constructor(config: ConfigService);
    generateCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}
