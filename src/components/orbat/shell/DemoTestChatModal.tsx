'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  PauseCircle,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Field,
  Modal,
  Segmented,
  TabPanel,
  Tabs,
  Textarea,
  useOrbToast,
  type BadgeTone,
} from '@/components/orbat/primitives';
import {
  seedCompleteDemoWorkspaceAction,
  simulateCustomerInboundChatAction,
} from '@/app/actions/lifecycle-studio';
import {
  DEMO_CHANNELS,
  DEMO_PERSONAS,
  DEMO_SCENARIO_PRESETS,
  getDemoPersonaOption,
  getDemoScenarioPreset,
  type DemoChannel,
  type DemoPersona,
  type DemoScenarioKey,
  type DemoSeedSummary,
  type SimulateChatResult,
} from '@/lib/lifecycle/demo-presets';

type DemoModalTab = 'seed' | 'simulate';

function statusBadgeMeta(status: SimulateChatResult['status']): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'replied':
      return { label: 'AI Replied Live', tone: 'ok' };
    case 'paused_approval':
      return { label: 'LangGraph Approval Paused', tone: 'warn' };
    case 'handoff_queued':
      return { label: 'Handoff Queued', tone: 'bad' };
    case 'handoff_offered':
      return { label: 'Handoff Offered', tone: 'ai' };
    case 'blocked_or_skipped':
      return { label: 'Skipped / Guarded', tone: 'warn' };
    default:
      return { label: 'Recorded Inbound', tone: 'neutral' };
  }
}

function MetricCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-o-border bg-o-surface-2 px-3 py-2.5">
      <div className="o-num text-[18px] font-bold leading-none text-o-text">{value}</div>
      <div className="mt-1 text-[11.5px] font-medium text-o-text-3">{label}</div>
    </div>
  );
}

/**
 * Workspace admin modal housing the 1-Click Demo Seeder and Live Customer Inbound Chat Simulator.
 */
export function DemoTestChatModal({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const router = useRouter();
  const { show } = useOrbToast();

  const [tab, setTab] = useState<DemoModalTab>('seed');

  // Tab 1: Seed Demo Data state
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedSummary, setSeedSummary] = useState<DemoSeedSummary | null>(null);

  // Tab 2: Simulate Customer Chat state
  const defaultPreset = DEMO_SCENARIO_PRESETS[0];
  const [channel, setChannel] = useState<DemoChannel>(defaultPreset.defaultChannel);
  const [persona, setPersona] = useState<DemoPersona>(defaultPreset.defaultPersona);
  const [scenarioKey, setScenarioKey] = useState<DemoScenarioKey | 'custom'>(defaultPreset.key);
  const [message, setMessage] = useState<string>(defaultPreset.message);
  const [reuseThread, setReuseThread] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<SimulateChatResult | null>(null);

  const activePersona = getDemoPersonaOption(persona);

  async function handleSeedWorkspace() {
    setSeeding(true);
    setSeedError(null);
    try {
      const res = await seedCompleteDemoWorkspaceAction(workspaceId);
      if (!res.success) {
        setSeedError(res.error);
        show({ message: res.error, tone: 'bad' });
        return;
      }
      setSeedSummary(res.summary);
      show({
        message: `Demo data ready: ${res.summary.conversationsCreated} conversations, ${res.summary.dealsCreated} deals, ${res.summary.articlesCreated} KB articles.`,
        tone: 'ok',
      });
      router.refresh();
    } catch (err) {
      const msg = (err as Error)?.message || 'Could not seed demo workspace data.';
      setSeedError(msg);
      show({ message: msg, tone: 'bad' });
    } finally {
      setSeeding(false);
    }
  }

  function applyPreset(key: DemoScenarioKey) {
    const preset = getDemoScenarioPreset(key);
    setScenarioKey(preset.key);
    setChannel(preset.defaultChannel);
    setPersona(preset.defaultPersona);
    setMessage(preset.message);
    setSimError(null);
    setReuseThread(false);
  }

  async function handleSimulateSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setSimError('Enter a customer message before running the simulation.');
      return;
    }

    setSimulating(true);
    setSimError(null);

    try {
      const res = await simulateCustomerInboundChatAction({
        workspaceId,
        channel,
        persona,
        scenarioKey,
        message: trimmed,
        conversationId: reuseThread && simResult?.conversationId ? simResult.conversationId : null,
      });

      setSimResult(res);
      if (!res.success && res.error) {
        setSimError(res.error);
        show({ message: res.error, tone: 'bad' });
      } else {
        const badge = statusBadgeMeta(res.status);
        show({
          message: `${badge.label} on ${res.channel.toUpperCase()}`,
          ...(res.aiReplied ? { tone: 'ok' as const } : {}),
        });
      }
      router.refresh();
    } catch (err) {
      const msg = (err as Error)?.message || 'Simulation failed unexpectedly.';
      setSimError(msg);
      show({ message: msg, tone: 'bad' });
    } finally {
      setSimulating(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Demo & Live Customer Simulator"
      description="Seed realistic workspace records across channels & CRM, or fire an inbound customer message through the live AI pipeline."
    >
      <div className="flex flex-col gap-4">
        <Tabs<DemoModalTab>
          idBase="demo-sim-modal"
          label="Demo workspace and simulator modes"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'seed', label: 'Seed Demo Data' },
            { id: 'simulate', label: 'Simulate Customer Chat' },
          ]}
        />

        {tab === 'seed' ? (
          <TabPanel idBase="demo-sim-modal" id="seed" className="flex flex-col gap-4">
            <div className="rounded-[14px] border border-o-border bg-o-surface-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-lg">
                  <div className="flex items-center gap-2">
                    <h4 className="font-o-display text-[15px] font-bold text-o-text">
                      1-Click Complete Demo Workspace
                    </h4>
                    <Badge tone="ai">Idempotent</Badge>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-o-text-2">
                    Safely creates or reuses sample conversations across <strong>Web</strong>,{' '}
                    <strong>WhatsApp</strong>, <strong>Email</strong>, and <strong>Instagram</strong>, SLA-tracked tickets
                    (including a breached urgent outage and near-breach refund), Handoff queue items, a paused LangGraph
                    approval, B2B CRM companies &amp; deals, and indexed Help Center articles.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  loading={seeding}
                  leading={<Sparkles size={15} aria-hidden="true" />}
                  onClick={() => void handleSeedWorkspace()}
                >
                  {seeding ? 'Populating…' : 'Populate Demo Workspace'}
                </Button>
              </div>
            </div>

            {seedError ? <Alert tone="bad">{seedError}</Alert> : null}

            {seedSummary ? (
              <div className="flex flex-col gap-3 rounded-[14px] border border-o-border bg-o-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[13.5px] font-semibold text-o-text">
                    <CheckCircle2 size={16} className="text-o-ok" aria-hidden="true" />
                    <span>Demo workspace populated</span>
                  </div>
                  <Badge tone={seedSummary.embeddingMode === 'pgvector' ? 'ok' : 'neutral'}>
                    {seedSummary.embeddingMode === 'pgvector' ? 'pgvector Embeddings Active' : 'Keyword Chunks Fallback'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <MetricCell label="Conversations" value={seedSummary.conversationsCreated} />
                  <MetricCell label="Tickets & SLA" value={seedSummary.ticketsCreated} />
                  <MetricCell label="Handoff Items" value={seedSummary.handoffsCreated} />
                  <MetricCell label="Pending Approvals" value={seedSummary.approvalsCreated} />
                  <MetricCell label="CRM Deals" value={seedSummary.dealsCreated} />
                  <MetricCell label="CRM Companies" value={seedSummary.companiesCreated} />
                  <MetricCell label="KB Articles" value={seedSummary.articlesCreated} />
                  <MetricCell label="KB Chunks Synced" value={seedSummary.chunksSynced} />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <ButtonLink
                    href="/app/inbox"
                    variant="secondary"
                    size="sm"
                    onClick={onClose}
                    trailing={<ArrowRight size={13} aria-hidden="true" />}
                  >
                    Open Inbox
                  </ButtonLink>
                  <ButtonLink href="/app/tickets" variant="secondary" size="sm" onClick={onClose}>
                    View SLA Tickets
                  </ButtonLink>
                  <ButtonLink href="/app/handoff" variant="secondary" size="sm" onClick={onClose}>
                    Open Handoff Queue
                  </ButtonLink>
                  <ButtonLink href="/app/customers" variant="secondary" size="sm" onClick={onClose}>
                    CRM Pipeline
                  </ButtonLink>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTab('simulate')}
                    className="ml-auto"
                  >
                    Test Live Chat Simulator →
                  </Button>
                </div>
              </div>
            ) : null}
          </TabPanel>
        ) : (
          <TabPanel idBase="demo-sim-modal" id="simulate" className="flex flex-col gap-4">
            <form onSubmit={(e) => void handleSimulateSubmit(e)} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Inbound Channel">
                  <Segmented<DemoChannel>
                    label="Inbound channel"
                    value={channel}
                    onChange={(next) => setChannel(next)}
                    items={DEMO_CHANNELS.map((c) => ({ id: c.id, label: c.shortLabel }))}
                  />
                </Field>

                <Field label="Customer Persona" hint={`${activePersona.defaultName} · ${activePersona.subtitle}`}>
                  <Segmented<DemoPersona>
                    label="Customer persona"
                    value={persona}
                    onChange={(next) => setPersona(next)}
                    items={DEMO_PERSONAS.map((p) => ({
                      id: p.id,
                      label:
                        p.id === 'new_visitor'
                          ? 'New Visitor'
                          : p.id === 'vip_pro'
                            ? 'VIP Pro'
                            : 'Frustrated',
                    }))}
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-[12px] font-semibold text-o-text-2">Quick Scenario Presets</div>
                <div className="flex flex-wrap gap-1.5">
                  {DEMO_SCENARIO_PRESETS.map((preset) => {
                    const active = scenarioKey === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => applyPreset(preset.key)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                          active
                            ? 'border-o-accent bg-o-accent-soft text-o-text'
                            : 'border-o-border bg-o-surface-2 text-o-text-2 hover:border-o-border-strong hover:text-o-text'
                        }`}
                        title={preset.hint}
                      >
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field
                label="Customer Message"
                hint={
                  scenarioKey !== 'custom'
                    ? getDemoScenarioPreset(scenarioKey).hint
                    : 'Custom inbound message routed live through the workspace AI pipeline.'
                }
              >
                <Textarea
                  rows={3}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setScenarioKey('custom');
                  }}
                  placeholder="Type a realistic inbound message from this customer..."
                />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-2">
                {simResult?.conversationId ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-o-text-2">
                    <input
                      type="checkbox"
                      checked={reuseThread}
                      onChange={(e) => setReuseThread(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-o-border-strong accent-o-accent"
                    />
                    <span>Follow up in the current simulated thread</span>
                  </label>
                ) : (
                  <span className="text-[12px] text-o-text-3">
                    Writes real Postgres message &amp; runs live `/api/ai/auto-respond`
                  </span>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={simulating}
                  leading={<Send size={14} aria-hidden="true" />}
                >
                  {simulating ? 'Running Live AI…' : 'Send & Run Live AI'}
                </Button>
              </div>
            </form>

            {simError ? <Alert tone="bad">{simError}</Alert> : null}

            {simResult && simResult.conversationId ? (
              <div className="flex flex-col gap-3 rounded-[14px] border border-o-border bg-o-surface-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusBadgeMeta(simResult.status).tone}>
                    {simResult.status === 'paused_approval' ? (
                      <PauseCircle size={12} className="mr-1" aria-hidden="true" />
                    ) : simResult.status === 'handoff_queued' ? (
                      <ShieldAlert size={12} className="mr-1" aria-hidden="true" />
                    ) : (
                      <Bot size={12} className="mr-1" aria-hidden="true" />
                    )}
                    {statusBadgeMeta(simResult.status).label}
                  </Badge>

                  <Badge tone="neutral">{simResult.channel.toUpperCase()}</Badge>
                  {simResult.aiEngine ? <Badge tone="ai">{simResult.aiEngine}</Badge> : null}
                  {simResult.aiAgentName ? <Badge tone="neutral">{simResult.aiAgentName}</Badge> : null}
                  {simResult.ticketNumber ? (
                    <Badge tone="neutral" className="o-mono">
                      TCK-{simResult.ticketNumber}
                    </Badge>
                  ) : null}
                </div>

                {simResult.reason ? (
                  <div className="text-[12.5px] font-medium text-o-text-2">
                    Pipeline status: <span className="text-o-text">{simResult.reason}</span>
                  </div>
                ) : null}

                {simResult.aiReplyText ? (
                  <div className="rounded-[10px] border border-o-border bg-o-surface p-3 text-[13px] leading-relaxed text-o-text whitespace-pre-wrap">
                    {simResult.aiReplyText}
                  </div>
                ) : (
                  <div className="rounded-[10px] border border-o-border bg-o-surface p-3 text-[12.5px] text-o-text-3">
                    No public bot reply sent (thread state: <strong>{simResult.handoffStatus || 'active'}</strong>).
                  </div>
                )}

                {simResult.citedArticles.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-o-text-2">
                    <span className="font-semibold">Citations:</span>
                    {simResult.citedArticles.map((art, idx) => (
                      <Badge key={`${art.slug || art.title}-${idx}`} tone="neutral">
                        {art.title}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {simResult.createdDeal ? (
                  <div className="flex items-center gap-2 rounded-[10px] border border-o-border bg-o-surface px-3 py-2 text-[12.5px]">
                    <BriefcaseBusiness size={14} className="flex-none text-o-ok" aria-hidden="true" />
                    <span className="text-o-text">
                      CRM Deal Created: <strong>{simResult.createdDeal.title}</strong> ({simResult.createdDeal.stage} · $
                      {simResult.createdDeal.amount.toLocaleString()})
                    </span>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <ButtonLink
                    href={simResult.inboxHref}
                    variant="primary"
                    size="sm"
                    onClick={onClose}
                    trailing={<ArrowRight size={13} aria-hidden="true" />}
                  >
                    Open in Inbox
                  </ButtonLink>
                  <ButtonLink href={simResult.handoffHref} variant="secondary" size="sm" onClick={onClose}>
                    Open in Handoff
                  </ButtonLink>
                  {simResult.createdDeal ? (
                    <ButtonLink href="/app/customers" variant="secondary" size="sm" onClick={onClose}>
                      View CRM Deal
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            ) : null}
          </TabPanel>
        )}
      </div>
    </Modal>
  );
}
