'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  Clock,
  Download,
  Lock,
  Radio,
  Sparkles,
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
  Modal,
  Segmented,
  Skeleton,
  Textarea,
  useOrbToast,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt } from '@/components/orbat/overview/format';
import {
  loadTrialLifecycle,
  snoozeTrialReminder,
  submitTrialExtensionRequest,
} from '@/lib/data/trial';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

export function TrialScreen({
  defaultMode = 'reminder',
}: {
  defaultMode?: 'reminder' | 'ended';
}) {
  const { workspace } = useShellSession();
  const workspaceId = workspace.id;
  const { show } = useOrbToast();
  const { data, error, loading, reload } = useData(
    () => loadTrialLifecycle(workspaceId),
    ['trial-lifecycle', workspaceId],
  );

  const [mode, setMode] = useState<'reminder' | 'ended'>(defaultMode);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [snoozing, setSnoozing] = useState(false);
  const [extOpen, setExtOpen] = useState(false);
  const [extDays, setExtDays] = useState<number>(7);
  const [extReason, setExtReason] = useState('');
  const [submittingExt, setSubmittingExt] = useState(false);

  async function handleSnooze() {
    setSnoozing(true);
    try {
      await snoozeTrialReminder(workspaceId);
      show({ message: 'Trial reminder snoozed for 24 hours.', tone: 'ok' });
      reload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not snooze reminder.',
        tone: 'bad',
      });
    } finally {
      setSnoozing(false);
    }
  }

  async function handleSubmitExtension() {
    setSubmittingExt(true);
    try {
      await submitTrialExtensionRequest(workspaceId, extDays, extReason);
      show({
        message: 'Extension request submitted for platform review.',
        tone: 'ok',
      });
      setExtOpen(false);
      setExtReason('');
      reload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not submit request.',
        tone: 'bad',
      });
    } finally {
      setSubmittingExt(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={mode === 'ended' ? 'Trial ended & plan upgrade' : 'Free trial & workspace usage'}
        description="Review everything your team automated during evaluation, request additional days, or activate a paid plan without losing conversations."
        actions={
          <Segmented
            label="Trial lifecycle state"
            value={mode}
            onChange={setMode}
            items={[
              { id: 'reminder', label: 'Trial reminder' },
              { id: 'ended', label: 'Trial ended' },
            ]}
          />
        }
      />

      {loading && !data ? (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[140px] rounded-[24px]" />
          <Skeleton className="h-[380px] rounded-[24px]" />
        </div>
      ) : error && !data ? (
        <ErrorState title="Could not load trial status" body={error} onRetry={reload} />
      ) : !data ? (
        <EmptyState
          title="No billing record found"
          body="Open billing settings to initialize your workspace plan."
          action={<ButtonLink href="/app/billing">Go to Billing</ButtonLink>}
        />
      ) : (
        <>
          <div className="rounded-[26px] bg-o-forest p-6 text-o-on-forest sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-[660px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="solid">
                    {mode === 'ended' || data.isTrialExpired
                      ? 'Trial ended'
                      : data.isTrialing
                        ? `${data.trialDaysRemaining ?? 0} days left in trial`
                        : `${data.planName} active`}
                  </Badge>
                  {data.snoozedUntil ? (
                    <Badge tone="accent">
                      Reminder snoozed until{' '}
                      {new Date(data.snoozedUntil).toLocaleDateString()}
                    </Badge>
                  ) : null}
                </div>
                <h3 className="mt-3 text-[24px] font-semibold leading-tight text-o-on-forest sm:text-[28px]">
                  {mode === 'ended' || data.isTrialExpired
                    ? `Pick a plan to keep ${data.workspaceName} running`
                    : `Your free trial ends ${
                        data.trialEndsAt
                          ? `on ${new Date(data.trialEndsAt).toLocaleDateString()}`
                          : 'soon'
                      }`}
                </h3>
                <p className="mt-2 text-[15px] text-o-mint">
                  Your conversations, tickets, help center articles, and trained AI agent stay completely intact when you upgrade.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {mode === 'reminder' ? (
                  <Button
                    variant="secondary"
                    onClick={() => void handleSnooze()}
                    loading={snoozing}
                    leading={<Clock size={16} />}
                  >
                    Remind me tomorrow
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => setExtOpen(true)}
                    leading={<Lock size={16} />}
                  >
                    Ask for 7 more days
                  </Button>
                )}
                <Link
                  href={`/app/billing${
                    data.recommendedPlanSlug ? `?plan=${encodeURIComponent(data.recommendedPlanSlug)}` : ''
                  }`}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-o-lime px-6 text-[15px] font-semibold text-o-forest no-underline transition hover:opacity-95"
                >
                  Choose a plan
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-o-on-forest-track/70 p-4">
                <div className="flex items-center gap-2 text-[13px] text-o-mint">
                  <Bot size={15} aria-hidden="true" />
                  <span>AI replies (30d)</span>
                </div>
                <p className="o-num mt-1.5 text-[24px] font-semibold text-o-on-forest">
                  {fmtInt(data.stats.aiConversations30d)}
                </p>
              </div>
              <div className="rounded-2xl bg-o-on-forest-track/70 p-4">
                <div className="flex items-center gap-2 text-[13px] text-o-mint">
                  <Sparkles size={15} aria-hidden="true" />
                  <span>Est. hours saved</span>
                </div>
                <p className="o-num mt-1.5 text-[24px] font-semibold text-o-on-forest">
                  {fmtInt(data.stats.hoursSaved30d)} hrs
                </p>
              </div>
              <div className="rounded-2xl bg-o-on-forest-track/70 p-4">
                <div className="flex items-center gap-2 text-[13px] text-o-mint">
                  <Users size={15} aria-hidden="true" />
                  <span>Team seats</span>
                </div>
                <p className="o-num mt-1.5 text-[24px] font-semibold text-o-on-forest">
                  {fmtInt(data.stats.totalAgents)}
                </p>
              </div>
              <div className="rounded-2xl bg-o-on-forest-track/70 p-4">
                <div className="flex items-center gap-2 text-[13px] text-o-mint">
                  <Radio size={15} aria-hidden="true" />
                  <span>Channels active</span>
                </div>
                <p className="o-num mt-1.5 text-[24px] font-semibold text-o-on-forest">
                  {fmtInt(data.stats.channelsCount)}
                </p>
              </div>
            </div>
          </div>

          {data.latestExtensionRequest ? (
            <Alert
              tone={
                data.latestExtensionRequest.status === 'approved'
                  ? 'ok'
                  : data.latestExtensionRequest.status === 'rejected'
                    ? 'bad'
                    : 'warn'
              }
            >
              Latest extension request (+{data.latestExtensionRequest.requestedDays} days) status:{' '}
              <strong className="capitalize">{data.latestExtensionRequest.status}</strong>
              {data.latestExtensionRequest.reason ? ` — ${data.latestExtensionRequest.reason}` : ''}.
            </Alert>
          ) : null}

          <Card>
            <CardHeader
              title="Available workspace plans"
              sub="Recommended plan is highlighted based on your workspace traffic, seats, and connected channels."
              actions={
                <Segmented
                  label="Billing cadence"
                  value={billingPeriod}
                  onChange={setBillingPeriod}
                  items={[
                    { id: 'monthly', label: 'Monthly' },
                    { id: 'yearly', label: 'Yearly (save ~20%)' },
                  ]}
                />
              }
            />

            {data.plans.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No public plans published"
                  body="Platform super admins can configure plans from the admin console."
                />
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {data.plans.slice(0, 3).map((plan) => {
                  const isRecommended = plan.slug === data.recommendedPlanSlug;
                  const price =
                    billingPeriod === 'yearly'
                      ? Math.round((Number(plan.yearly_price || 0) / 12) * 100) / 100
                      : Number(plan.monthly_price || 0);
                  return (
                    <div
                      key={plan.id}
                      className={cn(
                        'flex flex-col justify-between rounded-[20px] border p-5 transition',
                        isRecommended
                          ? 'border-o-forest bg-o-surface-2/60 shadow-sm'
                          : 'border-o-border bg-o-surface',
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-[17px] font-semibold text-o-text">{plan.name}</h4>
                          {isRecommended ? (
                            <Badge tone="accent">Recommended</Badge>
                          ) : plan.is_popular ? (
                            <Badge tone="neutral">Popular</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[13.5px] text-o-text-2">
                          {plan.description || 'Full omnichannel support workspace'}
                        </p>
                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="o-num text-[32px] font-semibold text-o-text">
                            ${price}
                          </span>
                          <span className="text-[13.5px] text-o-text-3">/ month</span>
                        </div>
                        <ul className="mt-4 flex flex-col gap-2 text-[13.5px] text-o-text-2">
                          <li className="flex items-center gap-2">
                            <Check size={15} className="text-o-forest" aria-hidden="true" />
                            <span>
                              {plan.max_agents === null
                                ? 'Unlimited team seats'
                                : `Up to ${fmtInt(plan.max_agents)} team seats`}
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check size={15} className="text-o-forest" aria-hidden="true" />
                            <span>
                              {plan.max_ai_bot_replies_per_month === null
                                ? 'Unlimited AI bot replies'
                                : `${fmtInt(plan.max_ai_bot_replies_per_month)} AI replies / month`}
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check size={15} className="text-o-forest" aria-hidden="true" />
                            <span>
                              {plan.max_channels_connected === null
                                ? 'All channels included'
                                : `${fmtInt(plan.max_channels_connected)} connected channels`}
                            </span>
                          </li>
                        </ul>
                      </div>

                      <div className="mt-5">
                        <ButtonLink
                          variant={isRecommended ? 'primary' : 'secondary'}
                          className="w-full justify-center"
                          href={`/app/billing?plan=${encodeURIComponent(plan.slug)}&billing=${billingPeriod}`}
                        >
                          Select {plan.name}
                        </ButtonLink>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="o-card__title">Need a short extension or want your archive?</h3>
                <p className="o-card__sub mt-0.5">
                  Workspaces retain export access for 30 days after evaluation ends. You can also request 7 extra days from platform support.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setExtOpen(true)}
                >
                  Request trial extension
                </Button>
                <ButtonLink
                  variant="ghost"
                  size="sm"
                  href="/app/compliance"
                  leading={<Download size={15} />}
                >
                  Data & exports
                </ButtonLink>
              </div>
            </div>
          </Card>

          <Modal
            open={extOpen}
            onClose={() => setExtOpen(false)}
            title="Ask for a trial extension"
            description="Submit a brief note to the ORBAT platform team to extend evaluation days."
            footer={
              <>
                <Button variant="secondary" onClick={() => setExtOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={submittingExt}
                  onClick={() => void handleSubmitExtension()}
                >
                  Submit request
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <Field label="Additional days needed">
                <Segmented
                  label="Additional days"
                  value={String(extDays)}
                  onChange={(v) => setExtDays(Number(v))}
                  items={[
                    { id: '3', label: '+3 days' },
                    { id: '7', label: '+7 days' },
                    { id: '14', label: '+14 days' },
                  ]}
                />
              </Field>
              <Field
                label="What are you still testing?"
                hint="Optional note reviewed by platform operations."
              >
                <Textarea
                  rows={3}
                  value={extReason}
                  onChange={(e) => setExtReason(e.target.value)}
                  placeholder="Testing Shopify order lookups and WhatsApp routing with our support leads..."
                />
              </Field>
            </div>
          </Modal>
        </>
      )}
    </PageContainer>
  );
}
