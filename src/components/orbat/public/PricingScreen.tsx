'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, HelpCircle, Sparkles } from 'lucide-react';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Segmented,
  Skeleton,
} from '@/components/orbat/primitives';
import { fmtInt } from '@/components/orbat/overview/format';
import { loadPublicPricing } from '@/lib/data/pricing';
import { useData } from '@/lib/data/use-data';
import { calculatePerSeatComparison } from '@/lib/lifecycle/onboarding-catalog';
import { cn } from '@/lib/utils';

const PRICING_FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'Do you charge per support agent seat?',
    a: 'Only fixed seat caps apply on entry tiers — Pro and Enterprise include unlimited human agent seats with shared team inbox workflows so your billing scales with resolutions rather than headcount.',
  },
  {
    q: 'What happens at the end of my 14-day free trial?',
    a: 'Nothing is deleted. You can pick any fixed plan, request a 7-day extension if you are still testing integrations, or export your data cleanly within 30 days.',
  },
  {
    q: 'How does Pay-as-you-go AI model routing work?',
    a: 'Simple FAQ greetings route to the low-cost Light model tier while complex refunds, order lookups, and compliance reviews route to Standard or Advanced tiers — you pay exact unit rates per resolved message.',
  },
  {
    q: 'Can I switch between Fixed and Pay-as-you-go billing?',
    a: 'Yes. Workspaces can upgrade, downgrade, or change billing cadences inside Workspace Settings -> Billing.',
  },
];

export function PricingScreen() {
  const { data, error, loading, reload } = useData(
    () => loadPublicPricing(),
    ['public-pricing'],
  );

  const [pricingModel, setPricingModel] = useState<'fixed' | 'payg'>('fixed');
  const [cadence, setCadence] = useState<'monthly' | 'yearly'>('yearly');
  const [agentCount, setAgentCount] = useState<number>(8);
  const [competitorPerSeat, setCompetitorPerSeat] = useState<number>(65);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const baselinePlanPrice = useMemo(() => {
    const popular = data?.plans.find((p) => p.is_popular) ?? data?.plans[0];
    if (!popular) return 99;
    return cadence === 'yearly'
      ? Math.round(Number(popular.yearly_price || 0) / 12) || Number(popular.monthly_price || 99)
      : Number(popular.monthly_price || 99);
  }, [data, cadence]);

  const comparison = useMemo(
    () =>
      calculatePerSeatComparison({
        agentsCount: agentCount,
        competitorPerSeatUsd: competitorPerSeat,
        fixedMonthlyPlanUsd: baselinePlanPrice,
      }),
    [agentCount, competitorPerSeat, baselinePlanPrice],
  );

  return (
    <div className="min-h-screen bg-o-bg text-o-text">
      {/* Public top bar */}
      <header className="border-b border-o-border bg-o-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <span className="grid size-8 place-items-center rounded-xl bg-o-forest font-bold text-o-lime">
              O
            </span>
            <span className="text-[16px] font-semibold tracking-tight text-o-text">
              ORBAT
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-[14px] font-medium text-o-text-2 sm:flex">
            <Link href="/v2/pricing" className="text-o-text no-underline">
              Pricing
            </Link>
            <Link href="/v2/help" className="no-underline hover:text-o-text">
              Help center
            </Link>
            <Link href="/v2/widget" className="no-underline hover:text-o-text">
              Widget showcase
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {data?.isSignedIn ? (
              <ButtonLink href="/app" size="sm" variant="primary">
                Open workspace
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" size="sm" variant="quiet">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/signup" size="sm" variant="primary">
                  Start free trial
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 py-10 sm:px-8 sm:py-16">
        <section className="mx-auto max-w-[740px] text-center">
          <Badge tone="accent">Transparent AI support pricing</Badge>
          <h1 className="mt-4 text-[34px] font-semibold leading-tight tracking-tight text-o-text sm:text-[48px]">
            Pay for outcomes, not bloated seat licenses
          </h1>
          <p className="mt-3 text-[16px] text-o-text-2 sm:text-[18px]">
            Start with a 14-day full-feature trial. Choose predictable monthly tiers or zero-commitment Pay-as-you-go usage rates.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Segmented
              label="Pricing model"
              value={pricingModel}
              onChange={setPricingModel}
              items={[
                { id: 'fixed', label: 'Fixed plans' },
                { id: 'payg', label: 'Pay-as-you-go' },
              ]}
            />
            {pricingModel === 'fixed' && (
              <Segmented
                label="Billing cadence"
                value={cadence}
                onChange={setCadence}
                items={[
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'yearly', label: 'Yearly (save 20%)' },
                ]}
              />
            )}
          </div>
        </section>

        {loading && !data ? (
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-[420px] rounded-[24px]" />
            <Skeleton className="h-[420px] rounded-[24px]" />
            <Skeleton className="h-[420px] rounded-[24px]" />
          </div>
        ) : error && !data ? (
          <ErrorState title="Could not load live plans" body={error} onRetry={reload} />
        ) : !data ? (
          <EmptyState title="Pricing unavailable" body="Refresh to reload pricing." />
        ) : pricingModel === 'fixed' ? (
          <section aria-label="Fixed monthly plans">
            {data.plans.length === 0 ? (
              <EmptyState
                title="No public plans published"
                body="Plans configured in Super Admin with public visibility will appear here."
              />
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                {data.plans.map((plan) => {
                  const monthlyAmount =
                    cadence === 'yearly'
                      ? Math.round((Number(plan.yearly_price || 0) / 12) * 100) / 100
                      : Number(plan.monthly_price || 0);
                  const ctaHref = data.isSignedIn
                    ? `/app/billing?plan=${encodeURIComponent(plan.slug)}&billing=${cadence}`
                    : `/v2/onboarding?plan=${encodeURIComponent(plan.slug)}&billing=${cadence}`;

                  return (
                    <Card
                      key={plan.id}
                      size="lg"
                      className={cn(
                        'flex flex-col justify-between',
                        plan.is_popular && 'border-o-forest ring-1 ring-o-forest/20',
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-[20px] font-semibold text-o-text">
                            {plan.name}
                          </h2>
                          {plan.is_popular ? (
                            <Badge tone="accent">Most popular</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1.5 min-h-[42px] text-[14px] text-o-text-2">
                          {plan.description || 'Omnichannel inbox & AI automation'}
                        </p>

                        <div className="mt-5 flex items-baseline gap-1.5">
                          <span className="o-num text-[40px] font-semibold tracking-tight text-o-text">
                            ${monthlyAmount}
                          </span>
                          <span className="text-[14px] text-o-text-3">
                            / month {cadence === 'yearly' && monthlyAmount > 0 ? 'billed yearly' : ''}
                          </span>
                        </div>

                        <ul className="mt-6 flex flex-col gap-2.5 text-[14px] text-o-text-2">
                          <li className="flex items-center gap-2">
                            <Check size={16} className="shrink-0 text-o-forest" aria-hidden="true" />
                            <span>
                              {plan.max_agents === null
                                ? 'Unlimited human agent seats'
                                : `Up to ${fmtInt(plan.max_agents)} team seats`}
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check size={16} className="shrink-0 text-o-forest" aria-hidden="true" />
                            <span>
                              {plan.max_ai_bot_replies_per_month === null
                                ? 'Unlimited AI replies'
                                : `${fmtInt(plan.max_ai_bot_replies_per_month)} AI replies / month`}
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check size={16} className="shrink-0 text-o-forest" aria-hidden="true" />
                            <span>
                              {plan.max_channels_connected === null
                                ? 'All messaging & email channels'
                                : `${fmtInt(plan.max_channels_connected)} connected channels`}
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check size={16} className="shrink-0 text-o-forest" aria-hidden="true" />
                            <span>
                              {plan.trial_days > 0
                                ? `${plan.trial_days}-day free trial included`
                                : 'Instant activation'}
                            </span>
                          </li>
                        </ul>
                      </div>

                      <div className="mt-7">
                        <ButtonLink
                          href={ctaHref}
                          variant={plan.is_popular ? 'primary' : 'secondary'}
                          className="w-full justify-center"
                          trailing={<ArrowRight size={15} />}
                        >
                          {data.isSignedIn ? `Switch to ${plan.name}` : `Start ${plan.name}`}
                        </ButtonLink>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section aria-label="Pay as you go rates" className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Card size="lg">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-o-forest" aria-hidden="true" />
                <h2 className="text-[20px] font-semibold text-o-text">
                  Live unit-metered Pay-as-you-go rates
                </h2>
              </div>
              <p className="mt-1.5 text-[14.5px] text-o-text-2">
                $0 fixed seat charge. Ideal for seasonal stores and lean support operations paying strictly per conversation handled.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-o-border p-4">
                  <p className="text-[13px] text-o-text-3">Base conversation routing</p>
                  <p className="o-num mt-1 text-[24px] font-semibold text-o-text">
                    ${data.paygRates.conversationBaseUsd.toFixed(2)}
                    <span className="text-[13px] font-normal text-o-text-3"> / thread</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-o-border p-4">
                  <p className="text-[13px] text-o-text-3">AI Light / FAQ resolution</p>
                  <p className="o-num mt-1 text-[24px] font-semibold text-o-text">
                    ${data.paygRates.aiLightUsd.toFixed(2)}
                    <span className="text-[13px] font-normal text-o-text-3"> / reply</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-o-border p-4">
                  <p className="text-[13px] text-o-text-3">AI Standard resolution</p>
                  <p className="o-num mt-1 text-[24px] font-semibold text-o-text">
                    ${data.paygRates.aiStandardUsd.toFixed(2)}
                    <span className="text-[13px] font-normal text-o-text-3"> / reply</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-o-border p-4">
                  <p className="text-[13px] text-o-text-3">AI Advanced / Policy resolution</p>
                  <p className="o-num mt-1 text-[24px] font-semibold text-o-text">
                    ${data.paygRates.aiAdvancedUsd.toFixed(2)}
                    <span className="text-[13px] font-normal text-o-text-3"> / reply</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-o-border p-4">
                  <p className="text-[13px] text-o-text-3">Voice support calls</p>
                  <p className="o-num mt-1 text-[24px] font-semibold text-o-text">
                    ${data.paygRates.voiceMinuteUsd.toFixed(2)}
                    <span className="text-[13px] font-normal text-o-text-3"> / minute</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-o-border p-4">
                  <p className="text-[13px] text-o-text-3">Website compliance audit</p>
                  <p className="o-num mt-1 text-[24px] font-semibold text-o-text">
                    ${data.paygRates.websiteAuditUsd.toFixed(2)}
                    <span className="text-[13px] font-normal text-o-text-3"> / scan</span>
                  </p>
                </div>
              </div>
            </Card>

            <Card size="lg" className="bg-o-forest text-o-on-forest flex flex-col justify-between">
              <div>
                <Badge tone="solid">Zero seat fees</Badge>
                <h3 className="mt-4 text-[22px] font-semibold">
                  Invite your whole company at no per-user cost
                </h3>
                <p className="mt-2 text-[14.5px] text-o-mint">
                  Includes help center portal, ticket status tracking, Shopify/CRM context cards, and team schedules.
                </p>
              </div>
              <div className="mt-6">
                <Link
                  href="/v2/onboarding?mode=payg"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-o-lime px-6 text-[15px] font-semibold text-o-forest no-underline"
                >
                  Start free Pay-as-you-go trial
                  <ArrowRight size={16} />
                </Link>
              </div>
            </Card>
          </section>
        )}

        {/* Per-seat savings calculator */}
        <Card size="lg">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <Badge tone="accent">Team savings calculator</Badge>
              <h2 className="mt-2 text-[22px] font-semibold text-o-text">
                Compare ORBAT against per-seat legacy helpdesks
              </h2>
              <p className="mt-1 text-[14.5px] text-o-text-2">
                Adjust team headcount and your current per-seat license cost to estimate monthly savings.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label={`Human support teammates: ${agentCount}`}>
                  <input
                    type="range"
                    min={1}
                    max={80}
                    value={agentCount}
                    onChange={(e) => setAgentCount(Number(e.target.value))}
                    className="w-full accent-o-forest"
                  />
                </Field>
                <Field label="Legacy per-seat price ($ USD)">
                  <Input
                    type="number"
                    min={10}
                    max={300}
                    value={competitorPerSeat}
                    onChange={(e) => setCompetitorPerSeat(Number(e.target.value) || 65)}
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-[20px] border border-o-border bg-o-surface-2/60 p-6">
              <div className="flex justify-between text-[14px] text-o-text-2">
                <span>Typical per-seat helpdesk ({comparison.agentsCount} seats)</span>
                <span className="o-num font-semibold text-o-text">
                  ${fmtInt(comparison.competitorMonthlyUsd)}/mo
                </span>
              </div>
              <div className="mt-2 flex justify-between text-[14px] text-o-text-2">
                <span>ORBAT fixed team tier</span>
                <span className="o-num font-semibold text-o-forest">
                  ${fmtInt(comparison.orbatMonthlyUsd)}/mo
                </span>
              </div>
              <div className="mt-4 border-t border-o-border pt-4 flex items-baseline justify-between">
                <span className="text-[14px] font-medium text-o-text">Estimated monthly savings</span>
                <span className="o-num text-[30px] font-semibold text-o-forest">
                  ${fmtInt(comparison.monthlySavingsUsd)}/mo
                </span>
              </div>
            </div>
          </div>
        </Card>

        {!data?.stripeCheckoutConfigured && (
          <Alert tone="ai">
            Self-serve card checkout links are provisioned inside your workspace billing panel after creating your account.
          </Alert>
        )}

        {/* FAQ Accordion */}
        <section aria-label="Pricing FAQ" className="mx-auto w-full max-w-[820px]">
          <div className="mb-4 flex items-center gap-2">
            <HelpCircle size={18} className="text-o-forest" aria-hidden="true" />
            <h2 className="text-[22px] font-semibold text-o-text">Frequently asked questions</h2>
          </div>
          <div className="flex flex-col gap-2.5">
            {PRICING_FAQS.map((item, idx) => {
              const open = openFaqIdx === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-o-border bg-o-surface"
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaqIdx(open ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-o-text"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      size={17}
                      aria-hidden="true"
                      className={cn(
                        'shrink-0 text-o-text-3 transition-transform',
                        open && 'rotate-180',
                      )}
                    />
                  </button>
                  {open && (
                    <div className="border-t border-o-border px-5 py-3.5 text-[14.5px] leading-relaxed text-o-text-2">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
