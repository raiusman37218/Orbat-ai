'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import {
  listApiKeysAction,
  createApiKeyAction,
  revokeApiKeyAction,
  type ApiKeyRow,
} from '@/app/actions/api-keys';
import {
  listWebhooksAction,
  createWebhookAction,
  updateWebhookAction,
  rotateWebhookSecretAction,
  deleteWebhookAction,
  testWebhookAction,
  type WorkspaceWebhook,
} from '@/app/actions/webhooks';
import { getCustomDomainSetupAction } from '@/app/actions/custom-domain';
import {
  getNotificationPrefsAction,
  saveNotificationPrefsAction,
  getAuditLogAction,
} from '@/app/actions/settings';
import {
  DEFAULT_EMAIL_TEMPLATES,
  renderTemplateVariables,
  type EmailTemplateCategory,
} from '@/lib/settings/email-templates';
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/settings/validation';
import { loadTeamAlertSmtp } from '@/lib/email/workspace-smtp';
import { createSmtpTransporter, getEffectiveFromEmail } from '@/lib/email/smtp';

export interface NotificationMatrixPrefs {
  newConversationDesktop: boolean;
  newConversationEmail: boolean;
  newConversationMobile: boolean;
  assignedDesktop: boolean;
  assignedEmail: boolean;
  assignedMobile: boolean;
  slaWarningDesktop: boolean;
  slaWarningEmail: boolean;
  slaWarningMobile: boolean;
  weeklyDigestEmail: boolean;
}

export interface WorkspaceSettingsBundle {
  workspace: {
    id: string;
    name: string;
    slug: string;
    websiteUrl: string;
    brandColor: string;
    logoUrl: string;
    widgetPosition: 'left' | 'right';
    greetingTitle: string;
    greetingMessage: string;
    timezone: string;
    language: string;
    industry: string;
    autoCloseDays: number;
    require2fa: boolean;
    dataRetentionDays: number;
    aiMonthlyCostCapUsd: number | null;
    scheduledDeletionAt: string | null;
    customDomain: string;
    customDomainStatus: string | null;
  };
  role: 'owner' | 'admin' | 'agent' | 'light_agent';
  companyProfile: {
    supportEmail: string;
    replyLanguage: string;
    legalName: string;
  };
  aiBehavior: {
    copilotSuggestions: boolean;
    autoSummarizeHandoff: boolean;
    sentimentScoring: boolean;
    autoTranslate: boolean;
    draftOnly: boolean;
    knowledgeSourceMode: 'site_and_docs' | 'uploads_only';
    tone: string;
  };
  securityPolicies: {
    sessionTimeoutHours: number;
    ipAllowlist: string[];
    ssoConfigured: boolean;
    ssoProvider: string;
  };
  notifications: NotificationMatrixPrefs;
  apiKeys: ApiKeyRow[];
  webhooks: WorkspaceWebhook[];
  auditLogsCount: number;
  customDomainSummary: {
    domain: string | null;
    status: string | null;
  };
}

export interface EmailTemplateRecord {
  id: string;
  templateKey: string;
  category: EmailTemplateCategory;
  name: string;
  triggerDescription: string;
  language: string;
  subject: string;
  body: string;
  ctaLabel: string;
  isActive: boolean;
  availableVariables: string[];
  updatedAt: string;
}

const DEFAULT_MATRIX: NotificationMatrixPrefs = {
  newConversationDesktop: true,
  newConversationEmail: false,
  newConversationMobile: true,
  assignedDesktop: true,
  assignedEmail: true,
  assignedMobile: true,
  slaWarningDesktop: true,
  slaWarningEmail: true,
  slaWarningMobile: true,
  weeklyDigestEmail: true,
};

export async function getWorkspaceSettingsBundleAction(
  workspaceId: string,
): Promise<{ success: true; data: WorkspaceSettingsBundle } | { success: false; error: string }> {
  try {
    const { agent, user } = await getWorkspaceAccess(workspaceId, 'manage_settings');

    const [
      wsRows,
      apiKeysRes,
      webhooksRes,
      domainRes,
      notifRes,
      auditLogs,
      agentNotifRows,
    ] = await Promise.all([
      queryRows<{
        id: string;
        name: string;
        slug: string;
        website_url: string | null;
        brand_color: string | null;
        logo_url: string | null;
        widget_position: string | null;
        greeting_title: string | null;
        greeting_message: string | null;
        timezone: string | null;
        language: string | null;
        industry: string | null;
        auto_close_days: number | null;
        require_2fa: boolean | null;
        data_retention_days: number | null;
        ai_monthly_cost_cap_usd: string | null;
        scheduled_deletion_at: string | Date | null;
        custom_domain: string | null;
        custom_domain_status: string | null;
        ai_settings: Record<string, unknown> | null;
        company_profile: Record<string, unknown> | null;
        ai_behavior_config: Record<string, unknown> | null;
        security_policies: Record<string, unknown> | null;
      }>(
        `SELECT id, name, slug, website_url, brand_color, logo_url, widget_position,
                greeting_title, greeting_message, timezone, language, industry,
                auto_close_days, COALESCE(require_2fa, false) AS require_2fa,
                COALESCE(data_retention_days, 365) AS data_retention_days,
                ai_monthly_cost_cap_usd::text, scheduled_deletion_at,
                custom_domain, custom_domain_status, ai_settings,
                company_profile, ai_behavior_config, security_policies
         FROM public.workspaces
         WHERE id = $1
         LIMIT 1`,
        [workspaceId],
      ),
      listApiKeysAction(workspaceId).catch(() => ({ success: false as const, error: '' })),
      listWebhooksAction(workspaceId).catch(() => ({ success: false as const, error: '' })),
      getCustomDomainSetupAction(workspaceId).catch(() => null),
      getNotificationPrefsAction(workspaceId).catch(() => null),
      getAuditLogAction(workspaceId).catch(() => []),
      queryRows<{ notification_matrix: Partial<NotificationMatrixPrefs> | null }>(
        `SELECT notification_matrix FROM public.agent_notification_preferences
         WHERE agent_id = $1 AND workspace_id = $2 LIMIT 1`,
        [user.id, workspaceId],
      ).catch(() => []),
    ]);

    const ws = wsRows[0];
    if (!ws) {
      return { success: false, error: 'Workspace not found.' };
    }

    const cp = ws.company_profile || {};
    const aiBehavior = ws.ai_behavior_config || {};
    const aiSettings = ws.ai_settings || {};
    const secPol = ws.security_policies || {};
    const savedMatrix = agentNotifRows[0]?.notification_matrix || {};

    const baseNotif = notifRes && 'success' in notifRes && notifRes.success ? notifRes.prefs : null;

    const notifications: NotificationMatrixPrefs = {
      newConversationDesktop:
        savedMatrix.newConversationDesktop ??
        baseNotif?.in_app.new_conversation ??
        DEFAULT_MATRIX.newConversationDesktop,
      newConversationEmail:
        savedMatrix.newConversationEmail ??
        baseNotif?.email.new_conversation ??
        DEFAULT_MATRIX.newConversationEmail,
      newConversationMobile:
        savedMatrix.newConversationMobile ?? DEFAULT_MATRIX.newConversationMobile,
      assignedDesktop:
        savedMatrix.assignedDesktop ??
        baseNotif?.in_app.assigned ??
        DEFAULT_MATRIX.assignedDesktop,
      assignedEmail:
        savedMatrix.assignedEmail ??
        baseNotif?.email.assigned ??
        DEFAULT_MATRIX.assignedEmail,
      assignedMobile: savedMatrix.assignedMobile ?? DEFAULT_MATRIX.assignedMobile,
      slaWarningDesktop: savedMatrix.slaWarningDesktop ?? DEFAULT_MATRIX.slaWarningDesktop,
      slaWarningEmail: savedMatrix.slaWarningEmail ?? DEFAULT_MATRIX.slaWarningEmail,
      slaWarningMobile: savedMatrix.slaWarningMobile ?? DEFAULT_MATRIX.slaWarningMobile,
      weeklyDigestEmail: savedMatrix.weeklyDigestEmail ?? DEFAULT_MATRIX.weeklyDigestEmail,
    };

    const rawAllowlist = secPol.ipAllowlist;
    const ipAllowlist = Array.isArray(rawAllowlist)
      ? rawAllowlist.filter((item): item is string => typeof item === 'string')
      : [];

    const domainSetup =
      domainRes && domainRes.success && domainRes.setup ? domainRes.setup : null;

    return {
      success: true,
      data: {
        workspace: {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          websiteUrl: ws.website_url || '',
          brandColor: ws.brand_color || '#163300',
          logoUrl: ws.logo_url || '',
          widgetPosition: ws.widget_position === 'left' ? 'left' : 'right',
          greetingTitle: ws.greeting_title || 'Hi there!',
          greetingMessage: ws.greeting_message || 'Ask us anything.',
          timezone: ws.timezone || 'UTC',
          language: ws.language || 'en',
          industry: ws.industry || 'saas',
          autoCloseDays: ws.auto_close_days ?? 14,
          require2fa: Boolean(ws.require_2fa),
          dataRetentionDays: Number(ws.data_retention_days ?? 365),
          aiMonthlyCostCapUsd:
            ws.ai_monthly_cost_cap_usd !== null ? Number(ws.ai_monthly_cost_cap_usd) : null,
          scheduledDeletionAt: ws.scheduled_deletion_at
            ? new Date(ws.scheduled_deletion_at).toISOString()
            : null,
          customDomain: ws.custom_domain || '',
          customDomainStatus: ws.custom_domain_status || null,
        },
        role: agent.role as 'owner' | 'admin' | 'agent' | 'light_agent',
        companyProfile: {
          supportEmail: typeof cp.supportEmail === 'string' ? cp.supportEmail : '',
          replyLanguage: typeof cp.replyLanguage === 'string' ? cp.replyLanguage : ws.language || 'en',
          legalName: typeof cp.legalName === 'string' ? cp.legalName : ws.name,
        },
        aiBehavior: {
          copilotSuggestions: aiBehavior.copilotSuggestions !== false,
          autoSummarizeHandoff: aiBehavior.autoSummarizeHandoff !== false,
          sentimentScoring: aiBehavior.sentimentScoring !== false,
          autoTranslate: Boolean(aiBehavior.autoTranslate),
          draftOnly: Boolean(aiBehavior.draftOnly),
          knowledgeSourceMode:
            aiBehavior.knowledgeSourceMode === 'uploads_only' ? 'uploads_only' : 'site_and_docs',
          tone: typeof aiSettings.tone === 'string' ? aiSettings.tone : 'friendly',
        },
        securityPolicies: {
          sessionTimeoutHours:
            typeof secPol.sessionTimeoutHours === 'number' ? secPol.sessionTimeoutHours : 168,
          ipAllowlist,
          ssoConfigured: Boolean(secPol.ssoConfigured),
          ssoProvider: typeof secPol.ssoProvider === 'string' ? secPol.ssoProvider : 'Not configured',
        },
        notifications,
        apiKeys: apiKeysRes.success ? apiKeysRes.keys : [],
        webhooks: Array.isArray(webhooksRes) ? webhooksRes : [],
        auditLogsCount: Array.isArray(auditLogs) ? auditLogs.length : 0,
        customDomainSummary: {
          domain: domainSetup?.domain || ws.custom_domain || null,
          status: domainSetup
            ? domainSetup.steps.live
              ? 'verified'
              : 'pending'
            : ws.custom_domain_status || null,
        },
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not load workspace settings.',
    };
  }
}

export async function saveWorkspaceGeneralStudioAction(
  workspaceId: string,
  input: {
    name: string;
    websiteUrl: string;
    timezone: string;
    language: string;
    industry: string;
    autoCloseDays: number;
    supportEmail: string;
    replyLanguage: string;
    legalName: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const days = Math.max(1, Math.min(365, Math.floor(Number(input.autoCloseDays) || 14)));
    await query(
      `UPDATE public.workspaces
       SET name = $1,
           website_url = $2,
           timezone = $3,
           language = $4,
           industry = $5,
           auto_close_days = $6,
           company_profile = COALESCE(company_profile, '{}'::jsonb) || $7::jsonb,
           updated_at = now()
       WHERE id = $8`,
      [
        input.name.trim() || 'Workspace',
        input.websiteUrl.trim() || null,
        input.timezone.trim() || 'UTC',
        input.language.trim() || 'en',
        input.industry.trim() || 'saas',
        days,
        JSON.stringify({
          supportEmail: input.supportEmail.trim(),
          replyLanguage: input.replyLanguage.trim() || 'en',
          legalName: input.legalName.trim() || input.name.trim(),
        }),
        workspaceId,
      ],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save settings.' };
  }
}

export async function saveWorkspaceBrandingStudioAction(
  workspaceId: string,
  input: {
    brandColor: string;
    logoUrl: string;
    widgetPosition: 'left' | 'right';
    greetingTitle: string;
    greetingMessage: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const cleanColor = /^#[0-9a-fA-F]{6}$/.test(input.brandColor.trim())
      ? input.brandColor.trim()
      : '#163300';
    await query(
      `UPDATE public.workspaces
       SET brand_color = $1,
           logo_url = $2,
           widget_position = $3,
           greeting_title = $4,
           greeting_message = $5,
           updated_at = now()
       WHERE id = $6`,
      [
        cleanColor,
        input.logoUrl.trim() || null,
        input.widgetPosition === 'left' ? 'left' : 'right',
        input.greetingTitle.trim() || 'Hi there!',
        input.greetingMessage.trim() || 'Ask us anything.',
        workspaceId,
      ],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save branding.' };
  }
}

export async function saveWorkspaceAiBehaviorStudioAction(
  workspaceId: string,
  input: {
    copilotSuggestions: boolean;
    autoSummarizeHandoff: boolean;
    sentimentScoring: boolean;
    autoTranslate: boolean;
    draftOnly: boolean;
    knowledgeSourceMode: 'site_and_docs' | 'uploads_only';
    tone: string;
    aiMonthlyCostCapUsd: number | null;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    await query(
      `UPDATE public.workspaces
       SET ai_behavior_config = $1::jsonb,
           ai_settings = COALESCE(ai_settings, '{}'::jsonb) || $2::jsonb,
           ai_monthly_cost_cap_usd = $3,
           updated_at = now()
       WHERE id = $4`,
      [
        JSON.stringify({
          copilotSuggestions: input.copilotSuggestions,
          autoSummarizeHandoff: input.autoSummarizeHandoff,
          sentimentScoring: input.sentimentScoring,
          autoTranslate: input.autoTranslate,
          draftOnly: input.draftOnly,
          knowledgeSourceMode: input.knowledgeSourceMode,
        }),
        JSON.stringify({ tone: input.tone || 'friendly' }),
        input.aiMonthlyCostCapUsd !== null ? Math.max(5, Number(input.aiMonthlyCostCapUsd)) : null,
        workspaceId,
      ],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save AI controls.' };
  }
}

export async function saveWorkspaceNotificationMatrixAction(
  workspaceId: string,
  matrix: NotificationMatrixPrefs,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const existingRes = await getNotificationPrefsAction(workspaceId);
    const basePrefs = existingRes.success ? existingRes.prefs : DEFAULT_NOTIFICATION_PREFS;
    await saveNotificationPrefsAction(workspaceId, {
      ...basePrefs,
      in_app: {
        ...basePrefs.in_app,
        new_conversation: matrix.newConversationDesktop,
        assigned: matrix.assignedDesktop,
      },
      email: {
        ...basePrefs.email,
        new_conversation: matrix.newConversationEmail,
        assigned: matrix.assignedEmail,
      },
    });
    await query(
      `INSERT INTO public.agent_notification_preferences (agent_id, workspace_id, notification_matrix, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (agent_id, workspace_id)
       DO UPDATE SET notification_matrix = EXCLUDED.notification_matrix, updated_at = now()`,
      [user.id, workspaceId, JSON.stringify(matrix)],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save notifications.' };
  }
}

export async function saveWorkspaceSecurityStudioAction(
  workspaceId: string,
  input: {
    require2fa: boolean;
    dataRetentionDays: number;
    sessionTimeoutHours: number;
    ipAllowlistRaw: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const allowlist = input.ipAllowlistRaw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 32);

    await query(
      `UPDATE public.workspaces
       SET require_2fa = $1,
           data_retention_days = $2,
           security_policies = COALESCE(security_policies, '{}'::jsonb) || $3::jsonb,
           updated_at = now()
       WHERE id = $4`,
      [
        Boolean(input.require2fa),
        Math.max(30, Math.min(3650, Math.floor(Number(input.dataRetentionDays) || 365))),
        JSON.stringify({
          sessionTimeoutHours: Math.max(1, Math.min(720, Math.floor(Number(input.sessionTimeoutHours) || 168))),
          ipAllowlist: allowlist,
        }),
        workspaceId,
      ],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save security policies.' };
  }
}

export async function scheduleWorkspaceDeletionAction(
  workspaceId: string,
  confirmSlug: string,
): Promise<{ success: boolean; scheduledDeletionAt?: string; error?: string }> {
  try {
    const { user, agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    if (agent.role !== 'owner') {
      return { success: false, error: 'Only the workspace owner can schedule deletion.' };
    }
    const rows = await queryRows<{ slug: string }>(
      `SELECT slug FROM public.workspaces WHERE id = $1 LIMIT 1`,
      [workspaceId],
    );
    const actualSlug = rows[0]?.slug || '';
    if (!actualSlug || confirmSlug.trim() !== actualSlug) {
      return { success: false, error: `Type "${actualSlug}" exactly to confirm deletion.` };
    }
    const deletionDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await query(
      `UPDATE public.workspaces
       SET scheduled_deletion_at = $1, deletion_requested_by = $2, updated_at = now()
       WHERE id = $3`,
      [deletionDate, user.id, workspaceId],
    );
    return { success: true, scheduledDeletionAt: deletionDate };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to schedule workspace deletion.' };
  }
}

export async function cancelWorkspaceDeletionAction(
  workspaceId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    if (agent.role !== 'owner') {
      return { success: false, error: 'Only the workspace owner can cancel scheduled deletion.' };
    }
    await query(
      `UPDATE public.workspaces
       SET scheduled_deletion_at = NULL, deletion_requested_by = NULL, updated_at = now()
       WHERE id = $1`,
      [workspaceId],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to cancel deletion.' };
  }
}

export async function createStudioApiKeyAction(workspaceId: string, name: string) {
  return createApiKeyAction(workspaceId, name);
}

export async function revokeStudioApiKeyAction(workspaceId: string, keyId: string) {
  return revokeApiKeyAction(workspaceId, keyId);
}

export async function createStudioWebhookAction(
  workspaceId: string,
  input: { name: string; url: string; events: string[] },
) {
  return createWebhookAction(workspaceId, input);
}

export async function updateStudioWebhookAction(
  workspaceId: string,
  id: string,
  input: { is_active?: boolean; name?: string; url?: string; events?: string[] },
) {
  return updateWebhookAction(workspaceId, id, input);
}

export async function rotateStudioWebhookSecretAction(workspaceId: string, id: string) {
  return rotateWebhookSecretAction(workspaceId, id);
}

export async function deleteStudioWebhookAction(workspaceId: string, id: string) {
  return deleteWebhookAction(workspaceId, id);
}

export async function testStudioWebhookAction(workspaceId: string, id: string) {
  return testWebhookAction(workspaceId, id);
}

export async function getWorkspaceEmailTemplatesAction(
  workspaceId: string,
  language = 'en',
): Promise<{ success: true; templates: EmailTemplateRecord[] } | { success: false; error: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const cleanLang = language.trim().toLowerCase() || 'en';

    for (const seed of DEFAULT_EMAIL_TEMPLATES) {
      await query(
        `INSERT INTO public.workspace_email_templates (
           workspace_id, template_key, category, name, trigger_description,
           language, subject, body, cta_label, is_active, available_variables
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
         ON CONFLICT (workspace_id, template_key, language) DO NOTHING`,
        [
          workspaceId,
          seed.templateKey,
          seed.category,
          seed.name,
          seed.triggerDescription,
          cleanLang,
          seed.subject,
          seed.body,
          seed.ctaLabel,
          seed.availableVariables,
        ],
      );
    }

    const rows = await queryRows<{
      id: string;
      template_key: string;
      category: EmailTemplateCategory;
      name: string;
      trigger_description: string;
      language: string;
      subject: string;
      body: string;
      cta_label: string;
      is_active: boolean;
      available_variables: string[] | null;
      updated_at: string | Date;
    }>(
      `SELECT id, template_key, category, name, trigger_description, language,
              subject, body, cta_label, is_active, available_variables, updated_at
       FROM public.workspace_email_templates
       WHERE workspace_id = $1 AND language = $2
       ORDER BY category ASC, name ASC`,
      [workspaceId, cleanLang],
    );

    return {
      success: true,
      templates: rows.map((r) => ({
        id: r.id,
        templateKey: r.template_key,
        category: r.category,
        name: r.name,
        triggerDescription: r.trigger_description,
        language: r.language,
        subject: r.subject,
        body: r.body,
        ctaLabel: r.cta_label,
        isActive: r.is_active,
        availableVariables: r.available_variables || [],
        updatedAt: new Date(r.updated_at).toISOString(),
      })),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not load email templates.',
    };
  }
}

export async function saveWorkspaceEmailTemplateAction(
  workspaceId: string,
  input: {
    templateKey: string;
    language: string;
    subject: string;
    body: string;
    ctaLabel: string;
    isActive: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    await query(
      `UPDATE public.workspace_email_templates
       SET subject = $1,
           body = $2,
           cta_label = $3,
           is_active = $4,
           updated_by = $5,
           updated_at = now()
       WHERE workspace_id = $6 AND template_key = $7 AND language = $8`,
      [
        input.subject,
        input.body,
        input.ctaLabel,
        Boolean(input.isActive),
        user.id,
        workspaceId,
        input.templateKey,
        input.language.trim().toLowerCase() || 'en',
      ],
    );
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save email template.',
    };
  }
}

export async function sendTestWorkspaceEmailAction(
  workspaceId: string,
  input: {
    templateKey: string;
    subject: string;
    body: string;
    ctaLabel: string;
    recipientEmail?: string;
  },
): Promise<{ success: boolean; smtpConfigured: boolean; message: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const smtpInfo = await loadTeamAlertSmtp(workspaceId);
    if (!smtpInfo) {
      return {
        success: false,
        smtpConfigured: false,
        message: 'No SMTP server is configured for this workspace or platform yet. Connect SMTP in Channels -> Support Email to send live tests.',
      };
    }

    const seed = DEFAULT_EMAIL_TEMPLATES.find((s) => s.templateKey === input.templateKey);
    const context = seed?.sampleContext || {};
    const renderedSubject = renderTemplateVariables(input.subject, context);
    const renderedBody = renderTemplateVariables(input.body, context);
    const targetEmail = (input.recipientEmail || user.email || '').trim();

    if (!targetEmail) {
      return {
        success: false,
        smtpConfigured: true,
        message: 'Provide a recipient email address to send the test message.',
      };
    }

    const transporter = createSmtpTransporter(smtpInfo.smtp);
    const fromEmail = getEffectiveFromEmail(smtpInfo.smtp);
    const htmlBody = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px">
      <div style="white-space:pre-line;font-size:15px;line-height:1.55;color:#111827">${renderedBody.replace(/</g, '&lt;')}</div>
      ${
        input.ctaLabel.trim()
          ? `<p style="margin-top:24px"><span style="display:inline-block;background:#9fe870;color:#163300;font-weight:700;padding:10px 20px;border-radius:999px">${input.ctaLabel.replace(/</g, '&lt;')}</span></p>`
          : ''
      }
    </div>`;

    await transporter.sendMail({
      from: smtpInfo.smtp.from_name ? `"${smtpInfo.smtp.from_name}" <${fromEmail}>` : fromEmail,
      to: targetEmail,
      subject: `[Test] ${renderedSubject}`,
      text: renderedBody,
      html: htmlBody,
    });

    return {
      success: true,
      smtpConfigured: true,
      message: `Sent test email to ${targetEmail} via ${smtpInfo.source} SMTP.`,
    };
  } catch (err) {
    return {
      success: false,
      smtpConfigured: true,
      message: err instanceof Error ? err.message : 'SMTP delivery failed.',
    };
  }
}
