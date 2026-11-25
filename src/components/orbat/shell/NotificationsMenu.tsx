'use client';

import {
  AlertTriangle,
  AtSign,
  Bell,
  BellOff,
  Bot,
  Clock,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, EmptyState, ErrorState, SkeletonRows } from '@/components/orbat/primitives';
import { timeAgo } from '@/components/orbat/overview/format';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationsFeedResult,
} from '@/lib/data/notifications';

async function fetchNotificationsFeed(
  workspaceId: string,
  limit = 25,
): Promise<NotificationsFeedResult> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    limit: String(limit),
  });
  const res = await fetch(`/api/notifications/feed?${params}`, { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error(body?.error || 'Notifications could not be loaded.');
  }
  return body as NotificationsFeedResult;
}
import type { AppNotification, NotificationKind } from '@/lib/data/types';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

type Tab = 'all' | 'mention' | 'handoff' | 'alerts';

const ICON: Record<NotificationKind, typeof Bell> = {
  handoff: MessageSquare,
  mention: AtSign,
  sla_warning: Clock,
  sla_breach: AlertTriangle,
  ai_approval: Bot,
  ai_flagged: ShieldAlert,
  system: Bell,
};

const TONE: Record<NotificationKind, string> = {
  handoff: 'bg-o-accent-soft text-o-accent-text',
  mention: 'bg-o-accent-soft text-o-accent-text',
  sla_warning: 'bg-o-warn-soft text-o-warn',
  sla_breach: 'bg-o-bad-soft text-o-bad',
  ai_approval: 'bg-o-ai-soft text-o-ai-text',
  ai_flagged: 'bg-o-warn-soft text-o-warn',
  system: 'bg-o-surface-2 text-o-text-2',
};

const ALERT_KINDS = new Set<NotificationKind>([
  'sla_warning',
  'sla_breach',
  'ai_approval',
  'ai_flagged',
  'system',
]);

/* docs/design/design/Topbar.dc.html, the bell dropdown. */
export function NotificationsMenu({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshFeed = useCallback(
    async ({ showSkeleton = false }: { showSkeleton?: boolean } = {}) => {
      if (showSkeleton) {
        setError(null);
        setItems(null);
      }
      try {
        const res = await fetchNotificationsFeed(workspaceId, 25);
        if (!mountedRef.current) return;
        setItems(res.items);
        setUnreadCount(res.unreadCount);
        setError(null);
      } catch (err) {
        console.error('[Notifications]:', err);
        if (!mountedRef.current) return;
        if (showSkeleton) {
          setError('Notifications could not be loaded.');
        }
      }
    },
    [workspaceId],
  );

  // Initial load when mounted or workspace changes
  useEffect(() => {
    let live = true;
    fetchNotificationsFeed(workspaceId, 25)
      .then((res) => {
        if (!live) return;
        setItems(res.items);
        setUnreadCount(res.unreadCount);
        setError(null);
      })
      .catch((err) => {
        console.error('[Notifications]:', err);
        if (live) setError('Notifications could not be loaded.');
      });
    return () => {
      live = false;
    };
  }, [workspaceId]);

  // Live socket + visibility-paused 15s polling refresh
  const handleLiveRefresh = useCallback(() => {
    void refreshFeed({ showSkeleton: false });
  }, [refreshFeed]);

  useWorkspaceLive({
    workspaceId,
    enabled: Boolean(workspaceId),
    pollMs: 15_000,
    onRefresh: handleLiveRefresh,
  });

  // Instant refresh when same-tab triggers (e.g. Send Test Alert) emit a refresh event
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRefreshEvent = () => {
      void refreshFeed({ showSkeleton: false });
    };
    window.addEventListener('orbat:notifications-refresh', onRefreshEvent);
    return () => window.removeEventListener('orbat:notifications-refresh', onRefreshEvent);
  }, [refreshFeed]);

  // Refresh silently whenever the dropdown is opened via the bell button.
  const handleToggleOpen = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      void refreshFeed({ showSkeleton: false });
    }
  };

  // Close on outside click and on Escape (focus goes back to the bell).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const shown = (items ?? []).filter((n) => {
    if (tab === 'all') return true;
    if (tab === 'alerts') return ALERT_KINDS.has(n.kind);
    return n.kind === tab;
  });

  const handleSelectNotification = (item: AppNotification) => {
    setOpen(false);
    if (!item.unread) return;
    const nowIso = new Date().toISOString();
    setItems((prev) =>
      prev?.map((n) => (n.id === item.id ? { ...n, unread: false, readAt: n.readAt ?? nowIso } : n)) ?? prev,
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    void markNotificationReadAction(workspaceId, item.id).catch((err) => {
      console.error('[Notifications]:', err);
      void refreshFeed({ showSkeleton: false });
    });
  };

  const readAll = async () => {
    if (unreadCount === 0 || markingAll) return;
    const prevItems = items;
    const prevUnread = unreadCount;
    const nowIso = new Date().toISOString();
    setMarkingAll(true);
    setUnreadCount(0);
    setItems((all) =>
      all?.map((n) => ({ ...n, unread: false, readAt: n.readAt ?? nowIso })) ?? all,
    );
    try {
      await markAllNotificationsReadAction(workspaceId);
    } catch (err) {
      console.error('[Notifications]:', err);
      setItems(prevItems);
      setUnreadCount(prevUnread);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <Button
        ref={buttonRef}
        variant="quiet"
        icon
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={handleToggleOpen}
        className="relative"
      >
        <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            className="o-num absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-o-surface bg-o-bad px-1 text-[10px] font-bold leading-none text-o-on-solid"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="o-popover right-0 top-12 w-[380px] max-w-[calc(100vw-32px)] max-sm:fixed max-sm:left-4 max-sm:right-4 max-sm:top-16 max-sm:w-auto"
        >
          <div className="flex items-center gap-2 border-b border-o-border px-4 py-3">
            <span className="text-[15px] font-semibold">Notifications</span>
            {unreadCount > 0 ? (
              <span className="o-num rounded-full bg-o-bad-soft px-2 py-0.5 text-[11px] font-semibold text-o-bad">
                {unreadCount} unread
              </span>
            ) : null}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => void readAll()}
              disabled={unreadCount === 0 || markingAll}
              className="rounded-lg px-1.5 py-1 text-[13px] font-medium text-o-accent-text hover:underline disabled:text-o-text-3 disabled:no-underline"
            >
              Mark all read
            </button>
          </div>
          <div className="flex flex-wrap gap-1 px-3 pt-2" role="radiogroup" aria-label="Filter notifications">
            {(
              [
                ['all', 'All'],
                ['mention', 'Mentions'],
                ['handoff', 'Handoffs'],
                ['alerts', 'SLA & AI'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'h-8 rounded-full px-3 text-[13px] font-medium',
                  tab === id ? 'bg-o-surface-2 text-o-text' : 'text-o-text-3 hover:text-o-text',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[360px] overflow-auto p-2">
            {error ? (
              <ErrorState
                title="Couldn’t load notifications"
                body={error}
                onRetry={() => void refreshFeed({ showSkeleton: true })}
                className="py-8"
              />
            ) : items === null ? (
              <div className="p-3">
                <SkeletonRows rows={3} label="Loading notifications" />
              </div>
            ) : shown.length === 0 ? (
              <EmptyState
                icon={<BellOff size={22} />}
                title="You’re all caught up"
                body="Handoffs, mentions, AI approvals, and SLA warnings will show up here."
                className="py-8"
              />
            ) : (
              <ul className="flex flex-col">
                {shown.map((n) => {
                  const Icon = ICON[n.kind] ?? Bell;
                  const toneClass = TONE[n.kind] ?? TONE.system;
                  const safeHref = n.href.startsWith('/') && !n.href.startsWith('//') ? n.href : '/app';
                  return (
                    <li key={n.id}>
                      <Link
                        href={safeHref}
                        onClick={() => handleSelectNotification(n)}
                        className={cn(
                          'flex gap-3 rounded-xl p-2.5 text-o-text no-underline hover:bg-o-surface-2',
                          n.unread && 'bg-o-surface-2/40',
                        )}
                      >
                        <span
                          className={cn('grid h-8 w-8 flex-none place-items-center rounded-[10px]', toneClass)}
                          aria-hidden="true"
                        >
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                'truncate text-[13.5px]',
                                n.unread ? 'font-semibold text-o-text' : 'font-medium text-o-text-2',
                              )}
                            >
                              {n.title}
                            </span>
                            <span className="o-num flex-none text-[11px] text-o-text-3">
                              {timeAgo(n.createdAt)}
                            </span>
                          </span>
                          {n.body ? (
                            <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-o-text-3">
                              {n.body}
                            </span>
                          ) : null}
                        </span>
                        {n.unread ? (
                          <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-o-accent-text">
                            <span className="sr-only">Unread</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Link
            href="/app/profile"
            onClick={() => setOpen(false)}
            className="block border-t border-o-border px-4 py-2.5 text-[13px] text-o-text-2 no-underline hover:bg-o-surface-2"
          >
            Notification preferences
          </Link>
        </div>
      ) : null}
    </span>
  );
}
