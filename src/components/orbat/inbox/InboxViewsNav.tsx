'use client';

/**
 * Left Inbox views rail (`212px` on `xl:` desktops) matching `Inbox.dc.html`:
 * conversation views with live counts, workspace team groups (read-only until
 * `conversations.group_id` exists), and saved filters honest unavailable state.
 */

import Link from 'next/link';
import {
  AlertCircle,
  Bookmark,
  Bot,
  CheckCircle2,
  Clock,
  Inbox as InboxIcon,
  Layers,
  UserCheck,
  Users,
} from 'lucide-react';
import { ErrorState, SkeletonRows } from '@/components/orbat/primitives';
import { cn } from '@/lib/utils';
import type {
  InboxSavedFilter,
  InboxTeamGroup,
  InboxViewKey,
} from '@/lib/data/inbox';

export interface InboxViewDefinition {
  key: InboxViewKey;
  label: string;
  shortLabel: string;
}

export const INBOX_VIEWS: InboxViewDefinition[] = [
  { key: 'open', label: 'Open', shortLabel: 'Open' },
  { key: 'mine', label: 'Assigned to me', shortLabel: 'Mine' },
  { key: 'unassigned', label: 'Unassigned', shortLabel: 'Unassigned' },
  { key: 'waiting', label: 'Handovers', shortLabel: 'Handover' },
  { key: 'ai', label: 'AI handling', shortLabel: 'AI' },
  { key: 'snoozed', label: 'Snoozed', shortLabel: 'Snoozed' },
  { key: 'resolved', label: 'Resolved', shortLabel: 'Resolved' },
  { key: 'all', label: 'All threads', shortLabel: 'All' },
];

function ViewIcon({ view }: { view: InboxViewKey }) {
  const cls = 'h-4 w-4 flex-none';
  switch (view) {
    case 'open':
      return <InboxIcon className={cls} aria-hidden="true" />;
    case 'mine':
      return <UserCheck className={cls} aria-hidden="true" />;
    case 'unassigned':
      return <Users className={cls} aria-hidden="true" />;
    case 'waiting':
      return <AlertCircle className={cls} aria-hidden="true" />;
    case 'ai':
      return <Bot className={cls} aria-hidden="true" />;
    case 'snoozed':
      return <Clock className={cls} aria-hidden="true" />;
    case 'resolved':
      return <CheckCircle2 className={cls} aria-hidden="true" />;
    case 'all':
    default:
      return <Layers className={cls} aria-hidden="true" />;
  }
}

export function InboxViewsNav({
  activeView,
  onSelectView,
  counts,
  teamGroups,
  savedFilters,
  metaLoading,
  metaError,
  onRetryMeta,
}: {
  activeView: InboxViewKey;
  onSelectView: (view: InboxViewKey) => void;
  counts: Record<InboxViewKey, number>;
  teamGroups: InboxTeamGroup[];
  savedFilters: InboxSavedFilter[];
  metaLoading: boolean;
  metaError: string | null;
  onRetryMeta: () => void;
}) {
  return (
    <nav
      aria-label="Inbox views"
      className="hidden h-full w-[212px] flex-none flex-col overflow-y-auto border-r border-o-border bg-o-surface p-3 xl:flex"
    >
      <div>
        <div className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
          Views
        </div>
        <ul className="space-y-0.5">
          {INBOX_VIEWS.map((view) => {
            const active = activeView === view.key;
            const count = counts[view.key] ?? 0;
            return (
              <li key={view.key}>
                <button
                  type="button"
                  onClick={() => onSelectView(view.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'o-focus flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] transition-colors',
                    active
                      ? 'bg-o-accent-soft font-semibold text-o-accent-text'
                      : 'font-medium text-o-text-2 hover:bg-o-surface-2 hover:text-o-text',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ViewIcon view={view.key} />
                    <span className="truncate">{view.label}</span>
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                      active
                        ? 'bg-o-surface text-o-accent-text'
                        : 'text-o-text-3',
                    )}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5 border-t border-o-border pt-4">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
            Team inboxes
          </span>
          <Link
            href="/app/tickets"
            className="o-focus rounded text-[11px] font-medium text-o-accent-text hover:underline"
          >
            Tickets
          </Link>
        </div>

        {metaLoading ? (
          <div className="px-2 py-2">
            <SkeletonRows rows={2} label="Loading team groups" />
          </div>
        ) : metaError ? (
          <ErrorState
            title="Teams unavailable"
            body={metaError}
            onRetry={onRetryMeta}
            className="p-3"
          />
        ) : teamGroups.length === 0 ? (
          <p className="px-2 py-1.5 text-[12px] leading-relaxed text-o-text-3">
            No team groups configured yet. Manage routing groups in Tickets or Team settings.
          </p>
        ) : (
          <div className="space-y-1">
            {teamGroups.map((g) => (
              <div
                key={g.id}
                title="Team groups filter tickets only; conversations do not yet carry a group assignment."
                className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] text-o-text-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 flex-none rounded-full bg-o-border-2"
                  />
                  <span className="truncate">{g.name}</span>
                </span>
                <span className="text-[11px] tabular-nums text-o-text-3">
                  {g.memberIds.length}
                </span>
              </div>
            ))}
            <p className="px-2 pt-1 text-[11px] leading-snug text-o-text-3">
              Group queue filtering is available on{' '}
              <Link href="/app/tickets" className="text-o-accent-text underline">
                Tickets
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-o-border pt-4">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
            Saved filters
          </span>
        </div>
        {savedFilters.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-o-border bg-o-surface-2 px-2.5 py-2.5 text-[11.5px] leading-relaxed text-o-text-3">
            <div className="flex items-center gap-1.5 font-semibold text-o-text-2">
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              Not supported yet
            </div>
            <p className="mt-1">
              Saved views exist on{' '}
              <Link href="/app/tickets" className="text-o-accent-text underline">
                Tickets
              </Link>
              ; conversation filters are local to this session.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {savedFilters.map((f) => (
              <li key={f.id} className="px-2.5 py-1.5 text-[12.5px] text-o-text-2">
                {f.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
