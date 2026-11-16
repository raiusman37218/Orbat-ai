import type { AgentModelConfig } from '@/lib/ai/agent-templates';
import { executePlatformAiReply, getPlatformAiConfigServerOnly } from '@/lib/ai/platform-gateway';
import {
  chat,
  DEFAULT_MODELS,
  isConfigured,
  type ProviderConfig,
  type ProviderId,
} from '@/lib/ai/provider';
import type { ChatTurn } from './types';

const VALID_PROVIDERS = new Set<ProviderId>([
  'anthropic',
  'openai',
  'google',
  'deepseek',
  'compatible',
]);

export function normalizeProviderId(raw: unknown): ProviderId | null {
  const val = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return VALID_PROVIDERS.has(val as ProviderId) ? (val as ProviderId) : null;
}

export function clampAgentTemperature(raw: unknown, fallback = 0.2): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(1.5, Math.max(0, Number(num.toFixed(2))));
}

export interface ResolvedModelRunConfig {
  providerConfig: ProviderConfig | null;
  temperature: number;
  requestedProvider: ProviderId | null;
  requestedModel: string | null;
  overrideApplied: boolean;
  fallbackNote: string | null;
}

/**
 * Resolves the effective ProviderConfig & sampling temperature by layering an
 * individual agent's `modelConfig` on top of the active platform/caller config.
 * Safely preserves API credentials and falls back if an alternate provider
 * lacks a configured key in this deployment.
 */
export function resolveEffectiveProviderConfig(
  baseConfig: ProviderConfig | null | undefined,
  modelConfig?: Partial<AgentModelConfig> | null,
): ResolvedModelRunConfig {
  const requestedProvider = normalizeProviderId(modelConfig?.provider);
  const requestedModel =
    typeof modelConfig?.model === 'string' && modelConfig.model.trim()
      ? modelConfig.model.trim().slice(0, 120)
      : null;
  const temperature = clampAgentTemperature(modelConfig?.temperature, 0.2);

  if (!requestedProvider && !requestedModel) {
    return {
      providerConfig: baseConfig ?? null,
      temperature,
      requestedProvider: null,
      requestedModel: null,
      overrideApplied: false,
      fallbackNote: null,
    };
  }

  // Same provider or model-only override: inherit API key & baseUrl from baseConfig.
  if (baseConfig && (!requestedProvider || requestedProvider === baseConfig.provider)) {
    return {
      providerConfig: {
        ...baseConfig,
        model: requestedModel || baseConfig.model || DEFAULT_MODELS[baseConfig.provider],
      },
      temperature,
      requestedProvider: requestedProvider ?? baseConfig.provider,
      requestedModel,
      overrideApplied: Boolean(requestedModel && requestedModel !== baseConfig.model),
      fallbackNote: null,
    };
  }

  // Alternate provider override: usable only if deployment env configures its key.
  if (requestedProvider && requestedProvider !== 'compatible') {
    const candidate: ProviderConfig = {
      provider: requestedProvider,
      model: requestedModel || DEFAULT_MODELS[requestedProvider],
    };
    if (isConfigured(candidate)) {
      return {
        providerConfig: candidate,
        temperature,
        requestedProvider,
        requestedModel: candidate.model ?? null,
        overrideApplied: true,
        fallbackNote: null,
      };
    }
    return {
      providerConfig: baseConfig ?? null,
      temperature,
      requestedProvider,
      requestedModel,
      overrideApplied: false,
      fallbackNote: `Per-agent provider "${requestedProvider}" has no active API key; fell back to ${baseConfig ? baseConfig.provider : 'KB fallback'}.`,
    };
  }

  return {
    providerConfig: baseConfig ?? null,
    temperature,
    requestedProvider,
    requestedModel,
    overrideApplied: false,
    fallbackNote: null,
  };
}

export interface GenerateAgentModelTextParams {
  workspaceId: string;
  conversationId: string;
  system: string;
  messages: ChatTurn[];
  baseProviderConfig?: ProviderConfig | null;
  modelConfig?: Partial<AgentModelConfig> | null;
  maxTokens?: number;
  countReply?: boolean;
}

export interface GenerateAgentModelTextResult {
  text: string | null;
  provider: ProviderId | null;
  model: string | null;
  note: string | null;
}

/**
 * Generates model output for any agent engine (LangGraph or ADK) honoring
 * per-agent `modelConfig` overrides while respecting workspace/platform billing gates.
 */
export async function generateAgentModelText(
  params: GenerateAgentModelTextParams,
): Promise<GenerateAgentModelTextResult> {
  const maxTokens = params.maxTokens ?? 650;

  if (params.baseProviderConfig) {
    const resolved = resolveEffectiveProviderConfig(params.baseProviderConfig, params.modelConfig);
    if (resolved.providerConfig && isConfigured(resolved.providerConfig)) {
      const res = await chat(resolved.providerConfig, {
        system: params.system,
        messages: params.messages,
        maxTokens,
        temperature: resolved.temperature,
        reasoning: 'fast',
      });
      return {
        text: res.text?.trim() || null,
        provider: res.provider,
        model: res.model,
        note: resolved.fallbackNote,
      };
    }
  }

  const platform = await getPlatformAiConfigServerOnly().catch(() => null);
  const platformCfg = platform?.isEnabled && platform.config ? platform.config : null;
  const resolved = resolveEffectiveProviderConfig(platformCfg, params.modelConfig);

  if (!resolved.providerConfig || !isConfigured(resolved.providerConfig)) {
    return {
      text: null,
      provider: null,
      model: null,
      note: resolved.fallbackNote,
    };
  }

  // Platform gateway requires an explicit apiKey on the active config for plan/usage enforcement.
  if (platform?.isEnabled && resolved.providerConfig.apiKey) {
    const exec = await executePlatformAiReply({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      providerConfig: resolved.providerConfig,
      request: {
        system: params.system,
        messages: params.messages,
        maxTokens,
        temperature: resolved.temperature,
        reasoning: 'fast',
      },
      countReply: params.countReply ?? false,
    }).catch(() => null);

    if (exec?.ok && exec.text) {
      return {
        text: exec.text.trim(),
        provider: resolved.providerConfig.provider,
        model:
          resolved.providerConfig.model || DEFAULT_MODELS[resolved.providerConfig.provider],
        note: resolved.fallbackNote,
      };
    }
    return {
      text: null,
      provider: resolved.providerConfig.provider,
      model: resolved.providerConfig.model ?? null,
      note: exec?.unavailableReason || resolved.fallbackNote,
    };
  }

  // Deployment env-var key (either platform disabled in local/dev or alternate provider override).
  const res = await chat(resolved.providerConfig, {
    system: params.system,
    messages: params.messages,
    maxTokens,
    temperature: resolved.temperature,
    reasoning: 'fast',
  }).catch(() => null);

  return {
    text: res?.text?.trim() || null,
    provider: res?.provider ?? resolved.providerConfig.provider,
    model: res?.model ?? resolved.providerConfig.model ?? null,
    note: resolved.fallbackNote,
  };
}
