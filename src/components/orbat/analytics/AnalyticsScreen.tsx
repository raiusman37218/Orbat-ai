'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Briefcase,
  Download,
  MessageSquare,
  PhoneCall,
  Plus,
  Smile,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Segmented,
  Skeleton,
  Table,
  Textarea,
  Toggle,
  useOrbToast,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, niceCeil } from '@/components/orbat/overview/format';
import { cn } from '@/lib/utils';
import {
  deleteCustomReport,
  exportAnalyticsCsv,
  getAnalyticsStudio,
  saveCustomReport,
  useAnalyticsLiveSync,
  type AnalyticsBreakdownRow,
  type AnalyticsRangeDays,
  type AnalyticsSection,
  type AnalyticsSeriesPoint,
  type AnalyticsStudioBundle,
} from '@/lib/data/analytics';
import { useData } from '@/lib/data/use-data';

const SECTIONS: { id: AnalyticsSection; label: string; icon: typeof MessageSquare }[] = [
  { id: 'conv', label: 'Conversations', icon: MessageSquare },
  { id: 'ai', label: 'AI Assistant', icon: Bot },
  { id: 'agents', label: 'Team & Agents', icon: Users },
  { id: 'calls', label: 'Voice Calls', icon: PhoneCall },
  { id: 'csat', label: 'CSAT & NPS', icon: Smile },
  { id: 'biz', label: 'Business Impact', icon: Briefcase },
];

const WEEKDAYS = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
  { dow: 0, label: 'Sun' },
];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8..19

export function AnalyticsScreen() {
  const { workspace } = useShellSession();
  const toast = useOrbToast();

  const [section, setSection] = useState<AnalyticsSection>('conv');
  const [rangeDays, setRangeDays] = useState<AnalyticsRangeDays>(30);
  const [comparePrevious, setComparePrevious] = useState(true);
  const [chartView, setChartView] = useState<'trend' | 'heatmap'>('trend');
  const [selectedDay, setSelectedDay] = useState<AnalyticsSeriesPoint | null>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [savingReport, setSavingReport] = useState(false);

  const bundle = useData<AnalyticsStudioBundle>(
    () => getAnalyticsStudio(workspace.id, section, rangeDays, comparePrevious),
    ['analytics-studio', workspace.id, section, rangeDays, comparePrevious],
  );
  useAnalyticsLiveSync(workspace.id, bundle.reload);

  const data = bundle.data;

  async function handleSaveCustomReport() {
    if (!reportName.trim()) {
      toast.show({ message: 'Report name is required.', tone: 'bad' });
      return;
    }
    setSavingReport(true);
    try {
      await saveCustomReport(workspace.id, {
        name: reportName,
        description: reportDesc,
        section,
        rangeDays,
        comparePrevious,
      });
      setSaveOpen(false);
      setReportName('');
      setReportDesc('');
      toast.show({ message: 'Saved custom report to sidebar.', tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setSavingReport(false);
    }
  }

  async function handleDeleteReport(id: string) {
    try {
      await deleteCustomReport(workspace.id, id);
      toast.show({ message: 'Removed saved report.', tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    }
  }

  const maxSeriesVal = useMemo(() => {
    const pts = data?.series ?? [];
    const peak = Math.max(
      1,
      ...pts.map((p) => Math.max(p.value, comparePrevious ? p.previousValue : 0)),
    );
    return niceCeil(peak);
  }, [data?.series, comparePrevious]);

  const heatmapMax = useMemo(
    () => Math.max(1, ...(data?.heatmap.map((c) => c.count) ?? [0])),
    [data?.heatmap],
  );

  const heatmapLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data?.heatmap ?? []) {
      map.set(`${c.dow}-${c.hour}`, c.count);
    }
    return map;
  }, [data?.heatmap]);

  const breakdownColumns: Column<AnalyticsBreakdownRow>[] = [
    {
      key: 'label',
      header: 'Segment',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium capitalize text-o-text">{r.label}</div>
          {r.meta ? <div className="text-[12px] text-o-text-3">{r.meta}</div> : null}
        </div>
      ),
    },
    {
      key: 'count',
      header: data?.breakdownPrimaryCol ?? 'Count',
      align: 'right',
      cell: (r) => <span className="o-num font-medium text-o-text">{fmtInt(r.count)}</span>,
    },
    {
      key: 'secondary',
      header: data?.breakdownSecondaryCol ?? 'Detail',
      hideBelow: 'sm',
      cell: (r) => <span className="text-[13px] text-o-text-2">{r.secondaryLabel}</span>,
    },
    {
      key: 'share',
      header: 'Share',
      hideBelow: 'md',
      cell: (r) => (
        <div className="flex items-center gap-2 min-w-[110px]">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-o-surface-2">
            <div className="h-full rounded-full bg-o-accent" style={{ width: `${r.ratioPct}%` }} />
          </div>
          <span className="w-9 text-right o-num text-[12px] text-o-text-3">{r.ratioPct}%</span>
        </div>
      ),
    },
  ];

  return (
    <PageContainer className="flex flex-col gap-5">
      <PageHeader
        title="Analytics & reports"
        description="Explore live conversation, AI deflection, team, voice, CSAT, and business metrics."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Date range"
              value={String(rangeDays) as '7' | '30' | '90'}
              onChange={(v) => {
                setSelectedDay(null);
                setRangeDays(Number(v) as AnalyticsRangeDays);
              }}
              items={[
                { id: '7', label: '7d' },
                { id: '30', label: '30d' },
                { id: '90', label: '90d' },
              ]}
            />
            <div className="flex items-center gap-2 rounded-[10px] border border-o-border bg-o-surface px-2.5 py-1">
              <Toggle
                checked={comparePrevious}
                onChange={setComparePrevious}
                label="Compare to previous"
                hideLabel
              />
              <span className="text-[12.5px] font-medium text-o-text-2">Compare</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leading={<Download size={14} />}
              disabled={!data}
              onClick={() => data && exportAnalyticsCsv(data)}
            >
              Export CSV
            </Button>
            {data?.canEdit ? (
              <Button
                variant="primary"
                size="sm"
                leading={<Plus size={14} />}
                onClick={() => setSaveOpen(true)}
              >
                New report
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Left Sub-nav (collapses into horizontal scroll pills at 390px) */}
        <aside className="flex flex-col gap-4">
          <nav
            aria-label="Analytics report categories"
            className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
          >
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedDay(null);
                    setSection(item.id);
                  }}
                  className={cn(
                    'flex flex-none items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors',
                    active
                      ? item.id === 'ai'
                        ? 'bg-o-ai-soft text-o-ai-text'
                        : 'bg-o-accent-soft text-o-accent-text'
                      : 'text-o-text-2 hover:bg-o-surface-2 hover:text-o-text',
                  )}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Saved Custom Reports */}
          <Card size="md" className="hidden lg:flex lg:flex-col lg:gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-o-text-3">
                Saved reports
              </span>
              {data?.canEdit ? (
                <button
                  type="button"
                  onClick={() => setSaveOpen(true)}
                  className="text-[12px] font-medium text-o-accent-text hover:underline"
                >
                  + Save
                </button>
              ) : null}
            </div>
            {!data || data.customReports.length === 0 ? (
              <p className="text-[12.5px] text-o-text-3">
                Save any view with its range and compare setting for quick access.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.customReports.map((rep) => (
                  <li key={rep.id} className="group flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDay(null);
                        setSection(rep.section);
                        setRangeDays(rep.rangeDays);
                        setComparePrevious(rep.comparePrevious);
                      }}
                      className="flex-1 truncate rounded-[8px] px-2 py-1.5 text-left text-[13px] text-o-text-2 hover:bg-o-surface-2 hover:text-o-text"
                    >
                      {rep.name}
                    </button>
                    {data.canEdit ? (
                      <button
                        type="button"
                        aria-label={`Delete ${rep.name}`}
                        onClick={() => handleDeleteReport(rep.id)}
                        className="rounded p-1 text-o-text-3 opacity-70 hover:text-o-bad hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>

        {/* Main Content Column */}
        <div className="flex min-w-0 flex-col gap-4">
          {bundle.error ? (
            <Card>
              <ErrorState body={bundle.error} onRetry={bundle.reload} />
            </Card>
          ) : bundle.loading && !data ? (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Card key={i}><Skeleton height={72} /></Card>
                ))}
              </div>
              <Card><Skeleton height={270} /></Card>
            </>
          ) : data ? (
            <>
              {/* 4 KPI Cards */}
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {data.kpis.map((kpi) => (
                  <Card key={kpi.label} size="md">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-[12.5px] font-medium',
                          kpi.tone === 'ai' ? 'text-o-ai-text' : 'text-o-text-3',
                        )}
                      >
                        {kpi.label}
                      </span>
                      {kpi.deltaPct !== null ? (
                        <Badge tone={kpi.deltaPct >= 0 ? 'ok' : 'bad'}>
                          {kpi.deltaPct > 0 ? `+${kpi.deltaPct}` : kpi.deltaPct}
                          {kpi.deltaUnit ?? '%'}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[23px] font-semibold tracking-tight o-num text-o-text">
                      {kpi.value}
                    </div>
                    <div className="mt-0.5 text-[12px] text-o-text-3">{kpi.foot}</div>
                  </Card>
                ))}
              </div>

              {/* Trend Bar Chart OR Peak Hours Heatmap */}
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="o-card__title">
                      {chartView === 'trend' ? data.seriesTitle : 'Peak activity hours (Mon–Sun)'}
                    </h3>
                    <p className="o-card__sub mt-0.5">
                      {chartView === 'trend'
                        ? 'Click any bar below to inspect that exact day.'
                        : 'UTC activity density across business hours (8am–7pm).'}
                    </p>
                  </div>
                  <Segmented
                    label="Visualization view"
                    value={chartView}
                    onChange={setChartView}
                    items={[
                      { id: 'trend', label: 'Daily trend' },
                      { id: 'heatmap', label: 'Peak hours' },
                    ]}
                  />
                </div>

                {chartView === 'trend' ? (
                  <div className="mt-5 flex flex-col gap-3">
                    <div className="flex h-[200px] items-end gap-1 overflow-x-auto pb-1">
                      {data.series.map((pt) => {
                        const hPct = Math.round((pt.value / maxSeriesVal) * 100);
                        const prevPct = Math.round((pt.previousValue / maxSeriesVal) * 100);
                        const isPicked = selectedDay?.date === pt.date;
                        return (
                          <button
                            key={pt.date}
                            type="button"
                            onClick={() => setSelectedDay(pt)}
                            title={`${pt.label}: ${pt.value} (${data.secondarySeriesLabel}: ${pt.secondaryValue})`}
                            className={cn(
                              'group flex min-w-[14px] flex-1 flex-col items-center justify-end h-full rounded-[6px] px-0.5 transition-colors',
                              isPicked ? 'bg-o-surface-2' : 'hover:bg-o-surface-2/60',
                            )}
                          >
                            <div className="flex w-full items-end justify-center gap-0.5 h-[165px]">
                              {comparePrevious && pt.previousValue > 0 ? (
                                <div
                                  className="w-1/2 rounded-t-[3px] bg-o-border"
                                  style={{ height: `${Math.max(4, prevPct)}%` }}
                                />
                              ) : null}
                              <div
                                className={cn(
                                  'w-full max-w-[18px] rounded-t-[4px] transition-all',
                                  section === 'ai' ? 'bg-o-ai' : 'bg-o-accent',
                                  isPicked && 'ring-2 ring-o-text/30',
                                )}
                                style={{ height: `${pt.value > 0 ? Math.max(6, hPct) : 2}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[11.5px] text-o-text-3">
                      <span>{data.series[0]?.label ?? ''}</span>
                      <span className="flex items-center gap-3">
                        <span>{data.primarySeriesLabel}</span>
                        {comparePrevious ? <span>· Ghost bar = prior period</span> : null}
                      </span>
                      <span>{data.series[data.series.length - 1]?.label ?? ''}</span>
                    </div>

                    {selectedDay ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-o-border bg-o-surface-2 px-4 py-2.5 text-[13px]">
                        <div>
                          <strong className="text-o-text">{selectedDay.label}</strong>
                          <span className="ml-2 text-o-text-3">({selectedDay.date})</span>
                        </div>
                        <div className="flex flex-wrap gap-4 o-num">
                          <span>
                            {data.primarySeriesLabel}: <strong>{fmtInt(selectedDay.value)}</strong>
                          </span>
                          <span>
                            {data.secondarySeriesLabel}:{' '}
                            <strong>{fmtInt(selectedDay.secondaryValue)}</strong>
                          </span>
                          {comparePrevious ? (
                            <span className="text-o-text-3">
                              Prior period: <strong>{fmtInt(selectedDay.previousValue)}</strong>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <div className="min-w-[500px] flex flex-col gap-1.5">
                      <div className="grid grid-cols-[44px_repeat(12,1fr)] gap-1 text-[11px] text-o-text-3">
                        <span />
                        {HOURS.map((h) => (
                          <span key={h} className="text-center o-num">
                            {h > 12 ? `${h - 12}p` : `${h}a`}
                          </span>
                        ))}
                      </div>
                      {WEEKDAYS.map((day) => (
                        <div key={day.dow} className="grid grid-cols-[44px_repeat(12,1fr)] gap-1 items-center">
                          <span className="text-[12px] font-medium text-o-text-2">{day.label}</span>
                          {HOURS.map((h) => {
                            const cnt = heatmapLookup.get(`${day.dow}-${h}`) ?? 0;
                            const intensity = cnt === 0 ? 0 : Math.ceil((cnt / heatmapMax) * 4);
                            return (
                              <div
                                key={h}
                                title={`${day.label} ${h}:00 — ${cnt} events`}
                                aria-label={`${day.label} ${h}:00: ${cnt}`}
                                className={cn(
                                  'h-6 rounded-[5px] border border-o-border/50 transition-colors',
                                  intensity === 0 && 'bg-o-surface-2/60',
                                  intensity === 1 && 'bg-o-accent/25',
                                  intensity === 2 && 'bg-o-accent/45',
                                  intensity === 3 && 'bg-o-accent/70',
                                  intensity >= 4 && 'bg-o-accent',
                                )}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* Breakdown Table */}
              <Card flush>
                <CardHeader
                  title={data.breakdownTitle}
                  sub={`Window: last ${data.rangeDays} days`}
                  className="border-b border-o-border px-5 py-4"
                />
                {data.breakdown.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={<BarChart3 size={24} />}
                      title="No records in this date window"
                      body="Try widening the date range to 30 or 90 days or logging new activity."
                    />
                  </div>
                ) : (
                  <Table
                    columns={breakdownColumns}
                    rows={data.breakdown}
                    rowKey={(r) => r.key}
                    caption={data.breakdownTitle}
                  />
                )}
              </Card>
            </>
          ) : null}
        </div>
      </div>

      {/* Save Custom Report Modal */}
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save custom report"
        description="Pin the current section, date range, and comparison toggle to your Analytics sidebar."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={savingReport} onClick={handleSaveCustomReport}>
              Save report
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Field label="Report title">
            <Input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="e.g. Monthly AI Deflection Review"
            />
          </Field>
          <Field label="Notes (optional)">
            <Textarea
              rows={2}
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              placeholder="Shared weekly leadership report..."
            />
          </Field>
        </div>
      </Modal>
    </PageContainer>
  );
}
