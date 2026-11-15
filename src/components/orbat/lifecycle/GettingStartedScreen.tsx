'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock,
  Sparkles,
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
  Skeleton,
  useOrbToast,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt } from '@/components/orbat/overview/format';
import {
  loadGettingStarted,
  publishGettingStartedAgent,
  setGettingStartedStep,
  type GettingStartedStepKey,
} from '@/lib/data/getting-started';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

function meterPct(used: number, limit: number | null): number {
  if (!limit || limit <= 0) return used > 0 ? 18 : 0;
  return Math.min(100, Math.max(2, Math.round((used / limit) * 100)));
}

export function GettingStartedScreen() {
  const { workspace } = useShellSession();
  const workspaceId = workspace.id;
  const { show } = useOrbToast();
  const { data, error, loading, reload } = useData(
    () => loadGettingStarted(workspaceId),
    ['getting-started', workspaceId],
  );
  const [busyStep, setBusyStep] = useState<GettingStartedStepKey | null>(null);
  const [togglingAgent, setTogglingAgent] = useState(false);

  async function handleToggleStep(stepKey: GettingStartedStepKey, currentlyDone: boolean) {
    setBusyStep(stepKey);
    try {
      await setGettingStartedStep(workspaceId, stepKey, !currentlyDone);
      show({
        message: !currentlyDone ? 'Step marked complete.' : 'Step unmarked.',
        tone: 'ok',
      });
      reload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not update step.',
        tone: 'bad',
      });
    } finally {
      setBusyStep(null);
    }
  }

  async function handleToggleAgent() {
    if (!data?.primaryAgent) return;
    const nextStatus = data.primaryAgent.status === 'live' ? 'draft' : 'live';
    setTogglingAgent(true);
    try {
      await publishGettingStartedAgent(workspaceId, nextStatus);
      show({
        message:
          nextStatus === 'live'
            ? `${data.primaryAgent.name} is now live and ready to reply.`
            : `${data.primaryAgent.name} switched back to draft.`,
        tone: 'ok',
      });
      reload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not update agent status.',
        tone: 'bad',
      });
    } finally {
      setTogglingAgent(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Getting started"
        description="Complete the 7-step launch checklist to connect your knowledge base, configure channels, and take your AI agent live."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink variant="secondary" size="sm" href="/onboarding">
              Re-open setup wizard
            </ButtonLink>
            <ButtonLink variant="primary" size="sm" href="/app/inbox" trailing={<ArrowRight size={15} />}>
              Go to Inbox
            </ButtonLink>
          </div>
        }
      />

      {loading && !data ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[520px] rounded-[24px]" />
          <Skeleton className="h-[420px] rounded-[24px]" />
        </div>
      ) : error && !data ? (
        <ErrorState title="Could not load getting started checklist" body={error} onRetry={reload} />
      ) : !data ? (
        <EmptyState
          title="Workspace setup unavailable"
          body="Refresh to reload your workspace onboarding checklist."
          action={<Button onClick={reload}>Reload</Button>}
        />
      ) : (
        <>
          {(data.isTrialing || data.isTrialExpired) && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-o-forest px-6 py-4 text-o-on-forest">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-o-on-forest-track text-o-mint">
                  <Clock size={18} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold">
                    {data.isTrialExpired
                      ? 'Your free trial has ended'
                      : `${data.trialDaysRemaining ?? 14} days left in your free trial`}
                  </p>
                  <p className="text-[13.5px] text-o-mint">
                    All AI, inbox, and channel capabilities remain active during evaluation.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={data.isTrialExpired ? '/app/trial-ended' : '/app/trial'}
                  className="inline-flex h-10 items-center rounded-full bg-o-lime px-5 text-[14px] font-semibold text-o-forest no-underline transition hover:opacity-95"
                >
                  {data.isTrialExpired ? 'Choose a plan' : 'View trial options'}
                </Link>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-5">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="o-card__title">
                      Launch checklist for {data.workspaceName}
                    </h3>
                    <p className="o-card__sub mt-0.5">
                      {data.progress.doneCount} of {data.progress.totalCount} steps complete
                    </p>
                  </div>
                  <Badge tone={data.progress.percentage === 100 ? 'ok' : 'accent'}>
                    <span className="o-num">{data.progress.percentage}% ready</span>
                  </Badge>
                </div>
                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-o-surface-2" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-o-forest transition-all duration-300"
                    style={{ width: `${data.progress.percentage}%` }}
                  />
                </div>
              </Card>

              <Card flush>
                <ul className="divide-y divide-o-border" aria-label="Onboarding checklist steps">
                  {data.steps.map((step, idx) => {
                    const done = step.completed;
                    const isBusy = busyStep === step.key;
                    return (
                      <li
                        key={step.key}
                        className={cn(
                          'flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
                          done && 'bg-o-surface-2/40',
                        )}
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => void handleToggleStep(step.key, done)}
                            disabled={isBusy}
                            aria-pressed={done}
                            aria-label={`${done ? 'Unmark' : 'Mark complete'}: ${step.title}`}
                            className={cn(
                              'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2',
                              done
                                ? 'border-o-forest bg-o-forest text-o-on-forest'
                                : 'border-o-border-2 bg-o-surface text-o-text-3 hover:border-o-forest',
                            )}
                          >
                            {done ? (
                              <Check size={15} aria-hidden="true" />
                            ) : (
                              <span className="o-num text-[12px] font-semibold">{idx + 1}</span>
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={cn(
                                  'text-[15px] font-semibold text-o-text',
                                  done && 'line-through decoration-o-text-3/60 text-o-text-2',
                                )}
                              >
                                {step.title}
                              </p>
                              {step.autoCompleted ? (
                                <Badge tone="ok" dot>
                                  Verified
                                </Badge>
                              ) : done ? (
                                <Badge tone="accent">Checked</Badge>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-[13.5px] text-o-text-2">
                              {step.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 pl-10 sm:pl-0">
                          <ButtonLink
                            variant={done ? 'quiet' : 'secondary'}
                            size="sm"
                            href={step.href}
                            trailing={<ArrowRight size={14} />}
                          >
                            {step.ctaLabel}
                          </ButtonLink>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>

            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader
                  title="Your AI agent"
                  sub="Configure instructions before taking replies live."
                  actions={
                    data.primaryAgent ? (
                      <Badge
                        tone={data.primaryAgent.status === 'live' ? 'ok' : 'warn'}
                        dot
                      >
                        {data.primaryAgent.status === 'live' ? 'Live' : 'Draft'}
                      </Badge>
                    ) : null
                  }
                />
                {data.primaryAgent ? (
                  <div className="mt-4 flex flex-col gap-4">
                    <div className="flex items-center gap-3 rounded-2xl border border-o-border bg-o-surface-2/60 p-3.5">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-o-forest text-o-lime">
                        <Bot size={20} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-o-text">
                          {data.primaryAgent.name}
                        </p>
                        <p className="truncate text-[13px] text-o-text-2">
                          {data.primaryAgent.roleTitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[13.5px] text-o-text-2">
                      <span>Published articles synced</span>
                      <span className="o-num font-semibold text-o-text">
                        {fmtInt(data.primaryAgent.knowledgeCount)}
                      </span>
                    </div>

                    {data.primaryAgent.knowledgeCount === 0 && (
                      <Alert tone="warn">
                        Add at least 1 help article or PDF so {data.primaryAgent.name} has verified sources to cite.
                      </Alert>
                    )}

                    <div className="flex flex-col gap-2">
                      <Button
                        variant={data.primaryAgent.status === 'live' ? 'secondary' : 'primary'}
                        loading={togglingAgent}
                        onClick={() => void handleToggleAgent()}
                        leading={
                          data.primaryAgent.status === 'live' ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <Sparkles size={16} />
                          )
                        }
                      >
                        {data.primaryAgent.status === 'live'
                          ? 'Pause back to draft'
                          : 'Turn AI agent live'}
                      </Button>
                      <ButtonLink
                        variant="ghost"
                        size="sm"
                        href={`/app/agents/${data.primaryAgent.id}`}
                      >
                        Test & edit agent instructions
                      </ButtonLink>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No AI agent provisioned yet"
                    body="Create your first AI support agent from the Agents studio."
                    action={
                      <ButtonLink size="sm" href="/app/agents/new">
                        Create AI agent
                      </ButtonLink>
                    }
                  />
                )}
              </Card>

              <Card>
                <CardHeader title="Workspace capacity" sub="Real-time plan metering" />
                <div className="mt-4 flex flex-col gap-3.5">
                  <div>
                    <div className="flex justify-between text-[13.5px]">
                      <span className="text-o-text-2">AI replies this month</span>
                      <span className="o-num font-semibold text-o-text">
                        {fmtInt(data.usageMeters.aiRepliesUsed)} /{' '}
                        {data.usageMeters.aiRepliesLimit === null
                          ? 'Unlimited'
                          : fmtInt(data.usageMeters.aiRepliesLimit)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-o-surface-2">
                      <div
                        className="h-full rounded-full bg-o-forest"
                        style={{
                          width: `${meterPct(data.usageMeters.aiRepliesUsed, data.usageMeters.aiRepliesLimit)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[13.5px]">
                      <span className="text-o-text-2">Active team seats</span>
                      <span className="o-num font-semibold text-o-text">
                        {fmtInt(data.usageMeters.agentsUsed)} /{' '}
                        {data.usageMeters.agentsLimit === null
                          ? 'Unlimited'
                          : fmtInt(data.usageMeters.agentsLimit)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-o-surface-2">
                      <div
                        className="h-full rounded-full bg-o-forest"
                        style={{
                          width: `${meterPct(data.usageMeters.agentsUsed, data.usageMeters.agentsLimit)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[13.5px]">
                      <span className="text-o-text-2">Connected channels</span>
                      <span className="o-num font-semibold text-o-text">
                        {fmtInt(data.usageMeters.channelsUsed)} /{' '}
                        {data.usageMeters.channelsLimit === null
                          ? 'Unlimited'
                          : fmtInt(data.usageMeters.channelsLimit)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-o-surface-2">
                      <div
                        className="h-full rounded-full bg-o-forest"
                        style={{
                          width: `${meterPct(data.usageMeters.channelsUsed, data.usageMeters.channelsLimit)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-o-surface-2 text-o-text-2">
                    <CircleHelp size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold text-o-text">Need launch assistance?</h3>
                    <p className="mt-1 text-[13.5px] text-o-text-2">
                      Browse guides, inspect system health, or reach {data.supportEmail}.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ButtonLink size="sm" variant="secondary" href="/help">
                        Help center
                      </ButtonLink>
                      <ButtonLink size="sm" variant="quiet" href="/app/states">
                        System status
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
