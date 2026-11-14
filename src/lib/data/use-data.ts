'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/lib/errors/user-error';

export interface DataState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** Fetch again (keeps the old data on screen while it loads). */
  reload: () => void;
}

/* The one loading/error/data pattern every screen uses, so each screen's
   loading, empty and error states behave the same. `key` changes refetch
   (e.g. a date range); `enabled: false` skips the call entirely. */
export function useData<T>(
  load: () => Promise<T>,
  key: unknown[],
  { enabled = true }: { enabled?: boolean } = {},
): DataState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const token = JSON.stringify([...key, attempt]);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    load()
      .then((value) => {
        if (!live) return;
        setData(value);
        setError(null);
        setSettled(token);
      })
      .catch((err) => {
        if (!live) return;
        console.error('[Data Load Error]:', err);
        setError(errorMessage(err, 'This could not be loaded.'));
        setSettled(token);
      });
    return () => {
      live = false;
    };
    // `load` is recreated every render; `token` captures what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, enabled]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, error: settled === token ? error : null, loading: enabled && settled !== token, reload };
}
