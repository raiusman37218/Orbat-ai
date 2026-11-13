import { AsyncLocalStorage } from 'node:async_hooks';
export interface RealtimeEmitContextStore {
    suppressDirectEmit: boolean;
    recordedOutboxIds?: string[];
}
export declare const realtimeSuppressContext: AsyncLocalStorage<RealtimeEmitContextStore>;
export declare function shouldSuppressDirectRealtimeEmit(): boolean;
export declare function trackSuppressContextOutboxId(outboxId: string | null): void;
