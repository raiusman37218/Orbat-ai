'use client';

import { useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/api/backend-auth';
import { createBackendRealtimeClient } from '@/lib/api/backend-realtime';

export type WorkspaceLiveEvent =
  | 'message:new'
  | 'message:updated'
  | 'message:deleted'
  | 'conversation:created'
  | 'conversation:updated';

export interface UseWorkspaceLiveOptions {
  workspaceId?: string | null;
  conversationId?: string | null;
  enabled?: boolean;
  /** Adaptive polling interval in ms while the tab is visible (0 disables polling). */
  pollMs?: number;
  /** Debounce window in ms when Socket.IO events burst. */
  debounceMs?: number;
  /** Callback triggered when a relevant event, focus return, or poll tick fires. */
  onRefresh: (source: 'socket' | 'poll' | 'visible') => void;
}

/**
 * Connects to NestJS Socket.IO `/realtime` when an auth token is available and
 * pairs it with a visibility-paused polling + focus-sync fallback so live views
 * remain synchronized in both split NestJS+Next and standalone PostgreSQL deployments.
 */
export function useWorkspaceLive({
  workspaceId,
  conversationId,
  enabled = true,
  pollMs = 4000,
  debounceMs = 250,
  onRefresh,
}: UseWorkspaceLiveOptions): void {
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;

    let disposed = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const triggerSoon = (source: 'socket' | 'poll' | 'visible') => {
      if (disposed) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!disposed) refreshRef.current(source);
      }, source === 'poll' ? 0 : debounceMs);
    };

    const token = getAuthToken();
    const realtime = token
      ? createBackendRealtimeClient(
          {
            onConnect: () => {
              if (conversationId) realtime?.joinConversation(conversationId);
            },
            onMessageNew: () => triggerSoon('socket'),
            onMessageUpdated: () => triggerSoon('socket'),
            onMessageDeleted: () => triggerSoon('socket'),
            onConversationCreated: () => triggerSoon('socket'),
            onConversationUpdated: () => triggerSoon('socket'),
          },
          token,
        )
      : null;

    if (realtime && conversationId) {
      realtime.joinConversation(conversationId);
    }

    const startPolling = () => {
      if (pollTimer || pollMs <= 0) return;
      pollTimer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        refreshRef.current('poll');
      }, pollMs);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      startPolling();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
        triggerSoon('visible');
      } else {
        stopPolling();
      }
    };

    const onFocus = () => triggerSoon('visible');

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }

    return () => {
      disposed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      stopPolling();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
      if (realtime) {
        if (conversationId) realtime.leaveConversation(conversationId);
        realtime.disconnect();
      }
    };
  }, [workspaceId, conversationId, enabled, pollMs, debounceMs]);
}
