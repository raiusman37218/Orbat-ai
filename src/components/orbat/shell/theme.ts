'use client';

import { useCallback, useSyncExternalStore } from 'react';

/* The theme lives on <html data-theme> and in localStorage under the same key
   the old ThemeToggle uses ('orbat-theme'), and the root layout applies it
   before first paint. Reading it through a MutationObserver keeps this button
   in step with the old toggle and with other tabs. */

const STORAGE_KEY = 'orbat-theme';
type Resolved = 'light' | 'dark';

function read(): Resolved {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    const next = e.newValue === 'dark' || e.newValue === 'light' ? e.newValue : null;
    if (next) document.documentElement.setAttribute('data-theme', next);
  };
  window.addEventListener('storage', onStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener('storage', onStorage);
  };
}

export function useTheme(): { theme: Resolved; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, read, () => 'light' as Resolved);
  const toggle = useCallback(() => {
    const next: Resolved = read() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  }, []);
  return { theme, toggle };
}
