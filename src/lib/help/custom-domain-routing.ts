import type { NextRequest } from 'next/server';
import { cleanDomain, isHelpBaseHost, isPlatformHost, parseHelpBaseSubdomain } from '@/lib/domain';
import { serviceClient } from '@/lib/pg/service';

const RESERVED_PREFIXES = [
  '/api',
  '/_next',
  '/help',
  '/dashboard',
  '/admin',
  '/login',
  '/signup',
  '/invite',
  '/onboarding',
  '/widget',
];

const RESERVED_EXACT_PATHS = new Set(['/favicon.ico', '/robots.txt', '/manifest.json']);

const STATIC_ASSET_RE = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|woff2?|ttf|eot)$/i;

interface CacheEntry {
  target: string | null;
  expiresAt: number;
}

const CUSTOM_DOMAIN_CACHE = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 500;
const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 15_000;

export function extractHostname(hostHeader: string | null | undefined): string {
  const raw = (hostHeader || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end === -1 ? raw : raw.slice(0, end + 1);
  }
  return raw.split(':')[0].trim();
}

export function isReservedHelpRewritePath(pathname: string): boolean {
  if (!pathname || RESERVED_EXACT_PATHS.has(pathname) || STATIC_ASSET_RE.test(pathname)) {
    return true;
  }
  return RESERVED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function defaultLookupCustomDomain(cleanHost: string): Promise<string | null> {
  const now = Date.now();
  const cached = CUSTOM_DOMAIN_CACHE.get(cleanHost);
  if (cached && cached.expiresAt > now) {
    return cached.target;
  }

  let target: string | null = null;
  try {
    const supabase = serviceClient();
    const { data, error } = await supabase
      .from('public_workspaces')
      .select('id, slug')
      .ilike('custom_domain', cleanHost)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      target = data.slug || data.id || null;
    }
  } catch {
    // Missing service role key in local/test envs must not break proxy routing.
    return null;
  }

  if (CUSTOM_DOMAIN_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = CUSTOM_DOMAIN_CACHE.keys().next().value;
    if (oldestKey !== undefined) {
      CUSTOM_DOMAIN_CACHE.delete(oldestKey);
    }
  }

  CUSTOM_DOMAIN_CACHE.set(cleanHost, {
    target,
    expiresAt: now + (target ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
  });

  return target;
}

export async function resolveHelpRewritePath(
  hostHeader: string | null | undefined,
  pathname: string,
  lookupCustomDomain: (cleanHost: string) => Promise<string | null> = defaultLookupCustomDomain,
): Promise<string | null> {
  if (isReservedHelpRewritePath(pathname)) {
    return null;
  }

  const host = extractHostname(hostHeader);
  if (!host) {
    return null;
  }

  const sub = parseHelpBaseSubdomain(host);
  if (sub.isSubdomain && sub.slug) {
    return `/help/${encodeURIComponent(sub.slug)}${pathname === '/' ? '' : pathname}`;
  }

  if (isPlatformHost(host) || isHelpBaseHost(host) || !host.includes('.')) {
    return null;
  }

  const cleaned = cleanDomain(host);
  if (!cleaned) {
    return null;
  }

  const target = await lookupCustomDomain(cleaned);
  if (!target) {
    return null;
  }

  return `/help/${encodeURIComponent(target)}${pathname === '/' ? '' : pathname}`;
}

export async function resolveHelpCenterRewriteUrl(request: NextRequest): Promise<URL | null> {
  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const rewrittenPath = await resolveHelpRewritePath(hostHeader, request.nextUrl.pathname);
  if (!rewrittenPath) {
    return null;
  }
  const url = request.nextUrl.clone();
  url.pathname = rewrittenPath;
  return url;
}

export function clearCustomDomainRoutingCacheForTest(): void {
  CUSTOM_DOMAIN_CACHE.clear();
}

