'use client';

import {
  getTeamCommandCenterAction,
  reassignTicketQuickAction,
  type AgentRosterMember,
  type AttentionItem,
  type PendingInviteSummary,
  type TeamCommandBootstrap,
  type TeamGroupSummary,
} from '@/app/actions/team-studio';
import {
  createGroupAction,
  deactivateMemberAction,
  deleteGroupAction,
  inviteMemberAction,
  reactivateMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
  setGroupMembersAction,
  setMemberCapacityAction,
  setMemberRoleAction,
  updateGroupAction,
  type ReassignMode,
} from '@/app/actions/team';
import { assignableRoles, ROLE_LABELS, type Role } from '@/lib/team/permissions';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

// TODO(backend): Add custom workspace role definitions (`role_permissions_overrides`) if admins need per-capability overrides beyond owner/admin/agent/light_agent.

export type {
  AgentRosterMember,
  AttentionItem,
  PendingInviteSummary,
  ReassignMode,
  Role,
  TeamCommandBootstrap,
  TeamGroupSummary,
};
export { assignableRoles, ROLE_LABELS };

export function getTeamCommandCenter(workspaceId: string) {
  return getTeamCommandCenterAction(workspaceId);
}

export function reassignTicketQuick(workspaceId: string, ticketId: string, assigneeId: string | null) {
  return reassignTicketQuickAction(workspaceId, ticketId, assigneeId);
}

export function inviteMember(
  workspaceId: string,
  input: { name: string; email: string; role: Role; groupIds?: string[] },
) {
  return inviteMemberAction(workspaceId, input);
}

export function resendInvite(workspaceId: string, invitationId: string) {
  return resendInvitationAction(workspaceId, invitationId);
}

export function revokeInvite(workspaceId: string, invitationId: string) {
  return revokeInvitationAction(workspaceId, invitationId);
}

export function updateMemberRole(workspaceId: string, agentId: string, role: Role) {
  return setMemberRoleAction(workspaceId, agentId, role);
}

export function updateMemberCapacity(workspaceId: string, agentId: string, maxOpen: number | null) {
  return setMemberCapacityAction(workspaceId, agentId, maxOpen);
}

export function deactivateMember(
  workspaceId: string,
  agentId: string,
  reassign: { mode: ReassignMode; to?: string | null },
) {
  return deactivateMemberAction(workspaceId, agentId, reassign);
}

export function reactivateMember(workspaceId: string, agentId: string) {
  return reactivateMemberAction(workspaceId, agentId);
}

export function createTeamGroup(workspaceId: string, input: { name: string; roundRobin?: boolean }) {
  return createGroupAction(workspaceId, input);
}

export function updateTeamGroup(
  workspaceId: string,
  groupId: string,
  patch: { name?: string; roundRobin?: boolean },
) {
  return updateGroupAction(workspaceId, groupId, patch);
}

export function deleteTeamGroup(workspaceId: string, groupId: string) {
  return deleteGroupAction(workspaceId, groupId);
}

export function setTeamGroupMembers(workspaceId: string, groupId: string, agentIds: string[]) {
  return setGroupMembersAction(workspaceId, groupId, agentIds);
}

export function useTeamLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
) {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 25_000,
    onRefresh,
  });
}
