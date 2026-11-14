'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Lock,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  ConfirmDialog,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  useOrbToast,
} from '@/components/orbat/primitives';
import { timeAgo } from '@/components/orbat/overview/format';
import { errorMessage } from '@/lib/errors/user-error';
import {
  deleteSelectedTickets,
  draftTicketCopilotReply,
  generateTicketCopilotSummary,
  loadTicketCopilot,
  loadTicketDetail,
  postTicketReply,
  saveTicketCustomFieldValues,
  updateTicketPresence,
  updateTicketProperties,
  type CopilotPanelState,
  type TicketDetail,
  type TicketField,
  type TicketPresence,
} from '@/lib/data/tickets';
import type { Role } from '@/lib/team/permissions';
import { roleCan } from '@/lib/team/permissions';
import type { TicketGroup, TicketPriority, TicketStatus, TicketType } from '@/types/database';
import { SlaStatusBadge, TicketChannelPill, TicketStatusBadge } from './TicketBadges';

const EDITABLE_STATUSES: { value: TicketStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'solved', label: 'Solved' },
  { value: 'closed', label: 'Closed' },
];

export function TicketDetailDrawer(props: {
  ticketId: string | null;
  workspaceId: string;
  role: Role;
  agents: Array<{ id: string; name: string; avatar_url: string | null; is_active: boolean }>;
  groups: (TicketGroup & { member_ids: string[] })[];
  fields: TicketField[];
  onClose: () => void;
  onOpenTicket: (id: string) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  if (!props.ticketId) return null;
  return <TicketDetailDrawerBody key={props.ticketId} {...props} ticketId={props.ticketId} />;
}

function TicketDetailDrawerBody({
  ticketId,
  workspaceId,
  role,
  agents,
  groups,
  fields,
  onClose,
  onOpenTicket,
  onChanged,
  onDeleted,
}: {
  ticketId: string;
  workspaceId: string;
  role: Role;
  agents: Array<{ id: string; name: string; avatar_url: string | null; is_active: boolean }>;
  groups: (TicketGroup & { member_ids: string[] })[];
  fields: TicketField[];
  onClose: () => void;
  onOpenTicket: (id: string) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const toast = useOrbToast();
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [copilot, setCopilot] = useState<CopilotPanelState | null>(null);
  const [othersHere, setOthersHere] = useState<TicketPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subjectDraft, setSubjectDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [fieldDraft, setFieldDraft] = useState<Record<string, string | number | boolean | null>>({});
  const [fieldsSaving, setFieldsSaving] = useState(false);

  const canEdit = roleCan(role, 'edit_ticket');
  const canReply = roleCan(role, 'reply');
  const canNote = roleCan(role, 'add_note');

  const [composerMode, setComposerMode] = useState<'reply' | 'note'>(canReply ? 'reply' : 'note');
  const [replyBody, setReplyBody] = useState('');
  const [submitAs, setSubmitAs] = useState<TicketStatus | ''>('');
  const [sending, setSending] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const d = await loadTicketDetail(workspaceId, ticketId);
        setDetail(d);
        setSubjectDraft(d.ticket.subject);
        setFieldDraft((d.ticket.custom_fields || {}) as Record<string, string | number | boolean | null>);
        if (d.ticket.conversation_id) {
          loadTicketCopilot(workspaceId, d.ticket.conversation_id)
            .then((c) => setCopilot(c))
            .catch(() => setCopilot(null));
        } else {
          setCopilot(null);
        }
      } catch (err) {
        if (!silent) setError(errorMessage(err, 'Could not load ticket.'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [ticketId, workspaceId],
  );

  useEffect(() => {
    let active = true;
    loadTicketDetail(workspaceId, ticketId)
      .then((d) => {
        if (!active) return;
        setDetail(d);
        setSubjectDraft(d.ticket.subject);
        setFieldDraft(
          (d.ticket.custom_fields || {}) as Record<string, string | number | boolean | null>,
        );
        if (d.ticket.conversation_id) {
          loadTicketCopilot(workspaceId, d.ticket.conversation_id)
            .then((c) => {
              if (active) setCopilot(c);
            })
            .catch(() => {
              if (active) setCopilot(null);
            });
        } else {
          setCopilot(null);
        }
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, 'Could not load ticket.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ticketId, workspaceId]);

  // Live collision presence while drawer is open
  useEffect(() => {
    const state = composerMode === 'note' ? 'noting' : replyBody.trim() ? 'replying' : 'viewing';
    let cancelled = false;
    const ping = () => {
      updateTicketPresence(workspaceId, ticketId, state)
        .then((list) => {
          if (!cancelled) setOthersHere(list);
        })
        .catch(() => undefined);
    };
    ping();
    const timer = window.setInterval(ping, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      updateTicketPresence(workspaceId, ticketId, null).catch(() => undefined);
    };
  }, [ticketId, workspaceId, composerMode, replyBody]);

  // Escape key closes drawer when modal dialog isn't active
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDeleteOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDeleteOpen, onClose]);

  const ticket = detail?.ticket;
  const isClosed = ticket?.status === 'closed';
  const readOnlyProps = isClosed || !canEdit;

  const eligibleAgents = useMemo(() => {
    const active = agents.filter((a) => a.is_active);
    if (!ticket?.group_id) return active;
    const grp = groups.find((g) => g.id === ticket.group_id);
    if (!grp || grp.member_ids.length === 0) return active;
    return active.filter((a) => grp.member_ids.includes(a.id) || a.id === ticket.assignee_id);
  }, [agents, groups, ticket]);

  const attachments = useMemo(() => {
    if (!detail) return [];
    return detail.messages
      .filter((m) => Boolean(m.attachment_url))
      .map((m) => ({
        id: m.id,
        url: m.attachment_url as string,
        createdAt: m.created_at,
        sender: m.sender_type,
      }));
  }, [detail]);

  const timelineItems = useMemo(() => {
    if (!detail) return [];
    const items: Array<
      | { kind: 'message'; id: string; at: string; msg: TicketDetail['messages'][number] }
      | { kind: 'event'; id: string; at: string; ev: TicketDetail['events'][number] }
    > = [];
    for (const m of detail.messages) {
      items.push({ kind: 'message', id: `m-${m.id}`, at: m.created_at, msg: m });
    }
    for (const ev of detail.events) {
      items.push({ kind: 'event', id: `e-${ev.id}`, at: ev.created_at, ev });
    }
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return items;
  }, [detail]);

  if (!ticketId) return null;

  const patchProp = async (
    patch: Parameters<typeof updateTicketProperties>[2],
    successMsg?: string,
  ) => {
    if (!ticket) return;
    try {
      await updateTicketProperties(workspaceId, ticket.id, patch);
      if (successMsg) toast.show({ tone: 'ok', message: successMsg });
      await fetchDetail(true);
      onChanged();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    }
  };

  const handleAddTag = async () => {
    if (!ticket || readOnlyProps) return;
    const clean = tagDraft.trim();
    if (!clean) return;
    const next = Array.from(new Set([...(ticket.tags || []), clean]));
    setTagDraft('');
    await patchProp({ tags: next });
  };

  const handleRemoveTag = async (tag: string) => {
    if (!ticket || readOnlyProps) return;
    await patchProp({ tags: (ticket.tags || []).filter((t) => t !== tag) });
  };

  const handleSaveCustomFields = async () => {
    if (!ticket || readOnlyProps) return;
    setFieldsSaving(true);
    try {
      await saveTicketCustomFieldValues(workspaceId, ticket.id, fieldDraft);
      toast.show({ tone: 'ok', message: 'Custom fields updated.' });
      await fetchDetail(true);
      onChanged();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setFieldsSaving(false);
    }
  };

  const handleSendComposer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyBody.trim()) return;
    const internal = composerMode === 'note' || !canReply;
    setSending(true);
    try {
      await postTicketReply(workspaceId, ticket.id, {
        body: replyBody.trim(),
        internal,
        submitAs: !internal && submitAs ? submitAs : canEdit && submitAs ? submitAs : undefined,
      });
      toast.show({
        tone: 'ok',
        message: internal ? 'Internal note added.' : 'Reply sent to requester.',
      });
      setReplyBody('');
      setSubmitAs('');
      await fetchDetail(true);
      onChanged();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const handleCopilotSummary = async () => {
    if (!ticket?.conversation_id) return;
    setAiBusy(true);
    try {
      await generateTicketCopilotSummary(workspaceId, ticket.conversation_id);
      const updated = await loadTicketCopilot(workspaceId, ticket.conversation_id);
      setCopilot(updated);
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err, 'Could not refresh Copilot summary.') });
    } finally {
      setAiBusy(false);
    }
  };

  const handleCopilotDraft = async () => {
    if (!ticket?.conversation_id || !canReply || isClosed) return;
    setAiBusy(true);
    try {
      const suggested = await draftTicketCopilotReply(workspaceId, ticket.conversation_id);
      if (suggested?.draft) {
        setComposerMode('reply');
        setReplyBody(suggested.draft);
        toast.show({ tone: 'info', message: 'Inserted Copilot draft into reply box.' });
      }
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err, 'Could not draft reply.') });
    } finally {
      setAiBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!ticket) return;
    setDeleting(true);
    try {
      const res = await deleteSelectedTickets(workspaceId, [ticket.id]);
      if (res.deleted > 0) {
        toast.show({ tone: 'ok', message: `Deleted ticket #${ticket.number}` });
        setConfirmDeleteOpen(false);
        onDeleted();
        onClose();
      } else {
        toast.show({ tone: 'bad', message: res.skipped[0]?.reason || 'Could not delete ticket.' });
        setConfirmDeleteOpen(false);
      }
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="o-slideover-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={ticket ? `Ticket #${ticket.number}` : 'Ticket details'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className="o-slideover-panel">
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-o-border px-5 py-4">
          <div className="min-w-0 flex-1">
            {loading && !detail ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            ) : ticket ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral" className="o-mono">
                    #{ticket.number}
                  </Badge>
                  <TicketStatusBadge status={ticket.status} />
                  <TicketChannelPill channel={ticket.channel} />
                  <SlaStatusBadge
                    slaState={ticket.sla_state}
                    breachedAt={ticket.sla_breached_at}
                    warnAt={ticket.sla_next_warn_at}
                    dueAt={ticket.sla_next_due_at}
                  />
                </div>
                <input
                  value={subjectDraft}
                  disabled={readOnlyProps}
                  aria-label="Ticket subject"
                  onChange={(e) => setSubjectDraft(e.target.value)}
                  onBlur={() => {
                    const next = subjectDraft.trim();
                    if (next && next !== ticket.subject) {
                      patchProp({ subject: next }, 'Updated subject');
                    } else {
                      setSubjectDraft(ticket.subject);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="mt-2 w-full rounded-lg bg-transparent px-1.5 py-1 -mx-1.5 text-[18px] font-bold text-o-text hover:bg-o-surface-2 focus:bg-o-surface-2 focus:outline-none disabled:hover:bg-transparent"
                />
              </>
            ) : (
              <h2 className="text-[17px] font-bold text-o-text">Ticket details</h2>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {ticket?.conversation_id ? (
              <ButtonLink
                href={`/app/inbox?c=${ticket.conversation_id}`}
                variant="secondary"
                size="sm"
                trailing={<ArrowUpRight size={14} aria-hidden="true" />}
              >
                <span className="max-sm:hidden">Inbox</span>
              </ButtonLink>
            ) : null}
            {ticket && canEdit && !isClosed ? (
              <Button
                variant="quiet"
                size="sm"
                icon
                aria-label="Delete ticket"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 size={15} className="text-o-bad" aria-hidden="true" />
              </Button>
            ) : null}
            <Button variant="quiet" size="sm" icon aria-label="Close drawer" onClick={onClose}>
              <X size={18} aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error ? (
            <ErrorState title="Could not load ticket" body={error} onRetry={() => fetchDetail(false)} />
          ) : loading && !detail ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          ) : detail && ticket ? (
            <>
              {isClosed ? (
                <Alert tone="warn">
                  This ticket is closed and archived as read-only history.
                </Alert>
              ) : null}

              {othersHere.length > 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-o-border bg-o-surface-2 px-3 py-2 text-[12.5px] text-o-text-2">
                  <span className="h-2 w-2 rounded-full bg-o-warn" aria-hidden="true" />
                  <span>
                    {othersHere.map((p) => `${p.name} (${p.state})`).join(', ')} on this ticket
                  </span>
                </div>
              ) : null}

              {/* Requester bar */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-o-border bg-o-bg px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={detail.requester?.name || detail.requester?.email || 'Requester'} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-o-text">
                      {detail.requester?.name || detail.requester?.email || 'Unknown requester'}
                    </p>
                    <p className="truncate text-[12px] text-o-text-3">
                      {detail.requester?.email || 'No email on file'}
                      {detail.requester?.ip_location_country ? ` · ${detail.requester.ip_location_country}` : ''}
                    </p>
                  </div>
                </div>
                {detail.requester?.id ? (
                  <Link
                    href={`/app/customers?id=${detail.requester.id}`}
                    className="shrink-0 text-[12.5px] font-semibold text-o-accent-text hover:underline"
                  >
                    View profile
                  </Link>
                ) : null}
              </div>

              {/* Properties grid */}
              <section aria-label="Ticket properties" className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <Select
                    size="sm"
                    value={ticket.status}
                    disabled={readOnlyProps}
                    onChange={(e) => patchProp({ status: e.target.value as TicketStatus })}
                  >
                    {EDITABLE_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Priority">
                  <Select
                    size="sm"
                    value={ticket.priority}
                    disabled={readOnlyProps}
                    onChange={(e) => patchProp({ priority: e.target.value as TicketPriority })}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </Field>

                <Field label="Assignee">
                  <Select
                    size="sm"
                    value={ticket.assignee_id ?? ''}
                    disabled={readOnlyProps}
                    onChange={(e) => patchProp({ assignee_id: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {eligibleAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Team">
                  <Select
                    size="sm"
                    value={ticket.group_id ?? ''}
                    disabled={readOnlyProps}
                    onChange={(e) => patchProp({ group_id: e.target.value || null })}
                  >
                    <option value="">No team</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Type" className="col-span-2 sm:col-span-1">
                  <Select
                    size="sm"
                    value={ticket.type}
                    disabled={readOnlyProps}
                    onChange={(e) => patchProp({ type: e.target.value as TicketType })}
                  >
                    <option value="question">Question</option>
                    <option value="incident">Incident</option>
                    <option value="problem">Problem</option>
                    <option value="task">Task</option>
                  </Select>
                </Field>
              </section>

              {/* Tags */}
              <section aria-label="Ticket tags" className="space-y-2">
                <p className="o-cap">Tags</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(ticket.tags || []).length === 0 ? (
                    <span className="text-[12.5px] text-o-text-3">No tags</span>
                  ) : (
                    ticket.tags.map((t) => (
                      <Badge key={t} tone="neutral">
                        <span>{t}</span>
                        {!readOnlyProps ? (
                          <button
                            type="button"
                            aria-label={`Remove tag ${t}`}
                            onClick={() => handleRemoveTag(t)}
                            className="ml-1 text-o-text-3 hover:text-o-text"
                          >
                            ×
                          </button>
                        ) : null}
                      </Badge>
                    ))
                  )}
                  {!readOnlyProps ? (
                    <form
                      className="inline-flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddTag();
                      }}
                    >
                      <Input
                        size="sm"
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        placeholder="+ tag"
                        aria-label="Add tag"
                        className="!h-7 w-24 !rounded-full !px-2.5 !text-[12px]"
                      />
                      {tagDraft.trim() ? (
                        <Button type="submit" variant="ghost" size="sm" className="!h-7 !px-2 text-[12px]">
                          <Plus size={12} />
                        </Button>
                      ) : null}
                    </form>
                  ) : null}
                </div>
              </section>

              {/* ORBAT Copilot */}
              <section
                aria-label="Copilot summary"
                className="rounded-2xl border border-o-border bg-o-ai-soft/50 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-o-ai-text">
                    <Sparkles size={15} aria-hidden="true" />
                    <span>ORBAT Copilot</span>
                  </div>
                  {ticket.conversation_id ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!h-7 !px-2.5 !text-[12px]"
                        onClick={handleCopilotSummary}
                        loading={aiBusy}
                      >
                        Summarize
                      </Button>
                      {canReply && !isClosed ? (
                        <Button
                          variant="ai"
                          size="sm"
                          className="!h-7 !px-2.5 !text-[12px]"
                          onClick={handleCopilotDraft}
                          loading={aiBusy}
                        >
                          Draft reply
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {!ticket.conversation_id ? (
                  <p className="text-[13px] text-o-text-2">
                    Copilot summaries require a linked conversation thread.
                  </p>
                ) : copilot?.summary ? (
                  <div className="space-y-1.5 text-[13px] text-o-text">
                    {copilot.summary.issue ? (
                      <p className="m-0">
                        <strong className="font-semibold">Issue:</strong> {copilot.summary.issue}
                      </p>
                    ) : null}
                    {copilot.summary.tried ? (
                      <p className="m-0 text-o-text-2">
                        <strong className="font-semibold text-o-text">Tried:</strong> {copilot.summary.tried}
                      </p>
                    ) : null}
                    {copilot.summary.pending_action ? (
                      <p className="m-0 text-o-text-2">
                        <strong className="font-semibold text-o-text">Next:</strong> {copilot.summary.pending_action}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[13px] text-o-text-2">
                    {copilot?.availability?.available === false
                      ? copilot.availability.reason || 'Workspace AI is not configured for Copilot yet.'
                      : 'Click Summarize to extract the key points from this ticket.'}
                  </p>
                )}
              </section>

              {/* Attachments */}
              {attachments.length > 0 ? (
                <section aria-label="Attachments" className="space-y-2">
                  <p className="o-cap">Attachments ({attachments.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-o-border bg-o-surface-2 px-3 py-1.5 text-[12.5px] font-medium text-o-text hover:border-o-border-strong"
                      >
                        <Paperclip size={13} aria-hidden="true" />
                        <span className="max-w-[180px] truncate">
                          {att.url.split('/').pop() || 'Attachment'}
                        </span>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Custom ticket fields */}
              {fields.filter((f) => f.is_active).length > 0 ? (
                <section aria-label="Custom fields" className="space-y-3 rounded-2xl border border-o-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="o-cap">Custom fields</p>
                    {!readOnlyProps ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="!h-7 !px-3 !text-[12px]"
                        onClick={handleSaveCustomFields}
                        loading={fieldsSaving}
                      >
                        Save fields
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {fields
                      .filter((f) => f.is_active)
                      .map((f) => {
                        const val = fieldDraft[f.key];
                        if (f.type === 'checkbox') {
                          return (
                            <label key={f.id} className="flex items-center gap-2 text-[13.5px] text-o-text">
                              <input
                                type="checkbox"
                                checked={Boolean(val)}
                                disabled={readOnlyProps}
                                onChange={(e) =>
                                  setFieldDraft((prev) => ({ ...prev, [f.key]: e.target.checked }))
                                }
                                className="h-4 w-4 accent-[var(--accent)]"
                              />
                              <span>{f.label}</span>
                            </label>
                          );
                        }
                        if (f.type === 'dropdown') {
                          return (
                            <Field key={f.id} label={f.label}>
                              <Select
                                size="sm"
                                value={val == null ? '' : String(val)}
                                disabled={readOnlyProps}
                                onChange={(e) =>
                                  setFieldDraft((prev) => ({ ...prev, [f.key]: e.target.value || null }))
                                }
                              >
                                <option value="">Select...</option>
                                {f.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                          );
                        }
                        return (
                          <Field key={f.id} label={f.label}>
                            <Input
                              size="sm"
                              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                              value={val == null ? '' : String(val)}
                              disabled={readOnlyProps}
                              onChange={(e) =>
                                setFieldDraft((prev) => ({ ...prev, [f.key]: e.target.value }))
                              }
                            />
                          </Field>
                        );
                      })}
                  </div>
                </section>
              ) : null}

              {/* Related tickets */}
              {detail.previousTickets.length > 0 ? (
                <section aria-label="Related tickets" className="space-y-2">
                  <p className="o-cap">Other tickets from this requester</p>
                  <div className="divide-y divide-o-border rounded-2xl border border-o-border overflow-hidden">
                    {detail.previousTickets.slice(0, 5).map((rel) => (
                      <button
                        key={rel.id}
                        type="button"
                        onClick={() => onOpenTicket(rel.id)}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] hover:bg-o-surface-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-o-text">
                          <span className="o-mono text-o-text-3 mr-1.5">#{rel.number}</span>
                          {rel.subject}
                        </span>
                        <TicketStatusBadge status={rel.status} />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Activity Timeline */}
              <section aria-label="Activity timeline" className="space-y-2.5">
                <p className="o-cap">Activity</p>
                {timelineItems.length === 0 ? (
                  <p className="text-[13.5px] text-o-text-3">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {timelineItems.map((item) => {
                      if (item.kind === 'event') {
                        const ev = item.ev;
                        const actor = ev.actor_id ? detail.people[ev.actor_id] || 'Team' : ev.actor_type;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 text-[12px] text-o-text-3 px-1"
                          >
                            <span className="truncate">
                              <strong className="font-semibold text-o-text-2">{actor}</strong>{' '}
                              {ev.action}
                              {ev.field ? ` ${ev.field}` : ''}
                              {ev.new_value ? ` → ${ev.new_value}` : ''}
                            </span>
                            <span className="shrink-0">{timeAgo(ev.created_at)}</span>
                          </div>
                        );
                      }

                      const m = item.msg;
                      const author =
                        m.sender_id && detail.people[m.sender_id]
                          ? detail.people[m.sender_id]
                          : m.sender_type === 'visitor'
                            ? detail.requester?.name || 'Requester'
                            : m.sender_type === 'ai'
                              ? 'ORBAT AI'
                              : 'System';

                      if (m.is_internal) {
                        return (
                          <article key={item.id} className="o-internal-note px-3.5 py-2.5 text-[13.5px]">
                            <header className="mb-1 flex items-center justify-between gap-2 text-[11.5px] font-semibold text-o-warn">
                              <span className="inline-flex items-center gap-1">
                                <Lock size={12} aria-hidden="true" />
                                Internal note · {author}
                              </span>
                              <span className="text-o-text-3 font-normal">{timeAgo(m.created_at)}</span>
                            </header>
                            <p className="whitespace-pre-wrap text-o-text">{m.content}</p>
                          </article>
                        );
                      }

                      const isCustomer = m.sender_type === 'visitor';
                      return (
                        <article
                          key={item.id}
                          className="rounded-2xl border border-o-border bg-o-bg px-3.5 py-2.5 text-[13.5px]"
                        >
                          <header className="mb-1 flex items-center justify-between gap-2 text-[12px] text-o-text-3">
                            <span className="font-semibold text-o-text">
                              {author}
                              {isCustomer ? '' : ` (${m.sender_type})`}
                            </span>
                            <span>{timeAgo(m.created_at)}</span>
                          </header>
                          <p className="whitespace-pre-wrap text-o-text">{m.content}</p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>

        {/* Inline Reply / Internal Note composer */}
        {ticket && !isClosed && (canReply || canNote) ? (
          <form onSubmit={handleSendComposer} className="border-t border-o-border bg-o-bg p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="o-seg" role="radiogroup" aria-label="Message mode">
                {canReply ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={composerMode === 'reply'}
                    className="o-seg__item !h-7 !px-3 !text-[12.5px]"
                    onClick={() => setComposerMode('reply')}
                  >
                    Public reply
                  </button>
                ) : null}
                {canNote ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={composerMode === 'note' || !canReply}
                    className="o-seg__item !h-7 !px-3 !text-[12.5px]"
                    onClick={() => setComposerMode('note')}
                  >
                    Internal note
                  </button>
                ) : null}
              </div>

              {canEdit && (composerMode === 'reply' && canReply) ? (
                <Select
                  size="sm"
                  value={submitAs}
                  onChange={(e) => setSubmitAs(e.target.value as TicketStatus | '')}
                  aria-label="Submit ticket status"
                  className="!h-8 !w-auto !text-[12.5px]"
                >
                  <option value="">Keep status ({ticket.status})</option>
                  <option value="open">Submit as Open</option>
                  <option value="pending">Submit as Pending</option>
                  <option value="solved">Submit as Solved</option>
                </Select>
              ) : null}
            </div>

            <Textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={2}
              placeholder={
                composerMode === 'note' || !canReply
                  ? 'Write an internal note visible only to your team...'
                  : 'Write a reply to the requester...'
              }
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && replyBody.trim()) {
                  e.preventDefault();
                  handleSendComposer(e);
                }
              }}
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-o-text-3">Ctrl/⌘ + Enter to send</span>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={sending}
                disabled={!replyBody.trim()}
                trailing={<Send size={13} aria-hidden="true" />}
              >
                {composerMode === 'note' || !canReply ? 'Add note' : 'Send reply'}
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title={ticket ? `Delete ticket #${ticket.number}?` : 'Delete ticket?'}
        body="This permanently removes the ticket, its SLA timers, and its audit events. This action cannot be undone."
        confirmLabel="Delete ticket"
        busy={deleting}
      />
    </div>
  );
}
