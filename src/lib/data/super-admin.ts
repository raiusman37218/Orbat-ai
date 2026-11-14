import {
  adminInviteStaffAction,
  adminReviewTrialExtensionAction,
  adminRevokeStaffAction,
  adminSaveAiConfigAndTiersAction,
  adminSavePlanQuickAction,
  adminSavePlatformGovernanceAction,
  adminSwitchIntoWorkspaceAction,
  adminTestAiKeyAction,
  adminToggleWorkspaceSuspendedAction,
  adminUpdateStaffRoleAction,
  getSuperAdminConsoleBundleAction,
  type SuperAdminConsoleBundle,
  type SuperAdminStaffInvitationRow,
  type SuperAdminTrialExtensionRow,
  type SuperAdminWorkspaceRow,
} from '@/app/actions/admin-studio';
import type { ProviderId } from '@/lib/ai/provider';
import type { PlatformStaffRole } from '@/types/platform-management';

export type SuperAdminUnauthorized = {
  authorized: false;
  authenticated: boolean;
  email: string | null;
  reason: string;
};

export type SuperAdminConsoleView = SuperAdminConsoleBundle | SuperAdminUnauthorized;

export type {
  SuperAdminConsoleBundle,
  SuperAdminStaffInvitationRow,
  SuperAdminTrialExtensionRow,
  SuperAdminWorkspaceRow,
  ProviderId,
  PlatformStaffRole,
};

// TODO(backend): Add real-time cross-tenant cloud infrastructure telemetry (queue depth, Redis memory, Postgres active connections, error rates) and cross-tenant billing webhook reconciliation.
export async function loadSuperAdminConsole(): Promise<SuperAdminConsoleView> {
  const res = await getSuperAdminConsoleBundleAction();
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function toggleWorkspaceSuspended(
  workspaceId: string,
  suspend: boolean,
  reason?: string,
) {
  const res = await adminToggleWorkspaceSuspendedAction(workspaceId, suspend, reason);
  if (!res.success) throw new Error(res.error || 'Could not update workspace status.');
  return res;
}

export async function switchIntoWorkspace(workspaceId: string) {
  const res = await adminSwitchIntoWorkspaceAction(workspaceId);
  if (!res.success) throw new Error(res.error || 'Could not open workspace.');
  return res;
}

export async function savePlanQuick(plan: {
  id: string;
  monthly_price: number;
  yearly_price: number;
  max_agents: number | null;
  max_ai_bot_replies_per_month: number | null;
  max_channels_connected: number | null;
}) {
  const res = await adminSavePlanQuickAction(plan);
  if (!res.success) throw new Error(res.error || 'Could not update plan limits.');
  return res;
}

export async function saveAiConfigAndTiers(input: {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  isEnabled: boolean;
  routerTiers: { light: string; standard: string; advanced: string };
}) {
  const res = await adminSaveAiConfigAndTiersAction(input);
  if (!res.success) throw new Error(res.error || 'Could not update AI router settings.');
  return res;
}

export async function testAiProviderKey() {
  return adminTestAiKeyAction();
}

export async function savePlatformGovernance(input: {
  signupMode: 'open' | 'invite_only';
  defaultPlanSlug: string;
  defaultTrialDays: number;
  defaultDataRetentionDays: number;
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  defaultRequire2fa: boolean;
  paygRates?: Record<string, number>;
}) {
  const res = await adminSavePlatformGovernanceAction(input);
  if (!res.success) throw new Error(res.error || 'Could not save platform settings.');
  return res;
}

export async function invitePlatformStaff(email: string, name: string) {
  const res = await adminInviteStaffAction(email, name);
  if (!res.success) throw new Error(res.error || 'Could not invite staff member.');
  return res;
}

export async function changePlatformStaffRole(agentId: string, role: PlatformStaffRole) {
  const res = await adminUpdateStaffRoleAction(agentId, role);
  if (!res.success) throw new Error(res.error || 'Could not update staff role.');
  return res;
}

export async function revokePlatformStaff(agentId: string) {
  const res = await adminRevokeStaffAction(agentId);
  if (!res.success) throw new Error(res.error || 'Could not revoke staff access.');
  return res;
}

export async function reviewTrialExtension(requestId: string, decision: 'approved' | 'rejected') {
  const res = await adminReviewTrialExtensionAction(requestId, decision);
  if (!res.success) throw new Error(res.error || 'Could not review extension request.');
  return res;
}
