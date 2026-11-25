'use client';

/**
 * Data access, view models, and realtime subscription wrapper for the ORBAT
 * Inbox screen (`/app/inbox`). All inbox actions and API calls flow through
 * this module so UI components stay declarative and backend gaps stay explicit.
 */

import {
  assignConversationGroupAction,
  claimConversationAction,
  deleteConversationViewAction,
  deleteDashboardMessageAction,
  editDashboardMessageAction,
  getConversationAiSummaryAction,
  getDashboardConversationAction,
  getLiveVisitorMetaAction,
  getVisitorLifetimeStatsAction,
  getVisitorSnapshotAction,
  listCannedResponsesAction,
  listConversationViewsAction,
  listDashboardConversationsAction,
  listDashboardMessagesAction,
  listVisitorConversationsAction,
  loadHandoversAction,
  resumeAgentApprovalAction,
  returnToAiAction,
  saveConversationViewAction,
  searchAndFilterConversationsAction,
  sendDashboardMessageAction,
  setConversationLanguageOverrideAction,
  skipConversationAction,
  updateDashboardConversationAction,
  updateVisitorNotesAction,
  bulkUpdateDashboardConversationsAction,
  type ConversationAiSummary,
  type SavedConversationView,
  type SearchInboxCounts,
  type SearchInboxParams,
  type VisitorLifetimeStats,
} from '@/app/actions/inbox';
import {
  askCopilotQuestionAction,
  generateCopilotNextStepsAction,
  generateCopilotSummaryAction,
  getCopilotPanelStateAction,
  recordCopilotDraftDispositionAction,
  recordCopilotFeedbackAction,
  rewriteCopilotTextAction,
  suggestCopilotReplyAction,
  type CopilotPanelState,
} from '@/app/actions/copilot';
import {
  createTicketAction,
  getTicketAction,
  getTicketBarAction,
  getTicketsBootstrapAction,
} from '@/app/actions/tickets';
import { listTagsAction, type WorkspaceTag } from '@/app/actions/tags';
import { rateBotReplyAction } from '@/app/actions/unanswered';
import { errorMessage } from '@/lib/errors/user-error';
import {
  friendlyReason,
  isWaitingForPerson,
  parseHandoverNote,
  type HandoverItem,
} from '@/lib/inbox/handovers';
import { looksLikeImage, uploadChatAttachment } from '@/lib/image-upload';
import {
  getLanguageInfo,
  isLikelyEnglishText,
  isRomanizedText,
  SUPPORTED_LANGUAGES,
  type LanguageInfo,
} from '@/lib/ai/translator-client';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';
import { stripMarkdown } from '@/lib/utils';
import {
  languageLabel,
  localTimeIn,
  parseLocation,
  parseUserAgentDetailed,
  timezoneFrom,
  type LocationInfo,
  type UserAgentInfo,
} from '@/lib/visitor-meta';
import type {
  CannedResponse,
  ChannelType,
  Conversation,
  ConversationPriority,
  ConversationStatus,
  CopilotNextSteps,
  CopilotRewriteMode,
  CopilotSource,
  CopilotSummary,
  Message,
  SenderType,
  TicketChannel,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  Visitor,
  VisitorPageHistory,
} from '@/types/database';
import { channelLabel } from './overview';

export type { LanguageInfo, LocationInfo, UserAgentInfo, WorkspaceTag };
export { SUPPORTED_LANGUAGES, getLanguageInfo };
export { EMOJI_CATEGORIES } from '@/lib/emojis';

/* ── View, filter & sort types ─────────────────────────────────────────── */

export type InboxViewKey =
  | 'open'
  | 'mine'
  | 'unassigned'
  | 'ai'
  | 'waiting'
  | 'waiting_approval'
  | 'snoozed'
  | 'resolved'
  | 'all';

export type { ConversationAiSummary, SavedConversationView, SearchInboxCounts, SearchInboxParams, VisitorLifetimeStats };

export type InboxSortKey = 'newest' | 'waiting' | 'unread' | 'priority';

export type InboxChannelFilter = ChannelType | 'all';

export type InboxPriorityFilter = ConversationPriority | 'all';

export interface InboxConversationItem {
  id: string;
  workspaceId: string;
  visitorId: string;
  visitorName: string;
  visitorEmail: string | null;
  visitorOnline: boolean;
  visitorLastSeenAt: string | null;
  visitorAvatarInitials: string;
  channel: ChannelType;
  channelName: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  groupId: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  unreadCount: number;
  tags: string[];
  aiMode: string;
  aiPausedReason: string | null;
  handoffStatus: string | null;
  waitingForPerson: boolean;
  handoffReason: string | null;
  handoffReasonLabel: string | null;
  handoffSummary: string | null;
  handoffRequestedAt: string | null;
  handoffOfferedAt: string | null;
  firstAgentReplyAt: string | null;
  snoozedUntil: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  lastMessagePreview: string;
  lastMessageSender: SenderType | null;
  lastMessageAt: string | null;
  currentTicketId: string | null;
  summary: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  csatRating: number | null;
  csatFeedback: string | null;
  copilotSummary: CopilotSummary | null;
  copilotNextSteps: CopilotNextSteps | null;
  detectedLanguage: string | null;
  languageOverride: string | null;
  raw: Conversation;
}

export interface InboxMessageTranslation {
  isTranslated: boolean;
  englishText: string | null;
  translatedText: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  originalAgentInput: string | null;
}

export interface InboxLangGraphApproval {
  runId: string | null;
  threadId: string;
  agentId: string | null;
  agentName: string;
  topic: string;
  autonomyLevel: number;
  reason: string;
  draftReply: string;
  pendingActions: Array<{
    toolName: string;
    summary: string;
    args: Record<string, unknown>;
  }>;
  status: 'pending' | 'approved' | 'rejected';
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  finalReply?: string | null;
}

export interface InboxMessageItem {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderId: string | null;
  senderName: string;
  content: string;
  attachmentUrl: string | null;
  attachmentIsImage: boolean;
  attachmentIsAudio: boolean;
  attachmentMimeType: string | null;
  audioDurationSec: number | null;
  isInternal: boolean;
  createdAt: string;
  readAt: string | null;
  deliveredAt: string | null;
  replyToMessageId: string | null;
  editedAt: string | null;
  channelStatus: string | null;
  channelError: string | null;
  botRating: 'helpful' | 'not_helpful' | null;
  sources: CopilotSource[];
  translation: InboxMessageTranslation | null;
  langgraphApproval: InboxLangGraphApproval | null;
  raw: Message;
}

export interface InboxLinkedTicket {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  type: string;
  followUpOfId: string | null;
  parentNumber: number | null;
  slaNextDueAt: string | null;
  slaState: 'running' | 'paused' | 'met' | null;
}

export interface InboxTimelineEvent {
  id: string;
  at: string;
  kind: 'created' | 'handoff' | 'reply' | 'resolved' | 'system' | 'ticket';
  title: string;
  detail: string | null;
  actor: string | null;
}

export interface InboxAgent {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  role: string;
  isActive: boolean;
  maxOpenTickets: number | null;
  openTickets: number;
}

export interface InboxTeamGroup {
  id: string;
  name: string;
  description: string | null;
  memberIds: string[];
}

export type InboxSavedFilter = SavedConversationView;

export interface InboxCannedReply {
  id: string;
  title: string;
  shortcut: string;
  content: string;
}

export interface InboxHelpArticle {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  sectionName: string | null;
}

export interface InboxMeta {
  agents: InboxAgent[];
  teamGroups: InboxTeamGroup[];
  savedFilters: InboxSavedFilter[];
  cannedReplies: InboxCannedReply[];
  workspaceTags: WorkspaceTag[];
  handoversByConversationId: Record<string, HandoverItem>;
}

export interface InboxConversationDetail {
  conversation: InboxConversationItem;
  messages: InboxMessageItem[];
  linkedTicket: InboxLinkedTicket | null;
  ticketEvents: TicketEvent[];
  timeline: InboxTimelineEvent[];
  activeLanguageCode: string;
  detectedLanguageCode: string | null;
  languageOverride: string | null;
  aiCostUsd: number | null;
  aiConfidencePercent: number | null;
  aiAgentName: string | null;
  aiEngineUsed: string | null;
  pendingApprovalRun: ConversationAiSummary['pendingApprovalRun'];
}

export interface InboxCustomerContext {
  visitorId: string | null;
  name: string;
  email: string | null;
  notes: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  firstSeenAt: string | null;
  visitCount: number;
  location: LocationInfo;
  timezone: string | null;
  localTime: string | null;
  browserLanguage: string | null;
  ua: UserAgentInfo;
  currentPageUrl: string | null;
  currentPageTitle: string | null;
  referrerSource: string | null;
  pageHistory: VisitorPageHistory[];
  openTickets: Array<{
    id: string;
    number: number;
    subject: string | null;
    status: string;
  }>;
  pastConversations: Array<{
    id: string;
    channel: ChannelType;
    status: ConversationStatus;
    priority: ConversationPriority;
    updatedAt: string;
    tags: string[];
  }>;
  /**
   * TODO(backend): No e-commerce / Shopify order integration exists yet.
   */
  ordersUnavailableReason: string;
  lifetimeCsatAvg: number | null;
  csatCount: number;
  avgFirstReplySec: number | null;
  totalResolvedCount: number;
  notesEditable: true;
}

export interface InboxCopilotState extends CopilotPanelState {
  loadedAt: string;
}

export interface InboxSuggestReplyResult {
  ok: boolean;
  draft?: string;
  sources?: CopilotSource[];
  knowledgeFound?: boolean;
  noteForAgent?: string | null;
  eventId?: string | null;
  error?: string;
}

/* ── Mapping helpers ───────────────────────────────────────────────────── */

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isImageAttachmentUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (/\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)(\?|#|$)/i.test(url)) return true;
  return url.includes('/image/upload/');
}

function isAudioAttachmentUrl(
  url: string | null | undefined,
  meta: Record<string, unknown> | null | undefined,
): boolean {
  if (!url) return false;
  if (meta?.is_audio === true || meta?.attachment_is_audio === true) return true;
  if (typeof meta?.audio_mime === 'string' && meta.audio_mime.startsWith('audio/')) return true;
  if (typeof meta?.mime_type === 'string' && meta.mime_type.startsWith('audio/')) return true;
  return /\.(webm|m4a|mp3|ogg|oga)(\?|#|$)/i.test(url) || url.includes('/voice_notes/');
}

function previewText(conv: Conversation): string {
  const raw = conv.last_message?.content?.trim();
  if (raw) return stripMarkdown(raw);
  if (conv.last_message?.attachment_url) return 'Sent an attachment';
  if (conv.handoff_summary) return stripMarkdown(conv.handoff_summary);
  return 'No messages yet';
}

export function mapConversationItem(
  conv: Conversation,
  handover?: HandoverItem,
): InboxConversationItem {
  const visitorName =
    conv.visitor?.name?.trim() ||
    conv.visitor?.email?.trim() ||
    conv.customer_email?.trim() ||
    'Anonymous visitor';
  const visitorEmail = conv.visitor?.email?.trim() || conv.customer_email?.trim() || null;
  const meta = (conv.channel_metadata || {}) as Record<string, unknown>;
  const detectedLang =
    typeof meta.detected_language === 'string' && meta.detected_language.trim()
      ? meta.detected_language.trim()
      : null;
  const overrideLang =
    typeof meta.language_override === 'string' && meta.language_override.trim()
      ? meta.language_override.trim()
      : null;

  const waitingForPerson = isWaitingForPerson(conv);
  const parsedNote = conv.handoff_summary ? parseHandoverNote(conv.handoff_summary) : null;
  const rawReason = handover?.reason || conv.handoff_reason || null;
  const rawSummary =
    handover?.summary ||
    parsedNote?.summary ||
    (conv.handoff_summary && !parsedNote ? conv.handoff_summary : null);

  const channel: ChannelType = conv.channel || 'web';
  const lastMessageAt = conv.last_message?.created_at || null;
  const lastActivityAt = lastMessageAt || conv.updated_at || conv.created_at;

  return {
    id: conv.id,
    workspaceId: conv.workspace_id || '',
    visitorId: conv.visitor_id,
    visitorName,
    visitorEmail,
    visitorOnline: Boolean(conv.visitor?.is_online),
    visitorLastSeenAt: conv.visitor?.last_seen_at || conv.customer_last_seen_at || null,
    visitorAvatarInitials: initialsFor(visitorName),
    channel,
    channelName: channelLabel(channel),
    status: conv.status || 'open',
    priority: conv.priority || 'normal',
    groupId: conv.group_id || null,
    assignedAgentId: conv.assigned_agent_id || conv.agent_id || null,
    assignedAgentName: conv.agent?.name || null,
    unreadCount: conv.unread_count || 0,
    tags: Array.isArray(conv.tags) ? conv.tags : [],
    aiMode: conv.ai_mode || 'autopilot',
    aiPausedReason: conv.ai_paused_reason || null,
    handoffStatus: conv.handoff_status || null,
    waitingForPerson,
    handoffReason: rawReason,
    handoffReasonLabel: rawReason ? friendlyReason(rawReason) : null,
    handoffSummary: rawSummary,
    handoffRequestedAt: conv.handoff_requested_at || null,
    handoffOfferedAt: conv.handoff_offered_at || null,
    firstAgentReplyAt: conv.first_agent_reply_at || null,
    snoozedUntil: conv.snoozed_until || null,
    closedAt: conv.closed_at || null,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    lastActivityAt,
    lastMessagePreview: previewText(conv),
    lastMessageSender: conv.last_message?.sender_type || null,
    lastMessageAt,
    currentTicketId: conv.current_ticket_id || null,
    summary: conv.summary || null,
    sentiment: conv.sentiment || null,
    csatRating: typeof conv.csat_rating === 'number' ? conv.csat_rating : null,
    csatFeedback: conv.csat_feedback || null,
    copilotSummary: conv.copilot_summary || null,
    copilotNextSteps: conv.copilot_next_steps || null,
    detectedLanguage: detectedLang,
    languageOverride: overrideLang,
    raw: conv,
  };
}

function parseTranslationMetadata(meta: Record<string, unknown> | null | undefined): InboxMessageTranslation | null {
  if (!meta) return null;
  const nested = (meta.translation && typeof meta.translation === 'object'
    ? meta.translation
    : null) as Record<string, unknown> | null;

  const isTranslated = Boolean(
    nested?.is_translated ?? meta.is_translated ?? meta.english_text ?? meta.translated_text,
  );
  const englishText =
    typeof nested?.english_text === 'string'
      ? nested.english_text
      : typeof meta.english_text === 'string'
        ? meta.english_text
        : null;
  const translatedText =
    typeof nested?.translated_text === 'string'
      ? nested.translated_text
      : typeof meta.translated_text === 'string'
        ? meta.translated_text
        : null;
  const sourceLanguage =
    typeof nested?.source_language === 'string'
      ? nested.source_language
      : typeof meta.source_language === 'string'
        ? meta.source_language
        : null;
  const targetLanguage =
    typeof nested?.target_language === 'string'
      ? nested.target_language
      : typeof meta.target_language === 'string'
        ? meta.target_language
        : null;
  const originalAgentInput =
    typeof nested?.original_agent_input === 'string'
      ? nested.original_agent_input
      : typeof meta.original_agent_input === 'string'
        ? meta.original_agent_input
        : null;

  if (!isTranslated && !englishText && !translatedText && !originalAgentInput) return null;
  return {
    isTranslated,
    englishText,
    translatedText,
    sourceLanguage,
    targetLanguage,
    originalAgentInput,
  };
}

function extractSources(meta: Record<string, unknown> | null | undefined): CopilotSource[] {
  if (!meta) return [];
  const raw = meta.sources ?? meta.retrieved_chunks;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx): CopilotSource | null => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const title =
        (typeof obj.title === 'string' && obj.title) ||
        (typeof obj.article_title === 'string' && obj.article_title) ||
        'Knowledge source';
      const id =
        (typeof obj.id === 'string' && obj.id) ||
        (typeof obj.article_id === 'string' && obj.article_id) ||
        `src-${idx}`;
      return {
        id,
        title,
        slug: typeof obj.slug === 'string' ? obj.slug : typeof obj.article_slug === 'string' ? obj.article_slug : null,
        url: typeof obj.url === 'string' ? obj.url : null,
        section: typeof obj.section === 'string' ? obj.section : typeof obj.section_name === 'string' ? obj.section_name : null,
        kind: obj.kind === 'knowledge' || obj.source === 'knowledge' ? 'knowledge' : 'article',
      };
    })
    .filter((s): s is CopilotSource => Boolean(s));
}

function parseLangGraphApprovalMetadata(
  meta: Record<string, unknown> | null,
): InboxLangGraphApproval | null {
  const raw = meta?.langgraph_approval;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const threadId = typeof r.threadId === 'string' ? r.threadId.trim() : '';
  if (!threadId) return null;
  const rawStatus = r.status;
  const status: InboxLangGraphApproval['status'] =
    rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'pending';
  const rawActions = Array.isArray(r.pendingActions) ? r.pendingActions : [];
  return {
    runId: typeof r.runId === 'string' ? r.runId : null,
    threadId,
    agentId: typeof r.agentId === 'string' ? r.agentId : null,
    agentName: typeof r.agentName === 'string' && r.agentName.trim() ? r.agentName : 'AI Agent',
    topic: typeof r.topic === 'string' && r.topic.trim() ? r.topic : 'General inquiries',
    autonomyLevel: typeof r.autonomyLevel === 'number' ? r.autonomyLevel : 2,
    reason: typeof r.reason === 'string' ? r.reason : 'Human approval required',
    draftReply: typeof r.draftReply === 'string' ? r.draftReply : '',
    pendingActions: rawActions
      .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === 'object'))
      .map((a) => ({
        toolName: String(a.toolName || ''),
        summary: String(a.summary || ''),
        args: (a.args && typeof a.args === 'object' ? a.args : {}) as Record<string, unknown>,
      })),
    status,
    resolvedBy: typeof r.resolvedBy === 'string' ? r.resolvedBy : null,
    resolvedAt: typeof r.resolvedAt === 'string' ? r.resolvedAt : null,
    finalReply: typeof r.finalReply === 'string' ? r.finalReply : null,
  };
}

export function mapMessageItem(
  msg: Message,
  visitorName: string,
  agentsById: Record<string, InboxAgent>,
): InboxMessageItem {
  const meta = (msg.metadata || null) as Record<string, unknown> | null;
  const senderType: SenderType = msg.sender_type || 'visitor';
  let senderName = 'System';
  if (senderType === 'visitor') senderName = visitorName;
  else if (senderType === 'ai') senderName = 'AI Assistant';
  else if (senderType === 'agent') {
    senderName =
      msg.agent?.name ||
      (msg.sender_id && agentsById[msg.sender_id]?.name) ||
      'Teammate';
  }

  const rawRating = meta?.bot_rating;
  const botRating =
    rawRating === 'helpful' || rawRating === 'good'
      ? 'helpful'
      : rawRating === 'not_helpful' || rawRating === 'wrong'
        ? 'not_helpful'
        : null;

  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    senderType,
    senderId: msg.sender_id || null,
    senderName,
    content: msg.content || '',
    attachmentUrl: msg.attachment_url || null,
    attachmentIsImage: isImageAttachmentUrl(msg.attachment_url),
    attachmentIsAudio: isAudioAttachmentUrl(msg.attachment_url, meta),
    attachmentMimeType:
      typeof meta?.audio_mime === 'string'
        ? meta.audio_mime
        : typeof meta?.mime_type === 'string'
          ? meta.mime_type
          : null,
    audioDurationSec:
      typeof meta?.audio_duration_sec === 'number' && Number.isFinite(meta.audio_duration_sec)
        ? meta.audio_duration_sec
        : null,
    isInternal: Boolean(msg.is_internal),
    createdAt: msg.created_at,
    readAt: msg.read_at || null,
    deliveredAt: msg.delivered_at || null,
    replyToMessageId: msg.reply_to_message_id || null,
    editedAt: typeof meta?.edited_at === 'string' ? meta.edited_at : null,
    channelStatus: msg.channel_status || null,
    channelError: msg.channel_error || null,
    botRating,
    sources: extractSources(meta),
    translation: parseTranslationMetadata(meta),
    langgraphApproval: parseLangGraphApprovalMetadata(meta),
    raw: msg,
  };
}

export function buildConversationTimeline(
  conversation: InboxConversationItem,
  messages: InboxMessageItem[],
  ticketEvents: TicketEvent[],
  peopleMap: Record<string, string>,
): InboxTimelineEvent[] {
  const events: InboxTimelineEvent[] = [];

  events.push({
    id: `conv-created-${conversation.id}`,
    at: conversation.createdAt,
    kind: 'created',
    title: `Conversation started via ${conversation.channelName}`,
    detail: conversation.visitorEmail || conversation.visitorName,
    actor: conversation.visitorName,
  });

  if (conversation.handoffOfferedAt) {
    events.push({
      id: `handoff-offered-${conversation.id}`,
      at: conversation.handoffOfferedAt,
      kind: 'handoff',
      title: 'Human support offered to customer',
      detail: conversation.handoffReasonLabel,
      actor: 'AI Assistant',
    });
  }

  if (conversation.handoffRequestedAt) {
    events.push({
      id: `handoff-requested-${conversation.id}`,
      at: conversation.handoffRequestedAt,
      kind: 'handoff',
      title: 'Handover requested',
      detail: conversation.handoffSummary || conversation.handoffReasonLabel,
      actor: conversation.visitorName,
    });
  }

  if (conversation.firstAgentReplyAt) {
    events.push({
      id: `first-reply-${conversation.id}`,
      at: conversation.firstAgentReplyAt,
      kind: 'reply',
      title: 'First human teammate reply sent',
      detail: null,
      actor: conversation.assignedAgentName,
    });
  }

  for (const m of messages) {
    if (m.senderType === 'system') {
      events.push({
        id: `sys-msg-${m.id}`,
        at: m.createdAt,
        kind: 'system',
        title: m.content || 'System event',
        detail: null,
        actor: 'System',
      });
    }
  }

  for (const ev of ticketEvents) {
    const actorName = (ev.actor_id && peopleMap[ev.actor_id]) || ev.actor_type;
    const changeDetail =
      ev.field && (ev.old_value || ev.new_value)
        ? `${ev.field}: ${ev.old_value || '—'} → ${ev.new_value || '—'}`
        : null;
    events.push({
      id: `ticket-ev-${ev.id}`,
      at: ev.created_at,
      kind: 'ticket',
      title: `Ticket ${ev.action.replace(/_/g, ' ')}`,
      detail: changeDetail,
      actor: actorName,
    });
  }

  if (conversation.closedAt) {
    events.push({
      id: `conv-closed-${conversation.id}`,
      at: conversation.closedAt,
      kind: 'resolved',
      title: 'Conversation resolved',
      detail: null,
      actor: conversation.assignedAgentName || 'Team',
    });
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/* ── View filtering & sorting ──────────────────────────────────────────── */

const PRIORITY_RANK: Record<ConversationPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export function matchesInboxView(
  item: InboxConversationItem,
  view: InboxViewKey,
  currentAgentId: string,
): boolean {
  switch (view) {
    case 'open':
      return item.status === 'open' || item.status === 'pending';
    case 'mine':
      return (
        item.assignedAgentId === currentAgentId &&
        item.status !== 'closed'
      );
    case 'unassigned':
      return (
        !item.assignedAgentId &&
        item.status !== 'closed'
      );
    case 'ai':
      return (
        item.status !== 'closed' &&
        item.aiMode === 'autopilot' &&
        !item.waitingForPerson &&
        !item.assignedAgentId
      );
    case 'waiting':
      return item.waitingForPerson && item.status !== 'closed';
    case 'waiting_approval': {
      const m = (item.raw.channel_metadata || {}) as Record<string, unknown>;
      return (
        item.status !== 'closed' &&
        (String(item.raw.ai_paused_reason || '') === 'langgraph_approval' ||
          String(item.raw.handoff_status || '') === 'waiting_approval' ||
          Boolean(m.pending_langgraph_approval))
      );
    }
    case 'snoozed':
      return item.status === 'snoozed';
    case 'resolved':
      return item.status === 'closed';
    case 'all':
    default:
      return true;
  }
}

export function computeInboxViewCounts(
  items: InboxConversationItem[],
  currentAgentId: string,
): Record<InboxViewKey, number> {
  const views: InboxViewKey[] = [
    'open',
    'mine',
    'unassigned',
    'ai',
    'waiting',
    'waiting_approval',
    'snoozed',
    'resolved',
    'all',
  ];
  const counts = {} as Record<InboxViewKey, number>;
  for (const v of views) counts[v] = 0;
  for (const item of items) {
    for (const v of views) {
      if (matchesInboxView(item, v, currentAgentId)) counts[v]++;
    }
  }
  return counts;
}

export function filterInboxConversations(
  items: InboxConversationItem[],
  opts: {
    view: InboxViewKey;
    currentAgentId: string;
    channel: InboxChannelFilter;
    priority: InboxPriorityFilter;
    search: string;
  },
): InboxConversationItem[] {
  const q = opts.search.trim().toLowerCase();
  return items.filter((item) => {
    if (!matchesInboxView(item, opts.view, opts.currentAgentId)) return false;
    if (opts.channel !== 'all' && item.channel !== opts.channel) return false;
    if (opts.priority !== 'all' && item.priority !== opts.priority) return false;
    if (!q) return true;
    return (
      item.visitorName.toLowerCase().includes(q) ||
      (item.visitorEmail || '').toLowerCase().includes(q) ||
      item.lastMessagePreview.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q)) ||
      item.id.toLowerCase().startsWith(q)
    );
  });
}

export function sortInboxConversations(
  items: InboxConversationItem[],
  sort: InboxSortKey,
): InboxConversationItem[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === 'priority') {
      const pDiff = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      if (pDiff !== 0) return pDiff;
    } else if (sort === 'unread') {
      if ((b.unreadCount > 0 ? 1 : 0) !== (a.unreadCount > 0 ? 1 : 0)) {
        return b.unreadCount > 0 ? 1 : -1;
      }
      if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    } else if (sort === 'waiting') {
      const wDiff = (b.waitingForPerson ? 1 : 0) - (a.waitingForPerson ? 1 : 0);
      if (wDiff !== 0) return wDiff;
      const vDiff =
        (b.lastMessageSender === 'visitor' ? 1 : 0) -
        (a.lastMessageSender === 'visitor' ? 1 : 0);
      if (vDiff !== 0) return vDiff;
    }
    return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
  });
  return copy;
}

/* ── Server action & API wrappers ──────────────────────────────────────── */

export interface SearchInboxConversationsResult {
  conversations: InboxConversationItem[];
  hasMore: boolean;
  nextCursor: string | null;
  total: number;
  counts: Record<InboxViewKey, number>;
  groupCounts: Record<string, number>;
}

/**
 * Queries conversations server-side with full-text/trigram search, view tabs,
 * team inbox (`groupId`), sorting, cursor pagination, and accurate tab counts.
 */
export async function searchInboxConversations(
  workspaceId: string,
  opts: {
    view?: InboxViewKey;
    channel?: InboxChannelFilter;
    priority?: InboxPriorityFilter;
    groupId?: string | null;
    search?: string;
    sort?: InboxSortKey;
    cursor?: string | null;
    limit?: number;
  } = {},
): Promise<SearchInboxConversationsResult> {
  try {
    const [searchRes, handoversRes] = await Promise.all([
      searchAndFilterConversationsAction(workspaceId, {
        view: opts.view ?? 'open',
        channel: opts.channel ?? 'all',
        priority: opts.priority ?? 'all',
        groupId: opts.groupId ?? null,
        search: opts.search ?? '',
        sort: opts.sort ?? 'newest',
        cursor: opts.cursor ?? null,
        limit: opts.limit ?? 30,
      }),
      loadHandoversAction(workspaceId).catch((err) => {
        console.error('[Inbox]: Failed to load handovers:', err);
        return [] as HandoverItem[];
      }),
    ]);

    const handoverMap = new Map<string, HandoverItem>();
    for (const h of handoversRes) handoverMap.set(h.id, h);

    const sc = searchRes.counts;
    const counts: Record<InboxViewKey, number> = {
      open: sc.open,
      mine: sc.mine,
      unassigned: sc.unassigned,
      ai: sc.ai,
      waiting: sc.waiting,
      waiting_approval: sc.waiting_approval,
      snoozed: sc.snoozed,
      resolved: sc.resolved,
      all: sc.all,
    };

    return {
      conversations: searchRes.conversations.map((c) =>
        mapConversationItem(c, handoverMap.get(c.id)),
      ),
      hasMore: searchRes.hasMore,
      nextCursor: searchRes.nextCursor,
      total: searchRes.total,
      counts,
      groupCounts: searchRes.groupCounts,
    };
  } catch (err) {
    console.error('[Inbox]: Failed to search conversations:', err);
    throw new Error(errorMessage(err, 'Could not load conversations.'));
  }
}

/**
 * Loads conversations and maps pending/active handover metadata (legacy paged list).
 */
export async function listInboxConversations(
  workspaceId: string,
  page = 0,
  pageSize = 30,
): Promise<{ conversations: InboxConversationItem[]; hasMore: boolean }> {
  try {
    const [convRes, handoversRes] = await Promise.all([
      listDashboardConversationsAction(workspaceId, page, pageSize),
      loadHandoversAction(workspaceId).catch((err) => {
        console.error('[Inbox]: Failed to load handovers:', err);
        return [] as HandoverItem[];
      }),
    ]);

    const handoverMap = new Map<string, HandoverItem>();
    for (const h of handoversRes) handoverMap.set(h.id, h);

    return {
      conversations: convRes.conversations.map((c) =>
        mapConversationItem(c, handoverMap.get(c.id)),
      ),
      hasMore: convRes.hasMore,
    };
  } catch (err) {
    console.error('[Inbox]: Failed to list conversations:', err);
    throw new Error(errorMessage(err, 'Could not load conversations.'));
  }
}

export async function getInboxMeta(workspaceId: string): Promise<InboxMeta> {
  const [bootstrapRes, cannedRes, tagsRes, handoversRes, viewsRes] = await Promise.allSettled([
    getTicketsBootstrapAction(workspaceId),
    listCannedResponsesAction(workspaceId),
    listTagsAction(workspaceId),
    loadHandoversAction(workspaceId),
    listConversationViewsAction(workspaceId),
  ]);

  if (bootstrapRes.status === 'rejected') {
    console.error('[Inbox]: Failed to load team metadata:', bootstrapRes.reason);
  }
  if (cannedRes.status === 'rejected') {
    console.error('[Inbox]: Failed to load saved replies:', cannedRes.reason);
  }
  if (tagsRes.status === 'rejected') {
    console.error('[Inbox]: Failed to load workspace tags:', tagsRes.reason);
  }
  if (viewsRes.status === 'rejected') {
    console.error('[Inbox]: Failed to load saved conversation views:', viewsRes.reason);
  }

  const bootstrap = bootstrapRes.status === 'fulfilled' ? bootstrapRes.value : null;
  const canned = cannedRes.status === 'fulfilled' ? cannedRes.value : [];
  const tags = tagsRes.status === 'fulfilled' ? tagsRes.value : [];
  const handovers = handoversRes.status === 'fulfilled' ? handoversRes.value : [];
  const savedViews = viewsRes.status === 'fulfilled' ? viewsRes.value : [];

  const handoversByConversationId: Record<string, HandoverItem> = {};
  for (const h of handovers) handoversByConversationId[h.id] = h;

  return {
    agents: (bootstrap?.agents || []).map((a) => ({
      id: a.id,
      name: a.name,
      avatarUrl: a.avatar_url,
      status: a.status,
      role: a.role,
      isActive: a.is_active,
      maxOpenTickets: a.max_open_tickets,
      openTickets: a.open_tickets,
    })),
    teamGroups: (bootstrap?.groups || []).map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberIds: g.member_ids,
    })),
    savedFilters: savedViews,
    cannedReplies: canned.map((c: CannedResponse) => ({
      id: c.id,
      title: c.title?.trim() || c.shortcut || 'Saved reply',
      shortcut: c.shortcut || '',
      content: c.content || '',
    })),
    workspaceTags: tags,
    handoversByConversationId,
  };
}

export async function getConversationDetail(
  workspaceId: string,
  conversationId: string,
  agentsById: Record<string, InboxAgent>,
  handover?: HandoverItem,
): Promise<InboxConversationDetail> {
  try {
    const [[convRaw, msgsRaw], aiRes] = await Promise.all([
      Promise.all([
        getDashboardConversationAction(workspaceId, conversationId),
        listDashboardMessagesAction(workspaceId, conversationId),
      ]),
      getConversationAiSummaryAction(workspaceId, conversationId).catch(() => null),
    ]);

    if (!convRaw) {
      throw new Error('Conversation was not found or may have been deleted.');
    }

    const conversation = mapConversationItem(convRaw, handover);
    const messages = (msgsRaw || []).map((m) =>
      mapMessageItem(m, conversation.visitorName, agentsById),
    );

    let linkedTicket: InboxLinkedTicket | null = null;
    let ticketEvents: TicketEvent[] = [];
    let peopleMap: Record<string, string> = {};

    if (conversation.currentTicketId) {
      const [barRes, detailRes] = await Promise.allSettled([
        getTicketBarAction(workspaceId, conversation.currentTicketId),
        getTicketAction(workspaceId, conversation.currentTicketId),
      ]);

      if (barRes.status === 'fulfilled' && barRes.value.ticket) {
        const t = barRes.value.ticket;
        linkedTicket = {
          id: t.id,
          number: t.number,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          type: t.type,
          followUpOfId: t.follow_up_of_id,
          parentNumber: barRes.value.parentNumber,
          slaNextDueAt: t.sla_next_due_at || null,
          slaState: t.sla_state || null,
        };
      }

      if (detailRes.status === 'fulfilled') {
        ticketEvents = detailRes.value.events || [];
        peopleMap = detailRes.value.people || {};
      }
    }

    const activeLanguageCode =
      conversation.languageOverride || conversation.detectedLanguage || 'en';

    return {
      conversation,
      messages,
      linkedTicket,
      ticketEvents,
      timeline: buildConversationTimeline(
        conversation,
        messages,
        ticketEvents,
        peopleMap,
      ),
      activeLanguageCode,
      detectedLanguageCode: conversation.detectedLanguage,
      languageOverride: conversation.languageOverride,
      aiCostUsd: aiRes?.estimatedCostUsd ?? null,
      aiConfidencePercent: aiRes?.latestConfidencePct ?? null,
      aiAgentName: aiRes?.agentName ?? null,
      aiEngineUsed: aiRes?.engineUsed ?? null,
      pendingApprovalRun: aiRes?.pendingApprovalRun ?? null,
    };
  } catch (err) {
    console.error('[Inbox]: Failed to load conversation detail:', err);
    throw new Error(errorMessage(err, 'Could not load conversation messages.'));
  }
}

export async function getCustomerContext(
  workspaceId: string,
  conversation: InboxConversationItem,
): Promise<InboxCustomerContext> {
  const visitorId = conversation.visitorId || null;
  const email = conversation.visitorEmail || null;

  const [snapshotRes, metaRes, pastRes, statsRes] = await Promise.allSettled([
    visitorId ? getVisitorSnapshotAction(workspaceId, visitorId) : Promise.resolve(null),
    visitorId
      ? getLiveVisitorMetaAction(workspaceId, [visitorId])
      : Promise.resolve({ pageHistory: [], openTickets: [] }),
    visitorId || email
      ? listVisitorConversationsAction(workspaceId, visitorId, email, conversation.id)
      : Promise.resolve([]),
    visitorId || email
      ? getVisitorLifetimeStatsAction(workspaceId, visitorId, email)
      : Promise.resolve({
          lifetimeCsatAvg: null,
          csatCount: 0,
          avgFirstReplySec: null,
          totalResolvedCount: 0,
        }),
  ]);

  const visitor: Visitor | null =
    (snapshotRes.status === 'fulfilled' && snapshotRes.value) ||
    conversation.raw.visitor ||
    null;

  const liveMeta =
    metaRes.status === 'fulfilled'
      ? metaRes.value
      : { pageHistory: [], openTickets: [] };

  const past = pastRes.status === 'fulfilled' ? pastRes.value : [];
  const lifetimeStats =
    statsRes.status === 'fulfilled'
      ? statsRes.value
      : {
          lifetimeCsatAvg: null,
          csatCount: 0,
          avgFirstReplySec: null,
          totalResolvedCount: 0,
        };

  const location = parseLocation(
    visitor?.location,
    visitor?.ip_location_city,
    visitor?.ip_location_country,
  );
  const timezone = visitor?.timezone || timezoneFrom(visitor?.location) || null;
  const ua = parseUserAgentDetailed(visitor?.user_agent);
  if (visitor?.browser && ua.browserName === 'Unknown browser') {
    ua.browserName = visitor.browser;
  }
  if (visitor?.os && ua.osName === 'Unknown OS') {
    ua.osName = visitor.os;
  }
  if (
    visitor?.device === 'mobile' ||
    visitor?.device === 'tablet' ||
    visitor?.device === 'desktop'
  ) {
    ua.device = visitor.device;
  }

  return {
    visitorId,
    name: visitor?.name?.trim() || conversation.visitorName,
    email: visitor?.email?.trim() || email,
    isOnline: Boolean(visitor?.is_online ?? conversation.visitorOnline),
    lastSeenAt: visitor?.last_seen_at || conversation.visitorLastSeenAt,
    firstSeenAt: visitor?.first_seen_at || null,
    visitCount: visitor?.visit_count ?? 1,
    location,
    timezone,
    localTime: localTimeIn(timezone),
    browserLanguage: languageLabel(visitor?.language),
    ua,
    currentPageUrl: visitor?.current_page_url || null,
    currentPageTitle: visitor?.current_page_title || null,
    referrerSource: visitor?.referrer_source || null,
    pageHistory: liveMeta.pageHistory || [],
    openTickets: liveMeta.openTickets || [],
    pastConversations: past.map((c) => ({
      id: c.id,
      channel: c.channel || 'web',
      status: c.status || 'open',
      priority: c.priority || 'normal',
      updatedAt: c.updated_at || c.created_at,
      tags: Array.isArray(c.tags) ? c.tags : [],
    })),
    notes: visitor?.notes || '',
    notesEditable: true,
    lifetimeCsatAvg: lifetimeStats.lifetimeCsatAvg,
    csatCount: lifetimeStats.csatCount,
    avgFirstReplySec: lifetimeStats.avgFirstReplySec,
    totalResolvedCount: lifetimeStats.totalResolvedCount,
    // TODO(backend): Orders / Shopify history has no integration or endpoint.
    ordersUnavailableReason: 'No storefront or Shopify integration connected yet.',
  };
}

/* ── Messaging, translation, uploads & help articles ───────────────────── */

export async function sendInboxMessage(
  workspaceId: string,
  params: {
    conversationId: string;
    content: string;
    channel: ChannelType;
    isInternal?: boolean;
    replyToId?: string | null;
    attachmentUrl?: string | null;
    attachmentMeta?: {
      isAudio?: boolean;
      mimeType?: string | null;
      durationSec?: number | null;
    };
    targetLanguageCode?: string | null;
    customerWritesRoman?: boolean;
  },
): Promise<{
  message: Message;
  newStatus?: ConversationStatus;
  translationFallbackUsed: boolean;
}> {
  const text = params.content.trim();
  const isInternal = Boolean(params.isInternal);
  const replyLang = params.targetLanguageCode || 'en';
  let finalContent = text;
  let translationMetadata: Record<string, unknown> | null = null;
  let translationFallbackUsed = false;

  const isForeignInput =
    text.length > 0 && (!isLikelyEnglishText(text) || isRomanizedText(replyLang, text));

  if (
    !isInternal &&
    text.length > 0 &&
    (replyLang !== 'en' || (replyLang === 'en' && isForeignInput))
  ) {
    try {
      const res = await fetch('/api/translation/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'agent_reply',
          text,
          targetLanguage: replyLang,
          workspaceId,
          romanize: Boolean(params.customerWritesRoman && replyLang !== 'en'),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          isTranslated?: boolean;
          translatedText?: string;
          englishText?: string;
          detectedSourceLanguage?: string;
        };
        const translated = data.translatedText?.trim();
        const wasTranslated = Boolean(
          data.isTranslated || (translated && translated.toLowerCase() !== text.toLowerCase()),
        );
        if (wasTranslated && translated) {
          finalContent = translated;
          const englishText = data.englishText?.trim() || text;
          const langInfo = getLanguageInfo(replyLang);
          translationMetadata = {
            translation: {
              is_translated: true,
              direction: 'agent_to_visitor',
              original_agent_input: text,
              agent_input_language: data.detectedSourceLanguage || 'en',
              english_text: englishText,
              original_english: englishText,
              translated_text: translated,
              target_language: replyLang,
              target_language_name: langInfo.name,
            },
            english_text: englishText,
            original_english: englishText,
            original_agent_input: text,
            translated_text: translated,
            target_language: replyLang,
          };
        }
      } else {
        translationFallbackUsed = true;
      }
    } catch (err) {
      console.error('[Inbox]: Outbound translation failed, sending original:', err);
      translationFallbackUsed = true;
    }
  }

  const audioMeta =
    params.attachmentUrl && params.attachmentMeta?.isAudio
      ? {
          is_audio: true,
          audio_mime: params.attachmentMeta.mimeType || 'audio/webm',
          audio_duration_sec:
            typeof params.attachmentMeta.durationSec === 'number' &&
            Number.isFinite(params.attachmentMeta.durationSec)
              ? Math.max(0, Math.round(params.attachmentMeta.durationSec))
              : null,
        }
      : null;

  const mergedMetadata =
    translationMetadata || audioMeta
      ? { ...(translationMetadata || {}), ...(audioMeta || {}) }
      : null;

  const fallbackLabel = params.attachmentMeta?.isAudio ? 'Voice note' : 'Attachment';

  try {
    const res = await sendDashboardMessageAction(workspaceId, {
      conversationId: params.conversationId,
      content: finalContent || (params.attachmentUrl ? fallbackLabel : ''),
      isInternal,
      replyToId: isInternal ? null : params.replyToId ?? null,
      attachmentUrl: params.attachmentUrl ?? null,
      metadata: mergedMetadata,
    });

    if (!isInternal && params.channel && params.channel !== 'web') {
      fetch('/api/channels/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: params.conversationId,
          workspaceId,
          content: finalContent || (params.attachmentUrl ? `[${fallbackLabel}]` : ''),
          channel: params.channel,
        }),
      }).catch((err) => {
        console.error('[Inbox]: Channel dispatch error:', err);
      });
    }

    return {
      message: res.message,
      newStatus: res.newStatus,
      translationFallbackUsed,
    };
  } catch (err) {
    console.error('[Inbox]: Failed to send message:', err);
    throw new Error(errorMessage(err, 'Could not send message.'));
  }
}

export async function editInboxMessage(
  workspaceId: string,
  conversationId: string,
  messageId: string,
  newContent: string,
): Promise<void> {
  try {
    await editDashboardMessageAction(workspaceId, conversationId, messageId, newContent);
  } catch (err) {
    console.error('[Inbox]: Failed to edit message:', err);
    throw new Error(errorMessage(err, 'Could not edit message.'));
  }
}

export async function deleteInboxMessage(
  workspaceId: string,
  conversationId: string,
  messageId: string,
): Promise<void> {
  try {
    await deleteDashboardMessageAction(workspaceId, conversationId, messageId);
  } catch (err) {
    console.error('[Inbox]: Failed to delete message:', err);
    throw new Error(errorMessage(err, 'Could not delete message.'));
  }
}

/**
 * Uploads an image, PDF, plain-text file (max 15 MB) or voice-note audio (max 10 MB).
 */
export async function uploadInboxAttachment(
  file: File,
  opts?: { durationSec?: number },
): Promise<{
  url: string;
  name: string;
  isImage: boolean;
  isAudio: boolean;
  mimeType: string | null;
  durationSec: number | null;
}> {
  const normalizedMime = (file.type || '').split(';')[0]?.trim().toLowerCase() || '';
  const isImage = looksLikeImage(file);
  const isAudio =
    normalizedMime === 'audio/webm' ||
    normalizedMime === 'audio/mp4' ||
    normalizedMime === 'audio/mpeg' ||
    normalizedMime === 'audio/ogg' ||
    normalizedMime === 'audio/m4a' ||
    normalizedMime === 'audio/x-m4a' ||
    /\.(webm|m4a|mp3|ogg|oga)$/i.test(file.name || '');
  const allowedDoc =
    normalizedMime === 'application/pdf' ||
    normalizedMime === 'text/plain' ||
    /\.(pdf|txt)$/i.test(file.name || '');

  const maxBytes = isAudio ? 10 * 1024 * 1024 : 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      isAudio
        ? 'Voice note is larger than the 10 MB limit.'
        : 'File is larger than the 15 MB limit.',
    );
  }

  if (!isImage && !isAudio && !allowedDoc) {
    throw new Error('Only images, voice audio (webm/mp4/mp3/ogg), PDFs, and TXT files are supported.');
  }

  try {
    const uploaded = await uploadChatAttachment(file, { durationSec: opts?.durationSec });
    return {
      url: uploaded.url,
      name: file.name || (isAudio ? 'voice-note.webm' : 'attachment'),
      isImage: !uploaded.isAudio && isImage,
      isAudio: uploaded.isAudio || isAudio,
      mimeType: uploaded.mimeType || normalizedMime || null,
      durationSec: uploaded.durationSec ?? opts?.durationSec ?? null,
    };
  } catch (err) {
    console.error('[Inbox]: Attachment upload failed:', err);
    throw new Error(errorMessage(err, 'Could not upload file.'));
  }
}

export async function searchInboxHelpArticles(
  workspaceId: string,
  query: string,
): Promise<InboxHelpArticle[]> {
  try {
    const params = new URLSearchParams({ workspaceId });
    if (query.trim()) params.set('search', query.trim());
    const res = await fetch(`/api/help?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      articles?: Array<{
        id: string;
        title: string;
        slug?: string | null;
        summary?: string | null;
        section?: { name?: string | null } | null;
      }>;
    };
    return (data.articles || []).slice(0, 15).map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug ?? null,
      summary: a.summary ?? null,
      sectionName: a.section?.name ?? null,
    }));
  } catch (err) {
    console.error('[Inbox]: Help article search failed:', err);
    throw new Error(errorMessage(err, 'Could not search help articles.'));
  }
}

/* ── Conversation actions (assign, status, priority, snooze, merge, tags) */

export async function assignInboxConversation(
  workspaceId: string,
  conversationId: string,
  agentId: string | null,
): Promise<void> {
  try {
    await updateDashboardConversationAction(workspaceId, conversationId, {
      assigned_agent_id: agentId,
      agent_id: agentId,
    });
  } catch (err) {
    console.error('[Inbox]: Assign failed:', err);
    throw new Error(errorMessage(err, 'Could not update assignee.'));
  }
}

export async function autoAssignInboxConversation(
  workspaceId: string,
  conversationId: string,
): Promise<string | null> {
  try {
    const res = await fetch('/api/conversations/auto-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      agent?: { id?: string; name?: string } | null;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (data.agent?.id) {
      await updateDashboardConversationAction(workspaceId, conversationId, {
        assigned_agent_id: data.agent.id,
        agent_id: data.agent.id,
      });
      return data.agent.name || null;
    }
    return null;
  } catch (err) {
    console.error('[Inbox]: Auto-assign failed:', err);
    throw new Error(errorMessage(err, 'Could not auto-assign conversation.'));
  }
}

export async function updateInboxConversationStatus(
  workspaceId: string,
  conversationId: string,
  status: ConversationStatus,
): Promise<void> {
  try {
    await updateDashboardConversationAction(workspaceId, conversationId, {
      status,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.error('[Inbox]: Status update failed:', err);
    throw new Error(errorMessage(err, 'Could not update conversation status.'));
  }
}

export async function updateInboxConversationPriority(
  workspaceId: string,
  conversationId: string,
  priority: ConversationPriority,
): Promise<void> {
  try {
    await updateDashboardConversationAction(workspaceId, conversationId, { priority });
  } catch (err) {
    console.error('[Inbox]: Priority update failed:', err);
    throw new Error(errorMessage(err, 'Could not update priority.'));
  }
}

export async function updateInboxConversationTags(
  workspaceId: string,
  conversationId: string,
  tags: string[],
): Promise<void> {
  try {
    await updateDashboardConversationAction(workspaceId, conversationId, { tags });
  } catch (err) {
    console.error('[Inbox]: Tag update failed:', err);
    throw new Error(errorMessage(err, 'Could not update tags.'));
  }
}

export async function snoozeInboxConversation(
  conversationId: string,
  snoozedUntilIso: string,
): Promise<void> {
  try {
    const res = await fetch('/api/conversations/snooze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        snoozed_until: snoozedUntilIso,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  } catch (err) {
    console.error('[Inbox]: Snooze failed:', err);
    throw new Error(errorMessage(err, 'Could not snooze conversation.'));
  }
}

export async function claimInboxHandover(
  conversationId: string,
): Promise<{ ok: boolean; reason?: string; message?: string }> {
  try {
    return await claimConversationAction(conversationId);
  } catch (err) {
    console.error('[Inbox]: Claim handover failed:', err);
    throw new Error(errorMessage(err, 'Could not claim conversation.'));
  }
}

export async function skipInboxHandover(conversationId: string): Promise<void> {
  try {
    await skipConversationAction(conversationId);
  } catch (err) {
    console.error('[Inbox]: Skip handover failed:', err);
    throw new Error(errorMessage(err, 'Could not skip handover.'));
  }
}

export async function returnInboxConversationToAi(
  conversationId: string,
): Promise<void> {
  try {
    await returnToAiAction(conversationId);
  } catch (err) {
    console.error('[Inbox]: Return to AI failed:', err);
    throw new Error(errorMessage(err, 'Could not return conversation to AI.'));
  }
}

export async function listMergeCandidates(
  workspaceId: string,
  visitorId: string | null | undefined,
  visitorEmail: string | null | undefined,
  excludeConversationId: string,
): Promise<InboxConversationItem[]> {
  try {
    const list = await listVisitorConversationsAction(
      workspaceId,
      visitorId,
      visitorEmail,
      excludeConversationId,
    );
    return (list || []).map((c) => mapConversationItem(c));
  } catch (err) {
    console.error('[Inbox]: Load merge candidates failed:', err);
    throw new Error(errorMessage(err, 'Could not load conversations to merge.'));
  }
}

export async function mergeInboxConversations(
  sourceConversationId: string,
  targetConversationId: string,
  agentName: string,
): Promise<void> {
  try {
    const res = await fetch('/api/conversations/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_conversation_id: sourceConversationId,
        target_conversation_id: targetConversationId,
        agent_name: agentName,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
    };
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Could not merge conversations.');
    }
  } catch (err) {
    console.error('[Inbox]: Merge failed:', err);
    throw new Error(errorMessage(err, 'Could not merge conversations.'));
  }
}

export async function bulkUpdateInboxConversations(
  workspaceId: string,
  payload:
    | { ids: string[]; action: 'resolve' }
    | { ids: string[]; action: 'assign'; agentId: string | null }
    | { ids: string[]; action: 'spam' },
): Promise<void> {
  try {
    await bulkUpdateDashboardConversationsAction(workspaceId, payload);
  } catch (err) {
    console.error('[Inbox]: Bulk update failed:', err);
    throw new Error(errorMessage(err, 'Could not update selected conversations.'));
  }
}

export async function setInboxLanguageOverride(
  conversationId: string,
  languageCode: string | null,
  detectedFallback?: string,
): Promise<void> {
  try {
    await setConversationLanguageOverrideAction(
      conversationId,
      languageCode,
      detectedFallback,
    );
  } catch (err) {
    console.error('[Inbox]: Language override failed:', err);
    throw new Error(errorMessage(err, 'Could not update language setting.'));
  }
}

export async function createTicketFromConversation(
  workspaceId: string,
  input: {
    requesterName: string;
    requesterEmail: string;
    subject: string;
    body: string;
    channel: TicketChannel;
    priority?: TicketPriority;
    assigneeId?: string | null;
    tags?: string[];
  },
): Promise<{ id: string; number: number }> {
  try {
    const ticket = await createTicketAction(workspaceId, input);
    return { id: ticket.id, number: ticket.number };
  } catch (err) {
    console.error('[Inbox]: Create ticket failed:', err);
    throw new Error(errorMessage(err, 'Could not create ticket.'));
  }
}

/* ── AI Copilot wrappers ──────────────────────────────────────────────── */

export async function getInboxCopilotState(
  workspaceId: string,
  conversationId: string,
): Promise<InboxCopilotState> {
  try {
    const state = await getCopilotPanelStateAction(workspaceId, conversationId);
    return { ...state, loadedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[Inbox]: Copilot state load failed:', err);
    throw new Error(errorMessage(err, 'Could not load AI Copilot state.'));
  }
}

export async function generateInboxSummary(
  workspaceId: string,
  conversationId: string,
  forceRefresh = false,
) {
  try {
    return await generateCopilotSummaryAction(workspaceId, conversationId, forceRefresh);
  } catch (err) {
    console.error('[Inbox]: Summary generation failed:', err);
    throw new Error(errorMessage(err, 'Could not summarize conversation.'));
  }
}

export async function suggestInboxReply(
  workspaceId: string,
  conversationId: string,
): Promise<InboxSuggestReplyResult> {
  try {
    const res = await suggestCopilotReplyAction(workspaceId, conversationId, 'auto');
    return {
      ok: res.ok,
      draft: res.draft,
      sources: res.sources,
      knowledgeFound: res.knowledgeFound,
      noteForAgent: res.noteForAgent,
      eventId: res.eventId,
      error: res.error,
    };
  } catch (err) {
    console.error('[Inbox]: Suggest reply failed:', err);
    throw new Error(errorMessage(err, 'Could not draft a suggested reply.'));
  }
}

export async function rewriteInboxText(
  workspaceId: string,
  text: string,
  mode: CopilotRewriteMode,
  conversationId: string,
) {
  try {
    return await rewriteCopilotTextAction(workspaceId, text, mode, conversationId);
  } catch (err) {
    console.error('[Inbox]: Rewrite failed:', err);
    throw new Error(errorMessage(err, 'Could not rewrite text.'));
  }
}

export async function generateInboxNextSteps(
  workspaceId: string,
  conversationId: string,
) {
  try {
    return await generateCopilotNextStepsAction(workspaceId, conversationId);
  } catch (err) {
    console.error('[Inbox]: Next steps failed:', err);
    throw new Error(errorMessage(err, 'Could not generate next steps.'));
  }
}

export async function askInboxCopilot(
  workspaceId: string,
  conversationId: string,
  question: string,
) {
  try {
    return await askCopilotQuestionAction(workspaceId, conversationId, question);
  } catch (err) {
    console.error('[Inbox]: Copilot ask failed:', err);
    throw new Error(errorMessage(err, 'Could not ask Copilot.'));
  }
}

export async function recordInboxCopilotFeedback(
  workspaceId: string,
  eventId: string | null | undefined,
  feedback: 'up' | 'down',
  copilotMessageId?: string | null,
): Promise<void> {
  try {
    await recordCopilotFeedbackAction(workspaceId, eventId, feedback, copilotMessageId);
  } catch (err) {
    console.error('[Inbox]: Feedback failed:', err);
  }
}

export async function recordInboxDraftDisposition(
  workspaceId: string,
  eventId: string | null | undefined,
  disposition: 'used' | 'edited' | 'discarded',
): Promise<void> {
  try {
    await recordCopilotDraftDispositionAction(workspaceId, eventId, disposition);
  } catch (err) {
    console.error('[Inbox]: Draft disposition failed:', err);
  }
}

export async function rateInboxBotReply(
  workspaceId: string,
  messageId: string,
  rating: 'helpful' | 'not_helpful',
): Promise<void> {
  try {
    await rateBotReplyAction(
      workspaceId,
      messageId,
      rating === 'helpful' ? 'good' : 'wrong',
    );
  } catch (err) {
    console.error('[Inbox]: Bot reply rating failed:', err);
    throw new Error(errorMessage(err, 'Could not save feedback.'));
  }
}

export async function assignInboxConversationGroup(
  workspaceId: string,
  conversationId: string,
  groupId: string | null,
): Promise<{ groupId: string | null }> {
  try {
    return await assignConversationGroupAction(workspaceId, conversationId, groupId);
  } catch (err) {
    console.error('[Inbox]: Team group assignment failed:', err);
    throw new Error(errorMessage(err, 'Could not assign team inbox.'));
  }
}

export async function saveInboxConversationView(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    filters?: InboxSavedFilter['filters'];
    sort?: InboxSavedFilter['sort'];
    shared?: boolean;
  },
): Promise<InboxSavedFilter> {
  try {
    return await saveConversationViewAction(workspaceId, input);
  } catch (err) {
    console.error('[Inbox]: Save conversation view failed:', err);
    throw new Error(errorMessage(err, 'Could not save conversation view.'));
  }
}

export async function deleteInboxConversationView(
  workspaceId: string,
  viewId: string,
): Promise<void> {
  try {
    await deleteConversationViewAction(workspaceId, viewId);
  } catch (err) {
    console.error('[Inbox]: Delete conversation view failed:', err);
    throw new Error(errorMessage(err, 'Could not delete saved view.'));
  }
}

export async function updateCustomerVisitorNotes(
  workspaceId: string,
  visitorId: string,
  notes: string,
): Promise<{ notes: string | null }> {
  try {
    return await updateVisitorNotesAction(workspaceId, visitorId, notes);
  } catch (err) {
    console.error('[Inbox]: Update customer notes failed:', err);
    throw new Error(errorMessage(err, 'Could not save customer note.'));
  }
}

export async function resolveInboxLangGraphApproval(
  workspaceId: string,
  params: {
    conversationId: string;
    messageId?: string | null;
    threadId: string;
    approved: boolean;
    editedReply?: string | null;
  },
) {
  try {
    return await resumeAgentApprovalAction(workspaceId, params);
  } catch (err) {
    console.error('[Inbox]: LangGraph approval resolution failed:', err);
    throw new Error(errorMessage(err, 'Could not resolve AI approval request.'));
  }
}

export const resumeInboxAgentApproval = resolveInboxLangGraphApproval;

/* ── Realtime live sync wrapper ────────────────────────────────────────── */

export function useInboxLiveSync(options: {
  workspaceId: string | null | undefined;
  conversationId?: string | null;
  enabled?: boolean;
  onRefresh: () => void | Promise<void>;
}): void {
  useWorkspaceLive({
    workspaceId: options.workspaceId,
    conversationId: options.conversationId,
    enabled: options.enabled ?? true,
    pollMs: 12000,
    debounceMs: 350,
    onRefresh: options.onRefresh,
  });
}
