'use client';

/**
 * Center Conversation Workspace (`ConversationThread`) for Desktop (`Inbox.dc.html`)
 * and 390px Mobile single-thread view (`MobileInbox.dc.html`).
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  CornerUpLeft,
  FileText,
  GitMerge,
  Globe,
  Hand,
  Lock,
  MessageSquare,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Segmented,
  SkeletonRows,
  useOrbToast,
  type BadgeTone,
} from '@/components/orbat/primitives';
import { timeAgo } from '@/components/orbat/overview/format';
import {
  assignInboxConversation,
  assignInboxConversationGroup,
  autoAssignInboxConversation,
  claimInboxHandover,
  editInboxMessage,
  generateInboxSummary,
  getLanguageInfo,
  rateInboxBotReply,
  resolveInboxLangGraphApproval,
  returnInboxConversationToAi,
  setInboxLanguageOverride,
  snoozeInboxConversation,
  SUPPORTED_LANGUAGES,
  updateInboxConversationPriority,
  updateInboxConversationTags,
  type InboxAgent,
  type InboxCannedReply,
  type InboxConversationDetail,
  type InboxCopilotState,
  type InboxLangGraphApproval,
  type InboxMessageItem,
  type InboxTeamGroup,
} from '@/lib/data/inbox';
import { cn, formatTime } from '@/lib/utils';
import type { ConversationPriority } from '@/types/database';
import { InboxComposer } from './InboxComposer';

type ThreadMenu = 'assign' | 'group' | 'priority' | 'snooze' | 'more' | null;
type CenterTab = 'messages' | 'timeline';

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday';
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function priorityBadgeTone(p: ConversationPriority): BadgeTone {
  switch (p) {
    case 'urgent':
      return 'bad';
    case 'high':
      return 'warn';
    case 'normal':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function LangGraphApprovalCard({
  workspaceId,
  conversationId,
  messageId,
  approval,
  createdAt,
  onResolved,
}: {
  workspaceId: string;
  conversationId: string;
  messageId?: string | null;
  approval: InboxLangGraphApproval;
  createdAt: string;
  onResolved: () => Promise<void>;
}) {
  const toast = useOrbToast();
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(approval.finalReply || approval.draftReply);
  const [submitting, setSubmitting] = useState<'approve' | 'edit' | 'reject' | null>(null);

  const handleDecision = async (approved: boolean, isEdited = false) => {
    setSubmitting(!approved ? 'reject' : isEdited ? 'edit' : 'approve');
    try {
      await resolveInboxLangGraphApproval(workspaceId, {
        conversationId,
        messageId: messageId ?? undefined,
        threadId: approval.threadId,
        approved,
        editedReply: approved ? draft : null,
      });
      toast.show({
        message: approved
          ? isEdited
            ? 'Edited AI reply approved and sent'
            : 'AI reply approved and delivered'
          : 'AI draft rejected and conversation assigned for human takeover',
        tone: 'ok',
      });
      setEditing(false);
      await onResolved();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Approval action failed',
        tone: 'bad',
      });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-[14px] border border-o-border bg-o-surface p-3.5 text-o-text shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
          <Bot className="h-3.5 w-3.5 text-o-accent" aria-hidden="true" />
          Agent Approval · {approval.agentName}
          <Badge tone="neutral">{approval.topic}</Badge>
          <Badge
            tone={
              approval.status === 'approved'
                ? 'ok'
                : approval.status === 'rejected'
                  ? 'bad'
                  : 'warn'
            }
          >
            {approval.status === 'approved'
              ? 'Approved & Sent'
              : approval.status === 'rejected'
                ? 'Rejected · Human Takeover'
                : `Waiting Approval · Level ${approval.autonomyLevel}`}
          </Badge>
        </span>
        <span className="text-[11px] text-o-text-3">{formatTime(createdAt)}</span>
      </div>

      <p className="mt-1.5 text-[12px] text-o-text-2">{approval.reason}</p>

      {approval.pendingActions.length > 0 && (
        <div className="mt-2 rounded-[10px] border border-o-border bg-o-bg px-2.5 py-2">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-o-text-3">
            Staged Workflow Actions
          </div>
          <ul className="mt-1 space-y-1 text-[12px] text-o-text-2">
            {approval.pendingActions.map((act, idx) => (
              <li key={`${act.toolName}-${idx}`} className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 shrink-0 text-o-accent" aria-hidden="true" />
                <span>{act.summary || act.toolName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {approval.status === 'pending' ? (
        <div className="mt-2.5 space-y-2.5">
          {editing ? (
            <textarea
              ref={draftRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              aria-label="Edit proposed AI reply"
              className="w-full rounded-[10px] border border-o-border bg-o-bg px-3 py-2 text-[13px] leading-relaxed text-o-text focus:border-o-accent focus:outline-none"
            />
          ) : (
            <div className="rounded-[10px] border border-o-border bg-o-bg px-3 py-2 text-[13px] leading-relaxed text-o-text">
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-o-text-3">
                Proposed reply draft
              </div>
              <p className="whitespace-pre-wrap break-words">
                {draft || 'No draft text generated yet — click Edit & Send to compose.'}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={submitting !== null}
              onClick={() => void handleDecision(false)}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {submitting === 'reject' ? 'Taking over…' : 'Reject & Take Over'}
            </Button>
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={submitting !== null}
                  onClick={() => {
                    setDraft(approval.finalReply || approval.draftReply);
                    setEditing(false);
                  }}
                >
                  Cancel edit
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={submitting !== null || !draft.trim()}
                  onClick={() => void handleDecision(true, true)}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {submitting === 'edit' ? 'Sending…' : 'Edit & Send'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={submitting !== null}
                  onClick={() => {
                    setEditing(true);
                    requestAnimationFrame(() => draftRef.current?.focus());
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit & Send
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={submitting !== null || !draft.trim()}
                  onClick={() => void handleDecision(true, false)}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {submitting === 'approve' ? 'Sending…' : 'Approve & Send'}
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        draft && (
          <p className="mt-2 whitespace-pre-wrap break-words rounded-[10px] bg-o-bg px-3 py-2 text-[12.5px] text-o-text-2">
            {draft}
          </p>
        )
      )}
    </div>
  );
}

export function ConversationThread({
  workspaceId,
  detail,
  loading,
  error,
  onRetry,
  agents,
  teamGroups = [],
  cannedReplies,
  copilotState,
  contextOpen,
  onToggleContext,
  onBackToList,
  onRefresh,
  onRefreshCopilot,
  composerMode,
  onComposerModeChange,
  composerText,
  onComposerTextChange,
  composerRef,
  onResolveToggle,
  resolving,
  onOpenCustomSnooze,
  onOpenMerge,
  onOpenCreateTicket,
  onRequestDeleteMessage,
}: {
  workspaceId: string;
  detail: InboxConversationDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  agents: InboxAgent[];
  teamGroups?: InboxTeamGroup[];
  cannedReplies: InboxCannedReply[];
  copilotState: InboxCopilotState | null;
  contextOpen: boolean;
  onToggleContext: () => void;
  onBackToList: () => void;
  onRefresh: () => Promise<void>;
  onRefreshCopilot: () => Promise<void>;
  composerMode: 'reply' | 'note';
  onComposerModeChange: (mode: 'reply' | 'note') => void;
  composerText: string;
  onComposerTextChange: (val: string) => void;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onResolveToggle: () => Promise<void>;
  resolving: boolean;
  onOpenCustomSnooze: () => void;
  onOpenMerge: () => void;
  onOpenCreateTicket: () => void;
  onRequestDeleteMessage: (messageId: string) => void;
}) {
  const toast = useOrbToast();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  const [centerTab, setCenterTab] = useState<CenterTab>('messages');
  const [openMenu, setOpenMenu] = useState<ThreadMenu>(null);
  const [handoffCollapsed, setHandoffCollapsed] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [replyTo, setReplyTo] = useState<InboxMessageItem | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [ratingBusyId, setRatingBusyId] = useState<string | null>(null);

  const conversation = detail?.conversation || null;
  const messages = useMemo(() => detail?.messages ?? [], [detail?.messages]);

  // Scroll to bottom when messages change on initial thread or send
  const msgCount = messages.length;
  useEffect(() => {
    if (centerTab !== 'messages' || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation?.id, msgCount, centerTab]);

  // Outside click & Escape to close header menus
  useEffect(() => {
    if (!openMenu) return;
    const handlePointer = (e: MouseEvent) => {
      if (
        menuRootRef.current &&
        !menuRootRef.current.contains(e.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [openMenu]);

  const messagesById = useMemo(() => {
    const map: Record<string, InboxMessageItem> = {};
    for (const m of messages) map[m.id] = m;
    return map;
  }, [messages]);

  const anyTranslated = useMemo(
    () =>
      messages.some(
        (m) =>
          m.translation &&
          (m.translation.englishText || m.translation.originalAgentInput),
      ),
    [messages],
  );

  // Empty selection desktop placeholder
  if (!detail && !loading && !error) {
    return (
      <main
        aria-label="Conversation thread"
        className="flex h-full min-w-0 flex-1 items-center justify-center bg-o-bg p-6"
      >
        <EmptyState
          title="Select a conversation"
          body="Pick a thread from the list or press J / K to move between conversations."
          icon={<MessageSquare className="h-5 w-5" />}
        />
      </main>
    );
  }

  if (loading && !detail) {
    return (
      <main
        aria-label="Conversation thread"
        className="flex h-full min-w-0 flex-1 flex-col bg-o-bg p-6"
      >
        <SkeletonRows rows={7} label="Loading conversation" />
      </main>
    );
  }

  if (error && !detail) {
    return (
      <main
        aria-label="Conversation thread"
        className="flex h-full min-w-0 flex-1 items-center justify-center bg-o-bg p-6"
      >
        <ErrorState
          title="Couldn't load thread"
          body={error}
          onRetry={onRetry}
          className="max-w-md"
        />
      </main>
    );
  }

  if (!detail || !conversation) return null;

  const isClosed = conversation.status === 'closed';
  const isSnoozed = conversation.status === 'snoozed';
  const copilotSummary =
    copilotState?.summary || conversation.copilotSummary || null;
  const showHandoffBanner = Boolean(
    conversation.waitingForPerson ||
      conversation.handoffSummary ||
      conversation.handoffReasonLabel ||
      copilotSummary ||
      conversation.summary,
  );
  const sentiment =
    copilotState?.nextSteps?.sentiment || conversation.sentiment || null;

  const handleAssign = async (agentId: string | null) => {
    setOpenMenu(null);
    setActionBusy(true);
    try {
      await assignInboxConversation(workspaceId, conversation.id, agentId);
      await onRefresh();
      toast.show({
        message: agentId ? 'Assignee updated.' : 'Conversation unassigned.',
        tone: 'ok',
      });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Assign failed.',
        tone: 'bad',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleAutoAssign = async () => {
    setOpenMenu(null);
    setActionBusy(true);
    try {
      const assignedName = await autoAssignInboxConversation(
        workspaceId,
        conversation.id,
      );
      await onRefresh();
      toast.show({
        message: assignedName
          ? `Assigned to ${assignedName}.`
          : 'No online teammate available for auto-assign.',
        tone: assignedName ? 'ok' : 'info',
      });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Auto-assign failed.',
        tone: 'bad',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handlePriority = async (priority: ConversationPriority) => {
    setOpenMenu(null);
    setActionBusy(true);
    try {
      await updateInboxConversationPriority(
        workspaceId,
        conversation.id,
        priority,
      );
      await onRefresh();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Priority update failed.',
        tone: 'bad',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleQuickSnooze = async (minutes: number) => {
    setOpenMenu(null);
    setActionBusy(true);
    try {
      const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      await snoozeInboxConversation(conversation.id, until);
      await onRefresh();
      toast.show({ message: 'Conversation snoozed.', tone: 'ok' });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Snooze failed.',
        tone: 'bad',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleSnoozeTomorrowMorning = async () => {
    setOpenMenu(null);
    setActionBusy(true);
    try {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      await snoozeInboxConversation(conversation.id, d.toISOString());
      await onRefresh();
      toast.show({ message: 'Snoozed until tomorrow 9:00 AM.', tone: 'ok' });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Snooze failed.',
        tone: 'bad',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleClaim = async () => {
    setOpenMenu(null);
    setActionBusy(true);
    try {
      const res = await claimInboxHandover(conversation.id);
      if (!res.ok) {
        toast.show({
          message: res.message || 'Could not claim handover.',
          tone: 'info',
        });
      } else {
        toast.show({ message: 'Conversation claimed.', tone: 'ok' });
      }
      await onRefresh();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Claim failed.',
        tone: 'bad',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleReturnToAi = async () => {
    setOpenMenu(null);
    setActionBusy(true);
    try {
      await returnInboxConversationToAi(conversation.id);
      await onRefresh();
      toast.show({ message: 'Returned conversation to AI.', tone: 'ok' });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Failed to hand back to AI.',
        tone: 'bad',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkSpam = async () => {
    setOpenMenu(null);
    setActionBusy(true);
    try {
      const tags = conversation.tags.includes('spam')
        ? conversation.tags
        : [...conversation.tags, 'spam'];
      await updateInboxConversationTags(workspaceId, conversation.id, tags);
      if (!isClosed) await onResolveToggle();
      else await onRefresh();
      toast.show({ message: 'Marked as spam.', tone: 'ok' });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Action failed.',
        tone: 'bad',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveEdit = async (messageId: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    try {
      await editInboxMessage(workspaceId, conversation.id, messageId, trimmed);
      setEditingMsgId(null);
      await onRefresh();
      toast.show({ message: 'Message updated.', tone: 'ok' });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Edit failed.',
        tone: 'bad',
      });
    }
  };

  const handleRefreshSummary = async () => {
    setSummaryBusy(true);
    try {
      const res = await generateInboxSummary(workspaceId, conversation.id, true);
      if (!res.ok) {
        toast.show({
          message: res.error || 'Could not refresh summary.',
          tone: 'bad',
        });
      } else {
        await Promise.all([onRefresh(), onRefreshCopilot()]);
      }
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Summary failed.',
        tone: 'bad',
      });
    } finally {
      setSummaryBusy(false);
    }
  };

  const handleRateBot = async (
    messageId: string,
    rating: 'helpful' | 'not_helpful',
  ) => {
    setRatingBusyId(messageId);
    try {
      await rateInboxBotReply(workspaceId, messageId, rating);
      await onRefresh();
      toast.show({
        message:
          rating === 'helpful'
            ? 'Marked AI reply helpful.'
            : 'Flagged AI reply for review.',
        tone: 'ok',
      });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Feedback failed.',
        tone: 'bad',
      });
    } finally {
      setRatingBusyId(null);
    }
  };

  const handleAssignGroup = async (groupId: string | null) => {
    setOpenMenu(null);
    setActionBusy(true);
    try {
      await assignInboxConversationGroup(workspaceId, conversation.id, groupId);
      toast.show({
        message: groupId ? 'Assigned to team inbox.' : 'Removed team inbox assignment.',
        tone: 'ok',
      });
      await onRefresh();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Team group update failed.',
        tone: 'bad',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const activeLangInfo = getLanguageInfo(detail.activeLanguageCode);
  const currentGroup = conversation.groupId
    ? teamGroups.find((g) => g.id === conversation.groupId) || null
    : null;
  const aiChipParts: string[] = [];
  if (detail.aiAgentName) aiChipParts.push(detail.aiAgentName);
  if (detail.aiConfidencePercent !== null) {
    aiChipParts.push(`${detail.aiConfidencePercent}% conf`);
  }
  if (detail.aiCostUsd !== null) {
    aiChipParts.push(
      detail.aiCostUsd < 0.01
        ? `$${detail.aiCostUsd.toFixed(4)}`
        : `$${detail.aiCostUsd.toFixed(2)}`,
    );
  }
  const showAiChip = aiChipParts.length > 0 || Boolean(detail.aiEngineUsed);
  const aiChipText =
    aiChipParts.length > 0 ? aiChipParts.join(' · ') : detail.aiEngineUsed || 'AI';
  const hasInlinePendingApproval = messages.some(
    (m) => m.isInternal && m.langgraphApproval?.status === 'pending',
  );

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-o-bg">
      {/* Top Thread Header */}
      <header
        ref={menuRootRef}
        className="relative flex flex-none flex-wrap items-center justify-between gap-2 border-b border-o-border bg-o-surface px-3 py-2.5 sm:px-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToList}
            aria-label="Back to conversation list"
            className="o-focus inline-flex h-8 w-8 flex-none items-center justify-center rounded-full border border-o-border text-o-text hover:bg-o-surface-2 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <Avatar
            name={conversation.visitorName}
            size={36}
            presence={conversation.visitorOnline ? 'online' : undefined}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-[14.5px] font-semibold text-o-text">
                {conversation.visitorName}
              </h2>
              <Badge tone="neutral">{conversation.channelName}</Badge>
              {conversation.priority !== 'normal' && (
                <Badge tone={priorityBadgeTone(conversation.priority)}>
                  {conversation.priority}
                </Badge>
              )}
              {isSnoozed && <Badge tone="neutral">Snoozed</Badge>}
              {isClosed && <Badge tone="ok">Resolved</Badge>}
              {currentGroup && <Badge tone="neutral">{currentGroup.name}</Badge>}
              {showAiChip && (
                <span
                  title={`Engine: ${detail.aiEngineUsed || 'AI Router'}${detail.aiCostUsd !== null ? ` · Total cost $${detail.aiCostUsd.toFixed(6)}` : ''}`}
                >
                  <Badge tone="ai">{aiChipText}</Badge>
                </span>
              )}
              {detail.linkedTicket && (
                <Link
                  href="/app/tickets"
                  className="inline-flex items-center gap-1 rounded-full border border-o-border bg-o-surface-2 px-2 py-0.5 text-[11px] font-medium text-o-text-2 hover:text-o-text"
                >
                  <Ticket className="h-3 w-3" />#{detail.linkedTicket.number}
                </Link>
              )}
            </div>

            <p className="truncate text-[12px] text-o-text-3">
              {conversation.visitorEmail ||
                (conversation.visitorOnline
                  ? 'Active now'
                  : conversation.visitorLastSeenAt
                    ? `Last seen ${timeAgo(conversation.visitorLastSeenAt)}`
                    : `ID ${conversation.id.slice(0, 8)}`)}
              {conversation.assignedAgentName
                ? ` · Assigned to ${conversation.assignedAgentName}`
                : ' · Unassigned'}
            </p>
          </div>
        </div>

        {/* Center view switch & Header actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented<CenterTab>
            label="Thread view"
            value={centerTab}
            onChange={setCenterTab}
            items={[
              { id: 'messages', label: 'Messages' },
              { id: 'timeline', label: 'Timeline' },
            ]}
          />

          {/* Assignee menu */}
          <div className="relative">
            <Button
              size="sm"
              variant="secondary"
              disabled={actionBusy}
              onClick={() =>
                setOpenMenu((m) => (m === 'assign' ? null : 'assign'))
              }
              leading={<UserPlus className="h-3.5 w-3.5" />}
              trailing={<ChevronDown className="h-3 w-3 opacity-70" />}
            >
              <span className="hidden sm:inline">
                {conversation.assignedAgentName || 'Assign'}
              </span>
            </Button>

            {openMenu === 'assign' && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+6px)] z-30 w-60 rounded-[14px] border border-o-border bg-o-surface p-1.5 shadow-[var(--shadow-lg)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleAutoAssign()}
                  className="o-focus flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[12.5px] font-semibold text-o-accent-text hover:bg-o-accent-soft"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-assign available teammate
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleAssign(null)}
                  className="o-focus flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-[12.5px] text-o-text-2 hover:bg-o-surface-2"
                >
                  <span>Unassigned</span>
                  {!conversation.assignedAgentId && <Check className="h-3.5 w-3.5" />}
                </button>
                <div className="my-1 border-t border-o-border" />
                <div className="max-h-52 overflow-y-auto">
                  {agents
                    .filter((a) => a.isActive)
                    .map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        role="menuitem"
                        onClick={() => void handleAssign(a.id)}
                        className="o-focus flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text hover:bg-o-surface-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar
                            name={a.name}
                            src={a.avatarUrl}
                            size={22}
                            presence={
                              a.status === 'online' || a.status === 'away'
                                ? a.status
                                : 'offline'
                            }
                          />
                          <span className="truncate">{a.name}</span>
                        </span>
                        {conversation.assignedAgentId === a.id && (
                          <Check className="h-3.5 w-3.5 flex-none text-o-accent-text" />
                        )}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Team Inbox group picker */}
          {teamGroups.length > 0 && (
            <div className="relative hidden md:block">
              <Button
                size="sm"
                variant="secondary"
                disabled={actionBusy}
                onClick={() =>
                  setOpenMenu((m) => (m === 'group' ? null : 'group'))
                }
                leading={<Users className="h-3.5 w-3.5" />}
                trailing={<ChevronDown className="h-3 w-3 opacity-70" />}
              >
                <span className="max-w-[92px] truncate">
                  {currentGroup ? currentGroup.name : 'Team'}
                </span>
              </Button>
              {openMenu === 'group' && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 rounded-[14px] border border-o-border bg-o-surface p-1.5 shadow-[var(--shadow-lg)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleAssignGroup(null)}
                    className="o-focus flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text-2 hover:bg-o-surface-2"
                  >
                    <span>No team inbox</span>
                    {!conversation.groupId && (
                      <Check className="h-3.5 w-3.5 text-o-accent-text" />
                    )}
                  </button>
                  <div className="my-1 border-t border-o-border" />
                  <div className="max-h-52 overflow-y-auto">
                    {teamGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        role="menuitem"
                        onClick={() => void handleAssignGroup(g.id)}
                        className="o-focus flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text hover:bg-o-surface-2"
                      >
                        <span className="truncate">{g.name}</span>
                        {conversation.groupId === g.id && (
                          <Check className="h-3.5 w-3.5 flex-none text-o-accent-text" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Priority picker */}
          <div className="relative hidden md:block">
            <Button
              size="sm"
              variant="secondary"
              disabled={actionBusy}
              onClick={() =>
                setOpenMenu((m) => (m === 'priority' ? null : 'priority'))
              }
              trailing={<ChevronDown className="h-3 w-3 opacity-70" />}
            >
              Priority
            </Button>
            {openMenu === 'priority' && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+6px)] z-30 w-44 rounded-[14px] border border-o-border bg-o-surface p-1.5 shadow-[var(--shadow-lg)]"
              >
                {(['urgent', 'high', 'normal', 'low'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="menuitem"
                    onClick={() => void handlePriority(p)}
                    className="o-focus flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] capitalize text-o-text hover:bg-o-surface-2"
                  >
                    <span>{p}</span>
                    {conversation.priority === p && (
                      <Check className="h-3.5 w-3.5 text-o-accent-text" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Snooze picker */}
          <div className="relative hidden sm:block">
            <Button
              size="sm"
              variant="secondary"
              icon
              disabled={actionBusy}
              onClick={() =>
                setOpenMenu((m) => (m === 'snooze' ? null : 'snooze'))
              }
              aria-label="Snooze conversation"
            >
              <Clock className="h-3.5 w-3.5" />
            </Button>
            {openMenu === 'snooze' && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 rounded-[14px] border border-o-border bg-o-surface p-1.5 shadow-[var(--shadow-lg)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleQuickSnooze(30)}
                  className="o-focus flex w-full rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text hover:bg-o-surface-2"
                >
                  30 minutes
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleQuickSnooze(120)}
                  className="o-focus flex w-full rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text hover:bg-o-surface-2"
                >
                  2 hours
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSnoozeTomorrowMorning()}
                  className="o-focus flex w-full rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text hover:bg-o-surface-2"
                >
                  Tomorrow 9:00 AM
                </button>
                <div className="my-1 border-t border-o-border" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenCustomSnooze();
                  }}
                  className="o-focus flex w-full rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] font-medium text-o-accent-text hover:bg-o-accent-soft"
                >
                  Custom date & time…
                </button>
              </div>
            )}
          </div>

          {/* Overflow actions */}
          <div className="relative">
            <Button
              size="sm"
              variant="secondary"
              icon
              disabled={actionBusy}
              onClick={() =>
                setOpenMenu((m) => (m === 'more' ? null : 'more'))
              }
              aria-label="More conversation actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {openMenu === 'more' && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 rounded-[14px] border border-o-border bg-o-surface p-1.5 shadow-[var(--shadow-lg)]"
              >
                {conversation.waitingForPerson && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleClaim()}
                    className="o-focus flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] font-semibold text-o-accent-text hover:bg-o-accent-soft"
                  >
                    <Hand className="h-3.5 w-3.5" />
                    Claim handover
                  </button>
                )}
                {conversation.aiMode !== 'autopilot' && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleReturnToAi()}
                    className="o-focus flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text hover:bg-o-surface-2"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    Return to AI
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenCustomSnooze();
                  }}
                  className="o-focus flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text hover:bg-o-surface-2 sm:hidden"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Snooze…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenMerge();
                  }}
                  className="o-focus flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text hover:bg-o-surface-2"
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  Merge thread…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenCreateTicket();
                  }}
                  className="o-focus flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text hover:bg-o-surface-2"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  Create ticket…
                </button>
                <div className="my-1 border-t border-o-border" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleMarkSpam()}
                  className="o-focus flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-bad hover:bg-o-surface-2"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Mark as spam
                </button>
              </div>
            )}
          </div>

          {/* Toggle Context Drawer */}
          <Button
            size="sm"
            variant="secondary"
            icon
            onClick={onToggleContext}
            aria-expanded={contextOpen}
            aria-label={contextOpen ? 'Hide customer context' : 'Show customer context'}
          >
            {contextOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>

          {/* Primary Resolve / Reopen */}
          <Button
            size="sm"
            variant={isClosed ? 'secondary' : 'primary'}
            loading={resolving}
            onClick={() => void onResolveToggle()}
            leading={
              isClosed ? (
                <RotateCcw className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )
            }
          >
            {isClosed ? 'Reopen' : 'Resolve'}
          </Button>
        </div>
      </header>

      {/* Collapsible Smart Handoff / AI Summary Card */}
      {showHandoffBanner && (
        <div className="flex-none border-b border-o-ai/20 bg-o-ai-soft px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setHandoffCollapsed((c) => !c)}
              aria-expanded={!handoffCollapsed}
              className="o-focus flex min-w-0 items-center gap-2 rounded-md text-left"
            >
              <Sparkles
                className="h-4 w-4 flex-none text-o-ai-text"
                aria-hidden="true"
              />
              <span className="text-[12.5px] font-semibold text-o-ai-text">
                {conversation.waitingForPerson
                  ? 'Smart handover'
                  : 'Conversation summary'}
              </span>
              {conversation.handoffReasonLabel && (
                <Badge tone="warn">{conversation.handoffReasonLabel}</Badge>
              )}
              {sentiment && (
                <Badge
                  tone={
                    sentiment === 'urgent' || sentiment === 'negative'
                      ? 'bad'
                      : sentiment === 'positive'
                        ? 'ok'
                        : 'neutral'
                  }
                >
                  {sentiment}
                </Badge>
              )}
              {handoffCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5 text-o-ai-text" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5 text-o-ai-text" />
              )}
            </button>

            <div className="flex items-center gap-1.5">
              {conversation.waitingForPerson && (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={actionBusy}
                  onClick={() => void handleClaim()}
                >
                  Claim
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                loading={summaryBusy}
                onClick={() => void handleRefreshSummary()}
              >
                {copilotSummary ? 'Refresh' : 'Summarize'}
              </Button>
            </div>
          </div>

          {!handoffCollapsed && (
            <div className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-o-text">
              {copilotSummary ? (
                <div className="grid gap-1 sm:grid-cols-2">
                  <p>
                    <strong className="font-semibold">Issue:</strong>{' '}
                    {copilotSummary.issue}
                  </p>
                  <p>
                    <strong className="font-semibold">Next action:</strong>{' '}
                    {copilotSummary.pending_action}
                  </p>
                </div>
              ) : (
                <p>
                  {conversation.handoffSummary || conversation.summary}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Language / Translation Strip */}
      {(anyTranslated || detail.activeLanguageCode !== 'en') && (
        <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-b border-o-border bg-o-surface px-3 py-1.5 text-[12px] sm:px-4">
          <div className="flex items-center gap-2 text-o-text-2">
            <Globe className="h-3.5 w-3.5 text-o-accent-text" />
            <span>
              Customer language: <strong className="text-o-text">{activeLangInfo.name}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {anyTranslated && (
              <button
                type="button"
                onClick={() => setShowOriginal((v) => !v)}
                className="o-focus rounded-full border border-o-border px-2.5 py-0.5 text-[11.5px] font-medium text-o-accent-text hover:bg-o-surface-2"
              >
                {showOriginal ? 'Show translated' : 'Show original'}
              </button>
            )}
            <select
              aria-label="Conversation language"
              value={detail.activeLanguageCode}
              onChange={async (e) => {
                try {
                  await setInboxLanguageOverride(
                    conversation.id,
                    e.target.value,
                    detail.detectedLanguageCode || undefined,
                  );
                  await onRefresh();
                } catch (err) {
                  toast.show({
                    message:
                      err instanceof Error
                        ? err.message
                        : 'Could not update language.',
                    tone: 'bad',
                  });
                }
              }}
              className="o-input o-select o-input--sm py-0.5 text-[11.5px]"
            >
              {Object.values(SUPPORTED_LANGUAGES)
                .slice(0, 40)
                .map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {/* Body: Messages OR Timeline */}
      {centerTab === 'timeline' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {detail.timeline.length === 0 ? (
            <EmptyState
              title="No timeline activity yet"
              body="Conversation milestones and linked ticket events will appear here."
            />
          ) : (
            <ol className="mx-auto max-w-2xl space-y-3">
              {detail.timeline.map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-start gap-3 rounded-[14px] border border-o-border bg-o-surface px-3.5 py-2.5"
                >
                  <span className="mt-1 h-2 w-2 flex-none rounded-full bg-o-accent-text" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-o-text">
                        {ev.title}
                      </span>
                      <span className="text-[11.5px] tabular-nums text-o-text-3">
                        {formatTime(ev.at)} · {timeAgo(ev.at)}
                      </span>
                    </div>
                    {ev.detail && (
                      <p className="mt-0.5 text-[12.5px] text-o-text-2">
                        {ev.detail}
                      </p>
                    )}
                    {ev.actor && (
                      <p className="mt-0.5 text-[11px] text-o-text-3">
                        Actor: {ev.actor}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mx-auto mt-4 max-w-2xl text-center text-[11.5px] text-o-text-3">
            Detailed rule and bot routing audit logs (`conversation_events`) are not yet exposed per conversation.
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5"
        >
          {messages.length === 0 ? (
            <EmptyState
              title="No messages in this thread yet"
              body="Send a reply or add a private internal note below."
            />
          ) : (
            messages.map((msg, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null;
              const day = formatDayLabel(msg.createdAt);
              const prevDay = prev ? formatDayLabel(prev.createdAt) : null;
              const showDay = day !== prevDay;
              const quoted = msg.replyToMessageId
                ? messagesById[msg.replyToMessageId]
                : null;

              if (msg.senderType === 'system') {
                return (
                  <div key={msg.id} className="space-y-2">
                    {showDay && (
                      <div className="my-2 flex justify-center">
                        <span className="rounded-full border border-o-border bg-o-surface px-3 py-0.5 text-[11px] font-medium text-o-text-3">
                          {day}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-center">
                      <span className="rounded-full bg-o-surface-2 px-3 py-1 text-[11.5px] text-o-text-2">
                        {msg.content} · {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              }

              const isAgent = msg.senderType === 'agent' && !msg.isInternal;
              const isAi = msg.senderType === 'ai' && !msg.isInternal;
              const isVisitor = msg.senderType === 'visitor' && !msg.isInternal;

              // Displayed text: English translation for foreign visitor messages unless showOriginal is active
              let displayText = msg.content;
              let subNote: string | null = null;
              if (msg.translation) {
                if (isVisitor && msg.translation.englishText) {
                  displayText = showOriginal
                    ? msg.content
                    : msg.translation.englishText;
                  subNote = showOriginal
                    ? 'Showing original language'
                    : 'Translated to English';
                } else if (isAgent && msg.translation.originalAgentInput) {
                  displayText = showOriginal
                    ? msg.content
                    : msg.translation.originalAgentInput;
                  subNote = showOriginal
                    ? `Sent in ${msg.translation.targetLanguage || 'visitor language'}`
                    : 'Shown in your original English';
                }
              }

              return (
                <div key={msg.id} className="space-y-2">
                  {showDay && (
                    <div className="my-2 flex justify-center">
                      <span className="rounded-full border border-o-border bg-o-surface px-3 py-0.5 text-[11px] font-medium text-o-text-3">
                        {day}
                      </span>
                    </div>
                  )}

                  {msg.isInternal && msg.langgraphApproval ? (
                    <LangGraphApprovalCard
                      workspaceId={workspaceId}
                      conversationId={msg.conversationId}
                      messageId={msg.id}
                      approval={msg.langgraphApproval}
                      createdAt={msg.createdAt}
                      onResolved={onRefresh}
                    />
                  ) : msg.isInternal ? (
                    <div className="mx-auto max-w-2xl rounded-[14px] border border-o-note-border bg-o-note px-3.5 py-2.5 text-o-text">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          Internal note · {msg.senderName}
                        </span>
                        <span className="text-[11px] text-o-text-2">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                        {displayText}
                      </p>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'group flex items-end gap-2',
                        isAgent ? 'justify-end' : 'justify-start',
                      )}
                    >
                      {!isAgent && (
                        <Avatar
                          name={msg.senderName}
                          size={28}
                          ai={isAi}
                        />
                      )}

                      <div
                        className={cn(
                          'flex max-w-[85%] flex-col sm:max-w-[72%]',
                          isAgent ? 'items-end' : 'items-start',
                        )}
                      >
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] text-o-text-3">
                          <span className="font-medium text-o-text-2">
                            {msg.senderName}
                          </span>
                          {isAi && <Badge tone="ai">AI</Badge>}
                          <span>{formatTime(msg.createdAt)}</span>
                          {msg.editedAt && <span>(edited)</span>}
                        </div>

                        {editingMsgId === msg.id ? (
                          <div className="w-full min-w-[240px] rounded-[14px] border border-o-border bg-o-surface p-2.5">
                            <textarea
                              rows={3}
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="o-textarea w-full text-[13px]"
                            />
                            <div className="mt-2 flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setEditingMsgId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => void handleSaveEdit(msg.id)}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'rounded-[16px] px-3.5 py-2.5 text-[13.5px] leading-relaxed',
                              isAgent
                                ? 'o-bubble-agent rounded-br-[4px]'
                                : isAi
                                  ? 'rounded-bl-[4px] border border-o-ai/25 bg-o-surface text-o-text'
                                  : 'rounded-bl-[4px] border border-o-border bg-o-surface text-o-text',
                            )}
                          >
                            {quoted && (
                              <div
                                className={cn(
                                  'mb-2 rounded-[8px] border-l-2 px-2 py-1 text-[11.5px]',
                                  isAgent
                                    ? 'o-bubble-quote-agent'
                                    : 'border-o-accent-text bg-o-surface-2 text-o-text-2',
                                )}
                              >
                                <div className="font-semibold">
                                  {quoted.senderName}
                                </div>
                                <div className="line-clamp-1">{quoted.content}</div>
                              </div>
                            )}

                            {msg.attachmentUrl && (
                              <div className="mb-2">
                                {msg.attachmentIsImage ? (
                                  <a
                                    href={msg.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block overflow-hidden rounded-[10px]"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={msg.attachmentUrl}
                                      alt="Message attachment"
                                      className="max-h-60 w-auto rounded-[10px] object-cover"
                                    />
                                  </a>
                                ) : msg.attachmentIsAudio ? (
                                  <div className="rounded-[10px] border border-o-border bg-o-surface-2 px-2.5 py-2">
                                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-o-text-2">
                                      <span>Voice note</span>
                                      {msg.audioDurationSec != null && (
                                        <span className="tabular-nums text-o-text-3">
                                          {msg.audioDurationSec}s
                                        </span>
                                      )}
                                    </div>
                                    <audio
                                      controls
                                      preload="metadata"
                                      src={msg.attachmentUrl}
                                      className="h-8 w-56 max-w-full"
                                    />
                                  </div>
                                ) : (
                                  <a
                                    href={msg.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-o-border bg-o-surface-2 px-2.5 py-1.5 text-[12px] font-medium text-o-text underline"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    Open attachment
                                  </a>
                                )}
                              </div>
                            )}

                            {displayText && (
                              <p className="whitespace-pre-wrap break-words">
                                {displayText}
                              </p>
                            )}

                            {subNote && (
                              <p
                                className={cn(
                                  'mt-1 text-[11px]',
                                  isAgent
                                    ? 'o-bubble-meta-agent'
                                    : 'text-o-text-3',
                                )}
                              >
                                {subNote}
                              </p>
                            )}

                            {msg.sources.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1 border-t border-o-border pt-2">
                                {msg.sources.map((src) => (
                                  <Badge key={src.id} tone="ai">
                                    {src.title}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {msg.channelStatus === 'failed' && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-o-bad">
                            <AlertTriangle className="h-3 w-3" />
                            {msg.channelError || 'Channel delivery failed'}
                          </p>
                        )}

                        {/* Message actions row */}
                        <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              onComposerModeChange('reply');
                              setReplyTo(msg);
                              requestAnimationFrame(() =>
                                composerRef.current?.focus(),
                              );
                            }}
                            aria-label="Quote reply"
                            title="Quote reply"
                            className="o-focus rounded p-1 text-o-text-3 hover:bg-o-surface-2 hover:text-o-text"
                          >
                            <CornerUpLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard?.writeText(displayText);
                              toast.show({
                                message: 'Copied message.',
                                tone: 'ok',
                              });
                            }}
                            aria-label="Copy message"
                            title="Copy"
                            className="o-focus rounded p-1 text-o-text-3 hover:bg-o-surface-2 hover:text-o-text"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {isAi && (
                            <>
                              <button
                                type="button"
                                disabled={ratingBusyId === msg.id}
                                onClick={() =>
                                  void handleRateBot(msg.id, 'helpful')
                                }
                                aria-label="Mark AI reply helpful"
                                className={cn(
                                  'o-focus rounded p-1 hover:bg-o-surface-2',
                                  msg.botRating === 'helpful'
                                    ? 'text-o-ok'
                                    : 'text-o-text-3 hover:text-o-text',
                                )}
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={ratingBusyId === msg.id}
                                onClick={() =>
                                  void handleRateBot(msg.id, 'not_helpful')
                                }
                                aria-label="Mark AI reply unhelpful"
                                className={cn(
                                  'o-focus rounded p-1 hover:bg-o-surface-2',
                                  msg.botRating === 'not_helpful'
                                    ? 'text-o-bad'
                                    : 'text-o-text-3 hover:text-o-text',
                                )}
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {isAgent && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMsgId(msg.id);
                                  setEditingText(msg.content);
                                }}
                                aria-label="Edit message"
                                title="Edit"
                                className="o-focus rounded p-1 text-o-text-3 hover:bg-o-surface-2 hover:text-o-text"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRequestDeleteMessage(msg.id)}
                                aria-label="Delete message"
                                title="Delete"
                                className="o-focus rounded p-1 text-o-text-3 hover:bg-o-surface-2 hover:text-o-bad"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {detail.pendingApprovalRun && !hasInlinePendingApproval && (
            <LangGraphApprovalCard
              workspaceId={workspaceId}
              conversationId={conversation.id}
              approval={{
                runId: detail.pendingApprovalRun.runId,
                threadId: detail.pendingApprovalRun.threadId,
                agentId: detail.pendingApprovalRun.agentId,
                agentName: detail.pendingApprovalRun.agentName,
                topic: detail.pendingApprovalRun.topic,
                autonomyLevel: detail.pendingApprovalRun.autonomyLevel,
                reason: detail.pendingApprovalRun.reason,
                draftReply: detail.pendingApprovalRun.draftReply,
                pendingActions: detail.pendingApprovalRun.pendingActions,
                status: 'pending',
                resolvedBy: null,
                resolvedAt: null,
                finalReply: null,
              }}
              createdAt={detail.pendingApprovalRun.createdAt}
              onResolved={onRefresh}
            />
          )}
        </div>
      )}

      {/* Composer */}
      <InboxComposer
        workspaceId={workspaceId}
        conversation={conversation}
        mode={composerMode}
        onModeChange={onComposerModeChange}
        text={composerText}
        onTextChange={onComposerTextChange}
        textareaRef={composerRef}
        replyTo={replyTo}
        onClearReplyTo={() => setReplyTo(null)}
        agents={agents}
        cannedReplies={cannedReplies}
        activeLanguageCode={detail.activeLanguageCode}
        copilotAvailable={Boolean(copilotState?.availability?.available)}
        onSent={onRefresh}
      />
    </div>
  );
}
