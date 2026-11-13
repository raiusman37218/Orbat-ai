import { isSafeWebhookUrl } from '@/lib/automation/rules';

export interface UrlValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Synchronous guard for OpenAI-compatible AI provider base URLs.
 * Blocks private/internal networks by default; allows localhost HTTP only when
 * `ALLOW_LOCAL_LLM_URLS=true` for self-hosted Ollama / vLLM instances.
 */
export function validateProviderBaseUrl(rawUrl: string): UrlValidationResult {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Base URL is required for compatible providers.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Invalid provider base URL.' };
  }

  const allowLocal = process.env.ALLOW_LOCAL_LLM_URLS === 'true';
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    allowLocal &&
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    (host === 'localhost' || host === '127.0.0.1' || host === '::1')
  ) {
    return { ok: true };
  }

  if (!isSafeWebhookUrl(trimmed)) {
    return {
      ok: false,
      error: 'Custom provider base_url must use a public https:// endpoint.',
    };
  }

  return { ok: true };
}
