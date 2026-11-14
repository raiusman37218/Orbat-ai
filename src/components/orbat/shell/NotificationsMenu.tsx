'use client';

import { Bell, BellOff, Bot, MessageSquare, Ticket, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, EmptyState, ErrorState, SkeletonRows } from '@/components/orbat/primitives';
import { listNotifications, markAllNotificationsRead } from '@/lib/data/notifications';
import type { AppNotification, NotificationKind } from '@/lib/data/types';

type Tab = 'all' | 'mention' | 'handoff';

const ICON: Record<NotificationKind, typeof Bell> = {
  handoff: MessageSquare,
  sla: Ticket,
  mention: User,
  ai: Bot,
};

const TONE: Record<NotificationKind, string> = {
  handoff: 'bg-o-accent-soft text-o-accent-text',
  mention: 'bg-o-accent-soft text-o-accent-text',
  sla: 'bg-o-warn-soft text-o-warn',
  ai: 'bg-o-ai-soft text-o-ai-text',
};

/* docs/design/design/Topbar.dc.html, the bell dropdown. */
export function NotificationsMenu({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    listNotifications(workspaceId)
      .then((list) => {
        if (live) setItems(list);
      })
      .catch((err) => {
        console.error('[Notifications]:', err);
        if (live) setError('Notifications could not be loaded.');
      });
    return () => {
      live = false;
    };
  }, [workspaceId, attempt]);

  const load = () => {
    setError(null);
    setItems(null);
    setAttempt((n) => n + 1);
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

  const unread = items?.filter((n) => n.unread).length ?? 0;
  const shown = (items ?? []).filter((n) => tab === 'all' || n.kind === tab);

  const readAll = async () => {
    setItems((all) => all?.map((n) => ({ ...n, unread: false })) ?? all);
    await markAllNotificationsRead(workspaceId).catch((err) => console.error('[Notifications]:', err));
  };

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <Button
        ref={buttonRef}
        variant="quiet"
        icon
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
        {unread > 0 ? (
          <span
            className="absolute right-2 top-[7px] h-2 w-2 rounded-full border-2 border-o-surface bg-o-bad"
            aria-hidden="true"
          />
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
            <span className="flex-1 text-[15px] font-semibold">Notifications</span>
            <button
              type="button"
              onClick={readAll}
              disabled={unread === 0}
              className="rounded-lg px-1.5 py-1 text-[13px] font-medium text-o-accent-text hover:underline disabled:text-o-text-3 disabled:no-underline"
            >
              Mark all read
            </button>
          </div>
          <div className="flex gap-1 px-3 pt-2" role="radiogroup" aria-label="Filter notifications">
            {(
              [
                ['all', 'All'],
                ['mention', 'Mentions'],
                ['handoff', 'Handoffs'],
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
              <ErrorState title="Couldn’t load notifications" body={error} onRetry={load} className="py-8" />
            ) : items === null ? (
              <div className="p-3">
                <SkeletonRows rows={3} label="Loading notifications" />
              </div>
            ) : shown.length === 0 ? (
              <EmptyState
                icon={<BellOff size={22} />}
                title="You’re all caught up"
                body="Handoffs, mentions and SLA warnings will show up here."
                className="py-8"
              />
            ) : (
              <ul className="flex flex-col">
                {shown.map((n) => {
                  const Icon = ICON[n.kind];
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        onClick={() => setOpen(false)}
                        className="flex gap-3 rounded-xl p-2.5 text-o-text no-underline hover:bg-o-surface-2"
                      >
                        <span
                          className={cn('grid h-8 w-8 flex-none place-items-center rounded-[10px]', TONE[n.kind])}
                          aria-hidden="true"
                        >
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block text-[13.5px]', n.unread ? 'font-semibold' : 'font-medium')}>
                            {n.title}
                          </span>
                          <span className="block text-[12.5px] text-o-text-3">{n.body}</span>
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
