'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  FileWarning,
  LayoutGrid,
  Plus,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
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
  Input,
  Select,
  SkeletonRows,
  Table,
  Tabs,
  Toggle,
  useOrbToast,
  type BadgeTone,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, fmtPct, timeAgo } from '@/components/orbat/overview/format';
import {
  deleteAiAgent,
  getAiAgentsBootstrap,
  submitAgentReviewVerdict,
  toggleAiAgentStatus,
  useAiAgentsLiveSync,
  type ActivityLogItem,
  type AiAgentListItem,
  type VerificationReviewItem,
} from '@/lib/data/agents';
import { useData } from '@/lib/data/use-data';

type AgentsTab = 'overview' | 'evaluation' | 'logs';

function statusTone(status: AiAgentListItem['status']): BadgeTone {
  if (status === 'live') return 'ok';
  if (status === 'paused') return 'warn';
  return 'neutral';
}

function verdictBadge(verdict: VerificationReviewItem['verdict']): {
  label: string;
  tone: BadgeTone;
} {
  switch (verdict) {
    case 'supported':
      return { label: 'Supported', tone: 'ok' };
    case 'blocked_fixed':
      return { label: 'Fixed before send', tone: 'warn' };
    case 'blocked_human':
      return { label: 'Escalated to human', tone: 'bad' };
    default:
      return { label: 'Needs review', tone: 'ai' };
  }
}

export function AiAgentsScreen() {
  const { workspace } = useShellSession();
  const toast = useOrbToast();
  const workspaceId = workspace.id;

  const [tab, setTab] = useState<AgentsTab>('overview');
  const [verdictFilter, setVerdictFilter] = useState<'all' | VerificationReviewItem['verdict']>('all');
  const [logSearch, setLogSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiAgentListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const state = useData(
    () => getAiAgentsBootstrap(workspaceId),
    ['ai-agents-bootstrap', workspaceId],
  );
  useAiAgentsLiveSync(workspaceId, state.reload);

  const data = state.data;
  const canManage = Boolean(data?.canManage);
  const canEditContent = Boolean(data?.canEditContent);

  const filteredReviews = useMemo(() => {
    const rows = data?.reviewQueue ?? [];
    if (verdictFilter === 'all') return rows;
    return rows.filter((r) => r.verdict === verdictFilter);
  }, [data?.reviewQueue, verdictFilter]);

  const filteredLogs = useMemo(() => {
    const rows = data?.activityLogs ?? [];
    const q = logSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.event.toLowerCase().includes(q) ||
        (r.reason ?? '').toLowerCase().includes(q) ||
        r.agentName.toLowerCase().includes(q) ||
        r.channel.toLowerCase().includes(q),
    );
  }, [data?.activityLogs, logSearch]);

  const handleToggleStatus = async (agent: AiAgentListItem, nextLive: boolean) => {
    setTogglingId(agent.id);
    try {
      const nextStatus = nextLive ? 'live' : 'paused';
      const res = await toggleAiAgentStatus(workspaceId, agent.id, nextStatus);
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return;
      }
      toast.show({
        tone: 'ok',
        message: `${agent.name} is now ${nextStatus === 'live' ? 'live' : 'paused'}.`,
      });
      state.reload();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteAiAgent(workspaceId, deleteTarget.id);
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return;
      }
      toast.show({ tone: 'ok', message: `Deleted "${deleteTarget.name}".` });
      setDeleteTarget(null);
      state.reload();
    } finally {
      setDeleting(false);
    }
  };

  const handleVerdict = async (logId: string, verdict: 'correct' | 'wrong') => {
    setReviewingId(logId);
    try {
      const res = await submitAgentReviewVerdict(workspaceId, logId, verdict);
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return;
      }
      toast.show({
        tone: 'ok',
        message: verdict === 'correct' ? 'Marked reply as accurate' : 'Flagged reply as incorrect',
      });
      state.reload();
    } finally {
      setReviewingId(null);
    }
  };

  const logColumns: Column<ActivityLogItem>[] = [
    {
      key: 'time',
      header: 'When',
      cell: (r) => <span className="text-[12.5px] text-o-text-3">{timeAgo(r.createdAt)}</span>,
    },
    {
      key: 'agent',
      header: 'Agent',
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-o-text">
          <Sparkles size={13} className="text-o-ai-text" aria-hidden="true" />
          {r.agentName}
        </span>
      ),
    },
    {
      key: 'event',
      header: 'Event',
      cell: (r) => {
        const tone =
          r.event === 'reply_delivered' || r.event === 'replied'
            ? 'ok'
            : r.event === 'handover' || r.event === 'handoff_requested' || r.event === 'blocked_human'
              ? 'warn'
              : 'neutral';
        return <Badge tone={tone}>{r.event.replace(/_/g, ' ')}</Badge>;
      },
    },
    {
      key: 'channel',
      header: 'Channel',
      hideBelow: 'sm',
      cell: (r) => <Badge tone="neutral">{r.channel}</Badge>,
    },
    {
      key: 'reason',
      header: 'Detail',
      cell: (r) => (
        <span className="line-clamp-1 max-w-[320px] text-[13px] text-o-text-2">
          {r.reason || '—'}
        </span>
      ),
    },
    {
      key: 'conv',
      header: '',
      align: 'right',
      cell: (r) =>
        r.conversationId ? (
          <ButtonLink
            href={`/app/inbox?id=${encodeURIComponent(r.conversationId)}`}
            variant="ghost"
            size="sm"
            trailing={<ArrowUpRight size={13} aria-hidden="true" />}
          >
            Thread
          </ButtonLink>
        ) : null,
    },
  ];

  const kpis = data?.kpis;
  const evalKpis = data?.evalKpis;
  const agents = data?.agents ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="AI Agents"
        description={
          kpis
            ? `${fmtInt(kpis.activeAgentsCount)} live · ${fmtInt(kpis.allReplies30d)} replies handled in the last 30 days`
            : 'Manage your AI support agents, quality reviews, and runtime logs'
        }
        actions={
          <>
            <ButtonLink
              href="/app/agents/templates"
              variant="secondary"
              size="md"
              leading={<LayoutGrid size={14} aria-hidden="true" />}
            >
              Browse templates
            </ButtonLink>
            {canManage ? (
              <ButtonLink
                href="/app/agents/new"
                variant="ai"
                size="md"
                leading={<Plus size={14} aria-hidden="true" />}
              >
                New AI agent
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <Tabs<AgentsTab>
        idBase="ai-agents-tabs"
        label="AI Agents sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Overview', count: agents.length },
          {
            id: 'evaluation',
            label: 'Evaluation',
            count: (evalKpis?.needsReviewCount ?? 0) > 0 ? evalKpis?.needsReviewCount : undefined,
          },
          { id: 'logs', label: 'Activity logs', count: data?.activityLogs.length },
        ]}
      />

      {state.loading && !data ? (
        <div className="mt-4 space-y-4">
          <Card>
            <SkeletonRows rows={4} />
          </Card>
          <Card>
            <SkeletonRows rows={4} />
          </Card>
        </div>
      ) : state.error ? (
        <div className="mt-4">
          <ErrorState title="Could not load AI Agents" body={state.error} onRetry={state.reload} />
        </div>
      ) : null}

      {data && tab === 'overview' ? (
        <div className="mt-4 space-y-4">
          {/* 5 KPI Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Replies (30d)</div>
              <div className="o-num mt-1 text-[22px] font-semibold tracking-tight text-o-text">
                {fmtInt(kpis?.allReplies30d ?? 0)}
              </div>
              <div className="mt-1 text-[11.5px] text-o-text-3">All active agents</div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">AI resolution rate</div>
              <div className="o-num mt-1 text-[22px] font-semibold tracking-tight text-o-text">
                {kpis?.resolvedPct !== null && kpis?.resolvedPct !== undefined
                  ? fmtPct(kpis.resolvedPct)
                  : '—'}
              </div>
              <div className="mt-1 text-[11.5px] text-o-text-3">Resolved without escalation</div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Median reply</div>
              <div className="o-num mt-1 text-[22px] font-semibold tracking-tight text-o-text">
                {kpis?.medianReplySeconds !== null && kpis?.medianReplySeconds !== undefined
                  ? `${kpis.medianReplySeconds}s`
                  : '—'}
              </div>
              <div className="mt-1 text-[11.5px] text-o-text-3">First response latency</div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Escalation rate</div>
              <div className="o-num mt-1 text-[22px] font-semibold tracking-tight text-o-text">
                {kpis?.escalationRatePct !== null && kpis?.escalationRatePct !== undefined
                  ? fmtPct(kpis.escalationRatePct)
                  : '—'}
              </div>
              <div className="mt-1 text-[11.5px] text-o-text-3">Handed to human team</div>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <div className="text-[12px] font-medium text-o-text-3">Reviewed accuracy</div>
              <div className="o-num mt-1 text-[22px] font-semibold tracking-tight text-o-ai-text">
                {kpis?.reviewedAccuracyPct !== null && kpis?.reviewedAccuracyPct !== undefined
                  ? fmtPct(kpis.reviewedAccuracyPct)
                  : '—'}
              </div>
              <div className="mt-1 text-[11.5px] text-o-text-3">Human QA check score</div>
            </Card>
          </div>

          {/* Agent Roster */}
          <Card>
            <CardHeader
              title="Configured agents"
              sub="Live instructions, channel coverage, and 30-day performance per agent"
              actions={
                <ButtonLink href="/app/ai-quality" variant="ghost" size="sm" leading={<ShieldCheck size={14} />}>
                  AI quality & trust
                </ButtonLink>
              }
            />
            {agents.length === 0 ? (
              <EmptyState
                icon={<Bot size={20} />}
                title="No AI agents configured yet"
                body="Start from an industry template or build a custom support agent from scratch."
                action={
                  canManage ? (
                    <ButtonLink href="/app/agents/templates" variant="ai" size="md">
                      Browse templates
                    </ButtonLink>
                  ) : null
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex flex-col justify-between rounded-[14px] border border-o-border bg-o-surface-2/60 p-4 transition-colors hover:border-o-border-strong"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-o-ai-soft text-o-ai-text"
                            aria-hidden="true"
                          >
                            <Sparkles size={17} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate font-semibold text-o-text">{agent.name}</span>
                              {agent.is_primary ? <Badge tone="ai">Primary</Badge> : null}
                              <Badge tone={statusTone(agent.status)} dot>
                                {agent.status === 'live'
                                  ? 'Live'
                                  : agent.status === 'paused'
                                    ? 'Paused'
                                    : 'Draft'}
                              </Badge>
                            </div>
                            <div className="truncate text-[12.5px] text-o-text-3">{agent.role_title}</div>
                          </div>
                        </div>

                        {canManage ? (
                          <Toggle
                            hideLabel
                            label={`Toggle ${agent.name}`}
                            checked={agent.status === 'live'}
                            disabled={togglingId === agent.id}
                            onChange={(checked) => handleToggleStatus(agent, checked)}
                          />
                        ) : null}
                      </div>

                      <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-o-text-2">
                        {agent.description || 'Answers workspace questions using verified Help Center articles.'}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {agent.channels.map((ch) => (
                          <Badge key={ch} tone="neutral">
                            {ch}
                          </Badge>
                        ))}
                        {agent.industry ? <Badge tone="accent">{agent.industry}</Badge> : null}
                        {agent.published_version > 0 ? (
                          <Badge tone="neutral">v{agent.published_version}</Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-o-border pt-3">
                      <div className="flex items-center gap-4 text-[12.5px]">
                        <div>
                          <span className="o-num font-semibold text-o-text">
                            {fmtInt(agent.replies30d)}
                          </span>{' '}
                          <span className="text-o-text-3">replies</span>
                        </div>
                        <div>
                          <span className="o-num font-semibold text-o-text">
                            {agent.resolutionRate30d !== null ? fmtPct(agent.resolutionRate30d) : '—'}
                          </span>{' '}
                          <span className="text-o-text-3">resolved</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canManage && !agent.is_primary ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${agent.name}`}
                            onClick={() => setDeleteTarget(agent)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        ) : null}
                        <ButtonLink href={`/app/agents/${agent.id}`} variant="secondary" size="sm">
                          {canManage ? 'Open builder' : 'Inspect'}
                        </ButtonLink>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 2-Column Insights */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader
                title="Resolved vs escalated trend"
                sub="Weekly breakdown over the last 6 weeks"
              />
              {data.weeklyTrend.length === 0 ? (
                <EmptyState
                  title="No weekly conversation trend yet"
                  body="Once your AI agent handles customer conversations, weekly resolution vs escalation bars appear here."
                />
              ) : (
                <div className="space-y-3">
                  {data.weeklyTrend.map((w) => (
                    <div key={w.weekStart} className="space-y-1">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="font-medium text-o-text-2">Week of {w.weekLabel}</span>
                        <span className="o-num text-o-text-3">
                          {fmtInt(w.resolvedCount)} resolved · {fmtInt(w.escalatedCount)} escalated ({w.resolvedPct}%)
                        </span>
                      </div>
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-o-surface-3">
                        <div
                          className="h-full bg-o-ai transition-all"
                          style={{ width: `${w.resolvedPct}%` }}
                          title={`Resolved: ${w.resolvedCount}`}
                        />
                        <div
                          className="h-full bg-o-warn transition-all"
                          style={{ width: `${w.escalatedPct}%` }}
                          title={`Escalated: ${w.escalatedCount}`}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-4 pt-2 text-[11.5px] text-o-text-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-o-ai" /> AI resolved
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-o-warn" /> Escalated to team
                    </span>
                  </div>
                </div>
              )}
            </Card>

            <div className="space-y-4 lg:col-span-5">
              <Card>
                <CardHeader title="Escalation reasons (30d)" sub="Why conversations left AI autopilot" />
                {data.escalationBreakdown.length === 0 ? (
                  <EmptyState
                    title="No escalations recorded"
                    body="Escalation triggers such as explicit human requests or policy blocks appear here."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {data.escalationBreakdown.map((item) => (
                      <div key={item.reason} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="truncate font-medium text-o-text">{item.reason}</span>
                          <span className="o-num shrink-0 text-o-text-3">
                            {fmtInt(item.count)} ({item.pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-o-surface-3">
                          <div className="h-full bg-o-warn" style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Top unanswered questions"
                  sub={`${fmtInt(kpis?.openUnansweredCount ?? 0)} open gap(s) waiting in Knowledge Base`}
                  actions={
                    <ButtonLink href="/app/knowledge" variant="ghost" size="sm">
                      Open KB
                    </ButtonLink>
                  }
                />
                {data.unansweredTop.length === 0 ? (
                  <EmptyState
                    icon={<Check size={18} />}
                    title="No open knowledge gaps"
                    body="Questions the AI couldn't answer cleanly are queued here automatically."
                  />
                ) : (
                  <ul className="divide-y divide-o-border">
                    {data.unansweredTop.map((q) => (
                      <li key={q.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <div className="line-clamp-1 text-[13px] font-medium text-o-text">{q.question}</div>
                          <div className="text-[11.5px] text-o-text-3">Asked {fmtInt(q.timesAsked)}x</div>
                        </div>
                        <ButtonLink href="/app/knowledge" variant="secondary" size="sm">
                          Answer
                        </ButtonLink>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {data && tab === 'evaluation' ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Checked (30d)</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-text">
                {fmtInt(evalKpis?.totalChecked30d ?? 0)}
              </div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Grounded on first try</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-ok">
                {evalKpis?.supportedPct !== null && evalKpis?.supportedPct !== undefined
                  ? fmtPct(evalKpis.supportedPct)
                  : '—'}
              </div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Blocked & fixed / escalated</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-warn">
                {fmtInt((evalKpis?.blockedFixedCount ?? 0) + (evalKpis?.blockedHumanCount ?? 0))}
              </div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Needs human audit</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-ai-text">
                {fmtInt(evalKpis?.needsReviewCount ?? 0)}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Reply evaluation queue"
              sub="Audit real AI answers against workspace knowledge claims"
              actions={
                <Select
                  aria-label="Filter evaluation verdicts"
                  value={verdictFilter}
                  onChange={(e) => setVerdictFilter(e.target.value as typeof verdictFilter)}
                  options={[
                    { value: 'all', label: 'All verdicts' },
                    { value: 'needs_review', label: 'Needs review' },
                    { value: 'supported', label: 'Supported' },
                    { value: 'blocked_fixed', label: 'Blocked & fixed' },
                    { value: 'blocked_human', label: 'Escalated to human' },
                  ]}
                  className="w-[180px]"
                />
              }
            />

            {filteredReviews.length === 0 ? (
              <EmptyState
                icon={<FileWarning size={20} />}
                title="No verification checks recorded yet"
                body="Send a message in Agent Builder Playground or handle a live conversation to inspect verified AI replies here."
              />
            ) : (
              <div className="divide-y divide-o-border">
                {filteredReviews.map((item) => {
                  const vb = verdictBadge(item.verdict);
                  return (
                    <div key={item.id} className="py-4 first:pt-1 last:pb-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={vb.tone}>{vb.label}</Badge>
                          <span className="text-[13px] font-semibold text-o-text">{item.agentName}</span>
                          <Badge tone="neutral">{item.channel}</Badge>
                          <span className="text-[12px] text-o-text-3">{timeAgo(item.createdAt)}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {item.humanReview ? (
                            <Badge tone={item.humanReview === 'correct' ? 'ok' : 'bad'}>
                              Reviewed: {item.humanReview}
                            </Badge>
                          ) : null}
                          {canEditContent ? (
                            <>
                              <Button
                                variant={item.humanReview === 'correct' ? 'primary' : 'secondary'}
                                size="sm"
                                disabled={reviewingId === item.id}
                                leading={<ThumbsUp size={13} />}
                                onClick={() => handleVerdict(item.id, 'correct')}
                              >
                                Correct
                              </Button>
                              <Button
                                variant={item.humanReview === 'wrong' ? 'danger' : 'secondary'}
                                size="sm"
                                disabled={reviewingId === item.id}
                                leading={<ThumbsDown size={13} />}
                                onClick={() => handleVerdict(item.id, 'wrong')}
                              >
                                Wrong
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2.5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div className="rounded-[10px] border border-o-border bg-o-surface-2 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
                            Customer asked
                          </div>
                          <div className="mt-1 text-[13px] text-o-text">{item.customerQuestion}</div>
                        </div>
                        <div className="rounded-[10px] border border-o-border bg-o-surface-2 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
                            AI reply {item.confidence !== null ? `· ${Math.round(item.confidence * 100)}% conf.` : ''}
                          </div>
                          <div className="mt-1 text-[13px] text-o-text">
                            {item.finalReply || item.draftReply}
                          </div>
                        </div>
                      </div>

                      {item.claims.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.claims.map((c, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] ${
                                c.supported
                                  ? 'bg-o-ok-soft text-o-ok'
                                  : 'bg-o-bad-soft text-o-bad'
                              }`}
                            >
                              {c.supported ? <Check size={11} /> : <AlertTriangle size={11} />}
                              <span className="max-w-[240px] truncate">{c.source}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {data && tab === 'logs' ? (
        <Card className="mt-4">
          <CardHeader
            title="AI runtime activity logs"
            sub="Every decision across web widget, omnichannel inbox, and escalation guardrails"
            actions={
              <Input
                aria-label="Filter logs"
                placeholder="Search event, agent, channel…"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full sm:w-[240px]"
              />
            }
          />
          {filteredLogs.length === 0 ? (
            <EmptyState
              title="No matching activity logs"
              body="Live auto-respond events and handoff transitions appear here as traffic arrives."
            />
          ) : (
            <Table<ActivityLogItem>
              caption="AI activity logs"
              rows={filteredLogs}
              rowKey={(r) => r.id}
              columns={logColumns}
            />
          )}
        </Card>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.name || 'agent'}?`}
        body="This permanently removes the agent configuration and its saved version history. Past conversation messages stay untouched."
        confirmLabel="Delete agent"
        variant="danger"
        busy={deleting}
      />
    </PageContainer>
  );
}
