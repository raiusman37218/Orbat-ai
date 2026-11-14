'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import {
  getPublicPlansAction,
  getWorkspaceBillingAndUsageAction,
  validateCouponAction,
} from '@/app/actions/plans';
import { createWorkspaceCheckoutAction } from '@/app/actions/platform-management';
import type { PlatformPlan, WorkspaceBillingOverview } from '@/types/plans';
import {
  calculateCheckoutBreakdown,
  classifyModelTier,
  projectMonthlySpend,
  roundUsd,
} from '@/lib/billing/cost-calculator';

export interface BillingProfileRecord {
  billingMode: 'fixed' | 'payg';
  walletBalanceUsd: number;
  autoTopupEnabled: boolean;
  autoTopupThresholdUsd: number;
  autoTopupAmountUsd: number;
  monthlySpendingCapUsd: number | null;
  billingCompanyName: string;
  billingEmail: string;
  billingCountry: string;
  taxId: string;
}

export interface WorkspaceInvoiceRecord {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  billingReason: string;
  paymentMethod: string;
  paymentReference: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  seatCount: number;
  paidAt: string | null;
  createdAt: string;
}

export interface ModelTierBreakdown {
  tier: 'light' | 'standard' | 'advanced';
  label: string;
  requests: number;
  tokens: number;
  costUsd: number;
  sharePct: number;
}

export interface UsageSliceRow {
  label: string;
  count: number;
  costUsd: number;
}

export interface BillingDashboardBundle {
  overview: WorkspaceBillingOverview;
  plans: PlatformPlan[];
  profile: BillingProfileRecord;
  meters: {
    aiConversationsUsed: number;
    aiConversationsLimit: number | null;
    voiceMinutesUsed: number;
    voiceMinutesLimit: number | null;
    knowledgeSourcesCount: number;
    knowledgeSourcesLimit: number | null;
    teamMembersCount: number;
  };
  thisMonth: {
    spendToDateUsd: number;
    projectedMonthEndUsd: number;
    tokensUsed: number;
    aiRequestsCount: number;
  };
  modelRouter: ModelTierBreakdown[];
  usageByChannel: UsageSliceRow[];
  usageByAgent: UsageSliceRow[];
  usageByFeature: UsageSliceRow[];
  invoices: WorkspaceInvoiceRecord[];
}

export async function getBillingDashboardAction(
  workspaceId: string,
): Promise<{ success: true; data: BillingDashboardBundle } | { success: false; error: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'manage_settings');

    const [
      overview,
      plans,
      wsRows,
      profileRows,
      voiceRows,
      kbCountRows,
      teamCountRows,
      tokenRows,
      channelRows,
      agentRows,
      featureRows,
      invoiceRows,
    ] = await Promise.all([
      getWorkspaceBillingAndUsageAction(workspaceId),
      getPublicPlansAction(),
      queryRows<{ name: string; ai_monthly_cost_cap_usd: string | null }>(
        `SELECT name, ai_monthly_cost_cap_usd::text FROM public.workspaces WHERE id = $1 LIMIT 1`,
        [workspaceId],
      ),
      queryRows<{
        billing_mode: 'fixed' | 'payg';
        wallet_balance_usd: string;
        auto_topup_enabled: boolean;
        auto_topup_threshold_usd: string;
        auto_topup_amount_usd: string;
        monthly_spending_cap_usd: string | null;
        billing_company_name: string | null;
        billing_email: string | null;
        billing_country: string;
        tax_id: string | null;
      }>(
        `INSERT INTO public.workspace_billing_profiles (workspace_id)
         VALUES ($1)
         ON CONFLICT (workspace_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id
         RETURNING billing_mode, wallet_balance_usd::text, auto_topup_enabled,
                   auto_topup_threshold_usd::text, auto_topup_amount_usd::text,
                   monthly_spending_cap_usd::text, billing_company_name,
                   billing_email, billing_country, tax_id`,
        [workspaceId],
      ),
      queryRows<{ secs: string }>(
        `SELECT COALESCE(SUM(duration_seconds), 0)::text AS secs
         FROM public.voice_calls
         WHERE workspace_id = $1 AND created_at >= date_trunc('month', now())`,
        [workspaceId],
      ).catch(() => [{ secs: '0' }]),
      queryRows<{ cnt: string }>(
        `SELECT (
           COALESCE((SELECT COUNT(*) FROM public.bot_knowledge WHERE workspace_id = $1), 0) +
           COALESCE((SELECT COUNT(*) FROM public.articles WHERE workspace_id = $1 AND status = 'published'), 0)
         )::text AS cnt`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.agents WHERE workspace_id = $1 AND is_active = true`,
        [workspaceId],
      ).catch(() => [{ cnt: '1' }]),
      queryRows<{
        model: string | null;
        reqs: string;
        toks: string;
        cost: string;
      }>(
        `SELECT COALESCE(model, 'standard') AS model,
                COUNT(*)::text AS reqs,
                COALESCE(SUM(total_tokens), 0)::text AS toks,
                COALESCE(SUM(cost_usd), 0)::text AS cost
         FROM public.ai_token_logs
         WHERE workspace_id = $1 AND created_at >= date_trunc('month', now())
         GROUP BY COALESCE(model, 'standard')`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{ label: string; cnt: string }>(
        `SELECT COALESCE(channel, 'widget') AS label, COUNT(*)::text AS cnt
         FROM public.conversations
         WHERE workspace_id = $1 AND created_at >= date_trunc('month', now())
         GROUP BY COALESCE(channel, 'widget')
         ORDER BY COUNT(*) DESC
         LIMIT 6`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{ label: string; cnt: string }>(
        `SELECT COALESCE(a.name, 'ORBAT AI') AS label, COUNT(*)::text AS cnt
         FROM public.conversations c
         LEFT JOIN public.agents a ON a.id = c.assigned_agent_id
         WHERE c.workspace_id = $1 AND c.created_at >= date_trunc('month', now())
         GROUP BY COALESCE(a.name, 'ORBAT AI')
         ORDER BY COUNT(*) DESC
         LIMIT 6`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{ label: string; cnt: string; cost: string }>(
        `SELECT COALESCE(purpose, 'reply_generation') AS label,
                COUNT(*)::text AS cnt,
                COALESCE(SUM(cost_usd), 0)::text AS cost
         FROM public.ai_token_logs
         WHERE workspace_id = $1 AND created_at >= date_trunc('month', now())
         GROUP BY COALESCE(purpose, 'reply_generation')
         ORDER BY COUNT(*) DESC`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{
        id: string;
        invoice_number: string;
        amount: string;
        currency: string;
        status: 'paid' | 'open' | 'void' | 'uncollectible';
        billing_reason: string;
        payment_method: string;
        payment_reference: string | null;
        hosted_invoice_url: string | null;
        pdf_url: string | null;
        seat_count: number | null;
        paid_at: string | Date | null;
        created_at: string | Date;
      }>(
        `SELECT id, invoice_number, amount::text, currency, status, billing_reason,
                payment_method, payment_reference, hosted_invoice_url, pdf_url,
                seat_count, paid_at, created_at
         FROM public.workspace_invoices
         WHERE workspace_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [workspaceId],
      ).catch(() => []),
    ]);

    const pRow = profileRows[0];
    const ws = wsRows[0];

    const tierAcc: Record<'light' | 'standard' | 'advanced', { reqs: number; toks: number; cost: number }> = {
      light: { reqs: 0, toks: 0, cost: 0 },
      standard: { reqs: 0, toks: 0, cost: 0 },
      advanced: { reqs: 0, toks: 0, cost: 0 },
    };

    let spendToDateUsd = 0;
    let tokensUsed = 0;
    let aiRequestsCount = 0;

    for (const r of tokenRows) {
      const tier = classifyModelTier(r.model);
      const reqs = Number(r.reqs) || 0;
      const toks = Number(r.toks) || 0;
      const cost = Number(r.cost) || 0;
      tierAcc[tier].reqs += reqs;
      tierAcc[tier].toks += toks;
      tierAcc[tier].cost += cost;
      spendToDateUsd += cost;
      tokensUsed += toks;
      aiRequestsCount += reqs;
    }

    const totalReqsForPct = Math.max(1, aiRequestsCount);
    const modelRouter: ModelTierBreakdown[] = [
      {
        tier: 'light',
        label: 'Light (Fast triage)',
        requests: tierAcc.light.reqs,
        tokens: tierAcc.light.toks,
        costUsd: roundUsd(tierAcc.light.cost),
        sharePct: aiRequestsCount > 0 ? Math.round((tierAcc.light.reqs / totalReqsForPct) * 100) : 0,
      },
      {
        tier: 'standard',
        label: 'Standard (Balanced)',
        requests: tierAcc.standard.reqs,
        tokens: tierAcc.standard.toks,
        costUsd: roundUsd(tierAcc.standard.cost),
        sharePct: aiRequestsCount > 0 ? Math.round((tierAcc.standard.reqs / totalReqsForPct) * 100) : 0,
      },
      {
        tier: 'advanced',
        label: 'Advanced (Deep reasoning)',
        requests: tierAcc.advanced.reqs,
        tokens: tierAcc.advanced.toks,
        costUsd: roundUsd(tierAcc.advanced.cost),
        sharePct: aiRequestsCount > 0 ? Math.round((tierAcc.advanced.reqs / totalReqsForPct) * 100) : 0,
      },
    ];

    const now = new Date();
    const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
    const projectedMonthEndUsd = projectMonthlySpend({
      spendToDateUsd,
      dayOfMonth: now.getUTCDate(),
      daysInMonth,
    });

    const aiLimit = overview.limits.find((l) => l.key === 'max_ai_bot_replies_per_month');
    const kbLimit = overview.limits.find((l) => l.key === 'max_articles');

    return {
      success: true,
      data: {
        overview,
        plans,
        profile: {
          billingMode: pRow?.billing_mode === 'payg' ? 'payg' : 'fixed',
          walletBalanceUsd: Number(pRow?.wallet_balance_usd || 0),
          autoTopupEnabled: Boolean(pRow?.auto_topup_enabled),
          autoTopupThresholdUsd: Number(pRow?.auto_topup_threshold_usd || 15),
          autoTopupAmountUsd: Number(pRow?.auto_topup_amount_usd || 50),
          monthlySpendingCapUsd:
            pRow?.monthly_spending_cap_usd !== null && pRow?.monthly_spending_cap_usd !== undefined
              ? Number(pRow.monthly_spending_cap_usd)
              : ws?.ai_monthly_cost_cap_usd
                ? Number(ws.ai_monthly_cost_cap_usd)
                : 300,
          billingCompanyName: pRow?.billing_company_name || ws?.name || '',
          billingEmail: pRow?.billing_email || user.email || '',
          billingCountry: pRow?.billing_country || 'United States',
          taxId: pRow?.tax_id || '',
        },
        meters: {
          aiConversationsUsed: aiLimit?.currentUsage ?? 0,
          aiConversationsLimit: aiLimit?.limit ?? null,
          voiceMinutesUsed: Math.round(Number(voiceRows[0]?.secs || 0) / 60),
          voiceMinutesLimit: null,
          knowledgeSourcesCount: Number(kbCountRows[0]?.cnt || 0),
          knowledgeSourcesLimit: kbLimit?.limit ?? null,
          teamMembersCount: Number(teamCountRows[0]?.cnt || 0),
        },
        thisMonth: {
          spendToDateUsd: roundUsd(spendToDateUsd),
          projectedMonthEndUsd,
          tokensUsed,
          aiRequestsCount,
        },
        modelRouter,
        usageByChannel: channelRows.map((r) => ({
          label: r.label,
          count: Number(r.cnt) || 0,
          costUsd: 0,
        })),
        usageByAgent: agentRows.map((r) => ({
          label: r.label,
          count: Number(r.cnt) || 0,
          costUsd: 0,
        })),
        usageByFeature: featureRows.map((r) => ({
          label: r.label.replace(/_/g, ' '),
          count: Number(r.cnt) || 0,
          costUsd: roundUsd(Number(r.cost) || 0),
        })),
        invoices: invoiceRows.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          amount: Number(inv.amount || 0),
          currency: inv.currency || 'USD',
          status: inv.status,
          billingReason: inv.billing_reason,
          paymentMethod: inv.payment_method,
          paymentReference: inv.payment_reference,
          hostedInvoiceUrl: inv.hosted_invoice_url,
          pdfUrl: inv.pdf_url,
          seatCount: inv.seat_count ?? 1,
          paidAt: inv.paid_at ? new Date(inv.paid_at).toISOString() : null,
          createdAt: new Date(inv.created_at).toISOString(),
        })),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not load billing dashboard.',
    };
  }
}

export async function updateBillingProfileAction(
  workspaceId: string,
  input: Partial<BillingProfileRecord>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    await query(
      `INSERT INTO public.workspace_billing_profiles (
         workspace_id, billing_mode, auto_topup_enabled, auto_topup_threshold_usd,
         auto_topup_amount_usd, monthly_spending_cap_usd, billing_company_name,
         billing_email, billing_country, tax_id, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       ON CONFLICT (workspace_id)
       DO UPDATE SET
         billing_mode = COALESCE($2, public.workspace_billing_profiles.billing_mode),
         auto_topup_enabled = COALESCE($3, public.workspace_billing_profiles.auto_topup_enabled),
         auto_topup_threshold_usd = COALESCE($4, public.workspace_billing_profiles.auto_topup_threshold_usd),
         auto_topup_amount_usd = COALESCE($5, public.workspace_billing_profiles.auto_topup_amount_usd),
         monthly_spending_cap_usd = $6,
         billing_company_name = COALESCE($7, public.workspace_billing_profiles.billing_company_name),
         billing_email = COALESCE($8, public.workspace_billing_profiles.billing_email),
         billing_country = COALESCE($9, public.workspace_billing_profiles.billing_country),
         tax_id = COALESCE($10, public.workspace_billing_profiles.tax_id),
         updated_at = now()`,
      [
        workspaceId,
        input.billingMode ?? 'fixed',
        input.autoTopupEnabled ?? false,
        Math.max(5, Number(input.autoTopupThresholdUsd ?? 15)),
        Math.max(10, Number(input.autoTopupAmountUsd ?? 50)),
        input.monthlySpendingCapUsd !== undefined && input.monthlySpendingCapUsd !== null
          ? Math.max(10, Number(input.monthlySpendingCapUsd))
          : 300,
        input.billingCompanyName?.trim() || null,
        input.billingEmail?.trim() || null,
        input.billingCountry?.trim() || 'United States',
        input.taxId?.trim() || null,
      ],
    );

    if (input.monthlySpendingCapUsd !== undefined) {
      await query(
        `UPDATE public.workspaces SET ai_monthly_cost_cap_usd = $1, updated_at = now() WHERE id = $2`,
        [
          input.monthlySpendingCapUsd !== null ? Math.max(10, Number(input.monthlySpendingCapUsd)) : null,
          workspaceId,
        ],
      );
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not update billing preferences.' };
  }
}

export async function getCheckoutInitialDataAction(
  workspaceId: string,
): Promise<{
  success: true;
  plans: PlatformPlan[];
  currentPlanSlug: string;
  currentPeriod: 'monthly' | 'yearly';
  profile: BillingProfileRecord;
} | { success: false; error: string }> {
  try {
    const res = await getBillingDashboardAction(workspaceId);
    if (!res.success) return res;
    const publicPlans = res.data.plans.filter((p) => p.visibility !== 'hidden' && !p.is_archived);
    return {
      success: true,
      plans: publicPlans.length > 0 ? publicPlans : res.data.plans,
      currentPlanSlug: res.data.overview.plan.slug,
      currentPeriod: res.data.overview.subscription.billing_period === 'yearly' ? 'yearly' : 'monthly',
      profile: res.data.profile,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not load checkout plans.' };
  }
}

export async function validateCheckoutCouponAction(
  workspaceId: string,
  code: string,
  planId?: string,
) {
  await getWorkspaceAccess(workspaceId, 'manage_settings');
  return validateCouponAction(code, planId);
}

export async function submitCheckoutAction(
  workspaceId: string,
  input: {
    planId: string;
    billingPeriod: 'monthly' | 'yearly';
    seatCount: number;
    paymentMethod: 'card' | 'paypal' | 'jazzcash' | 'easypaisa' | 'bank_transfer';
    companyName: string;
    billingEmail: string;
    country: string;
    taxId?: string;
    couponCode?: string;
  },
): Promise<
  | { success: true; mode: 'redirect'; checkoutUrl: string }
  | { success: true; mode: 'pending_invoice'; invoiceNumber: string; amountUsd: number }
  | { success: false; error: string }
> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');

    // Persist customer billing details first
    await updateBillingProfileAction(workspaceId, {
      billingCompanyName: input.companyName,
      billingEmail: input.billingEmail,
      billingCountry: input.country,
      taxId: input.taxId || '',
    });

    if (
      input.paymentMethod === 'paypal' ||
      input.paymentMethod === 'jazzcash' ||
      input.paymentMethod === 'easypaisa'
    ) {
      return {
        success: false,
        error: `${input.paymentMethod.toUpperCase()} gateway credentials are not connected in this environment yet. Choose Card (Lemon Squeezy) or Bank transfer to generate a payable invoice.`,
      };
    }

    const planRows = await queryRows<PlatformPlan>(
      `SELECT * FROM public.platform_plans WHERE id = $1 LIMIT 1`,
      [input.planId],
    );
    const plan = planRows[0];
    if (!plan) {
      return { success: false, error: 'Selected plan was not found.' };
    }

    let discountType: 'percentage' | 'fixed' | null = null;
    let discountValue: number | null = null;
    if (input.couponCode?.trim()) {
      const couponRes = await validateCouponAction(input.couponCode, plan.id);
      if (!couponRes.valid || !couponRes.coupon) {
        return { success: false, error: couponRes.error || 'Coupon could not be applied.' };
      }
      discountType = couponRes.coupon.discount_type;
      discountValue = Number(couponRes.coupon.discount_value);
    }

    const breakdown = calculateCheckoutBreakdown({
      monthlyPriceUsd: Number(plan.monthly_price || 0),
      yearlyPriceUsd: Number(plan.yearly_price || 0),
      billingPeriod: input.billingPeriod,
      seatCount: input.seatCount,
      includedSeats: plan.max_agents ?? 5,
      extraSeatMonthlyUsd: 0,
      discountType,
      discountValue,
    });

    if (input.paymentMethod === 'bank_transfer') {
      const now = new Date();
      const invNumber = `INV-WIRE-${now.getTime().toString().slice(-6)}`;
      const periodEnd = new Date(now);
      if (input.billingPeriod === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await query(
        `INSERT INTO public.workspace_invoices (
           workspace_id, invoice_number, amount, currency, status, billing_reason,
           payment_method, payment_reference, seat_count, notes, period_start, period_end
         ) VALUES ($1, $2, $3, $4, 'open', 'manual_payment', 'manual_bank_transfer', $5, $6, $7, $8, $9)`,
        [
          workspaceId,
          invNumber,
          breakdown.totalDueUsd,
          plan.currency || 'USD',
          `Awaiting bank wire for ${plan.name} (${input.billingPeriod})`,
          Math.max(1, input.seatCount),
          `Company: ${input.companyName}; Email: ${input.billingEmail}; Country: ${input.country}${input.taxId ? `; Tax ID: ${input.taxId}` : ''}`,
          now.toISOString(),
          periodEnd.toISOString(),
        ],
      );

      return {
        success: true,
        mode: 'pending_invoice',
        invoiceNumber: invNumber,
        amountUsd: breakdown.totalDueUsd,
      };
    }

    const checkout = await createWorkspaceCheckoutAction({
      workspaceId,
      planId: plan.id,
      planSlug: plan.slug,
      billingPeriod: input.billingPeriod,
      customerEmail: input.billingEmail,
      discountCode: input.couponCode?.trim() || undefined,
    });

    if (checkout.error || !checkout.checkoutUrl) {
      return {
        success: false,
        error: checkout.error || 'Card checkout gateway is not configured in this environment yet.',
      };
    }

    return {
      success: true,
      mode: 'redirect',
      checkoutUrl: checkout.checkoutUrl,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Checkout failed.',
    };
  }
}
