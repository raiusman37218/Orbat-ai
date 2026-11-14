'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Headphones,
  Mic,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  PhoneOutgoing,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Ticket,
  UserCheck,
  Voicemail,
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
  Select,
  SkeletonRows,
  useOrbToast,
  type BadgeTone,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, timeAgo } from '@/components/orbat/overview/format';
import {
  addVoiceTurn,
  createTicketFromVoiceCall,
  endVoiceCall,
  formatDurationSeconds,
  getVoiceBootstrap,
  getVoiceCallDetail,
  handBackVoiceCallToAi,
  setVoiceListening,
  takeOverVoiceCall,
  updateVoiceCampaignStatus,
  useVoiceLiveSync,
  type VoiceCallFilter,
  type VoiceCallRecord,
  type VoiceCallTurnRecord,
} from '@/lib/data/calls';
import { useData } from '@/lib/data/use-data';
import { errorMessage } from '@/lib/errors/user-error';
import { LogCallModal, NewCampaignModal, VoiceSettingsModal } from './VoiceModals';
import './calls.css';

const WAVE_DELAYS = [0, 0.15, 0.3, 0.45, 0.1, 0.25, 0.4, 0.05, 0.2, 0.35];

function callStatusMeta(status: VoiceCallRecord['status']): {
  label: string;
  tone: BadgeTone;
} {
  switch (status) {
    case 'live':
      return { label: 'Live', tone: 'bad' };
    case 'ai_resolved':
      return { label: 'Resolved by AI', tone: 'ok' };
    case 'transferred':
      return { label: 'Transferred', tone: 'accent' };
    case 'voicemail':
    case 'callback_booked':
      return { label: 'Callback booked', tone: 'warn' };
    case 'missed':
      return { label: 'Missed', tone: 'warn' };
    default:
      return { label: 'Ended', tone: 'neutral' };
  }
}

function providerLabel(provider: string): string {
  switch (provider) {
    case 'twilio':
      return 'Twilio Voice';
    case 'telnyx':
      return 'Telnyx';
    case 'sip':
      return 'SIP Trunk';
    case 'custom':
      return 'Custom Webhook';
    default:
      return '[TO BE CHOSEN]';
  }
}

function afterHoursLabel(mode: string): string {
  switch (mode) {
    case 'forward':
      return 'Forward call';
    case 'ai_only':
      return 'Nova AI voicemail';
    default:
      return 'Voicemail + callback';
  }
}

function formatTimerClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function renderTranscriptWithRedactions(text: string) {
  const parts = text.split(/(\[REDACTED[^\]]*\])/g);
  return parts.map((part, idx) =>
    part.startsWith('[REDACTED') && part.endsWith(']') ? (
      <span key={idx} className="o-redacted-pill" title="Redacted by Sentinel">
        {part}
      </span>
    ) : (
      <Fragment key={idx}>{part}</Fragment>
    ),
  );
}

export function CallsScreen({ initialCallId }: { initialCallId: string | null }) {
  const { workspace } = useShellSession();
  const toast = useOrbToast();
  const workspaceId = workspace.id;

  const [filter, setFilter] = useState<VoiceCallFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(initialCallId);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [turnSpeaker, setTurnSpeaker] = useState<'agent' | 'caller' | 'ai'>('agent');
  const [turnDraft, setTurnDraft] = useState('');
  const [turnBusy, setTurnBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const bootState = useData(
    () => getVoiceBootstrap(workspaceId, filter, debouncedQ || undefined),
    ['voice-bootstrap', workspaceId, filter, debouncedQ],
  );

  const boot = bootState.data;
  const calls = useMemo(() => boot?.calls ?? [], [boot?.calls]);

  const effectiveCallId = useMemo(() => {
    if (selectedCallId && calls.some((c) => c.id === selectedCallId)) return selectedCallId;
    return calls[0]?.id ?? null;
  }, [calls, selectedCallId]);

  const detailState = useData(
    () =>
      effectiveCallId ? getVoiceCallDetail(workspaceId, effectiveCallId) : Promise.resolve(null),
    ['voice-detail', workspaceId, effectiveCallId ?? ''],
  );

  const activeCall = detailState.data?.call ?? calls.find((c) => c.id === effectiveCallId) ?? null;
  const turns: VoiceCallTurnRecord[] = detailState.data?.turns ?? [];
  const hasLiveCall = calls.some((c) => c.status === 'live') || activeCall?.status === 'live';

  useEffect(() => {
    if (!hasLiveCall) return;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [hasLiveCall]);

  const reloadAll = useCallback(() => {
    bootState.reload();
    if (effectiveCallId) detailState.reload();
  }, [bootState, detailState, effectiveCallId]);

  useVoiceLiveSync(workspaceId, reloadAll, hasLiveCall, true);

  const handleListenToggle = async () => {
    if (!activeCall) return;
    setActionBusy('listen');
    try {
      const next = !activeCall.is_listening;
      await setVoiceListening(workspaceId, activeCall.id, next);
      toast.show({
        tone: 'ok',
        message: next ? 'Audio monitoring enabled' : 'Audio monitoring stopped',
      });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setActionBusy(null);
    }
  };

  const handleTakeoverToggle = async () => {
    if (!activeCall) return;
    const isAgent = activeCall.handler === 'agent';
    setActionBusy('takeover');
    try {
      if (isAgent) {
        await handBackVoiceCallToAi(workspaceId, activeCall.id);
        toast.show({ tone: 'ok', message: 'Call handed back to Nova AI' });
      } else {
        await takeOverVoiceCall(workspaceId, activeCall.id);
        toast.show({ tone: 'ok', message: 'You took over the call' });
      }
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setActionBusy(null);
    }
  };

  const handleEndCall = async () => {
    if (!activeCall) return;
    setActionBusy('end');
    try {
      const outcome = activeCall.handler === 'agent' ? 'transferred' : 'ai_resolved';
      await endVoiceCall(workspaceId, activeCall.id, outcome);
      toast.show({ tone: 'ok', message: 'Call marked ended and summary saved' });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setActionBusy(null);
    }
  };

  const handleCreateTicket = async () => {
    if (!activeCall) return;
    setActionBusy('ticket');
    try {
      await createTicketFromVoiceCall(workspaceId, activeCall.id);
      toast.show({ tone: 'ok', message: 'Support ticket created from call' });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setActionBusy(null);
    }
  };

  const handleSendTurn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCall || !turnDraft.trim()) return;
    setTurnBusy(true);
    try {
      await addVoiceTurn(workspaceId, activeCall.id, {
        speaker: turnSpeaker,
        transcript: turnDraft.trim(),
      });
      setTurnDraft('');
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setTurnBusy(false);
    }
  };

  const handleToggleCampaign = async (campaignId: string, nextStatus: 'active' | 'paused') => {
    try {
      await updateVoiceCampaignStatus(workspaceId, campaignId, nextStatus);
      toast.show({
        tone: 'ok',
        message: nextStatus === 'paused' ? 'Campaign paused' : 'Campaign resumed',
      });
      bootState.reload();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    }
  };

  const kpis = boot?.kpis;
  const settings = boot?.settings;
  const campaigns = boot?.campaigns ?? [];
  const groups = boot?.groups ?? [];
  const counts = boot?.counts ?? { all: 0, live: 0, ai: 0, transferred: 0 };

  const canReply = Boolean(boot?.canReply);
  const canEditTicket = Boolean(boot?.canEditTicket);
  const canManageSettings = Boolean(boot?.canManageSettings);
  const canEditContent = Boolean(boot?.canEditContent);

  const transferGroupName =
    groups.find((g) => g.id === settings?.transfer_group_id)?.name ?? 'Support team · warm transfer';

  const kpiCards = [
    {
      label: 'Calls today',
      value: kpis ? fmtInt(kpis.callsToday) : '0',
      sub: kpis
        ? `${fmtInt(kpis.aiResolvedCount)} AI-resolved · ${fmtInt(kpis.transferredCount)} transferred`
        : '—',
      subClass: 'text-o-text-3',
    },
    {
      label: 'Resolved by AI',
      value: kpis ? `${kpis.aiResolvedPct}%` : '0%',
      sub: 'last 30 days',
      subClass: 'text-o-ok',
    },
    {
      label: 'Avg. handle time',
      value: kpis ? formatDurationSeconds(kpis.avgHandleSeconds) : '0:00',
      sub: 'completed calls (30d)',
      subClass: 'text-o-text-3',
    },
    {
      label: 'Transfer rate',
      value: kpis ? `${kpis.transferRatePct}%` : '0%',
      sub: 'warm transfers with summary',
      subClass: 'text-o-text-3',
    },
    {
      label: 'Minutes used',
      value: kpis ? fmtInt(kpis.minutesUsedThisMonth) : '0',
      sub: kpis ? `of ${fmtInt(kpis.monthlyMinutesCap)} this month` : '—',
      subClass: 'text-o-text-3',
    },
  ];

  const filterButtons: Array<{ id: VoiceCallFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'live', label: 'Live', count: counts.live },
    { id: 'ai', label: 'AI', count: counts.ai },
    { id: 'transferred', label: 'Transferred', count: counts.transferred },
  ];

  const activeLiveElapsedSec = useMemo(() => {
    if (!activeCall) return 0;
    if (activeCall.status !== 'live') return activeCall.duration_seconds;
    const started = new Date(activeCall.started_at).getTime();
    if (Number.isNaN(started)) return activeCall.duration_seconds;
    return Math.max(activeCall.duration_seconds, Math.floor((nowMs - started) / 1000));
  }, [activeCall, nowMs]);

  return (
    <PageContainer>
      <PageHeader
        title="Calls"
        description="Monitor live AI voice calls, Sentinel PII redaction, warm transfers, and outbound campaigns."
        actions={
          <>
            {(canReply || canEditTicket) ? (
              <Button
                variant="secondary"
                size="md"
                leading={<PhoneCall size={14} aria-hidden="true" />}
                onClick={() => setLogCallOpen(true)}
              >
                Log / test call
              </Button>
            ) : null}
            {canManageSettings ? (
              <Button
                variant="secondary"
                size="md"
                leading={<Settings2 size={14} aria-hidden="true" />}
                onClick={() => setSettingsOpen(true)}
              >
                Configure
              </Button>
            ) : null}
            {canEditContent ? (
              <Button
                variant="primary"
                size="md"
                leading={<Plus size={14} aria-hidden="true" />}
                onClick={() => setCampaignModalOpen(true)}
              >
                New outbound campaign
              </Button>
            ) : null}
          </>
        }
      />

      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((k) => (
          <Card key={k.label} className="!p-4">
            <div className="text-[12.5px] text-o-text-2">{k.label}</div>
            <div className="o-num mt-1 text-[22px] font-bold text-o-text">{k.value}</div>
            <div className={`mt-0.5 text-[12px] ${k.subClass}`}>{k.sub}</div>
          </Card>
        ))}
      </div>

      {bootState.error ? (
        <ErrorState title="Could not load voice workspace" body={bootState.error} onRetry={reloadAll} />
      ) : bootState.loading && !boot ? (
        <Card>
          <SkeletonRows rows={7} />
        </Card>
      ) : (
        /* 3-column workbench stacking cleanly on mobile */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[296px_minmax(0,1fr)_300px] lg:items-start">
          {/* Column 1: Calls queue */}
          <Card flush className="flex flex-col">
            <div className="flex flex-wrap gap-1 border-b border-o-border p-2.5">
              {filterButtons.map((fb) => {
                const on = filter === fb.id;
                return (
                  <button
                    key={fb.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(fb.id)}
                    className={`inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors ${
                      on
                        ? 'bg-o-accent-soft text-o-accent-text font-semibold'
                        : 'text-o-text-2 hover:bg-o-surface-2'
                    }`}
                  >
                    <span>{fb.label}</span>
                    <span className="o-num text-[11px] opacity-80">{fb.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-b border-o-border p-2.5">
              <div className="relative">
                <Search
                  size={14}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-o-text-3"
                />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search caller, phone, order"
                  aria-label="Search calls"
                  className="!h-8 !pl-8 !pr-7 !text-[12.5px]"
                />
                {searchInput ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearchInput('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-o-text-3 hover:text-o-text"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            {calls.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title={debouncedQ || filter !== 'all' ? 'No matching calls' : 'No calls logged yet'}
                  body={
                    debouncedQ || filter !== 'all'
                      ? 'Switch filters or clear your search query.'
                      : 'Inbound and outbound carrier calls appear here automatically once connected — or log a test call.'
                  }
                  action={
                    (canReply || canEditTicket) && !debouncedQ && filter === 'all' ? (
                      <Button variant="secondary" size="sm" onClick={() => setLogCallOpen(true)}>
                        Log / test call
                      </Button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <div className="max-h-[540px] divide-y divide-o-border overflow-y-auto">
                {calls.map((c) => {
                  const selected = c.id === activeCall?.id;
                  const meta = callStatusMeta(c.status);
                  const DirIcon =
                    c.status === 'voicemail'
                      ? Voicemail
                      : c.direction === 'outbound'
                        ? PhoneOutgoing
                        : PhoneIncoming;
                  const iconTone =
                    c.status === 'live'
                      ? 'bg-o-ai-soft text-o-ai-text'
                      : c.status === 'ai_resolved'
                        ? 'bg-o-ok-soft text-o-ok'
                        : c.status === 'transferred'
                          ? 'bg-o-accent-soft text-o-accent-text'
                          : 'bg-o-warn-soft text-o-warn';

                  const elapsed =
                    c.status === 'live'
                      ? formatTimerClock(
                          Math.max(
                            c.duration_seconds,
                            Math.floor((nowMs - new Date(c.started_at).getTime()) / 1000),
                          ),
                        )
                      : timeAgo(c.started_at);

                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setSelectedCallId(c.id);
                        setShowAudioPlayer(false);
                      }}
                      className={`flex w-full items-start gap-2.5 p-3 text-left transition-colors ${
                        selected ? 'bg-o-accent-soft/70' : 'hover:bg-o-surface-2'
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${iconTone}`}
                      >
                        <DirIcon size={14} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13.5px] font-semibold text-o-text">
                            {c.caller_name || c.caller_phone}
                          </span>
                          <span className="o-num shrink-0 text-[11.5px] text-o-text-3">
                            {elapsed}
                          </span>
                        </span>
                        <span className="block truncate text-[12px] text-o-text-2">
                          {c.direction === 'outbound' ? 'Outbound' : 'Inbound'} ·{' '}
                          {c.order_context || c.caller_phone}
                        </span>
                        <span className="mt-1 inline-block">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Column 2: Call detail & transcript */}
          <Card flush className="flex flex-col min-w-0">
            {!activeCall ? (
              <EmptyState
                title="Select a call to inspect"
                body="Choose a live or completed call from the left queue to inspect its redacted transcript, audio summary, and controls."
                action={
                  canReply || canEditTicket ? (
                    <Button variant="primary" size="sm" onClick={() => setLogCallOpen(true)}>
                      Log / test call
                    </Button>
                  ) : null
                }
              />
            ) : (
              <>
                {/* Detail header */}
                <div className="flex flex-wrap items-center gap-3.5 border-b border-o-border px-4 py-4">
                  <Avatar name={activeCall.caller_name || activeCall.caller_phone} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="m-0 text-[15px] font-semibold text-o-text">
                        {activeCall.caller_name || activeCall.caller_phone}
                      </h3>
                      <Badge tone={callStatusMeta(activeCall.status).tone}>
                        {callStatusMeta(activeCall.status).label}
                      </Badge>
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-o-text-3">
                      {activeCall.direction === 'outbound' ? 'Outbound' : 'Inbound'} ·{' '}
                      {activeCall.caller_phone}
                      {activeCall.order_context ? ` · ${activeCall.order_context}` : ''}
                    </div>
                  </div>

                  {activeCall.status === 'live' ? (
                    <div className="flex items-center gap-2.5">
                      <div aria-hidden="true" className="flex h-7 items-center gap-[3px]">
                        {WAVE_DELAYS.map((delay, i) => (
                          <span
                            key={i}
                            className="o-wave-bar"
                            style={{ animationDelay: `${delay}s` }}
                          />
                        ))}
                      </div>
                      <span className="o-num text-[13.5px] font-semibold text-o-bad">
                        {formatTimerClock(activeLiveElapsedSec)}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2">
                    {activeCall.ticket_id ? (
                      <Link
                        href={`/app/tickets?id=${encodeURIComponent(activeCall.ticket_id)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-o-border px-3 text-[12.5px] font-medium text-o-text hover:bg-o-surface-2"
                      >
                        <Ticket size={13} aria-hidden="true" />
                        View ticket
                      </Link>
                    ) : canEditTicket ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={actionBusy === 'ticket'}
                        leading={<Ticket size={13} aria-hidden="true" />}
                        onClick={handleCreateTicket}
                      >
                        Create ticket
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Context metadata bar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-o-border bg-o-surface-2 px-4 py-2.5 text-[12px]">
                  <Badge
                    tone={
                      activeCall.handler === 'agent'
                        ? 'accent'
                        : activeCall.status === 'live'
                          ? 'ai'
                          : callStatusMeta(activeCall.status).tone
                    }
                  >
                    {activeCall.status === 'live'
                      ? activeCall.handler === 'agent'
                        ? activeCall.assigned_agent_name
                          ? `${activeCall.assigned_agent_name} on the call`
                          : 'Agent on the call'
                        : 'Nova (AI) is answering'
                      : callStatusMeta(activeCall.status).label}
                  </Badge>

                  <span className="rounded-full bg-o-surface px-2.5 py-0.5 text-o-text-2">
                    Language: {activeCall.language || settings?.default_language || 'English'}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-0.5 ${
                      activeCall.recording_consent
                        ? 'bg-o-ok-soft text-o-ok'
                        : 'bg-o-surface text-o-text-3'
                    }`}
                  >
                    {activeCall.recording_consent ? 'Recording consent given' : 'No consent flag'}
                  </span>

                  {activeCall.order_context ? (
                    <span className="rounded-full bg-o-surface px-2.5 py-0.5 text-o-text-2">
                      {activeCall.order_context}
                    </span>
                  ) : null}

                  {settings?.pii_redaction ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-o-surface px-2.5 py-0.5 text-o-text-2">
                      <ShieldCheck size={12} aria-hidden="true" className="text-o-ok" />
                      Sentinel PII guard active
                    </span>
                  ) : null}
                </div>

                {/* Transcript stream */}
                <div className="flex-1 space-y-3 p-4 min-h-[320px] max-h-[460px] overflow-y-auto">
                  {detailState.loading && turns.length === 0 ? (
                    <SkeletonRows rows={4} />
                  ) : turns.length === 0 ? (
                    <div className="py-10 text-center text-[13px] text-o-text-3">
                      No speech turns recorded on this call yet.
                    </div>
                  ) : (
                    turns.map((turn) => {
                      if (turn.speaker === 'system') {
                        return (
                          <div key={turn.id} className="flex justify-center">
                            <span className="rounded-full bg-o-surface-2 px-3 py-1 text-center text-[12px] text-o-text-3">
                              {renderTranscriptWithRedactions(turn.transcript)}
                            </span>
                          </div>
                        );
                      }

                      const speakerLabel =
                        turn.speaker === 'caller'
                          ? 'Customer'
                          : turn.speaker === 'ai'
                            ? 'Nova'
                            : 'Agent';
                      const speakerClass =
                        turn.speaker === 'caller'
                          ? 'text-o-text'
                          : turn.speaker === 'ai'
                            ? 'text-o-ai-text'
                            : 'text-o-accent-text';

                      return (
                        <div key={turn.id} className="flex items-start gap-2.5 text-[13.5px]">
                          <span className="o-num w-11 shrink-0 pt-0.5 text-[11.5px] text-o-text-3">
                            {formatTimerClock(turn.offset_seconds)}
                          </span>
                          <span className={`w-16 shrink-0 pt-0.5 text-[12px] font-semibold ${speakerClass}`}>
                            {speakerLabel}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-o-text leading-relaxed">
                              {renderTranscriptWithRedactions(turn.transcript)}
                            </div>
                            {turn.translated_text ? (
                              <div className="mt-0.5 text-[12.5px] text-o-text-3">
                                {renderTranscriptWithRedactions(turn.translated_text)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {activeCall.status === 'live' && activeCall.handler === 'ai' ? (
                    <div className="pl-[68px] text-[12.5px] text-o-text-3 flex items-center gap-1.5">
                      <Mic size={12} aria-hidden="true" className="text-o-ai" />
                      Transcribing live stream...
                    </div>
                  ) : null}
                </div>

                {/* Live action bar + quick transcript composer */}
                {activeCall.status === 'live' ? (
                  <div className="border-t border-o-border bg-o-surface p-4 space-y-3">
                    {canReply ? (
                      <form onSubmit={handleSendTurn} className="flex flex-wrap items-center gap-2">
                        <Select
                          size="sm"
                          aria-label="Speaker"
                          value={turnSpeaker}
                          onChange={(e) => setTurnSpeaker(e.target.value as typeof turnSpeaker)}
                          className="!h-9 !w-auto !text-[12.5px]"
                        >
                          <option value="agent">Agent speech</option>
                          <option value="caller">Caller speech</option>
                          <option value="ai">Nova AI speech</option>
                        </Select>
                        <Input
                          value={turnDraft}
                          onChange={(e) => setTurnDraft(e.target.value)}
                          placeholder="Append transcript line or operator prompt (cards/SSNs redacted)..."
                          className="!h-9 flex-1 min-w-[200px] !text-[13px]"
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          size="sm"
                          loading={turnBusy}
                          disabled={!turnDraft.trim()}
                          className="!h-9"
                        >
                          Append turn
                        </Button>
                      </form>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <span className="text-[12.5px] text-o-text-2">
                        {activeCall.handler === 'agent'
                          ? 'You are on the call. Nova is muted and taking notes.'
                          : activeCall.is_listening
                            ? 'Live audio listen-in active · ready for warm transfer.'
                            : 'Copilot monitoring call · AI is handling customer request.'}
                      </span>

                      {canReply ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={actionBusy === 'listen'}
                            leading={<Headphones size={13} aria-hidden="true" />}
                            onClick={handleListenToggle}
                          >
                            {activeCall.is_listening ? 'Mute monitor' : 'Listen in'}
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={actionBusy === 'takeover'}
                            leading={<UserCheck size={13} aria-hidden="true" />}
                            onClick={handleTakeoverToggle}
                          >
                            {activeCall.handler === 'agent'
                              ? 'Hand back to AI'
                              : 'Take over call'}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={actionBusy === 'end'}
                            leading={<PhoneOff size={13} aria-hidden="true" />}
                            onClick={handleEndCall}
                          >
                            End call
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-o-border bg-o-surface p-4 space-y-2.5">
                    <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
                      Call summary
                    </div>
                    <p className="m-0 text-[13.5px] text-o-text">
                      {activeCall.ai_summary || 'Call ended. No narrative summary was supplied by the carrier.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {activeCall.recording_url ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            leading={<Play size={12} aria-hidden="true" />}
                            onClick={() => setShowAudioPlayer((v) => !v)}
                          >
                            Play recording · {formatDurationSeconds(activeCall.duration_seconds)}
                          </Button>
                          {showAudioPlayer ? (
                            <audio
                              controls
                              autoPlay
                              src={activeCall.recording_url}
                              className="h-8 max-w-full"
                            />
                          ) : null}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-o-text-3">
                          <Phone size={12} aria-hidden="true" />
                          Duration {formatDurationSeconds(activeCall.duration_seconds)} · no audio recording file attached
                        </span>
                      )}

                      {activeCall.visitor_id ? (
                        <Link
                          href={`/app/customers?id=${encodeURIComponent(activeCall.visitor_id)}`}
                          className="text-[12.5px] font-medium text-o-accent-text hover:underline"
                        >
                          View customer CRM profile
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Column 3: Outbound campaigns & Call settings */}
          <aside className="space-y-4">
            {/* Outbound campaigns */}
            <Card className="!p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-[14px] font-semibold text-o-text">Outbound campaigns</h3>
                {canEditContent ? (
                  <Button
                    variant="quiet"
                    size="sm"
                    leading={<Plus size={12} aria-hidden="true" />}
                    onClick={() => setCampaignModalOpen(true)}
                  >
                    New
                  </Button>
                ) : null}
              </div>

              {campaigns.length === 0 ? (
                <p className="m-0 text-[12.5px] text-o-text-3">
                  No outbound voice campaigns created yet. Create one for COD confirmations or appointment reminders.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {campaigns.map((camp) => {
                    const pct =
                      camp.total_contacts > 0
                        ? Math.min(100, Math.round((camp.completed_contacts / camp.total_contacts) * 100))
                        : 0;
                    return (
                      <div key={camp.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="truncate font-medium text-o-text">{camp.name}</span>
                          <span className="o-num shrink-0 text-o-text-2">
                            {camp.completed_contacts}/{camp.total_contacts}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-o-surface-2">
                          <div
                            className="h-full rounded-full bg-o-accent transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[12px] text-o-text-3">
                          <span className="truncate">
                            {camp.confirmed_count || camp.cancelled_count || camp.no_answer_count
                              ? `Confirmed ${camp.confirmed_count} · cancelled ${camp.cancelled_count} · no answer ${camp.no_answer_count}`
                              : camp.schedule_label || camp.status}
                          </span>
                          {canEditContent && (camp.status === 'active' || camp.status === 'paused') ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleCampaign(
                                  camp.id,
                                  camp.status === 'active' ? 'paused' : 'active',
                                )
                              }
                              className="shrink-0 font-medium text-o-accent-text hover:underline"
                            >
                              {camp.status === 'active' ? 'Pause' : 'Resume'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Call settings */}
            <Card className="!p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-[14px] font-semibold text-o-text">Call settings</h3>
                {canManageSettings ? (
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="text-[12.5px] font-medium text-o-accent-text hover:underline"
                  >
                    Configure
                  </button>
                ) : null}
              </div>

              {settings ? (
                <dl className="m-0 divide-y divide-o-border text-[13px]">
                  <div className="flex justify-between gap-2 py-2">
                    <dt className="text-o-text-2">Business number</dt>
                    <dd className="o-num m-0 font-medium text-o-text text-right">
                      {settings.business_number || 'Not set'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2">
                    <dt className="text-o-text-2">Answered by</dt>
                    <dd className="m-0 font-medium text-o-text text-right">
                      {settings.voice_ai_enabled ? 'Nova · synced KB' : 'Agents / forward'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2">
                    <dt className="text-o-text-2">Transfer to</dt>
                    <dd className="m-0 font-medium text-o-text text-right">{transferGroupName}</dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2">
                    <dt className="text-o-text-2">After hours</dt>
                    <dd className="m-0 font-medium text-o-text text-right">
                      {afterHoursLabel(settings.after_hours_mode)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2">
                    <dt className="text-o-text-2">Card numbers spoken</dt>
                    <dd className="m-0 font-medium text-o-text text-right">
                      {settings.pii_redaction ? 'Redacted · never stored' : 'Unmasked'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 pt-2">
                    <dt className="text-o-text-2">Telephony provider</dt>
                    <dd className="m-0 font-medium text-o-text text-right">
                      {providerLabel(settings.provider)}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </Card>
          </aside>
        </div>
      )}

      {/* Modals */}
      <NewCampaignModal
        open={campaignModalOpen}
        workspaceId={workspaceId}
        onClose={() => setCampaignModalOpen(false)}
        onCreated={() => reloadAll()}
      />

      <LogCallModal
        open={logCallOpen}
        workspaceId={workspaceId}
        onClose={() => setLogCallOpen(false)}
        onLogged={(id) => {
          setSelectedCallId(id);
          reloadAll();
        }}
      />

      {settings ? (
        <VoiceSettingsModal
          open={settingsOpen}
          workspaceId={workspaceId}
          settings={settings}
          groups={groups}
          onClose={() => setSettingsOpen(false)}
          onSaved={reloadAll}
        />
      ) : null}
    </PageContainer>
  );
}
