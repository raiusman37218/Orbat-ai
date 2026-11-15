'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  Columns3,
  ExternalLink,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  SkeletonRows,
  Table,
  Textarea,
  useOrbToast,
  type BadgeTone,
  type Column,
} from '@/components/orbat/primitives';
import { fmtInt } from '@/components/orbat/overview/format';
import {
  createCrmCompany,
  createCrmDeal,
  createCrmTask,
  deleteCrmCompany,
  deleteCrmDeal,
  deleteCrmTask,
  formatMoneyCents,
  getCrmPickerOptions,
  listCrmCompanies,
  listCrmDeals,
  listCrmTasks,
  updateCrmCompany,
  updateCrmDeal,
  updateCrmTask,
  type CrmCompanyRecord,
  type CrmDealRecord,
  type CrmDealStage,
  type CrmTaskKind,
  type CrmTaskPriority,
  type CrmTaskRecord,
} from '@/lib/data/customers';
import { useData } from '@/lib/data/use-data';
import { errorMessage } from '@/lib/errors/user-error';

export const CRM_DEAL_STAGES: Array<{
  key: CrmDealStage;
  label: string;
  shortLabel: string;
  tone: BadgeTone;
}> = [
  { key: 'lead', label: 'New lead', shortLabel: 'Lead', tone: 'neutral' },
  { key: 'qualified', label: 'Qualified', shortLabel: 'Qualified', tone: 'accent' },
  { key: 'demo', label: 'Demo / trial', shortLabel: 'Demo', tone: 'ai' },
  { key: 'proposal', label: 'Proposal', shortLabel: 'Proposal', tone: 'warn' },
  { key: 'won', label: 'Closed won', shortLabel: 'Won', tone: 'ok' },
  { key: 'lost', label: 'Closed lost', shortLabel: 'Lost', tone: 'bad' },
];

export function dealStageMeta(stage: CrmDealStage) {
  return CRM_DEAL_STAGES.find((s) => s.key === stage) ?? CRM_DEAL_STAGES[0];
}

export function taskKindLabel(kind: CrmTaskKind): string {
  switch (kind) {
    case 'call':
      return 'Call';
    case 'email':
      return 'Email';
    case 'meeting':
      return 'Meeting';
    case 'follow_up':
      return 'Follow-up';
    default:
      return 'To-do';
  }
}

export function taskPriorityTone(priority: CrmTaskPriority): BadgeTone {
  if (priority === 'high') return 'bad';
  if (priority === 'low') return 'neutral';
  return 'accent';
}

export function isTaskOverdue(task: Pick<CrmTaskRecord, 'status' | 'due_at'>): boolean {
  if (task.status !== 'open' || !task.due_at) return false;
  return new Date(task.due_at).getTime() < Date.now();
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DealModal({
  open,
  workspaceId,
  deal,
  defaultVisitorId,
  defaultCompanyId,
  onClose,
  onSaved,
}: {
  open: boolean;
  workspaceId: string;
  deal?: CrmDealRecord | null;
  defaultVisitorId?: string | null;
  defaultCompanyId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useOrbToast();
  const optionsState = useData(
    () => (open ? getCrmPickerOptions(workspaceId) : Promise.resolve(null)),
    ['crm-picker-options', workspaceId, open ? '1' : '0'],
  );

  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<CrmDealStage>('lead');
  const [valueDollars, setValueDollars] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [probability, setProbability] = useState('20');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [visitorId, setVisitorId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (deal) {
      setTitle(deal.title);
      setStage(deal.stage);
      setValueDollars(((deal.value_cents || 0) / 100).toFixed(deal.value_cents % 100 === 0 ? 0 : 2));
      setCurrency(deal.currency || 'USD');
      setProbability(String(deal.probability ?? 20));
      setExpectedCloseDate(deal.expected_close_date || '');
      setVisitorId(deal.visitor_id || '');
      setCompanyId(deal.company_id || '');
      setOwnerId(deal.owner_id || '');
      setNotes(deal.notes || '');
    } else {
      setTitle('');
      setStage('lead');
      setValueDollars('0');
      setCurrency('USD');
      setProbability('20');
      setExpectedCloseDate('');
      setVisitorId(defaultVisitorId || '');
      setCompanyId(defaultCompanyId || '');
      setOwnerId('');
      setNotes('');
    }
  }, [open, deal, defaultVisitorId, defaultCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const parsedAmount = Math.max(0, Math.round((Number(valueDollars) || 0) * 100));
      const parsedProb = Math.max(0, Math.min(100, Math.round(Number(probability) || 0)));
      if (deal) {
        await updateCrmDeal(workspaceId, deal.id, {
          title: title.trim(),
          stage,
          valueCents: parsedAmount,
          currency: currency.trim() || 'USD',
          probability: parsedProb,
          expectedCloseDate: expectedCloseDate.trim() || null,
          visitorId: visitorId || null,
          companyId: companyId || null,
          ownerId: ownerId || null,
          notes: notes.trim() || null,
        });
        toast.show({ tone: 'ok', message: 'Deal updated' });
      } else {
        await createCrmDeal(workspaceId, {
          title: title.trim(),
          stage,
          valueCents: parsedAmount,
          currency: currency.trim() || 'USD',
          probability: parsedProb,
          expectedCloseDate: expectedCloseDate.trim() || null,
          visitorId: visitorId || null,
          companyId: companyId || null,
          ownerId: ownerId || null,
          notes: notes.trim() || null,
        });
        toast.show({ tone: 'ok', message: 'Deal created' });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const opts = optionsState.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={deal ? 'Edit deal' : 'New sales deal'}
      description="Track pipeline value, close date, and linked contacts or companies."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="crm-deal-form" loading={busy}>
            {deal ? 'Save deal' : 'Create deal'}
          </Button>
        </>
      }
    >
      <form id="crm-deal-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Deal title *" className="sm:col-span-2">
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Acme Corp · Annual Support Suite"
            />
          </Field>

          <Field label="Pipeline stage">
            <Select
              value={stage}
              onChange={(e) => {
                const next = e.target.value as CrmDealStage;
                setStage(next);
                const defaults: Record<CrmDealStage, number> = {
                  lead: 20,
                  qualified: 40,
                  demo: 60,
                  proposal: 80,
                  won: 100,
                  lost: 0,
                };
                setProbability(String(defaults[next]));
              }}
            >
              {CRM_DEAL_STAGES.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Value ($)" className="col-span-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={valueDollars}
                onChange={(e) => setValueDollars(e.target.value)}
              />
            </Field>
            <Field label="Currency">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="PKR">PKR</option>
              </Select>
            </Field>
          </div>

          <Field label="Win probability (%)">
            <Input
              type="number"
              min="0"
              max="100"
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
            />
          </Field>

          <Field label="Expected close date">
            <Input
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </Field>

          <Field label="Primary contact">
            <Select value={visitorId} onChange={(e) => setVisitorId(e.target.value)}>
              <option value="">No contact linked</option>
              {(opts?.contacts ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Company account">
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">No company linked</option>
              {(opts?.companies ?? []).map((co) => (
                <option key={co.id} value={co.id}>
                  {co.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Deal owner" className="sm:col-span-2">
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Assign to me</option>
              {(opts?.agents ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Deal notes" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Decision makers, next steps, pricing details..."
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function TaskModal({
  open,
  workspaceId,
  task,
  defaultVisitorId,
  defaultDealId,
  onClose,
  onSaved,
}: {
  open: boolean;
  workspaceId: string;
  task?: CrmTaskRecord | null;
  defaultVisitorId?: string | null;
  defaultDealId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useOrbToast();
  const optionsState = useData(
    () => (open ? getCrmPickerOptions(workspaceId) : Promise.resolve(null)),
    ['crm-picker-options', workspaceId, open ? '1' : '0'],
  );

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<CrmTaskKind>('follow_up');
  const [priority, setPriority] = useState<CrmTaskPriority>('normal');
  const [dueAtDate, setDueAtDate] = useState('');
  const [visitorId, setVisitorId] = useState('');
  const [dealId, setDealId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (task) {
      setTitle(task.title);
      setKind(task.kind);
      setPriority(task.priority);
      setDueAtDate(task.due_at ? task.due_at.slice(0, 10) : '');
      setVisitorId(task.visitor_id || '');
      setDealId(task.deal_id || '');
      setAssigneeId(task.assignee_id || '');
      setDescription(task.description || '');
    } else {
      setTitle('');
      setKind('follow_up');
      setPriority('normal');
      setDueAtDate('');
      setVisitorId(defaultVisitorId || '');
      setDealId(defaultDealId || '');
      setAssigneeId('');
      setDescription('');
    }
  }, [open, task, defaultVisitorId, defaultDealId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const dueIso = dueAtDate ? new Date(`${dueAtDate}T17:00:00Z`).toISOString() : null;
      if (task) {
        await updateCrmTask(workspaceId, task.id, {
          title: title.trim(),
          kind,
          priority,
          dueAt: dueIso,
          visitorId: visitorId || null,
          dealId: dealId || null,
          assigneeId: assigneeId || null,
          description: description.trim() || null,
        });
        toast.show({ tone: 'ok', message: 'Task updated' });
      } else {
        await createCrmTask(workspaceId, {
          title: title.trim(),
          kind,
          priority,
          dueAt: dueIso,
          visitorId: visitorId || null,
          dealId: dealId || null,
          assigneeId: assigneeId || null,
          description: description.trim() || null,
        });
        toast.show({ tone: 'ok', message: 'Follow-up task added' });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const opts = optionsState.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={task ? 'Edit task' : 'New follow-up task'}
      description="Schedule calls, emails, meetings, or reminders linked to contacts and deals."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="crm-task-form" loading={busy}>
            {task ? 'Save task' : 'Create task'}
          </Button>
        </>
      }
    >
      <form id="crm-task-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Task title *" className="sm:col-span-2">
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Send revised proposal & pricing deck"
            />
          </Field>

          <Field label="Activity type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as CrmTaskKind)}>
              <option value="follow_up">Follow-up</option>
              <option value="call">Phone call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting / Demo</option>
              <option value="todo">To-do</option>
            </Select>
          </Field>

          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as CrmTaskPriority)}>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </Select>
          </Field>

          <Field label="Due date">
            <Input
              type="date"
              value={dueAtDate}
              onChange={(e) => setDueAtDate(e.target.value)}
            />
          </Field>

          <Field label="Assignee">
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Assign to me</option>
              {(opts?.agents ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Linked customer">
            <Select value={visitorId} onChange={(e) => setVisitorId(e.target.value)}>
              <option value="">No customer linked</option>
              {(opts?.contacts ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Linked deal">
            <Select value={dealId} onChange={(e) => setDealId(e.target.value)}>
              <option value="">No deal linked</option>
              {(opts?.deals ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Notes / checklist" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context for this follow-up..."
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function CompanyModal({
  open,
  workspaceId,
  company,
  onClose,
  onSaved,
}: {
  open: boolean;
  workspaceId: string;
  company?: CrmCompanyRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useOrbToast();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (company) {
      setName(company.name);
      setDomain(company.domain || '');
      setIndustry(company.industry || '');
      setSize(company.size || '');
      setWebsite(company.website || '');
      setNotes(company.notes || '');
    } else {
      setName('');
      setDomain('');
      setIndustry('');
      setSize('');
      setWebsite('');
      setNotes('');
    }
  }, [open, company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (company) {
        await updateCrmCompany(workspaceId, company.id, {
          name: name.trim(),
          domain: domain.trim() || null,
          industry: industry.trim() || null,
          size: size.trim() || null,
          website: website.trim() || null,
          notes: notes.trim() || null,
        });
        toast.show({ tone: 'ok', message: 'Company updated' });
      } else {
        await createCrmCompany(workspaceId, {
          name: name.trim(),
          domain: domain.trim() || null,
          industry: industry.trim() || null,
          size: size.trim() || null,
          website: website.trim() || null,
          notes: notes.trim() || null,
        });
        toast.show({ tone: 'ok', message: 'Company added' });
      }
      onSaved();
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
      title={company ? 'Edit company account' : 'Add company account'}
      description="Group B2B contacts and sales deals under one company profile."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="crm-company-form" loading={busy}>
            {company ? 'Save company' : 'Create company'}
          </Button>
        </>
      }
    >
      <form id="crm-company-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Company name *">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Northwind Logistics"
            />
          </Field>

          <Field label="Email domain" hint="Auto-matches contacts with @domain emails">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. northwind.com"
            />
          </Field>

          <Field label="Industry">
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="SaaS, E-Commerce, Healthcare..."
            />
          </Field>

          <Field label="Company size">
            <Select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">Select size</option>
              <option value="1-10">1–10 employees</option>
              <option value="11-50">11–50 employees</option>
              <option value="51-200">51–200 employees</option>
              <option value="201-1000">201–1,000 employees</option>
              <option value="1000+">1,000+ employees</option>
            </Select>
          </Field>

          <Field label="Website" className="sm:col-span-2">
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://northwind.com"
            />
          </Field>

          <Field label="Account notes" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key account context, contract renewal cycle, stakeholders..."
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function DealsPipelineView({
  workspaceId,
  canEdit,
  onOpenCustomer,
  onCountsChanged,
}: {
  workspaceId: string;
  canEdit: boolean;
  onOpenCustomer: (visitorId: string) => void;
  onCountsChanged: () => void;
}) {
  const toast = useOrbToast();
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<CrmDealRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const dealsState = useData(
    () => listCrmDeals(workspaceId, { q: debouncedQ || undefined }),
    ['crm-deals', workspaceId, debouncedQ],
  );

  const reloadAll = () => {
    dealsState.reload();
    onCountsChanged();
  };

  const handleStageChange = async (deal: CrmDealRecord, nextStage: CrmDealStage) => {
    if (deal.stage === nextStage) return;
    setBusyId(deal.id);
    try {
      await updateCrmDeal(workspaceId, deal.id, { stage: nextStage });
      toast.show({
        tone: nextStage === 'won' ? 'ok' : 'info',
        message: `Moved "${deal.title}" to ${dealStageMeta(nextStage).label}`,
      });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteDeal = async (deal: CrmDealRecord) => {
    setBusyId(deal.id);
    try {
      await deleteCrmDeal(workspaceId, deal.id);
      toast.show({ tone: 'ok', message: `Deleted "${deal.title}"` });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const deals = useMemo(() => dealsState.data?.deals ?? [], [dealsState.data]);
  const summary = dealsState.data?.summary ?? {
    totalDeals: 0,
    openDeals: 0,
    wonDeals: 0,
    lostDeals: 0,
    pipelineValueCents: 0,
    weightedValueCents: 0,
    wonValueCents: 0,
    lostValueCents: 0,
    winRatePercent: null,
  };

  const dealsByStage = useMemo(() => {
    const grouped: Record<CrmDealStage, CrmDealRecord[]> = {
      lead: [],
      qualified: [],
      demo: [],
      proposal: [],
      won: [],
      lost: [],
    };
    for (const d of deals) {
      grouped[d.stage]?.push(d);
    }
    return grouped;
  }, [deals]);

  const kpis = [
    {
      label: 'Open pipeline',
      value: formatMoneyCents(summary.pipelineValueCents),
      sub: `${fmtInt(summary.openDeals)} active deal${summary.openDeals === 1 ? '' : 's'}`,
    },
    {
      label: 'Weighted forecast',
      value: formatMoneyCents(summary.weightedValueCents),
      sub: 'Adjusted by win probability',
    },
    {
      label: 'Closed won',
      value: formatMoneyCents(summary.wonValueCents),
      sub: `${fmtInt(summary.wonDeals)} won deal${summary.wonDeals === 1 ? '' : 's'}`,
    },
    {
      label: 'Win rate',
      value: summary.winRatePercent !== null ? `${summary.winRatePercent}%` : '—',
      sub: `${fmtInt(summary.wonDeals + summary.lostDeals)} closed total`,
    },
  ];

  const columns: Column<CrmDealRecord>[] = [
    {
      key: 'title',
      header: 'Deal',
      cell: (row) => (
        <div className="min-w-0">
          <div className="font-semibold text-o-text truncate max-w-[260px]">{row.title}</div>
          <div className="text-[12px] text-o-text-3 truncate max-w-[260px]">
            {[row.company_name, row.visitor_name || row.visitor_email].filter(Boolean).join(' · ') || 'No contact or company'}
          </div>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (row) => {
        const meta = dealStageMeta(row.stage);
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      cell: (row) => (
        <span className="o-num font-semibold text-o-text">
          {formatMoneyCents(row.value_cents, row.currency)}
        </span>
      ),
    },
    {
      key: 'probability',
      header: 'Prob.',
      align: 'right',
      hideBelow: 'sm',
      cell: (row) => <span className="o-num text-[13px] text-o-text-2">{row.probability}%</span>,
    },
    {
      key: 'close',
      header: 'Expected close',
      hideBelow: 'md',
      cell: (row) => <span className="text-[13px] text-o-text-2">{formatDateShort(row.expected_close_date)}</span>,
    },
    {
      key: 'owner',
      header: 'Owner',
      hideBelow: 'lg',
      cell: (row) => <span className="text-[13px] text-o-text-2">{row.owner_name || 'Unassigned'}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="!p-4">
            <div className="text-[12.5px] text-o-text-2">{k.label}</div>
            <div className="o-num mt-1 text-[22px] font-bold text-o-text">{k.value}</div>
            <div className="mt-0.5 text-[12px] text-o-text-3">{k.sub}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[340px]">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-o-text-3"
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search deals, companies, contacts"
            aria-label="Search deals"
            className="!h-9 !pl-9 !pr-8 !text-[13px]"
          />
          {searchInput ? (
            <button
              type="button"
              aria-label="Clear deal search"
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-o-text-3 hover:text-o-text"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center rounded-xl border border-o-border bg-o-surface p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
              viewMode === 'board' ? 'bg-o-accent-soft text-o-accent-text' : 'text-o-text-2 hover:text-o-text'
            }`}
          >
            <Columns3 size={14} aria-hidden="true" />
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
              viewMode === 'table' ? 'bg-o-accent-soft text-o-accent-text' : 'text-o-text-2 hover:text-o-text'
            }`}
          >
            <List size={14} aria-hidden="true" />
            List
          </button>
        </div>

        {canEdit ? (
          <Button
            variant="primary"
            size="sm"
            className="ml-auto !h-9"
            leading={<Plus size={14} aria-hidden="true" />}
            onClick={() => {
              setEditingDeal(null);
              setModalOpen(true);
            }}
          >
            New deal
          </Button>
        ) : null}
      </div>

      {dealsState.error ? (
        <Card>
          <ErrorState title="Could not load deals" body={dealsState.error} onRetry={reloadAll} />
        </Card>
      ) : dealsState.loading && !dealsState.data ? (
        <Card>
          <SkeletonRows rows={6} />
        </Card>
      ) : deals.length === 0 ? (
        <Card>
          <EmptyState
            title={debouncedQ ? 'No deals match your search' : 'No deals in your pipeline yet'}
            body="Create your first sales deal to track pipeline revenue from New Lead to Closed Won."
            action={
              canEdit ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingDeal(null);
                    setModalOpen(true);
                  }}
                >
                  Create first deal
                </Button>
              ) : null
            }
          />
        </Card>
      ) : viewMode === 'table' ? (
        <Card flush>
          <Table
            caption="Sales pipeline deals"
            columns={columns}
            rows={deals}
            rowKey={(r) => r.id}
            onRowClick={
              canEdit
                ? (row) => {
                    setEditingDeal(row);
                    setModalOpen(true);
                  }
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {CRM_DEAL_STAGES.map((stageMeta) => {
            const stageDeals = dealsByStage[stageMeta.key];
            const stageSum = stageDeals.reduce((sum, d) => sum + (d.value_cents || 0), 0);
            return (
              <div
                key={stageMeta.key}
                className="flex min-h-[260px] flex-col rounded-[20px] border border-o-border bg-o-surface-2/60 p-2.5"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge tone={stageMeta.tone}>{stageMeta.shortLabel}</Badge>
                    <span className="o-num text-[12px] font-semibold text-o-text-3">
                      {stageDeals.length}
                    </span>
                  </div>
                  <span className="o-num text-[12px] font-semibold text-o-text">
                    {formatMoneyCents(stageSum)}
                  </span>
                </div>

                <div className="space-y-2 flex-1">
                  {stageDeals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-o-border px-2.5 py-6 text-center text-[12px] text-o-text-3">
                      No deals
                    </div>
                  ) : (
                    stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="rounded-2xl border border-o-border bg-o-surface p-3 space-y-2 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[13.5px] leading-snug text-o-text break-words">
                              {deal.title}
                            </div>
                            {deal.company_name ? (
                              <div className="mt-0.5 flex items-center gap-1 text-[12px] text-o-text-2 truncate">
                                <Building2 size={11} aria-hidden="true" />
                                <span className="truncate">{deal.company_name}</span>
                              </div>
                            ) : null}
                          </div>
                          {canEdit ? (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                aria-label={`Edit ${deal.title}`}
                                onClick={() => {
                                  setEditingDeal(deal);
                                  setModalOpen(true);
                                }}
                                className="rounded p-1 text-o-text-3 hover:bg-o-surface-2 hover:text-o-text"
                              >
                                <Pencil size={12} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${deal.title}`}
                                disabled={busyId === deal.id}
                                onClick={() => handleDeleteDeal(deal)}
                                className="rounded p-1 text-o-text-3 hover:bg-o-surface-2 hover:text-o-bad"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between text-[12.5px]">
                          <span className="o-num font-bold text-o-text">
                            {formatMoneyCents(deal.value_cents, deal.currency)}
                          </span>
                          <span className="o-num text-[11.5px] text-o-text-3">
                            {deal.probability}% prob
                          </span>
                        </div>

                        {deal.visitor_id ? (
                          <button
                            type="button"
                            onClick={() => onOpenCustomer(deal.visitor_id!)}
                            className="block max-w-full truncate text-left text-[12px] font-medium text-o-accent-text hover:underline"
                          >
                            {deal.visitor_name || deal.visitor_email || 'View contact'}
                          </button>
                        ) : null}

                        <div className="flex items-center justify-between gap-2 border-t border-o-border pt-2 text-[11.5px] text-o-text-3">
                          <span className="truncate">
                            {deal.expected_close_date ? formatDateShort(deal.expected_close_date) : deal.owner_name || 'Open'}
                          </span>
                          {canEdit ? (
                            <select
                              aria-label={`Move ${deal.title} stage`}
                              value={deal.stage}
                              disabled={busyId === deal.id}
                              onChange={(e) => handleStageChange(deal, e.target.value as CrmDealStage)}
                              className="h-6 rounded-md border border-o-border bg-o-surface-2 px-1.5 text-[11.5px] text-o-text"
                            >
                              {CRM_DEAL_STAGES.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                  {opt.shortLabel}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DealModal
        open={modalOpen}
        workspaceId={workspaceId}
        deal={editingDeal}
        onClose={() => setModalOpen(false)}
        onSaved={reloadAll}
      />
    </div>
  );
}

export function CrmTasksView({
  workspaceId,
  canAddNote,
  canEdit,
  onOpenCustomer,
  onCountsChanged,
}: {
  workspaceId: string;
  canAddNote: boolean;
  canEdit: boolean;
  onOpenCustomer: (visitorId: string) => void;
  onCountsChanged: () => void;
}) {
  const toast = useOrbToast();
  const [filter, setFilter] = useState<'open' | 'overdue' | 'completed' | 'all'>('open');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTaskRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const tasksState = useData(
    () => listCrmTasks(workspaceId, { filter, q: debouncedQ || undefined }),
    ['crm-tasks', workspaceId, filter, debouncedQ],
  );

  const reloadAll = () => {
    tasksState.reload();
    onCountsChanged();
  };

  const handleToggle = async (task: CrmTaskRecord) => {
    setBusyId(task.id);
    const nextStatus = task.status === 'completed' ? 'open' : 'completed';
    try {
      await updateCrmTask(workspaceId, task.id, { status: nextStatus });
      toast.show({
        tone: nextStatus === 'completed' ? 'ok' : 'info',
        message: nextStatus === 'completed' ? 'Marked task complete' : 'Reopened task',
      });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (task: CrmTaskRecord) => {
    setBusyId(task.id);
    try {
      await deleteCrmTask(workspaceId, task.id);
      toast.show({ tone: 'ok', message: 'Task deleted' });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const tasks = tasksState.data?.tasks ?? [];
  const counts = tasksState.data?.counts ?? { open: 0, overdue: 0, completed: 0 };

  const filterChips: Array<{ id: typeof filter; label: string; count?: number }> = [
    { id: 'open', label: 'Open', count: counts.open },
    { id: 'overdue', label: 'Overdue', count: counts.overdue },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-o-border bg-o-surface p-1">
          {filterChips.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-medium transition-colors ${
                  active ? 'bg-o-accent-soft text-o-accent-text' : 'text-o-text-2 hover:text-o-text'
                }`}
              >
                <span>{chip.label}</span>
                {typeof chip.count === 'number' ? (
                  <span
                    className={`o-num text-[11.5px] ${
                      chip.id === 'overdue' && chip.count > 0 ? 'text-o-bad font-semibold' : 'text-o-text-3'
                    }`}
                  >
                    {fmtInt(chip.count)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-o-text-3"
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tasks, customers, deals"
            aria-label="Search tasks"
            className="!h-9 !pl-9 !pr-8 !text-[13px]"
          />
        </div>

        {canAddNote ? (
          <Button
            variant="primary"
            size="sm"
            className="ml-auto !h-9"
            leading={<Plus size={14} aria-hidden="true" />}
            onClick={() => {
              setEditingTask(null);
              setModalOpen(true);
            }}
          >
            New task
          </Button>
        ) : null}
      </div>

      <Card flush>
        {tasksState.error ? (
          <ErrorState title="Could not load tasks" body={tasksState.error} onRetry={reloadAll} />
        ) : tasksState.loading && !tasksState.data ? (
          <div className="p-6">
            <SkeletonRows rows={6} />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            title={`No ${filter === 'all' ? '' : `${filter} `}tasks`}
            body="Keep deals moving with scheduled call, email, and meeting follow-ups."
            action={
              canAddNote ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingTask(null);
                    setModalOpen(true);
                  }}
                >
                  Add follow-up task
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-o-border">
            {tasks.map((task) => {
              const overdue = isTaskOverdue(task);
              const done = task.status === 'completed';
              return (
                <li
                  key={task.id}
                  className="flex flex-wrap items-start gap-3 px-4 py-3 hover:bg-o-surface-2/60 transition-colors"
                >
                  {canAddNote ? (
                    <button
                      type="button"
                      disabled={busyId === task.id}
                      aria-label={done ? `Mark ${task.title} open` : `Complete ${task.title}`}
                      onClick={() => handleToggle(task)}
                      className={`mt-0.5 shrink-0 transition-colors ${
                        done ? 'text-o-ok' : 'text-o-text-3 hover:text-o-accent-text'
                      }`}
                    >
                      {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                  ) : null}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[14px] font-semibold ${
                          done ? 'line-through text-o-text-3' : 'text-o-text'
                        }`}
                      >
                        {task.title}
                      </span>
                      <Badge tone="neutral">{taskKindLabel(task.kind)}</Badge>
                      <Badge tone={taskPriorityTone(task.priority)}>{task.priority}</Badge>
                      {overdue ? <Badge tone="bad">Overdue</Badge> : null}
                    </div>

                    {task.description ? (
                      <p className="m-0 text-[13px] text-o-text-2">{task.description}</p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3 text-[12px] text-o-text-3">
                      {task.due_at ? (
                        <span className={`inline-flex items-center gap-1 ${overdue ? 'text-o-bad font-medium' : ''}`}>
                          <Calendar size={12} aria-hidden="true" />
                          Due {formatDateShort(task.due_at)}
                        </span>
                      ) : null}
                      {task.visitor_id ? (
                        <button
                          type="button"
                          onClick={() => onOpenCustomer(task.visitor_id!)}
                          className="font-medium text-o-accent-text hover:underline"
                        >
                          {task.visitor_name || task.visitor_email || 'Customer profile'}
                        </button>
                      ) : null}
                      {task.deal_title ? <span>Deal: {task.deal_title}</span> : null}
                      <span>Assignee: {task.assignee_name || 'Unassigned'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {canAddNote ? (
                      <Button
                        variant="quiet"
                        size="sm"
                        aria-label={`Edit ${task.title}`}
                        onClick={() => {
                          setEditingTask(task);
                          setModalOpen(true);
                        }}
                      >
                        <Pencil size={13} aria-hidden="true" />
                      </Button>
                    ) : null}
                    {canEdit ? (
                      <Button
                        variant="quiet"
                        size="sm"
                        aria-label={`Delete ${task.title}`}
                        disabled={busyId === task.id}
                        onClick={() => handleDelete(task)}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <TaskModal
        open={modalOpen}
        workspaceId={workspaceId}
        task={editingTask}
        onClose={() => setModalOpen(false)}
        onSaved={reloadAll}
      />
    </div>
  );
}

export function CrmCompaniesView({
  workspaceId,
  canEdit,
  onCountsChanged,
}: {
  workspaceId: string;
  canEdit: boolean;
  onCountsChanged: () => void;
}) {
  const toast = useOrbToast();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CrmCompanyRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const companiesState = useData(
    () => listCrmCompanies(workspaceId, { q: debouncedQ || undefined }),
    ['crm-companies', workspaceId, debouncedQ],
  );

  const reloadAll = () => {
    companiesState.reload();
    onCountsChanged();
  };

  const handleDelete = async (co: CrmCompanyRecord) => {
    setBusyId(co.id);
    try {
      await deleteCrmCompany(workspaceId, co.id);
      toast.show({ tone: 'ok', message: `Deleted ${co.name}` });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const companies = companiesState.data ?? [];

  const columns: Column<CrmCompanyRecord>[] = [
    {
      key: 'name',
      header: 'Company',
      cell: (row) => (
        <div className="min-w-0">
          <div className="font-semibold text-o-text">{row.name}</div>
          <div className="text-[12px] text-o-text-3">
            {row.domain || row.website || 'No domain set'}
          </div>
        </div>
      ),
    },
    {
      key: 'industry',
      header: 'Industry / Size',
      hideBelow: 'md',
      cell: (row) => (
        <span className="text-[13px] text-o-text-2">
          {[row.industry, row.size].filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
    {
      key: 'contacts',
      header: 'Contacts',
      align: 'right',
      cell: (row) => <span className="o-num text-[13px] text-o-text">{fmtInt(row.contacts_count)}</span>,
    },
    {
      key: 'deals',
      header: 'Open deals',
      align: 'right',
      hideBelow: 'sm',
      cell: (row) => <span className="o-num text-[13px] text-o-text">{fmtInt(row.open_deals_count)}</span>,
    },
    {
      key: 'pipeline',
      header: 'Open pipeline',
      align: 'right',
      cell: (row) => (
        <span className="o-num font-semibold text-o-text">
          {formatMoneyCents(row.pipeline_value_cents)}
        </span>
      ),
    },
    {
      key: 'ltv',
      header: 'Customer LTV',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="o-num text-[13px] text-o-text-2">
          {formatMoneyCents(row.lifetime_value_cents)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.website ? (
            <a
              href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${row.name} website`}
              className="rounded p-1.5 text-o-text-3 hover:bg-o-surface-2 hover:text-o-text"
            >
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          ) : null}
          {canEdit ? (
            <>
              <button
                type="button"
                aria-label={`Edit ${row.name}`}
                onClick={() => {
                  setEditingCompany(row);
                  setModalOpen(true);
                }}
                className="rounded p-1.5 text-o-text-3 hover:bg-o-surface-2 hover:text-o-text"
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${row.name}`}
                disabled={busyId === row.id}
                onClick={() => handleDelete(row)}
                className="rounded p-1.5 text-o-text-3 hover:bg-o-surface-2 hover:text-o-bad"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[340px]">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-o-text-3"
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search companies, domain, industry"
            aria-label="Search companies"
            className="!h-9 !pl-9 !pr-8 !text-[13px]"
          />
        </div>

        {canEdit ? (
          <Button
            variant="primary"
            size="sm"
            className="ml-auto !h-9"
            leading={<Plus size={14} aria-hidden="true" />}
            onClick={() => {
              setEditingCompany(null);
              setModalOpen(true);
            }}
          >
            Add company
          </Button>
        ) : null}
      </div>

      <Card flush>
        {companiesState.error ? (
          <ErrorState title="Could not load companies" body={companiesState.error} onRetry={reloadAll} />
        ) : companiesState.loading && !companiesState.data ? (
          <div className="p-6">
            <SkeletonRows rows={6} />
          </div>
        ) : companies.length === 0 ? (
          <EmptyState
            title={debouncedQ ? 'No companies match your search' : 'No company accounts yet'}
            body="Group B2B contacts by company to track total account pipeline and lifetime revenue."
            action={
              canEdit ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingCompany(null);
                    setModalOpen(true);
                  }}
                >
                  Add first company
                </Button>
              ) : null
            }
          />
        ) : (
          <Table
            caption="B2B company accounts"
            columns={columns}
            rows={companies}
            rowKey={(r) => r.id}
            onRowClick={
              canEdit
                ? (row) => {
                    setEditingCompany(row);
                    setModalOpen(true);
                  }
                : undefined
            }
          />
        )}
      </Card>

      <CompanyModal
        open={modalOpen}
        workspaceId={workspaceId}
        company={editingCompany}
        onClose={() => setModalOpen(false)}
        onSaved={reloadAll}
      />
    </div>
  );
}
