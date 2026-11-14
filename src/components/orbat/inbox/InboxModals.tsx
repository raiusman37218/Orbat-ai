'use client';

/**
 * Dialogs for secondary Inbox workflows: custom snooze, merging threads,
 * creating a ticket from a conversation, bulk assigning, and confirming deletion.
 */

import { useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  SkeletonRows,
  Textarea,
} from '@/components/orbat/primitives';
import { timeAgo } from '@/components/orbat/overview/format';
import { useData } from '@/lib/data/use-data';
import {
  listMergeCandidates,
  type InboxAgent,
  type InboxConversationItem,
} from '@/lib/data/inbox';
import type { TicketChannel, TicketPriority } from '@/types/database';

/* ── Custom Snooze ─────────────────────────────────────────────────────── */

function defaultSnoozeInput(): string {
  const d = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SnoozeFormBody({
  onConfirm,
}: {
  onConfirm: (iso: string) => Promise<void>;
}) {
  const [dateTime, setDateTime] = useState(defaultSnoozeInput);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = new Date(dateTime);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      setErr('Choose a date and time in the future.');
      return;
    }
    setErr(null);
    await onConfirm(parsed.toISOString());
  };

  return (
    <form id="snooze-custom-form" onSubmit={handleSubmit} className="space-y-3">
      <Field label="Reopen at" error={err ?? undefined}>
        <Input
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          required
        />
      </Field>
    </form>
  );
}

export function SnoozeModal({
  open,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (iso: string) => Promise<void>;
  busy: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Snooze conversation"
      description="The thread moves out of Open and reopens automatically at your chosen time."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="snooze-custom-form" loading={busy}>
            Snooze
          </Button>
        </>
      }
    >
      {open && <SnoozeFormBody onConfirm={onConfirm} />}
    </Modal>
  );
}

/* ── Merge Conversation ────────────────────────────────────────────────── */

function MergeModalBody({
  workspaceId,
  conversation,
  selectedSourceId,
  onSelectSource,
}: {
  workspaceId: string;
  conversation: InboxConversationItem;
  selectedSourceId: string;
  onSelectSource: (id: string) => void;
}) {
  const candidatesState = useData(
    () =>
      listMergeCandidates(
        workspaceId,
        conversation.visitorId,
        conversation.visitorEmail,
        conversation.id,
      ),
    ['merge-candidates', workspaceId, conversation.id],
  );

  if (candidatesState.loading) {
    return <SkeletonRows rows={3} label="Loading customer conversations" />;
  }
  if (candidatesState.error) {
    return (
      <ErrorState
        title="Could not load threads"
        body={candidatesState.error}
        onRetry={candidatesState.reload}
      />
    );
  }
  const candidates = candidatesState.data || [];
  if (candidates.length === 0) {
    return (
      <EmptyState
        title="No other threads found"
        body="This customer doesn't have any other conversations to merge."
      />
    );
  }

  return (
    <div className="space-y-2">
      {candidates.map((c) => {
        const active = c.id === selectedSourceId;
        return (
          <label
            key={c.id}
            className={`flex cursor-pointer items-start gap-3 rounded-[14px] border p-3 transition-colors ${
              active
                ? 'border-o-accent-text bg-o-accent-soft'
                : 'border-o-border bg-o-surface hover:bg-o-surface-2'
            }`}
          >
            <input
              type="radio"
              name="merge-source"
              checked={active}
              onChange={() => onSelectSource(c.id)}
              className="mt-1 accent-o-accent-text"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-o-text">
                  {c.channelName} thread
                </span>
                <span className="text-[11px] text-o-text-3">
                  {timeAgo(c.lastActivityAt)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[12px] text-o-text-2">
                {c.lastMessagePreview}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Badge tone="neutral">{c.status}</Badge>
                <span className="font-mono text-[11px] text-o-text-3">
                  #{c.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

export function MergeModal({
  open,
  onClose,
  workspaceId,
  conversation,
  onConfirmMerge,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  conversation: InboxConversationItem;
  onConfirmMerge: (sourceId: string) => Promise<void>;
  busy: boolean;
}) {
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');

  const handleClose = () => {
    setSelectedSourceId('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Merge conversation"
      description="Move all messages, notes, and tags from another thread for this customer into this conversation."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selectedSourceId}
            loading={busy}
            onClick={() => selectedSourceId && void onConfirmMerge(selectedSourceId)}
          >
            Merge into this thread
          </Button>
        </>
      }
    >
      {open && (
        <MergeModalBody
          workspaceId={workspaceId}
          conversation={conversation}
          selectedSourceId={selectedSourceId}
          onSelectSource={setSelectedSourceId}
        />
      )}
    </Modal>
  );
}

/* ── Create Ticket Modal ───────────────────────────────────────────────── */

function toTicketChannel(channel: string): TicketChannel {
  switch (channel) {
    case 'whatsapp':
    case 'instagram':
    case 'threads':
    case 'linkedin':
      return channel;
    default:
      return 'chat';
  }
}

function CreateTicketForm({
  conversation,
  agents,
  initialDescription,
  onCreate,
}: {
  conversation: InboxConversationItem;
  agents: InboxAgent[];
  initialDescription: string;
  onCreate: (input: {
    requesterName: string;
    requesterEmail: string;
    subject: string;
    body: string;
    channel: TicketChannel;
    priority: TicketPriority;
    assigneeId: string | null;
    tags: string[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState(conversation.visitorName);
  const [email, setEmail] = useState(conversation.visitorEmail || '');
  const [subject, setSubject] = useState(
    conversation.handoffSummary?.slice(0, 80) ||
      `Follow-up: ${conversation.visitorName}`,
  );
  const [body, setBody] = useState(
    initialDescription || conversation.lastMessagePreview || '',
  );
  const [priority, setPriority] = useState<TicketPriority>(
    conversation.priority === 'urgent' ||
      conversation.priority === 'high' ||
      conversation.priority === 'low'
      ? conversation.priority
      : 'normal',
  );
  const [assigneeId, setAssigneeId] = useState<string>(
    conversation.assignedAgentId || '',
  );
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !subject.trim() || !body.trim()) {
      setErr('Requester email, subject, and details are required.');
      return;
    }
    setErr(null);
    try {
      await onCreate({
        requesterName: name.trim() || email.trim(),
        requesterEmail: email.trim(),
        subject: subject.trim(),
        body: body.trim(),
        channel: toTicketChannel(conversation.channel),
        priority,
        assigneeId: assigneeId || null,
        tags: conversation.tags,
      });
    } catch (submitErr) {
      setErr(
        submitErr instanceof Error
          ? submitErr.message
          : 'Could not create ticket.',
      );
    }
  };

  return (
    <form id="create-ticket-form" onSubmit={handleSubmit} className="space-y-3.5">
      {err && <Alert tone="bad">{err}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Requester name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer name"
          />
        </Field>
        <Field label="Requester email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@company.com"
            required
          />
        </Field>
      </div>

      <Field label="Subject">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief summary of the request"
          required
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Priority">
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
        </Field>
        <Field label="Assignee">
          <Select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            options={[
              { value: '', label: 'Unassigned' },
              ...agents
                .filter((a) => a.isActive)
                .map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </Field>
      </div>

      <Field label="Description">
        <Textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Context from the conversation…"
          required
        />
      </Field>
    </form>
  );
}

export function CreateTicketModal({
  open,
  onClose,
  conversation,
  agents,
  initialDescription,
  onCreate,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  conversation: InboxConversationItem;
  agents: InboxAgent[];
  initialDescription: string;
  onCreate: (input: {
    requesterName: string;
    requesterEmail: string;
    subject: string;
    body: string;
    channel: TicketChannel;
    priority: TicketPriority;
    assigneeId: string | null;
    tags: string[];
  }) => Promise<void>;
  busy: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Create ticket"
      description="Escalate this conversation into a tracked support ticket with SLAs and audit history."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="create-ticket-form" loading={busy}>
            Create ticket
          </Button>
        </>
      }
    >
      {open && (
        <CreateTicketForm
          key={conversation.id}
          conversation={conversation}
          agents={agents}
          initialDescription={initialDescription}
          onCreate={onCreate}
        />
      )}
    </Modal>
  );
}

/* ── Bulk Assign Modal ─────────────────────────────────────────────────── */

export function BulkAssignModal({
  open,
  count,
  agents,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  count: number;
  agents: InboxAgent[];
  onClose: () => void;
  onConfirm: (agentId: string | null) => Promise<void>;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<string>('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign ${count} conversation${count === 1 ? '' : 's'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => void onConfirm(selected || null)}
          >
            Apply assignment
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-o-border p-2.5 hover:bg-o-surface-2">
          <input
            type="radio"
            name="bulk-assignee"
            checked={selected === ''}
            onChange={() => setSelected('')}
            className="accent-o-accent-text"
          />
          <span className="text-[13.5px] font-medium text-o-text">Unassigned</span>
        </label>
        {agents
          .filter((a) => a.isActive)
          .map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-[12px] border border-o-border p-2.5 hover:bg-o-surface-2"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <input
                  type="radio"
                  name="bulk-assignee"
                  checked={selected === a.id}
                  onChange={() => setSelected(a.id)}
                  className="accent-o-accent-text"
                />
                <Avatar
                  name={a.name}
                  src={a.avatarUrl}
                  size={28}
                  presence={
                    a.status === 'online' || a.status === 'away'
                      ? a.status
                      : 'offline'
                  }
                />
                <span className="truncate text-[13.5px] font-medium text-o-text">
                  {a.name}
                </span>
              </span>
              <span className="text-[11.5px] text-o-text-3">{a.role}</span>
            </label>
          ))}
      </div>
    </Modal>
  );
}

/* ── Delete Message Confirm ────────────────────────────────────────────── */

export function DeleteMessageConfirm({
  open,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  busy: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete message?"
      body="This removes the message from the thread permanently."
      confirmLabel="Delete message"
      variant="danger"
      busy={busy}
    />
  );
}
