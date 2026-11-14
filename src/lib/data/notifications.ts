import type { AppNotification } from './types';

/* TODO(backend): there is no in-app notification feed. Push and email
   notifications exist (/api/notifications/*), but nothing stores a per-agent
   list with read state. Until it does, the bell shows its empty state.
   Tracked in docs/design/BACKEND_GAPS.md. */
export async function listNotifications(workspaceId: string): Promise<AppNotification[]> {
  void workspaceId;
  return [];
}

/* TODO(backend): see listNotifications. */
export async function markAllNotificationsRead(workspaceId: string): Promise<void> {
  void workspaceId;
}
