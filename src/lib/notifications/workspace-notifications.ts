import { queryRows } from '@/lib/db';
import { hasServiceRole, serviceClient, type PgCompatClient } from '@/lib/pg/service';
import type { AppNotification, NotificationKind } from '@/lib/data/types';
import { mentionedIds, type MentionPerson } from '@/lib/team-chat/mentions';
import type { WorkspaceNotificationKind, WorkspaceNotificationRow } from '@/types/database';

export const WORKSPACE_NOTIFICATION_KINDS = [
  'handoff',
  'mention',
  'sla_warning',
  'sla_breach',
  'ai_approval',
  'ai_flagged',
  'system',
] as const satisfies readonly WorkspaceNotificationKind[];

const KIND_SET = new Set<string>(WORKSPACE_NOTIFICATION_KINDS);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isWorkspaceNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === 'string' && KIND_SET.has(value);
}

export function sanitizeNotificationHref(raw: string | null | undefined, fallback = '/app'): string {
  const clean = (raw || '').trim();
  if (!clean || !clean.startsWith('/') || clean.startsWith('//')) {
    return fallback;
  }
  return clean.slice(0, 500);
}

export function truncateNotificationText(raw: string | null | undefined, max = 180): string {
  const clean = (raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function rowToAppNotification(row: WorkspaceNotificationRow): AppNotification {
  const readAt = row.read_at ? new Date(row.read_at).toISOString() : null;
  const createdAt = row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString();
  return {
    id: String(row.id),
    workspaceId: row.workspace_id ? String(row.workspace_id) : undefined,
    recipientAgentId: row.recipient_agent_id ? String(row.recipient_agent_id) : null,
    kind: isWorkspaceNotificationKind(row.kind) ? row.kind : 'system',
    title: String(row.title || 'Notification'),
    body: String(row.body || ''),
    href: sanitizeNotificationHref(row.href),
    readAt,
    createdAt,
    unread: readAt === null,
  };
}

function canUseDirectDatabase(): boolean {
  const hasDbUrl = Boolean(
    (process.env.DATABASE_URL || '').trim() || (process.env.TEST_DATABASE_URL || '').trim(),
  );
  if (!hasDbUrl) return false;
  return !process.env.VITEST || Boolean((process.env.TEST_DATABASE_URL || '').trim());
}

/**
 * In Vitest without TEST_DATABASE_URL, `@/lib/db` may be mocked (even via a wrapper
 * arrow function) while `DATABASE_URL` is unset, so calling `queryRows` safely runs
 * the mock or throws synchronously on missing `DATABASE_URL`.
 */
function canTryQueryRowsInTest(): boolean {
  return Boolean(process.env.VITEST) && !(process.env.DATABASE_URL || '').trim();
}

export interface CreateWorkspaceNotificationInput {
  workspaceId: string;
  recipientAgentId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  /** Optional compat client (e.g., mocked service client in route tests). */
  client?: PgCompatClient | null;
  /** Throw on write error (for diagnostic callers such as Send Test Alert). */
  throwOnError?: boolean;
}

/**
 * Persists an in-app notification row in `public.workspace_notifications`.
 * Non-fatal by default so chat, ticket, and cron flows are never disrupted by alert logging.
 */
export async function createWorkspaceNotification(
  input: CreateWorkspaceNotificationInput,
): Promise<AppNotification | null> {
  const workspaceId = (input.workspaceId || '').trim();
  const title = truncateNotificationText(input.title, 160);
  if (!workspaceId || !title || !isWorkspaceNotificationKind(input.kind)) {
    if (input.throwOnError) {
      throw new Error('Invalid workspace notification payload.');
    }
    return null;
  }

  const recipientAgentId =
    input.recipientAgentId && input.recipientAgentId.trim()
      ? input.recipientAgentId.trim()
      : null;
  const body = truncateNotificationText(input.body, 500);
  const href = sanitizeNotificationHref(input.href, '/app');

  const directDb = canUseDirectDatabase();

  try {
    if (!directDb && hasServiceRole()) {
      const targetClient =
        input.client && typeof input.client.from === 'function' ? input.client : serviceClient();
      if (typeof targetClient?.from === 'function') {
        const { data, error } = await targetClient
          .from('workspace_notifications')
          .insert({
            workspace_id: workspaceId,
            recipient_agent_id: recipientAgentId,
            kind: input.kind,
            title,
            body,
            href,
          })
          .select('*')
          .maybeSingle();
        if (error) {
          if (input.throwOnError) throw new Error(error.message || 'Could not create notification.');
          console.warn('[WorkspaceNotification] Insert failed:', error.message);
          return null;
        }
        if (data && typeof data === 'object' && 'id' in data) {
          return rowToAppNotification(data as WorkspaceNotificationRow);
        }
        return null;
      }
    }

    if (directDb || canTryQueryRowsInTest()) {
      const rows = await queryRows<WorkspaceNotificationRow>(
        `INSERT INTO public.workspace_notifications (
           workspace_id, recipient_agent_id, kind, title, body, href
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id::text AS id, workspace_id::text AS workspace_id,
                   recipient_agent_id::text AS recipient_agent_id,
                   kind, title, body, href, read_at, created_at`,
        [workspaceId, recipientAgentId, input.kind, title, body, href],
      );
      return rows[0] ? rowToAppNotification(rows[0]) : null;
    }

    if (input.client && typeof input.client.from === 'function') {
      const { data, error } = await input.client
        .from('workspace_notifications')
        .insert({
          workspace_id: workspaceId,
          recipient_agent_id: recipientAgentId,
          kind: input.kind,
          title,
          body,
          href,
        })
        .select('*')
        .maybeSingle();
      if (error) {
        if (input.throwOnError) throw new Error(error.message || 'Could not create notification.');
        console.warn('[WorkspaceNotification] Insert failed:', error.message);
        return null;
      }
      if (data && typeof data === 'object' && 'id' in data) {
        return rowToAppNotification(data as WorkspaceNotificationRow);
      }
      return null;
    }

    if (input.throwOnError) {
      throw new Error('Database connection is not configured for notifications.');
    }
    return null;
  } catch (err) {
    if (input.throwOnError) throw err;
    console.warn('[WorkspaceNotification] Failed to create notification:', err);
    return null;
  }
}

export interface NotifyInternalNoteMentionsInput {
  workspaceId: string;
  authorId: string;
  authorName?: string | null;
  content: string;
  href: string;
  contextLabel?: string | null;
  explicitMentionedIds?: string[];
  client?: PgCompatClient | null;
}

/**
 * Resolves `@agent` mentions inside an internal note against active workspace agents
 * and writes a `mention` notification for each mentioned teammate (excluding the author).
 */
export async function notifyInternalNoteMentions(
  input: NotifyInternalNoteMentionsInput,
): Promise<AppNotification[]> {
  const content = (input.content || '').trim();
  const explicitIds = (input.explicitMentionedIds || []).filter((id) => UUID_RE.test(id));
  if (!content.includes('@') && explicitIds.length === 0) {
    return [];
  }

  try {
    let people: MentionPerson[] = [];
    const directDb = canUseDirectDatabase();

    if (directDb || (!hasServiceRole() && canTryQueryRowsInTest())) {
      const rows = await queryRows<{ id: string; name: string | null }>(
        `SELECT id::text AS id, name
         FROM public.agents
         WHERE workspace_id = $1
           AND COALESCE(is_active, true) = true`,
        [input.workspaceId],
      );
      people = rows
        .filter((r) => r.id && r.name?.trim())
        .map((r) => ({ id: r.id, name: r.name!.trim() }));
    } else {
      const client =
        hasServiceRole()
          ? serviceClient()
          : input.client && typeof input.client.from === 'function'
            ? input.client
            : null;
      if (client && typeof client.from === 'function') {
        const { data } = await client
          .from('agents')
          .select('id, name, is_active')
          .eq('workspace_id', input.workspaceId);
        const rows = (Array.isArray(data) ? data : []) as Array<{
          id?: string;
          name?: string | null;
          is_active?: boolean | null;
        }>;
        people = rows
          .filter((r) => r.id && r.is_active !== false && r.name?.trim())
          .map((r) => ({ id: String(r.id), name: String(r.name).trim() }));
      }
    }

    if (people.length === 0) return [];
    const activeIds = new Set(people.map((p) => p.id));
    const parsedIds = content.includes('@') ? mentionedIds(content, people) : [];
    const recipientIds = Array.from(
      new Set([...parsedIds, ...explicitIds.filter((id) => activeIds.has(id))]),
    ).filter((id) => id !== input.authorId);

    if (recipientIds.length === 0) return [];

    const author = (input.authorName || '').trim() || 'A teammate';
    const context = (input.contextLabel || '').trim();
    const title = context ? `${author} mentioned you ${context}` : `${author} mentioned you in a note`;

    const created: AppNotification[] = [];
    for (const recipientAgentId of recipientIds) {
      const item = await createWorkspaceNotification({
        workspaceId: input.workspaceId,
        recipientAgentId,
        kind: 'mention',
        title,
        body: content,
        href: input.href,
        client: input.client,
      });
      if (item) created.push(item);
    }
    return created;
  } catch (err) {
    console.warn('[WorkspaceNotification] Failed to notify note mentions:', err);
    return [];
  }
}

interface SlaEventNotificationRow {
  id: number;
  workspace_id: string;
  ticket_id: string | null;
  metric: string | null;
  event: string;
  policy_name: string | null;
  assignee_id: string | null;
  ticket_number?: number | null;
  ticket_subject?: string | null;
}

function slaMetricLabel(metric: string | null | undefined): string {
  if (metric === 'first_reply') return 'First reply';
  if (metric === 'next_reply') return 'Next reply';
  if (metric === 'resolution') return 'Resolution';
  return 'SLA';
}

/**
 * Reads the latest `sla_events.id` before running `fn_sla_tick` so newly recorded
 * warnings/breaches can be converted into persistent workspace notifications cleanly.
 */
export async function getLatestSlaEventId(client?: PgCompatClient | null): Promise<number> {
  try {
    if (canUseDirectDatabase() || (!hasServiceRole() && canTryQueryRowsInTest())) {
      const rows = await queryRows<{ max_id: string | number | null }>(
        `SELECT COALESCE(MAX(id), 0)::bigint AS max_id FROM public.sla_events`,
      );
      return Number(rows[0]?.max_id ?? 0);
    }
    const dbClient = client ?? (hasServiceRole() ? serviceClient() : null);
    if (dbClient && typeof dbClient.from === 'function') {
      const { data } = await dbClient
        .from('sla_events')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      return Number((data as { id?: number | string } | null)?.id ?? 0);
    }
  } catch (err) {
    console.warn('[SLA Notifications] Failed to read latest sla_events id:', err);
  }
  return 0;
}

/**
 * Creates persistent `sla_warning` and `sla_breach` notifications for SLA events
 * recorded since `lastEventId` (typically immediately after `fn_sla_tick()`).
 */
export async function syncSlaEventNotifications(params: {
  lastEventId: number;
  client?: PgCompatClient | null;
}): Promise<{ created: number; notifications: AppNotification[] }> {
  try {
    let rows: SlaEventNotificationRow[] = [];
    const directDb = canUseDirectDatabase();

    if (directDb || (!hasServiceRole() && canTryQueryRowsInTest())) {
      rows = await queryRows<SlaEventNotificationRow>(
        `SELECT se.id::bigint AS id,
                se.workspace_id::text AS workspace_id,
                se.ticket_id::text AS ticket_id,
                se.metric,
                se.event,
                se.policy_name,
                se.assignee_id::text AS assignee_id,
                t.number AS ticket_number,
                t.subject AS ticket_subject
         FROM public.sla_events se
         LEFT JOIN public.tickets t
           ON t.id = se.ticket_id AND t.workspace_id = se.workspace_id
         WHERE se.id > $1
           AND se.event IN ('warning', 'breached')
           AND se.superseded_at IS NULL
         ORDER BY se.id ASC
         LIMIT 200`,
        [params.lastEventId],
      );
    } else {
      const dbClient = params.client ?? (hasServiceRole() ? serviceClient() : null);
      if (dbClient && typeof dbClient.from === 'function') {
        const { data } = await dbClient
          .from('sla_events')
          .select('id, workspace_id, ticket_id, metric, event, policy_name, assignee_id')
          .gt('id', params.lastEventId)
          .in('event', ['warning', 'breached'])
          .is('superseded_at', null)
          .order('id', { ascending: true })
          .limit(200);
        const rawEvents = (Array.isArray(data) ? data : []) as SlaEventNotificationRow[];
        const ticketIds = Array.from(
          new Set(rawEvents.map((e) => e.ticket_id).filter((id): id is string => Boolean(id))),
        );
        const ticketMap = new Map<string, { number?: number | null; subject?: string | null }>();
        if (ticketIds.length > 0) {
          const { data: ticketRows } = await dbClient
            .from('tickets')
            .select('id, number, subject')
            .in('id', ticketIds);
          for (const t of (Array.isArray(ticketRows) ? ticketRows : []) as Array<{
            id: string;
            number?: number | null;
            subject?: string | null;
          }>) {
            ticketMap.set(t.id, t);
          }
        }
        rows = rawEvents.map((ev) => {
          const t = ev.ticket_id ? ticketMap.get(ev.ticket_id) : undefined;
          return {
            ...ev,
            ticket_number: ev.ticket_number ?? t?.number ?? null,
            ticket_subject: ev.ticket_subject ?? t?.subject ?? null,
          };
        });
      }
    }

    const notifications: AppNotification[] = [];
    for (const ev of rows) {
      const isBreach = ev.event === 'breached';
      const metric = slaMetricLabel(ev.metric);
      const ticketLabel = ev.ticket_number ? `Ticket #${ev.ticket_number}` : 'ticket';
      const subject = truncateNotificationText(ev.ticket_subject, 100);
      const policy = (ev.policy_name || '').trim();
      const title = isBreach
        ? `SLA breached on ${ticketLabel}`
        : `SLA warning on ${ticketLabel}`;
      const bodyParts = [
        `${metric} ${isBreach ? 'breached' : 'due soon'}`,
        subject || null,
        policy ? `Policy: ${policy}` : null,
      ].filter(Boolean);

      const created = await createWorkspaceNotification({
        workspaceId: ev.workspace_id,
        recipientAgentId: ev.assignee_id ?? null,
        kind: isBreach ? 'sla_breach' : 'sla_warning',
        title,
        body: bodyParts.join(' · '),
        href: ev.ticket_id ? `/app/tickets?id=${encodeURIComponent(ev.ticket_id)}` : '/app/tickets',
        client: params.client,
      });
      if (created) notifications.push(created);
    }

    return { created: notifications.length, notifications };
  } catch (err) {
    console.warn('[SLA Notifications] Failed to sync SLA notifications:', err);
    return { created: 0, notifications: [] };
  }
}
