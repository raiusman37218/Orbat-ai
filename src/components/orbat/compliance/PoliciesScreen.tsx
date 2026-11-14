'use client';

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FileText, Play, Sparkles, Upload } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Field,
  Input,
  Textarea,
  useOrbToast,
  type BadgeTone,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import {
  activateApprovedPolicies,
  extractPolicyGuardrails,
  runSinglePolicyTests,
  type ExtractedPolicyRule,
} from '@/lib/data/compliance';
import { cn } from '@/lib/utils';

type Stage = 'upload' | 'extracting' | 'review' | 'live';

const SAMPLE_POLICY_TEXT = `Refunds & Advice Policy (Starter Example):
1. Staff and automated assistants must never recommend, rank, or guarantee the performance of any investment product or financial stock.
2. Refunds exceeding USD 200 require written approval from a team supervisor before they are issued.
3. Do not promise or guarantee a specific delivery date unless confirmed by live carrier tracking information.
4. Any customer mention of a regulator, ombudsman, court, or lawyer must be escalated to a supervisor immediately.
5. Changes to saved payment card or delivery address require identity verification first.`;

function kindTone(kind: ExtractedPolicyRule['kind']): BadgeTone {
  if (kind === 'Block') return 'bad';
  if (kind === 'Approval') return 'warn';
  if (kind === 'Escalate') return 'ai';
  return 'accent';
}

export function PoliciesScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();

  const [stage, setStage] = useState<Stage>('upload');
  const [docName, setDocName] = useState('');
  const [rawText, setRawText] = useState('');
  const [usedAi, setUsedAi] = useState(false);

  const [rules, setRules] = useState<ExtractedPolicyRule[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [testingIdx, setTestingIdx] = useState<number | null>(null);
  const [activating, setActivating] = useState(false);
  const [activatedCount, setActivatedCount] = useState(0);

  if (!workspace?.id) return null;

  const stepIndex = stage === 'upload' ? 0 : stage === 'extracting' ? 1 : stage === 'review' ? 3 : 4;
  const steps = ['Upload or paste', 'Extract clauses', 'Generate tests', 'Officer review', 'Live'];

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512_000) {
      show({ message: 'Upload plain text or markdown under 512 KB (or paste sections below).', tone: 'bad' });
      return;
    }
    const text = await file.text();
    setDocName(file.name);
    setRawText(text.slice(0, 30_000));
  }

  async function handleExtract(overrideName?: string, overrideText?: string) {
    if (!workspace?.id) return;
    const targetName = (overrideName ?? docName).trim() || 'Workspace Policy Document';
    const targetText = (overrideText ?? rawText).trim();
    if (targetText.length < 30) {
      show({ message: 'Paste at least one paragraph of policy text (30+ characters).', tone: 'bad' });
      return;
    }

    setStage('extracting');
    try {
      const res = await extractPolicyGuardrails(workspace.id, {
        documentName: targetName,
        rawText: targetText,
      });
      setDocName(res.documentName);
      setRules(res.rules);
      setUsedAi(res.usedAi);
      setSelectedIdx(0);
      setStage('review');
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Extraction failed', tone: 'bad' });
      setStage('upload');
    }
  }

  async function handleRerunTests(idx: number) {
    if (!workspace?.id) return;
    const rule = rules[idx];
    if (!rule) return;
    setTestingIdx(idx);
    try {
      const updated = await runSinglePolicyTests(workspace.id, {
        name: rule.name,
        category: rule.category,
        framework: rule.framework,
        actionMode: rule.actionMode,
        patternType: rule.patternType,
        pattern: rule.pattern,
        tests: rule.tests,
      });
      setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, tests: updated } : r)));
      show({ message: 'Test assertions executed', tone: 'ok' });
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to run tests', tone: 'bad' });
    } finally {
      setTestingIdx(null);
    }
  }

  async function handleActivateLive() {
    if (!workspace?.id) return;
    const approved = rules.filter((r) => r.decision === 'approved');
    if (!approved.length) return;
    setActivating(true);
    try {
      const res = await activateApprovedPolicies(workspace.id, {
        documentName: docName || 'Policy Document',
        rules: approved.map((r) => ({
          name: r.name,
          category: r.category,
          framework: r.framework,
          actionMode: r.actionMode,
          patternType: r.patternType,
          pattern: r.pattern,
          quote: r.quote,
          page: r.page,
          tests: r.tests,
        })),
      });
      setActivatedCount(res.savedCount);
      setStage('live');
      show({ message: `${res.savedCount} compliance rule(s) published live`, tone: 'ok' });
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Activation failed', tone: 'bad' });
    } finally {
      setActivating(false);
    }
  }

  const cur = rules[selectedIdx];
  const approvedCount = rules.filter((r) => r.decision === 'approved').length;
  const remainingCount = rules.filter((r) => r.decision === 'pending').length;

  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <Link href="/app/compliance" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-o-accent-text hover:underline">
          <ArrowLeft size={14} /> Compliance center
        </Link>
        <PageHeader
          title="Policy to guardrails"
          description="Turn regulatory circulars or internal policies into testable rules, review them, and publish to Sentinel."
        />
      </div>

      {/* Stepper */}
      <ol aria-label="Steps" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {steps.map((label, i) => {
          const done = i < stepIndex;
          const on = i === stepIndex;
          return (
            <li
              key={label}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] font-medium',
                on ? 'border-o-accent bg-o-accent-soft text-o-accent-text' : 'border-o-border bg-o-surface text-o-text',
              )}
            >
              <span
                className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11.5px] font-bold',
                  done || on ? 'bg-o-accent text-white' : 'bg-o-surface-3 text-o-text-2',
                )}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className="truncate">{label}</span>
            </li>
          );
        })}
      </ol>

      {stage === 'upload' ? (
        <Card className="flex flex-col gap-4">
          <CardHeader
            title="Provide a policy or regulation"
            sub="Upload a .txt/.md file or paste policy text. An officer approves every extracted rule before it takes effect."
            actions={
              <Button
                size="sm"
                variant="secondary"
                leading={<Sparkles size={14} />}
                onClick={() => {
                  setDocName('Sample Refunds & Advice Policy.txt');
                  setRawText(SAMPLE_POLICY_TEXT);
                }}
              >
                Insert sample input
              </Button>
            }
          />

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-o-border-strong bg-o-surface-2/40 p-4">
            <Upload size={18} className="text-o-text-3" />
            <label className="cursor-pointer text-[13.5px] font-medium text-o-accent-text hover:underline">
              Choose .txt or .md policy file
              <input type="file" accept=".txt,.md,.csv" className="sr-only" onChange={handleFileSelect} />
            </label>
            <span className="text-[12.5px] text-o-text-3">or enter/paste directly below</span>
          </div>

          <Field label="Document title">
            <Input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. Q4 Refund & Financial Advice Circular"
            />
          </Field>

          <Field label="Policy clauses text">
            <Textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste your compliance policy, refund rules, or regulatory circular..."
            />
          </Field>

          <div className="flex justify-end">
            <Button variant="primary" leading={<Sparkles size={15} />} onClick={() => handleExtract()}>
              Extract rules &amp; generate tests
            </Button>
          </div>
        </Card>
      ) : null}

      {stage === 'extracting' ? (
        <Card className="flex flex-col gap-3 p-6">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-o-ai" />
            <div>
              <div className="font-semibold text-o-text">{docName || 'Analyzing document...'}</div>
              <div className="text-[12.5px] text-o-text-3">
                Extracting obligation rules and generating test conversations...
              </div>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-o-surface-2">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-o-ai" />
          </div>
        </Card>
      ) : null}

      {stage === 'review' && cur ? (
        <div className="flex flex-col gap-4">
          <Alert tone={usedAi ? 'ai' : 'ok'}>
            {usedAi
              ? `Extracted ${rules.length} rule(s) using your workspace LLM. Edit trigger keywords and verify test cases before activating.`
              : `Extracted ${rules.length} rule(s) via deterministic policy parser. Edit keywords or run assertions before activating.`}
          </Alert>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Left rule list */}
            <Card flush className="lg:col-span-2 h-fit">
              <div className="flex items-center justify-between border-b border-o-border px-4 py-3">
                <div>
                  <div className="font-semibold text-o-text">Extracted rules</div>
                  <div className="text-[12px] text-o-text-3 truncate">{docName}</div>
                </div>
                <Badge tone={approvedCount > 0 ? 'ok' : 'neutral'}>
                  {approvedCount}/{rules.length} approved
                </Badge>
              </div>

              <div className="divide-y divide-o-border">
                {rules.map((r, i) => {
                  const passing = r.tests.filter((t) => t.passed).length;
                  const active = i === selectedIdx;
                  return (
                    <button
                      key={r.tempId}
                      type="button"
                      onClick={() => setSelectedIdx(i)}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-4 py-3 text-left transition',
                        active ? 'bg-o-accent-soft/60' : 'hover:bg-o-surface-2/60',
                      )}
                    >
                      <Badge tone={kindTone(r.kind)}>{r.kind}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium text-o-text">{r.name}</div>
                        <div className="text-[12px] text-o-text-3">
                          Section {r.page} · tests {passing}/{r.tests.length} passing
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[12px] font-medium shrink-0',
                          r.decision === 'approved'
                            ? 'text-o-ok'
                            : r.decision === 'rejected'
                              ? 'text-o-text-3'
                              : 'text-o-warn',
                        )}
                      >
                        {r.decision === 'approved' ? 'Approved' : r.decision === 'rejected' ? 'Rejected' : 'Review'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Right rule inspector */}
            <Card className="lg:col-span-3 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={kindTone(cur.kind)}>{cur.kind}</Badge>
                  <Badge tone="neutral">{cur.framework}</Badge>
                </div>
                <span className="text-[12px] text-o-text-3">Applies to: AI agents &amp; human drafts</span>
              </div>

              <Field label="Rule title (editable)">
                <Input
                  value={cur.name}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((r, i) => (i === selectedIdx ? { ...r, name: e.target.value } : r)),
                    )
                  }
                />
              </Field>

              <Field label="Match trigger phrases (pipe-separated)" hint="Used by Sentinel policy evaluator">
                <Input
                  value={cur.pattern}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((r, i) => (i === selectedIdx ? { ...r, pattern: e.target.value } : r)),
                    )
                  }
                />
              </Field>

              <blockquote className="rounded-lg border-l-4 border-o-border-strong bg-o-surface-2 px-3 py-2 text-[13px] text-o-text-2">
                “{cur.quote}” <span className="text-o-text-3">— section {cur.page}</span>
              </blockquote>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wide text-o-text-3">
                    Test conversations
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={testingIdx === selectedIdx}
                    leading={<Play size={13} />}
                    onClick={() => handleRerunTests(selectedIdx)}
                  >
                    Run tests
                  </Button>
                </div>

                {cur.tests.map((t, tIdx) => (
                  <div
                    key={tIdx}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-o-border p-3 text-[13px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone={t.expected === 'allow' ? 'ok' : 'warn'}>
                          {t.expected === 'allow' ? 'Should allow' : `Should ${t.expected}`}
                        </Badge>
                        <span className="text-[12px] text-o-text-3">{t.actor}</span>
                      </div>
                      <div className="mt-1 text-o-text">{t.message}</div>
                    </div>
                    <span className={cn('text-[12.5px] font-semibold', t.passed ? 'text-o-ok' : 'text-o-bad')}>
                      {t.passed ? '✓ Passed' : '✕ Failed'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-o-border pt-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setRules((prev) =>
                        prev.map((r, i) => (i === selectedIdx ? { ...r, decision: 'approved' } : r)),
                      );
                      setSelectedIdx((idx) => Math.min(rules.length - 1, idx + 1));
                    }}
                  >
                    Approve rule
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setRules((prev) =>
                        prev.map((r, i) => (i === selectedIdx ? { ...r, decision: 'rejected' } : r)),
                      );
                      setSelectedIdx((idx) => Math.min(rules.length - 1, idx + 1));
                    }}
                  >
                    Reject
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStage('upload')}>
                  Change document
                </Button>
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-[13px] text-o-text-2">
              {approvedCount} approved · {remainingCount} still pending review
            </span>
            <Button
              variant="primary"
              disabled={approvedCount === 0}
              loading={activating}
              onClick={handleActivateLive}
            >
              Make approved rules live ({approvedCount})
            </Button>
          </div>
        </div>
      ) : null}

      {stage === 'live' ? (
        <Card className="flex flex-col items-start gap-4 p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-o-ok-soft text-o-ok">
            <CheckCircle2 size={24} />
          </span>
          <div>
            <h3 className="text-[18px] font-semibold text-o-text">
              {activatedCount} rule{activatedCount === 1 ? '' : 's'} published live
            </h3>
            <p className="mt-1 text-[13.5px] text-o-text-2">
              Sentinel now enforces these rules in real time and logs every activation in the compliance audit log.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/app/compliance" variant="primary">
              View in Compliance Center
            </ButtonLink>
            <Button
              variant="secondary"
              onClick={() => {
                setStage('upload');
                setRules([]);
                setRawText('');
                setDocName('');
              }}
            >
              Upload another policy
            </Button>
          </div>
        </Card>
      ) : null}
    </PageContainer>
  );
}
