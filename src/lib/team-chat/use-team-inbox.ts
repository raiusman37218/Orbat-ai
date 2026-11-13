'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTeamInboxAction } from '@/app/actions/team-chat';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';
import type { TeamInboxRow, TeamMessage } from '@/types/database';

/**
 * The signed-in member's team-chat threads (fn_team_inbox) kept live via
 * Server Actions + Socket.IO / visibility-aware adaptive polling.
 */
export function useTeamInbox(
  workspaceId: string | null | undefined,
  onMessage?: (message: TeamMessage, threads: TeamInboxRow[]) => void,
) {
  const [threads, setThreads] = useState<TeamInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const threadsRef = useRef<TeamInboxRow[]>([]);
  const lastPollIsoRef = useRef<string | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    lastPollIsoRef.current = null;
  }, [workspaceId]);

  const reload = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const since = lastPollIsoRef.current;
      const res = await getTeamInboxAction(workspaceId, since);
      setLoading(false);
      if (!res.available) {
        setAvailable(false);
        return;
      }
      setError(null);
      setAvailable(true);
      threadsRef.current = res.threads;
      setThreads(res.threads);
      lastPollIsoRef.current = new Date().toISOString();
      if (since && res.recentMessages.length > 0) {
        for (const msg of res.recentMessages) {
          onMessageRef.current?.(msg, res.threads);
        }
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Could not load team chat.');
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const first = setTimeout(() => void reload(), 0);
    return () => clearTimeout(first);
  }, [workspaceId, reload]);

  useWorkspaceLive({
    workspaceId,
    enabled: Boolean(workspaceId),
    pollMs: 4000,
    debounceMs: 250,
    onRefresh: () => void reload(),
  });

  const totals = useMemo(() => {
    let unread = 0;
    let urgent = false;
    for (const t of threads) {
      unread += t.unread;
      if (t.unread && (t.kind === 'direct' || t.mentions_me)) urgent = true;
    }
    return { unread, urgent };
  }, [threads]);

  /** Clears a thread's count at once, before the server confirms. */
  const markReadLocally = useCallback((threadId: string) => {
    setThreads((prev) => {
      const next = prev.map((t) =>
        t.thread_id === threadId ? { ...t, unread: 0, mentions_me: 0 } : t,
      );
      threadsRef.current = next;
      return next;
    });
  }, []);

  return { threads, loading, error, available, reload, markReadLocally, ...totals };
}
