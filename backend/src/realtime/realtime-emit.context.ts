import { AsyncLocalStorage } from 'node:async_hooks';

export interface RealtimeEmitContextStore {
  suppressDirectEmit: boolean;
  recordedOutboxIds?: string[];
}

/**
 * Prevents duplicate Socket.IO emissions when WebSocket handlers invoke
 * MessagesService, while allowing callers to mark recorded outbox rows published
 * after direct broadcast succeeds.
 */
export const realtimeSuppressContext = new AsyncLocalStorage<RealtimeEmitContextStore>();

export function shouldSuppressDirectRealtimeEmit(): boolean {
  return Boolean(realtimeSuppressContext.getStore()?.suppressDirectEmit);
}

export function trackSuppressContextOutboxId(outboxId: string | null): void {
  if (!outboxId) return;
  const store = realtimeSuppressContext.getStore();
  if (store?.recordedOutboxIds) {
    store.recordedOutboxIds.push(outboxId);
  }
}
