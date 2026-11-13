"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeSuppressContext = void 0;
exports.shouldSuppressDirectRealtimeEmit = shouldSuppressDirectRealtimeEmit;
exports.trackSuppressContextOutboxId = trackSuppressContextOutboxId;
const node_async_hooks_1 = require("node:async_hooks");
exports.realtimeSuppressContext = new node_async_hooks_1.AsyncLocalStorage();
function shouldSuppressDirectRealtimeEmit() {
    return Boolean(exports.realtimeSuppressContext.getStore()?.suppressDirectEmit);
}
function trackSuppressContextOutboxId(outboxId) {
    if (!outboxId)
        return;
    const store = exports.realtimeSuppressContext.getStore();
    if (store?.recordedOutboxIds) {
        store.recordedOutboxIds.push(outboxId);
    }
}
//# sourceMappingURL=realtime-emit.context.js.map