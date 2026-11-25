'use client';

/**
 * Top-level Inbox workspace (`/app/inbox`), matching `Inbox.dc.html` on desktop
 * and `MobileInbox.dc.html` on mobile (`390px`), reading and mutating data
 * exclusively via `@/lib/data/inbox`.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useOrbToast } from '@/components/orbat/primitives';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { useData } from '@/lib/data/use-data';
import {
  bulkUpdateInboxConversations,
  createTicketFromConversation,
  deleteInboxConversationView,
  deleteInboxMessage,
  getConversationDetail,
  getCustomerContext,
  getInboxCopilotState,
  getInboxMeta,
  mergeInboxConversations,
  saveInboxConversationView,
  searchInboxConversations,
  snoozeInboxConversation,
  updateInboxConversationStatus,
  useInboxLiveSync,
  type InboxAgent,
  type InboxChannelFilter,
  type InboxConversationItem,
  type InboxPriorityFilter,
  type InboxSavedFilter,
  type InboxSortKey,
  type InboxViewKey,
} from '@/lib/data/inbox';
import { ConversationList } from './ConversationList';
import { ConversationThread } from './ConversationThread';
import { CustomerContextPanel } from './CustomerContextPanel';
import {
  BulkAssignModal,
  CreateTicketModal,
  DeleteMessageConfirm,
  MergeModal,
  SaveConversationViewModal,
  SnoozeModal,
} from './InboxModals';
import { InboxViewsNav } from './InboxViewsNav';
import './inbox.css';

const PAGE_SIZE = 30;
const EMPTY_MAP: Record<string, InboxAgent> = {};
const EMPTY_COUNTS: Record<InboxViewKey, number> = {
  open: 0,
  mine: 0,
  unassigned: 0,
  ai: 0,
  waiting: 0,
  waiting_approval: 0,
  snoozed: 0,
  resolved: 0,
  all: 0,
};

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export function InboxScreen({
  initialConversationId,
}: {
  initialConversationId: string | null;
}) {
  const { agent, workspace } = useShellSession();
  const toast = useOrbToast();
  const workspaceId = workspace.id;
  void agent;

  const isLgDesktop = useMediaQuery('(min-width: 1024px)');
  const isXlDesktop = useMediaQuery('(min-width: 1280px)');

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // List / View / Filter state
  const [activeView, setActiveView] = useState<InboxViewKey>(() =>
    initialConversationId ? 'all' : 'open',
  );
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<InboxChannelFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<InboxPriorityFilter>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<InboxSortKey>('newest');
  const [cursor, setCursor] = useState<string | null>(null);
  const [extraPages, setExtraPages] = useState<{
    key: string;
    rows: InboxConversationItem[];
  }>({ key: '', rows: [] });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Active thread selection + mobile single-pane / context drawer toggle
  const [userSelectedId, setUserSelectedId] = useState<string | null>(
    initialConversationId,
  );
  const [mobileShowThread, setMobileShowThread] = useState(
    Boolean(initialConversationId),
  );
  const [prevInitConvId, setPrevInitConvId] = useState<string | null>(
    initialConversationId,
  );
  if (initialConversationId !== prevInitConvId) {
    setPrevInitConvId(initialConversationId);
    if (initialConversationId) {
      setUserSelectedId(initialConversationId);
      setActiveView('all');
      setMobileShowThread(true);
    }
  }
  const [userContextOpen, setUserContextOpen] = useState<boolean | null>(null);

  // Composer lifted state (for R / N shortcuts + Customer drawer switch)
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply');
  const [composerText, setComposerText] = useState('');

  // Modal & mutation states
  const [resolving, setResolving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [bulkAssignIds, setBulkAssignIds] = useState<string[] | null>(null);
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  const filterKey = useMemo(
    () =>
      JSON.stringify([
        workspaceId,
        activeView,
        channelFilter,
        priorityFilter,
        selectedGroupId,
        debouncedSearch,
        sortBy,
      ]),
    [
      workspaceId,
      activeView,
      channelFilter,
      priorityFilter,
      selectedGroupId,
      debouncedSearch,
      sortBy,
    ],
  );
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCursor(null);
    setExtraPages({ key: filterKey, rows: [] });
  }

  // Data loading via shared useData hook (server-side search, filters, counts & cursor pagination)
  const metaState = useData(
    () => getInboxMeta(workspaceId),
    ['inbox-meta', workspaceId],
  );
  const listState = useData(
    () =>
      searchInboxConversations(workspaceId, {
        view: activeView,
        channel: channelFilter,
        priority: priorityFilter,
        groupId: selectedGroupId,
        search: debouncedSearch,
        sort: sortBy,
        cursor,
        limit: PAGE_SIZE,
      }),
    ['inbox-search', filterKey, cursor],
  );

  const meta = metaState.data ?? null;
  const visibleConversations = useMemo(() => {
    const pageRows = listState.data?.conversations ?? [];
    const prior = extraPages.key === filterKey ? extraPages.rows : [];
    if (prior.length === 0) return pageRows;
    const seen = new Set(prior.map((c) => c.id));
    return [...prior, ...pageRows.filter((c) => !seen.has(c.id))];
  }, [extraPages, filterKey, listState.data]);
  const hasMore = listState.data?.hasMore ?? false;
  const viewCounts = listState.data?.counts ?? EMPTY_COUNTS;
  const groupCounts = listState.data?.groupCounts ?? {};
  const totalMatching = listState.data?.total ?? visibleConversations.length;

  const agentsById = useMemo(() => {
    if (!meta) return EMPTY_MAP;
    const map: Record<string, InboxAgent> = {};
    for (const a of meta.agents) map[a.id] = a;
    return map;
  }, [meta]);

  // Desktop automatically highlights the first visible thread until user clicks another
  const effectiveSelectedId =
    userSelectedId ??
    (isLgDesktop ? (visibleConversations[0]?.id ?? null) : null);

  const contextOpen = userContextOpen ?? isXlDesktop;

  // Detail, customer context & copilot states for effectiveSelectedId
  const detailState = useData(
    () =>
      getConversationDetail(
        workspaceId,
        effectiveSelectedId!,
        agentsById,
        meta?.handoversByConversationId[effectiveSelectedId!],
      ),
    ['inbox-detail', workspaceId, effectiveSelectedId, meta ? 1 : 0],
    { enabled: Boolean(effectiveSelectedId) },
  );

  const activeDetail =
    effectiveSelectedId &&
    detailState.data?.conversation.id === effectiveSelectedId
      ? detailState.data
      : null;

  const customerState = useData(
    () => getCustomerContext(workspaceId, activeDetail!.conversation),
    [
      'inbox-customer',
      workspaceId,
      activeDetail?.conversation.id ?? null,
      activeDetail?.conversation.updatedAt ?? null,
    ],
    {
      enabled: Boolean(
        activeDetail && activeDetail.conversation.id === effectiveSelectedId,
      ),
    },
  );

  const copilotState = useData(
    () => getInboxCopilotState(workspaceId, effectiveSelectedId!),
    ['inbox-copilot', workspaceId, effectiveSelectedId],
    { enabled: Boolean(effectiveSelectedId) },
  );

  const handleSelectConversation = useCallback((id: string) => {
    setUserSelectedId(id);
    setMobileShowThread(true);
    setComposerText('');
    setComposerMode('reply');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('c', id);
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setCursor(null);
    setExtraPages({ key: filterKey, rows: [] });
    listState.reload();
    if (effectiveSelectedId) {
      detailState.reload();
      customerState.reload();
    }
  }, [filterKey, listState, detailState, customerState, effectiveSelectedId]);

  const handleLoadMore = useCallback(() => {
    const nextCursor = listState.data?.nextCursor;
    if (!nextCursor || listState.loading) return;
    setExtraPages({ key: filterKey, rows: visibleConversations });
    setCursor(nextCursor);
  }, [listState.data?.nextCursor, listState.loading, filterKey, visibleConversations]);

  const handleApplySavedFilter = useCallback((f: InboxSavedFilter) => {
    const fv = f.filters?.view;
    const mappedView: InboxViewKey =
      fv === 'ai_handled'
        ? 'ai'
        : fv === 'closed'
          ? 'resolved'
          : (fv as InboxViewKey) || 'open';
    setActiveView(mappedView);
    setChannelFilter((f.filters?.channel as InboxChannelFilter) || 'all');
    setPriorityFilter((f.filters?.priority as InboxPriorityFilter) || 'all');
    setSelectedGroupId(f.filters?.groupId ?? null);
    const nextQ = f.filters?.search || '';
    setSearch(nextQ);
    setDebouncedSearch(nextQ);
    setSortBy(f.sort?.field || 'newest');
    setActiveSavedFilterId(f.id);
  }, []);

  const handleDeleteSavedFilter = useCallback(
    async (viewId: string) => {
      try {
        await deleteInboxConversationView(workspaceId, viewId);
        if (activeSavedFilterId === viewId) setActiveSavedFilterId(null);
        metaState.reload();
        toast.show({ message: 'Saved view deleted.', tone: 'ok' });
      } catch (err) {
        toast.show({
          message: err instanceof Error ? err.message : 'Could not delete saved view.',
          tone: 'bad',
        });
      }
    },
    [workspaceId, activeSavedFilterId, metaState, toast],
  );

  useInboxLiveSync({
    workspaceId,
    conversationId: effectiveSelectedId,
    enabled: Boolean(workspaceId),
    onRefresh: refreshAll,
  });

  const handleResolveToggle = useCallback(async () => {
    const conv = activeDetail?.conversation;
    if (!conv || resolving) return;
    const targetClosed = conv.status !== 'closed';
    setResolving(true);
    try {
      await updateInboxConversationStatus(
        workspaceId,
        conv.id,
        targetClosed ? 'closed' : 'open',
      );
      toast.show({
        message: targetClosed ? 'Conversation resolved.' : 'Conversation reopened.',
        tone: 'ok',
      });
      await refreshAll();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Status update failed.',
        tone: 'bad',
      });
    } finally {
      setResolving(false);
    }
  }, [activeDetail, resolving, workspaceId, toast, refreshAll]);

  // Keyboard shortcuts (Inbox.dc.html: J/K, R, N, E, /)
  useEffect(() => {
    const anyModalOpen =
      snoozeOpen ||
      mergeOpen ||
      createTicketOpen ||
      saveViewOpen ||
      Boolean(bulkAssignIds) ||
      Boolean(deleteMsgId);

    const onKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === '/' && searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current.focus();
        return;
      }

      if (key === 'j' || key === 'arrowdown' || key === 'k' || key === 'arrowup') {
        if (visibleConversations.length === 0) return;
        e.preventDefault();
        const curIdx = visibleConversations.findIndex(
          (c) => c.id === effectiveSelectedId,
        );
        const delta = key === 'j' || key === 'arrowdown' ? 1 : -1;
        const nextIdx =
          curIdx === -1
            ? 0
            : Math.min(
                visibleConversations.length - 1,
                Math.max(0, curIdx + delta),
              );
        const next = visibleConversations[nextIdx];
        if (next && next.id !== effectiveSelectedId) {
          handleSelectConversation(next.id);
        }
        return;
      }

      if (!effectiveSelectedId) return;

      if (key === 'r') {
        e.preventDefault();
        setComposerMode('reply');
        requestAnimationFrame(() => composerRef.current?.focus());
      } else if (key === 'n') {
        e.preventDefault();
        setComposerMode('note');
        requestAnimationFrame(() => composerRef.current?.focus());
      } else if (key === 'e') {
        e.preventDefault();
        void handleResolveToggle();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    snoozeOpen,
    mergeOpen,
    createTicketOpen,
    saveViewOpen,
    bulkAssignIds,
    deleteMsgId,
    visibleConversations,
    effectiveSelectedId,
    handleSelectConversation,
    handleResolveToggle,
  ]);

  const handleBulkResolve = async (ids: string[]) => {
    setBulkBusy(true);
    try {
      await bulkUpdateInboxConversations(workspaceId, { ids, action: 'resolve' });
      toast.show({
        message: `Resolved ${ids.length} conversation${ids.length === 1 ? '' : 's'}.`,
        tone: 'ok',
      });
      await refreshAll();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Bulk resolve failed.',
        tone: 'bad',
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkMarkSpam = async (ids: string[]) => {
    setBulkBusy(true);
    try {
      await bulkUpdateInboxConversations(workspaceId, { ids, action: 'spam' });
      toast.show({
        message: `Marked ${ids.length} as spam.`,
        tone: 'ok',
      });
      await refreshAll();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Bulk spam action failed.',
        tone: 'bad',
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const activeCustomer =
    activeDetail &&
    customerState.data?.visitorId === (activeDetail.conversation.visitorId || null)
      ? customerState.data
      : null;

  const activeCopilot = copilotState.data ?? null;

  return (
    <div className="o-inbox-shell flex w-full min-w-0 flex-1 bg-o-bg">
      {/* Pane 1: Desktop Views Rail (212px on xl) */}
      <InboxViewsNav
        activeView={activeView}
        onSelectView={(v) => {
          setActiveSavedFilterId(null);
          setActiveView(v);
        }}
        counts={viewCounts}
        teamGroups={meta?.teamGroups || []}
        selectedGroupId={selectedGroupId}
        onSelectGroup={(gid) => {
          setActiveSavedFilterId(null);
          setSelectedGroupId(gid);
        }}
        groupCounts={groupCounts}
        savedFilters={meta?.savedFilters || []}
        activeSavedFilterId={activeSavedFilterId}
        onApplySavedFilter={handleApplySavedFilter}
        onOpenSaveFilter={() => setSaveViewOpen(true)}
        onDeleteSavedFilter={handleDeleteSavedFilter}
        metaLoading={metaState.loading}
        metaError={metaState.error}
        onRetryMeta={metaState.reload}
      />

      {/* Pane 2: Conversation List */}
      <div
        className={
          mobileShowThread
            ? 'hidden h-full lg:flex'
            : 'flex h-[calc(100dvh-65px)] w-full lg:h-full lg:w-auto'
        }
      >
        <ConversationList
          conversations={visibleConversations}
          totalLoaded={visibleConversations.length}
          selectedId={effectiveSelectedId}
          onSelect={handleSelectConversation}
          activeView={activeView}
          onSelectView={(v) => {
            setActiveSavedFilterId(null);
            setActiveView(v);
          }}
          viewCounts={viewCounts}
          selectedGroupName={
            selectedGroupId
              ? meta?.teamGroups.find((g) => g.id === selectedGroupId)?.name || 'Team'
              : null
          }
          onClearGroup={() => {
            setActiveSavedFilterId(null);
            setSelectedGroupId(null);
          }}
          totalMatching={totalMatching}
          search={search}
          onSearchChange={(val) => {
            setActiveSavedFilterId(null);
            setSearch(val);
          }}
          searchInputRef={searchInputRef}
          channelFilter={channelFilter}
          onChannelFilterChange={(val) => {
            setActiveSavedFilterId(null);
            setChannelFilter(val);
          }}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={(val) => {
            setActiveSavedFilterId(null);
            setPriorityFilter(val);
          }}
          sortBy={sortBy}
          onSortByChange={(val) => {
            setActiveSavedFilterId(null);
            setSortBy(val);
          }}
          loading={listState.loading && visibleConversations.length === 0}
          refreshing={listState.loading && visibleConversations.length > 0 && !cursor}
          error={listState.error}
          onRetry={listState.reload}
          onRefresh={() => void refreshAll()}
          hasMore={hasMore}
          loadingMore={listState.loading && Boolean(cursor)}
          onLoadMore={handleLoadMore}
          bulkBusy={bulkBusy}
          onBulkResolve={handleBulkResolve}
          onBulkOpenAssign={(ids) => setBulkAssignIds(ids)}
          onBulkMarkSpam={handleBulkMarkSpam}
        />
      </div>

      {/* Pane 3: Conversation Workspace */}
      <div
        className={
          mobileShowThread
            ? 'flex h-[calc(100dvh-65px)] min-w-0 flex-1 lg:h-full'
            : 'hidden min-w-0 flex-1 lg:flex lg:h-full'
        }
      >
        <ConversationThread
          key={effectiveSelectedId || 'empty'}
          workspaceId={workspaceId}
          detail={activeDetail}
          loading={Boolean(effectiveSelectedId) && !activeDetail && detailState.loading}
          error={detailState.error}
          onRetry={detailState.reload}
          agents={meta?.agents || []}
          teamGroups={meta?.teamGroups || []}
          cannedReplies={meta?.cannedReplies || []}
          copilotState={activeCopilot}
          contextOpen={contextOpen}
          onToggleContext={() => setUserContextOpen(!contextOpen)}
          onBackToList={() => setMobileShowThread(false)}
          onRefresh={refreshAll}
          onRefreshCopilot={async () => copilotState.reload()}
          composerMode={composerMode}
          onComposerModeChange={setComposerMode}
          composerText={composerText}
          onComposerTextChange={setComposerText}
          composerRef={composerRef}
          onResolveToggle={handleResolveToggle}
          resolving={resolving}
          onOpenCustomSnooze={() => setSnoozeOpen(true)}
          onOpenMerge={() => setMergeOpen(true)}
          onOpenCreateTicket={() => setCreateTicketOpen(true)}
          onRequestDeleteMessage={(msgId) => setDeleteMsgId(msgId)}
        />
      </div>

      {/* Pane 4: Customer Context & Copilot Drawer */}
      {activeDetail && (
        <CustomerContextPanel
          workspaceId={workspaceId}
          open={contextOpen && (mobileShowThread || isLgDesktop)}
          onClose={() => setUserContextOpen(false)}
          detail={activeDetail}
          customer={activeCustomer}
          customerLoading={!activeCustomer && customerState.loading}
          customerError={customerState.error}
          onRetryCustomer={customerState.reload}
          copilot={activeCopilot}
          copilotLoading={!activeCopilot && copilotState.loading}
          copilotError={copilotState.error}
          onRetryCopilot={copilotState.reload}
          workspaceTags={meta?.workspaceTags || []}
          onSelectConversation={handleSelectConversation}
          onOpenCreateTicket={() => setCreateTicketOpen(true)}
          onSwitchToNoteComposer={() => {
            setComposerMode('note');
            if (!isXlDesktop) setUserContextOpen(false);
            requestAnimationFrame(() => composerRef.current?.focus());
          }}
          onConversationUpdated={refreshAll}
        />
      )}

      {/* Modals */}
      <SnoozeModal
        open={snoozeOpen}
        onClose={() => setSnoozeOpen(false)}
        busy={modalBusy}
        onConfirm={async (iso) => {
          if (!activeDetail) return;
          setModalBusy(true);
          try {
            await snoozeInboxConversation(activeDetail.conversation.id, iso);
            setSnoozeOpen(false);
            toast.show({ message: 'Conversation snoozed.', tone: 'ok' });
            await refreshAll();
          } catch (err) {
            toast.show({
              message: err instanceof Error ? err.message : 'Snooze failed.',
              tone: 'bad',
            });
          } finally {
            setModalBusy(false);
          }
        }}
      />

      {activeDetail && (
        <MergeModal
          open={mergeOpen}
          onClose={() => setMergeOpen(false)}
          workspaceId={workspaceId}
          conversation={activeDetail.conversation}
          busy={modalBusy}
          onConfirmMerge={async (sourceId) => {
            setModalBusy(true);
            try {
              await mergeInboxConversations(
                sourceId,
                activeDetail.conversation.id,
                agent.name,
              );
              setMergeOpen(false);
              toast.show({ message: 'Threads merged.', tone: 'ok' });
              await refreshAll();
            } catch (err) {
              toast.show({
                message: err instanceof Error ? err.message : 'Merge failed.',
                tone: 'bad',
              });
            } finally {
              setModalBusy(false);
            }
          }}
        />
      )}

      {activeDetail && (
        <CreateTicketModal
          open={createTicketOpen}
          onClose={() => setCreateTicketOpen(false)}
          conversation={activeDetail.conversation}
          agents={meta?.agents || []}
          initialDescription={activeDetail.messages
            .slice(-4)
            .map((m) => `${m.senderName}: ${m.content}`)
            .join('\n\n')}
          busy={modalBusy}
          onCreate={async (input) => {
            setModalBusy(true);
            try {
              const ticket = await createTicketFromConversation(
                workspaceId,
                input,
              );
              setCreateTicketOpen(false);
              toast.show({
                message: `Created ticket #${ticket.number}.`,
                tone: 'ok',
              });
              await refreshAll();
            } finally {
              setModalBusy(false);
            }
          }}
        />
      )}

      <BulkAssignModal
        open={Boolean(bulkAssignIds && bulkAssignIds.length > 0)}
        count={bulkAssignIds?.length || 0}
        agents={meta?.agents || []}
        onClose={() => setBulkAssignIds(null)}
        busy={modalBusy}
        onConfirm={async (agentId) => {
          if (!bulkAssignIds) return;
          setModalBusy(true);
          try {
            await bulkUpdateInboxConversations(workspaceId, {
              ids: bulkAssignIds,
              action: 'assign',
              agentId,
            });
            setBulkAssignIds(null);
            toast.show({ message: 'Assignment applied.', tone: 'ok' });
            await refreshAll();
          } catch (err) {
            toast.show({
              message:
                err instanceof Error ? err.message : 'Bulk assign failed.',
              tone: 'bad',
            });
          } finally {
            setModalBusy(false);
          }
        }}
      />

      <DeleteMessageConfirm
        open={Boolean(deleteMsgId)}
        onClose={() => setDeleteMsgId(null)}
        busy={modalBusy}
        onConfirm={async () => {
          if (!deleteMsgId || !activeDetail) return;
          setModalBusy(true);
          try {
            await deleteInboxMessage(
              workspaceId,
              activeDetail.conversation.id,
              deleteMsgId,
            );
            setDeleteMsgId(null);
            toast.show({ message: 'Message deleted.', tone: 'ok' });
            await refreshAll();
          } catch (err) {
            toast.show({
              message: err instanceof Error ? err.message : 'Delete failed.',
              tone: 'bad',
            });
          } finally {
            setModalBusy(false);
          }
        }}
      />

      <SaveConversationViewModal
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        busy={modalBusy}
        summaryLabel={[
          `View: ${activeView}`,
          channelFilter !== 'all' ? `Channel: ${channelFilter}` : null,
          priorityFilter !== 'all' ? `Priority: ${priorityFilter}` : null,
          selectedGroupId
            ? `Team: ${meta?.teamGroups.find((g) => g.id === selectedGroupId)?.name || 'Group'}`
            : null,
          debouncedSearch ? `Search: "${debouncedSearch}"` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        onConfirm={async ({ name, shared }) => {
          setModalBusy(true);
          try {
            const saved = await saveInboxConversationView(workspaceId, {
              name,
              shared,
              filters: {
                view: activeView,
                channel: channelFilter,
                priority: priorityFilter,
                groupId: selectedGroupId,
                search: debouncedSearch || undefined,
              },
              sort: { field: sortBy, direction: 'desc' },
            });
            setSaveViewOpen(false);
            setActiveSavedFilterId(saved.id);
            metaState.reload();
            toast.show({ message: `Saved view "${saved.name}".`, tone: 'ok' });
          } catch (err) {
            toast.show({
              message: err instanceof Error ? err.message : 'Could not save view.',
              tone: 'bad',
            });
          } finally {
            setModalBusy(false);
          }
        }}
      />
    </div>
  );
}
