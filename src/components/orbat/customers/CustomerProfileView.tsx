'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  Circle,
  Eye,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  SkeletonRows,
  Tabs,
  Textarea,
  useOrbToast,
  type BadgeTone,
  type TabItem,
} from '@/components/orbat/primitives';
import { fmtInt, timeAgo } from '@/components/orbat/overview/format';
import {
  addCustomerNote,
  deleteCrmDeal,
  deleteCrmTask,
  deleteCustomerNote,
  formatMoneyCents,
  getCustomerProfile,
  refreshCustomerSummary,
  startCustomerConversation,
  updateCrmDeal,
  updateCrmTask,
  updateCustomer,
  type CrmDealRecord,
  type CrmDealStage,
  type CrmTaskRecord,
} from '@/lib/data/customers';
import { useData } from '@/lib/data/use-data';
import { errorMessage } from '@/lib/errors/user-error';
import {
  AddOrderModal,
  CreateCustomerTicketModal,
  EditCustomerModal,
} from './CustomerModals';
import {
  CRM_DEAL_STAGES,
  DealModal,
  TaskModal,
  dealStageMeta,
  isTaskOverdue,
  taskKindLabel,
  taskPriorityTone,
} from './CrmSalesViews';

export function segmentBadgeTone(segment: string | null | undefined): BadgeTone {
  switch ((segment || '').toLowerCase()) {
    case 'vip':
      return 'ai';
    case 'churn risk':
      return 'bad';
    case 'new':
      return 'accent';
    case 'wholesale':
      return 'ok';
    default:
      return 'neutral';
  }
}

export function orderStatusColorClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'paid':
    case 'fulfilled':
      return 'text-o-ok font-medium';
    case 'delayed':
    case 'processing':
    case 'shipped':
      return 'text-o-warn font-medium';
    case 'refunded':
    case 'cancelled':
      return 'text-o-bad font-medium';
    default:
      return 'text-o-text-2';
  }
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type ProfileTab = 'timeline' | 'deals' | 'tasks' | 'convos' | 'orders' | 'tickets';

interface TimelineEntry {
  id: string;
  at: string;
  title: string;
  meta: string;
  href?: string;
  kind: 'convo' | 'ticket' | 'order' | 'page' | 'deal' | 'task';
}

export function CustomerProfileView({
  workspaceId,
  visitorId,
  canEdit,
  canAddNote,
  canReply,
  currentAgentId,
  onBack,
  onChanged,
}: {
  workspaceId: string;
  visitorId: string;
  canEdit: boolean;
  canAddNote: boolean;
  canReply: boolean;
  currentAgentId: string | null;
  onBack: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const toast = useOrbToast();

  const [tab, setTab] = useState<ProfileTab>('timeline');
  const [editOpen, setEditOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<CrmDealRecord | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTaskRecord | null>(null);
  const [salesBusyId, setSalesBusyId] = useState<string | null>(null);

  const [msgBusy, setMsgBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [tagAdding, setTagAdding] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [tagBusy, setTagBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  const profileState = useData(
    () => getCustomerProfile(workspaceId, visitorId),
    ['customer-profile', workspaceId, visitorId],
  );

  const data = profileState.data;
  const customer = data?.customer;

  const timeline = useMemo<TimelineEntry[]>(() => {
    if (!data) return [];
    const items: TimelineEntry[] = [];

    for (const d of data.deals ?? []) {
      items.push({
        id: `d-${d.id}`,
        at: d.updated_at || d.created_at,
        title: `Deal: ${d.title} · ${formatMoneyCents(d.value_cents, d.currency)}`,
        meta: `${dealStageMeta(d.stage).label} · ${d.probability}% probability`,
        kind: 'deal',
      });
    }

    for (const tk of data.tasks ?? []) {
      items.push({
        id: `tk-${tk.id}`,
        at: tk.completed_at || tk.due_at || tk.created_at,
        title: `Task (${taskKindLabel(tk.kind)}): ${tk.title}`,
        meta: `${tk.status === 'completed' ? 'Completed' : 'Open'} · ${tk.priority} priority`,
        kind: 'task',
      });
    }

    for (const c of data.conversations) {
      items.push({
        id: `c-${c.id}`,
        at: c.updated_at || c.created_at,
        title: `Conversation (${c.channel || 'chat'}) · ${c.status}`,
        meta: c.last_message || 'Customer conversation thread',
        href: `/app/inbox?c=${encodeURIComponent(c.id)}`,
        kind: 'convo',
      });
    }

    for (const t of data.tickets) {
      items.push({
        id: `t-${t.id}`,
        at: t.created_at,
        title: `Ticket #${t.number}: ${t.subject}`,
        meta: `${t.channel} · ${t.status} · ${t.priority} priority`,
        href: `/app/tickets?id=${encodeURIComponent(t.id)}`,
        kind: 'ticket',
      });
    }

    for (const o of data.orders) {
      items.push({
        id: `o-${o.id}`,
        at: o.ordered_at,
        title: `Order ${o.order_number} · ${formatMoneyCents(o.total_cents, o.currency)}`,
        meta: o.items_summary ? `${o.status} · ${o.items_summary}` : `Status: ${o.status}`,
        kind: 'order',
      });
    }

    for (const p of data.pageHistory) {
      items.push({
        id: `p-${p.id}`,
        at: p.visited_at,
        title: p.page_title ? `Viewed "${p.page_title}"` : `Visited ${p.page_url}`,
        meta: p.page_url,
        kind: 'page',
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return items;
  }, [data]);

  const reloadAll = () => {
    profileState.reload();
    onChanged();
  };

  const handleDealStageChange = async (deal: CrmDealRecord, nextStage: CrmDealStage) => {
    if (deal.stage === nextStage) return;
    setSalesBusyId(deal.id);
    try {
      await updateCrmDeal(workspaceId, deal.id, { stage: nextStage });
      toast.show({ tone: nextStage === 'won' ? 'ok' : 'info', message: `Moved deal to ${dealStageMeta(nextStage).label}` });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setSalesBusyId(null);
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    setSalesBusyId(dealId);
    try {
      await deleteCrmDeal(workspaceId, dealId);
      toast.show({ tone: 'ok', message: 'Deal deleted' });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setSalesBusyId(null);
    }
  };

  const handleToggleTask = async (task: CrmTaskRecord) => {
    setSalesBusyId(task.id);
    const nextStatus = task.status === 'completed' ? 'open' : 'completed';
    try {
      await updateCrmTask(workspaceId, task.id, { status: nextStatus });
      toast.show({
        tone: nextStatus === 'completed' ? 'ok' : 'info',
        message: nextStatus === 'completed' ? 'Task completed' : 'Task reopened',
      });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setSalesBusyId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setSalesBusyId(taskId);
    try {
      await deleteCrmTask(workspaceId, taskId);
      toast.show({ tone: 'ok', message: 'Task deleted' });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setSalesBusyId(null);
    }
  };

  const handleStartMessage = async () => {
    if (!customer) return;
    setMsgBusy(true);
    try {
      const { conversationId } = await startCustomerConversation(workspaceId, customer.id);
      router.push(`/app/inbox?c=${encodeURIComponent(conversationId)}`);
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
      setMsgBusy(false);
    }
  };

  const handleRefreshSummary = async () => {
    if (!customer) return;
    setSummaryBusy(true);
    try {
      await refreshCustomerSummary(workspaceId, customer.id);
      toast.show({ tone: 'ok', message: 'Customer summary updated' });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setSummaryBusy(false);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    const clean = tagDraft.trim();
    if (!clean) return;
    const existing = customer.tags || [];
    if (existing.includes(clean)) {
      setTagDraft('');
      setTagAdding(false);
      return;
    }
    setTagBusy(true);
    try {
      await updateCustomer(workspaceId, customer.id, { tags: [...existing, clean] });
      setTagDraft('');
      setTagAdding(false);
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setTagBusy(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!customer) return;
    setTagBusy(true);
    try {
      await updateCustomer(workspaceId, customer.id, {
        tags: (customer.tags || []).filter((t) => t !== tagToRemove),
      });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setTagBusy(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    const body = noteDraft.trim();
    if (!body) return;
    setNoteBusy(true);
    try {
      await addCustomerNote(workspaceId, customer.id, body);
      setNoteDraft('');
      toast.show({ tone: 'ok', message: 'Note saved' });
      profileState.reload();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setNoteBusy(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteCustomerNote(workspaceId, noteId);
      profileState.reload();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    }
  };

  if (profileState.error) {
    return (
      <div className="space-y-4">
        <Button
          variant="quiet"
          size="sm"
          leading={<ArrowLeft size={14} aria-hidden="true" />}
          onClick={onBack}
        >
          All customers
        </Button>
        <ErrorState
          title="Could not load customer profile"
          body={profileState.error}
          onRetry={profileState.reload}
        />
      </div>
    );
  }

  if (profileState.loading || !customer || !data) {
    return (
      <div className="space-y-4">
        <Button
          variant="quiet"
          size="sm"
          leading={<ArrowLeft size={14} aria-hidden="true" />}
          onClick={onBack}
        >
          All customers
        </Button>
        <Card>
          <SkeletonRows rows={6} />
        </Card>
      </div>
    );
  }

  const displayName = customer.name || customer.email || 'Unnamed customer';
  const locationText = [customer.ip_location_city, customer.ip_location_country]
    .filter(Boolean)
    .join(', ');
  const avgOrderCents =
    customer.orders_count > 0
      ? Math.round(customer.lifetime_value_cents / customer.orders_count)
      : null;

  const stats = [
    { label: 'Lifetime value', value: formatMoneyCents(customer.lifetime_value_cents) },
    { label: 'Orders', value: fmtInt(customer.orders_count) },
    { label: 'Avg. order', value: avgOrderCents !== null ? formatMoneyCents(avgOrderCents) : '—' },
    { label: 'Conversations', value: fmtInt(data.conversations.length) },
    {
      label: 'CSAT',
      value:
        data.csatCount > 0 && data.csatAverage !== null
          ? `${data.csatAverage.toFixed(1)} / 5`
          : '—',
    },
  ];

  const customerDeals = data.deals ?? [];
  const customerTasks = data.tasks ?? [];

  const tabItems: TabItem<ProfileTab>[] = [
    { id: 'timeline', label: 'Activity timeline', count: timeline.length },
    { id: 'deals', label: 'Deals', count: customerDeals.length },
    { id: 'tasks', label: 'Tasks', count: customerTasks.length },
    { id: 'convos', label: 'Conversations', count: data.conversations.length },
    { id: 'orders', label: 'Orders', count: data.orders.length },
    { id: 'tickets', label: 'Tickets', count: data.tickets.length },
  ];

  const detailsRows: Array<{ label: string; value: string }> = [
    { label: 'Email', value: customer.email || '—' },
    { label: 'Phone', value: customer.phone || '—' },
    { label: 'Location', value: locationText || '—' },
    { label: 'Company', value: customer.company || '—' },
    { label: 'Language', value: customer.language || '—' },
    { label: 'Timezone', value: customer.timezone || '—' },
    { label: 'Plan', value: customer.plan || '—' },
    { label: 'Marketing opt-in', value: customer.marketing_opt_in ? 'Yes' : 'No' },
    { label: 'Customer since', value: formatDateShort(customer.first_seen_at) },
  ];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-o-accent-text hover:underline"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All customers
      </button>

      {/* Hero header */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={displayName} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] font-bold tracking-tight text-o-text m-0">
                {displayName}
              </h2>
              <Badge tone={segmentBadgeTone(customer.segment)}>
                {customer.segment || 'Customer'}
              </Badge>
              {customer.plan ? <Badge tone="neutral">{customer.plan}</Badge> : null}
            </div>
            <p className="mt-1 text-[13px] text-o-text-2 truncate">
              {[
                customer.email || 'No email',
                locationText || null,
                `customer since ${formatDateShort(customer.first_seen_at)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canReply ? (
              <Button
                variant="primary"
                size="md"
                loading={msgBusy}
                leading={<MessageSquare size={14} aria-hidden="true" />}
                onClick={handleStartMessage}
              >
                Message
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                variant="secondary"
                size="md"
                leading={<Briefcase size={14} aria-hidden="true" />}
                onClick={() => {
                  setEditingDeal(null);
                  setDealModalOpen(true);
                }}
              >
                New deal
              </Button>
            ) : null}
            {canAddNote ? (
              <Button
                variant="secondary"
                size="md"
                leading={<CheckCircle2 size={14} aria-hidden="true" />}
                onClick={() => {
                  setEditingTask(null);
                  setTaskModalOpen(true);
                }}
              >
                Add task
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                variant="secondary"
                size="md"
                leading={<Ticket size={14} aria-hidden="true" />}
                onClick={() => setTicketOpen(true)}
              >
                Create ticket
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                variant="quiet"
                size="md"
                leading={<ShoppingBag size={14} aria-hidden="true" />}
                onClick={() => setOrderOpen(true)}
              >
                Record order
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((st) => (
          <Card key={st.label} className="!p-4">
            <div className="text-[12.5px] text-o-text-2">{st.label}</div>
            <div className="o-num mt-1 text-[20px] font-bold text-o-text">{st.value}</div>
          </Card>
        ))}
      </div>

      {/* Main 2-column profile body */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Left column */}
        <div className="min-w-0 flex-1 space-y-4">
          <Tabs items={tabItems} value={tab} onChange={setTab} label="Customer activity" />

          {tab === 'timeline' ? (
            <Card flush>
              {timeline.length === 0 ? (
                <EmptyState
                  title="No customer activity yet"
                  body="Conversations, deals, tasks, tickets, orders, and page visits will appear here chronologically."
                />
              ) : (
                <ul className="divide-y divide-o-border px-4">
                  {timeline.map((item) => {
                    const toneClass =
                      item.kind === 'order' || item.kind === 'deal'
                        ? 'bg-o-ok-soft text-o-ok'
                        : item.kind === 'ticket'
                          ? 'bg-o-warn-soft text-o-warn'
                          : item.kind === 'convo' || item.kind === 'task'
                            ? 'bg-o-accent-soft text-o-accent-text'
                            : 'bg-o-surface-2 text-o-text-2';
                    const Icon =
                      item.kind === 'order'
                        ? ShoppingBag
                        : item.kind === 'deal'
                          ? Briefcase
                          : item.kind === 'task'
                            ? CheckCircle2
                            : item.kind === 'ticket'
                              ? Ticket
                              : item.kind === 'convo'
                                ? MessageSquare
                                : Eye;
                    return (
                      <li key={item.id} className="flex items-start gap-3 py-3">
                        <span
                          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${toneClass}`}
                        >
                          <Icon size={14} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          {item.href ? (
                            <Link
                              href={item.href}
                              className="text-[13.5px] font-medium text-o-text hover:text-o-accent-text hover:underline"
                            >
                              {item.title}
                            </Link>
                          ) : (
                            <div className="text-[13.5px] font-medium text-o-text">
                              {item.title}
                            </div>
                          )}
                          <div className="truncate text-[12px] text-o-text-3">{item.meta}</div>
                        </div>
                        <span className="o-num shrink-0 text-[12px] text-o-text-3">
                          {timeAgo(item.at)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ) : null}

          {tab === 'deals' ? (
            <Card flush>
              {customerDeals.length === 0 ? (
                <EmptyState
                  title="No deals linked yet"
                  body="Track B2B opportunities and quotes associated with this contact."
                  action={
                    canEdit ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setEditingDeal(null);
                          setDealModalOpen(true);
                        }}
                      >
                        Create deal
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <ul className="divide-y divide-o-border">
                  {customerDeals.map((d) => {
                    const meta = dealStageMeta(d.stage);
                    return (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-o-surface-2/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-o-text">{d.title}</span>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            {d.company_name ? <Badge tone="neutral">{d.company_name}</Badge> : null}
                          </div>
                          <div className="mt-0.5 text-[12px] text-o-text-3">
                            {d.probability}% win probability
                            {d.expected_close_date ? ` · Close ${formatDateShort(d.expected_close_date)}` : ''}
                            {d.owner_name ? ` · Owner: ${d.owner_name}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="o-num text-[14px] font-bold text-o-text">
                            {formatMoneyCents(d.value_cents, d.currency)}
                          </span>
                          {canEdit ? (
                            <>
                              <select
                                aria-label={`Stage for ${d.title}`}
                                value={d.stage}
                                disabled={salesBusyId === d.id}
                                onChange={(e) => handleDealStageChange(d, e.target.value as CrmDealStage)}
                                className="h-7 rounded-md border border-o-border bg-o-surface-2 px-1.5 text-[12px] text-o-text"
                              >
                                {CRM_DEAL_STAGES.map((opt) => (
                                  <option key={opt.key} value={opt.key}>
                                    {opt.shortLabel}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                aria-label={`Edit ${d.title}`}
                                onClick={() => {
                                  setEditingDeal(d);
                                  setDealModalOpen(true);
                                }}
                                className="rounded p-1 text-o-text-3 hover:bg-o-surface-2 hover:text-o-text"
                              >
                                <Pencil size={13} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${d.title}`}
                                disabled={salesBusyId === d.id}
                                onClick={() => handleDeleteDeal(d.id)}
                                className="rounded p-1 text-o-text-3 hover:bg-o-surface-2 hover:text-o-bad"
                              >
                                <Trash2 size={13} aria-hidden="true" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ) : null}

          {tab === 'tasks' ? (
            <Card flush>
              {customerTasks.length === 0 ? (
                <EmptyState
                  title="No follow-up tasks yet"
                  body="Schedule calls, emails, demos, or to-dos for this customer."
                  action={
                    canAddNote ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setEditingTask(null);
                          setTaskModalOpen(true);
                        }}
                      >
                        Add task
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <ul className="divide-y divide-o-border">
                  {customerTasks.map((tk) => {
                    const done = tk.status === 'completed';
                    const overdue = isTaskOverdue(tk);
                    return (
                      <li
                        key={tk.id}
                        className="flex flex-wrap items-start gap-3 px-4 py-3 hover:bg-o-surface-2/60"
                      >
                        {canAddNote ? (
                          <button
                            type="button"
                            disabled={salesBusyId === tk.id}
                            aria-label={done ? `Mark ${tk.title} open` : `Complete ${tk.title}`}
                            onClick={() => handleToggleTask(tk)}
                            className={`mt-0.5 shrink-0 ${
                              done ? 'text-o-ok' : 'text-o-text-3 hover:text-o-accent-text'
                            }`}
                          >
                            {done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                          </button>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[13.5px] font-semibold ${
                                done ? 'line-through text-o-text-3' : 'text-o-text'
                              }`}
                            >
                              {tk.title}
                            </span>
                            <Badge tone="neutral">{taskKindLabel(tk.kind)}</Badge>
                            <Badge tone={taskPriorityTone(tk.priority)}>{tk.priority}</Badge>
                            {overdue ? <Badge tone="bad">Overdue</Badge> : null}
                          </div>
                          {tk.description ? (
                            <p className="mt-0.5 mb-0 text-[12.5px] text-o-text-2">{tk.description}</p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-o-text-3">
                            {tk.due_at ? (
                              <span className={`inline-flex items-center gap-1 ${overdue ? 'text-o-bad font-medium' : ''}`}>
                                <Calendar size={12} aria-hidden="true" />
                                Due {formatDateShort(tk.due_at)}
                              </span>
                            ) : null}
                            {tk.deal_title ? <span>Deal: {tk.deal_title}</span> : null}
                            <span>Assignee: {tk.assignee_name || 'Unassigned'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canAddNote ? (
                            <button
                              type="button"
                              aria-label={`Edit ${tk.title}`}
                              onClick={() => {
                                setEditingTask(tk);
                                setTaskModalOpen(true);
                              }}
                              className="rounded p-1 text-o-text-3 hover:bg-o-surface-2 hover:text-o-text"
                            >
                              <Pencil size={13} aria-hidden="true" />
                            </button>
                          ) : null}
                          {canEdit ? (
                            <button
                              type="button"
                              aria-label={`Delete ${tk.title}`}
                              disabled={salesBusyId === tk.id}
                              onClick={() => handleDeleteTask(tk.id)}
                              className="rounded p-1 text-o-text-3 hover:bg-o-surface-2 hover:text-o-bad"
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ) : null}

          {tab === 'convos' ? (
            <Card flush>
              {data.conversations.length === 0 ? (
                <EmptyState
                  title="No conversations yet"
                  body="Start a conversation to reach this customer in the Inbox."
                  action={
                    canReply ? (
                      <Button variant="primary" size="sm" onClick={handleStartMessage}>
                        Start conversation
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <ul className="divide-y divide-o-border">
                  {data.conversations.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/app/inbox?c=${encodeURIComponent(c.id)}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-o-surface-2 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-o-text">
                            {c.last_message || `${c.channel || 'Chat'} conversation`}
                          </div>
                          <div className="text-[12px] text-o-text-3">
                            {c.channel || 'chat'} · {timeAgo(c.updated_at || c.created_at)}
                            {c.csat_rating ? ` · CSAT ${c.csat_rating}/5` : ''}
                          </div>
                        </div>
                        <Badge
                          tone={
                            c.status === 'resolved'
                              ? 'ok'
                              : c.status === 'open'
                                ? 'accent'
                                : 'neutral'
                          }
                        >
                          {c.status}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {tab === 'orders' ? (
            <Card flush>
              {data.orders.length === 0 ? (
                <EmptyState
                  title="No orders recorded"
                  body="Orders recorded manually or synced from commerce integrations appear here."
                  action={
                    canEdit ? (
                      <Button variant="secondary" size="sm" onClick={() => setOrderOpen(true)}>
                        Record order
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-o-surface-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-o-text-3">
                        <th className="px-4 py-2.5">Order</th>
                        <th className="px-2 py-2.5">Items</th>
                        <th className="px-2 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-o-border">
                      {data.orders.map((o) => (
                        <tr key={o.id} className="hover:bg-o-surface-2">
                          <td className="px-4 py-3">
                            <div className="o-mono font-semibold text-o-text">
                              {o.order_number}
                            </div>
                            <div className="text-[12px] text-o-text-3">
                              {formatDateShort(o.ordered_at)}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-o-text-2">{o.items_summary || '—'}</td>
                          <td className={`px-2 py-3 ${orderStatusColorClass(o.status)}`}>
                            {o.status}
                          </td>
                          <td className="o-num px-4 py-3 text-right font-semibold text-o-text">
                            {formatMoneyCents(o.total_cents, o.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : null}

          {tab === 'tickets' ? (
            <Card flush>
              {data.tickets.length === 0 ? (
                <EmptyState
                  title="No tickets for this customer"
                  body="Escalated issues and follow-up tickets linked to this customer appear here."
                  action={
                    canEdit ? (
                      <Button variant="secondary" size="sm" onClick={() => setTicketOpen(true)}>
                        Create ticket
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <ul className="divide-y divide-o-border">
                  {data.tickets.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/app/tickets?id=${encodeURIComponent(t.id)}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-o-surface-2 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="o-mono text-[12px] font-semibold text-o-text-3">
                              #{t.number}
                            </span>
                            <span className="truncate text-[13.5px] font-medium text-o-text">
                              {t.subject}
                            </span>
                          </div>
                          <div className="text-[12px] text-o-text-3">
                            {t.channel} · {t.priority} · {timeAgo(t.created_at)}
                          </div>
                        </div>
                        <Badge
                          tone={
                            t.status === 'solved' || t.status === 'closed'
                              ? 'ok'
                              : t.status === 'new' || t.status === 'open'
                                ? 'accent'
                                : 'warn'
                          }
                        >
                          {t.status}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        {/* Right rail */}
        <div className="w-full shrink-0 space-y-4 lg:w-[320px]">
          {/* AI summary */}
          <section className="rounded-[20px] bg-o-ai-soft p-4 space-y-2.5 border border-transparent">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-o-ai-text">
                <Sparkles size={14} aria-hidden="true" />
                Customer summary
              </div>
              {canEdit ? (
                <Button
                  variant="quiet"
                  size="sm"
                  loading={summaryBusy}
                  leading={<RefreshCw size={12} aria-hidden="true" />}
                  onClick={handleRefreshSummary}
                  className="!h-7 !px-2 !text-[12px]"
                >
                  Refresh
                </Button>
              ) : null}
            </div>
            <p className="m-0 text-[13.5px] leading-relaxed text-o-text">
              {customer.ai_summary ||
                'No summary generated yet. Click Refresh to build a profile summary from conversations, tickets, and order history.'}
            </p>
            {(customer.ai_signals || []).length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {customer.ai_signals.map((sig) => (
                  <Badge key={sig.label} tone={sig.tone ?? 'neutral'}>
                    {sig.label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </section>

          {/* Details card */}
          <Card className="!p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-[13px] font-semibold text-o-text">Details</h3>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="text-[12.5px] font-medium text-o-accent-text hover:underline"
                >
                  Edit
                </button>
              ) : null}
            </div>
            <dl className="m-0 space-y-2 text-[13px]">
              {detailsRows.map((row) => (
                <div key={row.label} className="flex gap-2.5">
                  <dt className="w-[112px] shrink-0 text-o-text-3">{row.label}</dt>
                  <dd className="m-0 min-w-0 flex-1 break-words text-o-text">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Tags card */}
          <Card className="!p-4 space-y-3">
            <h3 className="m-0 text-[13px] font-semibold text-o-text">Tags</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              {(customer.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-o-surface-2 px-2.5 py-1 text-[12px] text-o-text-2"
                >
                  <span>{tag}</span>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={tagBusy}
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => handleRemoveTag(tag)}
                      className="text-o-text-3 hover:text-o-text"
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  ) : null}
                </span>
              ))}

              {canEdit ? (
                tagAdding ? (
                  <form onSubmit={handleAddTag} className="flex items-center gap-1.5">
                    <Input
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      placeholder="Tag name"
                      autoFocus
                      className="!h-7 !w-28 !text-[12px] !px-2"
                    />
                    <Button type="submit" size="sm" variant="secondary" loading={tagBusy}>
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="quiet"
                      onClick={() => {
                        setTagAdding(false);
                        setTagDraft('');
                      }}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTagAdding(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-o-border-strong px-2.5 py-1 text-[12px] text-o-text-2 hover:bg-o-surface-2"
                  >
                    <Plus size={11} aria-hidden="true" />
                    Add
                  </button>
                )
              ) : (customer.tags || []).length === 0 ? (
                <span className="text-[12.5px] text-o-text-3">No tags</span>
              ) : null}
            </div>
          </Card>

          {/* Notes card */}
          <Card className="!p-4 space-y-3">
            <h3 className="m-0 text-[13px] font-semibold text-o-text">Notes</h3>
            {data.notes.length === 0 ? (
              <p className="m-0 text-[12.5px] text-o-text-3">
                No internal notes on this customer yet.
              </p>
            ) : (
              <div className="space-y-2">
                {data.notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-[14px] border border-dashed border-[var(--note-border)] bg-[var(--note)] p-3 text-[13px] text-o-text"
                  >
                    <div className="whitespace-pre-wrap">{n.body}</div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-o-text-3">
                      <span>
                        {n.author_name || 'Teammate'} · {formatDateShort(n.created_at)}
                      </span>
                      {canEdit || (currentAgentId && n.author_id === currentAgentId) ? (
                        <button
                          type="button"
                          aria-label="Delete note"
                          onClick={() => handleDeleteNote(n.id)}
                          className="text-o-text-3 hover:text-o-bad"
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canAddNote ? (
              <form onSubmit={handleAddNote} className="space-y-2">
                <label htmlFor="customer-note-input" className="sr-only">
                  Add note
                </label>
                <Textarea
                  id="customer-note-input"
                  rows={2}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Add a note for your team..."
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    loading={noteBusy}
                    disabled={!noteDraft.trim()}
                  >
                    Save note
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>
        </div>
      </div>

      {/* Profile modals */}
      <EditCustomerModal
        open={editOpen}
        workspaceId={workspaceId}
        customer={customer}
        onClose={() => setEditOpen(false)}
        onSaved={reloadAll}
      />

      <AddOrderModal
        open={orderOpen}
        workspaceId={workspaceId}
        visitorId={customer.id}
        onClose={() => setOrderOpen(false)}
        onAdded={reloadAll}
      />

      <CreateCustomerTicketModal
        open={ticketOpen}
        workspaceId={workspaceId}
        customer={customer}
        onClose={() => setTicketOpen(false)}
        onCreated={(ticketId) => {
          reloadAll();
          router.push(`/app/tickets?id=${encodeURIComponent(ticketId)}`);
        }}
      />

      <DealModal
        open={dealModalOpen}
        workspaceId={workspaceId}
        deal={editingDeal}
        defaultVisitorId={customer.id}
        onClose={() => setDealModalOpen(false)}
        onSaved={reloadAll}
      />

      <TaskModal
        open={taskModalOpen}
        workspaceId={workspaceId}
        task={editingTask}
        defaultVisitorId={customer.id}
        onClose={() => setTaskModalOpen(false)}
        onSaved={reloadAll}
      />
    </div>
  );
}
