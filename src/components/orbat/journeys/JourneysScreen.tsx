'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock,
  GitBranch,
  Mail,
  MessageSquare,
  Plus,
  Route,
  Save,
  Sparkles,
  Trash2,
  UserPlus,
  Workflow,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  Textarea,
  useOrbToast,
  type BadgeTone,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, timeAgo } from '@/components/orbat/overview/format';
import { cn } from '@/lib/utils';
import {
  advanceJourneyEnrollment,
  createJourney,
  deleteJourney,
  enrollInJourney,
  getJourneysBootstrap,
  saveJourneyStages,
  suggestJourneyStepCopy,
  toggleJourneyStatus,
  useJourneysLiveSync,
  type EnrollmentStatus,
  type JourneyEnrollmentRecord,
  type JourneyRecord,
  type JourneyStage,
  type JourneyStep,
  type JourneyStepKind,
  type JourneysBootstrap,
} from '@/lib/data/journeys';
import { useData } from '@/lib/data/use-data';

function journeyStatusTone(status: JourneyRecord['status']): BadgeTone {
  if (status === 'live') return 'ok';
  if (status === 'paused') return 'warn';
  return 'neutral';
}

function enrollmentTone(status: EnrollmentStatus): BadgeTone {
  if (status === 'goal_reached') return 'ok';
  if (status === 'needs_attention') return 'warn';
  if (status === 'opted_out' || status === 'exited') return 'bad';
  return 'accent';
}

function stepIcon(kind: JourneyStepKind) {
  switch (kind) {
    case 'Email':
      return <Mail size={13} />;
    case 'Wait':
      return <Clock size={13} />;
    case 'Condition':
      return <GitBranch size={13} />;
    case 'In-app':
    case 'WhatsApp':
      return <MessageSquare size={13} />;
    case 'Goal':
      return <Check size={13} />;
    default:
      return <Route size={13} />;
  }
}

export function JourneysScreen() {
  const { workspace } = useShellSession();
  const toast = useOrbToast();

  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [templateKey, setTemplateKey] = useState<'onboarding' | 'trial_conversion' | 'winback' | 'blank'>('onboarding');
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollVisitorId, setEnrollVisitorId] = useState<string>('');
  const [enrollName, setEnrollName] = useState('');
  const [enrollEmail, setEnrollEmail] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const bundle = useData<JourneysBootstrap>(
    () => getJourneysBootstrap(workspace.id, selectedJourneyId),
    ['journeys', workspace.id, selectedJourneyId],
  );
  useJourneysLiveSync(workspace.id, bundle.reload);

  const journeys = useMemo(() => bundle.data?.journeys ?? [], [bundle.data?.journeys]);
  const activeJourney = useMemo(
    () => journeys.find((j) => j.id === bundle.data?.selectedJourneyId) ?? journeys[0] ?? null,
    [journeys, bundle.data?.selectedJourneyId],
  );
  const canManage = bundle.data?.canManage ?? false;

  async function handleCreateJourney() {
    setCreating(true);
    try {
      const created = await createJourney(workspace.id, {
        templateKey,
        name: newName || undefined,
        goal: newGoal || undefined,
      });
      setSelectedJourneyId(created.id);
      setCreateOpen(false);
      setNewName('');
      setNewGoal('');
      toast.show({ message: `Created journey "${created.name}".`, tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus() {
    if (!activeJourney) return;
    const next = activeJourney.status === 'live' ? 'paused' : 'live';
    try {
      await toggleJourneyStatus(workspace.id, activeJourney.id, next);
      toast.show({ message: `Journey is now ${next}.`, tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    }
  }

  async function handleDeleteJourney() {
    if (!activeJourney) return;
    setDeleting(true);
    try {
      await deleteJourney(workspace.id, activeJourney.id);
      setSelectedJourneyId(null);
      setDeleteConfirm(false);
      toast.show({ message: `Deleted "${activeJourney.name}".`, tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setDeleting(false);
    }
  }

  async function handleEnrollCustomer() {
    if (!activeJourney) return;
    const visitor = bundle.data?.availableVisitors.find((v) => v.id === enrollVisitorId);
    const customerName = enrollName.trim() || visitor?.name || '';
    if (!customerName) {
      toast.show({ message: 'Select an existing visitor or enter a customer name.', tone: 'bad' });
      return;
    }
    setEnrolling(true);
    try {
      await enrollInJourney(workspace.id, {
        journeyId: activeJourney.id,
        visitorId: visitor?.id ?? null,
        customerName,
        customerEmail: enrollEmail.trim() || visitor?.email || null,
      });
      setEnrollOpen(false);
      setEnrollVisitorId('');
      setEnrollName('');
      setEnrollEmail('');
      toast.show({ message: `Enrolled ${customerName} into "${activeJourney.name}".`, tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <PageContainer className="flex flex-col gap-5">
      <PageHeader
        title="Customer journeys"
        description="Map multi-stage onboarding, trial conversion, and retention touchpoints."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/app/automation" variant="secondary" size="sm" leading={<Workflow size={14} />}>
              ← Workflows
            </ButtonLink>
            {canManage ? (
              <Button variant="primary" size="sm" leading={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                New journey
              </Button>
            ) : null}
          </div>
        }
      />

      {bundle.error ? (
        <Card>
          <ErrorState body={bundle.error} onRetry={bundle.reload} />
        </Card>
      ) : bundle.loading && !bundle.data ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Card key={i}><Skeleton height={58} /></Card>
            ))}
          </div>
          <Card><Skeleton height={340} /></Card>
        </div>
      ) : !activeJourney || !bundle.data ? (
        <Card>
          <EmptyState
            icon={<Route size={26} />}
            title="No customer journeys yet"
            body="Launch a starter onboarding, trial conversion, or win-back journey to track customer progression."
            action={
              canManage ? (
                <Button variant="primary" size="sm" leading={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                  Create first journey
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <JourneyWorkspace
          key={activeJourney.id}
          workspaceId={workspace.id}
          canManage={canManage}
          journeys={journeys}
          journey={activeJourney}
          bootstrap={bundle.data}
          onSelectJourney={setSelectedJourneyId}
          onToggleStatus={handleToggleStatus}
          onOpenEnroll={() => setEnrollOpen(true)}
          onOpenDelete={() => setDeleteConfirm(true)}
          onReload={bundle.reload}
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New customer journey"
        description="Start with a structured lifecycle map or build one from scratch."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={creating} onClick={handleCreateJourney}>
              Create journey
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Journey template">
            <Select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value as typeof templateKey)}
              options={[
                { value: 'onboarding', label: 'New workspace onboarding' },
                { value: 'trial_conversion', label: 'Trial to paid conversion' },
                { value: 'winback', label: 'Silent customer win-back' },
                { value: 'blank', label: 'Blank custom journey' },
              ]}
            />
          </Field>
          <Field label="Name" hint="Optional — defaults to template name">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Onboarding activation"
            />
          </Field>
          <Field label="Goal">
            <Textarea
              rows={2}
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="What customer milestone completes this journey?"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title="Enroll customer into journey"
        description="Add a real workspace visitor or contact at Stage 1."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEnrollOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={enrolling} onClick={handleEnrollCustomer}>
              Enroll now
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {bundle.data && bundle.data.availableVisitors.length > 0 ? (
            <Field label="Select existing workspace visitor">
              <Select
                value={enrollVisitorId}
                onChange={(e) => setEnrollVisitorId(e.target.value)}
                options={[
                  { value: '', label: '— Choose a visitor or type manually below —' },
                  ...bundle.data.availableVisitors.map((v) => ({
                    value: v.id,
                    label: v.email ? `${v.name} (${v.email})` : v.name,
                  })),
                ]}
              />
            </Field>
          ) : null}
          <Field label="Customer name">
            <Input
              value={enrollName}
              onChange={(e) => setEnrollName(e.target.value)}
              placeholder="e.g. Nadia Tariq"
            />
          </Field>
          <Field label="Email (optional)">
            <Input
              type="email"
              value={enrollEmail}
              onChange={(e) => setEnrollEmail(e.target.value)}
              placeholder="nadia@company.com"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDeleteJourney}
        title="Delete journey?"
        body={`"${activeJourney?.name ?? ''}" and all enrollment records will be removed.`}
        confirmLabel="Delete"
        variant="danger"
        busy={deleting}
      />
    </PageContainer>
  );
}

/* ---------- Stateful Workspace Subcomponent (remounts cleanly via key={journey.id}) ---------- */

function nextJourneyStepUid(): string {
  return `stp_${crypto.randomUUID().slice(0, 8)}`;
}

function findSelectedStep(
  stages: JourneyStage[],
  selectedStepId: string | null,
): { stage: JourneyStage; step: JourneyStep } | null {
  for (const stg of stages) {
    const hit = stg.steps.find((s) => s.id === selectedStepId);
    if (hit) return { stage: stg, step: hit };
  }
  return stages[0]?.steps[0] ? { stage: stages[0], step: stages[0].steps[0] } : null;
}

function JourneyWorkspace({
  workspaceId,
  canManage,
  journeys,
  journey,
  bootstrap,
  onSelectJourney,
  onToggleStatus,
  onOpenEnroll,
  onOpenDelete,
  onReload,
}: {
  workspaceId: string;
  canManage: boolean;
  journeys: JourneyRecord[];
  journey: JourneyRecord;
  bootstrap: JourneysBootstrap;
  onSelectJourney: (id: string) => void;
  onToggleStatus: () => void;
  onOpenEnroll: () => void;
  onOpenDelete: () => void;
  onReload: () => void;
}) {
  const toast = useOrbToast();
  const [name, setName] = useState(journey.name);
  const [goal, setGoal] = useState(journey.goal);
  const [stages, setStages] = useState<JourneyStage[]>(journey.stages);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    journey.stages[0]?.steps[0]?.id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [search, setSearch] = useState('');

  const selectedRef = findSelectedStep(stages, selectedStepId);

  const countByStep = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of bootstrap.enrollments) {
      if (e.status === 'active' || e.status === 'needs_attention') {
        map.set(e.currentStepId, (map.get(e.currentStepId) ?? 0) + 1);
      }
    }
    return map;
  }, [bootstrap.enrollments]);

  const filteredEnrollments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bootstrap.enrollments;
    return bootstrap.enrollments.filter(
      (e) =>
        e.customerName.toLowerCase().includes(q) ||
        (e.customerEmail ?? '').toLowerCase().includes(q) ||
        e.currentStepTitle.toLowerCase().includes(q),
    );
  }, [bootstrap.enrollments, search]);

  function updateStep(stepId: string, patch: Partial<JourneyStep>) {
    setStages((prev) =>
      prev.map((stg) => ({
        ...stg,
        steps: stg.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
      })),
    );
  }

  function addStepToStage(stageId: string) {
    const stepId = nextJourneyStepUid();
    const newStep: JourneyStep = {
      id: stepId,
      title: 'Follow-up touchpoint',
      kind: 'Email',
      subtitle: 'Automated stage message',
      copy: 'Checking in to help you reach your milestone.',
    };
    setStages((prev) =>
      prev.map((stg) => (stg.id === stageId ? { ...stg, steps: [...stg.steps, newStep] } : stg)),
    );
    setSelectedStepId(stepId);
  }

  function removeStep(stepId: string) {
    setStages((prev) =>
      prev.map((stg) => ({
        ...stg,
        steps: stg.steps.filter((s) => s.id !== stepId),
      })),
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveJourneyStages(workspaceId, {
        id: journey.id,
        name,
        goal,
        entryTrigger: journey.entryTrigger,
        exitCriteria: journey.exitCriteria,
        stages,
      });
      toast.show({ message: `Saved "${name}".`, tone: 'ok' });
      onReload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSuggestAiCopy() {
    if (!selectedRef) return;
    setAiBusy(true);
    try {
      const res = await suggestJourneyStepCopy(workspaceId, {
        journeyName: name,
        goal,
        stepTitle: selectedRef.step.title,
        kind: selectedRef.step.kind,
      });
      updateStep(selectedRef.step.id, { copy: res.copy });
      toast.show({
        message: res.configured ? 'AI drafted copy from workspace LLM.' : 'Drafted structured message template.',
        tone: 'ok',
      });
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setAiBusy(false);
    }
  }

  async function handleAdvancePerson(row: JourneyEnrollmentRecord) {
    const flatSteps = stages.flatMap((stg) => stg.steps.map((stp) => ({ stageId: stg.id, step: stp })));
    const idx = flatSteps.findIndex((s) => s.step.id === row.currentStepId);
    const next = idx >= 0 && idx < flatSteps.length - 1 ? flatSteps[idx + 1] : null;
    try {
      await advanceJourneyEnrollment(workspaceId, {
        enrollmentId: row.id,
        nextStageId: next ? next.stageId : row.currentStageId,
        nextStepId: next ? next.step.id : row.currentStepId,
        status: next ? (next.step.kind === 'Goal' ? 'goal_reached' : 'active') : 'goal_reached',
        note: next ? `Moved to "${next.step.title}"` : 'Reached journey goal',
      });
      toast.show({ message: `Updated ${row.customerName}.`, tone: 'ok' });
      onReload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    }
  }

  const m = bootstrap.metrics;
  const kpis = [
    { label: 'Entered', value: fmtInt(m.entered) },
    { label: 'In progress', value: fmtInt(m.inProgress) },
    { label: 'Reached goal', value: fmtInt(m.reachedGoal) },
    { label: 'Conversion rate', value: m.conversionRate === null ? '—' : `${m.conversionRate}%` },
    {
      label: 'Revenue',
      value: m.revenueCents > 0 ? `$${Math.round(m.revenueCents / 100).toLocaleString()}` : '$0',
    },
  ];

  const peopleColumns: Column<JourneyEnrollmentRecord>[] = [
    {
      key: 'person',
      header: 'Customer',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-o-text">{r.customerName}</div>
          {r.customerEmail ? <div className="truncate text-[12px] text-o-text-3">{r.customerEmail}</div> : null}
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Current step',
      hideBelow: 'sm',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13.5px] text-o-text">{r.currentStepTitle}</div>
          <div className="truncate text-[12px] text-o-text-3">{r.currentStageName}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge tone={enrollmentTone(r.status)} dot>{r.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'act',
      header: 'Updated',
      hideBelow: 'md',
      cell: (r) => <span className="text-[12.5px] text-o-text-3">{timeAgo(r.lastActivityAt)} ago</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        r.status !== 'goal_reached' ? (
          <Button
            size="sm"
            variant="ghost"
            trailing={<ArrowRight size={13} />}
            onClick={(e) => {
              e.stopPropagation();
              handleAdvancePerson(r);
            }}
          >
            Advance
          </Button>
        ) : (
          <span className="text-[12px] font-medium text-o-ok">Completed</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar & Goal */}
      <Card size="md" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <Select
              aria-label="Select customer journey"
              value={journey.id}
              onChange={(e) => onSelectJourney(e.target.value)}
              options={journeys.map((j) => ({ value: j.id, label: j.name }))}
              className="min-w-[210px]"
            />
            <Badge tone={journeyStatusTone(journey.status)} dot>{journey.status}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" leading={<UserPlus size={14} />} onClick={onOpenEnroll}>
              Enroll customer
            </Button>
            {canManage ? (
              <>
                <Button size="sm" variant="secondary" onClick={onToggleStatus}>
                  {journey.status === 'live' ? 'Pause' : 'Go live'}
                </Button>
                <Button size="sm" variant="primary" loading={saving} leading={<Save size={14} />} onClick={handleSave}>
                  Save journey
                </Button>
                <Button size="sm" variant="ghost" icon aria-label="Delete journey" onClick={onOpenDelete}>
                  <Trash2 size={14} />
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-o-border pt-2.5 text-[13px] text-o-text-2">
          <span><strong className="text-o-text">Goal:</strong> {goal || '—'}</span>
          <span><strong className="text-o-text">Entry:</strong> {journey.entryTrigger || '—'}</span>
          <span><strong className="text-o-text">Exit:</strong> {journey.exitCriteria || '—'}</span>
        </div>
      </Card>

      {/* 5 KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} size="md">
            <div className="text-[12.5px] font-medium text-o-text-3">{k.label}</div>
            <div className="mt-1 text-[22px] font-semibold tracking-tight o-num text-o-text">{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Stage Map + Step Inspector */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card flush className="overflow-hidden">
          <CardHeader
            title="Stage map"
            sub="Scroll horizontally across lifecycle stages. Click any touchpoint to inspect or edit."
            className="border-b border-o-border px-5 py-4"
          />
          <div className="overflow-x-auto bg-o-bg/50 p-4">
            <div className="flex min-w-max gap-4">
              {stages.map((stg) => (
                <div
                  key={stg.id}
                  className="flex w-[250px] flex-none flex-col gap-2.5 rounded-[14px] border border-o-border bg-o-surface-2/60 p-3"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[12.5px] font-semibold uppercase tracking-wide text-o-text-3">
                      {stg.name}
                    </span>
                    <span className="text-[11.5px] text-o-text-3 o-num">{stg.steps.length} steps</span>
                  </div>

                  {stg.steps.map((step) => {
                    const active = selectedRef?.step.id === step.id;
                    const activeHere = countByStep.get(step.id) ?? 0;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setSelectedStepId(step.id)}
                        className={cn(
                          'flex flex-col gap-1.5 rounded-[12px] border p-3 text-left transition-all',
                          active
                            ? 'border-o-accent bg-o-surface ring-2 ring-o-accent/25'
                            : 'border-o-border bg-o-surface hover:border-o-text-3',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-o-text-3">
                            {stepIcon(step.kind)}
                            {step.kind}
                          </span>
                          {activeHere > 0 ? (
                            <Badge tone="accent">{activeHere} here</Badge>
                          ) : null}
                        </div>
                        <div className="text-[13.5px] font-semibold text-o-text">{step.title}</div>
                        <div className="line-clamp-2 text-[12px] text-o-text-3">{step.subtitle}</div>
                      </button>
                    );
                  })}

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => addStepToStage(stg.id)}
                      className="flex items-center justify-center gap-1 rounded-[10px] border border-dashed border-o-border py-2 text-[12.5px] font-medium text-o-text-2 transition-colors hover:border-o-accent hover:text-o-accent-text"
                    >
                      <Plus size={13} /> Add step
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card size="md" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="o-card__title">Step details</h3>
            {selectedRef ? <Badge tone="neutral">{selectedRef.stage.name}</Badge> : null}
          </div>
          {canManage ? (
            <>
              <Field label="Journey name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Goal summary">
                <Input value={goal} onChange={(e) => setGoal(e.target.value)} />
              </Field>
              {selectedRef ? (
                <>
                  <div className="my-1 border-t border-o-border pt-3">
                    <Field label="Step title">
                      <Input
                        value={selectedRef.step.title}
                        onChange={(e) => updateStep(selectedRef.step.id, { title: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Kind">
                    <Select
                      value={selectedRef.step.kind}
                      onChange={(e) =>
                        updateStep(selectedRef.step.id, { kind: e.target.value as JourneyStepKind })
                      }
                      options={[
                        { value: 'Trigger', label: 'Trigger' },
                        { value: 'Wait', label: 'Wait' },
                        { value: 'Email', label: 'Email' },
                        { value: 'In-app', label: 'In-app' },
                        { value: 'WhatsApp', label: 'WhatsApp' },
                        { value: 'Condition', label: 'Condition' },
                        { value: 'Goal', label: 'Goal' },
                      ]}
                    />
                  </Field>
                  <Field label="Subtitle">
                    <Input
                      value={selectedRef.step.subtitle}
                      onChange={(e) =>
                        updateStep(selectedRef.step.id, { subtitle: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Message copy / rule detail">
                    <Textarea
                      rows={3}
                      value={selectedRef.step.copy ?? ''}
                      onChange={(e) => updateStep(selectedRef.step.id, { copy: e.target.value })}
                      placeholder="Write the message or condition notes..."
                    />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="ai"
                      loading={aiBusy}
                      leading={<Sparkles size={13} />}
                      onClick={handleSuggestAiCopy}
                    >
                      Suggest copy with AI
                    </Button>
                    {selectedRef.stage.steps.length > 1 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-o-bad"
                        onClick={() => removeStep(selectedRef.step.id)}
                      >
                        Remove step
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <Alert tone="warn">View-only mode: admins and owners can edit journey steps.</Alert>
          )}
        </Card>
      </div>

      {/* Bottom Funnel & People */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.45fr]">
        <Card size="md">
          <CardHeader
            title="Stage funnel"
            sub="Computed directly from enrolled customer progression."
          />
          <div className="mt-4 flex flex-col gap-3">
            {bootstrap.funnel.map((row) => {
              const base = Math.max(1, bootstrap.metrics.entered);
              const pct = Math.round((row.reachedCount / base) * 100);
              return (
                <div key={row.stageId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium text-o-text">{row.stageName}</span>
                    <span className="text-o-text-3 o-num">
                      {row.reachedCount} reached ({pct}%)
                      {row.dropOffPct !== null ? ` · -${row.dropOffPct}% drop` : ''}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-o-surface-2">
                    <div
                      className="h-full rounded-full bg-o-accent transition-all"
                      style={{ width: `${Math.max(bootstrap.metrics.entered > 0 ? 4 : 0, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card flush className="flex flex-col">
          <CardHeader
            title="People in this journey"
            sub={`${fmtInt(bootstrap.enrollments.length)} enrolled contacts`}
            actions={
              <Input
                size="sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer or step..."
                className="w-[180px]"
              />
            }
            className="border-b border-o-border px-5 py-4"
          />
          {filteredEnrollments.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<UserPlus size={22} />}
                title={bootstrap.enrollments.length === 0 ? 'No customers enrolled yet' : 'No matching people'}
                body={
                  bootstrap.enrollments.length === 0
                    ? 'Click "Enroll customer" above to add an existing workspace contact or test enrollment.'
                    : 'Try another search query.'
                }
              />
            </div>
          ) : (
            <Table
              columns={peopleColumns}
              rows={filteredEnrollments}
              rowKey={(r) => r.id}
              caption="Customers currently or previously enrolled in this journey"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
