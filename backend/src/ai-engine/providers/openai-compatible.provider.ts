import { Injectable, Logger } from '@nestjs/common';
import {
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '../interfaces/llm-provider.interface';
import { validateProviderBaseUrl } from '../../common/security/url-safety';

export type CompatibleProviderKey =
  | 'deepseek'
  | 'openrouter'
  | 'groq'
  | 'together'
  | 'ollama'
  | 'vllm'
  | 'compatible';

interface CompatibleDefaults {
  baseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
  costPer1MIn: number;
  costPer1MOut: number;
}

const PROVIDER_DEFAULTS: Record<CompatibleProviderKey, CompatibleDefaults> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    requiresKey: true,
    costPer1MIn: 0.14,
    costPer1MOut: 0.28,
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    requiresKey: true,
    costPer1MIn: 0.2,
    costPer1MOut: 0.8,
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-8b-instant',
    requiresKey: true,
    costPer1MIn: 0.05,
    costPer1MOut: 0.08,
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    requiresKey: true,
    costPer1MIn: 0.18,
    costPer1MOut: 0.18,
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || '',
    defaultModel: process.env.OLLAMA_MODEL || 'llama3.1',
    requiresKey: false,
    costPer1MIn: 0,
    costPer1MOut: 0,
  },
  vllm: {
    baseUrl: process.env.VLLM_BASE_URL || '',
    defaultModel: process.env.VLLM_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    requiresKey: false,
    costPer1MIn: 0,
    costPer1MOut: 0,
  },
  compatible: {
    baseUrl: process.env.CUSTOM_LLM_BASE_URL || '',
    defaultModel: 'gpt-4o-mini',
    requiresKey: false,
    costPer1MIn: 0.2,
    costPer1MOut: 0.6,
  },
};

@Injectable()
export class OpenAiCompatibleProvider {
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);

  async generateForProvider(
    providerKey: CompatibleProviderKey,
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    const defaults = PROVIDER_DEFAULTS[providerKey];
    const apiKey = (request.apiKey || this.resolveEnvApiKey(providerKey) || '').trim();
    const rawBaseUrl = (request.baseUrl || defaults.baseUrl || '').trim();

    if (defaults.requiresKey && !apiKey) {
      throw new Error(`${providerKey.toUpperCase()} API key is not configured.`);
    }
    if (!rawBaseUrl) {
      throw new Error(`${providerKey.toUpperCase()} base URL is not configured.`);
    }

    const baseUrl = await validateProviderBaseUrl(rawBaseUrl);
    const model = request.model || defaults.defaultModel;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 512,
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? 25000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`${providerKey} API error (${response.status}): ${errorText.slice(0, 300)}`);
    }

    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const usage = data?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const promptTokens = Number(usage.prompt_tokens || 0);
    const completionTokens = Number(usage.completion_tokens || 0);
    const cost =
      (promptTokens * defaults.costPer1MIn + completionTokens * defaults.costPer1MOut) / 1_000_000;

    return {
      content,
      model,
      provider: providerKey,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: Number(usage.total_tokens || promptTokens + completionTokens),
      },
      estimatedCostUsd: Number(cost.toFixed(6)),
    };
  }

  async generateEmbeddingsForUrl(
    rawBaseUrl: string,
    texts: string[],
    options: { apiKey?: string; model?: string; timeoutMs?: number } = {},
  ): Promise<number[][]> {
    const baseUrl = await validateProviderBaseUrl(rawBaseUrl);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.apiKey) {
      headers.Authorization = `Bearer ${options.apiKey}`;
    }
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model || 'text-embedding-3-small',
        input: texts,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Embeddings API error (${response.status}): ${errText.slice(0, 300)}`);
    }

    const data: any = await response.json();
    return Array.isArray(data?.data) ? data.data.map((item: any) => item.embedding) : [];
  }

  private resolveEnvApiKey(providerKey: CompatibleProviderKey): string | undefined {
    switch (providerKey) {
      case 'deepseek':
        return process.env.DEEPSEEK_API_KEY;
      case 'openrouter':
        return process.env.OPENROUTER_API_KEY;
      case 'groq':
        return process.env.GROQ_API_KEY;
      case 'together':
        return process.env.TOGETHER_API_KEY;
      case 'ollama':
        return process.env.OLLAMA_API_KEY;
      case 'vllm':
        return process.env.VLLM_API_KEY;
      default:
        return process.env.CUSTOM_LLM_API_KEY;
    }
  }
}

