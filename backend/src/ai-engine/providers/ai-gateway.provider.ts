import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import {
  LlmProvider,
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '../interfaces/llm-provider.interface';
import { OpenAiProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import {
  OpenAiCompatibleProvider,
  CompatibleProviderKey,
} from './openai-compatible.provider';
import { MockFallbackProvider } from './mock-fallback.provider';

interface WorkspaceAiConfig {
  provider?: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  fallback_provider?: string;
  fallback_model?: string;
}

const COMPATIBLE_PROVIDERS = new Set<string>([
  'deepseek',
  'openrouter',
  'groq',
  'together',
  'ollama',
  'vllm',
  'compatible',
]);

@Injectable()
export class AiGatewayProvider implements LlmProvider {
  readonly providerName = 'ai-gateway';
  private readonly logger = new Logger(AiGatewayProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly openai: OpenAiProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly gemini: GeminiProvider,
    private readonly compatible: OpenAiCompatibleProvider,
    private readonly mock: MockFallbackProvider,
    @Optional() private readonly db?: DatabaseService,
  ) {}

  async generateCompletion(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    const wsConfig = request.workspaceId
      ? await this.loadWorkspaceConfig(request.workspaceId)
      : {};

    const candidates = this.buildCandidateChain(request, wsConfig);
    const errors: string[] = [];

    for (const candidate of candidates) {
      try {
        return await this.executeWithRetry(candidate.provider, {
          ...request,
          model: candidate.model || request.model,
          apiKey: candidate.apiKey || request.apiKey,
          baseUrl: candidate.baseUrl || request.baseUrl,
        });
      } catch (err: any) {
        const msg = `${candidate.provider}: ${err?.message || String(err)}`;
        errors.push(msg);
        this.logger.warn(`AI provider candidate failed -> trying next (${msg})`);
      }
    }

    const isProd =
      (this.config?.get<string>('nodeEnv') || process.env.NODE_ENV) === 'production';
    const allowMockInProd = process.env.ALLOW_MOCK_AI === 'true';
    if (isProd && !allowMockInProd) {
      throw new Error(
        `No AI provider succeeded (${errors.join(' | ') || 'no provider configured'}).`,
      );
    }

    return this.mock.generateCompletion(request);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const geminiKey = this.config?.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        return await this.gemini.generateEmbeddings(texts, geminiKey);
      } catch (err: any) {
        this.logger.warn(`Gemini embeddings failed: ${err?.message}`);
      }
    }

    const ollamaUrl = process.env.OLLAMA_BASE_URL;
    if (ollamaUrl) {
      try {
        return await this.compatible.generateEmbeddingsForUrl(ollamaUrl, texts, {
          model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
        });
      } catch (err: any) {
        this.logger.warn(`Ollama embeddings failed: ${err?.message}`);
      }
    }

    const openaiKey = this.config?.get<string>('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        return await this.openai.generateEmbeddings(texts);
      } catch (err: any) {
        this.logger.warn(`OpenAI embeddings failed: ${err?.message}`);
      }
    }

    const isProd =
      (this.config?.get<string>('nodeEnv') || process.env.NODE_ENV) === 'production';
    if (isProd && process.env.ALLOW_MOCK_AI !== 'true') {
      throw new Error('No live embedding provider configured in production.');
    }

    return this.mock.generateEmbeddings(texts);
  }

  private async executeWithRetry(
    provider: string,
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    let lastError: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.dispatchToProvider(provider, request);
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const retryable =
          msg.includes('(429)') ||
          msg.includes('(500)') ||
          msg.includes('(502)') ||
          msg.includes('(503)') ||
          msg.includes('(504)') ||
          err?.name === 'TimeoutError' ||
          err?.name === 'AbortError';
        if (!retryable || attempt === 1) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  private async dispatchToProvider(
    provider: string,
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    const normalized = provider.toLowerCase();
    if (normalized === 'openai') {
      return this.openai.generateCompletion(request);
    }
    if (normalized === 'anthropic' || normalized === 'claude') {
      return this.anthropic.generateCompletion(request);
    }
    if (normalized === 'gemini' || normalized === 'google') {
      return this.gemini.generateCompletion(request);
    }
    if (COMPATIBLE_PROVIDERS.has(normalized)) {
      return this.compatible.generateForProvider(
        normalized as CompatibleProviderKey,
        request,
      );
    }
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  private async loadWorkspaceConfig(workspaceId: string): Promise<WorkspaceAiConfig> {
    if (!this.db) return {};
    try {
      const res = await this.db.query(
        'SELECT ai_settings FROM public.workspaces WHERE id = $1 LIMIT 1',
        [workspaceId],
      );
      const settings = res?.rows?.[0]?.ai_settings;
      if (settings && typeof settings === 'object') {
        return settings as WorkspaceAiConfig;
      }
    } catch (err: any) {
      this.logger.warn(`Failed loading workspace AI config: ${err?.message}`);
    }
    return {};
  }

  private buildCandidateChain(
    request: LlmCompletionRequest,
    ws: WorkspaceAiConfig,
  ): Array<{ provider: string; model?: string; apiKey?: string; baseUrl?: string }> {
    const chain: Array<{ provider: string; model?: string; apiKey?: string; baseUrl?: string }> = [];
    const seen = new Set<string>();
    const push = (entry: { provider?: string; model?: string; apiKey?: string; baseUrl?: string }) => {
      const p = entry.provider?.trim().toLowerCase();
      if (!p || seen.has(`${p}:${entry.baseUrl || ''}`)) return;
      seen.add(`${p}:${entry.baseUrl || ''}`);
      chain.push({ ...entry, provider: p });
    };

    if (request.provider) {
      push({
        provider: request.provider,
        model: request.model,
        apiKey: request.apiKey,
        baseUrl: request.baseUrl,
      });
    }

    if (ws.provider) {
      push({
        provider: ws.provider,
        model: ws.model,
        apiKey: ws.api_key,
        baseUrl: ws.base_url,
      });
    }
    if (ws.fallback_provider) {
      push({
        provider: ws.fallback_provider,
        model: ws.fallback_model,
      });
    }

    const envOrder: Array<[string, string | undefined]> = [
      ['openai', process.env.OPENAI_API_KEY],
      ['anthropic', process.env.ANTHROPIC_API_KEY],
      ['gemini', process.env.GEMINI_API_KEY],
      ['deepseek', process.env.DEEPSEEK_API_KEY],
      ['openrouter', process.env.OPENROUTER_API_KEY],
      ['groq', process.env.GROQ_API_KEY],
      ['together', process.env.TOGETHER_API_KEY],
      ['ollama', process.env.OLLAMA_BASE_URL],
      ['vllm', process.env.VLLM_BASE_URL],
      ['compatible', process.env.CUSTOM_LLM_BASE_URL],
    ];
    for (const [provider, present] of envOrder) {
      if (present && present.trim()) {
        push({ provider });
      }
    }

    return chain;
  }
}

