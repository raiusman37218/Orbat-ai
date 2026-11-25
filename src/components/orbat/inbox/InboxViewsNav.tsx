'use client';

/**
 * Left Inbox views rail (`212px` on `xl:` desktops) matching `Inbox.dc.html`:
 * conversation views with live counts, clickable workspace team groups, and
 * persisted saved conversation filters.
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
  Plus,
  ShieldAlert,
  Trash2,
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
  { key: 'waiting_approval', label: 'Pending approval', shortLabel: 'Approval' },
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
    case 'waiting_approval':
      return <ShieldAlert className={cls} aria-hidden="true" />;
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
  selectedGroupId,
  onSelectGroup,
  groupCounts,
  savedFilters,
  activeSavedFilterId,
  onApplySavedFilter,
  onOpenSaveFilter,
  onDeleteSavedFilter,
  metaLoading,
  metaError,
  onRetryMeta,
}: {
  activeView: InboxViewKey;
  onSelectView: (view: InboxViewKey) => void;
  counts: Record<InboxViewKey, number>;
  teamGroups: InboxTeamGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  groupCounts: Record<string, number>;
  savedFilters: InboxSavedFilter[];
  activeSavedFilterId: string | null;
  onApplySavedFilter: (filter: InboxSavedFilter) => void;
  onOpenSaveFilter: () => void;
  onDeleteSavedFilter: (viewId: string) => Promise<void>;
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
          {selectedGroupId ? (
            <button
              type="button"
              onClick={() => onSelectGroup(null)}
              className="o-focus rounded text-[11px] font-medium text-o-accent-text hover:underline"
            >
              All teams
            </button>
          ) : (
            <Link
              href="/app/tickets"
              className="o-focus rounded text-[11px] font-medium text-o-accent-text hover:underline"
            >
              Manage
            </Link>
          )}
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
            No team groups configured yet. Create groups in Tickets or Team settings.
          </p>
        ) : (
          <div className="space-y-0.5">
            {teamGroups.map((g) => {
              const active = selectedGroupId === g.id;
              const openCount = groupCounts[g.id] ?? 0;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelectGroup(active ? null : g.id)}
                  aria-pressed={active}
                  title={`${g.name} (${g.memberIds.length} member${g.memberIds.length === 1 ? '' : 's'})`}
                  className={cn(
                    'o-focus flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors',
                    active
                      ? 'bg-o-accent-soft font-semibold text-o-accent-text'
                      : 'text-o-text-2 hover:bg-o-surface-2 hover:text-o-text',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-2 w-2 flex-none rounded-full',
                        active ? 'bg-o-accent-text' : 'bg-o-border-2',
                      )}
                    />
                    <span className="truncate">{g.name}</span>
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                      active
                        ? 'bg-o-surface/70 text-o-accent-text'
                        : 'text-o-text-3',
                    )}
                  >
                    {openCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-o-border pt-4">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
            Saved views
          </span>
          <button
            type="button"
            onClick={onOpenSaveFilter}
            className="o-focus inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-o-accent-text hover:bg-o-accent-soft"
            title="Save active view and filters"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Save
          </button>
        </div>
        {savedFilters.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-o-border bg-o-surface-2 px-2.5 py-2.5 text-[11.5px] leading-relaxed text-o-text-3">
            <div className="flex items-center gap-1.5 font-semibold text-o-text-2">
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              No saved views
            </div>
            <p className="mt-1">
              Click <span className="font-medium text-o-text-2">+ Save</span> to bookmark a channel, team inbox, or search filter.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {savedFilters.map((f) => {
              const active = activeSavedFilterId === f.id;
              return (
                <li
                  key={f.id}
                  className={cn(
                    'group flex items-center justify-between gap-1 rounded-[10px] px-1.5 py-1 transition-colors',
                    active
                      ? 'bg-o-accent-soft text-o-accent-text'
                      : 'text-o-text-2 hover:bg-o-surface-2 hover:text-o-text',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onApplySavedFilter(f)}
                    className={cn(
                      'o-focus flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left text-[12.5px]',
                      active ? 'font-semibold' : '',
                    )}
                  >
                    <Bookmark className="h-3.5 w-3.5 flex-none opacity-80" aria-hidden="true" />
                    <span className="truncate">{f.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteSavedFilter(f.id)}
                    aria-label={`Delete saved view ${f.name}`}
                    title="Delete saved view"
                    className="o-focus rounded p-1 text-o-text-3 opacity-0 transition-opacity hover:text-o-bad group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
