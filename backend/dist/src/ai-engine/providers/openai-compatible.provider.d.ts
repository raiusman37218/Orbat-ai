import { LlmCompletionRequest, LlmCompletionResponse } from '../interfaces/llm-provider.interface';
export type CompatibleProviderKey = 'deepseek' | 'openrouter' | 'groq' | 'together' | 'ollama' | 'vllm' | 'compatible';
export declare class OpenAiCompatibleProvider {
    private readonly logger;
    generateForProvider(providerKey: CompatibleProviderKey, request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
    generateEmbeddingsForUrl(rawBaseUrl: string, texts: string[], options?: {
        apiKey?: string;
        model?: string;
        timeoutMs?: number;
    }): Promise<number[][]>;
    private resolveEnvApiKey;
}
