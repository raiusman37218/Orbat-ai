'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import {
  getChannelsOverviewAction,
  type ChannelsOverview,
} from '@/app/actions/channels';
import {
  getEmailChannelAction,
  type EmailChannelOverview,
} from '@/app/actions/email-channel';
import { getRequestOrigin } from '@/lib/request-origin';

export type IntegrationCategory = 'ecommerce' | 'payments' | 'crm' | 'team_chat' | 'developer';

export interface MarketplaceAppItem {
  appKey: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  status: 'connected' | 'disconnected' | 'needs_attention' | 'pending_oauth';
  accountLabel: string | null;
  requiresExternalOAuth: boolean;
  externalOAuthNote: string | null;
  config: Record<string, string | boolean>;
  connectedAt: string | null;
}

export interface ChannelTrafficStat {
  channel: string;
  conversations30d: number;
  aiHandled30d: number;
  aiResolutionPct: number;
}

export interface ChannelsStudioBundle {
  overview: ChannelsOverview;
  emailChannel: EmailChannelOverview | null;
  emailChannelError: string | null;
  widget: {
    brandColor: string;
    widgetPosition: 'left' | 'right';
    greetingTitle: string;
    greetingMessage: string;
    websiteUrl: string;
    widgetInstalled: boolean;
    widgetDisabled: boolean;
    snippet: string;
  };
  trafficByChannel: ChannelTrafficStat[];
  integrations: MarketplaceAppItem[];
}

export interface CommerceActionsState {
  track: boolean;
  return: boolean;
  cod: boolean;
  wallet: boolean;
  book: boolean;
  lead: boolean;
}

export interface CommerceConnectionBundle {
  workspaceId: string;
  workspaceSlug: string;
  websiteUrl: string;
  platform: 'shopify' | 'woocommerce' | 'custom';
  storeUrl: string;
  storeName: string;
  status: 'not_connected' | 'syncing' | 'connected' | 'error';
  stepProgress: number;
  syncedMetrics: {
    customersCount: number;
    ordersCount: number;
    conversationsWithVisitorCount: number;
    webhookVerified: boolean;
    lastSyncAt: string | null;
  };
  aiActions: CommerceActionsState;
  industryFields: string[];
  installToken: string;
  lastVerifiedAt: string | null;
  snippet: string;
}

const APP_CATALOG: Array<{
  appKey: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  requiresExternalOAuth: boolean;
  externalOAuthNote: string | null;
}> = [
  {
    appKey: 'shopify',
    name: 'Shopify',
    category: 'ecommerce',
    description: 'Look up customer orders, shipping tracking, refunds, and cart context in real time.',
    requiresExternalOAuth: true,
    externalOAuthNote: 'Requires a Shopify custom app Admin API access token or Shopify App Store OAuth callback.',
  },
  {
    appKey: 'woocommerce',
    name: 'WooCommerce',
    category: 'ecommerce',
    description: 'Sync WordPress / WooCommerce REST orders, fulfillments, and customer LTV into the inbox.',
    requiresExternalOAuth: false,
    externalOAuthNote: null,
  },
  {
    appKey: 'stripe',
    name: 'Stripe',
    category: 'payments',
    description: 'Show subscription tier, latest invoices, and refund status directly beside customer threads.',
    requiresExternalOAuth: true,
    externalOAuthNote: 'Connect a Stripe restricted read-only key; card charges stay strictly within Stripe.',
  },
  {
    appKey: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    description: 'Bi-directional contact sync and deal stage visibility for sales-assisted support.',
    requiresExternalOAuth: true,
    externalOAuthNote: 'HubSpot OAuth app install is pending platform registration.',
  },
  {
    appKey: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    description: 'Link Service Cloud cases and account owner assignments cleanly to ORBAT threads.',
    requiresExternalOAuth: true,
    externalOAuthNote: 'Salesforce Connected App OAuth is pending enterprise tenant setup.',
  },
  {
    appKey: 'slack',
    name: 'Slack',
    category: 'team_chat',
    description: 'Stream live handoff alerts, SLA breaches, and CSAT replies into dedicated Slack channels.',
    requiresExternalOAuth: false,
    externalOAuthNote: null,
  },
  {
    appKey: 'linear',
    name: 'Linear',
    category: 'developer',
    description: 'Escalate bug reports from tickets into tracked Linear issues with thread backlinks.',
    requiresExternalOAuth: true,
    externalOAuthNote: 'Linear OAuth workflow sync requires LINEAR_CLIENT_ID in environment.',
  },
  {
    appKey: 'github',
    name: 'GitHub',
    category: 'developer',
    description: 'Attach engineering issue statuses and PR links straight into customer conversations.',
    requiresExternalOAuth: true,
    externalOAuthNote: 'GitHub App installation credentials are not configured in this workspace.',
  },
  {
    appKey: 'zapier',
    name: 'Zapier & Webhooks',
    category: 'developer',
    description: 'Trigger downstream workflows across 5,000+ apps via signed workspace webhooks.',
    requiresExternalOAuth: false,
    externalOAuthNote: null,
  },
];

export async function getChannelsWorkspaceDataAction(
  workspaceId: string,
): Promise<{ success: true; data: ChannelsStudioBundle } | { success: false; error: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');

    const [
      overviewRes,
      emailRes,
      wsRows,
      trafficRows,
      appRows,
      legacyIntRows,
      origin,
    ] = await Promise.all([
      getChannelsOverviewAction(workspaceId),
      getEmailChannelAction(workspaceId),
      queryRows<{
        brand_color: string | null;
        widget_position: string | null;
        greeting_title: string | null;
        greeting_message: string | null;
        website_url: string | null;
        widget_installed: boolean | null;
        widget_disabled: boolean | null;
      }>(
        `SELECT brand_color, widget_position, greeting_title, greeting_message,
                website_url, COALESCE(widget_installed, false) AS widget_installed,
                COALESCE(widget_disabled, false) AS widget_disabled
         FROM public.workspaces
         WHERE id = $1
         LIMIT 1`,
        [workspaceId],
      ),
      queryRows<{
        channel: string | null;
        total: string;
        ai_count: string;
      }>(
        `SELECT COALESCE(channel, 'widget') AS channel,
                COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE ai_mode IN ('auto', 'copilot', 'bot') OR assigned_agent_id IS NULL)::text AS ai_count
         FROM public.conversations
         WHERE workspace_id = $1
           AND created_at >= now() - interval '30 days'
         GROUP BY COALESCE(channel, 'widget')`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{
        app_key: string;
        status: 'connected' | 'disconnected' | 'needs_attention' | 'pending_oauth';
        account_label: string | null;
        config: Record<string, unknown> | null;
        connected_at: string | Date | null;
      }>(
        `SELECT app_key, status, account_label, config, connected_at
         FROM public.workspace_app_integrations
         WHERE workspace_id = $1`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{ slack_enabled: boolean | null; slack_webhook_url: string | null }>(
        `SELECT slack_enabled, slack_webhook_url
         FROM public.workspace_integrations
         WHERE workspace_id = $1
         LIMIT 1`,
        [workspaceId],
      ).catch(() => []),
      getRequestOrigin(),
    ]);

    if (!overviewRes.success) {
      return { success: false, error: overviewRes.error };
    }

    const ws = wsRows[0];
    const baseOrigin = origin || 'https://app.orbat.ai';
    const snippet = `<script>\n  window.OrbatSettings = { workspaceId: "${workspaceId}" };\n</script>\n<script async src="${baseOrigin}/widget.js?workspace=${workspaceId}"></script>`;

    const appMap = new Map(appRows.map((r) => [r.app_key, r]));
    const legacySlack = legacyIntRows[0];

    const integrations: MarketplaceAppItem[] = APP_CATALOG.map((item) => {
      const saved = appMap.get(item.appKey);
      let status: MarketplaceAppItem['status'] = saved?.status ?? 'disconnected';
      let accountLabel = saved?.account_label ?? null;
      const cfg: Record<string, string | boolean> = {};
      if (saved?.config && typeof saved.config === 'object') {
        for (const [k, v] of Object.entries(saved.config)) {
          if (typeof v === 'string' || typeof v === 'boolean') {
            cfg[k] = v;
          }
        }
      }
      if (item.appKey === 'slack' && status === 'disconnected' && legacySlack?.slack_enabled) {
        status = 'connected';
        accountLabel = accountLabel || 'Slack webhook connected';
      }

      return {
        appKey: item.appKey,
        name: item.name,
        category: item.category,
        description: item.description,
        status,
        accountLabel,
        requiresExternalOAuth: item.requiresExternalOAuth,
        externalOAuthNote: item.externalOAuthNote,
        config: cfg,
        connectedAt: saved?.connected_at ? new Date(saved.connected_at).toISOString() : null,
      };
    });

    const trafficByChannel: ChannelTrafficStat[] = trafficRows.map((row) => {
      const total = Number(row.total) || 0;
      const aiHandled = Number(row.ai_count) || 0;
      return {
        channel: row.channel || 'widget',
        conversations30d: total,
        aiHandled30d: aiHandled,
        aiResolutionPct: total > 0 ? Math.round((aiHandled / total) * 100) : 0,
      };
    });

    return {
      success: true,
      data: {
        overview: overviewRes.overview,
        emailChannel: emailRes.success ? emailRes.overview : null,
        emailChannelError: emailRes.success ? null : emailRes.error,
        widget: {
          brandColor: ws?.brand_color || '#163300',
          widgetPosition: ws?.widget_position === 'left' ? 'left' : 'right',
          greetingTitle: ws?.greeting_title || 'Hi there!',
          greetingMessage: ws?.greeting_message || 'Ask us anything — usually replies in under 2 minutes.',
          websiteUrl: ws?.website_url || '',
          widgetInstalled: Boolean(ws?.widget_installed),
          widgetDisabled: Boolean(ws?.widget_disabled),
          snippet,
        },
        trafficByChannel,
        integrations,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not load channels workspace data.',
    };
  }
}

export async function saveWidgetChannelSettingsAction(
  workspaceId: string,
  input: {
    websiteUrl: string;
    widgetPosition: 'left' | 'right';
    greetingTitle: string;
    greetingMessage: string;
    widgetDisabled: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    await query(
      `UPDATE public.workspaces
       SET website_url = $1,
           widget_position = $2,
           greeting_title = $3,
           greeting_message = $4,
           widget_disabled = $5,
           updated_at = now()
       WHERE id = $6`,
      [
        input.websiteUrl.trim() || null,
        input.widgetPosition === 'left' ? 'left' : 'right',
        input.greetingTitle.trim() || 'Hi there!',
        input.greetingMessage.trim() || 'How can we help you today?',
        Boolean(input.widgetDisabled),
        workspaceId,
      ],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save widget settings.' };
  }
}

export async function saveAppIntegrationAction(
  workspaceId: string,
  input: {
    appKey: string;
    status: 'connected' | 'disconnected' | 'pending_oauth';
    accountLabel?: string;
    config?: Record<string, string | boolean>;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const catalogItem = APP_CATALOG.find((c) => c.appKey === input.appKey);
    if (!catalogItem) {
      return { success: false, error: 'Unknown integration.' };
    }

    const cleanStatus = input.status;
    await query(
      `INSERT INTO public.workspace_app_integrations
         (workspace_id, app_key, category, status, account_label, config, connected_by, connected_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, now())
       ON CONFLICT (workspace_id, app_key)
       DO UPDATE SET
         status = EXCLUDED.status,
         account_label = EXCLUDED.account_label,
         config = EXCLUDED.config,
         connected_by = EXCLUDED.connected_by,
         connected_at = COALESCE(EXCLUDED.connected_at, public.workspace_app_integrations.connected_at),
         updated_at = now()`,
      [
        workspaceId,
        catalogItem.appKey,
        catalogItem.category,
        cleanStatus,
        input.accountLabel?.trim() || null,
        JSON.stringify(input.config || {}),
        user.id,
        cleanStatus === 'connected' ? new Date().toISOString() : null,
      ],
    );

    if (catalogItem.appKey === 'slack' && typeof input.config?.webhookUrl === 'string') {
      await query(
        `INSERT INTO public.workspace_integrations (workspace_id, slack_enabled, slack_webhook_url, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (workspace_id)
         DO UPDATE SET slack_enabled = EXCLUDED.slack_enabled,
                       slack_webhook_url = EXCLUDED.slack_webhook_url,
                       updated_at = now()`,
        [workspaceId, cleanStatus === 'connected', input.config.webhookUrl.trim() || null],
      ).catch(() => {});
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update integration.' };
  }
}

export async function getCommerceConnectionAction(
  workspaceId: string,
): Promise<{ success: true; data: CommerceConnectionBundle } | { success: false; error: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const [wsRows, connRows, orderCountRows, custCountRows, origin] = await Promise.all([
      queryRows<{ slug: string | null; website_url: string | null; widget_installed: boolean | null }>(
        `SELECT slug, website_url, COALESCE(widget_installed, false) AS widget_installed
         FROM public.workspaces WHERE id = $1 LIMIT 1`,
        [workspaceId],
      ),
      queryRows<{
        platform: 'shopify' | 'woocommerce' | 'custom';
        store_url: string | null;
        store_name: string | null;
        status: 'not_connected' | 'syncing' | 'connected' | 'error';
        step_progress: number;
        synced_metrics: Record<string, unknown> | null;
        ai_actions: Partial<CommerceActionsState> | null;
        industry_fields: string[] | null;
        install_token: string;
        last_verified_at: string | Date | null;
      }>(
        `INSERT INTO public.workspace_commerce_connections (workspace_id)
         VALUES ($1)
         ON CONFLICT (workspace_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id
         RETURNING platform, store_url, store_name, status, step_progress, synced_metrics,
                   ai_actions, industry_fields, install_token, last_verified_at`,
        [workspaceId],
      ),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.customer_orders WHERE workspace_id = $1`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.visitors WHERE workspace_id = $1`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      getRequestOrigin(),
    ]);

    const ws = wsRows[0];
    const row = connRows[0];
    const baseOrigin = origin || 'https://app.orbat.ai';
    const rawActions = row?.ai_actions || {};
    const aiActions: CommerceActionsState = {
      track: rawActions.track ?? true,
      return: rawActions.return ?? false,
      cod: rawActions.cod ?? false,
      wallet: rawActions.wallet ?? true,
      book: rawActions.book ?? false,
      lead: rawActions.lead ?? true,
    };

    const customersCount = Number(custCountRows[0]?.cnt || 0);
    const ordersCount = Number(orderCountRows[0]?.cnt || 0);
    const token = row?.install_token || '';
    const snippet = `<script>\n  window.OrbatSettings = {\n    workspaceId: "${workspaceId}",\n    commerceToken: "${token}"\n  };\n</script>\n<script async src="${baseOrigin}/widget.js?workspace=${workspaceId}"></script>`;

    return {
      success: true,
      data: {
        workspaceId,
        workspaceSlug: ws?.slug || workspaceId,
        websiteUrl: ws?.website_url || '',
        platform: row?.platform || 'custom',
        storeUrl: row?.store_url || ws?.website_url || '',
        storeName: row?.store_name || '',
        status: row?.status || (ws?.widget_installed ? 'connected' : 'not_connected'),
        stepProgress: row?.step_progress || (ws?.widget_installed ? 5 : 1),
        syncedMetrics: {
          customersCount,
          ordersCount,
          conversationsWithVisitorCount: customersCount,
          webhookVerified: Boolean(row?.last_verified_at || ws?.widget_installed),
          lastSyncAt:
            typeof row?.synced_metrics?.last_sync_at === 'string'
              ? row.synced_metrics.last_sync_at
              : row?.last_verified_at
                ? new Date(row.last_verified_at).toISOString()
                : null,
        },
        aiActions,
        industryFields:
          Array.isArray(row?.industry_fields) && row.industry_fields.length > 0
            ? row.industry_fields
            : ['order_id', 'shipping_status', 'plan_tier', 'ltv_usd'],
        installToken: token,
        lastVerifiedAt: row?.last_verified_at ? new Date(row.last_verified_at).toISOString() : null,
        snippet,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not load commerce connection.',
    };
  }
}

export async function saveCommerceConnectionAction(
  workspaceId: string,
  input: {
    platform: 'shopify' | 'woocommerce' | 'custom';
    storeUrl: string;
    storeName?: string;
    aiActions: CommerceActionsState;
    industryFields: string[];
    verifyReachable?: boolean;
  },
): Promise<{ success: boolean; error?: string; verified?: boolean }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const cleanUrl = (input.storeUrl || '').trim();
    let verified = false;
    let status: 'not_connected' | 'syncing' | 'connected' | 'error' = cleanUrl ? 'syncing' : 'not_connected';
    let stepProgress = cleanUrl ? 2 : 1;
    let verifiedAt: string | null = null;

    if (input.verifyReachable && cleanUrl) {
      const normalizedUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
      try {
        const res = await fetch(normalizedUrl, { method: 'HEAD', signal: AbortSignal.timeout(4500) });
        if (res.ok || res.status < 500) {
          verified = true;
          status = 'connected';
          stepProgress = 5;
          verifiedAt = new Date().toISOString();
        }
      } catch {
        status = 'syncing';
        stepProgress = 3;
      }
    }

    const cleanFields = Array.from(
      new Set(
        input.industryFields
          .map((f) => f.trim().replace(/\s+/g, '_').toLowerCase())
          .filter((f) => f.length > 0 && f.length <= 48),
      ),
    ).slice(0, 24);

    await query(
      `INSERT INTO public.workspace_commerce_connections
         (workspace_id, platform, store_url, store_name, status, step_progress, ai_actions, industry_fields, synced_metrics, last_verified_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, now())
       ON CONFLICT (workspace_id)
       DO UPDATE SET
         platform = EXCLUDED.platform,
         store_url = EXCLUDED.store_url,
         store_name = EXCLUDED.store_name,
         status = CASE WHEN $10 IS NOT NULL THEN EXCLUDED.status ELSE public.workspace_commerce_connections.status END,
         step_progress = GREATEST(public.workspace_commerce_connections.step_progress, EXCLUDED.step_progress),
         ai_actions = EXCLUDED.ai_actions,
         industry_fields = EXCLUDED.industry_fields,
         synced_metrics = public.workspace_commerce_connections.synced_metrics || EXCLUDED.synced_metrics,
         last_verified_at = COALESCE($10, public.workspace_commerce_connections.last_verified_at),
         updated_at = now()`,
      [
        workspaceId,
        input.platform,
        cleanUrl || null,
        input.storeName?.trim() || null,
        status,
        stepProgress,
        JSON.stringify(input.aiActions),
        cleanFields,
        JSON.stringify(verifiedAt ? { last_sync_at: verifiedAt } : {}),
        verifiedAt,
      ],
    );

    return { success: true, verified };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save commerce configuration.',
    };
  }
}
