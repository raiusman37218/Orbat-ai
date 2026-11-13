import { Injectable, Logger } from '@nestjs/common';
import {
  LlmProvider,
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '../interfaces/llm-provider.interface';

@Injectable()
export class MockFallbackProvider implements LlmProvider {
  readonly providerName = 'mock-fallback';
  private readonly logger = new Logger(MockFallbackProvider.name);

  async generateCompletion(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    const userPrompt =
      request.messages[request.messages.length - 1]?.content || '';

    this.logger.log(`[Mock LLM] Responding to prompt: "${userPrompt.slice(0, 50)}..."`);

    let content =
      'Thank you for reaching out! Our team is reviewing your question and will assist you shortly.';

    if (userPrompt.toLowerCase().includes('hours') || userPrompt.toLowerCase().includes('time')) {
      content = 'Our support team is available Monday through Friday from 9am to 6pm UTC.';
    } else if (userPrompt.toLowerCase().includes('refund') || userPrompt.toLowerCase().includes('billing')) {
      content = 'For billing inquiries and refunds, please provide your invoice number and our billing department will review it within 24 hours.';
    }

    const promptTokens = Math.ceil(userPrompt.length / 4);
    const completionTokens = Math.ceil(content.length / 4);

    return {
      content,
      model: request.model || 'mock-gpt-4o',
      provider: this.providerName,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      estimatedCostUsd: 0.00001,
    };
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Return dummy 768-dim normalized vectors
    return texts.map(() =>
      Array.from({ length: 768 }, () => (Math.random() - 0.5) / 10),
    );
  }
}

