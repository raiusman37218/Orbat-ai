'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  History,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  X,
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
  Modal,
  Select,
  SkeletonRows,
  Textarea,
  Toggle,
  useOrbToast,
} from '@/components/orbat/primitives';
import { PageContainer } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { timeAgo } from '@/components/orbat/overview/format';
import {
  getAgentBuilder,
  restoreAgentVersion,
  runAgentPlayground,
  saveAgentDraft,
  type AgentAnswerMode,
  type AgentBuilderBundle,
  type AgentCapabilities,
  type AgentEscalationRules,
  type AgentKnowledgeScope,
  type AgentReplyLanguageMode,
  type PlaygroundResult,
  type PlaygroundTurn,
} from '@/lib/data/agents';
import { useData } from '@/lib/data/use-data';

type BuilderStep = 'identity' | 'instructions' | 'knowledge' | 'capabilities' | 'handoff' | 'appearance';

const STEPS: { id: BuilderStep; label: string }[] = [
  { id: 'identity', label: '1. Identity' },
  { id: 'instructions', label: '2. Instructions' },
  { id: 'knowledge', label: '3. Knowledge' },
  { id: 'capabilities', label: '4. Capabilities' },
  { id: 'handoff', label: '5. Handoff' },
  { id: 'appearance', label: '6. Appearance' },
];

const CHANNEL_OPTIONS = ['web', 'email', 'whatsapp', 'instagram', 'voice', 'facebook'];

interface ChatLogEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  meta?: PlaygroundResult;
}

export function AgentBuilderScreen({
  agentId,
  templateId,
}: {
  agentId: string;
  templateId?: string | null;
}) {
  const { workspace } = useShellSession();
  const workspaceId = workspace.id;

  const bundleState = useData(
    () => getAgentBuilder(workspaceId, agentId, templateId),
    ['agent-builder', workspaceId, agentId, templateId ?? ''],
  );

  const bundle = bundleState.data;

  if (bundleState.loading && !bundle) {
    return (
      <PageContainer>
        <Card>
          <SkeletonRows rows={6} />
        </Card>
      </PageContainer>
    );
  }

  if (bundleState.error || !bundle) {
    return (
      <PageContainer>
        <ErrorState
          title="Could not open Agent Builder"
          body={bundleState.error || 'Agent builder failed to load.'}
          onRetry={bundleState.reload}
        />
      </PageContainer>
    );
  }

  return (
    <AgentBuilderEditor
      key={`${bundle.agent.id}:${bundle.agent.updated_at}:${templateId ?? ''}`}
      workspaceId={workspaceId}
      bundle={bundle}
      onReload={bundleState.reload}
    />
  );
}

function AgentBuilderEditor({
  workspaceId,
  bundle,
  onReload,
}: {
  workspaceId: string;
  bundle: AgentBuilderBundle;
  onReload: () => void;
}) {
  const router = useRouter();
  const toast = useOrbToast();
  const canManage = bundle.canManage;

  const a = bundle.agent;
  const [step, setStep] = useState<BuilderStep>('identity');

  // Editable draft form fields initialized directly from current bundle snapshot
  const [name, setName] = useState(a.name);
  const [roleTitle, setRoleTitle] = useState(a.role_title);
  const [description, setDescription] = useState(a.description);
  const [industry, setIndustry] = useState(a.industry || '');
  const [channels, setChannels] = useState<string[]>(a.channels.length ? a.channels : ['web']);
  const [tone, setTone] = useState(a.tone);
  const [answerMode, setAnswerMode] = useState<AgentAnswerMode>(a.answer_mode);
  const [replyLanguageMode, setReplyLanguageMode] = useState<AgentReplyLanguageMode>(
    a.reply_language_mode,
  );
  const [systemPrompt, setSystemPrompt] = useState(a.system_prompt);
  const [guardrails, setGuardrails] = useState<string[]>(a.guardrails);
  const [newGuardrail, setNewGuardrail] = useState('');
  const [knowledgeScope, setKnowledgeScope] = useState<AgentKnowledgeScope>(a.knowledge_scope);
  const [capabilities, setCapabilities] = useState<AgentCapabilities>(a.capabilities);
  const [newActionInput, setNewActionInput] = useState('');
  const [escalationRules, setEscalationRules] = useState<AgentEscalationRules>(a.escalation_rules);
  const [newBlockedTopic, setNewBlockedTopic] = useState('');
  const [badgeLabel, setBadgeLabel] = useState(a.appearance.badgeLabel);
  const [showCitations, setShowCitations] = useState(a.appearance.showCitations);
  const [welcomeMessage, setWelcomeMessage] = useState(a.appearance.welcomeMessage);
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [restoringVerId, setRestoringVerId] = useState<string | null>(null);

  // Playground state
  const [persona, setPersona] = useState<'standard' | 'vip' | 'upset' | 'non_english'>('standard');
  const [pgLang, setPgLang] = useState<'auto' | 'en' | 'roman_ur' | 'ur' | 'hi' | 'ar' | 'es'>('auto');
  const [pgInput, setPgInput] = useState('');
  const [pgBusy, setPgBusy] = useState(false);
  const [chatLog, setChatLog] = useState<ChatLogEntry[]>([]);

  const markDirty = () => setDirty(true);

  const persistAgent = async (publishNow: boolean, bundleData: AgentBuilderBundle) => {
    setSaving(publishNow ? 'publish' : 'draft');
    try {
      const res = await saveAgentDraft(workspaceId, {
        id: bundleData.isNew ? null : bundleData.agent.id,
        name,
        roleTitle,
        description,
        templateId: bundleData.agent.template_id,
        industry: industry || null,
        channels,
        tone,
        replyLanguageMode,
        answerMode,
        systemPrompt,
        guardrails,
        escalationRules,
        knowledgeScope,
        capabilities,
        appearance: { badgeLabel, showCitations, welcomeMessage },
        isPrimary: bundleData.agent.is_primary,
        publishNow,
      });

      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return;
      }

      setDirty(false);
      toast.show({
        tone: 'ok',
        message: publishNow
          ? `${res.agent.name} published live (v${res.agent.published_version}).`
          : `Saved draft changes for ${res.agent.name}.`,
      });

      if (bundleData.isNew) {
        router.replace(`/app/agents/${res.agent.id}`);
      } else {
        onReload();
      }
    } finally {
      setSaving(null);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (bundle.isNew) return;
    setRestoringVerId(versionId);
    try {
      const res = await restoreAgentVersion(workspaceId, bundle.agent.id, versionId);
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return;
      }
      toast.show({ tone: 'ok', message: 'Restored configuration into builder draft.' });
      setVersionsOpen(false);
      onReload();
    } finally {
      setRestoringVerId(null);
    }
  };

  const sendPlayground = async (textOverride?: string, simulateHandoff = false) => {
    const prompt = (textOverride ?? pgInput).trim() || (simulateHandoff ? 'Please connect me with a specialist' : '');
    if (!prompt) return;

    const historyTurns: PlaygroundTurn[] = chatLog.slice(-6).map((c) => ({
      role: c.role,
      content: c.text,
    }));

    setChatLog((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: prompt }]);
    if (!textOverride) setPgInput('');
    setPgBusy(true);

    try {
      const res = await runAgentPlayground(workspaceId, {
        agentId: !bundle.isNew ? bundle.agent.id : null,
        agentName: name || 'Support Assistant',
        tone,
        systemPrompt,
        guardrails,
        escalationRules,
        knowledgeScope,
        message: prompt,
        persona,
        language: pgLang,
        simulateHandoff,
        history: historyTurns,
      });
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return;
      }
      setChatLog((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.result.replyText,
          meta: res.result,
        },
      ]);
    } finally {
      setPgBusy(false);
    }
  };

  return (
    <PageContainer>
      {/* Top sticky builder bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-o-border bg-o-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <ButtonLink
            href="/app/agents"
            variant="ghost"
            size="sm"
            leading={<ArrowLeft size={14} />}
          >
            Agents
          </ButtonLink>

          <Select
            aria-label="Switch AI agent"
            value={bundle.isNew ? 'new' : bundle.agent.id}
            onChange={(e) => {
              const target = e.target.value;
              router.push(target === 'new' ? '/app/agents/new' : `/app/agents/${target}`);
            }}
            options={[
              ...bundle.allAgents.map((a) => ({
                value: a.id,
                label: `${a.name}${a.isPrimary ? ' (Primary)' : ''}`,
              })),
              { value: 'new', label: '+ Create new agent' },
            ]}
            className="w-[210px]"
          />

          <Badge tone={bundle.agent.status === 'live' ? 'ok' : bundle.agent.status === 'paused' ? 'warn' : 'neutral'} dot>
            {bundle.agent.status === 'live' ? 'Live' : bundle.agent.status === 'paused' ? 'Paused' : 'Draft'}
          </Badge>
          {dirty ? <Badge tone="warn">Unsaved changes</Badge> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!bundle.isNew ? (
            <Button
              variant="ghost"
              size="sm"
              leading={<History size={14} />}
              onClick={() => setVersionsOpen(true)}
            >
              Versions ({bundle.versions.length})
            </Button>
          ) : null}

          {canManage ? (
            <>
              <Button
                variant="secondary"
                size="md"
                loading={saving === 'draft'}
                disabled={saving !== null}
                leading={<Save size={14} />}
                onClick={() => persistAgent(false, bundle)}
              >
                Save draft
              </Button>
              <Button
                variant="ai"
                size="md"
                loading={saving === 'publish'}
                disabled={saving !== null}
                leading={<Sparkles size={14} />}
                onClick={() => persistAgent(true, bundle)}
              >
                Publish live
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {!canManage ? (
        <Alert className="mb-4">
          <strong className="font-semibold">View-only mode:</strong> Workspace owners and admins can edit instructions, guardrails, and publish changes. You can test behavior anytime in the Playground on the right.
        </Alert>
      ) : null}

      {/* 6-step pill rail */}
      <div
        className="mb-4 flex gap-1.5 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Agent configuration steps"
      >
        {STEPS.map((s) => {
          const active = step === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStep(s.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-o-ai text-white'
                  : 'border border-o-border bg-o-surface text-o-text-2 hover:bg-o-surface-2 hover:text-o-text'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Main Builder + Sticky Playground */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <Card size="lg">
          {step === 'identity' ? (
            <div className="space-y-4">
              <CardHeader
                title="Agent identity & channels"
                sub="Define who this assistant represents and where it responds to customers"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Agent name">
                  <Input
                    value={name}
                    disabled={!canManage}
                    onChange={(e) => {
                      setName(e.target.value);
                      markDirty();
                    }}
                    placeholder="e.g. Support Concierge"
                  />
                </Field>
                <Field label="Role title">
                  <Input
                    value={roleTitle}
                    disabled={!canManage}
                    onChange={(e) => {
                      setRoleTitle(e.target.value);
                      markDirty();
                    }}
                    placeholder="e.g. Order & returns specialist"
                  />
                </Field>
              </div>

              <Field label="Industry focus (optional)">
                <Input
                  value={industry}
                  disabled={!canManage}
                  onChange={(e) => {
                    setIndustry(e.target.value);
                    markDirty();
                  }}
                  placeholder="e.g. Fintech, Healthcare, SaaS, Retail"
                />
              </Field>

              <Field label="Summary description">
                <Textarea
                  rows={3}
                  value={description}
                  disabled={!canManage}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    markDirty();
                  }}
                  placeholder="Describe the conversations this agent owns…"
                />
              </Field>

              <div>
                <div className="mb-2 text-[13px] font-medium text-o-text">Active channels</div>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map((ch) => {
                    const checked = channels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        disabled={!canManage}
                        aria-pressed={checked}
                        onClick={() => {
                          setChannels((prev) =>
                            checked ? prev.filter((c) => c !== ch) : [...prev, ch],
                          );
                          markDirty();
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${
                          checked
                            ? 'bg-o-ai-soft text-o-ai-text ring-1 ring-o-ai/30'
                            : 'border border-o-border bg-o-surface-2 text-o-text-3'
                        }`}
                      >
                        {checked ? <Check size={12} /> : null}
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {step === 'instructions' ? (
            <div className="space-y-4">
              <CardHeader
                title="Behavior & guardrails"
                sub="Applied directly to every live customer response generated in Autopilot"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tone of voice">
                  <Input
                    value={tone}
                    disabled={!canManage}
                    onChange={(e) => {
                      setTone(e.target.value);
                      markDirty();
                    }}
                    placeholder="Clear, warm, concise"
                  />
                </Field>
                <Field label="Grounding strictness">
                  <Select
                    value={answerMode}
                    disabled={!canManage}
                    onChange={(e) => {
                      setAnswerMode(e.target.value as AgentAnswerMode);
                      markDirty();
                    }}
                    options={[
                      { value: 'agent', label: 'Agent mode (conversational + Help Center)' },
                      { value: 'strict', label: 'Strict docs mode (zero speculation)' },
                    ]}
                  />
                </Field>
              </div>

              <Field label="Reply language policy">
                <Select
                  value={replyLanguageMode}
                  disabled={!canManage}
                  onChange={(e) => {
                    setReplyLanguageMode(e.target.value as AgentReplyLanguageMode);
                    markDirty();
                  }}
                  options={[
                    { value: 'match_customer', label: 'Match customer language & script (incl. Romanized)' },
                    { value: 'native_script', label: 'Always reply in native script' },
                    { value: 'english_only', label: 'Always reply in English' },
                  ]}
                />
              </Field>

              <Field
                label="System instructions"
                hint="Specific domain rules, formatting preferences, and greeting/closing guidance."
              >
                <Textarea
                  rows={6}
                  value={systemPrompt}
                  disabled={!canManage}
                  onChange={(e) => {
                    setSystemPrompt(e.target.value);
                    markDirty();
                  }}
                  placeholder="Write clear instructions for how this agent should think, verify, and escalate…"
                />
              </Field>

              <div>
                <div className="mb-2 text-[13px] font-medium text-o-text">
                  Hard compliance guardrails
                </div>
                <div className="space-y-2">
                  {guardrails.map((g, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 rounded-[10px] border border-o-border bg-o-surface-2 px-3 py-2 text-[13px] text-o-text"
                    >
                      <span>{g}</span>
                      {canManage ? (
                        <button
                          type="button"
                          aria-label={`Remove guardrail ${idx + 1}`}
                          onClick={() => {
                            setGuardrails((prev) => prev.filter((_, i) => i !== idx));
                            markDirty();
                          }}
                          className="text-o-text-3 hover:text-o-bad"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {canManage ? (
                    <div className="flex gap-2">
                      <Input
                        value={newGuardrail}
                        onChange={(e) => setNewGuardrail(e.target.value)}
                        placeholder="Add rule (e.g. Never quote unverified refund timelines)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newGuardrail.trim()) {
                            e.preventDefault();
                            setGuardrails((prev) => [...prev, newGuardrail.trim()]);
                            setNewGuardrail('');
                            markDirty();
                          }
                        }}
                      />
                      <Button
                        variant="secondary"
                        size="md"
                        leading={<Plus size={14} />}
                        onClick={() => {
                          if (!newGuardrail.trim()) return;
                          setGuardrails((prev) => [...prev, newGuardrail.trim()]);
                          setNewGuardrail('');
                          markDirty();
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {step === 'knowledge' ? (
            <div className="space-y-4">
              <CardHeader
                title="Knowledge sources"
                sub="Choose which Help Center collections and internal notes this agent can cite"
                actions={
                  <ButtonLink href="/app/knowledge" variant="ghost" size="sm" leading={<BookOpen size={14} />}>
                    Manage articles
                  </ButtonLink>
                }
              />

              <Toggle
                label="Use all published Help Center collections"
                description="Automatically includes new guides as soon as they are published."
                checked={knowledgeScope.allArticles}
                disabled={!canManage}
                onChange={(checked) => {
                  setKnowledgeScope((prev) => ({ ...prev, allArticles: checked }));
                  markDirty();
                }}
              />

              {!knowledgeScope.allArticles ? (
                <div className="rounded-[12px] border border-o-border bg-o-surface-2 p-3.5">
                  <div className="mb-2 text-[12.5px] font-semibold text-o-text">
                    Select collections ({bundle.sections.length})
                  </div>
                  {bundle.sections.length === 0 ? (
                    <EmptyState
                      title="No Help Center collections yet"
                      body="Create collections inside Knowledge Base to scope specific articles per agent."
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {bundle.sections.map((sec) => {
                        const checked = knowledgeScope.sectionIds.includes(sec.id);
                        return (
                          <label
                            key={sec.id}
                            className="flex cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-o-border bg-o-surface px-3 py-2 text-[13px]"
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!canManage}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setKnowledgeScope((prev) => ({
                                    ...prev,
                                    sectionIds: on
                                      ? [...prev.sectionIds, sec.id]
                                      : prev.sectionIds.filter((x) => x !== sec.id),
                                  }));
                                  markDirty();
                                }}
                              />
                              <span className="font-medium text-o-text">{sec.name}</span>
                            </span>
                            <span className="o-num text-[11.5px] text-o-text-3">
                              {sec.articleCount} docs
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              <Toggle
                label="Include internal Bot Knowledge & approved Q&As"
                description={`${bundle.botKnowledgeCount} private Q&A / self-learned entry(ies) currently indexed in this workspace.`}
                checked={knowledgeScope.includeBotKnowledge}
                disabled={!canManage}
                onChange={(checked) => {
                  setKnowledgeScope((prev) => ({ ...prev, includeBotKnowledge: checked }));
                  markDirty();
                }}
              />
            </div>
          ) : null}

          {step === 'capabilities' ? (
            <div className="space-y-4">
              <CardHeader
                title="Declared capabilities & integrations"
                sub="Workflow skills declared for this agent profile and compliance frameworks"
              />

              <Alert>
                <strong className="font-semibold">External tool webhooks:</strong> Declared capabilities guide how the assistant triages and collects required fields before handoff. Live third-party write webhooks (Shopify refunds, Stripe locks, CRM sync) connect in{' '}
                <span className="font-semibold">Channels & apps</span>.
              </Alert>

              <div>
                <div className="mb-2 text-[13px] font-medium text-o-text">Agent actions</div>
                <div className="space-y-2">
                  {capabilities.actions.length === 0 ? (
                    <div className="text-[13px] text-o-text-3">
                      No custom capability workflows listed yet.
                    </div>
                  ) : (
                    capabilities.actions.map((act, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded-[10px] border border-o-border bg-o-surface-2 px-3 py-2 text-[13px] text-o-text"
                      >
                        <span>{act}</span>
                        {canManage ? (
                          <button
                            type="button"
                            aria-label={`Remove capability ${idx + 1}`}
                            onClick={() => {
                              setCapabilities((prev) => ({
                                ...prev,
                                actions: prev.actions.filter((_, i) => i !== idx),
                              }));
                              markDirty();
                            }}
                            className="text-o-text-3 hover:text-o-bad"
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                    ))
                  )}

                  {canManage ? (
                    <div className="flex gap-2">
                      <Input
                        value={newActionInput}
                        onChange={(e) => setNewActionInput(e.target.value)}
                        placeholder="Add workflow skill (e.g. Order lookup & SLA check)"
                      />
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => {
                          if (!newActionInput.trim()) return;
                          setCapabilities((prev) => ({
                            ...prev,
                            actions: [...prev.actions, newActionInput.trim()],
                          }));
                          setNewActionInput('');
                          markDirty();
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {step === 'handoff' ? (
            <div className="space-y-4">
              <CardHeader
                title="Escalation & handoff rules"
                sub="Define confidence boundaries, turn limits, and topics that automatically route to a specialist"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={`Confidence floor (${Math.round(escalationRules.confidenceThreshold * 100)}%)`}
                  hint="Lower confidence triggers human review/handoff."
                >
                  <input
                    type="range"
                    min={0.4}
                    max={0.95}
                    step={0.05}
                    disabled={!canManage}
                    value={escalationRules.confidenceThreshold}
                    onChange={(e) => {
                      setEscalationRules((prev) => ({
                        ...prev,
                        confidenceThreshold: Number(e.target.value),
                      }));
                      markDirty();
                    }}
                    className="w-full accent-o-ai"
                  />
                </Field>
                <Field label="Max autonomous AI turns">
                  <Input
                    type="number"
                    min={2}
                    max={25}
                    disabled={!canManage}
                    value={String(escalationRules.maxBotTurns)}
                    onChange={(e) => {
                      setEscalationRules((prev) => ({
                        ...prev,
                        maxBotTurns: Math.min(25, Math.max(2, Number(e.target.value) || 8)),
                      }));
                      markDirty();
                    }}
                  />
                </Field>
              </div>

              <Field label="Escalation team group">
                <Select
                  value={escalationRules.handoffGroupId ?? ''}
                  disabled={!canManage}
                  onChange={(e) => {
                    setEscalationRules((prev) => ({
                      ...prev,
                      handoffGroupId: e.target.value || null,
                    }));
                    markDirty();
                  }}
                  options={[
                    { value: '', label: 'General available inbox team' },
                    ...bundle.teamGroups.map((g) => ({ value: g.id, label: g.name })),
                  ]}
                />
              </Field>

              <Toggle
                label="Escalate automatically on frustration or urgent distress"
                checked={escalationRules.handoffOnFrustration}
                disabled={!canManage}
                onChange={(checked) => {
                  setEscalationRules((prev) => ({ ...prev, handoffOnFrustration: checked }));
                  markDirty();
                }}
              />

              <Toggle
                label="Ask customer confirmation before transferring chat"
                checked={escalationRules.requireConfirmation}
                disabled={!canManage}
                onChange={(checked) => {
                  setEscalationRules((prev) => ({ ...prev, requireConfirmation: checked }));
                  markDirty();
                }}
              />

              <div>
                <div className="mb-2 text-[13px] font-medium text-o-text">
                  Blocked topics (always route to a human)
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {escalationRules.blockedTopics.map((topic) => (
                    <Badge key={topic} tone="bad">
                      {topic}
                      {canManage ? (
                        <button
                          type="button"
                          aria-label={`Remove ${topic}`}
                          className="ml-1"
                          onClick={() => {
                            setEscalationRules((prev) => ({
                              ...prev,
                              blockedTopics: prev.blockedTopics.filter((t) => t !== topic),
                            }));
                            markDirty();
                          }}
                        >
                          <X size={11} />
                        </button>
                      ) : null}
                    </Badge>
                  ))}
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <Input
                      value={newBlockedTopic}
                      onChange={(e) => setNewBlockedTopic(e.target.value)}
                      placeholder="e.g. chargeback, legal notice, security breach"
                    />
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => {
                        const clean = newBlockedTopic.trim();
                        if (!clean) return;
                        setEscalationRules((prev) => ({
                          ...prev,
                          blockedTopics: Array.from(new Set([...prev.blockedTopics, clean])),
                        }));
                        setNewBlockedTopic('');
                        markDirty();
                      }}
                    >
                      Block topic
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 'appearance' ? (
            <div className="space-y-4">
              <CardHeader
                title="Customer appearance & citations"
                sub="Customize how this agent introduces itself inside your live chat widget"
              />
              <Field label="Agent badge label">
                <Input
                  value={badgeLabel}
                  disabled={!canManage}
                  onChange={(e) => {
                    setBadgeLabel(e.target.value);
                    markDirty();
                  }}
                />
              </Field>
              <Toggle
                label="Display Help Center source citations beneath replies"
                checked={showCitations}
                disabled={!canManage}
                onChange={(checked) => {
                  setShowCitations(checked);
                  markDirty();
                }}
              />
              <Field label="Widget welcome greeting">
                <Textarea
                  rows={3}
                  value={welcomeMessage}
                  disabled={!canManage}
                  onChange={(e) => {
                    setWelcomeMessage(e.target.value);
                    markDirty();
                  }}
                  placeholder={`Hi! I'm ${name || 'your AI assistant'}. Ask me anything about ${bundle.workspaceName}.`}
                />
              </Field>
            </div>
          ) : null}
        </Card>

        {/* Right sticky live Playground */}
        <Card className="xl:sticky xl:top-[76px]">
          <CardHeader
            title="Playground"
            sub="Test draft prompt, Knowledge Base scope & claim verification live"
            actions={
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Simulate handoff"
                  leading={<AlertTriangle size={13} />}
                  onClick={() => sendPlayground(undefined, true)}
                >
                  Handoff
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Reset conversation"
                  leading={<RotateCcw size={13} />}
                  onClick={() => setChatLog([])}
                >
                  Reset
                </Button>
              </div>
            }
          />

          <div className="mb-3 grid grid-cols-2 gap-2">
            <Select
              aria-label="Test persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value as typeof persona)}
              options={[
                { value: 'standard', label: 'Persona: Standard' },
                { value: 'vip', label: 'Persona: VIP' },
                { value: 'upset', label: 'Persona: Upset' },
                { value: 'non_english', label: 'Persona: Multilingual' },
              ]}
            />
            <Select
              aria-label="Playground language"
              value={pgLang}
              onChange={(e) => setPgLang(e.target.value as typeof pgLang)}
              options={[
                { value: 'auto', label: 'Lang: Auto-detect' },
                { value: 'en', label: 'Lang: English' },
                { value: 'roman_ur', label: 'Lang: Roman Urdu' },
                { value: 'ur', label: 'Lang: Urdu' },
                { value: 'hi', label: 'Lang: Hindi' },
                { value: 'ar', label: 'Lang: Arabic' },
                { value: 'es', label: 'Lang: Spanish' },
              ]}
            />
          </div>

          <div className="h-[310px] space-y-2.5 overflow-y-auto rounded-[12px] border border-o-border bg-o-bg p-3">
            {chatLog.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Sparkles size={22} className="text-o-ai-text" aria-hidden="true" />
                <div className="mt-2 text-[13px] font-medium text-o-text">Test against real workspace docs</div>
                <p className="mt-1 max-w-[260px] text-[12px] text-o-text-3">
                  Runs your current unsaved instructions through retrieval + claim verification.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {['What are your refund terms?', 'How do I contact support?'].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendPlayground(q)}
                      className="rounded-full border border-o-border bg-o-surface px-2.5 py-1 text-[11.5px] text-o-text-2 hover:border-o-ai hover:text-o-text"
                    >
                      <Play size={10} className="mr-1 inline" />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatLog.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-[10px] p-2.5 text-[12.5px] leading-relaxed ${
                    entry.role === 'user'
                      ? 'ml-6 border border-o-border bg-o-surface text-o-text'
                      : 'mr-4 bg-o-ai-soft/70 text-o-text'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-o-text-3">
                    <span>{entry.role === 'user' ? 'Customer' : name || 'AI Agent'}</span>
                    {entry.meta ? (
                      <span className="o-num">
                        {entry.meta.confidencePct}% conf · {entry.meta.latencyMs}ms
                      </span>
                    ) : null}
                  </div>
                  <div className="whitespace-pre-wrap">{entry.text}</div>

                  {entry.meta?.handoffTriggered ? (
                    <div className="mt-2 rounded-lg bg-o-warn-soft px-2.5 py-1.5 text-[11.5px] font-medium text-o-warn">
                      Handoff triggered: {entry.meta.handoffReason}
                    </div>
                  ) : null}

                  {entry.meta?.citedArticles && entry.meta.citedArticles.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.meta.citedArticles.map((art) => (
                        <Badge key={art.id} tone="neutral">
                          {art.title}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendPlayground();
            }}
          >
            <Input
              aria-label="Test message"
              placeholder="Ask a test question…"
              value={pgInput}
              disabled={pgBusy}
              onChange={(e) => setPgInput(e.target.value)}
            />
            <Button
              type="submit"
              variant="ai"
              size="md"
              loading={pgBusy}
              aria-label="Send test message"
              leading={<Send size={14} />}
            >
              Send
            </Button>
          </form>
        </Card>
      </div>

      {/* Version History Modal */}
      <Modal
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        title="Version history"
        description="Restore any saved draft or published snapshot back into the builder"
      >
        {bundle.versions.length === 0 ? (
          <EmptyState
            title="No saved versions yet"
            body="Save a draft or publish your agent to start tracking snapshots."
          />
        ) : (
          <div className="divide-y divide-o-border">
            {bundle.versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="o-num font-semibold text-o-text">v{v.versionNumber}</span>
                    <Badge tone={v.status === 'published' ? 'ok' : 'neutral'}>{v.status}</Badge>
                    <span className="text-[12px] text-o-text-3">{timeAgo(v.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-o-text-2">
                    {v.summary || 'Snapshot'} {v.createdByName ? `· by ${v.createdByName}` : ''}
                  </div>
                </div>
                {canManage ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={restoringVerId === v.id}
                    onClick={() => handleRestoreVersion(v.id)}
                  >
                    Restore
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
