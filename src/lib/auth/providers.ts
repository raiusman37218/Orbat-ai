'use client';

import { useEffect, useState } from 'react';

export type SocialProvider = 'google';

let cache: Promise<Record<string, boolean>> | null = null;

/**
 * Fetches enabled authentication providers from the Next.js API route so the
 * login and signup UI only renders Google OAuth when configured.
 */
function fetchProviders(): Promise<Record<string, boolean>> {
  if (!cache) {
    cache = fetch('/api/auth/providers', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json): Record<string, boolean> => {
        if (!json || typeof json !== 'object') return {};
        return { google: Boolean(json.google), email: json.email !== false };
      })
      .catch((): Record<string, boolean> => ({}));
  }
  return cache;
}

export async function isProviderEnabled(provider: SocialProvider): Promise<boolean> {
  const external = await fetchProviders();
  return external[provider] === true;
}

/**
 * Returns `undefined` while loading so callers avoid flashing a button.
 */
export function useProviderEnabled(provider: SocialProvider): boolean | undefined {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetchProviders().then((external) => {
      if (active) setEnabled(external[provider] === true);
    });
    return () => {
      active = false;
    };
  }, [provider]);

  return enabled;
}
