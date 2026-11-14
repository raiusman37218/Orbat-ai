'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Lock,
  Minus,
  Plus,
  Receipt,
  Sparkles,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  Segmented,
  Skeleton,
  useOrbToast,
} from '@/components/orbat/primitives';
import { OrbatMark } from '@/components/orbat/shell/Sidebar';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { calculateCheckoutBreakdown, type BillingPeriod } from '@/lib/billing/cost-calculator';
import {
  fetchCheckoutInitialData,
  submitCheckoutAction,
  validateCheckoutCouponAction,
} from '@/lib/data/billing';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

type PaymentMethodKind = 'card' | 'paypal' | 'jazzcash' | 'easypaisa' | 'bank_transfer';

const PAYMENT_METHODS: {
  id: PaymentMethodKind;
  label: string;
  hint: string;
  configured: boolean;
}[] = [
  { id: 'card', label: 'Card / Lemon Squeezy', hint: 'Instant hosted card & Apple Pay checkout', configured: true },
  { id: 'bank_transfer', label: 'Bank wire / Invoice', hint: 'Creates a payable open invoice immediately', configured: true },
  { id: 'paypal', label: 'PayPal', hint: 'Gateway not yet configured', configured: false },
  { id: 'jazzcash', label: 'JazzCash', hint: 'Local rail not yet connected', configured: false },
  { id: 'easypaisa', label: 'Easypaisa', hint: 'Local rail not yet connected', configured: false },
];

function fmtUsd(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function CheckoutScreen() {
  const { workspace, agent } = useShellSession();
  const { show } = useOrbToast();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod | null>(null);
  const [seatCount, setSeatCount] = useState(3);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKind>('card');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [billingEmail, setBillingEmail] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [taxId, setTaxId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    summary: string;
  } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState<{
    invoiceNumber: string;
    amountUsd: number;
  } | null>(null);

  const { data, error, loading, reload } = useData(
    () => fetchCheckoutInitialData(workspace.id),
    ['checkout-init', workspace.id],
    { enabled: Boolean(workspace.id) },
  );

  const plans = data?.plans ?? [];
  const defaultPlan =
    plans.find((p) => p.slug === 'pro') ??
    plans.find((p) => p.slug !== data?.currentPlanSlug) ??
    plans[0] ??
    null;

  const activePlan = plans.find((p) => p.id === selectedPlanId) ?? defaultPlan;
  const activePeriod: BillingPeriod = billingPeriod ?? data?.currentPeriod ?? 'monthly';

  const effectiveCompany = companyName ?? data?.profile.billingCompanyName ?? workspace.name;
  const effectiveEmail = billingEmail ?? data?.profile.billingEmail ?? agent.email;
  const effectiveCountry = country ?? data?.profile.billingCountry ?? 'United States';
  const effectiveTaxId = taxId ?? data?.profile.taxId ?? '';

  const breakdown = activePlan
    ? calculateCheckoutBreakdown({
        monthlyPriceUsd: Number(activePlan.monthly_price || 0),
        yearlyPriceUsd: Number(activePlan.yearly_price || 0),
        billingPeriod: activePeriod,
        seatCount,
        includedSeats: activePlan.max_agents ?? 5,
        extraSeatMonthlyUsd: 0,
        discountType: appliedCoupon?.discountType ?? null,
        discountValue: appliedCoupon?.discountValue ?? null,
      })
    : null;

  const handleValidateCoupon = async () => {
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    const res = await validateCheckoutCouponAction(workspace.id, couponInput.trim(), activePlan?.id);
    setCheckingCoupon(false);
    if (!res.valid || !res.coupon) {
      show({ message: res.error || 'Invalid coupon code', tone: 'bad' });
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon({
      code: res.coupon.code,
      discountType: res.coupon.discount_type,
      discountValue: Number(res.coupon.discount_value),
      summary: res.discountSummary || `${res.coupon.code} applied`,
    });
    show({ message: `Applied ${res.discountSummary || res.coupon.code}`, tone: 'ok' });
  };

  const handleCheckout = async () => {
    if (!activePlan) return;
    if (!effectiveCompany.trim() || !effectiveEmail.trim()) {
      show({ message: 'Enter company name and billing email', tone: 'bad' });
      return;
    }
    setSubmitting(true);
    const res = await submitCheckoutAction(workspace.id, {
      planId: activePlan.id,
      billingPeriod: activePeriod,
      seatCount,
      paymentMethod,
      companyName: effectiveCompany,
      billingEmail: effectiveEmail,
      country: effectiveCountry,
      taxId: effectiveTaxId,
      couponCode: appliedCoupon?.code,
    });
    setSubmitting(false);

    if (!res.success) {
      show({ message: res.error, tone: 'bad' });
      return;
    }
    if (res.mode === 'redirect') {
      window.location.href = res.checkoutUrl;
      return;
    }
    setPendingInvoice({
      invoiceNumber: res.invoiceNumber,
      amountUsd: res.amountUsd,
    });
    show({ message: `Invoice ${res.invoiceNumber} created`, tone: 'ok' });
  };

  return (
    <div className="min-h-dvh bg-o-bg text-o-text">
      {/* Compact Checkout Header matching Checkout.dc.html */}
      <header className="border-b border-o-border bg-o-surface px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/app/billing" className="flex items-center gap-2.5 text-o-text no-underline">
              <OrbatMark size={34} />
              <span className="font-o-display text-[17px] font-black tracking-[-0.01em]">
                ORBAT Checkout
              </span>
            </Link>
            <Badge tone="neutral">{workspace.name}</Badge>
          </div>
          <ButtonLink href="/app/billing" variant="quiet" size="sm">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to Billing
          </ButtonLink>
        </div>
      </header>

      <main className="mx-auto max-w-[1160px] px-4 py-8 sm:px-8">
        {error ? (
          <ErrorState title="Could not load checkout" body={error} onRetry={reload} />
        ) : loading || !data ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Skeleton className="h-[540px] rounded-[24px]" />
            <Skeleton className="h-[420px] rounded-[24px]" />
          </div>
        ) : pendingInvoice ? (
          <Card className="mx-auto max-w-[560px] text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-o-lime text-o-forest">
              <CheckCircle2 size={28} aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-o-display text-[24px] font-extrabold">
              Bank transfer invoice generated
            </h1>
            <p className="mt-2 text-[14.5px] text-o-text-2">
              Invoice <span className="o-mono font-bold text-o-text">{pendingInvoice.invoiceNumber}</span> for{' '}
              <span className="o-num font-bold text-o-text">{fmtUsd(pendingInvoice.amountUsd)}</span> has been added as an open invoice in Billing.
            </p>
            <p className="mt-2 text-[13px] text-o-text-3">
              Include your invoice number in the wire reference; your workspace plan activates automatically once reconciled.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <ButtonLink href="/app/billing" variant="primary">
                <Receipt size={15} aria-hidden="true" />
                View invoice in Billing
              </ButtonLink>
              <Button variant="secondary" onClick={() => setPendingInvoice(null)}>
                Modify order
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            {/* Left checkout steps */}
            <div className="flex flex-col gap-5">
              {/* 1. Plan & Cycle */}
              <Card>
                <CardHeader
                  title="1. Select plan & billing cycle"
                  sub={`Currently on ${data.currentPlanSlug.toUpperCase()}.`}
                  actions={
                    <Segmented<BillingPeriod>
                      label="Billing cycle"
                      value={activePeriod}
                      onChange={setBillingPeriod}
                      items={[
                        { id: 'monthly', label: 'Monthly' },
                        { id: 'yearly', label: 'Yearly (save ~17%)' },
                      ]}
                    />
                  }
                />

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {plans.map((p) => {
                    const price =
                      activePeriod === 'yearly' ? Number(p.yearly_price || 0) : Number(p.monthly_price || 0);
                    const selected = activePlan?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedPlanId(p.id)}
                        className={cn(
                          'flex flex-col justify-between rounded-2xl border p-4 text-left transition-colors',
                          selected
                            ? 'border-o-forest bg-o-lime/25'
                            : 'border-o-border bg-o-surface hover:bg-o-surface-2',
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-o-display text-[15.5px] font-extrabold">{p.name}</span>
                            {p.is_popular ? <Badge tone="ok">Popular</Badge> : null}
                          </div>
                          <p className="mt-1 text-[12.5px] text-o-text-3 line-clamp-2">
                            {p.description || `${p.max_ai_bot_replies_per_month ?? 'Unlimited'} AI replies / mo`}
                          </p>
                        </div>
                        <div className="mt-3 o-num font-o-display text-[22px] font-black">
                          {fmtUsd(price)}
                          <span className="text-[12px] font-normal text-o-text-3">
                            /{activePeriod === 'yearly' ? 'yr' : 'mo'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-o-surface-2 px-4 py-3">
                  <div>
                    <div className="text-[14px] font-semibold">Estimated team seats needed</div>
                    <div className="text-[12px] text-o-text-3">
                      {activePlan?.max_agents
                        ? `Up to ${activePlan.max_agents} seats included cleanly`
                        : 'Unlimited human seats included on this plan'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon
                      aria-label="Decrease seats"
                      onClick={() => setSeatCount((s) => Math.max(1, s - 1))}
                    >
                      <Minus size={14} aria-hidden="true" />
                    </Button>
                    <span className="o-num min-w-[2.5rem] text-center text-[15px] font-bold">
                      {seatCount}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon
                      aria-label="Increase seats"
                      onClick={() => setSeatCount((s) => Math.min(250, s + 1))}
                    >
                      <Plus size={14} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Card>

              {/* 2. Payment Method */}
              <Card>
                <CardHeader
                  title="2. Payment method"
                  sub="Hosted Lemon Squeezy card processing or open invoice wire request."
                />
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {PAYMENT_METHODS.map((pm) => {
                    const selected = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPaymentMethod(pm.id)}
                        className={cn(
                          'flex items-start justify-between gap-2 rounded-2xl border p-3.5 text-left transition-colors',
                          selected
                            ? 'border-o-forest bg-o-lime/25'
                            : 'border-o-border bg-o-surface hover:bg-o-surface-2',
                        )}
                      >
                        <div>
                          <div className="text-[14px] font-semibold">{pm.label}</div>
                          <div className="mt-0.5 text-[12px] text-o-text-3">{pm.hint}</div>
                        </div>
                        <Badge tone={pm.configured ? 'ok' : 'warn'}>
                          {pm.configured ? 'Available' : 'Unconfigured'}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* 3. Billing details */}
              <Card>
                <CardHeader title="3. Billing details" sub="Shown on PDF receipts and tax invoices." />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Company or legal name">
                    <Input
                      value={effectiveCompany}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </Field>
                  <Field label="Billing email">
                    <Input
                      type="email"
                      value={effectiveEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                    />
                  </Field>
                  <Field label="Country / region">
                    <Input
                      value={effectiveCountry}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </Field>
                  <Field label="Tax ID / VAT (optional)">
                    <Input
                      value={effectiveTaxId}
                      placeholder="Optional"
                      onChange={(e) => setTaxId(e.target.value)}
                    />
                  </Field>
                </div>
              </Card>
            </div>

            {/* Right sticky order summary */}
            <Card className="lg:sticky lg:top-6">
              <CardHeader
                title="Order summary"
                sub={activePlan ? `${activePlan.name} · ${activePeriod}` : 'Select a plan'}
              />

              {activePlan && breakdown ? (
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-o-text-2">
                      {activePlan.name} ({activePeriod})
                    </span>
                    <span className="o-num font-semibold">{fmtUsd(breakdown.basePlanUsd)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-o-text-2">Team seats ({seatCount})</span>
                    <span className="o-num text-o-text-2">Included</span>
                  </div>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between text-[14px] text-[var(--ok)]">
                      <span>Coupon ({appliedCoupon.code})</span>
                      <span className="o-num font-semibold">−{fmtUsd(breakdown.discountUsd)}</span>
                    </div>
                  ) : null}

                  <div className="border-t border-o-border pt-3 flex items-baseline justify-between">
                    <span className="text-[15px] font-bold">Total due</span>
                    <span className="o-num font-o-display text-[26px] font-black">
                      {fmtUsd(breakdown.totalDueUsd)}
                    </span>
                  </div>

                  {/* Coupon input */}
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={couponInput}
                      placeholder="Promo code"
                      onChange={(e) => setCouponInput(e.target.value)}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={checkingCoupon}
                      onClick={handleValidateCoupon}
                    >
                      Apply
                    </Button>
                  </div>

                  {!PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.configured ? (
                    <Alert tone="warn" className="mt-2">
                      {paymentMethod.toUpperCase()} is not enabled on this server yet. Switch to Card or Bank wire to proceed.
                    </Alert>
                  ) : null}

                  <Button
                    variant="primary"
                    className="mt-2 w-full justify-center"
                    loading={submitting}
                    onClick={handleCheckout}
                  >
                    <CreditCard size={16} aria-hidden="true" />
                    {paymentMethod === 'bank_transfer'
                      ? 'Generate payable wire invoice'
                      : 'Continue to secure payment'}
                  </Button>

                  <div className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-o-text-3">
                    <Lock size={12} aria-hidden="true" />
                    Encrypted billing · Cancel or switch anytime
                  </div>

                  <div className="mt-2 rounded-2xl bg-o-surface-2 p-3 text-[12.5px] text-o-text-2">
                    <div className="flex items-center gap-1.5 font-semibold text-o-text">
                      <Building2 size={14} aria-hidden="true" />
                      No silent auto-charges
                    </div>
                    <p className="mt-1">
                      Hosted card checkouts complete through Lemon Squeezy webhooks; bank transfers create a real open invoice inside Billing.
                    </p>
                  </div>
                </div>
              ) : (
                <Alert tone="ai" className="mt-3">
                  <Sparkles size={14} className="inline mr-1" aria-hidden="true" />
                  No active plans found in platform catalog.
                </Alert>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
