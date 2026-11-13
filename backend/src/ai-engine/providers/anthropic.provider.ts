import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmProvider,
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '../interfaces/llm-provider.interface';

@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly providerName = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY;
  }

  async generateCompletion(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured.');
    }

    const model = request.model || 'claude-3-5-haiku-20241022';
    const systemMessage = request.messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens ?? 512,
        system: systemMessage,
        messages: conversationMessages,
        temperature: request.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    const usage = data.usage || { input_tokens: 0, output_tokens: 0 };

    // Claude 3.5 Haiku ($0.80 / 1M in, $4.00 / 1M out)
    const promptTokens = usage.input_tokens || 0;
    const completionTokens = usage.output_tokens || 0;
    const cost = (promptTokens * 0.8 + completionTokens * 4.0) / 1000000;

    return {
      content,
      model,
      provider: this.providerName,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      estimatedCostUsd: Number(cost.toFixed(6)),
    };
  }
}

