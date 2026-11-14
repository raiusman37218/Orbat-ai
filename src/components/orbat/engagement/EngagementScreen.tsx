'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  Mail,
  Megaphone,
  MessageCircle,
  Plus,
  Save,
  Smile,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
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
  createCampaign,
  createProactiveMessage,
  deleteCampaign,
  deleteProactiveMessage,
  getEngagementBootstrap,
  recordSurveyResponse,
  updateCampaign,
  updateProactiveMessage,
  useEngagementLiveSync,
  type CampaignChannel,
  type CampaignRecord,
  type CampaignStatus,
  type EngagementBootstrap,
  type ProactiveMessageRecord,
} from '@/lib/data/engagement';
import { useData } from '@/lib/data/use-data';

type EngagementTab = 'campaigns' | 'proactive' | 'surveys';

function campaignStatusTone(status: CampaignStatus): BadgeTone {
  if (status === 'live' || status === 'sent') return 'ok';
  if (status === 'scheduled') return 'accent';
  if (status === 'paused') return 'warn';
  return 'neutral';
}

function channelLabel(ch: CampaignChannel): string {
  switch (ch) {
    case 'in_app_banner':
      return 'In-app banner';
    case 'chat_message':
      return 'Chat message';
    case 'whatsapp':
      return 'WhatsApp';
    case 'announcement':
      return 'Announcement';
    case 'email':
    default:
      return 'Email';
  }
}

export function EngagementScreen() {
  const { workspace } = useShellSession();
  const toast = useOrbToast();

  const bundle = useData<EngagementBootstrap>(
    () => getEngagementBootstrap(workspace.id),
    ['engagement', workspace.id],
  );
  useEngagementLiveSync(workspace.id, bundle.reload);

  const [tab, setTab] = useState<EngagementTab>('campaigns');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Campaign modal
  const [campModalOpen, setCampModalOpen] = useState(false);
  const [campName, setCampName] = useState('');
  const [campChannel, setCampChannel] = useState<CampaignChannel>('email');
  const [campAudience, setCampAudience] = useState('All workspace contacts');
  const [campSubject, setCampSubject] = useState('');
  const [campBody, setCampBody] = useState('');
  const [savingCamp, setSavingCamp] = useState(false);
  const [deleteCampTarget, setDeleteCampTarget] = useState<CampaignRecord | null>(null);
  const [deletingCamp, setDeletingCamp] = useState(false);

  // Proactive message modal
  const [pmModalOpen, setPmModalOpen] = useState(false);
  const [pmName, setPmName] = useState('');
  const [pmTrigger, setPmTrigger] = useState('After 10s on /pricing');
  const [pmPage, setPmPage] = useState('/pricing*');
  const [pmDelay, setPmDelay] = useState(10);
  const [pmCopy, setPmCopy] = useState('');
  const [savingPm, setSavingPm] = useState(false);

  // Survey modal
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [surveyKind, setSurveyKind] = useState<'csat' | 'nps'>('nps');
  const [surveyCustomer, setSurveyCustomer] = useState('');
  const [surveyChannel, setSurveyChannel] = useState('web');
  const [surveyHandler, setSurveyHandler] = useState<'ai' | 'human' | 'unknown'>('ai');
  const [surveyScore, setSurveyScore] = useState(9);
  const [surveyComment, setSurveyComment] = useState('');
  const [surveyTheme, setSurveyTheme] = useState('');
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [surveyFilter, setSurveyFilter] = useState<'all' | 'csat' | 'nps'>('all');

  const campaigns = useMemo(() => bundle.data?.campaigns ?? [], [bundle.data?.campaigns]);
  const proactive = useMemo(
    () => bundle.data?.proactiveMessages ?? [],
    [bundle.data?.proactiveMessages],
  );
  const activeCampaign = useMemo(() => {
    if (campaigns.length === 0) return null;
    return campaigns.find((c) => c.id === selectedCampaignId) ?? campaigns[0];
  }, [campaigns, selectedCampaignId]);
  const canManage = bundle.data?.canManage ?? false;

  async function handleCreateCampaign() {
    if (!campName.trim()) {
      toast.show({ message: 'Campaign name is required.', tone: 'bad' });
      return;
    }
    setSavingCamp(true);
    try {
      const created = await createCampaign(workspace.id, {
        name: campName,
        channel: campChannel,
        audienceLabel: campAudience,
        subject: campSubject,
        body: campBody,
      });
      setSelectedCampaignId(created.id);
      setCampModalOpen(false);
      setCampName('');
      setCampSubject('');
      setCampBody('');
      toast.show({ message: `Created campaign "${created.name}".`, tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setSavingCamp(false);
    }
  }

  async function handleConfirmDeleteCampaign() {
    if (!deleteCampTarget) return;
    setDeletingCamp(true);
    try {
      await deleteCampaign(workspace.id, deleteCampTarget.id);
      if (selectedCampaignId === deleteCampTarget.id) setSelectedCampaignId(null);
      setDeleteCampTarget(null);
      toast.show({ message: 'Campaign deleted.', tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setDeletingCamp(false);
    }
  }

  async function handleCreateProactive() {
    if (!pmName.trim() || !pmCopy.trim()) {
      toast.show({ message: 'Title and message text are required.', tone: 'bad' });
      return;
    }
    setSavingPm(true);
    try {
      await createProactiveMessage(workspace.id, {
        name: pmName,
        triggerWhen: pmTrigger,
        pagePattern: pmPage,
        delaySeconds: pmDelay,
        message: pmCopy,
        isActive: true,
      });
      setPmModalOpen(false);
      setPmName('');
      setPmCopy('');
      toast.show({ message: 'Proactive message published to widget config.', tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setSavingPm(false);
    }
  }

  async function handleToggleProactive(item: ProactiveMessageRecord, next: boolean) {
    try {
      await updateProactiveMessage(workspace.id, { id: item.id, isActive: next });
      toast.show({
        message: `"${item.name}" ${next ? 'enabled on widget' : 'paused'}.`,
        tone: 'ok',
      });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    }
  }

  async function handleDeleteProactive(item: ProactiveMessageRecord) {
    try {
      await deleteProactiveMessage(workspace.id, item.id);
      toast.show({ message: `Deleted "${item.name}".`, tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    }
  }

  async function handleSaveSurvey() {
    setSavingSurvey(true);
    try {
      await recordSurveyResponse(workspace.id, {
        kind: surveyKind,
        customerName: surveyCustomer || 'Customer',
        channel: surveyChannel,
        handlerType: surveyHandler,
        score: surveyScore,
        comment: surveyComment || undefined,
        theme: surveyTheme || undefined,
      });
      setSurveyModalOpen(false);
      setSurveyCustomer('');
      setSurveyComment('');
      setSurveyTheme('');
      toast.show({ message: 'Recorded survey response.', tone: 'ok' });
      bundle.reload();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setSavingSurvey(false);
    }
  }

  const campaignColumns: Column<CampaignRecord>[] = [
    {
      key: 'name',
      header: 'Campaign',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-o-text">{r.name}</div>
          <div className="truncate text-[12px] text-o-text-3">{r.audienceLabel}</div>
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'Channel',
      hideBelow: 'sm',
      cell: (r) => <Badge tone="neutral">{channelLabel(r.channel)}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge tone={campaignStatusTone(r.status)} dot>{r.status}</Badge>,
    },
    {
      key: 'sent',
      header: 'Sent',
      align: 'right',
      hideBelow: 'md',
      cell: (r) => <span className="o-num text-o-text">{fmtInt(r.sentCount)}</span>,
    },
    {
      key: 'converted',
      header: 'Converted',
      align: 'right',
      cell: (r) => <span className="o-num font-medium text-o-text">{fmtInt(r.convertedCount)}</span>,
    },
  ];

  const primaryCta =
    tab === 'proactive'
      ? { label: 'New proactive message', onClick: () => setPmModalOpen(true) }
      : tab === 'surveys'
        ? { label: 'Log survey response', onClick: () => setSurveyModalOpen(true) }
        : { label: 'New campaign', onClick: () => setCampModalOpen(true) };

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => ({
        sent: acc.sent + c.sentCount,
        delivered: acc.delivered + c.deliveredCount,
        engaged: acc.engaged + c.openedCount + c.clickedCount,
        revenue: acc.revenue + c.revenueCents,
      }),
      { sent: 0, delivered: 0, engaged: 0, revenue: 0 },
    );
  }, [campaigns]);

  const filteredResponses = useMemo(() => {
    const all = bundle.data?.surveys.responses ?? [];
    if (surveyFilter === 'all') return all;
    return all.filter((s) => s.kind === surveyFilter);
  }, [bundle.data?.surveys.responses, surveyFilter]);

  return (
    <PageContainer className="flex flex-col gap-5">
      <PageHeader
        title="Outbound engagement"
        description="Coordinate outbound campaigns, live widget proactive greetings, and customer satisfaction surveys."
        actions={
          canManage || tab === 'surveys' ? (
            <Button variant="primary" size="sm" leading={<Plus size={14} />} onClick={primaryCta.onClick}>
              {primaryCta.label}
            </Button>
          ) : null
        }
      />

      <Tabs
        label="Engagement tools"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'campaigns', label: 'Campaigns', count: campaigns.length },
          { id: 'proactive', label: 'Proactive messages', count: proactive.length },
          { id: 'surveys', label: 'Surveys', count: bundle.data?.surveys.responses.length ?? 0 },
        ]}
      />

      {bundle.error ? (
        <Card>
          <ErrorState body={bundle.error} onRetry={bundle.reload} />
        </Card>
      ) : bundle.loading && !bundle.data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card><Skeleton height={220} /></Card>
          <Card><Skeleton height={220} /></Card>
        </div>
      ) : tab === 'campaigns' ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card size="md">
              <div className="text-[12.5px] text-o-text-3">Messages sent</div>
              <div className="mt-1 text-[22px] font-semibold o-num text-o-text">{fmtInt(totals.sent)}</div>
              <div className="mt-0.5 text-[12px] text-o-text-3">
                {fmtInt(bundle.data?.workspaceContactsCount ?? 0)} workspace contacts
              </div>
            </Card>
            <Card size="md">
              <div className="text-[12.5px] text-o-text-3">Delivered</div>
              <div className="mt-1 text-[22px] font-semibold o-num text-o-text">{fmtInt(totals.delivered)}</div>
              <div className="mt-0.5 text-[12px] text-o-text-3">
                {totals.sent > 0 ? `${Math.round((totals.delivered / totals.sent) * 100)}% rate` : 'No sends yet'}
              </div>
            </Card>
            <Card size="md">
              <div className="text-[12.5px] text-o-text-3">Opens & clicks</div>
              <div className="mt-1 text-[22px] font-semibold o-num text-o-text">{fmtInt(totals.engaged)}</div>
              <div className="mt-0.5 text-[12px] text-o-text-3">Tracked engagement</div>
            </Card>
            <Card size="md">
              <div className="text-[12.5px] text-o-text-3">Attributed revenue</div>
              <div className="mt-1 text-[22px] font-semibold o-num text-o-text">
                ${Math.round(totals.revenue / 100).toLocaleString()}
              </div>
              <div className="mt-0.5 text-[12px] text-o-text-3">Across campaigns</div>
            </Card>
          </div>

          <Alert tone="warn">
            Campaign drafts, audiences, and copy persist in Postgres. Automated bulk Email / WhatsApp fan-out delivery awaits outbound ESP/WhatsApp credentials in Channels.
          </Alert>

          {campaigns.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Megaphone size={24} />}
                title="No outbound campaigns yet"
                body="Draft email announcements, product update banners, or WhatsApp broadcasts for your contacts."
                action={
                  canManage ? (
                    <Button variant="primary" size="sm" leading={<Plus size={14} />} onClick={() => setCampModalOpen(true)}>
                      New campaign
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Card flush>
                <CardHeader
                  title="All campaigns"
                  sub="Select any campaign to edit copy, audience, or status."
                  className="border-b border-o-border px-5 py-4"
                />
                <Table
                  columns={campaignColumns}
                  rows={campaigns}
                  rowKey={(c) => c.id}
                  selectedKey={activeCampaign?.id ?? null}
                  onRowClick={(c) => setSelectedCampaignId(c.id)}
                  caption="Outbound engagement campaigns"
                />
              </Card>

              {activeCampaign ? (
                <CampaignInspector
                  key={activeCampaign.id}
                  workspaceId={workspace.id}
                  campaign={activeCampaign}
                  canManage={canManage}
                  onRequestDelete={() => setDeleteCampTarget(activeCampaign)}
                  onSaved={bundle.reload}
                />
              ) : null}
            </div>
          )}
        </div>
      ) : tab === 'proactive' ? (
        <div className="flex flex-col gap-4">
          <Alert tone="ok">
            Active proactive prompts sync directly into the live widget configuration endpoint (
            <code>GET /api/v1/widget/config</code>) and record impressions &amp; replies via NestJS.
          </Alert>

          {proactive.length === 0 ? (
            <Card>
              <EmptyState
                icon={<MessageCircle size={24} />}
                title="No proactive widget messages yet"
                body="Greet visitors automatically after X seconds on high-intent pages like /pricing or /checkout."
                action={
                  canManage ? (
                    <Button variant="primary" size="sm" leading={<Plus size={14} />} onClick={() => setPmModalOpen(true)}>
                      New proactive message
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {proactive.map((pm) => {
                const replyRate =
                  pm.shownCount > 0 ? Math.round((pm.replyCount / pm.shownCount) * 100) : 0;
                return (
                  <Card key={pm.id} className="flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-[15px] font-semibold text-o-text">{pm.name}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-o-text-3">
                            <span>When: {pm.triggerWhen}</span>
                            <span>·</span>
                            <Badge tone="neutral">{pm.pagePattern}</Badge>
                            <span>· {pm.delaySeconds}s delay</span>
                          </div>
                        </div>
                        {canManage ? (
                          <Toggle
                            checked={pm.isActive}
                            onChange={(next) => handleToggleProactive(pm, next)}
                            label={`Toggle ${pm.name}`}
                            hideLabel
                          />
                        ) : (
                          <Badge tone={pm.isActive ? 'ok' : 'neutral'} dot>
                            {pm.isActive ? 'Active' : 'Paused'}
                          </Badge>
                        )}
                      </div>

                      {/* Widget Chat Bubble Preview */}
                      <div className="mt-4 rounded-[14px] border border-o-border bg-o-surface-2 p-3.5">
                        <div className="flex items-start gap-2.5">
                          <span
                            className="grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-o-accent text-[11px] font-bold text-white"
                            aria-hidden="true"
                          >
                            O
                          </span>
                          <div className="min-w-0 flex-1 rounded-[10px] bg-o-surface px-3 py-2 text-[13.5px] text-o-text shadow-xs">
                            {pm.message}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-o-border pt-3 text-[12.5px] text-o-text-3">
                      <div className="flex flex-wrap gap-3">
                        <span><strong className="o-num text-o-text">{fmtInt(pm.shownCount)}</strong> shown</span>
                        <span><strong className="o-num text-o-text">{fmtInt(pm.replyCount)}</strong> replies ({replyRate}%)</span>
                        <span><strong className="o-num text-o-text">{fmtInt(pm.convertedCount)}</strong> converted</span>
                      </div>
                      {canManage ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon
                          aria-label={`Delete ${pm.name}`}
                          onClick={() => handleDeleteProactive(pm)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Surveys KPI Strip */}
          {bundle.data ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card size="md">
                  <div className="text-[12.5px] text-o-text-3">Positive CSAT</div>
                  <div className="mt-1 text-[22px] font-semibold o-num text-o-text">
                    {bundle.data.surveys.csatPositivePct === null
                      ? '—'
                      : `${bundle.data.surveys.csatPositivePct}%`}
                  </div>
                  <div className="mt-0.5 text-[12px] text-o-text-3">
                    {fmtInt(bundle.data.surveys.csatCount)} ratings (4–5 stars)
                  </div>
                </Card>
                <Card size="md">
                  <div className="text-[12.5px] text-o-text-3">Average stars</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[22px] font-semibold o-num text-o-text">
                    {bundle.data.surveys.csatAvgStars === null
                      ? '—'
                      : `${bundle.data.surveys.csatAvgStars} / 5`}
                    <Star size={16} className="text-o-warn" />
                  </div>
                  <div className="mt-0.5 text-[12px] text-o-text-3">Live ticket &amp; widget ratings</div>
                </Card>
                <Card size="md">
                  <div className="flex items-center gap-1.5 text-[12.5px] text-o-text-3">
                    <Sparkles size={13} className="text-o-ai-text" />
                    <span>AI vs Human CSAT</span>
                  </div>
                  <div className="mt-1 text-[20px] font-semibold o-num text-o-text">
                    {bundle.data.surveys.csatAiAvg ?? '—'} ★ / {bundle.data.surveys.csatHumanAvg ?? '—'} ★
                  </div>
                  <div className="mt-0.5 text-[12px] text-o-text-3">AI handled vs Human handled</div>
                </Card>
                <Card size="md">
                  <div className="text-[12.5px] text-o-text-3">NPS score</div>
                  <div className="mt-1 text-[22px] font-semibold o-num text-o-text">
                    {bundle.data.surveys.npsScore === null
                      ? '—'
                      : `${bundle.data.surveys.npsScore > 0 ? '+' : ''}${bundle.data.surveys.npsScore}`}
                  </div>
                  <div className="mt-0.5 text-[12px] text-o-text-3">
                    {fmtInt(bundle.data.surveys.npsCount)} responses
                  </div>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* CSAT Rating Breakdown */}
                <Card size="md">
                  <CardHeader
                    title="CSAT rating distribution"
                    sub="Combined from live widget ratings, email survey links, and logged responses."
                  />
                  <div className="mt-4 flex flex-col gap-2.5">
                    {bundle.data.surveys.csatStarsBreakdown.map((row) => (
                      <div key={row.stars} className="flex items-center gap-3 text-[13px]">
                        <span className="w-12 o-num font-medium text-o-text">{row.stars} ★</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-o-surface-2">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              row.stars >= 4 ? 'bg-o-ok' : row.stars === 3 ? 'bg-o-warn' : 'bg-o-bad',
                            )}
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                        <span className="w-16 text-right o-num text-o-text-3">
                          {row.count} ({row.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* NPS 0-10 Histogram */}
                <Card size="md">
                  <CardHeader
                    title="NPS score histogram (0–10)"
                    sub={`${bundle.data.surveys.npsPromoters} promoters · ${bundle.data.surveys.npsPassives} passives · ${bundle.data.surveys.npsDetractors} detractors`}
                  />
                  <div className="mt-5 flex h-[150px] items-end gap-1.5">
                    {(() => {
                      const maxCnt = Math.max(
                        1,
                        ...bundle.data.surveys.npsHistogram.map((b) => b.count),
                      );
                      return bundle.data.surveys.npsHistogram.map((bar) => {
                        const heightPct = bar.count > 0 ? Math.max(12, Math.round((bar.count / maxCnt) * 100)) : 4;
                        return (
                          <div key={bar.score} className="flex flex-1 flex-col items-center gap-1.5">
                            <span className="text-[11px] o-num text-o-text-3">{bar.count}</span>
                            <div className="flex h-[96px] w-full items-end">
                              <div
                                title={`Score ${bar.score}: ${bar.count}`}
                                className={cn(
                                  'w-full rounded-t-[6px] transition-all',
                                  bar.count === 0
                                    ? 'bg-o-surface-2'
                                    : bar.bucket === 'promoter'
                                      ? 'bg-o-ok'
                                      : bar.bucket === 'passive'
                                        ? 'bg-o-warn'
                                        : 'bg-o-bad',
                                )}
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                            <span className="text-[11.5px] o-num font-medium text-o-text-2">{bar.score}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </Card>
              </div>

              <Card flush>
                <CardHeader
                  title="Recent customer feedback"
                  sub={
                    bundle.data.surveys.themes.length > 0
                      ? `Top themes: ${bundle.data.surveys.themes.map((t) => `${t.theme} (${t.count})`).join(', ')}`
                      : 'Verbatim comments across CSAT and NPS surveys.'
                  }
                  actions={
                    <Select
                      aria-label="Filter feedback by survey type"
                      size="sm"
                      value={surveyFilter}
                      onChange={(e) => setSurveyFilter(e.target.value as typeof surveyFilter)}
                      options={[
                        { value: 'all', label: 'All surveys' },
                        { value: 'csat', label: 'CSAT only' },
                        { value: 'nps', label: 'NPS only' },
                      ]}
                    />
                  }
                  className="border-b border-o-border px-5 py-4"
                />
                {filteredResponses.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={<Smile size={24} />}
                      title="No feedback responses recorded yet"
                      body="Ratings sent through the chat widget or emailed CSAT links appear here automatically."
                      action={
                        <Button variant="secondary" size="sm" onClick={() => setSurveyModalOpen(true)}>
                          Log manual response
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-o-border">
                    {filteredResponses.slice(0, 30).map((item) => (
                      <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-o-text">{item.customerName}</span>
                            <Badge tone={item.kind === 'csat' ? (item.score >= 4 ? 'ok' : 'bad') : (item.score >= 9 ? 'ok' : item.score <= 6 ? 'bad' : 'warn')}>
                              {item.kind.toUpperCase()} {item.score}/{item.kind === 'csat' ? '5' : '10'}
                            </Badge>
                            {item.handlerType === 'ai' ? (
                              <Badge tone="ai">AI</Badge>
                            ) : item.handlerType === 'human' ? (
                              <Badge tone="neutral">Human</Badge>
                            ) : null}
                            {item.theme ? <Badge tone="accent">{item.theme}</Badge> : null}
                          </div>
                          <p className="mt-1 text-[13.5px] text-o-text-2">
                            {item.comment || <span className="italic text-o-text-3">No written comment left</span>}
                          </p>
                        </div>
                        <span className="text-[12px] text-o-text-3">{timeAgo(item.createdAt)} ago</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal
        open={campModalOpen}
        onClose={() => setCampModalOpen(false)}
        title="New outbound campaign"
        description="Draft a targeted message across email, in-app banners, or WhatsApp."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCampModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={savingCamp} onClick={handleCreateCampaign}>
              Create campaign
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Field label="Campaign name">
            <Input value={campName} onChange={(e) => setCampName(e.target.value)} placeholder="e.g. November feature release" />
          </Field>
          <Field label="Channel">
            <Select
              value={campChannel}
              onChange={(e) => setCampChannel(e.target.value as CampaignChannel)}
              options={[
                { value: 'email', label: 'Email' },
                { value: 'in_app_banner', label: 'In-app banner' },
                { value: 'announcement', label: 'Announcement' },
                { value: 'chat_message', label: 'Chat message' },
                { value: 'whatsapp', label: 'WhatsApp' },
              ]}
            />
          </Field>
          <Field label="Target audience">
            <Input value={campAudience} onChange={(e) => setCampAudience(e.target.value)} />
          </Field>
          <Field label="Subject / headline">
            <Input value={campSubject} onChange={(e) => setCampSubject(e.target.value)} placeholder="Faster help with AI Answers" />
          </Field>
          <Field label="Message copy">
            <Textarea rows={3} value={campBody} onChange={(e) => setCampBody(e.target.value)} placeholder="Write your message..." />
          </Field>
        </div>
      </Modal>

      {/* Create Proactive Message Modal */}
      <Modal
        open={pmModalOpen}
        onClose={() => setPmModalOpen(false)}
        title="New proactive widget message"
        description="Shown automatically on matching visitor pages through the ORBAT widget."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPmModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={savingPm} onClick={handleCreateProactive}>
              Publish prompt
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Field label="Rule name">
            <Input value={pmName} onChange={(e) => setPmName(e.target.value)} placeholder="e.g. Pricing helper" />
          </Field>
          <Field label="Trigger label">
            <Input value={pmTrigger} onChange={(e) => setPmTrigger(e.target.value)} placeholder="After 10s on pricing page" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Page pattern">
              <Input value={pmPage} onChange={(e) => setPmPage(e.target.value)} placeholder="/pricing*" />
            </Field>
            <Field label="Delay (seconds)">
              <Input type="number" min={0} max={3600} value={pmDelay} onChange={(e) => setPmDelay(Number(e.target.value) || 0)} />
            </Field>
          </div>
          <Field label="Widget message">
            <Textarea rows={3} value={pmCopy} onChange={(e) => setPmCopy(e.target.value)} placeholder="Questions about plans or seat pricing? I can compare options right here." />
          </Field>
        </div>
      </Modal>

      {/* Record Survey Modal */}
      <Modal
        open={surveyModalOpen}
        onClose={() => setSurveyModalOpen(false)}
        title="Log survey response"
        description="Record an offline or manual CSAT / NPS response in the workspace feedback stream."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSurveyModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={savingSurvey} onClick={handleSaveSurvey}>
              Save response
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Survey type">
              <Select
                value={surveyKind}
                onChange={(e) => {
                  const k = e.target.value as 'csat' | 'nps';
                  setSurveyKind(k);
                  setSurveyScore(k === 'csat' ? 5 : 9);
                }}
                options={[
                  { value: 'nps', label: 'NPS (0–10)' },
                  { value: 'csat', label: 'CSAT (1–5)' },
                ]}
              />
            </Field>
            <Field label={surveyKind === 'csat' ? 'Score (1–5)' : 'Score (0–10)'}>
              <Input
                type="number"
                min={surveyKind === 'csat' ? 1 : 0}
                max={surveyKind === 'csat' ? 5 : 10}
                value={surveyScore}
                onChange={(e) => setSurveyScore(Number(e.target.value) || 0)}
              />
            </Field>
          </div>
          <Field label="Customer name">
            <Input value={surveyCustomer} onChange={(e) => setSurveyCustomer(e.target.value)} placeholder="e.g. Tariq Mahmood" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel">
              <Select
                value={surveyChannel}
                onChange={(e) => setSurveyChannel(e.target.value)}
                options={[
                  { value: 'web', label: 'Web chat' },
                  { value: 'email', label: 'Email' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'voice', label: 'Voice' },
                ]}
              />
            </Field>
            <Field label="Handled by">
              <Select
                value={surveyHandler}
                onChange={(e) => setSurveyHandler(e.target.value as typeof surveyHandler)}
                options={[
                  { value: 'ai', label: 'AI assistant' },
                  { value: 'human', label: 'Human agent' },
                  { value: 'unknown', label: 'Unknown' },
                ]}
              />
            </Field>
          </div>
          <Field label="Theme tag (optional)">
            <Input value={surveyTheme} onChange={(e) => setSurveyTheme(e.target.value)} placeholder="e.g. Fast resolution, Onboarding" />
          </Field>
          <Field label="Comment">
            <Textarea rows={2} value={surveyComment} onChange={(e) => setSurveyComment(e.target.value)} placeholder="Verbatim customer note..." />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteCampTarget)}
        onClose={() => setDeleteCampTarget(null)}
        onConfirm={handleConfirmDeleteCampaign}
        title="Delete campaign?"
        body={`"${deleteCampTarget?.name ?? ''}" will be permanently removed.`}
        confirmLabel="Delete campaign"
        variant="danger"
        busy={deletingCamp}
      />
    </PageContainer>
  );
}

/* ---------- Campaign Right Inspector (keyed by campaign.id) ---------- */

function CampaignInspector({
  workspaceId,
  campaign,
  canManage,
  onRequestDelete,
  onSaved,
}: {
  workspaceId: string;
  campaign: CampaignRecord;
  canManage: boolean;
  onRequestDelete: () => void;
  onSaved: () => void;
}) {
  const toast = useOrbToast();
  const [name, setName] = useState(campaign.name);
  const [channel, setChannel] = useState<CampaignChannel>(campaign.channel);
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [audience, setAudience] = useState(campaign.audienceLabel);
  const [schedule, setSchedule] = useState(campaign.scheduleLabel);
  const [subject, setSubject] = useState(campaign.subject);
  const [body, setBody] = useState(campaign.body);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateCampaign(workspaceId, {
        id: campaign.id,
        name,
        channel,
        status,
        audienceLabel: audience,
        scheduleLabel: schedule,
        subject,
        body,
      });
      toast.show({ message: `Saved "${name}".`, tone: 'ok' });
      onSaved();
    } catch (err) {
      toast.show({ message: (err as Error).message, tone: 'bad' });
    } finally {
      setSaving(false);
    }
  }

  const funnel = [
    { label: 'Sent', count: campaign.sentCount },
    { label: 'Delivered', count: campaign.deliveredCount },
    { label: 'Opened', count: campaign.openedCount },
    { label: 'Clicked', count: campaign.clickedCount },
    { label: 'Converted', count: campaign.convertedCount },
  ];
  const base = Math.max(1, campaign.sentCount);

  return (
    <Card size="md" className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-o-text-3" />
          <h3 className="o-card__title">Campaign inspector</h3>
        </div>
        <Badge tone={campaignStatusTone(status)} dot>{status}</Badge>
      </div>

      {/* Funnel Bars */}
      <div className="rounded-[12px] border border-o-border bg-o-surface-2 p-3 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-o-text-2">
          <BarChart3 size={13} /> Delivery funnel
        </div>
        {funnel.map((step) => (
          <div key={step.label} className="flex items-center gap-2 text-[12px]">
            <span className="w-16 text-o-text-3">{step.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-o-surface">
              <div
                className="h-full rounded-full bg-o-accent"
                style={{ width: `${Math.round((step.count / base) * 100)}%` }}
              />
            </div>
            <span className="w-10 text-right o-num text-o-text">{fmtInt(step.count)}</span>
          </div>
        ))}
      </div>

      {canManage ? (
        <>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel">
              <Select
                value={channel}
                onChange={(e) => setChannel(e.target.value as CampaignChannel)}
                options={[
                  { value: 'email', label: 'Email' },
                  { value: 'in_app_banner', label: 'In-app banner' },
                  { value: 'announcement', label: 'Announcement' },
                  { value: 'chat_message', label: 'Chat message' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                ]}
              />
            </Field>
            <Field label="Status">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'live', label: 'Live' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'sent', label: 'Sent' },
                ]}
              />
            </Field>
          </div>
          <Field label="Audience">
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
          </Field>
          <Field label="Schedule">
            <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} />
          </Field>
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message copy">
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button size="sm" variant="primary" loading={saving} leading={<Save size={13} />} onClick={handleSave}>
              Save campaign
            </Button>
            <Button size="sm" variant="ghost" className="text-o-bad" leading={<Trash2 size={13} />} onClick={onRequestDelete}>
              Delete
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
