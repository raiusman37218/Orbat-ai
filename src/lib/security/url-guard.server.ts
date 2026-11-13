import { lookup } from 'node:dns/promises';
import { isPrivateAddress, isSafeWebhookUrl } from '@/lib/automation/rules';
import type { UrlValidationResult } from './url-guard';

/**
 * Server-only SSRF guard: verifies a URL is public `https://` without
 * credentials, loopback, or private IP literals, and resolves DNS to reject
 * private/internal targets (DNS-rebinding mitigation).
 */
export async function resolveAndVerifyPublicHttpsUrl(
  rawUrl: string
): Promise<UrlValidationResult> {
  const url = String(rawUrl ?? '').trim();
  if (!isSafeWebhookUrl(url)) {
    return {
      ok: false,
      error: 'The URL must be a public https:// address (not localhost or a private network).',
    };
  }

  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
      return { ok: false, error: 'The URL resolves to a private or internal network.' };
    }
  } catch {
    return { ok: false, error: 'The URL hostname could not be resolved.' };
  }

  return { ok: true };
}

