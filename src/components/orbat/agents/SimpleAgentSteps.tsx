'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Save,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  CardHeader,
  Field,
  Input,
  Textarea,
  Toggle,
} from '@/components/orbat/primitives';
import type {
  AgentAnswerMode,
  AgentChannelConflict,
  AgentEngineType,
  AgentKnowledgeScope,
  AgentRagConfig,
} from '@/lib/data/agents';

const GOAL_PRESETS = [
  {
    id: 'support',
    label: 'Customer Support',
    roleTitle: 'Customer Support Specialist',
    tone: 'Clear, warm, concise',
    goal: 'Answer product and account questions strictly from Help Center docs and escalate when unsure.',
  },
  {
    id: 'sales',
    label: 'Sales & Lead Capture',
    roleTitle: 'AI Sales & Onboarding Specialist',
    tone: 'Warm, consultative, action-oriented',
    goal: 'Qualify inbound buyers, explain pricing plans from docs, and create qualified CRM deals.',
  },
  {
    id: 'billing',
    label: 'Billing & Refunds',
    roleTitle: 'AI Billing & Account Specialist',
    tone: 'Empathetic, transparent, policy-accurate',
    goal: 'Explain billing policies accurately and stage human review tasks for refund or cancellation requests.',
  },
  {
    id: 'tech',
    label: 'Technical Troubleshooting',
    roleTitle: 'AI Technical Support Engineer',
    tone: 'Clear, helpful, step-by-step',
    goal: 'Walk customers through setup, API/webhook troubleshooting steps, and escalate bug reports cleanly.',
  },
];

const SIMPLE_CLARITY_OPTIONS: Array<{
  id: 'strict' | 'balanced' | 'conversational';
  label: string;
  desc: string;
  answerMode: AgentAnswerMode;
  tone: string;
}> = [
  {
    id: 'strict',
    label: 'Strict Docs Only',
    desc: 'Answers strictly from verified docs; hands over immediately if uncovered.',
    answerMode: 'strict',
    tone: 'Precise, factual, conservative',
  },
  {
    id: 'balanced',
    label: 'Balanced (Recommended)',
    desc: 'Grounded in Help Center articles with friendly guidance and follow-up.',
    answerMode: 'agent',
    tone: 'Clear, warm, concise',
  },
  {
    id: 'conversational',
    label: 'Conversational Sales',
    desc: 'Consultative, welcoming style for onboarding and lead qualification.',
    answerMode: 'agent',
    tone: 'Warm, consultative, engaging',
  },
];

const ENGINE_OPTIONS: Array<{
  id: AgentEngineType;
  title: string;
  badge?: string;
  desc: string;
}> = [
  {
    id: 'hybrid',
    title: 'Auto / Hybrid (Recommended)',
    badge: 'Smart Router',
    desc: 'Automatically picks Google ADK for research & CRM lookup or LangGraph for gated approvals.',
  },
  {
    id: 'adk',
    title: 'Google ADK Multi-Agent',
    desc: 'Coordinates Knowledge Researcher, CRM Specialist, and Escalation agents cleanly.',
  },
  {
    id: 'langgraph',
    title: 'LangGraph Stateful Workflows',
    desc: 'Best for pause/resume Trust Ladder human approvals and strict refund workflows.',
  },
  {
    id: 'builtin',
    title: 'Fast Built-in Deterministic',
    desc: 'Lowest latency single-turn Help Center responder for straightforward FAQ deflection.',
  },
];

export function AgentChannelConflictBanner({
  conflicts,
}: {
  conflicts: AgentChannelConflict[];
}) {
  if (conflicts.length === 0) return null;
  return (
    <Alert tone="warn">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle size={14} className="shrink-0" />
          Overlapping live channel catch-all detected
        </div>
        <p className="text-[12px] opacity-90">
          {conflicts.map((c) => `${c.agentName} (${c.sharedChannels.join(', ')})`).join(' · ')} —{' '}
          {conflicts[0]?.reason} Add routing keywords/intents in Advanced mode or pause the overlapping agent to prevent unexpected routing.
        </p>
      </div>
    </Alert>
  );
}

export function AgentAiPromptGeneratorBox({
  canManage,
  goal,
  onGoalChange,
  busy,
  onGenerate,
}: {
  canManage: boolean;
  goal: string;
  onGoalChange: (next: string) => void;
  busy: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="rounded-[12px] border border-o-ai/30 bg-o-ai-soft/35 p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-o-text">
          <Sparkles size={14} className="text-o-ai" />
          AI Prompt Assistant (Describe your agent in 1-2 lines)
        </div>
        <Badge tone="ai">Auto-drafts prompt + guardrails</Badge>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Describe what this agent should handle"
          value={goal}
          disabled={!canManage || busy}
          placeholder="e.g. Handle order tracking & 7-day returns politely; escalate billing disputes to Billing Team."
          onChange={(e) => onGoalChange(e.target.value)}
        />
        <Button
          variant="ai"
          size="md"
          loading={busy}
          disabled={!canManage || !goal.trim() || busy}
          leading={<Sparkles size={14} />}
          onClick={onGenerate}
          className="shrink-0"
        >
          Generate instructions
        </Button>
      </div>
    </div>
  );
}

export function SimpleAgentSteps({
  canManage,
  stepIndex,
  onStepChange,
  name,
  onNameChange,
  roleTitle,
  onRoleTitleChange,
  industry,
  onIndustryChange,
  channels,
  channelOptions,
  onToggleChannel,
  channelConflicts,
  aiGoal,
  onAiGoalChange,
  generatingDraft,
  onGenerateDraft,
  answerMode,
  onAnswerModeChange,
  tone,
  onToneChange,
  systemPrompt,
  onSystemPromptChange,
  knowledgeScope,
  onKnowledgeScopeChange,
  sections,
  botKnowledgeCount,
  engineType,
  onEngineTypeChange,
  ragConfig,
  onRagModeChange,
  hasCustomModel,
  saving,
  onSaveDraft,
  onPublishLive,
  onSwitchToAdvanced,
}: {
  canManage: boolean;
  stepIndex: 1 | 2 | 3;
  onStepChange: (next: 1 | 2 | 3) => void;
  name: string;
  onNameChange: (val: string) => void;
  roleTitle: string;
  onRoleTitleChange: (val: string) => void;
  industry: string;
  onIndustryChange: (val: string) => void;
  channels: string[];
  channelOptions: string[];
  onToggleChannel: (ch: string) => void;
  channelConflicts: AgentChannelConflict[];
  aiGoal: string;
  onAiGoalChange: (val: string) => void;
  generatingDraft: boolean;
  onGenerateDraft: () => void;
  answerMode: AgentAnswerMode;
  onAnswerModeChange: (mode: AgentAnswerMode) => void;
  tone: string;
  onToneChange: (tone: string) => void;
  systemPrompt: string;
  onSystemPromptChange: (val: string) => void;
  knowledgeScope: AgentKnowledgeScope;
  onKnowledgeScopeChange: (updater: (prev: AgentKnowledgeScope) => AgentKnowledgeScope) => void;
  sections: { id: string; name: string; articleCount: number }[];
  botKnowledgeCount: number;
  engineType: AgentEngineType;
  onEngineTypeChange: (next: AgentEngineType) => void;
  ragConfig: AgentRagConfig;
  onRagModeChange: (mode: 'standard' | 'advanced') => void;
  hasCustomModel: boolean;
  saving: 'draft' | 'publish' | null;
  onSaveDraft: () => void;
  onPublishLive: () => void;
  onSwitchToAdvanced: () => void;
}) {
  const [showPromptEditor, setShowPromptEditor] = useState(Boolean(systemPrompt.trim()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Simple 3-step setup">
        {([
          { id: 1 as const, label: '1. Role & Channels' },
          { id: 2 as const, label: '2. Instructions & Knowledge' },
          { id: 3 as const, label: '3. Engine & Go Live' },
        ]).map((item) => {
          const active = stepIndex === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onStepChange(item.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                active
                  ? 'bg-o-accent text-o-surface'
                  : 'border border-o-border bg-o-surface text-o-text-2 hover:bg-o-surface-2'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {stepIndex === 1 ? (
        <div className="space-y-4">
          <CardHeader
            title="1. Role & channels"
            sub="Start with a quick preset or name your assistant and pick where it answers customers"
          />

          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-o-text">Quick goal presets</div>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!canManage}
                  onClick={() => {
                    if (!name.trim()) onNameChange(preset.label);
                    onRoleTitleChange(preset.roleTitle);
                    onToneChange(preset.tone);
                    onAiGoalChange(preset.goal);
                  }}
                  className="rounded-full border border-o-border bg-o-surface-2 px-3 py-1.5 text-[12px] font-medium text-o-text hover:border-o-ai/50 hover:bg-o-ai-soft/40"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Agent name">
              <Input
                value={name}
                disabled={!canManage}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g. Support Concierge"
              />
            </Field>
            <Field label="Role title">
              <Input
                value={roleTitle}
                disabled={!canManage}
                onChange={(e) => onRoleTitleChange(e.target.value)}
                placeholder="e.g. Order & billing specialist"
              />
            </Field>
          </div>

          <Field label="Industry focus (optional)">
            <Input
              value={industry}
              disabled={!canManage}
              onChange={(e) => onIndustryChange(e.target.value)}
              placeholder="e.g. SaaS, E-commerce, Fintech"
            />
          </Field>

          <div>
            <div className="mb-2 text-[13px] font-medium text-o-text">Channels this agent covers</div>
            <div className="flex flex-wrap gap-2">
              {channelOptions.map((ch) => {
                const checked = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    disabled={!canManage}
                    aria-pressed={checked}
                    onClick={() => onToggleChannel(ch)}
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

          <div className="flex justify-end border-t border-o-border pt-3">
            <Button
              variant="primary"
              size="md"
              trailing={<ArrowRight size={14} />}
              onClick={() => onStepChange(2)}
            >
              Next: Instructions &amp; Knowledge
            </Button>
          </div>
        </div>
      ) : null}

      {stepIndex === 2 ? (
        <div className="space-y-4">
          <CardHeader
            title="2. Instructions & knowledge"
            sub="Let AI draft your agent instructions in seconds and pick its Knowledge Base sources"
            actions={
              <ButtonLink href="/app/knowledge" variant="ghost" size="sm" leading={<BookOpen size={14} />}>
                Knowledge Base
              </ButtonLink>
            }
          />

          <AgentAiPromptGeneratorBox
            canManage={canManage}
            goal={aiGoal}
            onGoalChange={onAiGoalChange}
            busy={generatingDraft}
            onGenerate={onGenerateDraft}
          />

          <div>
            <div className="mb-2 text-[13px] font-medium text-o-text">Response clarity style</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SIMPLE_CLARITY_OPTIONS.map((opt) => {
                const selected = answerMode === opt.answerMode && tone.toLowerCase().includes(opt.tone.split(',')[0].toLowerCase());
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!canManage}
                    onClick={() => {
                      onAnswerModeChange(opt.answerMode);
                      onToneChange(opt.tone);
                    }}
                    className={`rounded-[12px] border p-3 text-left transition-colors ${
                      selected
                        ? 'border-o-ai bg-o-ai-soft/60 text-o-text'
                        : 'border-o-border bg-o-surface-2/60 text-o-text-2 hover:bg-o-surface-2'
                    }`}
                  >
                    <div className="text-[12.5px] font-semibold text-o-text">{opt.label}</div>
                    <div className="mt-0.5 text-[11.5px] text-o-text-3">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 rounded-[12px] border border-o-border bg-o-surface-2/60 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-o-text">
                System prompt {systemPrompt.trim() ? `(${systemPrompt.trim().length} chars)` : '(optional)'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPromptEditor((prev) => !prev)}
              >
                {showPromptEditor ? 'Hide editor' : 'Edit prompt'}
              </Button>
            </div>
            {showPromptEditor ? (
              <Textarea
                rows={5}
                value={systemPrompt}
                disabled={!canManage}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                placeholder="Write instructions for how this assistant should answer and escalate..."
              />
            ) : null}
          </div>

          <Toggle
            label="Search all published Help Center collections"
            description="Automatically stays synced when new articles are published."
            checked={knowledgeScope.allArticles}
            disabled={!canManage}
            onChange={(checked) => onKnowledgeScopeChange((prev) => ({ ...prev, allArticles: checked }))}
          />

          {!knowledgeScope.allArticles && sections.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-[12px] border border-o-border bg-o-surface-2 p-3">
              {sections.map((sec) => {
                const checked = knowledgeScope.sectionIds.includes(sec.id);
                return (
                  <label
                    key={sec.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-o-border bg-o-surface px-3 py-2 text-[12.5px]"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canManage}
                        onChange={(e) => {
                          const on = e.target.checked;
                          onKnowledgeScopeChange((prev) => ({
                            ...prev,
                            sectionIds: on
                              ? [...prev.sectionIds, sec.id]
                              : prev.sectionIds.filter((x) => x !== sec.id),
                          }));
                        }}
                      />
                      <span className="font-medium text-o-text">{sec.name}</span>
                    </span>
                    <span className="o-num text-[11px] text-o-text-3">{sec.articleCount}</span>
                  </label>
                );
              })}
            </div>
          ) : null}

          <Toggle
            label="Include internal Bot Knowledge & approved Q&As"
            description={`${botKnowledgeCount} workspace internal Q&A entry(ies) available.`}
            checked={knowledgeScope.includeBotKnowledge}
            disabled={!canManage}
            onChange={(checked) =>
              onKnowledgeScopeChange((prev) => ({ ...prev, includeBotKnowledge: checked }))
            }
          />

          <div className="flex items-center justify-between border-t border-o-border pt-3">
            <Button variant="ghost" size="md" onClick={() => onStepChange(1)}>
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              trailing={<ArrowRight size={14} />}
              onClick={() => onStepChange(3)}
            >
              Next: Engine &amp; Go Live
            </Button>
          </div>
        </div>
      ) : null}

      {stepIndex === 3 ? (
        <div className="space-y-4">
          <CardHeader
            title="3. Runtime engine & publish"
            sub="Choose how the agent executes multi-step reasoning and retrieval accuracy"
            actions={
              <Badge tone={hasCustomModel ? 'ai' : 'neutral'}>
                {hasCustomModel ? 'Custom Model Override' : 'Inherited Workspace Model'}
              </Badge>
            }
          />

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {ENGINE_OPTIONS.map((eng) => {
              const selected = engineType === eng.id;
              return (
                <button
                  key={eng.id}
                  type="button"
                  disabled={!canManage}
                  onClick={() => onEngineTypeChange(eng.id)}
                  className={`rounded-[12px] border p-3.5 text-left transition-colors ${
                    selected
                      ? 'border-o-ai bg-o-ai-soft/60 text-o-text'
                      : 'border-o-border bg-o-surface-2/60 text-o-text-2 hover:bg-o-surface-2'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-o-text">{eng.title}</span>
                    {eng.badge ? <Badge tone="ai">{eng.badge}</Badge> : null}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-o-text-3">{eng.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-[12px] border border-o-border bg-o-surface-2/60 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[12.5px] font-semibold text-o-text">Retrieval pipeline mode</div>
                <div className="text-[11.5px] text-o-text-3">
                  Advanced RAG enables AI reranking, HyDE expansion, and neighboring chunk stitching.
                </div>
              </div>
              <Badge tone={ragConfig.mode === 'advanced' ? 'ai' : 'neutral'}>
                {ragConfig.mode === 'advanced' ? 'Advanced RAG' : 'Standard RAG'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['standard', 'advanced'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!canManage}
                  onClick={() => onRagModeChange(m)}
                  className={`rounded-[10px] border px-3 py-2 text-left text-[12px] font-medium transition-colors ${
                    ragConfig.mode === m
                      ? 'border-o-ai bg-o-ai-soft/60 text-o-text'
                      : 'border-o-border bg-o-surface text-o-text-2 hover:bg-o-bg'
                  }`}
                >
                  {m === 'standard' ? 'Standard RAG (Fast)' : 'Advanced RAG (High Accuracy)'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-o-border bg-o-surface-2/40 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-[12px] text-o-text-2">
              <ShieldCheck size={14} className="text-o-ai" />
              Need per-tool permissions, blocked topics, temperature, or routing keys?
            </div>
            <Button variant="ghost" size="sm" leading={<Wrench size={13} />} onClick={onSwitchToAdvanced}>
              Switch to Advanced Mode
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-o-border pt-3">
            <Button variant="ghost" size="md" onClick={() => onStepChange(2)}>
              Back
            </Button>
            {canManage ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  loading={saving === 'draft'}
                  disabled={saving !== null}
                  leading={<Save size={14} />}
                  onClick={onSaveDraft}
                >
                  Save draft
                </Button>
                <Button
                  variant="ai"
                  size="md"
                  loading={saving === 'publish'}
                  disabled={saving !== null}
                  leading={<Sparkles size={14} />}
                  onClick={onPublishLive}
                >
                  Publish live
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
