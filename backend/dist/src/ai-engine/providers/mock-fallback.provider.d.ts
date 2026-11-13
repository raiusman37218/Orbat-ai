import { LlmProvider, LlmCompletionRequest, LlmCompletionResponse } from '../interfaces/llm-provider.interface';
export declare class MockFallbackProvider implements LlmProvider {
    readonly providerName = "mock-fallback";
    private readonly logger;
    generateCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
    generateEmbeddings(texts: string[]): Promise<number[][]>;
}
