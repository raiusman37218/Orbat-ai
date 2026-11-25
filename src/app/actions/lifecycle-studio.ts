'use server';

import { query, queryRows } from '@/lib/db';
import { sessionUser } from '@/lib/auth/session-user';
import { createWorkspaceAction } from '@/app/actions/admin';
import { getPublicPlansAction, getWorkspaceBillingAndUsageAction } from '@/app/actions/plans';
import { getRequestOrigin } from '@/lib/request-origin';
import { resolveServerBackendBaseUrl } from '@/lib/backend-url';
import { inviteMemberAction } from '@/app/actions/team';
import { ensurePrimaryAiAgent } from '@/lib/ai/agent-runtime';
import {
  isDemoChannel,
  isDemoPersona,
  type DemoChannel,
  type DemoPersona,
  type DemoScenarioKey,
  type DemoSeedSummary,
  type SimulateChatResult,
} from '@/lib/lifecycle/demo-presets';
import {
  seedCompleteDemoWorkspace,
  simulateCustomerInboundChat,
} from '@/lib/lifecycle/demo-workspace';
import { getWorkspaceAccess } from '@/lib/team/access';
import {
  COMPLIANCE_FRAMEWORKS,
  GETTING_STARTED_STEPS,
  INDUSTRY_CATALOG,
  ONBOARDING_CONNECTORS,
  calculateTrialHoursSaved,
  computeChecklistProgress,
  computeRecommendedPlanSlug,
  slugifyCompanyName,
  type GettingStartedStepKey,
} from '@/lib/lifecycle/onboarding-catalog';
import { userError, errorMessage } from '@/lib/errors/user-error';
import type { PlatformPlan, WorkspaceBillingOverview } from '@/types/plans';
import type { AgentRole } from '@/types/database';

export interface GettingStartedStepItem {
  key: GettingStartedStepKey;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  autoCompleted: boolean;
  completed: boolean;
  skipped: boolean;
}

export interface GettingStartedBundle {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string | null;
  websiteUrl: string | null;
  supportEmail: string;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
  isTrialExpired: boolean;
  steps: GettingStartedStepItem[];
  progress: { doneCount: number; totalCount: number; percentage: number };
  primaryAgent: {
    id: string;
    name: string;
    roleTitle: string;
    status: 'draft' | 'live' | 'paused';
    knowledgeCount: number;
  } | null;
  usageMeters: {
    aiRepliesUsed: number;
    aiRepliesLimit: number | null;
    agentsUsed: number;
    agentsLimit: number | null;
    channelsUsed: number;
    channelsLimit: number | null;
  };
}

export interface TrialLifecycleBundle {
  workspaceId: string;
  workspaceName: string;
  planName: string;
  planSlug: string;
  subscriptionStatus: string;
  isTrialing: boolean;
  isTrialExpired: boolean;
  trialDaysRemaining: number | null;
  trialEndsAt: string | null;
  snoozedUntil: string | null;
  stats: {
    aiConversations30d: number;
    hoursSaved30d: number;
    onlineAgents: number;
    totalAgents: number;
    channelsCount: number;
  };
  recommendedPlanSlug: string | null;
  plans: PlatformPlan[];
  overview: WorkspaceBillingOverview;
  latestExtensionRequest: {
    id: string;
    requestedDays: number;
    reason: string | null;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
  } | null;
}

export interface SystemHealthProbeItem {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'unavailable';
  detail: string;
  latencyMs: number | null;
}

export interface SystemStatesBundle {
  workspaceId: string;
  workspaceName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  aiConfigured: boolean;
  unreadInboxCount: number;
  databaseConnected: boolean;
  probes: SystemHealthProbeItem[];
  checkedAt: string;
  recentAccessRequests: Array<{
    id: string;
    requestedArea: string;
    note: string | null;
    status: string;
    createdAt: string;
  }>;
}

export interface OnboardingDraftBundle {
  authenticated: boolean;
  hasWorkspace: boolean;
  workspaceId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  savedState: Record<string, unknown>;
  publicPlans: PlatformPlan[];
}

export async function getGettingStartedBundleAction(
  workspaceId: string,
): Promise<{ success: true; data: GettingStartedBundle } | { success: false; error: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'view');

    const [
      wsRows,
      manualRows,
      commerceRows,
      appIntRows,
      agentRows,
      knowledgeRows,
      channelRows,
      legacyChRows,
      teamRows,
      inviteRows,
      platformRows,
      billing,
    ] = await Promise.all([
      queryRows<{
        id: string;
        name: string;
        slug: string | null;
        website_url: string | null;
        industry: string | null;
        widget_installed: boolean | null;
      }>(
        `SELECT id, name, slug, website_url, industry, COALESCE(widget_installed, false) AS widget_installed
         FROM public.workspaces WHERE id = $1 LIMIT 1`,
        [workspaceId],
      ),
      queryRows<{ step_key: GettingStartedStepKey; completed: boolean; skipped: boolean }>(
        `SELECT step_key, completed, skipped
         FROM public.workspace_getting_started_tasks
         WHERE workspace_id = $1`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{ status: string }>(
        `SELECT status FROM public.workspace_commerce_connections WHERE workspace_id = $1 LIMIT 1`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.workspace_app_integrations WHERE workspace_id = $1 AND status = 'connected'`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      queryRows<{ id: string; name: string; role_title: string | null; status: 'draft' | 'live' | 'paused'; is_primary: boolean }>(
        `SELECT id, name, role_title, status, is_primary
         FROM public.ai_agents
         WHERE workspace_id = $1
         ORDER BY is_primary DESC, created_at ASC
         LIMIT 1`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{ cnt: string }>(
        `SELECT (
           COALESCE((SELECT COUNT(*) FROM public.articles WHERE workspace_id = $1 AND status = 'published'), 0)
           + COALESCE((SELECT COUNT(*) FROM public.bot_knowledge WHERE workspace_id = $1), 0)
         )::text AS cnt`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.channel_connections WHERE workspace_id = $1 AND status = 'connected'`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      queryRows<{ email_enabled: boolean; wa_enabled: boolean }>(
        `SELECT COALESCE(email_channel_enabled, false) AS email_enabled,
                COALESCE(whatsapp_enabled, false) AS wa_enabled
         FROM public.workspace_integrations WHERE workspace_id = $1 LIMIT 1`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.agents WHERE workspace_id = $1 AND COALESCE(is_active, true) = true`,
        [workspaceId],
      ).catch(() => [{ cnt: '1' }]),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.workspace_invitations WHERE workspace_id = $1 AND revoked_at IS NULL`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      queryRows<{ support_email: string | null }>(
        `SELECT support_email FROM public.platform_settings WHERE id = 'default' LIMIT 1`,
      ).catch(() => []),
      getWorkspaceBillingAndUsageAction(workspaceId),
    ]);

    const ws = wsRows[0];
    if (!ws) return { success: false, error: 'Workspace not found.' };

    const manualMap = new Map(manualRows.map((r) => [r.step_key, r]));
    const primaryAgentRow = agentRows[0] ?? null;
    const knowledgeCount = Number(knowledgeRows[0]?.cnt || 0);
    const connectedCommerce = commerceRows[0]?.status === 'connected';
    const connectedApps = Number(appIntRows[0]?.cnt || 0);
    const connectedChannelsCount =
      Number(channelRows[0]?.cnt || 0) +
      (legacyChRows[0]?.email_enabled ? 1 : 0) +
      (legacyChRows[0]?.wa_enabled ? 1 : 0);
    const activeTeamCount = Number(teamRows[0]?.cnt || 1);
    const invitesCount = Number(inviteRows[0]?.cnt || 0);

    const autoDoneMap: Record<GettingStartedStepKey, boolean> = {
      profile: Boolean(ws.name?.trim() && (ws.website_url?.trim() || (ws.industry && ws.industry !== 'generic'))),
      data: connectedCommerce || connectedApps > 0,
      agent: Boolean(primaryAgentRow) && knowledgeCount > 0,
      widget: Boolean(ws.widget_installed),
      channels: connectedChannelsCount > 0,
      team: activeTeamCount > 1 || invitesCount > 0,
      live: primaryAgentRow?.status === 'live',
    };

    const steps: GettingStartedStepItem[] = GETTING_STARTED_STEPS.map((def) => {
      const manual = manualMap.get(def.key);
      const autoCompleted = autoDoneMap[def.key];
      const completed = manual ? manual.completed || autoCompleted : autoCompleted;
      return {
        ...def,
        autoCompleted,
        completed,
        skipped: Boolean(manual?.skipped),
      };
    });

    const aiLimitMetric = billing.limits.find((l) => l.key === 'max_ai_bot_replies_per_month');
    const agentLimitMetric = billing.limits.find((l) => l.key === 'max_agents');
    const channelLimitMetric = billing.limits.find((l) => l.key === 'max_channels_connected');

    return {
      success: true,
      data: {
        workspaceId: ws.id,
        workspaceName: ws.name,
        workspaceSlug: ws.slug,
        websiteUrl: ws.website_url,
        supportEmail: platformRows[0]?.support_email || 'support@orbat.ai',
        isTrialing: billing.subscription.status === 'trialing',
        trialDaysRemaining: billing.trialDaysRemaining,
        isTrialExpired: billing.isTrialExpired,
        steps,
        progress: computeChecklistProgress(steps),
        primaryAgent: primaryAgentRow
          ? {
              id: primaryAgentRow.id,
              name: primaryAgentRow.name,
              roleTitle: primaryAgentRow.role_title || 'AI support specialist',
              status: primaryAgentRow.status,
              knowledgeCount,
            }
          : null,
        usageMeters: {
          aiRepliesUsed: aiLimitMetric?.currentUsage ?? 0,
          aiRepliesLimit: aiLimitMetric?.limit ?? null,
          agentsUsed: agentLimitMetric?.currentUsage ?? activeTeamCount,
          agentsLimit: agentLimitMetric?.limit ?? null,
          channelsUsed: channelLimitMetric?.currentUsage ?? connectedChannelsCount,
          channelsLimit: channelLimitMetric?.limit ?? null,
        },
      },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not load getting started checklist.') };
  }
}

export async function toggleGettingStartedStepAction(
  workspaceId: string,
  stepKey: GettingStartedStepKey,
  completed: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'view');
    await query(
      `INSERT INTO public.workspace_getting_started_tasks
         (workspace_id, step_key, completed, skipped, completed_at, completed_by, updated_at)
       VALUES ($1, $2, $3, false, CASE WHEN $3 THEN now() ELSE NULL END, $4, now())
       ON CONFLICT (workspace_id, step_key) DO UPDATE SET
         completed = EXCLUDED.completed,
         skipped = false,
         completed_at = CASE WHEN EXCLUDED.completed THEN now() ELSE NULL END,
         completed_by = CASE WHEN EXCLUDED.completed THEN EXCLUDED.completed_by ELSE NULL END,
         updated_at = now()`,
      [workspaceId, stepKey, completed, user.id],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not update checklist step.') };
  }
}

export async function publishPrimaryAgentFromOnboardingAction(
  workspaceId: string,
  nextStatus: 'live' | 'draft',
): Promise<{ success: boolean; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const primary = await ensurePrimaryAiAgent(workspaceId);
    if (!primary) {
      return { success: false, error: 'Could not initialize AI agent.' };
    }
    await query(
      `UPDATE public.ai_agents
       SET status = $2,
           published_at = CASE WHEN $2 = 'live' THEN now() ELSE published_at END,
           updated_at = now()
       WHERE id = $1 AND workspace_id = $3`,
      [primary.id, nextStatus, workspaceId],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not update AI agent status.') };
  }
}

export async function getTrialLifecycleBundleAction(
  workspaceId: string,
): Promise<{ success: true; data: TrialLifecycleBundle } | { success: false; error: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');

    const [
      overview,
      plans,
      wsRows,
      aiRows,
      agentRows,
      chRows,
      extRows,
    ] = await Promise.all([
      getWorkspaceBillingAndUsageAction(workspaceId),
      getPublicPlansAction(),
      queryRows<{ name: string; trial_reminder_snoozed_until: string | null }>(
        `SELECT name, trial_reminder_snoozed_until FROM public.workspaces WHERE id = $1 LIMIT 1`,
        [workspaceId],
      ),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt
         FROM public.ai_reply_events
         WHERE workspace_id = $1 AND created_at >= now() - interval '30 days'`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      queryRows<{ total: string; online: string }>(
        `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE status IN ('online', 'away'))::text AS online
         FROM public.agents
         WHERE workspace_id = $1 AND COALESCE(is_active, true) = true`,
        [workspaceId],
      ).catch(() => [{ total: '1', online: '1' }]),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt
         FROM public.channel_connections
         WHERE workspace_id = $1 AND status = 'connected'`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      queryRows<{
        id: string;
        requested_days: number;
        reason: string | null;
        status: 'pending' | 'approved' | 'rejected';
        created_at: string;
      }>(
        `SELECT id, requested_days, reason, status, created_at
         FROM public.trial_extension_requests
         WHERE workspace_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [workspaceId],
      ).catch(() => []),
    ]);

    const aiMetric = overview.limits.find((l) => l.key === 'max_ai_bot_replies_per_month');
    const aiConversations30d = Math.max(
      Number(aiRows[0]?.cnt || 0),
      aiMetric?.currentUsage ?? 0,
    );
    const totalAgents = Number(agentRows[0]?.total || 1);
    const onlineAgents = Number(agentRows[0]?.online || 1);
    const channelsCount = Math.max(1, Number(chRows[0]?.cnt || 0));

    const recommendedPlanSlug = computeRecommendedPlanSlug(
      { aiConversations30d, agentsCount: totalAgents, channelsCount },
      plans.map((p) => ({
        slug: p.slug,
        isPopular: p.is_popular,
        maxAiRepliesPerMonth: p.max_ai_bot_replies_per_month,
        maxAgents: p.max_agents,
        maxChannelsConnected: p.max_channels_connected,
        monthlyPrice: Number(p.monthly_price || 0),
      })),
    );

    const ext = extRows[0] ?? null;
    return {
      success: true,
      data: {
        workspaceId,
        workspaceName: wsRows[0]?.name || 'Workspace',
        planName: overview.plan.name,
        planSlug: overview.plan.slug,
        subscriptionStatus: overview.subscription.status,
        isTrialing: overview.subscription.status === 'trialing',
        isTrialExpired: overview.isTrialExpired,
        trialDaysRemaining: overview.trialDaysRemaining,
        trialEndsAt: overview.subscription?.trial_ends_at ?? null,
        snoozedUntil: wsRows[0]?.trial_reminder_snoozed_until ?? null,
        stats: {
          aiConversations30d,
          hoursSaved30d: calculateTrialHoursSaved(aiConversations30d),
          onlineAgents,
          totalAgents,
          channelsCount,
        },
        recommendedPlanSlug,
        plans,
        overview,
        latestExtensionRequest: ext
          ? {
              id: ext.id,
              requestedDays: ext.requested_days,
              reason: ext.reason,
              status: ext.status,
              createdAt: ext.created_at,
            }
          : null,
      },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not load trial lifecycle status.') };
  }
}

export async function snoozeTrialReminderAction(
  workspaceId: string,
): Promise<{ success: boolean; snoozedUntil?: string; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await query(
      `UPDATE public.workspaces SET trial_reminder_snoozed_until = $2 WHERE id = $1`,
      [workspaceId, until],
    );
    return { success: true, snoozedUntil: until };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not snooze trial reminder.') };
  }
}

export async function requestTrialExtensionAction(
  workspaceId: string,
  requestedDays = 7,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const days = Math.max(1, Math.min(30, Math.round(requestedDays || 7)));

    const existing = await queryRows<{ id: string }>(
      `SELECT id FROM public.trial_extension_requests
       WHERE workspace_id = $1 AND status = 'pending' AND created_at >= now() - interval '24 hours'
       LIMIT 1`,
      [workspaceId],
    );
    if (existing.length > 0) {
      return { success: false, error: 'A trial extension request is already pending platform review.' };
    }

    await query(
      `INSERT INTO public.trial_extension_requests
         (workspace_id, requested_by, requested_days, reason, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [workspaceId, user.id, days, reason?.trim() || null],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not submit trial extension request.') };
  }
}

export async function getSystemStatesLiveAction(
  workspaceId: string,
): Promise<{ success: true; data: SystemStatesBundle } | { success: false; error: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'view');

    const dbStart = Date.now();
    let dbOk = false;
    let dbLatency: number | null = null;
    try {
      await query('SELECT 1');
      dbOk = true;
      dbLatency = Date.now() - dbStart;
    } catch {
      dbOk = false;
    }

    const backendBase = resolveServerBackendBaseUrl();
    let backendStatus: 'operational' | 'degraded' | 'unavailable' = 'unavailable';
    let backendDetail = 'Backend URL not configured (using Next.js database fallback)';
    let backendLatency: number | null = null;

    if (backendBase) {
      const apiStart = Date.now();
      try {
        const res = await fetch(`${backendBase}/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        });
        backendLatency = Date.now() - apiStart;
        if (res.ok) {
          backendStatus = 'operational';
          backendDetail = `NestJS API responding (${backendLatency}ms)`;
        } else {
          backendStatus = 'degraded';
          backendDetail = `HTTP ${res.status} from ${backendBase}/health`;
        }
      } catch {
        backendStatus = 'unavailable';
        backendDetail = 'Realtime & API server unreachable';
      }
    }

    const [wsRows, platRows, aiRows, inboxRows, reqRows] = await Promise.all([
      queryRows<{ name: string }>(`SELECT name FROM public.workspaces WHERE id = $1 LIMIT 1`, [workspaceId]),
      queryRows<{ is_maintenance_mode: boolean; maintenance_message: string | null }>(
        `SELECT COALESCE(is_maintenance_mode, false) AS is_maintenance_mode, maintenance_message
         FROM public.platform_settings WHERE id = 'default' LIMIT 1`,
      ).catch(() => []),
      queryRows<{ is_enabled: boolean; has_key: boolean }>(
        `SELECT COALESCE(is_enabled, false) AS is_enabled, (COALESCE(api_key, '') <> '') AS has_key
         FROM public.platform_ai_settings WHERE id = true LIMIT 1`,
      ).catch(() => []),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.tickets
         WHERE workspace_id = $1 AND status IN ('new', 'open') AND assignee_id IS NULL`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      queryRows<{ id: string; requested_area: string; note: string | null; status: string; created_at: string }>(
        `SELECT id, requested_area, note, status, created_at
         FROM public.workspace_access_requests
         WHERE workspace_id = $1
         ORDER BY created_at DESC LIMIT 8`,
        [workspaceId],
      ).catch(() => []),
    ]);

    const aiCfg = aiRows[0];
    const aiOk = Boolean(aiCfg?.is_enabled && aiCfg?.has_key);

    const probes: SystemHealthProbeItem[] = [
      {
        id: 'db',
        name: 'PostgreSQL primary database',
        status: dbOk ? 'operational' : 'unavailable',
        detail: dbOk ? `Connected (${dbLatency ?? 0}ms query ping)` : 'Database connection check failed',
        latencyMs: dbLatency,
      },
      {
        id: 'api',
        name: 'API & Realtime WebSocket gateway',
        status: backendStatus,
        detail: backendDetail,
        latencyMs: backendLatency,
      },
      {
        id: 'ai',
        name: 'AI provider failover & engine',
        status: aiOk ? 'operational' : 'degraded',
        detail: aiOk
          ? 'Platform AI provider enabled and key configured'
          : 'No active platform AI provider key — human handoff failover applies',
        latencyMs: null,
      },
      {
        id: 'maintenance',
        name: 'Scheduled maintenance state',
        status: platRows[0]?.is_maintenance_mode ? 'degraded' : 'operational',
        detail: platRows[0]?.is_maintenance_mode
          ? platRows[0]?.maintenance_message || 'Platform maintenance window active'
          : 'No scheduled maintenance active',
        latencyMs: null,
      },
    ];

    return {
      success: true,
      data: {
        workspaceId,
        workspaceName: wsRows[0]?.name || 'Workspace',
        maintenanceMode: Boolean(platRows[0]?.is_maintenance_mode),
        maintenanceMessage: platRows[0]?.maintenance_message ?? null,
        aiConfigured: aiOk,
        unreadInboxCount: Number(inboxRows[0]?.cnt || 0),
        databaseConnected: dbOk,
        probes,
        checkedAt: new Date().toISOString(),
        recentAccessRequests: reqRows.map((r) => ({
          id: r.id,
          requestedArea: r.requested_area,
          note: r.note,
          status: r.status,
          createdAt: r.created_at,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not inspect system states.') };
  }
}

export async function submitAccessRequestAction(
  workspaceId: string,
  requestedArea: string,
  note?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'view');
    const area = (requestedArea || '').trim();
    if (!area) return { success: false, error: 'Specify what area needs access.' };

    const agentRows = await queryRows<{ email: string | null }>(
      `SELECT email FROM public.agents WHERE id = $1 LIMIT 1`,
      [user.id],
    ).catch(() => []);

    await query(
      `INSERT INTO public.workspace_access_requests
         (workspace_id, requester_id, requester_email, requested_area, note, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [workspaceId, user.id, agentRows[0]?.email ?? null, area.slice(0, 120), note?.trim() || null],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not submit access request.') };
  }
}

export async function getOnboardingDraftAction(): Promise<{
  success: true;
  data: OnboardingDraftBundle;
} | { success: false; error: string }> {
  try {
    const [plans, user] = await Promise.all([
      getPublicPlansAction(),
      sessionUser().catch(() => null),
    ]);

    if (!user?.id) {
      return {
        success: true,
        data: {
          authenticated: false,
          hasWorkspace: false,
          workspaceId: null,
          user: null,
          savedState: {},
          publicPlans: plans,
        },
      };
    }

    const agentRows = await queryRows<{
      id: string;
      name: string | null;
      email: string | null;
      workspace_id: string | null;
    }>(
      `SELECT id, name, email, workspace_id FROM public.agents WHERE id = $1 LIMIT 1`,
      [user.id],
    ).catch(() => []);

    const agent = agentRows[0];
    let savedState: Record<string, unknown> = {};
    if (agent?.workspace_id) {
      const wsRows = await queryRows<{
        name: string;
        website_url: string | null;
        industry: string | null;
        timezone: string | null;
        language: string | null;
        onboarding_state: Record<string, unknown> | null;
      }>(
        `SELECT name, website_url, industry, timezone, language, onboarding_state
         FROM public.workspaces WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [agent.workspace_id],
      ).catch(() => []);
      if (wsRows[0]) {
        savedState = {
          company: wsRows[0].name,
          site: (wsRows[0].website_url || '').replace(/^https?:\/\//i, ''),
          industry: wsRows[0].industry || 'ecom',
          timezone: wsRows[0].timezone,
          language: wsRows[0].language,
          ...(wsRows[0].onboarding_state || {}),
        };
      }
    }

    return {
      success: true,
      data: {
        authenticated: true,
        hasWorkspace: Boolean(agent?.workspace_id),
        workspaceId: agent?.workspace_id ?? null,
        user: {
          id: user.id,
          name: agent?.name || user.name || user.email?.split('@')[0] || 'Founder',
          email: agent?.email || user.email || '',
        },
        savedState,
        publicPlans: plans,
      },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not initialize onboarding wizard.') };
  }
}

export interface OnboardingWizardPayload {
  fullName: string;
  displayName: string;
  jobTitle: string;
  phone: string;
  userRoleTitle: string;
  companyName: string;
  websiteUrl: string;
  country: string;
  timezone: string;
  language: string;
  companySize: string;
  monthlyVolume: string;
  industryId: string;
  contactTopics: string;
  frameworks: string[];
  dataResidency: string;
  retentionLabel: string;
  channels: string[];
  connectors: string[];
  agentName: string;
  invites: Array<{ email: string; role: AgentRole }>;
  startOption: 'trial' | 'paid';
  selectedPlanSlug: string;
}

export async function completeOnboardingWizardAction(
  payload: OnboardingWizardPayload,
): Promise<{
  success: boolean;
  workspaceId?: string;
  redirectTo?: string;
  invitesSent?: number;
  error?: string;
}> {
  try {
    const user = await sessionUser().catch(() => null);
    if (!user?.id) {
      throw userError('Sign in or create an account to save your workspace.');
    }

    const existingAgents = await queryRows<{ workspace_id: string | null }>(
      `SELECT workspace_id FROM public.agents WHERE id = $1 LIMIT 1`,
      [user.id],
    ).catch(() => []);

    const industryMeta = INDUSTRY_CATALOG.find((i) => i.id === payload.industryId) || INDUSTRY_CATALOG[0];
    const cleanSite = payload.websiteUrl.trim().replace(/^https?:\/\//i, '');
    const normalizedWebsite = cleanSite ? `https://${cleanSite}` : null;
    const desiredSlug = slugifyCompanyName(payload.companyName);
    const retentionDays = payload.retentionLabel.includes('7 years')
      ? 2555
      : payload.retentionLabel.includes('6 years')
        ? 2190
        : payload.retentionLabel.includes('12')
          ? 365
          : 730;

    let workspaceId = existingAgents[0]?.workspace_id ?? null;

    if (!workspaceId) {
      const created = await createWorkspaceAction({
        businessName: payload.companyName.trim() || 'My Workspace',
        websiteUrl: normalizedWebsite,
        brandColor: '#163300',
        greetingTitle: `${payload.agentName.trim() || 'Nova'} · ${payload.companyName.trim() || 'Support'}`,
        greetingMessage: `Hi! I'm ${payload.agentName.trim() || 'Nova'} from ${payload.companyName.trim() || 'our team'}. How can I help today?`,
        slug: desiredSlug,
        industry: payload.industryId,
      });
      workspaceId = created.workspace.id;
    } else {
      await query(
        `UPDATE public.workspaces
         SET name = $2,
             website_url = COALESCE($3, website_url),
             industry = $4,
             timezone = $5,
             language = $6,
             data_retention_days = $7
         WHERE id = $1`,
        [
          workspaceId,
          payload.companyName.trim() || 'My Workspace',
          normalizedWebsite,
          payload.industryId,
          payload.timezone || 'UTC',
          payload.language || 'English',
          retentionDays,
        ],
      );
    }

    const companyProfile = {
      companyName: payload.companyName.trim(),
      country: payload.country,
      companySize: payload.companySize,
      monthlyVolume: payload.monthlyVolume,
      dataResidency: payload.dataResidency,
      contactTopics: payload.contactTopics,
      ownerJobTitle: payload.jobTitle,
      selectedChannels: payload.channels,
      originUrl: await getRequestOrigin().catch(() => ''),
    };

    const onboardingState = {
      completed: true,
      completedAt: new Date().toISOString(),
      step: 9,
      userRoleTitle: payload.userRoleTitle,
      channels: payload.channels,
      connectors: payload.connectors,
      frameworks: payload.frameworks,
      dataResidency: payload.dataResidency,
      retentionLabel: payload.retentionLabel,
      startOption: payload.startOption,
      selectedPlanSlug: payload.selectedPlanSlug,
    };

    await Promise.all([
      query(
        `UPDATE public.workspaces
         SET company_profile = COALESCE(company_profile, '{}'::jsonb) || $2::jsonb,
             onboarding_state = $3::jsonb,
             security_policies = COALESCE(security_policies, '{}'::jsonb) || $4::jsonb
         WHERE id = $1`,
        [
          workspaceId,
          JSON.stringify(companyProfile),
          JSON.stringify(onboardingState),
          JSON.stringify({ dataResidency: payload.dataResidency, frameworks: payload.frameworks }),
        ],
      ),
      query(
        `UPDATE public.agents
         SET name = $2,
             display_name = $3,
             on_call_phone = NULLIF($4, '')
         WHERE id = $1`,
        [
          user.id,
          payload.fullName.trim() || user.name || 'Owner',
          payload.displayName.trim() || payload.fullName.trim() || 'Owner',
          payload.phone.trim(),
        ],
      ),
      query(
        `INSERT INTO public.workspace_getting_started_tasks (workspace_id, step_key, completed, completed_at, completed_by)
         VALUES ($1, 'profile', true, now(), $2)
         ON CONFLICT (workspace_id, step_key) DO UPDATE SET completed = true, completed_at = now(), updated_at = now()`,
        [workspaceId, user.id],
      ),
    ]);

    // Seed primary AI agent with onboarding choice
    try {
      const primary = await ensurePrimaryAiAgent(workspaceId);
      if (primary) {
        await query(
          `UPDATE public.ai_agents
           SET name = $2,
               role_title = $3,
               industry = $4,
               updated_at = now()
           WHERE id = $1 AND workspace_id = $5`,
          [
            primary.id,
            payload.agentName.trim() || 'Nova',
            industryMeta.agentTemplate,
            payload.industryId,
            workspaceId,
          ],
        );
      }
    } catch (agentErr) {
      console.warn('[Onboarding Agent Seed Warning]:', agentErr);
    }

    // Persist compliance controls selected in Step 4
    for (const fwId of payload.frameworks) {
      const fw = COMPLIANCE_FRAMEWORKS.find((f) => f.id === fwId);
      if (!fw) continue;
      await query(
        `INSERT INTO public.compliance_policies
           (workspace_id, rule_key, name, description, category, framework, action_mode, applies_to, pattern_type, pattern, review_status, is_enabled, created_by)
         SELECT $1, $2, $3, $4, $5, $6, 'flag', 'both', 'builtin', '', 'approved', true, $7
         WHERE NOT EXISTS (
           SELECT 1 FROM public.compliance_policies WHERE workspace_id = $1 AND framework = $6 AND rule_key = $2
         )`,
        [
          workspaceId,
          `onboarding_${fw.id.toLowerCase()}`,
          `${fw.label} baseline protection`,
          fw.description,
          fw.category,
          fw.id,
          user.id,
        ],
      ).catch(() => {});
    }

    // Persist connected apps selected in Step 6 as pending setup so CRM Connect continues seamlessly
    for (const connectorId of payload.connectors) {
      const meta = ONBOARDING_CONNECTORS.find((c) => c.id === connectorId);
      if (!meta) continue;
      await query(
        `INSERT INTO public.workspace_app_integrations
           (workspace_id, app_key, category, status, account_label, config, connected_by)
         VALUES ($1, $2, $3, 'pending_oauth', $4, $5::jsonb, $6)
         ON CONFLICT (workspace_id, app_key) DO NOTHING`,
        [
          workspaceId,
          meta.id,
          meta.category,
          `${meta.label} (selected in onboarding)`,
          JSON.stringify({ source: 'onboarding_wizard' }),
          user.id,
        ],
      ).catch(() => {});
    }

    // Dispatch teammate invites if email valid
    let invitesSent = 0;
    for (const inv of payload.invites) {
      const email = (inv.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      try {
        await inviteMemberAction(workspaceId, {
          email,
          name: email.split('@')[0],
          role: inv.role || 'agent',
        });
        invitesSent++;
      } catch {
        // Non-fatal if invite mail or duplicate occurs
      }
    }

    const redirectTo =
      payload.startOption === 'paid' && payload.selectedPlanSlug
        ? `/checkout?plan=${encodeURIComponent(payload.selectedPlanSlug)}`
        : '/app/getting-started';

    return {
      success: true,
      workspaceId,
      redirectTo,
      invitesSent,
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not complete onboarding setup.') };
  }
}

/**
 * Populates the workspace with a complete, idempotent set of omnichannel conversations,
 * SLA-tracked tickets (including breached/warning states), handoff queue items, paused
 * LangGraph approvals, B2B CRM pipeline deals/companies/tasks, and KB chunks/embeddings.
 */
export async function seedCompleteDemoWorkspaceAction(
  workspaceId: string,
): Promise<{ success: true; summary: DemoSeedSummary } | { success: false; error: string }> {
  try {
    const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const summary = await seedCompleteDemoWorkspace(workspaceId, {
      userId: access.user.id,
      agentId: access.agent.id,
      agentName: access.agent.name || access.user.email || 'Admin',
    });
    return { success: true, summary };
  } catch (err) {
    return {
      success: false,
      error: errorMessage(err, 'Could not populate demo workspace data.'),
    };
  }
}

/**
 * Simulates an inbound visitor message on Web, WhatsApp, Email, or Instagram,
 * persists it in Postgres, and executes the live AI auto-respond pipeline.
 */
export async function simulateCustomerInboundChatAction(input: {
  workspaceId: string;
  channel: DemoChannel;
  persona: DemoPersona;
  scenarioKey?: DemoScenarioKey | 'custom';
  message: string;
  conversationId?: string | null;
}): Promise<SimulateChatResult> {
  try {
    const access = await getWorkspaceAccess(input.workspaceId, 'manage_settings');
    if (!isDemoChannel(input.channel) || !isDemoPersona(input.persona)) {
      return {
        success: false,
        conversationId: '',
        inboundMessageId: '',
        ticketNumber: null,
        channel: isDemoChannel(input.channel) ? input.channel : 'web',
        persona: isDemoPersona(input.persona) ? input.persona : 'new_visitor',
        visitorName: 'Visitor',
        visitorEmail: null,
        aiReplied: false,
        aiReplyText: null,
        aiEngine: null,
        aiAgentName: null,
        status: 'no_reply',
        reason: 'Unsupported demo channel or persona.',
        handoffStatus: null,
        approvalId: null,
        runId: null,
        citedArticles: [],
        createdDeal: null,
        inboxHref: '/app/inbox',
        handoffHref: '/app/handoff',
        error: 'Unsupported demo channel or persona.',
      };
    }

    return await simulateCustomerInboundChat({
      workspaceId: input.workspaceId,
      userId: access.user.id,
      agentId: access.agent.id,
      channel: input.channel,
      persona: input.persona,
      scenarioKey: input.scenarioKey,
      message: input.message,
      conversationId: input.conversationId,
    });
  } catch (err) {
    return {
      success: false,
      conversationId: input.conversationId || '',
      inboundMessageId: '',
      ticketNumber: null,
      channel: isDemoChannel(input.channel) ? input.channel : 'web',
      persona: isDemoPersona(input.persona) ? input.persona : 'new_visitor',
      visitorName: 'Visitor',
      visitorEmail: null,
      aiReplied: false,
      aiReplyText: null,
      aiEngine: null,
      aiAgentName: null,
      status: 'no_reply',
      reason: errorMessage(err, 'Could not simulate inbound customer message.'),
      handoffStatus: null,
      approvalId: null,
      runId: null,
      citedArticles: [],
      createdDeal: null,
      inboxHref: '/app/inbox',
      handoffHref: '/app/handoff',
      error: errorMessage(err, 'Could not simulate inbound customer message.'),
    };
  }
}
