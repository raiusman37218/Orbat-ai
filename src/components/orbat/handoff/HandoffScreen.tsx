'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock,
  Inbox,
  MessageSquare,
  PhoneForwarded,
  RefreshCw,
  RotateCcw,
  Save,
  SkipForward,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
  TabPanel,
  Tabs,
  Textarea,
  Toggle,
  useOrbToast,
  type BadgeTone,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { timeAgo } from '@/components/orbat/overview/format';
import {
  getHandoffConsole,
  runHandoffQueueCommand,
  saveHandoffPolicy,
  useHandoffLiveSync,
  type HandoffConsoleBootstrap,
  type LiveHandoffQueueItem,
} from '@/lib/data/handoff';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

type HandoffTab = 'queue' | 'rules' | 'preview';

interface PolicyDraft {
  handoffMode: 'on' | 'email_only' | 'off';
  strategy: 'round_robin' | 'broadcast';
  ringTimeoutSeconds: number;
  maxConcurrentChatsPerAgent: number;
  unansweredTimeoutMinutes: number;
  cooldownMessageCount: number;
  requireConfirmation: boolean;
  aiAssistOfferEnabled: boolean;
  keywordsText: string;
  offlineMessage: string;
}

interface SimulatorStage {
  id: string;
  step: number;
  label: string;
  badge: string;
  tone: BadgeTone;
  customerTitle: string;
  customerMessage: string;
  customerStatus: string;
  agentTitle: string;
  agentNotice: string;
  agentActionHint: string;
}

const SIMULATOR_STAGES: SimulatorStage[] = [
  {
    id: 'bot_active',
    step: 1,
    label: 'bot_active',
    badge: '1 · AI active',
    tone: 'ai',
    customerTitle: 'AI Assistant',
    customerMessage: 'Customer asks: "My order arrived damaged — can I speak with someone about a replacement?"',
    customerStatus: 'Automated helper active · watching trigger phrases & loop detector',
    agentTitle: 'Background monitoring',
    agentNotice: 'No agent interrupted yet. AI evaluates keywords ("speak with someone") and confidence threshold.',
    agentActionHint: 'AI keeps handling routine turns until confirmation or direct escalation.',
  },
  {
    id: 'handoff_offered',
    step: 2,
    label: 'handoff_offered',
    badge: '2 · Soft offer',
    tone: 'accent',
    customerTitle: 'Confirm handoff to human specialist',
    customerMessage: '"I can connect you directly to a support specialist with your full order notes. Would you like me to transfer you now?"',
    customerStatus: 'Waiting on visitor confirmation (Yes, connect me / Continue with AI)',
    agentTitle: 'Pre-flight context queued',
    agentNotice: 'Draft handoff summary prepared cleanly; cooldown prevents repetitive nags if visitor declines.',
    agentActionHint: 'Next event: Visitor accepts transfer.',
  },
  {
    id: 'waiting_for_agent',
    step: 3,
    label: 'waiting_for_agent',
    badge: '3 · Ringing agent',
    tone: 'warn',
    customerTitle: 'Connecting to an agent',
    customerMessage: '"Connecting you with our support team now — you will not have to repeat anything."',
    customerStatus: 'Ring timer active (e.g. 45s per round-robin seat or broadcast)',
    agentTitle: 'Live Ping Card (Accept / Skip)',
    agentNotice: 'Incoming chat ping highlights visitor name, priority, and 2-line AI summary.',
    agentActionHint: 'Agent can click Accept to claim atomically via DB RPC or Skip to rotate immediately.',
  },
  {
    id: 'ai_team_active',
    step: 4,
    label: 'ai_team_active',
    badge: '4 · AI interim coverage',
    tone: 'ai',
    customerTitle: 'AI stays helpful while queue clears',
    customerMessage: '"All specialists are currently wrapping up live chats. While I keep your spot in queue, want me to gather photos or order ID so it goes faster?"',
    customerStatus: 'Zero dead air — customer stays engaged instead of staring at a static spinner',
    agentTitle: 'Ring timeout fallback',
    agentNotice: 'When all online agents miss or skip the ring window, AI interim helper keeps the session warm.',
    agentActionHint: 'Supervisor queue stays open in Inbox & Handoff queue.',
  },
  {
    id: 'urgent_ping',
    step: 5,
    label: 'urgent_ping',
    badge: '5 · Urgent escalation',
    tone: 'bad',
    customerTitle: 'Priority notice sent',
    customerMessage: '"Thank you for waiting — your ticket is marked urgent for our on-duty lead, or leave your email for a guaranteed follow-up."',
    customerStatus: 'Unanswered timeout threshold reached · offline queue fallback armed',
    agentTitle: 'Urgent queue alert',
    agentNotice: 'Supervisors see urgent highlight in Live Queue after unanswered timeout minutes elapse.',
    agentActionHint: 'Any available lead can claim from queue or transition to offline email follow-up.',
  },
  {
    id: 'agent_active',
    step: 6,
    label: 'agent_active',
    badge: '6 · Human owns chat',
    tone: 'ok',
    customerTitle: 'Connected with human specialist',
    customerMessage: '"Hi! I just reviewed the AI summary about your damaged parcel — let us sort out your replacement right away."',
    customerStatus: 'Single human owner · Sentinel redaction continues monitoring replies',
    agentTitle: 'Assigned agent active',
    agentNotice: 'Conversation locked cleanly to one owner so AI will never talk over the human agent.',
    agentActionHint: 'Agent may click Return to AI once human work is complete.',
  },
  {
    id: 'resolved',
    step: 7,
    label: 'resolved',
    badge: '7 · Resolved',
    tone: 'neutral',
    customerTitle: 'Conversation wrapped up',
    customerMessage: '"Your replacement label has been emailed. Reach back out anytime!"',
    customerStatus: 'Closed cleanly · transcript, audit trail & CSAT preserved',
    agentTitle: 'Capacity released',
    agentNotice: 'Agent active chat count decrements automatically, freeing capacity for the next queue ping.',
    agentActionHint: 'Press Reset to replay the 7-stage lifecycle.',
  },
];

const HANDOFF_PRINCIPLES = [
  {
    num: '01',
    title: 'Zero silent gaps',
    body: 'If nobody picks up within the ring window, AI interim coverage or offline fallback steps in — customers never stare at a frozen spinner.',
  },
  {
    num: '02',
    title: 'Single active owner',
    body: 'Atomic database claim RPC guarantees either AI OR one human agent speaks at a time — never double-replies.',
  },
  {
    num: '03',
    title: 'Summary before transfer',
    body: 'Visitors never re-explain their order ID or problem; the AI distills key intent into the ringing ping card.',
  },
  {
    num: '04',
    title: 'Respect office hours',
    body: 'Outside scheduled hours (`fn_is_within_office_hours`), chats move directly to offline email capture without ringing sleeping agents.',
  },
];

function queueStatusTone(status: string): BadgeTone {
  if (status === 'waiting_for_agent') return 'bad';
  if (status === 'offline_queued') return 'warn';
  if (status === 'handoff_offered') return 'ai';
  if (status === 'agent_active') return 'ok';
  return 'neutral';
}

function queueStatusLabel(status: string): string {
  if (status === 'waiting_for_agent') return 'Ringing / waiting';
  if (status === 'offline_queued') return 'Offline queued';
  if (status === 'handoff_offered') return 'Offered';
  if (status === 'agent_active') return 'Human active';
  return status;
}

function agentPresenceTone(status: 'online' | 'away' | 'offline'): BadgeTone {
  if (status === 'online') return 'ok';
  if (status === 'away') return 'warn';
  return 'neutral';
}

function formatElapsed(iso: string | null, nowMs: number | null): string {
  if (!iso || nowMs === null) return '--';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '--';
  const sec = Math.max(0, Math.floor((nowMs - parsed) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

function buildInitialDraft(data: HandoffConsoleBootstrap): PolicyDraft {
  const mode = data.settings.handoff_mode;
  const normalizedMode: 'on' | 'email_only' | 'off' =
    mode === 'email_only' || mode === 'off' ? mode : 'on';
  return {
    handoffMode: normalizedMode,
    strategy: data.settings.routing.strategy === 'broadcast' ? 'broadcast' : 'round_robin',
    ringTimeoutSeconds: data.settings.routing.ring_timeout_seconds ?? 45,
    maxConcurrentChatsPerAgent: data.settings.routing.max_concurrent_chats_per_agent ?? 3,
    unansweredTimeoutMinutes: data.settings.fallback.unanswered_timeout_minutes ?? 5,
    cooldownMessageCount: data.settings.ai.cooldown_message_count ?? 5,
    requireConfirmation: Boolean(data.settings.ai.require_confirmation),
    aiAssistOfferEnabled: Boolean(data.settings.fallback.ai_assist_offer_enabled),
    keywordsText: (data.settings.ai.keywords || []).join(', '),
    offlineMessage: data.settings.fallback.offline_expected_reply_text || '',
  };
}

export function HandoffScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();

  const [tab, setTab] = useState<HandoffTab>('queue');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [savingRules, setSavingRules] = useState(false);
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [simStepIdx, setSimStepIdx] = useState(0);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const { data, loading, error, reload } = useData<HandoffConsoleBootstrap>(
    () => getHandoffConsole(workspace!.id),
    ['orbat', 'handoff-console', workspace?.id],
    { enabled: Boolean(workspace?.id) },
  );

  useHandoffLiveSync(workspace?.id, reload, Boolean(workspace?.id) && tab === 'queue');

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setNowMs(Date.now()), 0);
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearTimeout(bootTimer);
      window.clearInterval(interval);
    };
  }, []);

  if (!workspace?.id) return null;

  const activeDraft = draft ?? (data ? buildInitialDraft(data) : null);

  function updateDraft(patch: Partial<PolicyDraft>) {
    if (!activeDraft) return;
    setDraft({ ...activeDraft, ...patch });
  }

  async function handleQueueCommand(
    item: LiveHandoffQueueItem,
    command: 'claim' | 'skip' | 'return_to_ai',
  ) {
    if (!workspace?.id) return;
    setBusyKey(`${command}-${item.id}`);
    try {
      const res = await runHandoffQueueCommand(workspace.id, item.id, command);
      if (res && res.ok === false && res.message) {
        show({ message: res.message, tone: 'bad' });
      } else {
        const msg =
          command === 'claim'
            ? `Claimed conversation with ${item.visitorName}`
            : command === 'skip'
              ? `Skipped ring for ${item.visitorName}`
              : `Returned ${item.visitorName} to AI coverage`;
        show({ message: msg, tone: 'ok' });
      }
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Queue action failed', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSavePolicy(e: FormEvent) {
    e.preventDefault();
    if (!workspace?.id || !activeDraft) return;
    setSavingRules(true);
    try {
      const keywords = activeDraft.keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      await saveHandoffPolicy(workspace.id, {
        handoffMode: activeDraft.handoffMode,
        strategy: activeDraft.strategy,
        ringTimeoutSeconds: activeDraft.ringTimeoutSeconds,
        maxConcurrentChatsPerAgent: activeDraft.maxConcurrentChatsPerAgent,
        unansweredTimeoutMinutes: activeDraft.unansweredTimeoutMinutes,
        cooldownMessageCount: activeDraft.cooldownMessageCount,
        requireConfirmation: activeDraft.requireConfirmation,
        aiAssistOfferEnabled: activeDraft.aiAssistOfferEnabled,
        keywords,
        offlineMessage: activeDraft.offlineMessage,
      });
      setDraft(null);
      show({ message: 'Handoff routing rules saved', tone: 'ok' });
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Could not save rules', tone: 'bad' });
    } finally {
      setSavingRules(false);
    }
  }

  const waitingCount = data?.queue.filter((q) => q.handoffStatus === 'waiting_for_agent').length ?? 0;
  const offlineQueuedCount = data?.queue.filter((q) => q.handoffStatus === 'offline_queued').length ?? 0;
  const humanActiveCount = data?.queue.filter((q) => q.handoffStatus === 'agent_active').length ?? 0;
  const onlineAgentsCount = data?.agents.filter((a) => a.status === 'online').length ?? 0;
  const totalSeatsCapacity = data?.agents
    .filter((a) => a.status === 'online')
    .reduce((acc, a) => acc + Math.max(0, a.maxChats - a.activeChats), 0) ?? 0;

  const simStage = SIMULATOR_STAGES[simStepIdx] ?? SIMULATOR_STAGES[0];

  return (
    <PageContainer>
      <PageHeader
        title="AI to human handoff"
        description="Live queue pings, round-robin or broadcast routing, office-hour fallbacks, and clean single-owner transfers."
        actions={
          <>
            {data ? (
              <Badge tone={data.isWithinOfficeHours ? 'ok' : 'warn'} dot>
                {data.isWithinOfficeHours ? 'Within office hours' : 'Outside office hours'} · {data.timezone}
              </Badge>
            ) : null}
            <ButtonLink href="/app/team/schedule" size="sm" variant="secondary" leading={<CalendarClock size={14} />}>
              Office hours
            </ButtonLink>
            <ButtonLink href="/app/team" size="sm" variant="secondary" leading={<Users size={14} />}>
              Team
            </ButtonLink>
            <ButtonLink href="/app/inbox" size="sm" variant="primary" leading={<Inbox size={14} />}>
              Open Inbox
            </ButtonLink>
          </>
        }
      />

      <Tabs<HandoffTab>
        idBase="handoff-tabs"
        label="Handoff console views"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'queue', label: 'Live queue & agents', count: data?.queue.length },
          { id: 'rules', label: 'Routing & escalation' },
          { id: 'preview', label: 'State flow preview' },
        ]}
      />

      {loading && !data ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : error && !data ? (
        <ErrorState title="Could not load handoff console" body={error} onRetry={reload} />
      ) : data && tab === 'queue' ? (
        <TabPanel idBase="handoff-tabs" id="queue">
          <div className="flex flex-col gap-4">
            {/* Live KPI strip */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card>
                <div className="text-[12px] font-medium text-o-text-3">Waiting / ringing</div>
                <div className={cn('o-num mt-1 text-[26px] font-bold', waitingCount > 0 ? 'text-o-bad' : 'text-o-text')}>
                  {waitingCount}
                </div>
                <div className="mt-0.5 text-[11.5px] text-o-text-3">Polled live every 12s</div>
              </Card>
              <Card>
                <div className="text-[12px] font-medium text-o-text-3">Offline queued</div>
                <div className={cn('o-num mt-1 text-[26px] font-bold', offlineQueuedCount > 0 ? 'text-o-warn' : 'text-o-text')}>
                  {offlineQueuedCount}
                </div>
                <div className="mt-0.5 text-[11.5px] text-o-text-3">Captured outside hours</div>
              </Card>
              <Card>
                <div className="text-[12px] font-medium text-o-text-3">Human active</div>
                <div className="o-num mt-1 text-[26px] font-bold text-o-ok">{humanActiveCount}</div>
                <div className="mt-0.5 text-[11.5px] text-o-text-3">Locked to assigned agent</div>
              </Card>
              <Card>
                <div className="text-[12px] font-medium text-o-text-3">Online capacity</div>
                <div className="o-num mt-1 text-[26px] font-bold text-o-text">
                  {onlineAgentsCount} <span className="text-[13px] font-normal text-o-text-3">({totalSeatsCapacity} free slots)</span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-o-text-3">Active non-light seats</div>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
              {/* Live Queue Card */}
              <Card>
                <CardHeader
                  title="Live ping & escalation queue"
                  sub="Conversations awaiting claim, ringing agents, offline-queued, or currently human-owned."
                  actions={
                    <Button
                      size="sm"
                      variant="ghost"
                      leading={<RefreshCw size={14} />}
                      onClick={reload}
                    >
                      Refresh
                    </Button>
                  }
                />

                {data.queue.length === 0 ? (
                  <EmptyState
                    icon={<PhoneForwarded size={22} />}
                    title="Queue is clear"
                    body="No visitors are currently waiting for a human handoff. When someone triggers escalation keywords or asks for an agent, they appear here in real time."
                  />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.queue.map((q) => {
                      const elapsed = formatElapsed(q.ringStartedAt ?? q.handoffRequestedAt ?? q.updatedAt, nowMs);
                      const claimBusy = busyKey === `claim-${q.id}`;
                      const skipBusy = busyKey === `skip-${q.id}`;
                      const returnBusy = busyKey === `return_to_ai-${q.id}`;
                      const anyBusy = claimBusy || skipBusy || returnBusy;
                      return (
                        <li
                          key={q.id}
                          className="flex flex-col gap-3 rounded-xl border border-o-border bg-o-surface-2/35 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={queueStatusTone(q.handoffStatus)} dot>
                                  {queueStatusLabel(q.handoffStatus)}
                                </Badge>
                                <span className="truncate font-semibold text-o-text">{q.visitorName}</span>
                                <Badge tone="neutral">{q.channel}</Badge>
                                {q.priority === 'urgent' || q.priority === 'high' ? (
                                  <Badge tone="bad">{q.priority}</Badge>
                                ) : null}
                              </div>
                              {q.visitorEmail ? (
                                <div className="mt-0.5 truncate text-[12px] text-o-text-3">{q.visitorEmail}</div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1.5 text-[12px] text-o-text-2">
                              <Clock size={13} className="text-o-text-3" />
                              <span className="o-num font-medium">{elapsed}</span>
                            </div>
                          </div>

                          {q.handoffReason || q.handoffSummary ? (
                            <div className="rounded-lg border border-o-border bg-o-surface p-3 text-[12.5px]">
                              {q.handoffReason ? (
                                <div className="font-medium text-o-text">Reason: {q.handoffReason}</div>
                              ) : null}
                              {q.handoffSummary ? (
                                <p className="mt-1 text-o-text-2">{q.handoffSummary}</p>
                              ) : null}
                            </div>
                          ) : null}

                          {q.lastMessagePreview ? (
                            <div className="flex items-start gap-2 text-[12.5px] text-o-text-2">
                              <MessageSquare size={14} className="mt-0.5 shrink-0 text-o-text-3" />
                              <span className="line-clamp-2">{q.lastMessagePreview}</span>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-o-border pt-2.5">
                            <div className="text-[12px] text-o-text-3">
                              {q.ringBroadcast ? (
                                <span className="inline-flex items-center gap-1 font-medium text-o-warn">
                                  <BellRing size={13} /> Broadcasting to all online agents
                                </span>
                              ) : q.ringingAgentName ? (
                                <span>
                                  Ringing <strong className="text-o-text">{q.ringingAgentName}</strong>
                                </span>
                              ) : q.assignedAgentName ? (
                                <span>
                                  Owner: <strong className="text-o-text">{q.assignedAgentName}</strong>
                                </span>
                              ) : (
                                <span>Awaiting assignment · updated {timeAgo(q.updatedAt)}</span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {data.canReply && q.handoffStatus !== 'agent_active' ? (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  leading={<UserCheck size={13} />}
                                  loading={claimBusy}
                                  disabled={anyBusy}
                                  onClick={() => handleQueueCommand(q, 'claim')}
                                >
                                  Accept
                                </Button>
                              ) : null}
                              {data.canReply && q.handoffStatus === 'waiting_for_agent' ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  leading={<SkipForward size={13} />}
                                  loading={skipBusy}
                                  disabled={anyBusy}
                                  onClick={() => handleQueueCommand(q, 'skip')}
                                >
                                  Skip
                                </Button>
                              ) : null}
                              {data.canReply && q.handoffStatus === 'agent_active' ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  leading={<Bot size={13} />}
                                  loading={returnBusy}
                                  disabled={anyBusy}
                                  onClick={() => handleQueueCommand(q, 'return_to_ai')}
                                >
                                  Return to AI
                                </Button>
                              ) : null}
                              <ButtonLink href={`/app/inbox?conversation=${q.id}`} size="sm" variant="ghost">
                                Open Inbox
                              </ButtonLink>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              {/* Agent Presence & Capacity Sidebar */}
              <Card className="h-fit">
                <CardHeader
                  title="Agent presence"
                  sub="Eligible human seats & concurrent chat load."
                />
                {data.agents.length === 0 ? (
                  <p className="text-[13px] text-o-text-3">No active seats configured in this workspace.</p>
                ) : (
                  <ul className="divide-y divide-o-border">
                    {data.agents.map((a) => {
                      const pct = a.maxChats > 0 ? Math.min(100, Math.round((a.activeChats / a.maxChats) * 100)) : 0;
                      return (
                        <li key={a.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] font-medium text-o-text">{a.name}</div>
                              <div className="text-[11.5px] capitalize text-o-text-3">{a.role.replace('_', ' ')}</div>
                            </div>
                            <Badge tone={agentPresenceTone(a.status)} dot>
                              {a.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-o-surface-3">
                              <div
                                className={cn('h-full rounded-full', pct >= 100 ? 'bg-o-bad' : 'bg-o-accent')}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="o-num text-[11.5px] text-o-text-2">
                              {a.activeChats}/{a.maxChats}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-4 border-t border-o-border pt-3 text-[12px] text-o-text-3">
                  Need to adjust shifts or workspace open hours?{' '}
                  <Link href="/app/team/schedule" className="font-medium text-o-accent-text hover:underline">
                    Manage office hours &rarr;
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </TabPanel>
      ) : data && tab === 'rules' && activeDraft ? (
        <TabPanel idBase="handoff-tabs" id="rules">
          <form onSubmit={handleSavePolicy} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="flex flex-col gap-4">
                <CardHeader
                  title="Handoff routing & limits"
                  sub="Controls how incoming escalation requests ring available seats."
                />
                <Field label="Workspace handoff mode">
                  <Select
                    disabled={!data.canManage}
                    value={activeDraft.handoffMode}
                    onChange={(e) =>
                      updateDraft({ handoffMode: e.target.value as 'on' | 'email_only' | 'off' })
                    }
                    options={[
                      { value: 'on', label: 'Live routing enabled (ping agents inside office hours)' },
                      { value: 'email_only', label: 'Email fallback only (capture offline follow-ups)' },
                      { value: 'off', label: 'AI-only mode (disable human handoff)' },
                    ]}
                  />
                </Field>

                <Field label="Ring strategy">
                  <Select
                    disabled={!data.canManage}
                    value={activeDraft.strategy}
                    onChange={(e) =>
                      updateDraft({ strategy: e.target.value as 'round_robin' | 'broadcast' })
                    }
                    options={[
                      { value: 'round_robin', label: 'Round robin (ring one available seat at a time)' },
                      { value: 'broadcast', label: 'Broadcast (ring all eligible online seats simultaneously)' },
                    ]}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Ring timeout (sec)">
                    <Input
                      type="number"
                      min={10}
                      max={300}
                      disabled={!data.canManage}
                      value={String(activeDraft.ringTimeoutSeconds)}
                      onChange={(e) =>
                        updateDraft({ ringTimeoutSeconds: Number(e.target.value) || 45 })
                      }
                    />
                  </Field>
                  <Field label="Max chats / seat">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      disabled={!data.canManage}
                      value={String(activeDraft.maxConcurrentChatsPerAgent)}
                      onChange={(e) =>
                        updateDraft({ maxConcurrentChatsPerAgent: Number(e.target.value) || 3 })
                      }
                    />
                  </Field>
                  <Field label="Unanswered timeout (min)">
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      disabled={!data.canManage}
                      value={String(activeDraft.unansweredTimeoutMinutes)}
                      onChange={(e) =>
                        updateDraft({ unansweredTimeoutMinutes: Number(e.target.value) || 5 })
                      }
                    />
                  </Field>
                </div>
              </Card>

              <Card className="flex flex-col gap-4">
                <CardHeader
                  title="AI triggers & offline fallback"
                  sub="When the assistant offers human support and what visitors see if nobody is online."
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Offer cooldown (messages)">
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      disabled={!data.canManage}
                      value={String(activeDraft.cooldownMessageCount)}
                      onChange={(e) =>
                        updateDraft({ cooldownMessageCount: Number(e.target.value) || 5 })
                      }
                    />
                  </Field>
                  <div className="flex flex-col justify-end gap-3 pb-1">
                    <Toggle
                      checked={activeDraft.requireConfirmation}
                      disabled={!data.canManage}
                      label="Ask confirmation before transfer"
                      onChange={(next) => updateDraft({ requireConfirmation: next })}
                    />
                    <Toggle
                      checked={activeDraft.aiAssistOfferEnabled}
                      disabled={!data.canManage}
                      label="AI interim help while queue waits"
                      onChange={(next) => updateDraft({ aiAssistOfferEnabled: next })}
                    />
                  </div>
                </div>

                <Field
                  label="Escalation trigger keywords"
                  hint="Comma-separated phrases (e.g. agent, human, refund, lawyer) that immediately prompt handoff."
                >
                  <Input
                    disabled={!data.canManage}
                    value={activeDraft.keywordsText}
                    onChange={(e) => updateDraft({ keywordsText: e.target.value })}
                    placeholder="agent, human, representative, refund"
                  />
                </Field>

                <Field label="Offline queue expected reply notice">
                  <Textarea
                    rows={3}
                    disabled={!data.canManage}
                    value={activeDraft.offlineMessage}
                    onChange={(e) => updateDraft({ offlineMessage: e.target.value })}
                    placeholder="Our team is offline. Leave your email and we will reply as soon as we are back."
                  />
                </Field>
              </Card>
            </div>

            <Alert tone="warn">
              Browser dashboard pings and database queue state update live every few seconds. Dedicated SMS / PSTN
              phone escalation requires external carrier webhook configuration if enabled in a future release.
            </Alert>

            <div className="flex items-center justify-end gap-2">
              {draft ? (
                <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={savingRules}>
                  Discard edits
                </Button>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                leading={<Save size={14} />}
                loading={savingRules}
                disabled={!data.canManage}
              >
                Save routing rules
              </Button>
            </div>
          </form>
        </TabPanel>
      ) : data && tab === 'preview' ? (
        <TabPanel idBase="handoff-tabs" id="preview">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader
                title="7-stage handoff lifecycle simulator"
                sub="Dry-run state flow preview showing customer widget vs agent dashboard behavior across each state."
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="ai">Interactive dry-run simulator</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      leading={<RotateCcw size={13} />}
                      onClick={() => setSimStepIdx(0)}
                      disabled={simStepIdx === 0}
                    >
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSimStepIdx((i) => Math.max(0, i - 1))}
                      disabled={simStepIdx === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      trailing={<ArrowRight size={13} />}
                      onClick={() => setSimStepIdx((i) => (i + 1) % SIMULATOR_STAGES.length)}
                    >
                      {simStepIdx === SIMULATOR_STAGES.length - 1 ? 'Replay' : 'Next event'}
                    </Button>
                  </div>
                }
              />

              {/* 7-stage horizontal stepper */}
              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="Handoff lifecycle stages">
                {SIMULATOR_STAGES.map((st, idx) => {
                  const active = idx === simStepIdx;
                  const passed = idx < simStepIdx;
                  return (
                    <li key={st.id}>
                      <button
                        type="button"
                        onClick={() => setSimStepIdx(idx)}
                        className={cn(
                          'flex w-full flex-col gap-1 rounded-xl border p-2.5 text-left transition-colors',
                          active
                            ? 'border-o-accent bg-o-accent-soft text-o-accent-text'
                            : passed
                              ? 'border-o-border bg-o-surface-2/60 text-o-text'
                              : 'border-o-border bg-o-surface text-o-text-3 hover:bg-o-surface-2/40',
                        )}
                      >
                        <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                          <span>Step {st.step}</span>
                          {passed ? <CheckCircle2 size={12} className="text-o-ok" /> : null}
                        </div>
                        <span className="truncate font-mono text-[11.5px] font-medium">{st.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {/* Split Customer vs Agent View */}
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-2xl border border-o-border bg-o-surface-2/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-o-text-3">
                      <Sparkles size={13} /> Customer widget view
                    </span>
                    <Badge tone={simStage.tone}>{simStage.badge}</Badge>
                  </div>
                  <div className="rounded-xl border border-o-border bg-o-surface p-4">
                    <div className="text-[14px] font-semibold text-o-text">{simStage.customerTitle}</div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-o-text-2">{simStage.customerMessage}</p>
                    <div className="mt-3 border-t border-o-border pt-2.5 text-[12px] font-medium text-o-text-3">
                      {simStage.customerStatus}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-o-border bg-o-surface-2/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-o-text-3">
                      <BellRing size={13} /> Agent dashboard view
                    </span>
                    <span className="font-mono text-[11.5px] text-o-text-3">{simStage.label}</span>
                  </div>
                  <div className="rounded-xl border border-o-border bg-o-surface p-4">
                    <div className="text-[14px] font-semibold text-o-text">{simStage.agentTitle}</div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-o-text-2">{simStage.agentNotice}</p>
                    <div className="mt-3 border-t border-o-border pt-2.5 text-[12px] font-medium text-o-accent-text">
                      {simStage.agentActionHint}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* 4 Handoff Principles */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {HANDOFF_PRINCIPLES.map((p) => (
                <Card key={p.num} className="flex flex-col gap-1.5">
                  <span className="o-num text-[11.5px] font-bold text-o-accent-text">{p.num}</span>
                  <h3 className="text-[14px] font-semibold text-o-text">{p.title}</h3>
                  <p className="text-[12.5px] leading-relaxed text-o-text-2">{p.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </TabPanel>
      ) : null}
    </PageContainer>
  );
}
