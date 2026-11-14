/* View models for the new UI. Screens use these, never raw database rows, so
   swapping a mock for a real backend call only changes src/lib/data/*. */

import type { Role } from '@/lib/team/permissions';

export type AgentPresence = 'online' | 'away' | 'offline';

export interface ShellAgent {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  status: AgentPresence;
  isSuperAdmin: boolean;
}

export interface ShellWorkspace {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface ShellSession {
  agent: ShellAgent;
  workspace: ShellWorkspace;
}

export type NotificationKind = 'handoff' | 'sla' | 'mention' | 'ai';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  unread: boolean;
}
