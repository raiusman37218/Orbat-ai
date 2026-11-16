'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Check,
  History,
  Plus,
  Save,
  Sparkles,
  Wrench,
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
  DEFAULT_AGENT_MODEL_CONFIG,
  type AgentEngineConfig,
  type AgentEngineType,
  type AgentModelConfig,
} from '@/lib/ai/agent-templates';
import { DEFAULT_MODELS } from '@/lib/ai/models';
import {
  DEFAULT_AGENT_ENGINE_CONFIG,
  UNIFIED_TOOL_OPTION_DEFS,
  detectAgentChannelConflicts,
  generateAgentPromptDraft,
  getAgentBuilder,
  isToolAllowedInConfig,
  normalizeAgentRagConfig,
  normalizeEngineType,
  restoreAgentVersion,
  runAgentEvalSuite,
  runAgentPlayground,
  saveAgentDraft,
  type AgentAnswerMode,
  type AgentBuilderBundle,
  type AgentCapabilities,
  type AgentEscalationRules,
  type AgentEvalCase,
  type AgentEvalSuiteResult,
  type AgentKnowledgeScope,
  type AgentRagConfig,
  type AgentReplyLanguageMode,
  type PlaygroundTurn,
} from '@/lib/data/agents';
import { useData } from '@/lib/data/use-data';
import {
  BuilderPlaygroundPanel,
  type BuilderChatLogEntry,
} from './BuilderPlaygroundPanel';
import {
  AgentAiPromptGeneratorBox,
  AgentChannelConflictBanner,
  SimpleAgentSteps,
} from './SimpleAgentSteps';

function toggleAllowedToolList(
  currentAllowed: string[] | undefined,
  toolId: string,
  nextChecked: boolean,
): string[] {
  const allIds = UNIFIED_TOOL_OPTION_DEFS.map((t) => t.id);
  const effectiveSet = new Set(
    !Array.isArray(currentAllowed) || currentAllowed.length === 0 ? allIds : currentAllowed,
  );
  if (nextChecked) {
    effectiveSet.add(toolId);
  } else {
    effectiveSet.delete(toolId);
  }
  const normalized = allIds.filter((id) => effectiveSet.has(id));
  // Empty array signifies "all tools enabled (default)".
  return normalized.length === allIds.length ? [] : normalized;
}

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
  const [ragConfig, setRagConfig] = useState<AgentRagConfig>(() => normalizeAgentRagConfig(a.rag_config));
  const [capabilities, setCapabilities] = useState<AgentCapabilities>(a.capabilities);
  const [newActionInput, setNewActionInput] = useState('');
  const [escalationRules, setEscalationRules] = useState<AgentEscalationRules>(a.escalation_rules);
  const [newBlockedTopic, setNewBlockedTopic] = useState('');
  const [badgeLabel, setBadgeLabel] = useState(a.appearance.badgeLabel);
  const [showCitations, setShowCitations] = useState(a.appearance.showCitations);
  const [welcomeMessage, setWelcomeMessage] = useState(a.appearance.welcomeMessage);
  const [engineType, setEngineType] = useState<AgentEngineType>(() =>
    normalizeEngineType(a.engine_type),
  );
  const [engineConfig, setEngineConfig] = useState<AgentEngineConfig>(() => ({
    ...DEFAULT_AGENT_ENGINE_CONFIG,
    ...(a.engine_config || {}),
  }));
  const [modelConfig, setModelConfig] = useState<AgentModelConfig>(() => ({
    ...DEFAULT_AGENT_MODEL_CONFIG,
    ...(a.model_config || {}),
  }));
  const [dirty, setDirty] = useState(false);
  const [builderMode, setBuilderMode] = useState<'simple' | 'advanced'>(() =>
    bundle.isNew ? 'simple' : 'advanced',
  );
  const [simpleStep, setSimpleStep] = useState<1 | 2 | 3>(1);
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);
  const [aiGoal, setAiGoal] = useState(a.description || '');
  const [generatingDraft, setGeneratingDraft] = useState(false);

  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [restoringVerId, setRestoringVerId] = useState<string | null>(null);

  // Playground & Eval state
  const [persona, setPersona] = useState<'standard' | 'vip' | 'upset' | 'non_english'>('standard');
  const [pgLang, setPgLang] = useState<'auto' | 'en' | 'roman_ur' | 'ur' | 'hi' | 'ar' | 'es'>('auto');
  const [pgInput, setPgInput] = useState('');
  const [pgBusy, setPgBusy] = useState(false);
  const [chatLog, setChatLog] = useState<BuilderChatLogEntry[]>([]);
  const [evalBusy, setEvalBusy] = useState(false);
  const [evalResult, setEvalResult] = useState<AgentEvalSuiteResult | null>(null);

  const markDirty = () => setDirty(true);

  useEffect(() => {
    if (!dirty || saving !== null) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty, saving]);

  const navigateWithGuard = (href: string) => {
    if (dirty && saving === null) {
      setPendingNavHref(href);
      return;
    }
    router.push(href);
  };

  const channelConflicts = useMemo(
    () =>
      detectAgentChannelConflicts({
        currentAgentId: bundle.isNew ? 'new' : bundle.agent.id,
        currentStatus: bundle.isNew ? 'live' : bundle.agent.status,
        currentChannels: channels,
        currentRoutingRules: bundle.agent.routing_rules,
        allAgents: bundle.allAgents,
      }),
    [bundle.agent.id, bundle.agent.routing_rules, bundle.agent.status, bundle.allAgents, bundle.isNew, channels],
  );

  const hasCustomModelOverride = Boolean(modelConfig.provider || modelConfig.model);

  const handleGenerateDraft = async () => {
    setGeneratingDraft(true);
    try {
      const res = await generateAgentPromptDraft(workspaceId, {
        goal: aiGoal,
        agentName: name || null,
        industry: industry || null,
        channels,
      });
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return;
      }
      setRoleTitle(res.draft.roleTitle);
      setDescription(res.draft.description);
      setTone(res.draft.tone);
      setAnswerMode(res.draft.answerMode);
      setSystemPrompt(res.draft.systemPrompt);
      setGuardrails(res.draft.guardrails);
      markDirty();
      toast.show({
        tone: 'ok',
        message: res.usedModel
          ? 'AI drafted instructions & compliance guardrails.'
          : 'Generated smart baseline instructions & guardrails.',
      });
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleRunEvalSuite = async () => {
    const cases: AgentEvalCase[] = engineConfig.evalCases || [];
    if (cases.length === 0) return;
    setEvalBusy(true);
    try {
      const res = await runAgentEvalSuite(workspaceId, {
        agentId: !bundle.isNew ? bundle.agent.id : null,
        agentName: name || 'Support Assistant',
        industry: industry || null,
        tone,
        systemPrompt,
        guardrails,
        escalationRules,
        knowledgeScope,
        answerMode,
        replyLanguageMode,
        ragConfig,
        engineType,
        engineConfig,
        modelConfig,
        cases,
      });
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return;
      }
      setEvalResult(res.suite);
      toast.show({
        tone: res.suite.passRatePct >= 75 ? 'ok' : 'info',
        message: `Eval completed: ${res.suite.passCount}/${res.suite.totalCount} passed (${res.suite.passRatePct}%).`,
      });
    } finally {
      setEvalBusy(false);
    }
  };

  const persistAgent = async (
    publishNow: boolean,
    bundleData: AgentBuilderBundle,
    redirectOverride?: string | null,
  ): Promise<boolean> => {
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
        engineType,
        engineConfig,
        ragConfig: { ...ragConfig, citations: showCitations },
        modelConfig,
        routingRules: a.routing_rules,
        isPrimary: bundleData.agent.is_primary,
        publishNow,
      });

      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return false;
      }

      setDirty(false);
      toast.show({
        tone: 'ok',
        message: publishNow
          ? `${res.agent.name} published live (v${res.agent.published_version}).`
          : `Saved draft changes for ${res.agent.name}.`,
      });

      if (redirectOverride) {
        router.push(redirectOverride);
      } else if (bundleData.isNew) {
        router.replace(`/app/agents/${res.agent.id}`);
      } else {
        onReload();
      }
      return true;
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
        industry: industry || null,
        tone,
        systemPrompt,
        guardrails,
        escalationRules,
        knowledgeScope,
        answerMode,
        replyLanguageMode,
        ragConfig: { ...ragConfig, citations: showCitations },
        engineType,
        engineConfig,
        modelConfig,
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
          <Button
            variant="ghost"
            size="sm"
            leading={<ArrowLeft size={14} />}
            onClick={() => navigateWithGuard('/app/agents')}
          >
            Agents
          </Button>

          <Select
            aria-label="Switch AI agent"
            value={bundle.isNew ? 'new' : bundle.agent.id}
            onChange={(e) => {
              const target = e.target.value;
              navigateWithGuard(target === 'new' ? '/app/agents/new' : `/app/agents/${target}`);
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
          <div
            className="inline-flex rounded-full border border-o-border bg-o-surface-2 p-0.5"
            role="group"
            aria-label="Builder complexity mode"
          >
            <button
              type="button"
              onClick={() => setBuilderMode('simple')}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                builderMode === 'simple'
                  ? 'bg-o-surface text-o-text shadow-sm'
                  : 'text-o-text-3 hover:text-o-text'
              }`}
            >
              Simple (3 steps)
            </button>
            <button
              type="button"
              onClick={() => setBuilderMode('advanced')}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                builderMode === 'advanced'
                  ? 'bg-o-surface text-o-text shadow-sm'
                  : 'text-o-text-3 hover:text-o-text'
              }`}
            >
              <Wrench size={11} />
              Advanced
            </button>
          </div>

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

      {builderMode === 'advanced' ? (
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
      ) : null}

      {/* Main Builder + Sticky Playground */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <Card size="lg">
          {builderMode === 'simple' ? (
            <SimpleAgentSteps
              canManage={canManage}
              stepIndex={simpleStep}
              onStepChange={setSimpleStep}
              name={name}
              onNameChange={(val) => {
                setName(val);
                markDirty();
              }}
              roleTitle={roleTitle}
              onRoleTitleChange={(val) => {
                setRoleTitle(val);
                markDirty();
              }}
              industry={industry}
              onIndustryChange={(val) => {
                setIndustry(val);
                markDirty();
              }}
              channels={channels}
              channelOptions={CHANNEL_OPTIONS}
              onToggleChannel={(ch) => {
                setChannels((prev) =>
                  prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
                );
                markDirty();
              }}
              channelConflicts={channelConflicts}
              aiGoal={aiGoal}
              onAiGoalChange={setAiGoal}
              generatingDraft={generatingDraft}
              onGenerateDraft={handleGenerateDraft}
              answerMode={answerMode}
              onAnswerModeChange={(mode) => {
                setAnswerMode(mode);
                markDirty();
              }}
              tone={tone}
              onToneChange={(nextTone) => {
                setTone(nextTone);
                markDirty();
              }}
              systemPrompt={systemPrompt}
              onSystemPromptChange={(val) => {
                setSystemPrompt(val);
                markDirty();
              }}
              knowledgeScope={knowledgeScope}
              onKnowledgeScopeChange={(updater) => {
                setKnowledgeScope(updater);
                markDirty();
              }}
              sections={bundle.sections}
              botKnowledgeCount={bundle.botKnowledgeCount}
              engineType={engineType}
              onEngineTypeChange={(next) => {
                setEngineType(next);
                markDirty();
              }}
              ragConfig={ragConfig}
              onRagModeChange={(mode) => {
                setRagConfig((prev) => ({ ...prev, mode }));
                markDirty();
              }}
              hasCustomModel={hasCustomModelOverride}
              saving={saving}
              onSaveDraft={() => {
                void persistAgent(false, bundle);
              }}
              onPublishLive={() => {
                void persistAgent(true, bundle);
              }}
              onSwitchToAdvanced={() => setBuilderMode('advanced')}
            />
          ) : (
            <>
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
              <AgentChannelConflictBanner conflicts={channelConflicts} />
            </div>
          ) : null}

          {step === 'instructions' ? (
            <div className="space-y-4">
              <CardHeader
                title="Behavior & guardrails"
                sub="Applied directly to every live customer response generated in Autopilot"
              />
              <AgentAiPromptGeneratorBox
                canManage={canManage}
                goal={aiGoal}
                onGoalChange={setAiGoal}
                busy={generatingDraft}
                onGenerate={handleGenerateDraft}
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

              <div className="rounded-[12px] border border-o-border bg-o-surface-2 p-3.5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[12.5px] font-semibold text-o-text">
                      RAG engine &amp; retrieval pipeline
                    </div>
                    <p className="text-[11.5px] text-o-text-3">
                      Switch between fast Standard pgvector RAG and high-accuracy Advanced RAG with reranking, HyDE, adjacent context, and corrective fallback.
                    </p>
                  </div>
                  <Badge tone={ragConfig.mode === 'advanced' ? 'ai' : 'neutral'}>
                    {ragConfig.mode === 'advanced' ? 'Advanced RAG' : 'Standard RAG'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    {
                      id: 'standard' as const,
                      title: 'Standard RAG (Fast)',
                      sub: 'Hybrid pgvector + FTS + RRF query expansion',
                    },
                    {
                      id: 'advanced' as const,
                      title: 'Advanced RAG (High Accuracy)',
                      sub: 'HyDE + AI reranker + parent chunks + corrective gate',
                    },
                  ]).map((opt) => {
                    const active = ragConfig.mode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!canManage}
                        onClick={() => {
                          setRagConfig((prev) => ({
                            ...prev,
                            mode: opt.id,
                            topK: opt.id === 'advanced' && prev.topK < 8 ? 8 : prev.topK,
                            rerank: opt.id === 'advanced',
                            hyde: opt.id === 'advanced',
                            parentChild: opt.id === 'advanced',
                            correctiveFallback: opt.id === 'advanced',
                          }));
                          markDirty();
                        }}
                        className={`rounded-[10px] border p-2.5 text-left transition-colors ${
                          active
                            ? 'border-o-ai bg-o-ai-soft/60 text-o-text'
                            : 'border-o-border bg-o-surface text-o-text-2 hover:bg-o-bg'
                        }`}
                      >
                        <div className="text-[12.5px] font-semibold">{opt.title}</div>
                        <div className="text-[11px] text-o-text-3">{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Top-K chunks">
                    <Select
                      id="agent-rag-topk"
                      value={String(ragConfig.topK)}
                      disabled={!canManage}
                      onChange={(e) => {
                        setRagConfig((prev) => ({ ...prev, topK: Number(e.target.value) || 6 }));
                        markDirty();
                      }}
                      options={[
                        { value: '3', label: '3 chunks (Focused)' },
                        { value: '5', label: '5 chunks (Concise)' },
                        { value: '6', label: '6 chunks (Balanced)' },
                        { value: '8', label: '8 chunks (Broad)' },
                        { value: '12', label: '12 chunks (Comprehensive)' },
                      ]}
                    />
                  </Field>
                  <Field label="Min similarity threshold">
                    <Select
                      id="agent-rag-minscore"
                      value={String(ragConfig.minScore)}
                      disabled={!canManage}
                      onChange={(e) => {
                        setRagConfig((prev) => ({
                          ...prev,
                          minScore: Number(e.target.value) || 0.25,
                        }));
                        markDirty();
                      }}
                      options={[
                        { value: '0.25', label: '0.25 (Default recall)' },
                        { value: '0.35', label: '0.35 (Moderate)' },
                        { value: '0.45', label: '0.45 (Strict)' },
                        { value: '0.55', label: '0.55 (High precision)' },
                      ]}
                    />
                  </Field>
                </div>

                <div className="space-y-2 border-t border-o-border pt-3">
                  <Toggle
                    label="AI relevance reranker"
                    description="Retrieves a wider candidate pool (15+) and scores each chunk directly against the question."
                    checked={typeof ragConfig.rerank === 'boolean' ? ragConfig.rerank : ragConfig.mode === 'advanced'}
                    disabled={!canManage}
                    onChange={(checked) => {
                      setRagConfig((prev) => ({ ...prev, rerank: checked }));
                      markDirty();
                    }}
                  />
                  <Toggle
                    label="HyDE hypothetical query expansion"
                    description="Drafts a neutral synthetic Help Center passage to bridge vocabulary gaps before vector search."
                    checked={typeof ragConfig.hyde === 'boolean' ? ragConfig.hyde : ragConfig.mode === 'advanced'}
                    disabled={!canManage}
                    onChange={(checked) => {
                      setRagConfig((prev) => ({ ...prev, hyde: checked }));
                      markDirty();
                    }}
                  />
                  <Toggle
                    label="Adjacent-chunk context (Parent expansion)"
                    description="Stitches neighboring chunks (chunk ± 1) from matched articles so policies and tables never get cut mid-way."
                    checked={typeof ragConfig.parentChild === 'boolean' ? ragConfig.parentChild : ragConfig.mode === 'advanced'}
                    disabled={!canManage}
                    onChange={(checked) => {
                      setRagConfig((prev) => ({ ...prev, parentChild: checked }));
                      markDirty();
                    }}
                  />
                  <Toggle
                    label="Corrective RAG gate"
                    description="Retries with normalized keyword extraction if initial candidates fall below the sensitivity floor."
                    checked={
                      typeof ragConfig.correctiveFallback === 'boolean'
                        ? ragConfig.correctiveFallback
                        : ragConfig.mode === 'advanced'
                    }
                    disabled={!canManage}
                    onChange={(checked) => {
                      setRagConfig((prev) => ({ ...prev, correctiveFallback: checked }));
                      markDirty();
                    }}
                  />
                  <Toggle
                    label="Include Help Center source citations"
                    description="Appends clickable cited Help Center articles to verified answers."
                    checked={showCitations}
                    disabled={!canManage}
                    onChange={(checked) => {
                      setShowCitations(checked);
                      setRagConfig((prev) => ({ ...prev, citations: checked }));
                      markDirty();
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === 'capabilities' ? (
            <div className="space-y-5">
              <CardHeader
                title="Orchestration engine, AI model & capabilities"
                sub="Choose the built-in runtime engine (Google ADK, LangGraph, Hybrid, or Fast Built-in), optional per-agent model override, and skills"
                actions={
                  <Badge tone={hasCustomModelOverride ? 'ai' : 'neutral'}>
                    {hasCustomModelOverride ? 'Custom Override' : 'Inherited Workspace Default'}
                  </Badge>
                }
              />

              <div className="rounded-[12px] border border-o-border bg-o-surface-2 p-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Agent execution engine"
                    hint="Hybrid auto-routes stateful approvals to LangGraph and multi-domain queries to Google ADK."
                  >
                    <Select
                      disabled={!canManage}
                      value={engineType}
                      onChange={(e) => {
                        setEngineType(normalizeEngineType(e.target.value));
                        markDirty();
                      }}
                    >
                      <option value="hybrid">Auto / Hybrid (Recommended)</option>
                      <option value="langgraph">LangGraph Workflows & Approvals</option>
                      <option value="adk">Google ADK Multi-Agent Coordinator</option>
                      <option value="builtin">Fast Built-in Deterministic</option>
                    </Select>
                  </Field>

                  <Field
                    label="Failover engine"
                    hint="Backup runtime if the primary engine times out or encounters an error."
                  >
                    <Select
                      disabled={!canManage}
                      value={engineConfig.fallbackEngine || 'builtin'}
                      onChange={(e) => {
                        setEngineConfig((prev) => ({
                          ...prev,
                          fallbackEngine: normalizeEngineType(e.target.value),
                        }));
                        markDirty();
                      }}
                    >
                      <option value="builtin">Fast Built-in (Safest)</option>
                      <option value="langgraph">LangGraph</option>
                      <option value="adk">Google ADK</option>
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-o-border pt-4">
                  <Field
                    label="Per-agent model provider"
                    hint="Override the workspace default or inherit platform AI settings."
                  >
                    <Select
                      disabled={!canManage}
                      value={modelConfig.provider || ''}
                      onChange={(e) => {
                        const nextProv = e.target.value || null;
                        setModelConfig((prev) => ({
                          ...prev,
                          provider: nextProv,
                          model:
                            nextProv && !prev.model
                              ? DEFAULT_MODELS[nextProv as keyof typeof DEFAULT_MODELS] || null
                              : nextProv
                                ? prev.model
                                : null,
                        }));
                        markDirty();
                      }}
                    >
                      <option value="">Inherit platform default</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="google">Google (Gemini)</option>
                      <option value="openai">OpenAI (GPT)</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="compatible">OpenAI-compatible</option>
                    </Select>
                  </Field>

                  <Field
                    label="Model ID"
                    hint="Exact model identifier for this agent (optional)."
                  >
                    <Input
                      disabled={!canManage}
                      value={modelConfig.model || ''}
                      placeholder={
                        modelConfig.provider &&
                        modelConfig.provider in DEFAULT_MODELS
                          ? DEFAULT_MODELS[modelConfig.provider as keyof typeof DEFAULT_MODELS] ||
                            'Default model'
                          : 'Inherit platform default'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setModelConfig((prev) => ({
                          ...prev,
                          model: val.trim() ? val : null,
                        }));
                        markDirty();
                      }}
                    />
                  </Field>

                  <Field
                    label={`Temperature (${typeof modelConfig.temperature === 'number' ? modelConfig.temperature.toFixed(1) : '0.3'})`}
                    hint="Lower keeps answers closer to docs; higher allows freer phrasing."
                  >
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      disabled={!canManage}
                      value={typeof modelConfig.temperature === 'number' ? modelConfig.temperature : 0.3}
                      onChange={(e) => {
                        setModelConfig((prev) => ({
                          ...prev,
                          temperature: Number(e.target.value),
                        }));
                        markDirty();
                      }}
                      className="mt-2 w-full accent-o-accent"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-o-border pt-4">
                  <Field
                    label="Workflow / routing key (optional)"
                    hint="Pin Hybrid routing hint or external orchestrator key (e.g. refund_v2, adk_vip)."
                  >
                    <Input
                      disabled={!canManage}
                      value={engineConfig.workflowKey || ''}
                      placeholder="Optional workflow key"
                      onChange={(e) => {
                        setEngineConfig((prev) => ({
                          ...prev,
                          workflowKey: e.target.value || null,
                        }));
                        markDirty();
                      }}
                    />
                  </Field>

                  <Field
                    label="External webhook URL override (optional)"
                    hint="Optional HTTPS endpoint for bringing your own external LangGraph/ADK server."
                  >
                    <Input
                      disabled={!canManage}
                      value={engineConfig.externalWebhookUrl || ''}
                      placeholder="https://your-agent.example.com/respond"
                      onChange={(e) => {
                        setEngineConfig((prev) => ({
                          ...prev,
                          externalWebhookUrl: e.target.value || null,
                        }));
                        markDirty();
                      }}
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-[12px] border border-o-border bg-o-surface-2 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-semibold text-o-text">Tool &amp; CRM permissions</div>
                    <p className="text-[12px] text-o-text-3">
                      Select which built-in workspace tools this agent may call in LangGraph and Google ADK.
                    </p>
                  </div>
                  <Badge tone={!engineConfig.allowedTools?.length ? 'ok' : 'ai'}>
                    {!engineConfig.allowedTools?.length
                      ? 'All built-in tools enabled'
                      : `${engineConfig.allowedTools.length} custom tools selected`}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {UNIFIED_TOOL_OPTION_DEFS.map((tool) => {
                    const checked = isToolAllowedInConfig(engineConfig.allowedTools, tool.id);
                    const locked = Boolean(tool.alwaysEnabled);
                    return (
                      <label
                        key={tool.id}
                        className={`flex items-start gap-2.5 rounded-[10px] border p-2.5 text-[12.5px] transition-colors ${
                          checked
                            ? 'border-o-ai/30 bg-o-surface'
                            : 'border-o-border bg-o-surface-2 opacity-75'
                        } ${locked || !canManage ? 'cursor-default' : 'cursor-pointer hover:border-o-ai/50'}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded accent-o-accent"
                          checked={checked}
                          disabled={!canManage || locked}
                          onChange={(e) => {
                            const nextTools = toggleAllowedToolList(
                              engineConfig.allowedTools,
                              tool.id,
                              e.target.checked,
                            );
                            setEngineConfig((prev) => ({
                              ...prev,
                              allowedTools: nextTools,
                            }));
                            markDirty();
                          }}
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5 font-medium text-o-text">
                            {tool.label}
                            {locked ? <Badge tone="neutral">Required</Badge> : null}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] text-o-text-3">
                            {tool.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Alert>
                <strong className="font-semibold">Built-in tools & external webhooks:</strong> Every agent automatically has scoped access to Knowledge Base search, Customer 360 lookup, CRM Deal & Task staging, and Human Approval gates inside this workspace.
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
            </>
          )}
        </Card>

        {/* Right sticky live Playground + X-Ray + Eval Suite */}
        <BuilderPlaygroundPanel
          canManage={canManage}
          busy={pgBusy}
          persona={persona}
          onPersonaChange={setPersona}
          language={pgLang}
          onLanguageChange={setPgLang}
          inputText={pgInput}
          onInputTextChange={setPgInput}
          onSend={sendPlayground}
          onClear={() => setChatLog([])}
          chatLog={chatLog}
          evalCases={engineConfig.evalCases || []}
          onEvalCasesChange={(nextCases) => {
            setEngineConfig((prev) => ({ ...prev, evalCases: nextCases }));
            markDirty();
          }}
          evalBusy={evalBusy}
          evalResult={evalResult}
          onRunEval={handleRunEvalSuite}
        />
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

      {/* Unsaved Changes Confirmation Modal */}
      <Modal
        open={pendingNavHref !== null}
        onClose={() => setPendingNavHref(null)}
        title="Unsaved agent changes"
        description="Save your configuration as a draft before switching pages, or discard your unsaved edits."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setPendingNavHref(null)}>
              Keep editing
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                const target = pendingNavHref;
                setPendingNavHref(null);
                setDirty(false);
                if (target) router.push(target);
              }}
            >
              Discard changes &amp; leave
            </Button>
            {canManage ? (
              <Button
                variant="ai"
                size="md"
                loading={saving === 'draft'}
                disabled={saving !== null}
                leading={<Save size={14} />}
                onClick={async () => {
                  const target = pendingNavHref;
                  const ok = await persistAgent(false, bundle, target);
                  if (ok) setPendingNavHref(null);
                }}
              >
                Save draft &amp; leave
              </Button>
            ) : null}
          </>
        }
      >
        <p className="text-[13px] text-o-text-2">
          Your unsaved changes to instructions, channel routing, tools, or eval cases will be lost if you navigate away without saving.
        </p>
      </Modal>
    </PageContainer>
  );
}
