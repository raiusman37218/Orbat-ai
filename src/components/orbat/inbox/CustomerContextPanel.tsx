'use client';

/**
 * Right-hand Customer Context & Copilot drawer (`316px` desktop, overlay sheet
 * on `<lg` viewports). Displays strictly real customer/visitor/ticket data and
 * honest unavailable states where backend endpoints do not yet exist.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Laptop,
  ListChecks,
  Lock,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  ShoppingBag,
  Sparkles,
  Tag,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Segmented,
  SkeletonRows,
  useOrbToast,
} from '@/components/orbat/primitives';
import { timeAgo } from '@/components/orbat/overview/format';
import {
  askInboxCopilot,
  generateInboxNextSteps,
  generateInboxSummary,
  recordInboxCopilotFeedback,
  updateInboxConversationTags,
  type InboxConversationDetail,
  type InboxCopilotState,
  type InboxCustomerContext,
  type WorkspaceTag,
} from '@/lib/data/inbox';
import { cn } from '@/lib/utils';

type ContextTab = 'details' | 'copilot';

export function CustomerContextPanel({
  workspaceId,
  open,
  onClose,
  detail,
  customer,
  customerLoading,
  customerError,
  onRetryCustomer,
  copilot,
  copilotLoading,
  copilotError,
  onRetryCopilot,
  workspaceTags,
  onSelectConversation,
  onOpenCreateTicket,
  onSwitchToNoteComposer,
  onConversationUpdated,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  detail: InboxConversationDetail;
  customer: InboxCustomerContext | null;
  customerLoading: boolean;
  customerError: string | null;
  onRetryCustomer: () => void;
  copilot: InboxCopilotState | null;
  copilotLoading: boolean;
  copilotError: string | null;
  onRetryCopilot: () => void;
  workspaceTags: WorkspaceTag[];
  onSelectConversation: (conversationId: string) => void;
  onOpenCreateTicket: () => void;
  onSwitchToNoteComposer: () => void;
  onConversationUpdated: () => Promise<void>;
}) {
  const toast = useOrbToast();
  const [tab, setTab] = useState<ContextTab>('details');
  const [newTag, setNewTag] = useState('');
  const [tagBusy, setTagBusy] = useState(false);

  // Copilot interactions
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [stepsBusy, setStepsBusy] = useState(false);
  const [askInput, setAskInput] = useState('');
  const [askBusy, setAskBusy] = useState(false);

  if (!open) return null;

  const conversation = detail.conversation;
  const currentTags = conversation.tags || [];
  const suggestedTags = workspaceTags
    .map((t) => t.tag)
    .filter((t) => !currentTags.includes(t))
    .slice(0, 6);

  const handleAddTag = async (tagValue: string) => {
    const clean = tagValue.trim();
    if (!clean || currentTags.includes(clean) || tagBusy) return;
    setTagBusy(true);
    try {
      await updateInboxConversationTags(workspaceId, conversation.id, [
        ...currentTags,
        clean,
      ]);
      setNewTag('');
      await onConversationUpdated();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Could not add tag.',
        tone: 'bad',
      });
    } finally {
      setTagBusy(false);
    }
  };

  const handleRemoveTag = async (tagValue: string) => {
    if (tagBusy) return;
    setTagBusy(true);
    try {
      await updateInboxConversationTags(
        workspaceId,
        conversation.id,
        currentTags.filter((t) => t !== tagValue),
      );
      await onConversationUpdated();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Could not remove tag.',
        tone: 'bad',
      });
    } finally {
      setTagBusy(false);
    }
  };

  const handleGenerateSummary = async () => {
    setSummaryBusy(true);
    try {
      const res = await generateInboxSummary(workspaceId, conversation.id, true);
      if (!res.ok) {
        toast.show({
          message: res.error || 'Could not generate summary.',
          tone: 'bad',
        });
      }
      onRetryCopilot();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Summary failed.',
        tone: 'bad',
      });
    } finally {
      setSummaryBusy(false);
    }
  };

  const handleGenerateSteps = async () => {
    setStepsBusy(true);
    try {
      const res = await generateInboxNextSteps(workspaceId, conversation.id);
      if (!res.ok) {
        toast.show({
          message: res.error || 'Could not generate next steps.',
          tone: 'bad',
        });
      }
      onRetryCopilot();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Next steps failed.',
        tone: 'bad',
      });
    } finally {
      setStepsBusy(false);
    }
  };

  const handleAskCopilot = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = askInput.trim();
    if (!q || askBusy) return;
    setAskBusy(true);
    try {
      const res = await askInboxCopilot(workspaceId, conversation.id, q);
      if (!res.ok) {
        toast.show({
          message: res.error || 'Copilot could not answer.',
          tone: 'bad',
        });
      } else {
        setAskInput('');
        onRetryCopilot();
      }
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Copilot ask failed.',
        tone: 'bad',
      });
    } finally {
      setAskBusy(false);
    }
  };

  const sentiment =
    copilot?.nextSteps?.sentiment || conversation.sentiment || null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-30 bg-[var(--scrim)] xl:hidden"
      />
      <aside
        aria-label="Customer context and AI Copilot"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[340px] flex-col border-l border-o-border bg-o-surface shadow-[var(--shadow-lg)] xl:static xl:z-auto xl:h-full xl:w-[316px] xl:flex-none xl:shadow-none"
      >
      {/* Top Switcher */}
      <div className="flex flex-none items-center justify-between gap-2 border-b border-o-border px-3.5 py-2.5">
        <Segmented<ContextTab>
          label="Context drawer sections"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'details', label: 'Details' },
            { id: 'copilot', label: 'Copilot' },
          ]}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close customer drawer"
          className="o-focus rounded-full p-1.5 text-o-text-3 hover:bg-o-surface-2 hover:text-o-text xl:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Drawer Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'details' ? (
          <div className="divide-y divide-o-border">
            {/* Customer Profile Hero */}
            <div className="p-4">
              {customerLoading && !customer ? (
                <SkeletonRows rows={3} label="Loading customer profile" />
              ) : customerError && !customer ? (
                <ErrorState
                  title="Customer profile unavailable"
                  body={customerError}
                  onRetry={onRetryCustomer}
                />
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={customer?.name || conversation.visitorName}
                      size={44}
                      presence={
                        customer?.isOnline ? 'online' : 'offline'
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[14.5px] font-semibold text-o-text">
                        {customer?.name || conversation.visitorName}
                      </h3>
                      {(customer?.email || conversation.visitorEmail) ? (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-o-text-2">
                          <Mail className="h-3 w-3 flex-none" />
                          <span className="truncate">
                            {customer?.email || conversation.visitorEmail}
                          </span>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[12px] text-o-text-3">
                          No email captured yet
                        </p>
                      )}
                      <p className="mt-1 text-[11.5px] text-o-text-3">
                        {customer?.isOnline
                          ? 'Online right now'
                          : customer?.lastSeenAt
                            ? `Last seen ${timeAgo(customer.lastSeenAt)}`
                            : 'Offline'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Linked Ticket */}
            <section className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
                  Linked ticket
                </h4>
                {!detail.linkedTicket && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={onOpenCreateTicket}
                    leading={<Plus className="h-3.5 w-3.5" />}
                  >
                    Create ticket
                  </Button>
                )}
              </div>

              {detail.linkedTicket ? (
                <div className="rounded-[12px] border border-o-border bg-o-surface-2 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-semibold text-o-text">
                      #{detail.linkedTicket.number}
                    </span>
                    <Badge tone="neutral">{detail.linkedTicket.status}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12.5px] font-medium text-o-text">
                    {detail.linkedTicket.subject}
                  </p>
                  {detail.linkedTicket.slaNextDueAt && (
                    <p className="mt-1 text-[11px] text-o-text-2">
                      SLA due {timeAgo(detail.linkedTicket.slaNextDueAt)}
                    </p>
                  )}
                  <Link
                    href="/app/tickets"
                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-o-accent-text hover:underline"
                  >
                    Open in Tickets
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <p className="text-[12px] text-o-text-3">
                  No ticket linked to this conversation yet.
                </p>
              )}
            </section>

            {/* Tags */}
            <section className="p-4">
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {currentTags.length === 0 ? (
                  <span className="text-[12px] text-o-text-3">No tags applied</span>
                ) : (
                  currentTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-o-border bg-o-surface-2 px-2.5 py-0.5 text-[11.5px] font-medium text-o-text"
                    >
                      <Tag className="h-3 w-3 text-o-text-3" />
                      {tag}
                      <button
                        type="button"
                        disabled={tagBusy}
                        onClick={() => void handleRemoveTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                        className="o-focus rounded-full p-0.5 text-o-text-3 hover:text-o-bad"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAddTag(newTag);
                }}
                className="mt-2.5 flex gap-1.5"
              >
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag…"
                  aria-label="Add conversation tag"
                  className="o-input o-input--sm min-w-0 flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  type="submit"
                  disabled={!newTag.trim() || tagBusy}
                >
                  Add
                </Button>
              </form>

              {suggestedTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {suggestedTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={tagBusy}
                      onClick={() => void handleAddTag(t)}
                      className="o-focus rounded-full border border-dashed border-o-border px-2 py-0.5 text-[11px] text-o-text-2 hover:bg-o-surface-2 hover:text-o-text"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Visitor Properties */}
            {customer && (
              <section className="p-4">
                <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
                  Visitor context
                </h4>
                <dl className="space-y-2 text-[12.5px]">
                  <div className="flex items-start justify-between gap-2">
                    <dt className="flex items-center gap-1.5 text-o-text-3">
                      <MapPin className="h-3.5 w-3.5" /> Location
                    </dt>
                    <dd className="text-right font-medium text-o-text">
                      {customer.location.label
                        ? `${customer.location.flag ? `${customer.location.flag} ` : ''}${customer.location.label}${customer.localTime ? ` (${customer.localTime})` : ''}`
                        : 'Unknown'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <dt className="flex items-center gap-1.5 text-o-text-3">
                      <Laptop className="h-3.5 w-3.5" /> Device
                    </dt>
                    <dd className="text-right font-medium text-o-text">
                      {customer.ua.browserName} · {customer.ua.osName}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <dt className="flex items-center gap-1.5 text-o-text-3">
                      <Globe className="h-3.5 w-3.5" /> Language
                    </dt>
                    <dd className="text-right font-medium text-o-text">
                      {customer.browserLanguage || 'Unknown'}
                    </dd>
                  </div>
                  {customer.currentPageUrl && (
                    <div className="flex items-start justify-between gap-2">
                      <dt className="text-o-text-3">Current page</dt>
                      <dd className="max-w-[175px] truncate text-right font-mono text-[11.5px] text-o-text">
                        {customer.currentPageTitle || customer.currentPageUrl}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <dt className="text-o-text-3">Visits</dt>
                    <dd className="font-medium tabular-nums text-o-text">
                      {customer.visitCount}
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            {/* Thread Metrics & Intelligence */}
            <section className="p-4">
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
                Thread metrics
              </h4>
              <dl className="space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <dt className="text-o-text-3">Sentiment</dt>
                  <dd className="capitalize font-medium text-o-text">
                    {sentiment || 'Not analyzed'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-o-text-3">First teammate reply</dt>
                  <dd className="font-medium text-o-text">
                    {conversation.firstAgentReplyAt
                      ? timeAgo(conversation.firstAgentReplyAt)
                      : 'Pending'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-o-text-3">CSAT rating</dt>
                  <dd className="font-medium text-o-text">
                    {conversation.csatRating != null
                      ? `${conversation.csatRating} / 5`
                      : 'Not rated'}
                  </dd>
                </div>
              </dl>
              {customer && (
                <p className="mt-2 text-[11px] leading-snug text-o-text-3">
                  {customer.customerMetricsUnavailableReason}
                </p>
              )}
            </section>

            {/* Orders (Shopify Gap — honest state) */}
            <section className="p-4">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
                <ShoppingBag className="h-3.5 w-3.5" />
                Orders
              </h4>
              <p className="text-[12px] leading-relaxed text-o-text-3">
                {customer?.ordersUnavailableReason ||
                  'No storefront or Shopify integration connected yet.'}
              </p>
            </section>

            {/* Previous Conversations */}
            {customer && (
              <section className="p-4">
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
                  Previous conversations
                </h4>
                {customer.pastConversations.length === 0 ? (
                  <p className="text-[12px] text-o-text-3">
                    First conversation from this customer.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {customer.pastConversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectConversation(c.id)}
                        className="o-focus flex w-full items-center justify-between gap-2 rounded-[10px] border border-o-border bg-o-surface-2 px-2.5 py-2 text-left hover:bg-o-surface-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-o-text">
                            #{c.id.slice(0, 8)} · {c.channel}
                          </div>
                          <div className="text-[11px] text-o-text-3">
                            {timeAgo(c.updatedAt)}
                          </div>
                        </div>
                        <Badge tone="neutral">{c.status}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Page History */}
            {customer && customer.pageHistory.length > 0 && (
              <section className="p-4">
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
                  Recent pages visited
                </h4>
                <ul className="space-y-1.5">
                  {customer.pageHistory.slice(0, 5).map((p) => (
                    <li
                      key={p.id}
                      className="rounded-[10px] bg-o-surface-2 px-2.5 py-1.5 text-[11.5px]"
                    >
                      <div className="truncate font-medium text-o-text">
                        {p.title || p.url}
                      </div>
                      <div className="truncate font-mono text-[10.5px] text-o-text-3">
                        {p.url}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Notes guidance */}
            <section className="p-4">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
                <Lock className="h-3.5 w-3.5" />
                Internal notes
              </h4>
              <p className="text-[12px] leading-relaxed text-o-text-3">
                Private team notes are stored inside this thread so teammates see full context in chronological order.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={onSwitchToNoteComposer}
              >
                Write internal note
              </Button>
            </section>
          </div>
        ) : (
          /* Copilot Tab */
          <div className="space-y-4 p-4">
            {copilotLoading && !copilot ? (
              <SkeletonRows rows={5} label="Loading AI Copilot" />
            ) : copilotError && !copilot ? (
              <ErrorState
                title="Copilot unavailable"
                body={copilotError}
                onRetry={onRetryCopilot}
              />
            ) : !copilot?.availability.available ? (
              <Alert tone="ai">
                {copilot?.availability.reason ||
                  'AI Copilot is not enabled for this workspace yet.'}
              </Alert>
            ) : (
              <>
                {/* Summary */}
                <section className="rounded-[14px] border border-o-border bg-o-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-o-ai-text">
                      <Sparkles className="h-3.5 w-3.5" />
                      Summary
                    </h4>
                    <Button
                      size="sm"
                      variant="quiet"
                      icon
                      loading={summaryBusy}
                      onClick={() => void handleGenerateSummary()}
                      aria-label="Generate or refresh summary"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {copilot.summary ? (
                    <dl className="mt-2 space-y-1.5 text-[12px] leading-relaxed">
                      <div>
                        <dt className="font-semibold text-o-text">Issue</dt>
                        <dd className="text-o-text-2">{copilot.summary.issue}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-o-text">Tried</dt>
                        <dd className="text-o-text-2">{copilot.summary.tried}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-o-text">Pending action</dt>
                        <dd className="text-o-text-2">
                          {copilot.summary.pending_action}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <div className="mt-2">
                      <p className="text-[12px] text-o-text-3">
                        Summarize what the customer asked and what has been tried so far.
                      </p>
                      <Button
                        size="sm"
                        variant="ai"
                        loading={summaryBusy}
                        onClick={() => void handleGenerateSummary()}
                        className="mt-2"
                      >
                        Summarize thread
                      </Button>
                    </div>
                  )}
                </section>

                {/* Next Steps */}
                <section className="rounded-[14px] border border-o-border bg-o-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-o-text">
                      <ListChecks className="h-3.5 w-3.5 text-o-ai-text" />
                      Next steps & triage
                    </h4>
                    <Button
                      size="sm"
                      variant="quiet"
                      icon
                      loading={stepsBusy}
                      onClick={() => void handleGenerateSteps()}
                      aria-label="Generate next steps"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {copilot.nextSteps ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone="ai">{copilot.nextSteps.issue_type}</Badge>
                        <Badge tone="neutral">{copilot.nextSteps.sentiment}</Badge>
                      </div>
                      <ul className="space-y-1 text-[12px] text-o-text-2">
                        {copilot.nextSteps.next_steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-o-ai-text" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={stepsBusy}
                      onClick={() => void handleGenerateSteps()}
                      className="mt-2"
                    >
                      Analyze next steps
                    </Button>
                  )}
                </section>

                {/* Private Copilot Q&A */}
                <section className="space-y-2.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.06em] text-o-text-3">
                    Ask Copilot (private)
                  </h4>

                  {copilot.copilotMessages.length === 0 ? (
                    <EmptyState
                      title="Ask about policies or this thread"
                      body="Copilot searches your Knowledge Base and conversation history privately."
                      className="p-3"
                    />
                  ) : (
                    <div className="space-y-2">
                      {copilot.copilotMessages.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            'rounded-[12px] p-2.5 text-[12.5px] leading-relaxed',
                            m.role === 'agent'
                              ? 'bg-o-surface-2 text-o-text'
                              : 'border border-o-ai/25 bg-o-ai-soft text-o-text',
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
                            <span>{m.role === 'agent' ? 'You' : 'Copilot'}</span>
                            {m.role === 'copilot' && (
                              <span className="flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label="Helpful answer"
                                  onClick={() =>
                                    void recordInboxCopilotFeedback(
                                      workspaceId,
                                      m.event_id,
                                      'up',
                                      m.id,
                                    )
                                  }
                                  className="o-focus rounded p-0.5 text-o-ai-text hover:bg-o-surface/60"
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Unhelpful answer"
                                  onClick={() =>
                                    void recordInboxCopilotFeedback(
                                      workspaceId,
                                      m.event_id,
                                      'down',
                                      m.id,
                                    )
                                  }
                                  className="o-focus rounded p-0.5 text-o-ai-text hover:bg-o-surface/60"
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                </button>
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap break-words">
                            {m.content}
                          </p>
                          {m.sources.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {m.sources.map((s) => (
                                <Badge key={s.id} tone="ai">
                                  {s.title}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAskCopilot} className="flex gap-1.5">
                    <input
                      type="text"
                      value={askInput}
                      onChange={(e) => setAskInput(e.target.value)}
                      placeholder="Ask Copilot a question…"
                      aria-label="Ask Copilot"
                      className="o-input o-input--sm min-w-0 flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ai"
                      icon
                      type="submit"
                      loading={askBusy}
                      disabled={!askInput.trim()}
                      aria-label="Send Copilot question"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
