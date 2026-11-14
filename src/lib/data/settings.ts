import {
  cancelWorkspaceDeletionAction,
  createStudioApiKeyAction,
  createStudioWebhookAction,
  deleteStudioWebhookAction,
  getWorkspaceEmailTemplatesAction,
  getWorkspaceSettingsBundleAction,
  rotateStudioWebhookSecretAction,
  saveWorkspaceAiBehaviorStudioAction,
  saveWorkspaceBrandingStudioAction,
  saveWorkspaceEmailTemplateAction,
  saveWorkspaceGeneralStudioAction,
  saveWorkspaceNotificationMatrixAction,
  saveWorkspaceSecurityStudioAction,
  scheduleWorkspaceDeletionAction,
  sendTestWorkspaceEmailAction,
  testStudioWebhookAction,
  updateStudioWebhookAction,
  revokeStudioApiKeyAction,
  type EmailTemplateRecord,
  type NotificationMatrixPrefs,
  type WorkspaceSettingsBundle,
} from '@/app/actions/settings-studio';

export type {
  EmailTemplateRecord,
  NotificationMatrixPrefs,
  WorkspaceSettingsBundle,
};

export async function fetchWorkspaceSettingsBundle(
  workspaceId: string,
): Promise<WorkspaceSettingsBundle> {
  // TODO(backend): Enterprise per-workspace SAML/OIDC SSO metadata upload is not implemented on NestJS yet.
  const res = await getWorkspaceSettingsBundleAction(workspaceId);
  if (!res.success) {
    throw new Error(res.error);
  }
  return res.data;
}

export async function fetchWorkspaceEmailTemplates(
  workspaceId: string,
  language = 'en',
): Promise<EmailTemplateRecord[]> {
  const res = await getWorkspaceEmailTemplatesAction(workspaceId, language);
  if (!res.success) {
    throw new Error(res.error);
  }
  return res.templates;
}

export {
  cancelWorkspaceDeletionAction,
  createStudioApiKeyAction,
  createStudioWebhookAction,
  deleteStudioWebhookAction,
  revokeStudioApiKeyAction,
  rotateStudioWebhookSecretAction,
  saveWorkspaceAiBehaviorStudioAction,
  saveWorkspaceBrandingStudioAction,
  saveWorkspaceEmailTemplateAction,
  saveWorkspaceGeneralStudioAction,
  saveWorkspaceNotificationMatrixAction,
  saveWorkspaceSecurityStudioAction,
  scheduleWorkspaceDeletionAction,
  sendTestWorkspaceEmailAction,
  testStudioWebhookAction,
  updateStudioWebhookAction,
};
