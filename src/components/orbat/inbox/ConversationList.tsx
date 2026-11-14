'use client';

/**
 * Searchable, filterable, sortable, bulk-selectable conversation list column.
 * Renders as `340px` pane on `lg:` desktops and full width on mobile (`<lg`).
 */

import { useState, type RefObject } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckSquare,
  RefreshCw,
  Search,
  Square,
  Ticket,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  SkeletonRows,
  type BadgeTone,
} from '@/components/orbat/primitives';
import { timeAgo } from '@/components/orbat/overview/format';
import { cn } from '@/lib/utils';
import type {
  InboxChannelFilter,
  InboxConversationItem,
  InboxPriorityFilter,
  InboxSortKey,
  InboxViewKey,
} from '@/lib/data/inbox';
import { INBOX_VIEWS } from './InboxViewsNav';

const CHANNEL_OPTIONS: Array<{ value: InboxChannelFilter; label: string }> = [
  { value: 'all', label: 'All channels' },
  { value: 'web', label: 'Web chat' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Messenger' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'threads', label: 'Threads' },
];

const PRIORITY_OPTIONS: Array<{ value: InboxPriorityFilter; label: string }> = [
  { value: 'all', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

const SORT_OPTIONS: Array<{ value: InboxSortKey; label: string }> = [
  { value: 'newest', label: 'Newest activity' },
  { value: 'waiting', label: 'Needs reply' },
  { value: 'unread', label: 'Unread first' },
  { value: 'priority', label: 'Highest priority' },
];

function priorityTone(p: InboxConversationItem['priority']): BadgeTone {
  switch (p) {
    case 'urgent':
      return 'bad';
    case 'high':
      return 'warn';
    case 'low':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function ConversationList({
  conversations,
  totalLoaded,
  selectedId,
  onSelect,
  activeView,
  onSelectView,
  viewCounts,
  search,
  onSearchChange,
  searchInputRef,
  channelFilter,
  onChannelFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  sortBy,
  onSortByChange,
  loading,
  refreshing,
  error,
  onRetry,
  onRefresh,
  hasMore,
  loadingMore,
  onLoadMore,
  bulkBusy,
  onBulkResolve,
  onBulkOpenAssign,
  onBulkMarkSpam,
}: {
  conversations: InboxConversationItem[];
  totalLoaded: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeView: InboxViewKey;
  onSelectView: (view: InboxViewKey) => void;
  viewCounts: Record<InboxViewKey, number>;
  search: string;
  onSearchChange: (val: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  channelFilter: InboxChannelFilter;
  onChannelFilterChange: (val: InboxChannelFilter) => void;
  priorityFilter: InboxPriorityFilter;
  onPriorityFilterChange: (val: InboxPriorityFilter) => void;
  sortBy: InboxSortKey;
  onSortByChange: (val: InboxSortKey) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  bulkBusy: boolean;
  onBulkResolve: (ids: string[]) => Promise<void>;
  onBulkOpenAssign: (ids: string[]) => void;
  onBulkMarkSpam: (ids: string[]) => Promise<void>;
}) {
  const [bulkMode, setBulkMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const visibleIds = new Set(conversations.map((c) => c.id));
  const selectedBulk = checkedIds.filter((id) => visibleIds.has(id));
  const allVisibleChecked =
    conversations.length > 0 && selectedBulk.length === conversations.length;

  const toggleBulkMode = () => {
    setBulkMode((prev) => {
      if (prev) setCheckedIds([]);
      return !prev;
    });
  };

  const toggleRowCheck = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAllVisible = () => {
    if (allVisibleChecked) {
      setCheckedIds([]);
    } else {
      setCheckedIds(conversations.map((c) => c.id));
    }
  };

  const activeViewLabel =
    INBOX_VIEWS.find((v) => v.key === activeView)?.label || 'Inbox';
  const hasFilters =
    Boolean(search.trim()) || channelFilter !== 'all' || priorityFilter !== 'all';

  return (
    <section
      aria-label="Conversations"
      className="flex h-full w-full flex-none flex-col border-r border-o-border bg-o-surface lg:w-[332px] xl:w-[344px]"
    >
      {/* Header */}
      <div className="flex flex-col gap-2.5 border-b border-o-border p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate font-display text-[17px] font-bold tracking-[-0.02em] text-o-text">
              {activeViewLabel}
            </h1>
            <Badge tone="neutral">{conversations.length}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="quiet"
              size="sm"
              icon
              onClick={toggleBulkMode}
              aria-pressed={bulkMode}
              aria-label={bulkMode ? 'Exit bulk selection' : 'Select multiple conversations'}
              title={bulkMode ? 'Exit bulk selection' : 'Bulk select'}
            >
              {bulkMode ? (
                <CheckSquare className="h-4 w-4 text-o-accent-text" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="quiet"
              size="sm"
              icon
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh conversations"
              title="Refresh conversations"
            >
              <RefreshCw
                className={cn('h-4 w-4', refreshing && 'animate-spin')}
              />
            </Button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-o-text-3"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, email, tag, message…"
            aria-label="Search conversations"
            className="o-input o-input--sm w-full pl-9 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="o-focus absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-o-text-3 hover:text-o-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick view pills shown below xl (mobile + lg without 212px Views rail) */}
        <div
          role="tablist"
          aria-label="Conversation views"
          className="o-no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5 xl:hidden"
        >
          {INBOX_VIEWS.map((view) => {
            const active = activeView === view.key;
            const count = viewCounts[view.key] ?? 0;
            return (
              <button
                key={view.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectView(view.key)}
                className={cn(
                  'o-focus inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
                  active
                    ? 'border-o-accent-text/25 bg-o-accent-soft font-semibold text-o-accent-text'
                    : 'border-o-border bg-o-surface-2 text-o-text-2 hover:text-o-text',
                )}
              >
                <span>{view.shortLabel}</span>
                <span className="text-[11px] tabular-nums opacity-80">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Filter & Sort row */}
        <div className="grid grid-cols-3 gap-1.5">
          <select
            aria-label="Filter by channel"
            value={channelFilter}
            onChange={(e) =>
              onChannelFilterChange(e.target.value as InboxChannelFilter)
            }
            className="o-input o-select o-input--sm min-w-0 text-[12px]"
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) =>
              onPriorityFilterChange(e.target.value as InboxPriorityFilter)
            }
            className="o-input o-select o-input--sm min-w-0 text-[12px]"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort conversations"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as InboxSortKey)}
            className="o-input o-select o-input--sm min-w-0 text-[12px]"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk action bar */}
        {bulkMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-o-border bg-o-surface-2 px-2.5 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-o-text">
              <input
                type="checkbox"
                checked={allVisibleChecked}
                onChange={toggleAllVisible}
                className="h-4 w-4 rounded accent-o-accent-text"
              />
              <span>
                {selectedBulk.length > 0
                  ? `${selectedBulk.length} selected`
                  : 'Select all'}
              </span>
            </label>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                disabled={selectedBulk.length === 0 || bulkBusy}
                onClick={async () => {
                  await onBulkResolve(selectedBulk);
                  setCheckedIds([]);
                }}
                leading={<Check className="h-3.5 w-3.5" />}
              >
                Resolve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={selectedBulk.length === 0 || bulkBusy}
                onClick={() => onBulkOpenAssign(selectedBulk)}
                leading={<UserPlus className="h-3.5 w-3.5" />}
              >
                Assign
              </Button>
              <Button
                size="sm"
                variant="quiet"
                icon
                disabled={selectedBulk.length === 0 || bulkBusy}
                onClick={async () => {
                  await onBulkMarkSpam(selectedBulk);
                  setCheckedIds([]);
                }}
                aria-label="Mark selected as spam"
                title="Mark selected as spam"
              >
                <Trash2 className="h-3.5 w-3.5 text-o-bad" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable conversation rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && totalLoaded === 0 ? (
          <div className="p-3.5">
            <SkeletonRows rows={6} label="Loading conversations" />
          </div>
        ) : error && totalLoaded === 0 ? (
          <div className="p-3.5">
            <ErrorState
              title="Couldn't load conversations"
              body={error}
              onRetry={onRetry}
            />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-3.5">
            <EmptyState
              title={hasFilters ? 'No matching conversations' : `No ${activeViewLabel.toLowerCase()} conversations`}
              body={
                hasFilters
                  ? 'Try clearing your search or changing channel and priority filters.'
                  : 'New customer messages from your connected channels will appear here.'
              }
              action={
                hasFilters ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onSearchChange('');
                      onChannelFilterChange('all');
                      onPriorityFilterChange('all');
                    }}
                  >
                    Clear filters
                  </Button>
                ) : totalLoaded > 0 && activeView !== 'all' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onSelectView('all')}
                  >
                    View all threads
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div role="listbox" aria-label="Conversation threads" className="divide-y divide-o-border">
            {conversations.map((item) => {
              const selected = item.id === selectedId;
              const checked = selectedBulk.includes(item.id);
              const showPriority = item.priority === 'urgent' || item.priority === 'high';
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    'group relative flex items-start gap-2.5 px-3.5 py-3 transition-colors',
                    selected
                      ? 'bg-o-accent-soft'
                      : 'hover:bg-o-surface-2',
                  )}
                >
                  {bulkMode && (
                    <div className="pt-1.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        aria-label={`Select conversation with ${item.visitorName}`}
                        onChange={() => toggleRowCheck(item.id)}
                        className="h-4 w-4 rounded accent-o-accent-text"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="o-focus flex min-w-0 flex-1 items-start gap-3 rounded-[10px] text-left"
                  >
                    <Avatar
                      name={item.visitorName}
                      size={36}
                      presence={item.visitorOnline ? 'online' : undefined}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {item.unreadCount > 0 && (
                            <span
                              className="o-inbox-unread-dot"
                              aria-label={`${item.unreadCount} unread`}
                            />
                          )}
                          <span
                            className={cn(
                              'truncate text-[13.5px] text-o-text',
                              item.unreadCount > 0 || selected
                                ? 'font-semibold'
                                : 'font-medium',
                            )}
                          >
                            {item.visitorName}
                          </span>
                        </span>
                        <span className="flex-none text-[11px] tabular-nums text-o-text-3">
                          {timeAgo(item.lastActivityAt)}
                        </span>
                      </div>

                      <p
                        className={cn(
                          'mt-0.5 line-clamp-2 break-words text-[12.5px] leading-snug',
                          item.unreadCount > 0 ? 'font-medium text-o-text' : 'text-o-text-2',
                        )}
                      >
                        {item.lastMessageSender === 'agent' && (
                          <span className="text-o-text-3">You: </span>
                        )}
                        {item.lastMessageSender === 'ai' && (
                          <span className="text-o-ai-text">AI: </span>
                        )}
                        {item.lastMessagePreview}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral">{item.channelName}</Badge>

                        {item.waitingForPerson ? (
                          <Badge tone="warn">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            Handover
                          </Badge>
                        ) : item.aiMode === 'autopilot' && item.status !== 'closed' ? (
                          <Badge tone="ai">
                            <Bot className="h-3 w-3" aria-hidden="true" />
                            AI
                          </Badge>
                        ) : item.assignedAgentName ? (
                          <Badge tone="accent">{item.assignedAgentName}</Badge>
                        ) : null}

                        {showPriority && (
                          <Badge tone={priorityTone(item.priority)}>
                            {item.priority}
                          </Badge>
                        )}

                        {item.status === 'snoozed' && (
                          <Badge tone="neutral">Snoozed</Badge>
                        )}
                        {item.status === 'closed' && (
                          <Badge tone="ok">Resolved</Badge>
                        )}
                        {item.currentTicketId && (
                          <Badge tone="neutral">
                            <Ticket className="h-3 w-3" aria-hidden="true" />
                            Ticket
                          </Badge>
                        )}
                        {item.unreadCount > 0 && (
                          <Badge tone="solid">{item.unreadCount}</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}

            {hasMore && (
              <div className="p-3 text-center">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={loadingMore}
                  onClick={onLoadMore}
                  className="w-full"
                >
                  Load older conversations
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Keyboard hints footer matching Inbox.dc.html */}
      <div className="hidden items-center justify-between gap-2 border-t border-o-border bg-o-surface-2 px-3.5 py-2 text-[11px] text-o-text-3 lg:flex">
        <span className="flex items-center gap-1">
          <kbd className="o-kbd">J</kbd>/<kbd className="o-kbd">K</kbd> Move
        </span>
        <span className="flex items-center gap-1">
          <kbd className="o-kbd">R</kbd> Reply
        </span>
        <span className="flex items-center gap-1">
          <kbd className="o-kbd">N</kbd> Note
        </span>
        <span className="flex items-center gap-1">
          <kbd className="o-kbd">E</kbd> Resolve
        </span>
      </div>
    </section>
  );
}
