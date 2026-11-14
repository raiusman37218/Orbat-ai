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
  computeInboxViewCounts,
  createTicketFromConversation,
  deleteInboxMessage,
  filterInboxConversations,
  getConversationDetail,
  getCustomerContext,
  getInboxCopilotState,
  getInboxMeta,
  listInboxConversations,
  mergeInboxConversations,
  snoozeInboxConversation,
  sortInboxConversations,
  updateInboxConversationStatus,
  useInboxLiveSync,
  type InboxAgent,
  type InboxChannelFilter,
  type InboxPriorityFilter,
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
  SnoozeModal,
} from './InboxModals';
import { InboxViewsNav } from './InboxViewsNav';
import './inbox.css';

const PAGE_SIZE = 30;
const EMPTY_MAP: Record<string, InboxAgent> = {};

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

  const isLgDesktop = useMediaQuery('(min-width: 1024px)');
  const isXlDesktop = useMediaQuery('(min-width: 1280px)');

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // List / View / Filter state
  const [pageCount, setPageCount] = useState(1);
  const [activeView, setActiveView] = useState<InboxViewKey>(() =>
    initialConversationId ? 'all' : 'open',
  );
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<InboxChannelFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<InboxPriorityFilter>('all');
  const [sortBy, setSortBy] = useState<InboxSortKey>('newest');

  // Active thread selection + mobile single-pane / context drawer toggle
  const [userSelectedId, setUserSelectedId] = useState<string | null>(
    initialConversationId,
  );
  const [mobileShowThread, setMobileShowThread] = useState(
    Boolean(initialConversationId),
  );
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
  const [bulkAssignIds, setBulkAssignIds] = useState<string[] | null>(null);
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  // Data loading via shared useData hook (matching OverviewScreen pattern)
  const metaState = useData(
    () => getInboxMeta(workspaceId),
    ['inbox-meta', workspaceId],
  );
  const listState = useData(
    () => listInboxConversations(workspaceId, 0, PAGE_SIZE * pageCount),
    ['inbox-list', workspaceId, pageCount],
  );

  const meta = metaState.data ?? null;
  const conversations = useMemo(
    () => listState.data?.conversations ?? [],
    [listState.data],
  );
  const hasMore = listState.data?.hasMore ?? false;

  const agentsById = useMemo(() => {
    if (!meta) return EMPTY_MAP;
    const map: Record<string, InboxAgent> = {};
    for (const a of meta.agents) map[a.id] = a;
    return map;
  }, [meta]);

  const viewCounts = useMemo(
    () => computeInboxViewCounts(conversations, agent.id),
    [conversations, agent.id],
  );

  const visibleConversations = useMemo(() => {
    const filtered = filterInboxConversations(conversations, {
      view: activeView,
      currentAgentId: agent.id,
      channel: channelFilter,
      priority: priorityFilter,
      search,
    });
    return sortInboxConversations(filtered, sortBy);
  }, [
    conversations,
    activeView,
    agent.id,
    channelFilter,
    priorityFilter,
    search,
    sortBy,
  ]);

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
    listState.reload();
    if (effectiveSelectedId) {
      detailState.reload();
    }
  }, [listState, detailState, effectiveSelectedId]);

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
        onSelectView={setActiveView}
        counts={viewCounts}
        teamGroups={meta?.teamGroups || []}
        savedFilters={meta?.savedFilters || []}
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
          totalLoaded={conversations.length}
          selectedId={effectiveSelectedId}
          onSelect={handleSelectConversation}
          activeView={activeView}
          onSelectView={setActiveView}
          viewCounts={viewCounts}
          search={search}
          onSearchChange={setSearch}
          searchInputRef={searchInputRef}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          loading={listState.loading && conversations.length === 0}
          refreshing={listState.loading && conversations.length > 0}
          error={listState.error}
          onRetry={listState.reload}
          onRefresh={listState.reload}
          hasMore={hasMore}
          loadingMore={listState.loading && pageCount > 1}
          onLoadMore={() => setPageCount((p) => p + 1)}
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
    </div>
  );
}
