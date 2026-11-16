'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileWarning,
  Play,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Select,
  Tabs,
  type BadgeTone,
} from '@/components/orbat/primitives';
import type {
  AgentEvalCase,
  AgentEvalSuiteResult,
  PlaygroundResult,
} from '@/lib/data/agents';

export interface BuilderChatLogEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  meta?: PlaygroundResult;
}

type PlaygroundTab = 'chat' | 'xray' | 'eval';

const STARTER_EVAL_QUESTIONS: Omit<AgentEvalCase, 'id'>[] = [
  { question: 'What is included in your main plans or pricing?', expectHandoff: false },
  { question: 'How does your refund or cancellation policy work?', expectHandoff: false },
  { question: 'Please connect me directly to a human specialist right now.', expectHandoff: true },
];

function verdictTone(verdict: PlaygroundResult['verificationVerdict']): BadgeTone {
  if (verdict === 'supported') return 'ok';
  if (verdict === 'blocked_human') return 'bad';
  return 'warn';
}

function fixInKbHref(question: string): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  const title = clean.slice(0, 80);
  return `/app/knowledge?fixTitle=${encodeURIComponent(title)}&fixQuestion=${encodeURIComponent(clean)}`;
}

export function BuilderPlaygroundPanel({
  canManage,
  busy,
  persona,
  onPersonaChange,
  language,
  onLanguageChange,
  inputText,
  onInputTextChange,
  onSend,
  onClear,
  chatLog,
  evalCases,
  onEvalCasesChange,
  evalBusy,
  evalResult,
  onRunEval,
}: {
  canManage: boolean;
  busy: boolean;
  persona: 'standard' | 'vip' | 'upset' | 'non_english';
  onPersonaChange: (next: 'standard' | 'vip' | 'upset' | 'non_english') => void;
  language: 'auto' | 'en' | 'roman_ur' | 'ur' | 'hi' | 'ar' | 'es';
  onLanguageChange: (next: 'auto' | 'en' | 'roman_ur' | 'ur' | 'hi' | 'ar' | 'es') => void;
  inputText: string;
  onInputTextChange: (next: string) => void;
  onSend: (textOverride?: string, simulateHandoff?: boolean) => void;
  onClear: () => void;
  chatLog: BuilderChatLogEntry[];
  evalCases: AgentEvalCase[];
  onEvalCasesChange: (next: AgentEvalCase[]) => void;
  evalBusy: boolean;
  evalResult: AgentEvalSuiteResult | null;
  onRunEval: () => void;
}) {
  const [pgTab, setPgTab] = useState<PlaygroundTab>('chat');
  const [inspectedTurnId, setInspectedTurnId] = useState<string | null>(null);
  const [newEvalQuestion, setNewEvalQuestion] = useState('');
  const [newEvalExpectHandoff, setNewEvalExpectHandoff] = useState(false);

  const assistantTurns = useMemo(
    () =>
      chatLog
        .map((entry, idx) => {
          if (entry.role !== 'assistant' || !entry.meta) return null;
          const prevUser = idx > 0 && chatLog[idx - 1]?.role === 'user' ? chatLog[idx - 1].text : '';
          return { entry, prompt: prevUser };
        })
        .filter((x): x is { entry: BuilderChatLogEntry; prompt: string } => Boolean(x)),
    [chatLog],
  );

  const activeXray = useMemo(() => {
    if (assistantTurns.length === 0) return null;
    if (inspectedTurnId) {
      const matched = assistantTurns.find((t) => t.entry.id === inspectedTurnId);
      if (matched) return matched;
    }
    return assistantTurns[assistantTurns.length - 1];
  }, [assistantTurns, inspectedTurnId]);

  const handleAddEvalCase = () => {
    const q = newEvalQuestion.trim();
    if (!q || evalCases.length >= 8) return;
    onEvalCasesChange([
      ...evalCases,
      {
        id: `eval_${Date.now().toString(36)}`,
        question: q,
        expectHandoff: newEvalExpectHandoff,
      },
    ]);
    setNewEvalQuestion('');
    setNewEvalExpectHandoff(false);
  };

  return (
    <Card className="xl:sticky xl:top-[76px]">
      <CardHeader
        title="Live Playground & Diagnostics"
        sub="Test live replies, inspect X-Ray routing & RAG chunks, or run batch evals"
        actions={
          pgTab === 'chat' && chatLog.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              leading={<RotateCcw size={13} />}
              onClick={() => {
                setInspectedTurnId(null);
                onClear();
              }}
            >
              Clear
            </Button>
          ) : null
        }
      />

      <div className="mb-3">
        <Tabs<PlaygroundTab>
          idBase="agent-playground-tabs"
          label="Playground views"
          value={pgTab}
          onChange={setPgTab}
          items={[
            { id: 'chat', label: 'Chat', count: assistantTurns.length || undefined },
            { id: 'xray', label: 'X-Ray Trace' },
            { id: 'eval', label: 'Eval Suite', count: evalCases.length || undefined },
          ]}
        />
      </div>

      {pgTab === 'chat' ? (
        <>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select
              aria-label="Test persona"
              value={persona}
              onChange={(e) => onPersonaChange(e.target.value as typeof persona)}
              options={[
                { value: 'standard', label: 'Persona: Standard' },
                { value: 'vip', label: 'Persona: VIP customer' },
                { value: 'upset', label: 'Persona: Frustrated' },
                { value: 'non_english', label: 'Persona: Multilingual' },
              ]}
            />
            <Select
              aria-label="Test language"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as typeof language)}
              options={[
                { value: 'auto', label: 'Lang: Auto detect' },
                { value: 'en', label: 'Lang: English' },
                { value: 'roman_ur', label: 'Lang: Roman Urdu' },
                { value: 'ur', label: 'Lang: Urdu' },
                { value: 'hi', label: 'Lang: Hindi' },
                { value: 'ar', label: 'Lang: Arabic' },
                { value: 'es', label: 'Lang: Spanish' },
              ]}
            />
          </div>

          <div className="mb-3 h-[310px] space-y-3 overflow-y-auto rounded-[12px] border border-o-border bg-o-surface-2/60 p-3">
            {chatLog.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-[13px] text-o-text-3">
                <Sparkles size={18} className="mb-2 text-o-ai" />
                <div>Send a sample question to test routing, RAG retrieval, and claim checks.</div>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSend('What plans or refund rules do you offer?')}
                  >
                    Ask policy question
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSend('Please connect me to a human', true)}
                  >
                    Test handoff
                  </Button>
                </div>
              </div>
            ) : (
              chatLog.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-[12px] p-3 text-[13px] leading-relaxed ${
                    entry.role === 'user'
                      ? 'ml-8 bg-o-accent text-o-surface'
                      : 'mr-4 border border-o-border bg-o-surface text-o-text'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] opacity-75">
                    <span>{entry.role === 'user' ? 'Test visitor' : 'AI assistant'}</span>
                    {entry.role === 'assistant' && entry.meta ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedTurnId(entry.id);
                          setPgTab('xray');
                        }}
                        className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold text-o-ai-text hover:bg-o-ai-soft"
                      >
                        Inspect X-Ray
                      </button>
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

                  {entry.meta ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-o-border pt-2 text-[11px] text-o-text-3">
                      {entry.meta.engineUsed ? (
                        <Badge tone="accent">
                          {entry.meta.engineUsed === 'adk'
                            ? 'Google ADK'
                            : entry.meta.engineUsed === 'langgraph'
                              ? 'LangGraph'
                              : 'Built-in'}
                        </Badge>
                      ) : null}
                      {entry.meta.ragMode ? (
                        <Badge tone={entry.meta.ragMode === 'advanced' ? 'ai' : 'neutral'}>
                          {entry.meta.ragMode === 'advanced' ? 'Adv RAG' : 'Std RAG'}
                        </Badge>
                      ) : null}
                      {entry.meta.verificationVerdict ? (
                        <Badge tone={verdictTone(entry.meta.verificationVerdict)}>
                          {entry.meta.verificationVerdict.replace('_', ' ')}
                        </Badge>
                      ) : null}
                      <span className="o-num">{entry.meta.confidencePct}% conf</span>
                      <span>· {entry.meta.latencyMs} ms</span>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="flex gap-2"
          >
            <Input
              aria-label="Test message"
              placeholder="Ask a test question…"
              value={inputText}
              disabled={busy}
              onChange={(e) => onInputTextChange(e.target.value)}
            />
            <Button
              type="submit"
              variant="ai"
              size="md"
              loading={busy}
              aria-label="Send test message"
              leading={<Send size={14} />}
            >
              Send
            </Button>
          </form>
        </>
      ) : null}

      {pgTab === 'xray' ? (
        !activeXray || !activeXray.entry.meta ? (
          <EmptyState
            icon={<ShieldCheck size={20} />}
            title="No turn inspected yet"
            body="Send a message in the Chat tab first, then inspect how the router, tools, and Knowledge Base chunks behaved."
            action={
              <Button variant="secondary" size="sm" onClick={() => setPgTab('chat')}>
                Open Chat tab
              </Button>
            }
          />
        ) : (
          <div className="space-y-3 text-[12.5px]">
            {assistantTurns.length > 1 ? (
              <Select
                aria-label="Select turn to inspect"
                value={activeXray.entry.id}
                onChange={(e) => setInspectedTurnId(e.target.value)}
                options={assistantTurns.map((t, idx) => ({
                  value: t.entry.id,
                  label: `Turn #${idx + 1}: ${t.prompt.slice(0, 42) || 'Assistant reply'}`,
                }))}
              />
            ) : null}

            {/* Routing & Runtime Decision */}
            <div className="rounded-[12px] border border-o-border bg-o-surface-2/70 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-semibold text-o-text">Engine &amp; Routing Decision</span>
                <div className="flex flex-wrap gap-1">
                  <Badge tone="accent">
                    {activeXray.entry.meta.engineUsed === 'adk'
                      ? 'Google ADK'
                      : activeXray.entry.meta.engineUsed === 'langgraph'
                        ? 'LangGraph'
                        : 'Fast Built-in'}
                  </Badge>
                  <Badge tone={activeXray.entry.meta.usingModel ? 'ok' : 'neutral'}>
                    {activeXray.entry.meta.usingModel ? 'LLM' : 'KB Fallback'}
                  </Badge>
                </div>
              </div>
              {activeXray.entry.meta.engineRoutingReason ? (
                <p className="text-[11.5px] text-o-text-2">{activeXray.entry.meta.engineRoutingReason}</p>
              ) : null}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge tone="neutral">Topic: {activeXray.entry.meta.topic || 'General'}</Badge>
                <Badge tone="neutral">Lang: {activeXray.entry.meta.detectedLanguage}</Badge>
                <Badge tone="neutral">{activeXray.entry.meta.latencyMs} ms</Badge>
                {activeXray.entry.meta.ragTrace?.reranked ? <Badge tone="ai">Reranked</Badge> : null}
                {activeXray.entry.meta.ragTrace?.hydeUsed ? <Badge tone="ai">HyDE</Badge> : null}
                {activeXray.entry.meta.ragTrace?.parentExpanded ? <Badge tone="ai">Context+</Badge> : null}
                {activeXray.entry.meta.ragTrace?.correctiveRetried ? (
                  <Badge tone="warn">Corrective retry</Badge>
                ) : null}
              </div>
            </div>

            {/* Retrieved KB Chunks */}
            <div className="rounded-[12px] border border-o-border bg-o-surface-2/70 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-o-text">
                  Retrieved Chunks ({activeXray.entry.meta.retrievedChunks?.length ?? 0})
                </span>
                {activeXray.prompt &&
                ((activeXray.entry.meta.retrievedChunks?.length ?? 0) === 0 ||
                  activeXray.entry.meta.confidencePct < 60) ? (
                  <ButtonLink
                    href={fixInKbHref(activeXray.prompt)}
                    variant="secondary"
                    size="sm"
                    leading={<BookOpen size={12} />}
                  >
                    Fix in KB
                  </ButtonLink>
                ) : null}
              </div>

              {!activeXray.entry.meta.retrievedChunks ||
              activeXray.entry.meta.retrievedChunks.length === 0 ? (
                <div className="text-[11.5px] text-o-text-3">
                  No semantic vector chunks matched above threshold.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
                  {activeXray.entry.meta.retrievedChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="rounded-[10px] border border-o-border bg-o-surface p-2 text-[11.5px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-o-text">{chunk.articleTitle}</span>
                        <Badge tone={chunk.score >= 0.5 ? 'ok' : 'warn'}>
                          {Math.round(chunk.score * 100)}% match
                        </Badge>
                      </div>
                      <div className="text-[10.5px] text-o-text-3">{chunk.sectionName}</div>
                      <p className="mt-1 line-clamp-2 text-o-text-2">{chunk.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Executed Tools & Steps */}
            <div className="rounded-[12px] border border-o-border bg-o-surface-2/70 p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-o-text">
                <Wrench size={13} />
                Tools &amp; Steps Executed
              </div>
              {activeXray.entry.meta.executedTools && activeXray.entry.meta.executedTools.length > 0 ? (
                <div className="space-y-1">
                  {activeXray.entry.meta.executedTools.map((t, idx) => (
                    <div
                      key={`${t.toolName}-${idx}`}
                      className="flex items-start justify-between gap-2 rounded-[8px] border border-o-border bg-o-surface px-2.5 py-1.5 text-[11.5px]"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-semibold text-o-text">
                          {t.toolName}
                        </div>
                        <div className="truncate text-o-text-3">{t.summary}</div>
                      </div>
                      <Badge tone={t.ok ? 'ok' : 'bad'}>{t.ok ? 'ok' : 'err'}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11.5px] text-o-text-3">No tool invocations logged for this turn.</div>
              )}

              {activeXray.entry.meta.engineTrace && activeXray.entry.meta.engineTrace.length > 0 ? (
                <div className="border-t border-o-border pt-2 space-y-1">
                  {activeXray.entry.meta.engineTrace.slice(0, 6).map((stepItem, i) => (
                    <div key={`${stepItem.node}-${i}`} className="flex items-center justify-between gap-2 text-[11px] text-o-text-2">
                      <span className="truncate">
                        <strong className="font-mono text-o-text">{stepItem.node}:</strong> {stepItem.summary}
                      </span>
                      <span className="shrink-0 o-num text-o-text-3">{stepItem.durationMs ?? 0}ms</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Claim Checks */}
            {activeXray.entry.meta.claims.length > 0 ? (
              <div className="rounded-[12px] border border-o-border bg-o-surface-2/70 p-3 space-y-1.5">
                <div className="font-semibold text-o-text">
                  Claim Verification ({activeXray.entry.meta.claims.length})
                </div>
                {activeXray.entry.meta.claims.map((claim, idx) => (
                  <div
                    key={idx}
                    className={`rounded-[8px] border px-2.5 py-1.5 text-[11.5px] ${
                      claim.supported
                        ? 'border-o-ok/25 bg-o-ok-soft/30 text-o-text'
                        : 'border-o-bad/25 bg-o-bad-soft/30 text-o-text'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      {claim.supported ? (
                        <CheckCircle2 size={12} className="text-o-ok shrink-0" />
                      ) : (
                        <AlertTriangle size={12} className="text-o-bad shrink-0" />
                      )}
                      <span>{claim.claim}</span>
                    </div>
                    <div className="mt-0.5 pl-4 text-[10.5px] text-o-text-3">Source: {claim.source}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      ) : null}

      {pgTab === 'eval' ? (
        <div className="space-y-3 text-[12.5px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-o-text-2">
              Test up to 8 questions in one batch ({evalCases.length}/8 saved).
            </span>
            <div className="flex items-center gap-1.5">
              {canManage && evalCases.length === 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onEvalCasesChange(
                      STARTER_EVAL_QUESTIONS.map((q, idx) => ({
                        ...q,
                        id: `starter_${idx + 1}`,
                      })),
                    )
                  }
                >
                  Load starters
                </Button>
              ) : null}
              <Button
                variant="ai"
                size="sm"
                loading={evalBusy}
                disabled={evalCases.length === 0 || evalBusy}
                leading={<Play size={13} />}
                onClick={onRunEval}
              >
                Run Eval Suite
              </Button>
            </div>
          </div>

          {canManage && evalCases.length < 8 ? (
            <div className="space-y-2 rounded-[12px] border border-o-border bg-o-surface-2/60 p-2.5">
              <div className="flex gap-2">
                <Input
                  aria-label="New evaluation question"
                  value={newEvalQuestion}
                  placeholder="Add test question (e.g. What is your refund SLA?)"
                  onChange={(e) => setNewEvalQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEvalCase();
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!newEvalQuestion.trim()}
                  leading={<Plus size={13} />}
                  onClick={handleAddEvalCase}
                >
                  Add
                </Button>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-o-text-2">
                <input
                  type="checkbox"
                  checked={newEvalExpectHandoff}
                  onChange={(e) => setNewEvalExpectHandoff(e.target.checked)}
                />
                Expect human handoff for this test case
              </label>
            </div>
          ) : null}

          {evalCases.length === 0 ? (
            <EmptyState
              icon={<FileWarning size={18} />}
              title="No evaluation cases yet"
              body="Add customer test questions or click Load starters to benchmark accuracy before publishing."
            />
          ) : (
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
              {evalCases.map((tc, idx) => (
                <div
                  key={tc.id}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-o-border bg-o-surface-2 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-o-text">
                      {idx + 1}. {tc.question}
                    </div>
                    <div className="text-[10.5px] text-o-text-3">
                      Expected: {tc.expectHandoff ? 'Human escalation' : 'Verified AI answer'}
                    </div>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      aria-label={`Delete test case ${idx + 1}`}
                      onClick={() => onEvalCasesChange(evalCases.filter((item) => item.id !== tc.id))}
                      className="text-o-text-3 hover:text-o-bad shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {evalResult ? (
            <div className="space-y-2 border-t border-o-border pt-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-[10px] border border-o-border bg-o-surface-2 p-2">
                  <div className="text-[10.5px] text-o-text-3">Pass rate</div>
                  <div className="o-num text-[16px] font-semibold text-o-text">
                    {evalResult.passRatePct}%
                  </div>
                </div>
                <div className="rounded-[10px] border border-o-border bg-o-surface-2 p-2">
                  <div className="text-[10.5px] text-o-text-3">Passed</div>
                  <div className="o-num text-[16px] font-semibold text-o-ok">
                    {evalResult.passCount}/{evalResult.totalCount}
                  </div>
                </div>
                <div className="rounded-[10px] border border-o-border bg-o-surface-2 p-2">
                  <div className="text-[10.5px] text-o-text-3">Avg speed</div>
                  <div className="o-num text-[16px] font-semibold text-o-text">
                    {evalResult.avgLatencyMs}ms
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-[210px] overflow-y-auto pr-0.5">
                {evalResult.results.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-[10px] border p-2.5 ${
                      item.passed
                        ? 'border-o-ok/25 bg-o-ok-soft/25'
                        : 'border-o-bad/25 bg-o-bad-soft/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-o-text">{item.question}</span>
                      <Badge tone={item.passed ? 'ok' : 'bad'}>
                        {item.passed ? 'PASS' : 'FAIL'}
                      </Badge>
                    </div>
                    {item.error ? (
                      <Alert tone="bad" className="mt-1.5">
                        {item.error}
                      </Alert>
                    ) : (
                      <p className="mt-1 text-[11.5px] text-o-text-2">{item.replyPreview}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-o-text-3">
                      <span>
                        {item.engineUsed || 'builtin'} · {item.confidencePct}% · {item.latencyMs}ms
                      </span>
                      {!item.passed && !item.expectHandoff ? (
                        <ButtonLink
                          href={fixInKbHref(item.question)}
                          variant="secondary"
                          size="sm"
                          leading={<BookOpen size={11} />}
                        >
                          Fix in KB
                        </ButtonLink>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
