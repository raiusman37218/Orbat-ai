import * as dns from 'node:dns';
import * as net from 'node:net';

export function isPrivateIpAddress(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map((part) => Number(part));
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (net.isIPv6(normalized)) {
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('::ffff:')) {
      return isPrivateIpAddress(normalized.slice(7));
    }
    if (/^(fc|fd)/i.test(normalized) || /^fe[89ab]/i.test(normalized)) {
      return true;
    }
    return false;
  }

  return true;
}

export async function resolveAndVerifyPublicHttpsUrl(
  rawUrl: string,
  options: { allowHttpInDev?: boolean } = {},
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const allowedProtocols = options.allowHttpInDev && isDev ? ['https:', 'http:'] : ['https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error(`Disallowed protocol: ${parsed.protocol}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Blocked internal or local hostname');
  }

  if (net.isIP(host)) {
    if (isPrivateIpAddress(host)) {
      throw new Error('Blocked private IP address');
    }
    return parsed;
  }

  const resolved = await dns.promises.lookup(host, { all: true, verbatim: true });
  if (!resolved.length) {
    throw new Error('DNS resolution returned no addresses');
  }
  for (const record of resolved) {
    if (isPrivateIpAddress(record.address)) {
      throw new Error('Resolved address points to a private or reserved network');
    }
  }

  return parsed;
}

export async function validateProviderBaseUrl(rawBaseUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new Error('Invalid AI provider base URL');
  }

  if (parsed.username || parsed.password) {
    throw new Error('AI provider base URL must not contain embedded credentials');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Invalid AI provider protocol: ${parsed.protocol}`);
  }

  const allowLocal = process.env.ALLOW_LOCAL_LLM_URLS === 'true';
  if (!allowLocal) {
    await resolveAndVerifyPublicHttpsUrl(rawBaseUrl, { allowHttpInDev: false });
  }

  return parsed.toString().replace(/\/+$/, '');
}

