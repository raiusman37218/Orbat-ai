'use server';

/**
 * Settings → Workspace, Notifications and the audit log.
 *
 * Workspace edits need `manage_settings` (owner/admin). Notification
 * preferences belong to whoever is signed in, so they only need membership.
 * The audit log is read-only here: the database triggers in
 * 20261013090000_settings_hub.sql write it, so no action can forge an entry.
 */

import { getWorkspaceAccess } from '@/lib/team/access';
import { assertSettingNotLocked } from '@/lib/settings/precedence';
import {
  normalizeNotificationPrefs,
  validateWorkspaceGeneral,
  type NotificationPrefs,
  type WorkspaceGeneralInput,
} from '@/lib/settings/validation';
import type { Workspace, WorkspaceIntegration, CsatSettingsConfig } from '@/types/database';

export async function updateWorkspaceGeneralAction(workspaceId: string, input: WorkspaceGeneralInput) {
  await assertSettingNotLocked(workspaceId, 'workspace_general');
  const { supabase } = await getWorkspaceAccess(workspaceId, 'manage_settings');

  const errors = validateWorkspaceGeneral(input);
  const first = Object.values(errors)[0];
  if (first) return { success: false as const, error: first, fieldErrors: errors };

  const { data, error } = await supabase
    .from('workspaces')
    .update({
      name: input.name.trim(),
      logo_url: input.logo_url.trim() || null,
      timezone: input.timezone,
      language: input.language,
    })
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) {
    console.error('[Settings Error]:', error);
    return { success: false as const, error: error.message };
  }
  return { success: true as const, workspace: data as Workspace };
}

export async function getNotificationPrefsAction(workspaceId: string) {
  const { supabase, user } = await getWorkspaceAccess(workspaceId, 'view');
  const { data, error } = await supabase
    .from('agent_notification_preferences')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', user.id)
    .maybeSingle();
  if (error) {
    console.error('[Settings Error]:', error);
    return { success: false as const, error: error.message };
  }
  return { success: true as const, prefs: normalizeNotificationPrefs(data) };
}

export async function saveNotificationPrefsAction(workspaceId: string, prefs: NotificationPrefs) {
  const { supabase, user } = await getWorkspaceAccess(workspaceId, 'view');
  const clean = normalizeNotificationPrefs(prefs);
  const { error } = await supabase.from('agent_notification_preferences').upsert(
    {
      agent_id: user.id,
      workspace_id: workspaceId,
      email: clean.email,
      in_app: clean.in_app,
      sound_enabled: clean.sound_enabled,
      sound_name: clean.sound_name,
      push_enabled: clean.push_enabled,
      email_missed: clean.email_missed,
      email_queue_summary: clean.email_queue_summary,
      telegram_chat_id: clean.telegram_chat_id,
      telegram_enabled: clean.telegram_enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'agent_id,workspace_id' }
  );
  if (error) {
    console.error('[Settings Error]:', error);
    return { success: false as const, error: error.message };
  }
  return { success: true as const, prefs: clean };
}

export interface AuditEntry {
  id: string;
  actor_name: string | null;
  action: string;
  target: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const AUDIT_PAGE = 25;

/** Newest first; pass the last row's `created_at` as `before` for the next page. */
export async function getAuditLogAction(workspaceId: string, before?: string | null) {
  const { supabase } = await getWorkspaceAccess(workspaceId, 'manage_settings');
  let query = supabase
    .from('workspace_audit_logs')
    .select('id, actor_name, action, target, details, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(AUDIT_PAGE + 1);
  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) {
    console.error('[Settings Error]:', error);
    return { success: false as const, error: error.message };
  }
  const rows = (data || []) as AuditEntry[];
  return { success: true as const, entries: rows.slice(0, AUDIT_PAGE), hasMore: rows.length > AUDIT_PAGE };
}

export async function updateCsatSettingsAction(workspaceId: string, settings: CsatSettingsConfig) {
  await assertSettingNotLocked(workspaceId, 'csat');
  const { supabase } = await getWorkspaceAccess(workspaceId, 'manage_settings');
  const clean: CsatSettingsConfig = {
    enabled: Boolean(settings.enabled),
    ask_chat: Boolean(settings.ask_chat),
    ask_email: Boolean(settings.ask_email),
    survey_prompt: (settings.survey_prompt || 'How would you rate the support you received?').trim().slice(0, 300),
  };

  const { data, error } = await supabase
    .from('workspaces')
    .update({ csat_settings: clean })
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) {
    console.error('[CSAT Settings Error]:', error);
    return { success: false as const, error: error.message };
  }
  return { success: true as const, workspace: data as Workspace };
}


export async function updateAutoCloseDaysAction(workspaceId: string, days: number) {
  await assertSettingNotLocked(workspaceId, 'workspace_general');
  const { supabase } = await getWorkspaceAccess(workspaceId, 'manage_settings');
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1 || n > 365) {
    return { success: false as const, error: 'Enter a whole number of days from 1 to 365.' };
  }

  const { error } = await supabase
    .from('workspaces')
    .update({ auto_close_days: n })
    .eq('id', workspaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }
  return { success: true as const };
}

const ALLOWED_LEGACY_INTEGRATION_FIELDS = [
  'whatsapp_enabled',
  'whatsapp_phone_number_id',
  'whatsapp_access_token',
  'whatsapp_business_account_id',
  'meta_enabled',
  'meta_page_access_token',
  'meta_verify_token',
  'meta_app_secret',
  'linkedin_enabled',
  'linkedin_access_token',
  'linkedin_organization_urn',
  'slack_enabled',
  'slack_webhook_url',
  'email_offline_notifications',
] as const;

export async function getLegacyIntegrationsAction(workspaceId: string): Promise<{
  integration: Partial<WorkspaceIntegration> | null;
  metaVerifyToken: string;
  sectionsCount: number;
  articlesCount: number;
}> {
  const { supabase } = await getWorkspaceAccess(workspaceId, 'manage_settings');

  const [{ data }, { count: secCount }, { count: artCount }] = await Promise.all([
    supabase
      .from('workspace_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
    supabase
      .from('help_sections')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
    supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'published'),
  ]);

  const row = (data as Partial<WorkspaceIntegration> | null) || null;
  let currentVerifyToken = row?.meta_verify_token || '';
  if (
    !currentVerifyToken ||
    currentVerifyToken === 'chatify_meta_verify_secret' ||
    currentVerifyToken === 'zentry_meta_verify_secret'
  ) {
    currentVerifyToken =
      'meta_vfy_' +
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10);
    await supabase.from('workspace_integrations').upsert(
      {
        workspace_id: workspaceId,
        meta_verify_token: currentVerifyToken,
      },
      { onConflict: 'workspace_id' },
    );
  }

  return {
    integration: row,
    metaVerifyToken: currentVerifyToken,
    sectionsCount: secCount || 0,
    articlesCount: artCount || 0,
  };
}

export async function saveLegacyIntegrationsAction(
  workspaceId: string,
  form: Partial<WorkspaceIntegration>,
): Promise<{ success: true } | { success: false; error: string }> {
  await assertSettingNotLocked(workspaceId, 'integrations');
  const { supabase } = await getWorkspaceAccess(workspaceId, 'manage_settings');

  const payload: Record<string, unknown> = {
    workspace_id: workspaceId,
    updated_at: new Date().toISOString(),
  };
  for (const field of ALLOWED_LEGACY_INTEGRATION_FIELDS) {
    if (field in form) {
      payload[field] = (form as Record<string, unknown>)[field];
    }
  }

  const { error } = await supabase
    .from('workspace_integrations')
    .upsert(payload, { onConflict: 'workspace_id' });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
