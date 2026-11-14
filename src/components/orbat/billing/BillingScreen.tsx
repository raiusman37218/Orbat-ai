'use client';

import { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  SlidersHorizontal,
  Sparkles,
  Wallet,
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
  Segmented,
  Skeleton,
  Table,
  Toggle,
  useOrbToast,
  type BadgeTone,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt } from '@/components/orbat/overview/format';
import {
  createWorkspaceCustomerPortalAction,
  fetchBillingDashboard,
  updateBillingProfileAction,
  type BillingDashboardBundle,
  type WorkspaceInvoiceRecord,
} from '@/lib/data/billing';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

type UsageDimension = 'channel' | 'agent' | 'feature';

function fmtUsd(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function invoiceTone(status: WorkspaceInvoiceRecord['status']): BadgeTone {
  if (status === 'paid') return 'ok';
  if (status === 'open') return 'warn';
  return 'bad';
}

export function BillingScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();

  const [usageDim, setUsageDim] = useState<UsageDimension>('channel');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [paygDraft, setPaygDraft] = useState<{
    billingMode: 'fixed' | 'payg';
    autoTopupEnabled: boolean;
    autoTopupThresholdUsd: number;
    autoTopupAmountUsd: number;
    monthlySpendingCapUsd: number;
  } | null>(null);

  const { data, error, loading, reload } = useData<BillingDashboardBundle>(
    () => fetchBillingDashboard(workspace!.id),
    ['billing-studio', workspace?.id],
    { enabled: Boolean(workspace?.id) },
  );

  if (!workspace) return null;

  const profileState = paygDraft ?? (data
    ? {
        billingMode: data.profile.billingMode,
        autoTopupEnabled: data.profile.autoTopupEnabled,
        autoTopupThresholdUsd: data.profile.autoTopupThresholdUsd,
        autoTopupAmountUsd: data.profile.autoTopupAmountUsd,
        monthlySpendingCapUsd: data.profile.monthlySpendingCapUsd ?? 300,
      }
    : null);

  const handleSaveBillingProfile = async (
    nextOverride?: Partial<{
      billingMode: 'fixed' | 'payg';
      autoTopupEnabled: boolean;
      autoTopupThresholdUsd: number;
      autoTopupAmountUsd: number;
      monthlySpendingCapUsd: number;
    }>,
  ) => {
    if (!profileState) return;
    const payload = { ...profileState, ...nextOverride };
    setBusyKey('save-profile');
    const res = await updateBillingProfileAction(workspace.id, payload);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Failed to update billing mode', tone: 'bad' });
      return;
    }
    setPaygDraft(null);
    show({ message: 'Billing settings saved', tone: 'ok' });
    reload();
  };

  const handleOpenPortal = async () => {
    setBusyKey('portal');
    try {
      const res = await createWorkspaceCustomerPortalAction(workspace.id);
      if (res.portalUrl) {
        window.open(res.portalUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Billing portal unavailable right now',
        tone: 'info',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const currentPlanPrice = data
    ? data.overview.subscription.billing_period === 'yearly'
      ? Number(data.overview.plan.yearly_price || 0)
      : Number(data.overview.plan.monthly_price || 0)
    : 0;

  const usageSlice = data
    ? usageDim === 'channel'
      ? data.usageByChannel
      : usageDim === 'agent'
        ? data.usageByAgent
        : data.usageByFeature
    : [];

  const invoiceColumns: Column<WorkspaceInvoiceRecord>[] = [
    {
      key: 'number',
      header: 'Invoice',
      cell: (row) => <span className="o-mono font-semibold">{row.invoiceNumber}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      cell: (row) => (
        <span className="text-o-text-2">
          {new Date(row.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      cell: (row) => (
        <span className="capitalize text-o-text-2">{row.paymentMethod.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (row) => <span className="o-num font-bold">{fmtUsd(row.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <Badge tone={invoiceTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'link',
      header: 'Receipt',
      align: 'right',
      cell: (row) =>
        row.hostedInvoiceUrl || row.pdfUrl ? (
          <a
            href={row.hostedInvoiceUrl || row.pdfUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-o-forest underline"
          >
            Open
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : (
          <span className="text-[12.5px] text-o-text-3">—</span>
        ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Billing & usage"
        description="Manage your subscription plan, pay-as-you-go wallet controls, AI spend limits, and invoices."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data?.overview.subscription.lemonsqueezy_customer_id ? (
              <Button
                variant="secondary"
                size="sm"
                loading={busyKey === 'portal'}
                onClick={handleOpenPortal}
              >
                <ExternalLink size={14} aria-hidden="true" />
                Payment portal
              </Button>
            ) : null}
            <ButtonLink href="/checkout" variant="primary" size="sm">
              Change or upgrade plan
              <ArrowUpRight size={14} aria-hidden="true" />
            </ButtonLink>
          </div>
        }
      />

      {error ? (
        <ErrorState title="Could not load billing data" body={error} onRetry={reload} />
      ) : loading || !data || !profileState ? (
        <div className="grid gap-4">
          <Skeleton className="h-[140px] rounded-[24px]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-[110px] rounded-[20px]" />
            <Skeleton className="h-[110px] rounded-[20px]" />
            <Skeleton className="h-[110px] rounded-[20px]" />
            <Skeleton className="h-[110px] rounded-[20px]" />
          </div>
          <Skeleton className="h-[260px] rounded-[24px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Mode selector + Active Plan / Wallet Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented<'fixed' | 'payg'>
              label="Billing mode"
              value={profileState.billingMode}
              onChange={(mode) => {
                setPaygDraft({ ...profileState, billingMode: mode });
                void handleSaveBillingProfile({ billingMode: mode });
              }}
              items={[
                { id: 'fixed', label: 'Fixed plan' },
                { id: 'payg', label: 'Pay as you go' },
              ]}
            />
            {data.overview.canManageBilling ? (
              <span className="text-[13px] text-o-text-3">
                Billing owner controls active
              </span>
            ) : (
              <span className="text-[13px] text-o-text-3">
                Read-only view · ask workspace owner to modify payment methods
              </span>
            )}
          </div>

          {profileState.billingMode === 'fixed' ? (
            <Card className="bg-o-forest text-o-on-forest">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-o-lime px-3 py-0.5 text-[12px] font-bold text-o-forest">
                      {data.overview.plan.name} plan
                    </span>
                    <Badge tone={data.overview.subscription.status === 'active' ? 'ok' : 'warn'}>
                      {data.overview.subscription.status}
                    </Badge>
                    {data.overview.subscription.status === 'trialing' ? (
                      <span className="text-[13px] text-o-mint">
                        {data.overview.trialDaysRemaining} days left in trial
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="o-num font-o-display text-[32px] font-black">
                      {fmtUsd(currentPlanPrice)}
                    </span>
                    <span className="text-[14px] text-o-mint">
                      / {data.overview.subscription.billing_period === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] text-o-mint/90">
                    Current billing cycle renews{' '}
                    {data.overview.subscription.current_period_end
                      ? new Date(data.overview.subscription.current_period_end).toLocaleDateString()
                      : 'on schedule'}
                    . Extra human teammates stay free inside plan limits.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href="/checkout" variant="primary">
                    <CreditCard size={15} aria-hidden="true" />
                    Upgrade or switch cycle
                  </ButtonLink>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="Pay-as-you-go wallet & spending cap"
                sub="Control automatic credit reloads and monthly AI cost caps."
                actions={
                  <ButtonLink href="/checkout?mode=topup" variant="secondary" size="sm">
                    <Wallet size={14} aria-hidden="true" />
                    Add wallet credit
                  </ButtonLink>
                }
              />
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl bg-o-surface-2 p-4">
                  <div className="text-[12.5px] text-o-text-3">Available credit balance</div>
                  <div className="mt-1 o-num font-o-display text-[28px] font-black">
                    {fmtUsd(data.profile.walletBalanceUsd)}
                  </div>
                  <div className="mt-1 text-[12px] text-o-text-3">
                    Balances update once an invoice payment or transfer clears.
                  </div>
                </div>

                <div className="rounded-2xl bg-o-surface-2 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold">Auto top-up when low</span>
                    <Toggle
                      label="Auto top-up"
                      checked={profileState.autoTopupEnabled}
                      onChange={(checked) =>
                        setPaygDraft({ ...profileState, autoTopupEnabled: checked })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Trigger below ($)">
                      <Input
                        type="number"
                        min={5}
                        value={profileState.autoTopupThresholdUsd}
                        onChange={(e) =>
                          setPaygDraft({
                            ...profileState,
                            autoTopupThresholdUsd: Number(e.target.value) || 5,
                          })
                        }
                      />
                    </Field>
                    <Field label="Reload amount ($)">
                      <Input
                        type="number"
                        min={10}
                        value={profileState.autoTopupAmountUsd}
                        onChange={(e) =>
                          setPaygDraft({
                            ...profileState,
                            autoTopupAmountUsd: Number(e.target.value) || 10,
                          })
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div className="rounded-2xl bg-o-surface-2 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between text-[13.5px] font-semibold">
                      <span>Monthly AI spending cap</span>
                      <span className="o-num font-bold text-o-forest">
                        {fmtUsd(profileState.monthlySpendingCapUsd)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={2000}
                      step={10}
                      aria-label="Monthly AI spending cap"
                      value={profileState.monthlySpendingCapUsd}
                      onChange={(e) =>
                        setPaygDraft({
                          ...profileState,
                          monthlySpendingCapUsd: Number(e.target.value),
                        })
                      }
                      className="mt-3 w-full accent-[var(--forest)]"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={busyKey === 'save-profile'}
                    onClick={() => handleSaveBillingProfile()}
                  >
                    <SlidersHorizontal size={14} aria-hidden="true" />
                    Save PAYG controls
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Plan Meters */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="text-[12.5px] font-medium text-o-text-3">AI bot replies (this month)</div>
              <div className="mt-1 o-num font-o-display text-[24px] font-extrabold">
                {fmtInt(data.meters.aiConversationsUsed)}
                <span className="text-[14px] font-normal text-o-text-3">
                  {' '}/ {data.meters.aiConversationsLimit === null ? 'Unlimited' : fmtInt(data.meters.aiConversationsLimit)}
                </span>
              </div>
              {data.meters.aiConversationsLimit ? (
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-o-surface-2">
                  <div
                    className="h-full rounded-full bg-[var(--ai)]"
                    style={{
                      width: `${Math.min(100, Math.round((data.meters.aiConversationsUsed / data.meters.aiConversationsLimit) * 100))}%`,
                    }}
                  />
                </div>
              ) : null}
            </Card>

            <Card>
              <div className="text-[12.5px] font-medium text-o-text-3">Voice minutes (this month)</div>
              <div className="mt-1 o-num font-o-display text-[24px] font-extrabold">
                {fmtInt(data.meters.voiceMinutesUsed)}
                <span className="text-[14px] font-normal text-o-text-3"> min</span>
              </div>
              <div className="mt-2 text-[12px] text-o-text-3">Aggregated from Voice call logs</div>
            </Card>

            <Card>
              <div className="text-[12.5px] font-medium text-o-text-3">Knowledge sources</div>
              <div className="mt-1 o-num font-o-display text-[24px] font-extrabold">
                {fmtInt(data.meters.knowledgeSourcesCount)}
                <span className="text-[14px] font-normal text-o-text-3">
                  {' '}/ {data.meters.knowledgeSourcesLimit === null ? 'Unlimited' : fmtInt(data.meters.knowledgeSourcesLimit)}
                </span>
              </div>
              <div className="mt-2 text-[12px] text-o-text-3">Articles & indexed bot sources</div>
            </Card>

            <Card>
              <div className="text-[12.5px] font-medium text-o-text-3">Team members</div>
              <div className="mt-1 o-num font-o-display text-[24px] font-extrabold">
                {fmtInt(data.meters.teamMembersCount)}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[12px] text-[var(--ok)] font-medium">
                <CheckCircle2 size={13} aria-hidden="true" />
                Not billed per extra agent seat
              </div>
            </Card>
          </div>

          {/* Cost & Model Router + Usage Breakdown */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="This month & AI model router"
                sub="Live token usage & estimated spend aggregated from ai_token_logs."
                actions={
                  <Badge tone="ai">
                    <Sparkles size={12} className="mr-1" aria-hidden="true" />
                    Model router
                  </Badge>
                }
              />

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-o-surface-2 p-3">
                  <div className="text-[12px] text-o-text-3">Spend to date</div>
                  <div className="mt-0.5 o-num text-[20px] font-extrabold">
                    {fmtUsd(data.thisMonth.spendToDateUsd)}
                  </div>
                </div>
                <div className="rounded-2xl bg-o-surface-2 p-3">
                  <div className="text-[12px] text-o-text-3">Projected month</div>
                  <div className="mt-0.5 o-num text-[20px] font-extrabold">
                    {fmtUsd(data.thisMonth.projectedMonthEndUsd)}
                  </div>
                </div>
                <div className="rounded-2xl bg-o-surface-2 p-3 col-span-2 sm:col-span-1">
                  <div className="text-[12px] text-o-text-3">Tokens processed</div>
                  <div className="mt-0.5 o-num text-[20px] font-extrabold">
                    {fmtInt(data.thisMonth.tokensUsed)}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[12.5px] font-semibold">
                  <span>Routing tier split ({fmtInt(data.thisMonth.aiRequestsCount)} AI calls)</span>
                  <span className="text-o-text-3">Light / Standard / Advanced</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-o-surface-2">
                  {data.modelRouter.map((tier) => (
                    <div
                      key={tier.tier}
                      className={cn(
                        'h-full transition-all',
                        tier.tier === 'light'
                          ? 'bg-[var(--ok)]'
                          : tier.tier === 'standard'
                            ? 'bg-o-lime'
                            : 'bg-[var(--ai)]',
                      )}
                      style={{ width: `${tier.sharePct}%` }}
                      title={`${tier.label}: ${tier.sharePct}%`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {data.modelRouter.map((tier) => (
                    <div key={tier.tier} className="flex items-center justify-between text-[13px]">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-2.5 w-2.5 rounded-full',
                            tier.tier === 'light'
                              ? 'bg-[var(--ok)]'
                              : tier.tier === 'standard'
                                ? 'bg-o-lime'
                                : 'bg-[var(--ai)]',
                          )}
                        />
                        <span className="font-medium">{tier.label}</span>
                      </div>
                      <div className="o-num text-o-text-2">
                        {fmtInt(tier.requests)} calls ({tier.sharePct}%) · {fmtUsd(tier.costUsd)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Usage breakdown"
                sub="This month's conversation & AI activity distribution."
                actions={
                  <Segmented<UsageDimension>
                    label="Usage dimension"
                    value={usageDim}
                    onChange={setUsageDim}
                    items={[
                      { id: 'channel', label: 'Channel' },
                      { id: 'agent', label: 'Agent' },
                      { id: 'feature', label: 'Feature' },
                    ]}
                  />
                }
              />

              {usageSlice.length === 0 ? (
                <EmptyState
                  className="mt-4"
                  title="No usage logged this month yet"
                  body="Usage slices populate automatically as conversations and AI tasks run."
                />
              ) : (
                <div className="mt-4 flex flex-col gap-2.5">
                  {usageSlice.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-2xl bg-o-surface-2 px-3.5 py-2.5 text-[13.5px]"
                    >
                      <span className="font-semibold capitalize">{row.label}</span>
                      <span className="o-num text-o-text-2">
                        {fmtInt(row.count)} {usageDim === 'feature' ? 'calls' : 'conversations'}
                        {row.costUsd > 0 ? ` · ${fmtUsd(row.costUsd)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Invoices Table */}
          <Card>
            <CardHeader
              title="Invoices & payment history"
              sub="All subscription invoices, manual bank transfers, and billing records."
              actions={
                <Button variant="quiet" size="sm" onClick={reload}>
                  <Download size={14} aria-hidden="true" />
                  Refresh
                </Button>
              }
            />

            {data.invoices.length === 0 ? (
              <EmptyState
                className="mt-3"
                title="No invoices yet"
                body="Paid subscription invoices or pending bank transfer requests will appear here."
              />
            ) : (
              <div className="mt-3">
                <Table
                  caption="Workspace invoices"
                  rows={data.invoices}
                  rowKey={(row) => row.id}
                  columns={invoiceColumns}
                />
              </div>
            )}

            <Alert tone="ok" className="mt-4">
              Need an enterprise purchase order or custom billing volume? Submit a bank transfer request from Checkout and it will appear as an open invoice immediately.
            </Alert>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
