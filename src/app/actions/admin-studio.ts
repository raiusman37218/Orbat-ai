'use server';

import { query, queryRows } from '@/lib/db';
import { sessionUser } from '@/lib/auth/session-user';
import {
  assertPlatformOwner,
  assertSuperAdmin,
  getPlatformOverviewMetricsAction,
  getPlatformWorkspacesAction,
  reactivateWorkspaceAction,
  recordSuperAdminAudit,
  suspendWorkspaceAction,
  switchWorkspaceAction,
  type PlatformWorkspaceItem,
} from '@/app/actions/platform';
import {
  getPlatformPlansAction,
  savePlanAction,
} from '@/app/actions/plans';
import {
  getPlatformAiSettingsAction,
  getPlatformAiUsageAction,
  savePlatformAiSettingsAction,
  testPlatformAiConnectionAction,
} from '@/app/actions/platform-ai';
import {
  getPlatformSettingsAction,
  getPlatformStaffListAction,
  revokePlatformStaffAccessAction,
  savePlatformSettingsAction,
  updatePlatformStaffRoleAction,
} from '@/app/actions/platform-management';
import { resolveServerBackendBaseUrl } from '@/lib/backend-url';
import { errorMessage } from '@/lib/errors/user-error';
import type { ProviderId } from '@/lib/ai/provider';
import type { PlatformPlan } from '@/types/plans';
import type {
  PlatformAiSettingsDTO,
  PlatformSettings,
  PlatformStaffMember,
  PlatformStaffRole,
} from '@/types/platform-management';

export interface SuperAdminWorkspaceRow extends PlatformWorkspaceItem {
  industry: string | null;
  aiConversations30d: number;
  estimatedModelCostUsd: number;
  monthlyRevenueUsd: number;
}

export interface SuperAdminTrialExtensionRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  requesterEmail: string | null;
  requestedDays: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface SuperAdminStaffInvitationRow {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface SuperAdminConsoleBundle {
  authorized: true;
  callerIsOwner: boolean;
  callerEmail: string;
  kpis: {
    totalWorkspaces: number;
    activeWorkspaces: number;
    payingWorkspaces: number;
    aiConversations30d: number;
    estimatedModelCost30dUsd: number;
    estimatedMonthlyRevenueUsd: number;
    grossMarginPct: number | null;
  };
  workspacesByPlan: Array<{ label: string; count: number; pct: number }>;
  healthChecks: Array<{ id: string; label: string; detail: string; tone: 'ok' | 'warn' | 'bad' }>;
  workspaces: SuperAdminWorkspaceRow[];
  plans: PlatformPlan[];
  aiSettings: PlatformAiSettingsDTO;
  routerTierModels: {
    light: string;
    standard: string;
    advanced: string;
  };
  platformSettings: PlatformSettings & {
    paygRates: Record<string, number>;
  };
  staff: PlatformStaffMember[];
  pendingStaffInvites: SuperAdminStaffInvitationRow[];
  trialExtensionRequests: SuperAdminTrialExtensionRow[];
}

export async function getSuperAdminConsoleBundleAction(): Promise<
  | { success: true; data: SuperAdminConsoleBundle }
  | { success: true; data: { authorized: false; authenticated: boolean; email: string | null; reason: string } }
  | { success: false; error: string }
> {
  try {
    const user = await sessionUser().catch(() => null);
    if (!user?.id) {
      return {
        success: true,
        data: {
          authorized: false,
          authenticated: false,
          email: null,
          reason: 'Sign in with a platform owner or super admin account.',
        },
      };
    }

    let adminCtx: Awaited<ReturnType<typeof assertSuperAdmin>>;
    try {
      adminCtx = await assertSuperAdmin();
    } catch (err) {
      return {
        success: true,
        data: {
          authorized: false,
          authenticated: true,
          email: user.email || null,
          reason: errorMessage(err, 'Platform super admin access (platform_access) is required.'),
        },
      };
    }

    const dbStart = Date.now();
    await query('SELECT 1');
    const dbLatency = Date.now() - dbStart;

    let apiHealthLabel = 'Fallback mode';
    let apiTone: 'ok' | 'warn' | 'bad' = 'warn';
    const backendBase = resolveServerBackendBaseUrl();
    if (backendBase) {
      try {
        const res = await fetch(`${backendBase}/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          apiHealthLabel = 'Operational';
          apiTone = 'ok';
        } else {
          apiHealthLabel = `Degraded (HTTP ${res.status})`;
          apiTone = 'warn';
        }
      } catch {
        apiHealthLabel = 'Unreachable';
        apiTone = 'bad';
      }
    }

    const [
      metrics,
      workspacesRaw,
      plansRes,
      aiSettingsRes,
      aiUsageRes,
      platformSettings,
      staff,
      extraSettingsRows,
      industryRows,
      extReqRows,
      inviteRows,
      failedQueueRows,
    ] = await Promise.all([
      getPlatformOverviewMetricsAction(),
      getPlatformWorkspacesAction(),
      getPlatformPlansAction(),
      getPlatformAiSettingsAction(),
      getPlatformAiUsageAction(),
      getPlatformSettingsAction(),
      getPlatformStaffListAction(),
      queryRows<{
        payg_rates: Record<string, number> | null;
        router_tier_models: { light?: string; standard?: string; advanced?: string } | null;
      }>(`SELECT payg_rates, router_tier_models FROM public.platform_settings WHERE id = 'default' LIMIT 1`).catch(() => []),
      queryRows<{ id: string; industry: string | null }>(
        `SELECT id, industry FROM public.workspaces WHERE deleted_at IS NULL`,
      ).catch(() => []),
      queryRows<{
        id: string;
        workspace_id: string;
        workspace_name: string;
        requester_email: string | null;
        requested_days: number;
        reason: string | null;
        status: 'pending' | 'approved' | 'rejected';
        created_at: string;
      }>(
        `SELECT ter.id, ter.workspace_id, w.name AS workspace_name, a.email AS requester_email,
                ter.requested_days, ter.reason, ter.status, ter.created_at
         FROM public.trial_extension_requests ter
         JOIN public.workspaces w ON w.id = ter.workspace_id
         LEFT JOIN public.agents a ON a.id = ter.requested_by
         ORDER BY ter.created_at DESC
         LIMIT 20`,
      ).catch(() => []),
      queryRows<{ id: string; email: string; name: string | null; status: string; created_at: string; expires_at: string }>(
        `SELECT id, email, name, status, created_at, expires_at
         FROM public.platform_super_admin_invitations
         WHERE status = 'pending'
         ORDER BY created_at DESC LIMIT 20`,
      ).catch(() => []),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.channel_outbound_queue WHERE status = 'failed'`,
      ).catch(() => [{ cnt: '0' }]),
    ]);

    const industryMap = new Map(industryRows.map((r) => [r.id, r.industry]));
    const usageByWs = new Map(aiUsageRes.overview.workspaceBreakdown.map((u) => [u.workspaceId, u]));
    const planPriceBySlug = new Map(
      plansRes.plans.map((p) => [p.slug.toLowerCase(), Number(p.monthly_price || 0)]),
    );

    const workspaces: SuperAdminWorkspaceRow[] = workspacesRaw.map((w) => {
      const ai = usageByWs.get(w.id);
      const aiConvs = ai?.repliesUsed ?? w.tickets_30d_count ?? 0;
      const tokensTotal = (ai?.tokensIn ?? 0) + (ai?.tokensOut ?? 0);
      const estimatedModelCostUsd = Math.round(((tokensTotal / 1_000_000) * 3.5) * 100) / 100;
      const monthlyRevenueUsd = w.is_suspended ? 0 : (planPriceBySlug.get((w.plan || 'free').toLowerCase()) ?? 0);
      return {
        ...w,
        industry: industryMap.get(w.id) ?? null,
        aiConversations30d: aiConvs,
        estimatedModelCostUsd,
        monthlyRevenueUsd,
      };
    });

    const totalRevenue = workspaces.reduce((sum, w) => sum + w.monthlyRevenueUsd, 0);
    const totalCost = workspaces.reduce((sum, w) => sum + w.estimatedModelCostUsd, 0);
    const payingCount = workspaces.filter((w) => w.monthlyRevenueUsd > 0 && !w.is_suspended).length;
    const grossMarginPct =
      totalRevenue > 0 ? Math.max(-100, Math.round(((totalRevenue - totalCost) / totalRevenue) * 100)) : null;

    const planCounts = new Map<string, number>();
    for (const w of workspaces) {
      const key = w.plan || 'Starter';
      planCounts.set(key, (planCounts.get(key) ?? 0) + 1);
    }
    const maxPlanCount = Math.max(1, ...Array.from(planCounts.values()));
    const workspacesByPlan = Array.from(planCounts.entries()).map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / maxPlanCount) * 100),
    }));

    const failedJobsCount = Number(failedQueueRows[0]?.cnt || 0);
    const routerRaw = extraSettingsRows[0]?.router_tier_models ?? {};

    return {
      success: true,
      data: {
        authorized: true,
        callerIsOwner: adminCtx.accessRole === 'owner',
        callerEmail: adminCtx.agent.email || user.email || '',
        kpis: {
          totalWorkspaces: metrics.total_workspaces,
          activeWorkspaces: metrics.active_workspaces,
          payingWorkspaces: payingCount,
          aiConversations30d: aiUsageRes.overview.platformTotalReplies,
          estimatedModelCost30dUsd: Math.round(totalCost * 100) / 100,
          estimatedMonthlyRevenueUsd: Math.round(totalRevenue * 100) / 100,
          grossMarginPct,
        },
        workspacesByPlan,
        healthChecks: [
          {
            id: 'db',
            label: 'PostgreSQL primary database',
            detail: `Operational (${dbLatency}ms)`,
            tone: 'ok',
          },
          {
            id: 'api',
            label: 'NestJS API & Realtime gateway',
            detail: apiHealthLabel,
            tone: apiTone,
          },
          {
            id: 'ai',
            label: 'AI provider configuration',
            detail:
              aiSettingsRes.settings.is_enabled && aiSettingsRes.settings.has_key
                ? `Enabled (${aiSettingsRes.settings.provider})`
                : 'Provider key missing or disabled',
            tone: aiSettingsRes.settings.is_enabled && aiSettingsRes.settings.has_key ? 'ok' : 'warn',
          },
          {
            id: 'queue',
            label: 'Channel outbound queue',
            detail: failedJobsCount > 0 ? `${failedJobsCount} failed deliveries` : 'Operational (0 failed)',
            tone: failedJobsCount > 0 ? 'warn' : 'ok',
          },
        ],
        workspaces,
        plans: plansRes.plans,
        aiSettings: aiSettingsRes.settings,
        routerTierModels: {
          light: routerRaw.light || 'claude-3-5-haiku-latest',
          standard: routerRaw.standard || aiSettingsRes.settings.model || 'claude-sonnet-4-20250514',
          advanced: routerRaw.advanced || 'claude-opus-4-20250514',
        },
        platformSettings: {
          ...platformSettings,
          paygRates: extraSettingsRows[0]?.payg_rates ?? {
            conversation_base: 0.1,
            ai_light: 0.01,
            ai_standard: 0.03,
            ai_advanced: 0.08,
            voice_minute: 0.08,
            website_audit: 4.0,
          },
        },
        staff,
        pendingStaffInvites: inviteRows.map((i) => ({
          id: i.id,
          email: i.email,
          name: i.name,
          status: i.status,
          createdAt: i.created_at,
          expiresAt: i.expires_at,
        })),
        trialExtensionRequests: extReqRows.map((r) => ({
          id: r.id,
          workspaceId: r.workspace_id,
          workspaceName: r.workspace_name,
          requesterEmail: r.requester_email,
          requestedDays: r.requested_days,
          reason: r.reason,
          status: r.status,
          createdAt: r.created_at,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not load super admin console.') };
  }
}

export async function adminToggleWorkspaceSuspendedAction(
  workspaceId: string,
  suspend: boolean,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (suspend) {
      await suspendWorkspaceAction(workspaceId, reason || 'Suspended from Platform Super Admin Console');
    } else {
      await reactivateWorkspaceAction(workspaceId);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not update workspace status.') };
  }
}

export async function adminSwitchIntoWorkspaceAction(workspaceId: string) {
  try {
    await switchWorkspaceAction({ workspaceId });
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not open workspace.') };
  }
}

export async function adminSavePlanQuickAction(plan: {
  id: string;
  monthly_price: number;
  yearly_price: number;
  max_agents: number | null;
  max_ai_bot_replies_per_month: number | null;
  max_channels_connected: number | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertPlatformOwner();
    const { plans } = await getPlatformPlansAction();
    const existing = plans.find((p) => p.id === plan.id);
    if (!existing) return { success: false, error: 'Plan not found.' };

    return await savePlanAction({
      id: existing.id,
      name: existing.name,
      slug: existing.slug,
      description: existing.description,
      monthly_price: plan.monthly_price,
      yearly_price: plan.yearly_price,
      currency: existing.currency,
      trial_days: existing.trial_days,
      visibility: existing.visibility,
      is_popular: existing.is_popular,
      max_agents: plan.max_agents,
      max_tickets_per_month: existing.max_tickets_per_month,
      max_ai_bot_replies_per_month: plan.max_ai_bot_replies_per_month,
      max_copilot_requests_per_month: existing.max_copilot_requests_per_month ?? null,
      max_channels_connected: plan.max_channels_connected,
      max_articles: existing.max_articles,
      max_automations: existing.max_automations,
      max_storage_mb: existing.max_storage_mb,
      max_api_requests_per_month: existing.max_api_requests_per_month,
      ai_enabled: existing.ai_enabled,
      ai_monthly_reply_limit: existing.ai_monthly_reply_limit,
      copilot_enabled: existing.copilot_enabled ?? true,
      copilot_monthly_limit: existing.copilot_monthly_limit ?? null,
      features: existing.features,
    });
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not update plan limits.') };
  }
}

export async function adminSaveAiConfigAndTiersAction(input: {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  isEnabled: boolean;
  routerTiers: { light: string; standard: string; advanced: string };
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { agent } = await assertSuperAdmin();
    const aiSave = await savePlatformAiSettingsAction({
      provider: input.provider,
      model: input.model,
      api_key: input.apiKey || undefined,
      is_enabled: input.isEnabled,
    });
    if (!aiSave.success) {
      return { success: false, error: aiSave.error || 'Could not save AI settings.' };
    }

    await query(
      `UPDATE public.platform_settings
       SET router_tier_models = $1::jsonb, updated_at = now()
       WHERE id = 'default'`,
      [JSON.stringify(input.routerTiers)],
    );

    await recordSuperAdminAudit({
      admin: agent,
      action: 'platform_router_tiers_updated',
      details: input.routerTiers,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not update AI router tiers.') };
  }
}

export async function adminTestAiKeyAction() {
  try {
    return await testPlatformAiConnectionAction();
  } catch (err) {
    return { success: false, message: errorMessage(err, 'AI connection test failed.') };
  }
}

export async function adminSavePlatformGovernanceAction(input: {
  signupMode: 'open' | 'invite_only';
  defaultPlanSlug: string;
  defaultTrialDays: number;
  defaultDataRetentionDays: number;
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  defaultRequire2fa: boolean;
  paygRates?: Record<string, number>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertSuperAdmin();
    const res = await savePlatformSettingsAction({
      signup_mode: input.signupMode,
      default_plan_slug: input.defaultPlanSlug,
      default_trial_days: input.defaultTrialDays,
      default_data_retention_days: input.defaultDataRetentionDays,
      is_maintenance_mode: input.isMaintenanceMode,
      maintenance_message: input.maintenanceMessage,
      default_require_2fa: input.defaultRequire2fa,
    });
    if (!res.success) return res;
    if (input.paygRates) {
      await query(
        `UPDATE public.platform_settings SET payg_rates = $1::jsonb, updated_at = now() WHERE id = 'default'`,
        [JSON.stringify(input.paygRates)],
      );
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not save platform governance settings.') };
  }
}

export async function adminInviteStaffAction(
  email: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { agent } = await assertPlatformOwner();
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Enter a valid email address.' };
    }
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await query(
      `INSERT INTO public.platform_super_admin_invitations
         (email, name, invited_by, invited_by_email, token, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
      [cleanEmail, name.trim() || cleanEmail.split('@')[0], agent.id, agent.email || '', token, expiresAt],
    );
    await recordSuperAdminAudit({
      admin: agent,
      action: 'platform_staff_invited',
      details: { email: cleanEmail },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not invite staff member.') };
  }
}

export async function adminUpdateStaffRoleAction(agentId: string, role: PlatformStaffRole) {
  return updatePlatformStaffRoleAction(agentId, role);
}

export async function adminRevokeStaffAction(agentId: string) {
  return revokePlatformStaffAccessAction(agentId);
}

export async function adminReviewTrialExtensionAction(
  requestId: string,
  decision: 'approved' | 'rejected',
): Promise<{ success: boolean; error?: string }> {
  try {
    const { agent } = await assertSuperAdmin();
    const rows = await queryRows<{
      id: string;
      workspace_id: string;
      requested_days: number;
      status: string;
    }>(
      `SELECT id, workspace_id, requested_days, status
       FROM public.trial_extension_requests WHERE id = $1 LIMIT 1`,
      [requestId],
    );
    const req = rows[0];
    if (!req) return { success: false, error: 'Extension request not found.' };

    await query(
      `UPDATE public.trial_extension_requests
       SET status = $2, reviewed_by = $3, reviewed_at = now()
       WHERE id = $1`,
      [requestId, decision, agent.id],
    );

    if (decision === 'approved') {
      const subRows = await queryRows<{ id: string; trial_ends_at: string | null }>(
        `SELECT id, trial_ends_at FROM public.workspace_subscriptions WHERE workspace_id = $1 LIMIT 1`,
        [req.workspace_id],
      );
      const now = new Date();
      const base = subRows[0]?.trial_ends_at ? new Date(subRows[0].trial_ends_at) : now;
      const startFrom = base > now ? base : now;
      startFrom.setDate(startFrom.getDate() + (req.requested_days || 7));

      if (subRows[0]) {
        await query(
          `UPDATE public.workspace_subscriptions
           SET status = 'trialing', trial_ends_at = $2, updated_at = now()
           WHERE id = $1`,
          [subRows[0].id, startFrom.toISOString()],
        );
      }
    }

    await recordSuperAdminAudit({
      admin: agent,
      action: `trial_extension_${decision}`,
      workspaceId: req.workspace_id,
      details: { requestId, requestedDays: req.requested_days },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not review trial extension.') };
  }
}
