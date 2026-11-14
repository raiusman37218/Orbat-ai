'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock,
  GitBranch,
  Layers,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserPlus,
  Workflow,
  Zap,
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
  Tabs,
  Textarea,
  Toggle,
  useOrbToast,
  type BadgeTone,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, timeAgo } from '@/components/orbat/overview/format';
import { cn } from '@/lib/utils';
import {
  BLOCK_PALETTE,
  WORKFLOW_TEMPLATES,
  createWorkflow,
  deleteAutomationRule,
  deleteWorkflow,
  edgeBezierPath,
  edgeLabelPoint,
  getAutomationStudioBootstrap,
  nextNodePosition,
  runWorkflowTest,
  saveWorkflowGraph,
  setWorkflowStatus,
  toggleAutomationRuleActive,
  useAutomationLiveSync,
  type AutomationRuleSummary,
  type AutomationStudioBootstrap,
  type AutomationWorkflowRecord,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowNodeKind,
  type WorkflowRunRecord,
  type WorkflowStatus,
} from '@/lib/data/automation';
import { useData } from '@/lib/data/use-data';

type AutomationTab = 'editor' | 'runs' | 'all';

function statusTone(status: WorkflowStatus): BadgeTone {
  if (status === 'live') return 'ok';
  if (status === 'paused') return 'warn';
  if (status === 'error') return 'bad';
  return 'neutral';
}

function nodeIcon(kind: WorkflowNodeKind) {
  switch (kind) {
    case 'Trigger':
      return <Zap size={14} />;
    case 'AI':
      return <Sparkles size={14} />;
    case 'Condition':
      return <GitBranch size={14} />;
    case 'Delay':
      return <Clock size={14} />;
    case 'Handoff':
      return <UserPlus size={14} />;
    case 'Action':
    default:
      return <ArrowRight size={14} />;
  }
}

function nodeToneClasses(kind: WorkflowNodeKind, selected: boolean, highlighted: boolean) {
  if (highlighted) {
    return 'border-o-ai bg-o-ai-soft ring-2 ring-o-ai/40';
  }
  if (selected) {
    return kind === 'AI'
      ? 'border-o-ai bg-o-ai-soft/60 ring-2 ring-o-ai/25'
      : 'border-o-accent bg-o-accent-soft/50 ring-2 ring-o-accent/25';
  }
  if (kind === 'AI') {
    return 'border-o-ai/45 bg-o-surface hover:border-o-ai';
  }
  return 'border-o-border bg-o-surface hover:border-o-text-3';
}

export function AutomationScreen() {
  const { workspace } = useShellSession();
  const toast = useOrbToast();

  const studio = useData<AutomationStudioBootstrap>(
    () => getAutomationStudioBootstrap(workspace.id),
    ['automation-studio', workspace.id],
  );
  useAutomationLiveSync(workspace.id, studio.reload);

  const [tab, setTab] = useState<AutomationTab>('editor');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTemplateKey, setNewTemplateKey] = useState<string>('welcome');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutomationWorkflowRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const workflows = useMemo(() => studio.data?.workflows ?? [], [studio.data?.workflows]);
  const activeWorkflow = useMemo(() => {
    if (workflows.length === 0) return null;
    return workflows.find((w) => w.id === selectedWorkflowId) ?? workflows[0];
  }, [workflows, selectedWorkflowId]);

  const canManage = studio.data?.canManage ?? false;

  async function handleCreateWorkflow(templateKey: string | null, customName?: string, customDesc?: string) {
    setCreating(true);
    try {
      const created = await createWorkflow(workspace.id, {
        templateKey,
        name: customName,
        description: customDesc,
      });
      setSelectedWorkflowId(created.id);
      setCreateOpen(false);
      setNewName('');
      setNewDescription('');
      setTab('editor');
      toast.show({ message: `Created workflow "${created.name}".`, tone: 'ok' });
      studio.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleWorkflowStatus(wf: AutomationWorkflowRecord, next: WorkflowStatus) {
    try {
      await setWorkflowStatus(workspace.id, wf.id, next);
      toast.show({ message: `"${wf.name}" is now ${next}.`, tone: 'ok' });
      studio.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWorkflow(workspace.id, deleteTarget.id);
      if (selectedWorkflowId === deleteTarget.id) setSelectedWorkflowId(null);
      toast.show({ message: `Deleted "${deleteTarget.name}".`, tone: 'ok' });
      setDeleteTarget(null);
      studio.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleRule(rule: AutomationRuleSummary, next: boolean) {
    try {
      await toggleAutomationRuleActive(workspace.id, rule.id, next);
      toast.show({ message: `${rule.name} ${next ? 'enabled' : 'paused'}.`, tone: 'ok' });
      studio.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    }
  }

  async function handleDeleteRule(rule: AutomationRuleSummary) {
    try {
      await deleteAutomationRule(workspace.id, rule.id);
      toast.show({ message: `Deleted ticket trigger "${rule.name}".`, tone: 'ok' });
      studio.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    }
  }

  const runs = studio.data?.workflowRuns ?? [];
  const rules = studio.data?.rules ?? [];

  const runColumns: Column<WorkflowRunRecord>[] = [
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge tone={r.status === 'failed' ? 'bad' : r.status === 'handed_off' ? 'warn' : r.status === 'simulated' ? 'ai' : 'ok'} dot>
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'workflow',
      header: 'Workflow',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-o-text">{r.workflowName}</div>
          <div className="truncate text-[12px] text-o-text-3">{r.isTest ? 'Interactive test run' : 'Queue execution'}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      hideBelow: 'sm',
      cell: (r) => <span className="text-o-text-2">{r.customerName}</span>,
    },
    {
      key: 'path',
      header: 'Path taken',
      hideBelow: 'md',
      cell: (r) => <span className="line-clamp-1 text-[13px] text-o-text-2">{r.pathSummary || '—'}</span>,
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      hideBelow: 'md',
      cell: (r) => <span className="o-num text-o-text-2">{fmtInt(r.durationMs)} ms</span>,
    },
    {
      key: 'at',
      header: 'Ran',
      align: 'right',
      cell: (r) => <span className="text-[13px] text-o-text-3">{timeAgo(r.createdAt)} ago</span>,
    },
  ];

  return (
    <PageContainer className="flex flex-col gap-5">
      <PageHeader
        title="Automation studio"
        description="Orchestrate trigger-to-resolution flows, branch with AI, test paths safely, and inspect execution logs."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/app/automation/journeys" variant="secondary" size="sm" leading={<GitBranch size={14} />}>
              Customer journeys →
            </ButtonLink>
            {canManage ? (
              <Button variant="primary" size="sm" leading={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                New workflow
              </Button>
            ) : null}
          </div>
        }
      />

      <Tabs
        label="Automation sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'editor', label: 'Workflow editor' },
          { id: 'runs', label: 'Runs', count: runs.length },
          { id: 'all', label: 'All workflows', count: workflows.length + rules.length },
        ]}
      />

      {studio.error ? (
        <Card>
          <ErrorState body={studio.error} onRetry={studio.reload} />
        </Card>
      ) : studio.loading && !studio.data ? (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr_300px]">
          <Card><Skeleton height={340} /></Card>
          <Card><Skeleton height={440} /></Card>
          <Card><Skeleton height={340} /></Card>
        </div>
      ) : tab === 'editor' ? (
        !activeWorkflow ? (
          <Card>
            <EmptyState
              icon={<Workflow size={26} />}
              title="No workflows created yet"
              body="Start from one of our 7 proven automation templates or build a blank trigger-to-resolution graph."
              action={
                canManage ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="primary" size="sm" leading={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                      New workflow
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={creating}
                      onClick={() => handleCreateWorkflow('order_status')}
                    >
                      Use “Order status” template
                    </Button>
                  </div>
                ) : null
              }
            />
          </Card>
        ) : (
          <WorkflowEditorPane
            key={activeWorkflow.id}
            workspaceId={workspace.id}
            canManage={canManage}
            workflows={workflows}
            workflow={activeWorkflow}
            onSelectWorkflow={setSelectedWorkflowId}
            onCreateFromTemplate={(key) => handleCreateWorkflow(key)}
            onSaved={studio.reload}
          />
        )
      ) : tab === 'runs' ? (
        <div className="flex flex-col gap-4">
          <Card flush>
            <CardHeader
              title="Workflow execution runs"
              sub="Interactive tests and queued workflow runs recorded in Postgres."
              className="border-b border-o-border px-5 py-4"
            />
            {runs.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Play size={22} />}
                  title="No workflow runs yet"
                  body="Open the Workflow editor and run an interactive test to verify branching and AI drafts."
                />
              </div>
            ) : (
              <Table
                columns={runColumns}
                rows={runs}
                rowKey={(r) => r.id}
                caption="Recent workflow execution runs"
              />
            )}
          </Card>

          {(studio.data?.ruleRuns.length ?? 0) > 0 ? (
            <Card flush>
              <CardHeader
                title="Ticket rule audit runs"
                sub="Synchronous ticket trigger evaluations executed on ticket updates."
                className="border-b border-o-border px-5 py-4"
              />
              <div className="divide-y divide-o-border">
                {studio.data?.ruleRuns.map((rr) => (
                  <div key={rr.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[13.5px]">
                    <div className="flex items-center gap-2">
                      <Badge tone={rr.error ? 'bad' : rr.matched ? 'ok' : 'neutral'} dot>
                        {rr.error ? 'Error' : rr.matched ? 'Matched' : 'Skipped'}
                      </Badge>
                      <span className="font-medium text-o-text">{rr.ruleName}</span>
                    </div>
                    <span className="text-[12.5px] text-o-text-3">{timeAgo(rr.ranAt)} ago</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {workflows.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Layers size={24} />}
                title="No visual workflows yet"
                body="Create a workflow from a starter template to manage its status and steps here."
                action={
                  canManage ? (
                    <Button variant="primary" size="sm" leading={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                      New workflow
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workflows.map((wf) => (
                <Card key={wf.id} className="flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold text-o-text">{wf.name}</h3>
                        <p className="mt-1 line-clamp-2 text-[13px] text-o-text-2">
                          {wf.description || 'Trigger-to-resolution workflow'}
                        </p>
                      </div>
                      <Badge tone={statusTone(wf.status)} dot>
                        {wf.status}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-[12.5px] text-o-text-3">
                      <span><strong className="o-num text-o-text">{wf.nodes.length}</strong> blocks</span>
                      <span><strong className="o-num text-o-text">{fmtInt(wf.runs7d)}</strong> runs (7d)</span>
                      <span>Updated {timeAgo(wf.updatedAt)} ago</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-o-border pt-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedWorkflowId(wf.id);
                          setTab('editor');
                        }}
                      >
                        Open editor
                      </Button>
                      {canManage ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleToggleWorkflowStatus(wf, wf.status === 'live' ? 'paused' : 'live')
                          }
                        >
                          {wf.status === 'live' ? 'Pause' : 'Publish live'}
                        </Button>
                      ) : null}
                    </div>
                    {canManage ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon
                        aria-label={`Delete ${wf.name}`}
                        onClick={() => setDeleteTarget(wf)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Card flush>
            <CardHeader
              title="Ticket trigger & SLA rules"
              sub="Classic rule engine evaluated automatically when tickets are created, updated, or expire."
              className="border-b border-o-border px-5 py-4"
            />
            {rules.length === 0 ? (
              <div className="p-6 text-[13.5px] text-o-text-3">
                No classic ticket rules configured yet.
              </div>
            ) : (
              <div className="divide-y divide-o-border">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-o-text">{rule.name}</span>
                        <Badge tone="neutral">{rule.kind}</Badge>
                        <span className="text-[12.5px] text-o-text-3 o-num">{fmtInt(rule.runCount)} runs</span>
                      </div>
                      {rule.description ? (
                        <p className="mt-0.5 truncate text-[13px] text-o-text-2">{rule.description}</p>
                      ) : null}
                    </div>
                    {canManage ? (
                      <div className="flex items-center gap-2">
                        <Toggle
                          checked={rule.isActive}
                          onChange={(next) => handleToggleRule(rule, next)}
                          label={`Toggle ${rule.name}`}
                          hideLabel
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon
                          aria-label={`Delete rule ${rule.name}`}
                          onClick={() => handleDeleteRule(rule)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New automation workflow"
        description="Pick a starter blueprint or create an editable workflow from scratch."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={creating}
              onClick={() =>
                handleCreateWorkflow(
                  newTemplateKey === 'custom' ? null : newTemplateKey,
                  newName || undefined,
                  newDescription || undefined,
                )
              }
            >
              Create workflow
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Starter blueprint">
            <Select
              value={newTemplateKey}
              onChange={(e) => setNewTemplateKey(e.target.value)}
              options={[
                ...WORKFLOW_TEMPLATES.map((t) => ({ value: t.key, label: t.name })),
                { value: 'custom', label: 'Blank custom workflow' },
              ]}
            />
          </Field>
          <Field label="Workflow name" hint="Leave blank to use the template title">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Order tracking triage"
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={3}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What triggers this workflow and how does it resolve or route conversations?"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete workflow?"
        body={`"${deleteTarget?.name ?? ''}" and its execution history will be permanently removed.`}
        confirmLabel="Delete workflow"
        variant="danger"
        busy={deleting}
      />
    </PageContainer>
  );
}

/* ---------- Workflow Visual Canvas & Inspector ---------- */

function nextNodeUid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function WorkflowEditorPane({
  workspaceId,
  canManage,
  workflows,
  workflow,
  onSelectWorkflow,
  onCreateFromTemplate,
  onSaved,
}: {
  workspaceId: string;
  canManage: boolean;
  workflows: AutomationWorkflowRecord[];
  workflow: AutomationWorkflowRecord;
  onSelectWorkflow: (id: string) => void;
  onCreateFromTemplate: (key: string) => void;
  onSaved: () => void;
}) {
  const toast = useOrbToast();
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const [status, setStatus] = useState<WorkflowStatus>(workflow.status);
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflow.nodes);
  const [edges, setEdges] = useState<WorkflowEdge[]>(workflow.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(workflow.nodes[0]?.id ?? null);
  const [saving, setSaving] = useState(false);

  // Interactive test trace state
  const [testMsg, setTestMsg] = useState('Where is my order ORD-1042?');
  const [testing, setTesting] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [lastRun, setLastRun] = useState<WorkflowRunRecord | null>(null);
  const [aiPreview, setAiPreview] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? nodes[0] ?? null,
    [nodes, selectedNodeId],
  );

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const canvasHeight = useMemo(
    () => Math.max(480, ...nodes.map((n) => n.y + 130)),
    [nodes],
  );

  function addBlock(kind: WorkflowNodeKind) {
    const spec = BLOCK_PALETTE.find((b) => b.kind === kind) ?? BLOCK_PALETTE[0];
    const pos = nextNodePosition(nodes);
    const id = nextNodeUid('n');
    const newNode: WorkflowNode = {
      id,
      kind,
      label: spec.label,
      subtitle: spec.subtitle,
      x: pos.x,
      y: pos.y,
      tone: spec.tone,
      config: { ...spec.defaultConfig },
    };
    const parentId = selectedNode?.id ?? nodes[nodes.length - 1]?.id ?? null;
    setNodes((prev) => [...prev, newNode]);
    if (parentId) {
      setEdges((prev) => [
        ...prev,
        { id: nextNodeUid('e'), from: parentId, to: id, condition: 'always' },
      ]);
    }
    setSelectedNodeId(id);
  }

  function updateSelectedNode(patch: Partial<WorkflowNode>) {
    if (!selectedNode) return;
    setNodes((prev) =>
      prev.map((n) => (n.id === selectedNode.id ? { ...n, ...patch } : n)),
    );
  }

  function updateNodeConfig(key: string, val: string | number | boolean) {
    if (!selectedNode) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNode.id
          ? { ...n, config: { ...n.config, [key]: val } }
          : n,
      ),
    );
  }

  function removeSelectedNode() {
    if (!selectedNode || nodes.length <= 1) return;
    const targetId = selectedNode.id;
    const remaining = nodes.filter((n) => n.id !== targetId);
    setNodes(remaining);
    setEdges((prev) => prev.filter((e) => e.from !== targetId && e.to !== targetId));
    setSelectedNodeId(remaining[0]?.id ?? null);
  }

  async function handleSave(nextStatus?: WorkflowStatus) {
    setSaving(true);
    try {
      const targetStatus = nextStatus ?? status;
      const saved = await saveWorkflowGraph(workspaceId, {
        id: workflow.id,
        name,
        description,
        status: targetStatus,
        nodes,
        edges,
      });
      setStatus(saved.status);
      toast.show({ message: `Saved "${saved.name}".`, tone: 'ok' });
      onSaved();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRunTest() {
    setTesting(true);
    setHighlightedIds([]);
    try {
      // Save latest unsaved graph edits if user can manage, then run test
      if (canManage) {
        await saveWorkflowGraph(workspaceId, {
          id: workflow.id,
          name,
          description,
          status,
          nodes,
          edges,
        });
      }
      const res = await runWorkflowTest(workspaceId, workflow.id, {
        message: testMsg,
        customerName: 'Interactive Tester',
      });
      setHighlightedIds(res.visitedIds);
      setLastRun(res.run);
      setAiPreview(res.aiReplyPreview);
      if (res.visitedIds[0]) setSelectedNodeId(res.visitedIds[0]);
      toast.show({ message: 'Test trace completed and logged to Runs.', tone: 'ok' });
      onSaved();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_310px]">
      {/* Left Palette & Templates */}
      <div className="flex flex-col gap-4">
        <Card size="md" className="flex flex-col gap-3">
          <Field label="Active workflow">
            <Select
              value={workflow.id}
              onChange={(e) => onSelectWorkflow(e.target.value)}
              options={workflows.map((w) => ({ value: w.id, label: `${w.name} (${w.status})` }))}
            />
          </Field>
          <div className="flex items-center justify-between gap-2">
            <Badge tone={statusTone(status)} dot>{status}</Badge>
            <span className="text-[12px] text-o-text-3 o-num">{fmtInt(workflow.runs7d)} runs</span>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                className="flex-1"
                loading={saving}
                leading={<Save size={13} />}
                onClick={() => handleSave()}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={() => handleSave(status === 'live' ? 'paused' : 'live')}
              >
                {status === 'live' ? 'Pause' : 'Go live'}
              </Button>
            </div>
          ) : null}
        </Card>

        {canManage ? (
          <Card size="md">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-o-text-3">
              Blocks
            </h3>
            <p className="mt-0.5 text-[12px] text-o-text-3">Click to append after selected step</p>
            <div className="mt-3 flex flex-col gap-1.5">
              {BLOCK_PALETTE.map((b) => (
                <button
                  key={b.kind}
                  type="button"
                  onClick={() => addBlock(b.kind)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[10px] border border-o-border bg-o-surface-2 px-3 py-2 text-left text-[13px] font-medium text-o-text transition-colors hover:border-o-accent',
                    b.kind === 'AI' && 'border-o-ai/35 bg-o-ai-soft/40 text-o-ai-text hover:border-o-ai',
                  )}
                >
                  <span className={cn('grid h-6 w-6 place-items-center rounded-[7px]', b.kind === 'AI' ? 'bg-o-ai text-white' : 'bg-o-surface text-o-text-2')}>
                    {nodeIcon(b.kind)}
                  </span>
                  <span className="flex-1 truncate">{b.kind}</span>
                  <Plus size={13} className="text-o-text-3" />
                </button>
              ))}
            </div>
          </Card>
        ) : null}

        {canManage ? (
          <Card size="md">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-o-text-3">
              Starter templates
            </h3>
            <div className="mt-2.5 flex flex-col gap-1">
              {WORKFLOW_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onCreateFromTemplate(t.key)}
                  className="rounded-[8px] px-2.5 py-1.5 text-left text-[13px] text-o-text-2 transition-colors hover:bg-o-surface-2 hover:text-o-text"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      {/* Center SVG Flow Canvas */}
      <Card flush className="flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-o-border px-4 py-3">
          <div className="min-w-0">
            <span className="text-[14px] font-semibold text-o-text">{name || workflow.name}</span>
            <span className="ml-2 text-[12.5px] text-o-text-3">{nodes.length} steps</span>
          </div>
          <Button
            size="sm"
            variant="ai"
            loading={testing}
            leading={<Play size={13} />}
            onClick={handleRunTest}
          >
            Test workflow
          </Button>
        </div>

        <div className="overflow-x-auto bg-o-bg/60 p-4">
          <div
            className="relative mx-auto min-w-[640px]"
            style={{ width: 660, height: canvasHeight }}
          >
            <svg
              width={660}
              height={canvasHeight}
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
            >
              {edges.map((edge) => {
                const from = nodeMap.get(edge.from);
                const to = nodeMap.get(edge.to);
                if (!from || !to) return null;
                const d = edgeBezierPath(from, to);
                const active =
                  highlightedIds.includes(from.id) && highlightedIds.includes(to.id);
                const mid = edgeLabelPoint(from, to);
                return (
                  <g key={edge.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={active ? 'var(--ai)' : 'var(--border-strong, var(--border))'}
                      strokeWidth={active ? 2.5 : 1.75}
                      strokeDasharray={edge.condition === 'no' ? '5 4' : undefined}
                    />
                    {edge.label ? (
                      <g transform={`translate(${mid.x}, ${mid.y})`}>
                        <rect
                          x={-20}
                          y={-10}
                          width={40}
                          height={20}
                          rx={10}
                          fill={edge.condition === 'yes' ? 'var(--ok-soft)' : 'var(--surface-2)'}
                          stroke="var(--border)"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={11}
                          fontWeight={600}
                          fill={edge.condition === 'yes' ? 'var(--ok)' : 'var(--text-2)'}
                        >
                          {edge.label}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </svg>

            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isHighlighted = highlightedIds.includes(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{ left: node.x, top: node.y, width: 220, minHeight: 76 }}
                  className={cn(
                    'absolute rounded-[14px] border p-3 text-left shadow-sm transition-all',
                    nodeToneClasses(node.kind, isSelected, isHighlighted),
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide',
                        node.kind === 'AI' ? 'text-o-ai-text' : 'text-o-text-3',
                      )}
                    >
                      {nodeIcon(node.kind)}
                      {node.kind}
                    </span>
                    {node.branch ? (
                      <Badge tone={node.branch === 'yes' ? 'ok' : 'neutral'}>
                        {node.branch}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-[13.5px] font-semibold text-o-text">
                    {node.label}
                  </div>
                  <div className="truncate text-[12px] text-o-text-3">{node.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Right Step Inspector + Test Trace */}
      <div className="flex flex-col gap-4">
        <Card size="md" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="o-card__title">Step inspector</h3>
            {selectedNode ? (
              <Badge tone={selectedNode.kind === 'AI' ? 'ai' : 'neutral'}>
                {selectedNode.kind}
              </Badge>
            ) : null}
          </div>

          {canManage ? (
            <>
              <Field label="Workflow title">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Description">
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              {selectedNode ? (
                <>
                  <Field label="Step title">
                    <Input
                      value={selectedNode.label}
                      onChange={(e) => updateSelectedNode({ label: e.target.value })}
                    />
                  </Field>
                  <Field label="Subtitle">
                    <Input
                      value={selectedNode.subtitle}
                      onChange={(e) => updateSelectedNode({ subtitle: e.target.value })}
                    />
                  </Field>
                  {selectedNode.kind === 'AI' ? (
                    <Field label="AI prompt instructions">
                      <Textarea
                        rows={3}
                        value={String(selectedNode.config.prompt ?? '')}
                        onChange={(e) => updateNodeConfig('prompt', e.target.value)}
                      />
                    </Field>
                  ) : null}
                  {selectedNode.kind === 'Condition' ? (
                    <Field label="Check field">
                      <Select
                        value={String(selectedNode.config.field ?? 'order_number')}
                        onChange={(e) => updateNodeConfig('field', e.target.value)}
                        options={[
                          { value: 'order_number', label: 'Order # in message' },
                          { value: 'ai_confidence', label: 'AI confidence >= 75%' },
                          { value: 'message_present', label: 'Any message text' },
                        ]}
                      />
                    </Field>
                  ) : null}
                  {selectedNode.kind === 'Action' ? (
                    <Field label="Reply template">
                      <Textarea
                        rows={2}
                        value={String(selectedNode.config.template ?? '')}
                        onChange={(e) => updateNodeConfig('template', e.target.value)}
                      />
                    </Field>
                  ) : null}
                  {selectedNode.kind === 'Delay' ? (
                    <Field label="Delay (minutes)">
                      <Input
                        type="number"
                        min={1}
                        max={43200}
                        value={Number(selectedNode.config.minutes ?? 15)}
                        onChange={(e) => updateNodeConfig('minutes', Number(e.target.value) || 15)}
                      />
                    </Field>
                  ) : null}
                  {selectedNode.kind === 'Handoff' ? (
                    <Field label="Target queue / team">
                      <Input
                        value={String(selectedNode.config.team ?? 'Support queue')}
                        onChange={(e) => updateNodeConfig('team', e.target.value)}
                      />
                    </Field>
                  ) : null}
                  {nodes.length > 1 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="self-start text-o-bad"
                      leading={<Trash2 size={13} />}
                      onClick={removeSelectedNode}
                    >
                      Remove step
                    </Button>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <Alert tone="warn">
              Only workspace admins or owners can modify automation workflows.
            </Alert>
          )}
        </Card>

        <Card size="md" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Bot size={15} className="text-o-ai-text" />
            <h3 className="o-card__title">Interactive test runner</h3>
          </div>
          <Field label="Sample customer message">
            <Textarea
              rows={2}
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              placeholder="e.g. Where is my order ORD-1042?"
            />
          </Field>
          <Button
            variant="ai"
            size="sm"
            loading={testing}
            leading={<Play size={13} />}
            onClick={handleRunTest}
          >
            Simulate path
          </Button>

          {lastRun ? (
            <div className="mt-1 flex flex-col gap-2 rounded-[12px] border border-o-border bg-o-surface-2 p-3 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-o-text">Execution trace</span>
                <span className="o-num text-o-text-3">{lastRun.durationMs} ms</span>
              </div>
              <ol className="flex flex-col gap-1.5">
                {lastRun.stepsExecuted.map((step, i) => (
                  <li key={`${step.nodeId}-${i}`} className="flex items-start gap-2">
                    <span className="mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full bg-o-surface text-[10px] font-bold text-o-text-2">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-o-text">{step.label}</div>
                      <div className="text-[11.5px] text-o-text-3">{step.detail}</div>
                    </div>
                  </li>
                ))}
              </ol>
              {aiPreview ? (
                <div className="mt-1 rounded-[8px] border border-o-ai/30 bg-o-ai-soft/40 p-2 text-[12px] text-o-text">
                  <strong className="text-o-ai-text">Live AI draft:</strong> {aiPreview}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-o-text-3">
              <AlertTriangle size={13} />
              <span>Run a test to trace conditions without messaging live visitors.</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
