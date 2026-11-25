'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import { userError } from '@/lib/errors/user-error';
import {
  createWorkspaceNotification,
  rowToAppNotification,
} from '@/lib/notifications/workspace-notifications';
import type { AppNotification } from '@/lib/data/types';
import type { WorkspaceNotificationRow } from '@/types/database';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NotificationsFeedResult {
  unreadCount: number;
  items: AppNotification[];
}

/**
 * Lists the caller's visible notifications in `workspaceId` (both workspace-wide
 * alerts where `recipient_agent_id IS NULL` and personal alerts for the caller),
 * returning the total unread count alongside the most recent items (default 25).
 */
export async function listNotificationsAction(
  workspaceId: string,
  limit = 25,
): Promise<NotificationsFeedResult> {
  const access = await getWorkspaceAccess(workspaceId, 'view');
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 25)));

  const [countRows, itemRows] = await Promise.all([
    queryRows<{ unread_count: number }>(
      `SELECT COUNT(*)::int AS unread_count
       FROM public.workspace_notifications
       WHERE workspace_id = $1
         AND (recipient_agent_id IS NULL OR recipient_agent_id = $2)
         AND read_at IS NULL`,
      [workspaceId, access.user.id],
    ),
    queryRows<WorkspaceNotificationRow>(
      `SELECT id::text AS id,
              workspace_id::text AS workspace_id,
              recipient_agent_id::text AS recipient_agent_id,
              kind,
              title,
              body,
              href,
              read_at,
              created_at
       FROM public.workspace_notifications
       WHERE workspace_id = $1
         AND (recipient_agent_id IS NULL OR recipient_agent_id = $2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [workspaceId, access.user.id, safeLimit],
    ),
  ]);

  return {
    unreadCount: Number(countRows[0]?.unread_count ?? 0),
    items: itemRows.map(rowToAppNotification),
  };
}

/**
 * Marks a single notification in `workspaceId` as read for the caller.
 */
export async function markNotificationReadAction(
  workspaceId: string,
  id: string,
): Promise<{ success: true }> {
  const access = await getWorkspaceAccess(workspaceId, 'view');
  if (!UUID_RE.test(id || '')) {
    throw userError('Invalid notification id.');
  }

  await query(
    `UPDATE public.workspace_notifications
     SET read_at = COALESCE(read_at, now())
     WHERE id = $1
       AND workspace_id = $2
       AND (recipient_agent_id IS NULL OR recipient_agent_id = $3)`,
    [id, workspaceId, access.user.id],
  );

  return { success: true };
}

/**
 * Marks all unread notifications visible to the caller in `workspaceId` as read.
 */
export async function markAllNotificationsReadAction(
  workspaceId: string,
): Promise<{ success: true }> {
  const access = await getWorkspaceAccess(workspaceId, 'view');

  await query(
    `UPDATE public.workspace_notifications
     SET read_at = now()
     WHERE workspace_id = $1
       AND (recipient_agent_id IS NULL OR recipient_agent_id = $2)
       AND read_at IS NULL`,
    [workspaceId, access.user.id],
  );

  return { success: true };
}

/**
 * Admin-only diagnostic trigger used from `/app/states` to verify end-to-end
 * persistence and live bell updates in `workspace_notifications`.
 */
export async function sendTestNotificationAction(
  workspaceId: string,
): Promise<{ success: true; notification: AppNotification }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  const actorName = access.agent.name?.trim() || 'Workspace Admin';

  const notification = await createWorkspaceNotification({
    workspaceId,
    recipientAgentId: access.user.id,
    kind: 'system',
    title: 'Diagnostic test alert',
    body: `Triggered by ${actorName} from System states to verify persistent notifications.`,
    href: '/app/states',
    throwOnError: true,
  });

  if (!notification) {
    throw userError('Could not create diagnostic test alert.');
  }

  return { success: true, notification };
}
