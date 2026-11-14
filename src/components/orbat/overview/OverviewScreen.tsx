'use client';

import { Activity, AlertTriangle, ArrowRight, Download, Info, MessageSquare, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Segmented,
  Skeleton,
  SkeletonRows,
  Table,
  type BadgeTone,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import {
  OVERVIEW_RANGES,
  getKnowledgeGaps,
  getOverviewLive,
  getOverviewReport,
  listRecentActivity,
  listRecentConversations,
  type OverviewLive,
  type OverviewRange,
  type OverviewReport,
  type RecentConversation,
} from '@/lib/data/overview';
import { useData } from '@/lib/data/use-data';
import { exportSummaryOverviewCsv, formatDuration } from '@/lib/reports/metrics';
import { STATUS_LABELS } from '@/lib/team/permissions';
import { fmtInt, greeting, pctDelta, ptsDelta, timeAgo, type Delta } from './format';
import { VolumeChart } from './VolumeChart';

/* docs/design/design/Main.dc.html. Each section loads on its own, so one
   slow or failing source never blanks the whole page. */
export function OverviewScreen() {
  const { agent, workspace } = useShellSession();
  const [range, setRange] = useState<OverviewRange>('7d');
  const ws = workspace.id;

  const report = useData(() => getOverviewReport(ws, range), ['report', ws, range]);
  const live = useData(() => getOverviewLive(ws), ['live', ws]);
  const recent = useData(() => listRecentConversations(ws, 6), ['recent', ws]);
  const gaps = useData(() => getKnowledgeGaps(ws), ['gaps', ws]);
  const activity = useData(() => listRecentActivity(ws), ['activity', ws]);

  const firstName = agent.name.split(' ')[0] || agent.name;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const exportCsv = () => {
    if (!report.data) return;
    const csv = exportSummaryOverviewCsv(report.data.summary);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `overview-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer className="gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="o-page-title">
            {greeting(new Date().getHours())}, {firstName}
          </h2>
          <p className="text-[15px] text-o-text-2">
            {today}
            {live.data ? (
              <>
                {' '}
                · {fmtInt(live.data.openCount)} open, {fmtInt(live.data.unassignedCount)} waiting for an owner.
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Date range"
            value={range}
            onChange={setRange}
            items={OVERVIEW_RANGES.map((r) => ({ id: r.id, label: r.label }))}
          />
          <Button
            variant="secondary"
            size="sm"
            leading={<Download size={15} aria-hidden="true" />}
            onClick={exportCsv}
            disabled={!report.data}
          >
            Export
          </Button>
        </div>
      </div>

      <Alerts live={live.data} gaps={gaps.data} />

      <KpiGrid report={report.data} reportError={report.error} live={live.data} onRetry={report.reload} />

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <h3 className="o-card__title">Conversation volume</h3>
          <div className="mt-3">
            {report.error ? (
              <ErrorState body={report.error} onRetry={report.reload} className="py-10" />
            ) : !report.data ? (
              <Skeleton height={260} />
            ) : (
              <VolumeChart points={report.data.series} />
            )}
          </div>
        </Card>
        <ChannelCard report={report.data} error={report.error} onRetry={report.reload} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TeamCard live={live.data} error={live.error} onRetry={live.reload} />
        <AiCard report={report.data} gaps={gaps.data} error={report.error} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <RecentCard rows={recent.data} error={recent.error} onRetry={recent.reload} />
        <Card flush className="flex flex-col">
          <SectionHead title="Recent activity" />
          <div className="px-5 pb-4">
            {activity.error ? (
              <ErrorState body={activity.error} onRetry={activity.reload} className="py-8" />
            ) : !activity.data ? (
              <div className="pt-3">
                <SkeletonRows rows={3} />
              </div>
            ) : activity.data.length === 0 ? (
              <EmptyState
                icon={<Activity size={22} />}
                title="No activity feed yet"
                body="Handoffs, solved tickets and published articles will be listed here."
                className="py-8"
              />
            ) : (
              <ul className="flex flex-col">
                {activity.data.map((e) => (
                  <li key={e.id} className="flex gap-3 py-2.5">
                    <span className={cn('mt-1.5 h-2 w-2 flex-none rounded-full', DOT[e.tone])} aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="text-[14px]">{e.text}</div>
                      <div className="text-[12.5px] text-o-text-3">{timeAgo(e.at)} ago</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

const DOT = { ai: 'bg-o-ai', ok: 'bg-o-ok', bad: 'bg-o-bad', accent: 'bg-o-accent-text', warn: 'bg-o-warn' } as const;

function SectionHead({ title, sub, link }: { title: string; sub?: ReactNode; link?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-o-border px-5 py-4">
      <div className="min-w-0">
        <h3 className="o-card__title">{title}</h3>
        {sub ? <p className="o-card__sub mt-0.5">{sub}</p> : null}
      </div>
      {link ? (
        <Link href={link.href} className="text-[13.5px] font-medium text-o-accent-text hover:underline">
          {link.label} →
        </Link>
      ) : null}
    </div>
  );
}

/* ---------- alerts ---------- */

function Alerts({
  live,
  gaps,
}: {
  live: OverviewLive | undefined;
  gaps: { openCount: number; topQuestion: { text: string; timesAsked: number } | null } | undefined;
}) {
  const items: { key: string; tone: 'bad' | 'ai'; icon: ReactNode; title: string; body: string; href: string; cta: string }[] = [];
  if (live && live.unassignedCount > 0) {
    items.push({
      key: 'unassigned',
      tone: 'bad',
      icon: <AlertTriangle size={15} strokeWidth={2} />,
      title: `${fmtInt(live.unassignedCount)} ${live.unassignedCount === 1 ? 'ticket is' : 'tickets are'} waiting for an owner.`,
      body: 'Assign them before their SLA runs out.',
      href: '/app/tickets',
      cta: 'Review tickets',
    });
  }
  if (gaps && gaps.openCount > 0) {
    items.push({
      key: 'gaps',
      tone: 'ai',
      icon: <Sparkles size={15} strokeWidth={2} />,
      title: 'Knowledge gap detected:',
      body: gaps.topQuestion
        ? `${fmtInt(gaps.openCount)} questions the AI couldn’t answer. Most asked: “${gaps.topQuestion.text}”.`
        : `${fmtInt(gaps.openCount)} questions the AI couldn’t answer.`,
      href: '/app/knowledge',
      cta: 'Review questions',
    });
  }
  if (items.length === 0) return null;
  return (
    <section aria-label="Alerts" className="overflow-hidden rounded-[20px] border border-o-border bg-o-surface">
      {items.map((a, i) => (
        <div
          key={a.key}
          className={cn('flex flex-wrap items-center gap-3 px-4 py-3', i > 0 && 'border-t border-o-border')}
        >
          <span
            className={cn(
              'grid h-7 w-7 place-items-center rounded-[9px]',
              a.tone === 'bad' ? 'bg-o-bad-soft text-o-bad' : 'bg-o-ai-soft text-o-ai-text',
            )}
            aria-hidden="true"
          >
            {a.icon}
          </span>
          <div className="min-w-0 flex-[1_1_320px] text-[14.5px]">
            <span className="font-semibold">{a.title}</span> <span className="text-o-text-2">{a.body}</span>
          </div>
          <Link href={a.href} className="text-[13.5px] font-medium text-o-accent-text hover:underline">
            {a.cta} →
          </Link>
        </div>
      ))}
    </section>
  );
}

/* ---------- KPIs ---------- */

interface Kpi {
  label: string;
  value: string | null;
  delta?: Delta | null;
  foot?: string;
  ai?: boolean;
  tone?: 'warn' | 'bad';
}

function KpiGrid({
  report,
  reportError,
  live,
  onRetry,
}: {
  report: OverviewReport | undefined;
  reportError: string | null;
  live: OverviewLive | undefined;
  onRetry: () => void;
}) {
  const s = report?.summary;
  const p = report?.previous ?? null;
  const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);

  const online = live?.team.filter((m) => m.status === 'online') ?? [];
  const capped = online.filter((m) => m.capacity && m.capacity > 0);
  const capacity = capped.reduce((a, m) => a + (m.capacity ?? 0), 0);
  const load = capped.reduce((a, m) => a + m.openTickets, 0);
  const atCapacity = capped.filter((m) => m.openTickets >= (m.capacity ?? Infinity)).length;

  const kpis: Kpi[] = [
    {
      label: 'Total conversations',
      value: s ? fmtInt(s.totalCreated) : null,
      delta: s && p ? pctDelta(s.totalCreated, p.totalCreated) : null,
      foot: 'vs previous period',
    },
    { label: 'Open now', value: live ? fmtInt(live.openCount) : null, foot: 'new and open' },
    {
      label: 'Unassigned',
      value: live ? fmtInt(live.unassignedCount) : null,
      foot: 'waiting for an owner',
      tone: live && live.unassignedCount > 0 ? 'bad' : undefined,
    },
    {
      label: 'AI resolved',
      value: s ? fmtInt(s.botResolvedCount) : null,
      delta: s && p ? pctDelta(s.botResolvedCount, p.botResolvedCount) : null,
      foot: 'vs previous period',
      ai: true,
    },
    {
      label: 'Solved',
      value: s ? fmtInt(s.totalSolved) : null,
      delta: s && p ? pctDelta(s.totalSolved, p.totalSolved) : null,
      foot: 'vs previous period',
    },
    {
      label: 'AI resolution rate',
      value: s ? pct(s.botResolutionRatePercent) : null,
      delta: s && p ? ptsDelta(s.botResolutionRatePercent, p.botResolutionRatePercent) : null,
      foot: s ? `${fmtInt(s.botHandoverCount)} handed to the team` : undefined,
      ai: true,
    },
    {
      label: 'Avg. first response',
      value: s ? formatDuration(s.avgFrtSeconds) : null,
      delta: s && p ? pctDelta(s.avgFrtSeconds, p.avgFrtSeconds, { lowerIsBetter: true }) : null,
      foot: 'vs previous period',
    },
    {
      label: 'Avg. resolution time',
      value: s ? formatDuration(s.avgResolutionSeconds) : null,
      delta: s && p ? pctDelta(s.avgResolutionSeconds, p.avgResolutionSeconds, { lowerIsBetter: true }) : null,
      foot: 'vs previous period',
    },
    {
      label: 'Customer satisfaction',
      value: s ? pct(s.csatPercent) : null,
      delta: s && p ? ptsDelta(s.csatPercent, p.csatPercent) : null,
      foot: s ? `${fmtInt(s.totalCsatRatings)} ratings` : undefined,
    },
    {
      label: 'Team workload',
      value: live ? (capacity > 0 ? `${Math.round((load / capacity) * 100)}%` : fmtInt(online.length)) : null,
      foot: live
        ? capacity > 0
          ? atCapacity > 0
            ? `${atCapacity} at capacity`
            : 'of capacity, online agents'
          : online.length === 1
            ? 'agent online'
            : 'agents online'
        : undefined,
      tone: atCapacity > 0 ? 'warn' : undefined,
    },
  ];

  return (
    <section aria-label="Key metrics" className="flex flex-col gap-3">
      {reportError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[16px] bg-o-bad-soft px-4 py-2.5 text-[14px] text-o-bad" role="alert">
          <span className="flex-1">Period numbers couldn’t load: {reportError}</span>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="o-card flex flex-col gap-2.5 p-4">
            <div className="flex items-center gap-1.5 text-[13.5px] text-o-text-2">
              {k.ai ? <span className="h-1.5 w-1.5 rounded-full bg-o-ai" aria-label="AI metric" /> : null}
              {k.label}
            </div>
            <div className="o-num text-[26px] font-semibold tracking-[-0.02em]">
              {k.value ?? <Skeleton width={72} height={26} />}
            </div>
            <div className="flex min-h-[18px] flex-wrap items-center gap-1.5 text-[12.5px]">
              {k.delta ? (
                <span
                  className={cn(
                    'font-semibold',
                    k.delta.tone === 'ok' ? 'text-o-ok' : k.delta.tone === 'bad' ? 'text-o-bad' : 'text-o-text-2',
                  )}
                >
                  {k.delta.text}
                </span>
              ) : null}
              {k.foot ? (
                <span className={cn(k.tone === 'bad' ? 'text-o-bad' : k.tone === 'warn' ? 'text-o-warn' : 'text-o-text-3')}>
                  {k.foot}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- channels ---------- */

function ChannelCard({
  report,
  error,
  onRetry,
}: {
  report: OverviewReport | undefined;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="o-card__title">By channel</h3>
        <p className="o-card__sub mt-0.5">Share of conversations in this period</p>
      </div>
      {error ? (
        <ErrorState body={error} onRetry={onRetry} className="py-8" />
      ) : !report ? (
        <SkeletonRows rows={4} />
      ) : report.channels.length === 0 ? (
        <EmptyState icon={<MessageSquare size={22} />} title="No conversations yet" className="py-8" />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {report.channels.slice(0, 6).map((c) => (
            <li key={c.key} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[14px]">
                <span className="font-medium">{c.label}</span>
                <span className="o-num text-o-text-2">
                  {Math.round(c.percentage)}% · {fmtInt(c.count)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-o-surface-2" aria-hidden="true">
                <div className="h-2 rounded-full bg-o-accent-text" style={{ width: `${Math.min(100, c.percentage)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------- team ---------- */

function TeamCard({ live, error, onRetry }: { live: OverviewLive | undefined; error: string | null; onRetry: () => void }) {
  const online = live?.team.filter((m) => m.status === 'online').length ?? 0;
  return (
    <Card flush className="flex flex-col">
      <SectionHead
        title="Team availability"
        sub={live ? `${online} of ${live.team.length} online` : undefined}
        link={{ href: '/app/team', label: 'Team' }}
      />
      {error ? (
        <ErrorState body={error} onRetry={onRetry} className="py-8" />
      ) : !live ? (
        <div className="p-5">
          <SkeletonRows rows={4} />
        </div>
      ) : live.team.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="No teammates yet"
          body="Invite your team to share the inbox."
          className="py-8"
        />
      ) : (
        <ul className="flex flex-col py-1">
          {live.team.slice(0, 6).map((m) => {
            const pct = m.capacity ? Math.min(100, Math.round((m.openTickets / m.capacity) * 100)) : null;
            const full = m.capacity ? m.openTickets >= m.capacity : false;
            return (
              <li key={m.id} className="o-row-hover flex items-center gap-3 px-5 py-2.5">
                <Avatar name={m.name} src={m.avatarUrl} size={34} presence={m.status} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-medium">{m.name}</div>
                  <div className="text-[12.5px] text-o-text-3">
                    {STATUS_LABELS[m.status]}
                    {full ? ' · at capacity' : ''}
                  </div>
                </div>
                <div className="flex w-[130px] flex-col gap-1">
                  <div className="o-num text-right text-[12.5px] text-o-text-2">
                    {fmtInt(m.openTickets)}
                    {m.capacity ? `/${m.capacity}` : ''} open
                  </div>
                  {pct !== null ? (
                    <div className="h-1.5 rounded-full bg-o-surface-2" aria-hidden="true">
                      <div
                        className={cn('h-1.5 rounded-full', full ? 'bg-o-warn' : 'bg-o-accent-text')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------- AI ---------- */

function AiCard({
  report,
  gaps,
  error,
}: {
  report: OverviewReport | undefined;
  gaps: { openCount: number; topQuestion: { text: string; timesAsked: number } | null } | undefined;
  error: string | null;
}) {
  const s = report?.summary;
  return (
    <Card flush className="flex flex-col">
      <SectionHead title="AI assistant" sub="Answers from your help center" link={{ href: '/app/agents', label: 'Manage AI' }} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        {error ? (
          <p className="text-[14px] text-o-text-3">AI numbers are unavailable until the report loads.</p>
        ) : !s ? (
          <SkeletonRows rows={2} />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <span
              className="grid h-10 w-10 flex-none place-items-center rounded-[30%] bg-o-ai-soft text-o-ai-text"
              aria-hidden="true"
            >
              <Sparkles size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-[1_1_160px]">
              <div className="flex items-center gap-2">
                <span className="font-semibold">AI assistant</span>
                <Badge tone={s.totalBotInquiries > 0 ? 'ok' : 'neutral'}>
                  {s.totalBotInquiries > 0 ? 'Active' : 'No replies yet'}
                </Badge>
              </div>
              <div className="text-[13px] text-o-text-3">Website chat and connected channels</div>
            </div>
            <dl className="flex gap-6">
              <Stat label="handled" value={fmtInt(s.totalBotInquiries)} />
              <Stat label="resolved" value={s.botResolutionRatePercent == null ? '—' : `${s.botResolutionRatePercent}%`} />
              <Stat label="handed off" value={fmtInt(s.botHandoverCount)} />
            </dl>
          </div>
        )}
        {gaps?.topQuestion ? (
          <div className="mt-auto flex gap-2.5 rounded-[14px] bg-o-surface-2 px-3.5 py-3 text-[13.5px] text-o-text-2">
            <Info size={16} className="mt-0.5 flex-none text-o-ai" aria-hidden="true" />
            <span>
              Customers asked <b className="text-o-text">“{gaps.topQuestion.text}”</b>{' '}
              {gaps.topQuestion.timesAsked > 1 ? `${fmtInt(gaps.topQuestion.timesAsked)} times` : ''} and the AI had no
              answer. One article would likely cover it.{' '}
              <Link href="/app/knowledge" className="inline-flex items-center gap-0.5 font-medium text-o-accent-text">
                Add it <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[12px] text-o-text-3">{label}</dt>
      <dd className="o-num m-0 font-semibold">{value}</dd>
    </div>
  );
}

/* ---------- recent conversations ---------- */

const STATUS_BADGE: Record<RecentConversation['status'], { label: string; tone: BadgeTone }> = {
  open: { label: 'Open', tone: 'accent' },
  pending: { label: 'Waiting', tone: 'neutral' },
  snoozed: { label: 'Snoozed', tone: 'warn' },
  closed: { label: 'Resolved', tone: 'ok' },
};

function RecentCard({
  rows,
  error,
  onRetry,
}: {
  rows: RecentConversation[] | undefined;
  error: string | null;
  onRetry: () => void;
}) {
  const router = useRouter();
  const columns: Column<RecentConversation>[] = [
    {
      key: 'customer',
      header: 'Customer',
      cell: (r) => <span className="font-medium">{r.customer}</span>,
    },
    {
      key: 'preview',
      header: 'Last message',
      cell: (r) => <span className="line-clamp-1 max-w-[280px] text-o-text-2">{r.preview || '—'}</span>,
      hideBelow: 'md',
    },
    { key: 'channel', header: 'Channel', cell: (r) => <span className="text-o-text-2">{r.channel}</span>, hideBelow: 'lg' },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge tone={STATUS_BADGE[r.status].tone}>{STATUS_BADGE[r.status].label}</Badge>,
    },
    {
      key: 'by',
      header: 'Handled by',
      cell: (r) => <span className={r.handledByAi ? 'text-o-ai-text' : 'text-o-text-2'}>{r.handledBy}</span>,
      hideBelow: 'sm',
    },
    { key: 'time', header: 'Updated', cell: (r) => <span className="text-o-text-3">{timeAgo(r.updatedAt)}</span>, align: 'right' },
  ];

  return (
    <Card flush className="flex flex-col">
      <SectionHead title="Recent conversations" link={{ href: '/app/inbox', label: 'Open inbox' }} />
      {error ? (
        <ErrorState body={error} onRetry={onRetry} className="py-8" />
      ) : !rows ? (
        <div className="p-5">
          <SkeletonRows rows={4} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={22} />}
          title="No conversations yet"
          body="Install the chat widget on your site and new conversations will appear here."
          className="py-8"
        />
      ) : (
        <Table
          caption="Recent conversations"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/app/inbox?c=${encodeURIComponent(r.id)}`)}
        />
      )}
    </Card>
  );
}
