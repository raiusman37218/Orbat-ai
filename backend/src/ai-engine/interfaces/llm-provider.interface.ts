export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionRequest {
  model?: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmCompletionResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  estimatedCostUsd: number;
}

export interface GroundedChunk {
  chunkId: string;
  knowledgeId: string;
  title: string;
  content: string;
  similarityScore: number;
}

export const LLM_PROVIDER = 'LLM_PROVIDER';

export interface LlmProvider {
  readonly providerName: string;
  generateCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  generateEmbeddings?(texts: string[]): Promise<number[][]>;
}

