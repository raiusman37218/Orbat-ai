'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  useOrbToast,
} from '@/components/orbat/primitives';
import { errorMessage } from '@/lib/errors/user-error';
import {
  createNewTicket,
  mergeSelectedTickets,
  saveTicketView,
  searchRequesters,
  type TicketFilters,
  type TicketListItem,
  type TicketSort,
} from '@/lib/data/tickets';
import type { TicketChannel, TicketGroup, TicketPriority, TicketType } from '@/types/database';

export function NewTicketModal({
  open,
  workspaceId,
  agents,
  groups,
  onClose,
  onCreated,
}: {
  open: boolean;
  workspaceId: string;
  agents: Array<{ id: string; name: string }>;
  groups: TicketGroup[];
  onClose: () => void;
  onCreated: (ticketId: string) => void;
}) {
  const toast = useOrbToast();
  const [requesters, setRequesters] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);
  const [selectedRequesterId, setSelectedRequesterId] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<TicketChannel>('email');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [type, setType] = useState<TicketType>('question');
  const [groupId, setGroupId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    searchRequesters(workspaceId)
      .then((list) => {
        if (active) setRequesters(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open, workspaceId]);

  const handlePickRequester = (id: string) => {
    setSelectedRequesterId(id);
    const match = requesters.find((r) => r.id === id);
    if (match) {
      setRequesterName(match.name || '');
      setRequesterEmail(match.email || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const created = await createNewTicket(workspaceId, {
        requesterName: requesterName.trim() || requesterEmail.split('@')[0] || 'Customer',
        requesterEmail: requesterEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        channel,
        priority,
        type,
        groupId: groupId || null,
        assigneeId: assigneeId || null,
        tags,
      });
      toast.show({ tone: 'ok', message: `Created ticket #${created.number}` });
      setRequesterName('');
      setRequesterEmail('');
      setSelectedRequesterId('');
      setSubject('');
      setBody('');
      setTagsRaw('');
      onCreated(created.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="New ticket"
      description="Log a customer issue manually or open an outbound ticket thread."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-ticket-form" loading={busy}>
            Create ticket
          </Button>
        </>
      }
    >
      <form id="new-ticket-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        {requesters.length > 0 ? (
          <Field label="Existing customer (optional)" hint="Picking an existing customer prefills their contact details.">
            <Select
              value={selectedRequesterId}
              onChange={(e) => handlePickRequester(e.target.value)}
            >
              <option value="">Enter a new requester manually...</option>
              {requesters
                .filter((r) => r.email)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name ? `${r.name} (${r.email})` : r.email}
                  </option>
                ))}
            </Select>
          </Field>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Requester name">
            <Input
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              placeholder="Priya Nair"
              required
            />
          </Field>
          <Field label="Requester email">
            <Input
              type="email"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="priya@acme.com"
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

        <Field label="Description">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe the customer's question or issue..."
            rows={4}
            required
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as TicketChannel)}>
              <option value="email">Email</option>
              <option value="web_form">Web form</option>
              <option value="chat">Web chat</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as TicketType)}>
              <option value="question">Question</option>
              <option value="incident">Incident</option>
              <option value="problem">Problem</option>
              <option value="task">Task</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Team">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">No team</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assignee">
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Tags" hint="Comma-separated (e.g. billing, vip, refund)">
          <Input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="billing, priority-account"
          />
        </Field>
      </form>
    </Modal>
  );
}

export function MergeTicketsModal({
  open,
  workspaceId,
  tickets,
  onClose,
  onMerged,
}: {
  open: boolean;
  workspaceId: string;
  tickets: TicketListItem[];
  onClose: () => void;
  onMerged: (targetId: string) => void;
}) {
  const toast = useOrbToast();
  const [targetId, setTargetId] = useState(tickets[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveTargetId = tickets.some((t) => t.id === targetId)
    ? targetId
    : tickets[0]?.id ?? '';

  const handleMerge = async () => {
    if (!effectiveTargetId) return;
    setBusy(true);
    setError(null);
    try {
      const sources = tickets.filter((t) => t.id !== effectiveTargetId).map((t) => t.id);
      await mergeSelectedTickets(workspaceId, effectiveTargetId, sources);
      toast.show({
        tone: 'ok',
        message: `Merged ${sources.length} ticket${sources.length === 1 ? '' : 's'} cleanly.`,
      });
      onMerged(effectiveTargetId);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Merge tickets"
      description="All comments from secondary tickets are copied into the target ticket and secondary tickets are closed."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleMerge}
            loading={busy}
            disabled={!effectiveTargetId || tickets.length < 2}
          >
            Merge tickets
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <div className="o-alert o-alert--bad">{error}</div> : null}
        <Field label="Keep primary ticket">
          <Select value={effectiveTargetId} onChange={(e) => setTargetId(e.target.value)}>
            {tickets.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.number} — {t.subject}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

export function SaveViewModal({
  open,
  workspaceId,
  filters,
  sort,
  canShare,
  onClose,
  onSaved,
}: {
  open: boolean;
  workspaceId: string;
  filters: TicketFilters;
  sort: TicketSort;
  canShare: boolean;
  onClose: () => void;
  onSaved: (viewId: string) => void;
}) {
  const toast = useOrbToast();
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await saveTicketView(workspaceId, { name: name.trim(), filters, sort, shared });
      toast.show({ tone: 'ok', message: `Saved view “${saved.name}”` });
      setName('');
      onSaved(saved.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save current filter as view"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="save-ticket-view-form" loading={busy}>
            Save view
          </Button>
        </>
      }
    >
      <form id="save-ticket-view-form" onSubmit={handleSave} className="space-y-4">
        {error ? <div className="o-alert o-alert--bad">{error}</div> : null}
        <Field label="View name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. High priority billing queue"
            required
          />
        </Field>
        {canShare ? (
          <label className="flex items-center gap-2 text-[14px] text-o-text">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Share with everyone in this workspace
          </label>
        ) : null}
      </form>
    </Modal>
  );
}
