'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSearch,
  Globe,
  Plus,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
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
  TabPanel,
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
import {
  createCustomCompliancePolicy,
  createDataRequest,
  deleteCompliancePolicy,
  downloadDsrBundleJson,
  exportComplianceEvidenceCsv,
  getComplianceCenter,
  processDataRequest,
  reviewComplianceFlag,
  testComplianceMessage,
  toggleSentinel,
  updateCompliancePolicy,
  updateDataRetention,
  useComplianceLiveSync,
  type ComplianceCenterBootstrap,
  type ComplianceDataRequestRow,
  type ComplianceFlagRow,
} from '@/lib/data/compliance';
import type { PolicyActionMode, PolicyCategory, PolicyEvaluationResult } from '@/lib/compliance/policy-evaluator';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

type ComplianceTab = 'overview' | 'policies' | 'flags' | 'dsr' | 'audit';

function flagSeverityTone(sev: ComplianceFlagRow['severity']): BadgeTone {
  if (sev === 'high') return 'bad';
  if (sev === 'medium') return 'warn';
  return 'neutral';
}

function reviewTone(st: ComplianceFlagRow['reviewStatus']): BadgeTone {
  if (st === 'confirmed') return 'ok';
  if (st === 'false_positive') return 'neutral';
  return 'warn';
}

export function ComplianceScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();

  const [tab, setTab] = useState<ComplianceTab>('overview');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Simulator
  const [simText, setSimText] = useState('');
  const [simChannel, setSimChannel] = useState<'ai' | 'human'>('ai');
  const [simRecordFlag, setSimRecordFlag] = useState(false);
  const [simResult, setSimResult] = useState<PolicyEvaluationResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  // Add Custom Policy Modal
  const [addPolicyOpen, setAddPolicyOpen] = useState(false);
  const [polName, setPolName] = useState('');
  const [polCategory, setPolCategory] = useState<PolicyCategory>('custom');
  const [polFramework, setPolFramework] = useState('GDPR');
  const [polMode, setPolMode] = useState<PolicyActionMode>('block');
  const [polPattern, setPolPattern] = useState('');

  // Retention Modal
  const [retModalOpen, setRetModalOpen] = useState(false);
  const [retDaysInput, setRetDaysInput] = useState('365');

  // New DSR Modal
  const [dsrModalOpen, setDsrModalOpen] = useState(false);
  const [dsrType, setDsrType] = useState<'export' | 'erasure' | 'rectification' | 'opt_out'>('export');
  const [dsrReg, setDsrReg] = useState('GDPR');
  const [dsrName, setDsrName] = useState('');
  const [dsrEmail, setDsrEmail] = useState('');

  // Erasure Confirm Dialog
  const [confirmDsr, setConfirmDsr] = useState<ComplianceDataRequestRow | null>(null);

  const { data, loading, error, reload } = useData<ComplianceCenterBootstrap>(
    () => getComplianceCenter(workspace!.id),
    [workspace?.id],
    { enabled: Boolean(workspace?.id) },
  );

  useComplianceLiveSync(workspace?.id, () => reload(), Boolean(workspace?.id));

  if (!workspace?.id) {
    return (
      <PageContainer>
        <ErrorState title="No workspace selected" body="Select a workspace to manage compliance controls." />
      </PageContainer>
    );
  }

  async function handleRunSimulator() {
    if (!workspace?.id || !simText.trim()) return;
    setSimBusy(true);
    try {
      const res = await testComplianceMessage(workspace.id, {
        text: simText,
        channel: simChannel,
        recordFlag: simRecordFlag,
      });
      setSimResult(res);
      if (simRecordFlag && res.hits.length > 0) {
        show({ message: `Matched ${res.hits.length} rule(s) and recorded trace flag`, tone: 'info' });
        await reload();
      }
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Simulation failed', tone: 'bad' });
    } finally {
      setSimBusy(false);
    }
  }

  async function handleCreatePolicy() {
    if (!workspace?.id) return;
    setBusyKey('create-pol');
    try {
      await createCustomCompliancePolicy(workspace.id, {
        name: polName,
        category: polCategory,
        framework: polFramework,
        actionMode: polMode,
        appliesTo: 'both',
        patternType: 'keyword',
        pattern: polPattern,
      });
      show({ message: `Rule “${polName}” added and active`, tone: 'ok' });
      setPolName('');
      setPolPattern('');
      setAddPolicyOpen(false);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to create rule', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateDsr() {
    if (!workspace?.id) return;
    setBusyKey('create-dsr');
    try {
      await createDataRequest(workspace.id, {
        requestType: dsrType,
        regulation: dsrReg,
        requesterName: dsrName,
        requesterEmail: dsrEmail,
      });
      show({ message: 'Data subject request logged', tone: 'ok' });
      setDsrName('');
      setDsrEmail('');
      setDsrModalOpen(false);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to log data request', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleProcessDsr(req: ComplianceDataRequestRow, decision: 'approve_complete' | 'reject') {
    if (!workspace?.id) return;
    setBusyKey(`dsr-${req.id}`);
    try {
      const res = await processDataRequest(workspace.id, req.id, decision);
      if (decision === 'approve_complete' && res.exportBundle) {
        downloadDsrBundleJson(`dsr-export-${req.id.slice(0, 8)}.json`, res.exportBundle);
        show({ message: `DSR completed — JSON archive downloaded`, tone: 'ok' });
      } else {
        show({
          message:
            decision === 'reject'
              ? 'Request marked rejected'
              : req.requestType === 'erasure'
                ? 'Customer PII erased & audit log updated'
                : 'Request marked completed',
          tone: decision === 'reject' ? 'info' : 'ok',
        });
      }
      setConfirmDsr(null);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Could not process request', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  const flagColumns: Column<ComplianceFlagRow>[] = [
    {
      key: 'sev',
      header: 'Severity',
      cell: (f) => <Badge tone={flagSeverityTone(f.severity)}>{f.severity}</Badge>,
    },
    {
      key: 'rule',
      header: 'Rule / Excerpt',
      cell: (f) => (
        <div className="min-w-0 max-w-md">
          <div className="font-medium text-o-text">{f.ruleName}</div>
          <div className="mt-0.5 truncate rounded bg-o-surface-2 px-2 py-0.5 font-mono text-[12px] text-o-text-2">
            {f.redactedExcerpt}
          </div>
        </div>
      ),
    },
    {
      key: 'fw',
      header: 'Framework',
      hideBelow: 'sm',
      cell: (f) => <Badge tone="neutral">{f.framework}</Badge>,
    },
    {
      key: 'action',
      header: 'Action',
      hideBelow: 'md',
      cell: (f) => <span className="capitalize text-o-text-2">{f.actionTaken}</span>,
    },
    {
      key: 'status',
      header: 'Review',
      cell: (f) => (
        <Badge tone={reviewTone(f.reviewStatus)}>
          {f.reviewStatus === 'false_positive' ? 'False positive' : f.reviewStatus}
        </Badge>
      ),
    },
    {
      key: 'ops',
      header: '',
      align: 'right',
      cell: (f) => {
        if (!data?.canManage || f.reviewStatus !== 'open') {
          return <span className="text-[12px] text-o-text-3">{timeAgo(f.createdAt)}</span>;
        }
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              loading={busyKey === `flag-${f.id}`}
              onClick={async () => {
                setBusyKey(`flag-${f.id}`);
                try {
                  await reviewComplianceFlag(workspace.id, f.id, 'confirmed');
                  show({ message: 'Flag confirmed', tone: 'ok' });
                  await reload();
                } finally {
                  setBusyKey(null);
                }
              }}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={busyKey === `flag-${f.id}`}
              onClick={async () => {
                setBusyKey(`flag-${f.id}`);
                try {
                  await reviewComplianceFlag(workspace.id, f.id, 'false_positive');
                  show({ message: 'Marked false positive', tone: 'info' });
                  await reload();
                } finally {
                  setBusyKey(null);
                }
              }}
            >
              Dismiss
            </Button>
          </div>
        );
      },
    },
  ];

  const dsrColumns: Column<ComplianceDataRequestRow>[] = [
    {
      key: 'req',
      header: 'Requester',
      cell: (d) => (
        <div>
          <div className="font-medium text-o-text">{d.requesterName}</div>
          <div className="text-[12px] text-o-text-3">{d.requesterEmail}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (d) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={d.requestType === 'erasure' ? 'bad' : 'accent'}>{d.requestType}</Badge>
          <span className="text-[12px] text-o-text-3">{d.regulation}</span>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      hideBelow: 'sm',
      cell: (d) => (
        <div className="flex items-center gap-2 min-w-[110px]">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-o-surface-3">
            <div
              className={cn('h-full rounded-full', d.status === 'completed' ? 'bg-o-ok' : 'bg-o-accent')}
              style={{ width: `${d.progressPct}%` }}
            />
          </div>
          <span className="o-num text-[12px] text-o-text-2">{d.progressPct}%</span>
        </div>
      ),
    },
    {
      key: 'due',
      header: 'Due / Status',
      cell: (d) => (
        <div>
          <Badge
            tone={
              d.status === 'completed' ? 'ok' : d.status === 'rejected' ? 'neutral' : 'warn'
            }
          >
            {d.status.replace('_', ' ')}
          </Badge>
          <div className="mt-0.5 text-[11.5px] text-o-text-3">Due {d.dueAt.slice(0, 10)}</div>
        </div>
      ),
    },
    {
      key: 'ops',
      header: '',
      align: 'right',
      cell: (d) => {
        if (!data?.canManage || d.status === 'completed' || d.status === 'rejected') return null;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="primary"
              loading={busyKey === `dsr-${d.id}`}
              onClick={() => {
                if (d.requestType === 'erasure') {
                  setConfirmDsr(d);
                } else {
                  handleProcessDsr(d, 'approve_complete');
                }
              }}
            >
              {d.requestType === 'export' ? 'Export & complete' : d.requestType === 'erasure' ? 'Execute erasure' : 'Complete'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={busyKey === `dsr-${d.id}`}
              onClick={() => handleProcessDsr(d, 'reject')}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  const openFlags = data?.flags.filter((f) => f.reviewStatus === 'open') ?? [];
  const pendingDsrs =
    data?.dataRequests.filter((d) => ['open', 'in_progress', 'pending_approval'].includes(d.status)) ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Compliance center"
        description="Real-time Sentinel guardrails across AI and human replies, PII redaction, DSR fulfillment, and audit history."
        actions={
          <>
            <ButtonLink href="/app/compliance/website-audit" variant="secondary" leading={<Globe size={15} />}>
              Website audit
            </ButtonLink>
            <ButtonLink href="/app/compliance/policies" variant="secondary" leading={<FileSearch size={15} />}>
              Policy to guardrails
            </ButtonLink>
            {data ? (
              <Button
                variant="primary"
                leading={<Download size={15} />}
                onClick={() => exportComplianceEvidenceCsv(data)}
              >
                Export evidence
              </Button>
            ) : null}
          </>
        }
      />

      {error ? <ErrorState title="Could not load compliance center" body={error} onRetry={reload} /> : null}

      <Tabs<ComplianceTab>
        idBase="compliance"
        label="Compliance sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'policies', label: 'Policies & guardrails', count: data?.stats.totalPolicies },
          { id: 'flags', label: 'Flags & redactions', count: openFlags.length },
          { id: 'dsr', label: 'Data requests', count: pendingDsrs.length },
          { id: 'audit', label: 'Audit log', count: data?.auditLogs.length },
        ]}
      />

      {loading && !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36 rounded-2xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        </div>
      ) : null}

      {data && tab === 'overview' ? (
        <TabPanel idBase="compliance" id="overview" className="flex flex-col gap-6">
          {/* Sentinel Dark Forest Hero Banner */}
          <div className="rounded-3xl bg-[#163300] p-6 text-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#9FE870]">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-[17px] font-bold tracking-tight">ORBAT Sentinel runtime enforcement</h3>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
                        data.sentinelEnabled ? 'bg-[#9FE870] text-[#163300]' : 'bg-white/15 text-white',
                      )}
                    >
                      {data.sentinelEnabled ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="mt-1 max-w-2xl text-[13px] text-white/80">
                    Scans outgoing AI responses before dispatch using your enabled workspace guardrails ({data.stats.enabledPolicies} active rule{data.stats.enabledPolicies === 1 ? '' : 's'}).
                  </p>
                </div>
              </div>
              {data.canManage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRetDaysInput(data.retentionDays ? String(data.retentionDays) : '365');
                      setRetModalOpen(true);
                    }}
                  >
                    Retention: {data.retentionDays ? `${data.retentionDays}d` : 'Not set'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyKey === 'sentinel'}
                    onClick={async () => {
                      setBusyKey('sentinel');
                      try {
                        await toggleSentinel(workspace.id, !data.sentinelEnabled);
                        show({
                          message: !data.sentinelEnabled ? 'Sentinel enforcement enabled' : 'Sentinel paused',
                          tone: !data.sentinelEnabled ? 'ok' : 'info',
                        });
                        await reload();
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                  >
                    {data.sentinelEnabled ? 'Pause Sentinel' : 'Enable Sentinel'}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4 sm:grid-cols-4">
              <div>
                <div className="text-[12px] text-white/70">AI replies verified (30d)</div>
                <div className="mt-0.5 o-num text-[22px] font-bold">{fmtInt(data.stats.checkedReplies30d)}</div>
              </div>
              <div>
                <div className="text-[12px] text-white/70">Blocked / redacted (30d)</div>
                <div className="mt-0.5 o-num text-[22px] font-bold text-[#9FE870]">
                  {fmtInt(data.stats.blockedOrHeld30d)}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-white/70">Open review flags</div>
                <div className="mt-0.5 o-num text-[22px] font-bold">{fmtInt(data.stats.openFlags)}</div>
              </div>
              <div>
                <div className="text-[12px] text-white/70">Open data requests</div>
                <div className="mt-0.5 o-num text-[22px] font-bold">{fmtInt(data.stats.pendingDsr)}</div>
              </div>
            </div>
          </div>

          {/* 6 Framework Readiness Scorecards */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-o-text">Control readiness by framework</h3>
              <span className="text-[12px] text-o-text-3">
                Calculated from live workspace settings, active policies, and audit records (not legal certification)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.frameworks.map((fw) => (
                <Card key={fw.id} className="flex flex-col gap-2.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-o-text">{fw.name}</div>
                      <div className="text-[12px] text-o-text-3">{fw.scope}</div>
                    </div>
                    <Badge
                      tone={fw.status === 'active' ? 'ok' : fw.status === 'not_attested' ? 'warn' : 'neutral'}
                    >
                      <span className="o-num">{fw.coveragePct}%</span>
                    </Badge>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-o-surface-3">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        fw.coveragePct >= 80 ? 'bg-o-ok' : fw.coveragePct >= 50 ? 'bg-o-warn' : 'bg-o-bad',
                      )}
                      style={{ width: `${fw.coveragePct}%` }}
                    />
                  </div>
                  <div className="text-[12px] text-o-text-2">{fw.note}</div>
                </Card>
              ))}
            </div>
          </div>

          {/* Action Queues Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title={`Needs review (${openFlags.length})`}
                sub="Redacted or blocked messages awaiting compliance officer sign-off"
                actions={
                  <Button size="sm" variant="ghost" onClick={() => setTab('flags')}>
                    View all
                  </Button>
                }
              />
              {openFlags.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 size={20} />}
                  title="No open compliance flags"
                  body="All triggered Sentinel checks have been reviewed."
                />
              ) : (
                <div className="mt-4 divide-y divide-o-border">
                  {openFlags.slice(0, 4).map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone={flagSeverityTone(f.severity)}>{f.severity}</Badge>
                          <span className="truncate text-[13.5px] font-medium text-o-text">{f.ruleName}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-o-text-3">{f.redactedExcerpt}</div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setTab('flags')}>
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title={`Data requests due (${pendingDsrs.length})`}
                sub="GDPR & CCPA export / erasure requests"
                actions={
                  <Button size="sm" variant="ghost" onClick={() => setTab('dsr')}>
                    Manage DSRs
                  </Button>
                }
              />
              {pendingDsrs.length === 0 ? (
                <EmptyState
                  icon={<Shield size={20} />}
                  title="No pending data requests"
                  body="Log and fulfill GDPR/CCPA data export or erasure requests from the Data requests tab."
                />
              ) : (
                <div className="mt-4 divide-y divide-o-border">
                  {pendingDsrs.slice(0, 4).map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-o-text">
                          {d.requesterName} · {d.requestType}
                        </div>
                        <div className="text-[12px] text-o-text-3">
                          {d.regulation} · Due {d.dueAt.slice(0, 10)}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setTab('dsr')}>
                        Open
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </TabPanel>
      ) : null}

      {data && tab === 'policies' ? (
        <TabPanel idBase="compliance" id="policies" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13.5px] text-o-text-2">
                Active rules run live on AI replies and can be tested directly in the simulator.
              </div>
              {data.canManage ? (
                <div className="flex items-center gap-2">
                  <ButtonLink size="sm" variant="secondary" href="/app/compliance/policies" leading={<Sparkles size={14} />}>
                    Extract from document
                  </ButtonLink>
                  <Button size="sm" variant="primary" leading={<Plus size={14} />} onClick={() => setAddPolicyOpen(true)}>
                    Add custom rule
                  </Button>
                </div>
              ) : null}
            </div>

            <Card flush>
              <div className="divide-y divide-o-border">
                {data.policies.map((pol) => (
                  <div key={pol.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-o-text">{pol.name}</span>
                        <Badge tone="neutral">{pol.framework}</Badge>
                        {pol.sourceDocument ? <Badge tone="ai">{pol.sourceDocument}</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-o-text-2">{pol.description || pol.pattern}</p>
                      <div className="mt-1 text-[11.5px] text-o-text-3">
                        Applies to: {pol.appliesTo} · {fmtInt(pol.hitsCount)} recorded trigger{pol.hitsCount === 1 ? '' : 's'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Select
                        size="sm"
                        aria-label={`Action mode for ${pol.name}`}
                        disabled={!data.canManage}
                        value={pol.actionMode}
                        options={[
                          { value: 'redact', label: 'Redact' },
                          { value: 'block', label: 'Block' },
                          { value: 'escalate', label: 'Escalate' },
                          { value: 'approval', label: 'Approval' },
                          { value: 'flag', label: 'Flag' },
                        ]}
                        onChange={async (e) => {
                          await updateCompliancePolicy(workspace.id, pol.id, {
                            actionMode: e.target.value as PolicyActionMode,
                          });
                          show({ message: `Updated ${pol.name} action`, tone: 'ok' });
                          await reload();
                        }}
                      />
                      <Toggle
                        hideLabel
                        label={`Enable ${pol.name}`}
                        checked={pol.isEnabled}
                        disabled={!data.canManage}
                        onChange={async (next) => {
                          await updateCompliancePolicy(workspace.id, pol.id, { isEnabled: next });
                          show({ message: `${pol.name} ${next ? 'enabled' : 'disabled'}`, tone: 'info' });
                          await reload();
                        }}
                      />
                      {!pol.ruleKey && data.canManage ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon
                          aria-label={`Delete ${pol.name}`}
                          onClick={async () => {
                            await deleteCompliancePolicy(workspace.id, pol.id);
                            show({ message: `Deleted rule ${pol.name}`, tone: 'info' });
                            await reload();
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Live Guardrail Simulator */}
          <Card className="h-fit flex flex-col gap-4">
            <CardHeader
              title="Live policy test simulator"
              sub="Test any draft message against your active workspace policies."
            />
            <Field label="Simulated actor">
              <Select
                value={simChannel}
                onChange={(e) => setSimChannel(e.target.value as 'ai' | 'human')}
                options={[
                  { value: 'ai', label: 'AI agent draft' },
                  { value: 'human', label: 'Human agent draft' },
                ]}
              />
            </Field>
            <Field label="Sample message">
              <Textarea
                rows={4}
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                placeholder="Try: Pay with card 4111 1111 1111 1111 or SSN 123-45-6789..."
              />
            </Field>
            {data.canManage ? (
              <Toggle
                checked={simRecordFlag}
                onChange={setSimRecordFlag}
                label="Record matched result to Flags & Redactions"
              />
            ) : null}
            <Button variant="primary" loading={simBusy} leading={<Send size={14} />} onClick={handleRunSimulator}>
              Evaluate message
            </Button>

            {simResult ? (
              <div className="flex flex-col gap-2 rounded-xl border border-o-border bg-o-surface-2/60 p-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-o-text">Decision</span>
                  <Badge
                    tone={
                      simResult.outcome === 'allow'
                        ? 'ok'
                        : simResult.outcome === 'block'
                          ? 'bad'
                          : 'warn'
                    }
                  >
                    {simResult.outcome.toUpperCase()}
                  </Badge>
                </div>
                {simResult.hits.length > 0 ? (
                  <>
                    <div className="rounded-lg border border-o-border bg-o-surface p-2 font-mono text-[12px] text-o-text">
                      {simResult.redactedText}
                    </div>
                    <div className="flex flex-col gap-1">
                      {simResult.hits.map((h, idx) => (
                        <div key={idx} className="text-[12px] text-o-text-2">
                          • <strong>{h.ruleName}</strong> ({h.framework}) — matched <code>{h.matchedPreview}</code>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-[12.5px] text-o-ok">No violations detected — safe to dispatch.</div>
                )}
              </div>
            ) : null}
          </Card>
        </TabPanel>
      ) : null}

      {data && tab === 'flags' ? (
        <TabPanel idBase="compliance" id="flags">
          <Card flush>
            <div className="border-b border-o-border p-4 sm:px-6">
              <CardHeader
                title="Flags & redactions"
                sub="Sensitive strings are masked prior to storage. Confirm or dismiss flags for compliance review records."
              />
            </div>
            {data.flags.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<ShieldAlert size={22} />}
                  title="No compliance flags recorded yet"
                  body="Flags appear automatically when AI replies trigger Sentinel policies or when you record a test in the simulator."
                />
              </div>
            ) : (
              <Table<ComplianceFlagRow>
                rows={data.flags}
                rowKey={(f) => f.id}
                caption="Compliance flags and redactions"
                columns={flagColumns}
              />
            )}
          </Card>
        </TabPanel>
      ) : null}

      {data && tab === 'dsr' ? (
        <TabPanel idBase="compliance" id="dsr" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13.5px] text-o-text-2">
              Process GDPR &amp; CCPA export and erasure requests directly across visitor, conversation, and message tables.
            </div>
            {data.canManage ? (
              <Button variant="primary" size="sm" leading={<Plus size={14} />} onClick={() => setDsrModalOpen(true)}>
                Log data request
              </Button>
            ) : null}
          </div>
          <Card flush>
            {data.dataRequests.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No data requests logged"
                  body="Create an Export or Erasure DSR to verify customer matches and generate downloadable archives or anonymize PII."
                />
              </div>
            ) : (
              <Table<ComplianceDataRequestRow>
                rows={data.dataRequests}
                rowKey={(d) => d.id}
                caption="Data subject export and erasure requests"
                columns={dsrColumns}
              />
            )}
          </Card>
        </TabPanel>
      ) : null}

      {data && tab === 'audit' ? (
        <TabPanel idBase="compliance" id="audit">
          <Card>
            <CardHeader
              title="Workspace audit log"
              sub="Read-only record of administrative, team, schedule, and compliance mutations."
            />
            {data.auditLogs.length === 0 ? (
              <EmptyState title="No audit entries yet" body="Administrative actions in this workspace appear here." />
            ) : (
              <div className="mt-4 divide-y divide-o-border">
                {data.auditLogs.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium text-o-text">
                        {a.actorName || 'System'}{' '}
                        <span className="font-normal text-o-text-2">triggered</span>{' '}
                        <code className="rounded bg-o-surface-2 px-1.5 py-0.5 text-[12px]">{a.action}</code>
                        {a.target ? <span className="text-o-text-2"> on {a.target}</span> : null}
                      </div>
                      {Object.keys(a.details || {}).length > 0 ? (
                        <div className="mt-0.5 truncate text-[12px] text-o-text-3">
                          {JSON.stringify(a.details)}
                        </div>
                      ) : null}
                    </div>
                    <span className="text-[12px] text-o-text-3">{timeAgo(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabPanel>
      ) : null}

      {/* Add Custom Policy Modal */}
      <Modal
        open={addPolicyOpen}
        onClose={() => setAddPolicyOpen(false)}
        title="Add compliance rule"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddPolicyOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'create-pol'} onClick={handleCreatePolicy}>
              Save rule
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Rule name">
            <Input
              value={polName}
              onChange={(e) => setPolName(e.target.value)}
              placeholder="e.g. Escalate ombudsman or regulator threats"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Category">
              <Select
                value={polCategory}
                onChange={(e) => setPolCategory(e.target.value as PolicyCategory)}
                options={[
                  { value: 'custom', label: 'Custom' },
                  { value: 'pii', label: 'PII & Secrets' },
                  { value: 'advice', label: 'Regulated Advice' },
                  { value: 'disclosure', label: 'Disclosures' },
                  { value: 'financial', label: 'Financial' },
                ]}
              />
            </Field>
            <Field label="Framework">
              <Input value={polFramework} onChange={(e) => setPolFramework(e.target.value)} />
            </Field>
            <Field label="Enforcement action">
              <Select
                value={polMode}
                onChange={(e) => setPolMode(e.target.value as PolicyActionMode)}
                options={[
                  { value: 'block', label: 'Block' },
                  { value: 'redact', label: 'Redact' },
                  { value: 'escalate', label: 'Escalate' },
                  { value: 'approval', label: 'Approval' },
                  { value: 'flag', label: 'Flag' },
                ]}
              />
            </Field>
          </div>
          <Field label="Trigger keywords (separate with | or comma)">
            <Input
              value={polPattern}
              onChange={(e) => setPolPattern(e.target.value)}
              placeholder="ombudsman|regulator|lawyer"
            />
          </Field>
        </div>
      </Modal>

      {/* Data Retention Modal */}
      <Modal
        open={retModalOpen}
        onClose={() => setRetModalOpen(false)}
        title="Message data retention window"
        description="Minimum 7 days, maximum 3,650 days (10 years). Leave empty for no limit."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRetModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busyKey === 'ret'}
              onClick={async () => {
                setBusyKey('ret');
                try {
                  const val = retDaysInput.trim() === '' ? null : Number(retDaysInput);
                  await updateDataRetention(workspace.id, val);
                  show({ message: 'Retention policy updated', tone: 'ok' });
                  setRetModalOpen(false);
                  await reload();
                } catch (err) {
                  show({ message: err instanceof Error ? err.message : 'Update failed', tone: 'bad' });
                } finally {
                  setBusyKey(null);
                }
              }}
            >
              Save retention
            </Button>
          </>
        }
      >
        <Field label="Retention days">
          <Input
            type="number"
            min={7}
            max={3650}
            value={retDaysInput}
            onChange={(e) => setRetDaysInput(e.target.value)}
          />
        </Field>
      </Modal>

      {/* New DSR Modal */}
      <Modal
        open={dsrModalOpen}
        onClose={() => setDsrModalOpen(false)}
        title="Log data subject request"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDsrModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'create-dsr'} onClick={handleCreateDsr}>
              Log request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Request type">
              <Select
                value={dsrType}
                onChange={(e) => setDsrType(e.target.value as ComplianceDataRequestRow['requestType'])}
                options={[
                  { value: 'export', label: 'Data export (GDPR Art. 15)' },
                  { value: 'erasure', label: 'Right to erasure (Art. 17)' },
                  { value: 'rectification', label: 'Rectification' },
                  { value: 'opt_out', label: 'Do not sell / Opt out (CCPA)' },
                ]}
              />
            </Field>
            <Field label="Regulation">
              <Input value={dsrReg} onChange={(e) => setDsrReg(e.target.value)} />
            </Field>
          </div>
          <Field label="Customer name">
            <Input value={dsrName} onChange={(e) => setDsrName(e.target.value)} placeholder="Maya Lin" />
          </Field>
          <Field label="Customer email">
            <Input
              type="email"
              value={dsrEmail}
              onChange={(e) => setDsrEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </Field>
        </div>
      </Modal>

      {/* Erasure Confirm */}
      <ConfirmDialog
        open={Boolean(confirmDsr)}
        onClose={() => setConfirmDsr(null)}
        onConfirm={() => (confirmDsr ? handleProcessDsr(confirmDsr, 'approve_complete') : Promise.resolve())}
        busy={Boolean(confirmDsr && busyKey === `dsr-${confirmDsr.id}`)}
        variant="danger"
        title={`Anonymize records for ${confirmDsr?.requesterEmail}?`}
        body="This permanently strips customer email, phone, and profile metadata from visitor and conversation records in this workspace."
        confirmLabel="Execute permanent erasure"
      />
    </PageContainer>
  );
}
