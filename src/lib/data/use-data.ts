'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/errors/user-error';

export interface DataState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** Fetch again (keeps the old data on screen while it loads). */
  reload: () => void;
}

export interface UseDataOptions {
  enabled?: boolean;
  /** Milliseconds before cached data is revalidated in the background. Default: 30_000. */
  staleTimeMs?: number;
}

interface CacheEntry {
  data: unknown;
  updatedAt: number;
}

const DEFAULT_STALE_TIME_MS = 30_000;
const MAX_CACHE_ENTRIES = 200;

const dataCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function readCache<T>(key: string): { data: T; updatedAt: number } | undefined {
  const entry = dataCache.get(key);
  if (!entry) return undefined;
  // Refresh LRU order on read
  dataCache.delete(key);
  dataCache.set(key, entry);
  return entry as { data: T; updatedAt: number };
}

function writeCache(key: string, data: unknown): void {
  if (dataCache.has(key)) {
    dataCache.delete(key);
  } else if (dataCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = dataCache.keys().next().value;
    if (oldest !== undefined) dataCache.delete(oldest);
  }
  dataCache.set(key, { data, updatedAt: Date.now() });
}

/** Clears all cached client-side screen data (e.g. on sign-out). */
export function clearDataCache(): void {
  dataCache.clear();
  inFlightRequests.clear();
}

/** Invalidates cached entries matching a substring or predicate. */
export function invalidateDataCache(match?: string | ((key: string) => boolean)): void {
  if (!match) {
    clearDataCache();
    return;
  }
  const test = typeof match === 'string' ? (k: string) => k.includes(match) : match;
  for (const key of Array.from(dataCache.keys())) {
    if (test(key)) dataCache.delete(key);
  }
}

/* The one loading/error/data pattern every screen uses, with stale-while-revalidate
   caching and in-flight deduplication so switching between workspace screens renders
   instantly from cache while refreshing stale data silently in the background. */
export function useData<T>(
  load: () => Promise<T>,
  key: unknown[],
  { enabled = true, staleTimeMs = DEFAULT_STALE_TIME_MS }: UseDataOptions = {},
): DataState<T> {
  const cacheKey = JSON.stringify(key);
  const initialCached = enabled && staleTimeMs > 0 ? readCache<T>(cacheKey) : undefined;

  const [state, setState] = useState<{
    key: string;
    data: T | undefined;
    error: string | null;
    settledToken: string | null;
  }>(() => ({
    key: cacheKey,
    data: initialCached?.data,
    error: null,
    settledToken: initialCached ? `${cacheKey}:0` : null,
  }));

  const [attempt, setAttempt] = useState(0);
  const lastAttemptRef = useRef(0);
  const token = `${cacheKey}:${attempt}`;

  // Synchronize with cache immediately when `cacheKey` changes during render
  const cachedForKey = enabled && staleTimeMs > 0 ? readCache<T>(cacheKey) : undefined;
  const effectiveData =
    state.key === cacheKey
      ? state.data !== undefined
        ? state.data
        : cachedForKey?.data
      : cachedForKey?.data;

  useEffect(() => {
    if (!enabled) return;

    const isForcedReload = attempt !== lastAttemptRef.current;
    lastAttemptRef.current = attempt;

    const existing = staleTimeMs > 0 ? readCache<T>(cacheKey) : undefined;
    const isFresh =
      !isForcedReload &&
      existing !== undefined &&
      Date.now() - existing.updatedAt < staleTimeMs;

    if (isFresh) {
      setState({
        key: cacheKey,
        data: existing.data,
        error: null,
        settledToken: token,
      });
      return;
    }

    let live = true;

    let promise = !isForcedReload ? (inFlightRequests.get(cacheKey) as Promise<T> | undefined) : undefined;
    if (!promise) {
      promise = Promise.resolve()
        .then(() => load())
        .then((value) => {
          if (staleTimeMs > 0) {
            writeCache(cacheKey, value);
          }
          return value;
        })
        .finally(() => {
          if (inFlightRequests.get(cacheKey) === promise) {
            inFlightRequests.delete(cacheKey);
          }
        });
      inFlightRequests.set(cacheKey, promise);
    }

    promise
      .then((value) => {
        if (!live) return;
        setState({
          key: cacheKey,
          data: value,
          error: null,
          settledToken: token,
        });
      })
      .catch((err) => {
        if (!live) return;
        console.error('[Data Load Error]:', err);
        setState((prev) => ({
          key: cacheKey,
          data: prev.key === cacheKey ? prev.data : existing?.data,
          error: errorMessage(err, 'This could not be loaded.'),
          settledToken: token,
        }));
      });

    return () => {
      live = false;
    };
    // `load` is recreated every render; `token` captures what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, enabled, staleTimeMs]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const hasData = effectiveData !== undefined;
  const isSettled = state.key === cacheKey && state.settledToken === token;

  return {
    data: effectiveData,
    error: isSettled ? state.error : null,
    // If we already have cached data for this key, keep UI responsive while revalidating silently.
    loading: enabled && !hasData && !isSettled,
    reload,
  };
}
