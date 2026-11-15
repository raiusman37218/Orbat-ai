'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  GitMerge,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SkeletonRows,
  Tabs,
  useOrbToast,
  type Column,
  type TabItem,
} from '@/components/orbat/primitives';
import { Table } from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { timeAgo } from '@/components/orbat/overview/format';
import { errorMessage } from '@/lib/errors/user-error';
import {
  buildTicketFilters,
  bulkEditTickets,
  deleteSelectedTickets,
  exportTicketsToCsv,
  getTicketsMetaBundle,
  loadTicketsList,
  useTicketsLiveSync,
  type TicketFilterState,
  type TicketListItem,
  type TicketQueueTab,
  type TicketSlaFilter,
  type TicketSort,
} from '@/lib/data/tickets';
import { useData } from '@/lib/data/use-data';
import { roleCan } from '@/lib/team/permissions';
import type { TicketPriority, TicketStatus } from '@/types/database';
import {
  SlaStatusBadge,
  TicketChannelPill,
  TicketPriorityCell,
  TicketStatusBadge,
} from './TicketBadges';
import { TicketDetailDrawer } from './TicketDetailDrawer';
import { MergeTicketsModal, NewTicketModal, SaveViewModal } from './TicketModals';
import './tickets.css';

const PAGE_SIZE = 50;

const INITIAL_FILTER_STATE: TicketFilterState = {
  tab: 'all',
  savedViewId: null,
  search: '',
  groupId: null,
  priority: null,
  slaStatus: null,
  tag: null,
  sort: { field: 'updated_at', direction: 'desc' },
  page: 0,
};

export function TicketsScreen({
  initialTicketId,
}: {
  initialTicketId: string | null;
}) {
  const { workspace, agent } = useShellSession();
  const toast = useOrbToast();
  const workspaceId = workspace.id;

  const [filterState, setFilterState] = useState<TicketFilterState>(INITIAL_FILTER_STATE);
  const [searchInput, setSearchInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openTicketId, setOpenTicketId] = useState<string | null>(initialTicketId);
  const [prevInitTicketId, setPrevInitTicketId] = useState<string | null>(initialTicketId);
  if (initialTicketId !== prevInitTicketId) {
    setPrevInitTicketId(initialTicketId);
    if (initialTicketId) setOpenTicketId(initialTicketId);
  }
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const metaState = useData(
    () => getTicketsMetaBundle(workspaceId),
    ['tickets-meta', workspaceId],
  );

  const listState = useData(
    () => loadTicketsList(workspaceId, filterState),
    ['tickets-list', workspaceId, filterState],
  );

  const reloadAll = useCallback(() => {
    metaState.reload();
    listState.reload();
  }, [metaState, listState]);

  useTicketsLiveSync(workspaceId, reloadAll, true);

  // Keyboard shortcut: '/' focuses ticket search when not typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);
      if (!typing && e.key === '/') {
        const el = document.getElementById('tickets-search-input') as HTMLInputElement | null;
        if (el) {
          e.preventDefault();
          el.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const meta = metaState.data;
  const role = meta?.bootstrap.me.role ?? agent.role;
  const canEdit = roleCan(role, 'edit_ticket');
  const agents = useMemo(() => meta?.bootstrap.agents ?? [], [meta?.bootstrap.agents]);
  const groups = useMemo(() => meta?.bootstrap.groups ?? [], [meta?.bootstrap.groups]);
  const fields = useMemo(() => meta?.fields ?? [], [meta?.fields]);
  const savedViews = useMemo(
    () => (meta?.bootstrap.views ?? []).filter((v) => !v.system),
    [meta?.bootstrap.views],
  );
  const tagOptions = useMemo(() => meta?.tags ?? [], [meta?.tags]);

  const tickets = useMemo(() => listState.data?.tickets ?? [], [listState.data?.tickets]);
  const total = listState.data?.total ?? 0;

  const agentById = useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents],
  );
  const groupById = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );

  const tabItems: TabItem<TicketQueueTab>[] = useMemo(() => {
    const c = meta?.tabCounts;
    return [
      { id: 'all', label: 'All', count: c?.all },
      { id: 'open', label: 'Open', count: c?.open },
      { id: 'pending', label: 'Pending', count: c?.pending },
      { id: 'solved', label: 'Solved', count: c?.solved },
      { id: 'closed', label: 'Closed', count: c?.closed },
      { id: 'unassigned', label: 'Unassigned', count: c?.unassigned },
      { id: 'mine', label: 'My tickets', count: c?.mine },
      { id: 'priority', label: 'Priority', count: c?.priority },
    ];
  }, [meta?.tabCounts]);

  const hasActiveFilters = Boolean(
    filterState.savedViewId ||
      filterState.search ||
      filterState.groupId ||
      filterState.priority ||
      filterState.slaStatus ||
      filterState.tag,
  );

  const selectedTicketsList = useMemo(
    () => tickets.filter((t) => selectedIds.has(t.id)),
    [tickets, selectedIds],
  );

  const allOnPageSelected = tickets.length > 0 && tickets.every((t) => selectedIds.has(t.id));

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(tickets.map((t) => t.id)) : new Set());
  };

  const applyBulk = async (change: { assigneeId?: string | null; status?: TicketStatus; addTag?: string }) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await bulkEditTickets(workspaceId, Array.from(selectedIds), change);
      toast.show({
        tone: 'ok',
        message:
          `Updated ${res.updated} ticket${res.updated === 1 ? '' : 's'}.` +
          (res.skipped.length ? ` Skipped ${res.skipped.length} (${res.skipped[0].reason})` : ''),
      });
      setSelectedIds(new Set());
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await deleteSelectedTickets(workspaceId, Array.from(selectedIds));
      toast.show({
        tone: res.deleted > 0 ? 'ok' : 'bad',
        message:
          res.deleted > 0
            ? `Deleted ${res.deleted} ticket${res.deleted === 1 ? '' : 's'}.` +
              (res.skipped.length ? ` Skipped ${res.skipped.length} closed ticket(s).` : '')
            : res.skipped[0]?.reason || 'No tickets could be deleted.',
      });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setBulkBusy(false);
    }
  };

  const columns: Column<TicketListItem & { matched_on?: string }>[] = [
    ...(canEdit
      ? [
          {
            key: 'select',
            width: 44,
            header: (
              <input
                type="checkbox"
                aria-label="Select all tickets on this page"
                checked={allOnPageSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            ),
            cell: (row: TicketListItem) => (
              <input
                type="checkbox"
                aria-label={`Select ticket #${row.number}`}
                checked={selectedIds.has(row.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggleOne(row.id)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            ),
          } satisfies Column<TicketListItem & { matched_on?: string }>,
        ]
      : []),
    {
      key: 'ticket',
      header: 'Ticket',
      cell: (row) => (
        <div className="py-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="o-mono text-[12px] font-semibold text-o-text-3">#{row.number}</span>
            <span className="font-semibold text-o-text truncate max-w-[320px] sm:max-w-[420px]">
              {row.subject}
            </span>
            {row.matched_on ? (
              <Badge tone="accent">{row.matched_on}</Badge>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-o-text-3">
            <span className="truncate max-w-[180px]">
              {row.requester?.name || row.requester?.email || 'Unknown customer'}
            </span>
            <span>·</span>
            <TicketChannelPill channel={row.channel} />
            {(row.tags || []).slice(0, 2).map((t) => (
              <Badge key={t} tone="neutral">
                {t}
              </Badge>
            ))}
            <span className="sm:hidden inline-flex items-center gap-1.5 ml-auto">
              <TicketStatusBadge status={row.status} />
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      hideBelow: 'sm',
      cell: (row) => <TicketStatusBadge status={row.status} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      hideBelow: 'md',
      cell: (row) => <TicketPriorityCell priority={row.priority} />,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      hideBelow: 'md',
      cell: (row) => {
        const person = row.assignee_id ? agentById.get(row.assignee_id) : null;
        if (!person) return <span className="text-[13px] text-o-text-3">Unassigned</span>;
        return (
          <div className="flex items-center gap-2">
            <Avatar name={person.name} src={person.avatar_url} size={24} />
            <span className="text-[13.5px] text-o-text truncate max-w-[120px]">{person.name}</span>
          </div>
        );
      },
    },
    {
      key: 'team',
      header: 'Team',
      hideBelow: 'lg',
      cell: (row) => {
        const grp = row.group_id ? groupById.get(row.group_id) : null;
        return grp ? (
          <Badge tone="neutral">{grp.name}</Badge>
        ) : (
          <span className="text-[13px] text-o-text-3">—</span>
        );
      },
    },
    {
      key: 'sla',
      header: 'SLA',
      hideBelow: 'lg',
      cell: (row) => (
        <SlaStatusBadge
          slaState={row.sla_state}
          breachedAt={row.sla_breached_at}
          warnAt={row.sla_next_warn_at}
          dueAt={row.sla_next_due_at}
        />
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      align: 'right',
      hideBelow: 'sm',
      cell: (row) => (
        <span className="text-[13px] text-o-text-3">{timeAgo(row.updated_at)}</span>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromRow = total === 0 ? 0 : filterState.page * PAGE_SIZE + 1;
  const toRow = Math.min(total, (filterState.page + 1) * PAGE_SIZE);

  return (
    <PageContainer>
      <PageHeader
        title="Tickets"
        description="Track customer issues, SLA deadlines, team assignments, and multi-channel follow-ups."
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              leading={<Download size={15} aria-hidden="true" />}
              disabled={tickets.length === 0}
              onClick={() => exportTicketsToCsv(tickets, agents, groups)}
            >
              Export CSV
            </Button>
            {canEdit ? (
              <Button
                variant="primary"
                size="md"
                leading={<Plus size={15} aria-hidden="true" />}
                onClick={() => setNewTicketOpen(true)}
              >
                New ticket
              </Button>
            ) : null}
          </>
        }
      />

      <Card flush>
        {/* View Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2 border-b border-o-border">
          <Tabs
            items={tabItems}
            value={filterState.tab}
            onChange={(tab) => {
              setSelectedIds(new Set());
              setFilterState((s) => ({ ...s, tab, savedViewId: null, page: 0 }));
            }}
            label="Ticket queues"
            className="border-b-0 flex-1 min-w-0"
          />

          <div className="flex items-center gap-2 pb-2">
            {savedViews.length > 0 ? (
              <Select
                size="sm"
                value={filterState.savedViewId ?? ''}
                onChange={(e) => {
                  setSelectedIds(new Set());
                  setFilterState((s) => ({
                    ...s,
                    savedViewId: e.target.value || null,
                    page: 0,
                  }));
                }}
                aria-label="Saved views"
                className="!h-8 !w-auto !text-[13px]"
              >
                <option value="">Saved views...</option>
                {savedViews.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({meta?.bootstrap.counts[v.id] ?? 0})
                  </option>
                ))}
              </Select>
            ) : null}
            <Button
              variant="quiet"
              size="sm"
              leading={<BookmarkPlus size={14} aria-hidden="true" />}
              onClick={() => setSaveViewOpen(true)}
            >
              Save view
            </Button>
          </div>
        </div>

        {/* Search & Filter Chips */}
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-o-border bg-o-bg/50 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <form
              role="search"
              className="relative w-full sm:w-[270px]"
              onSubmit={(e) => {
                e.preventDefault();
                setSelectedIds(new Set());
                setFilterState((s) => ({ ...s, search: searchInput.trim(), page: 0 }));
              }}
            >
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-o-text-3"
                aria-hidden="true"
              />
              <Input
                id="tickets-search-input"
                size="sm"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!e.target.value && filterState.search) {
                    setFilterState((s) => ({ ...s, search: '', page: 0 }));
                  }
                }}
                placeholder="Search #number, subject, email..."
                aria-label="Search tickets"
                className="!h-9 !pl-9 !pr-8 !text-[13.5px]"
              />
              {searchInput ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchInput('');
                    setFilterState((s) => ({ ...s, search: '', page: 0 }));
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-o-text-3 hover:text-o-text"
                >
                  <X size={14} />
                </button>
              ) : null}
            </form>

            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[12px] text-o-text-3 px-1">
                <Filter size={12} aria-hidden="true" />
              </span>

              <Select
                size="sm"
                aria-label="Filter by team"
                value={filterState.groupId ?? ''}
                onChange={(e) =>
                  setFilterState((s) => ({ ...s, groupId: e.target.value || null, savedViewId: null, page: 0 }))
                }
                className="!h-8 !w-auto !rounded-full !px-3 !pr-7 !text-[12.5px]"
              >
                <option value="">Team: All</option>
                <option value="none">Unassigned team</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>

              <Select
                size="sm"
                aria-label="Filter by priority"
                value={filterState.priority ?? ''}
                onChange={(e) =>
                  setFilterState((s) => ({
                    ...s,
                    priority: (e.target.value as TicketPriority) || null,
                    savedViewId: null,
                    page: 0,
                  }))
                }
                className="!h-8 !w-auto !rounded-full !px-3 !pr-7 !text-[12.5px]"
              >
                <option value="">Priority: All</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </Select>

              <Select
                size="sm"
                aria-label="Filter by SLA status"
                value={filterState.slaStatus ?? ''}
                onChange={(e) =>
                  setFilterState((s) => ({
                    ...s,
                    slaStatus: (e.target.value as TicketSlaFilter) || null,
                    page: 0,
                  }))
                }
                className="!h-8 !w-auto !rounded-full !px-3 !pr-7 !text-[12.5px]"
              >
                <option value="">SLA: All</option>
                <option value="breached">Breached</option>
                <option value="at_risk">At risk</option>
                <option value="running">Running</option>
                <option value="paused">Paused</option>
                <option value="met">Met</option>
              </Select>

              <Select
                size="sm"
                aria-label="Filter by tag"
                value={filterState.tag ?? ''}
                onChange={(e) =>
                  setFilterState((s) => ({ ...s, tag: e.target.value || null, savedViewId: null, page: 0 }))
                }
                className="!h-8 !w-auto !rounded-full !px-3 !pr-7 !text-[12.5px]"
              >
                <option value="">Tag: All</option>
                {tagOptions.map((t) => (
                  <option key={t.tag} value={t.tag}>
                    {t.tag} ({t.tickets})
                  </option>
                ))}
              </Select>

              {hasActiveFilters ? (
                <Button
                  variant="quiet"
                  size="sm"
                  className="!h-8 !px-2.5 !text-[12.5px]"
                  onClick={() => {
                    setSearchInput('');
                    setFilterState((s) => ({
                      ...INITIAL_FILTER_STATE,
                      tab: s.tab,
                    }));
                  }}
                >
                  Reset
                </Button>
              ) : null}
            </div>
          </div>

          {/* Sort selector */}
          {!filterState.search ? (
            <div className="flex items-center gap-2 shrink-0">
              <Select
                size="sm"
                aria-label="Sort tickets"
                value={`${filterState.sort.field}:${filterState.sort.direction}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split(':') as [
                    TicketSort['field'],
                    TicketSort['direction'],
                  ];
                  setFilterState((s) => ({ ...s, sort: { field, direction }, page: 0 }));
                }}
                className="!h-8 !w-auto !text-[12.5px]"
              >
                <option value="updated_at:desc">Updated (newest)</option>
                <option value="created_at:desc">Created (newest)</option>
                <option value="sla_next_due_at:asc">SLA due soonest</option>
                <option value="priority:desc">Highest priority</option>
                <option value="number:desc">Ticket #</option>
              </Select>
            </div>
          ) : null}
        </div>

        {/* Bulk selection bar */}
        {canEdit && selectedIds.size > 0 ? (
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-o-border bg-o-accent-soft/60"
            role="region"
            aria-label="Bulk actions"
          >
            <span className="text-[13px] font-semibold text-o-accent-text mr-1">
              {selectedIds.size} selected
            </span>

            <Select
              size="sm"
              aria-label="Bulk assign"
              value=""
              disabled={bulkBusy}
              onChange={(e) => {
                if (e.target.value === '') return;
                applyBulk({ assigneeId: e.target.value === 'unassigned' ? null : e.target.value });
              }}
              className="!h-8 !w-auto !text-[12.5px]"
            >
              <option value="">Assign to...</option>
              <option value="unassigned">Unassigned</option>
              {agents
                .filter((a) => a.is_active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>

            <Select
              size="sm"
              aria-label="Bulk status"
              value=""
              disabled={bulkBusy}
              onChange={(e) => {
                if (!e.target.value) return;
                applyBulk({ status: e.target.value as TicketStatus });
              }}
              className="!h-8 !w-auto !text-[12.5px]"
            >
              <option value="">Change status...</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="on_hold">On hold</option>
              <option value="solved">Solved</option>
              <option value="closed">Closed</option>
            </Select>

            {selectedIds.size >= 2 ? (
              <Button
                variant="secondary"
                size="sm"
                leading={<GitMerge size={13} aria-hidden="true" />}
                onClick={() => setMergeOpen(true)}
                disabled={bulkBusy}
              >
                Merge
              </Button>
            ) : null}

            <Button
              variant="danger"
              size="sm"
              leading={<Trash2 size={13} aria-hidden="true" />}
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkBusy}
            >
              Delete
            </Button>

            <Button
              variant="quiet"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto"
            >
              Clear
            </Button>
          </div>
        ) : null}

        {/* Table body */}
        {listState.error ? (
          <ErrorState
            title="Could not load tickets"
            body={listState.error}
            onRetry={reloadAll}
          />
        ) : listState.loading && !listState.data ? (
          <div className="p-6">
            <SkeletonRows rows={7} />
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No tickets match these filters' : 'No tickets yet'}
            body={
              hasActiveFilters
                ? 'Try clearing your search or switching queue filters.'
                : 'New customer conversations and manually created tickets will appear here.'
            }
            action={
              hasActiveFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setFilterState(INITIAL_FILTER_STATE);
                  }}
                >
                  Clear filters
                </Button>
              ) : canEdit ? (
                <Button variant="primary" size="sm" onClick={() => setNewTicketOpen(true)}>
                  Create first ticket
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <Table
              caption="Workspace support tickets"
              columns={columns}
              rows={tickets}
              rowKey={(r) => r.id}
              selectedKey={openTicketId}
              onRowClick={(row) => setOpenTicketId(row.id)}
            />

            {/* Pagination bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-o-border text-[13px] text-o-text-3">
              <span>
                Showing <strong className="o-num text-o-text">{fromRow}</strong>–
                <strong className="o-num text-o-text">{toRow}</strong> of{' '}
                <strong className="o-num text-o-text">{total}</strong>
              </span>
              {!filterState.search && totalPages > 1 ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={filterState.page === 0}
                    onClick={() => setFilterState((s) => ({ ...s, page: Math.max(0, s.page - 1) }))}
                    leading={<ChevronLeft size={14} aria-hidden="true" />}
                  >
                    Prev
                  </Button>
                  <span className="px-2 o-num">
                    {filterState.page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={filterState.page + 1 >= totalPages}
                    onClick={() =>
                      setFilterState((s) => ({ ...s, page: Math.min(totalPages - 1, s.page + 1) }))
                    }
                    trailing={<ChevronRight size={14} aria-hidden="true" />}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </Card>

      {/* Slide-over detail drawer */}
      <TicketDetailDrawer
        ticketId={openTicketId}
        workspaceId={workspaceId}
        role={role}
        agents={agents}
        groups={groups}
        fields={fields}
        onClose={() => setOpenTicketId(null)}
        onOpenTicket={(id) => setOpenTicketId(id)}
        onChanged={reloadAll}
        onDeleted={reloadAll}
      />

      {/* Modals */}
      <NewTicketModal
        open={newTicketOpen}
        workspaceId={workspaceId}
        agents={agents.filter((a) => a.is_active)}
        groups={groups}
        onClose={() => setNewTicketOpen(false)}
        onCreated={(id) => {
          reloadAll();
          setOpenTicketId(id);
        }}
      />

      <MergeTicketsModal
        open={mergeOpen}
        workspaceId={workspaceId}
        tickets={selectedTicketsList}
        onClose={() => setMergeOpen(false)}
        onMerged={(targetId) => {
          setSelectedIds(new Set());
          reloadAll();
          setOpenTicketId(targetId);
        }}
      />

      <SaveViewModal
        open={saveViewOpen}
        workspaceId={workspaceId}
        filters={buildTicketFilters(filterState)}
        sort={filterState.sort}
        canShare={Boolean(meta?.bootstrap.me.isAdmin)}
        onClose={() => setSaveViewOpen(false)}
        onSaved={(viewId) => {
          reloadAll();
          setFilterState((s) => ({ ...s, savedViewId: viewId, page: 0 }));
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.size} ticket${selectedIds.size === 1 ? '' : 's'}?`}
        body="Non-closed selected tickets will be permanently removed. Closed tickets are preserved as read-only history."
        confirmLabel={`Delete ${selectedIds.size}`}
        busy={bulkBusy}
      />
    </PageContainer>
  );
}
