'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import { CAPABILITIES, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, isRole, roleCan, type Capability, type Role } from '@/lib/team/permissions';
import { userError } from '@/lib/errors/user-error';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AttentionItem {
  id: string;
  kind: 'sla_risk' | 'waiting_handoff' | 'ai_review' | 'overloaded_agent';
  severity: 'high' | 'medium';
  title: string;
  subtitle: string;
  targetType: 'ticket' | 'conversation' | 'ai_review' | 'agent';
  targetId: string;
  actionHref: string;
  assigneeId: string | null;
}

export interface AgentRosterMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  status: 'online' | 'away' | 'offline';
  isActive: boolean;
  deactivatedAt: string | null;
  maxCapacity: number | null;
  effectiveCapacity: number;
  openTickets: number;
  activeChats: number;
  loadPct: number;
  loadSlots: number;
  isOverloaded: boolean;
  csatAvg: number | null;
  csatCount: number;
  groupIds: string[];
}

export interface TeamGroupSummary {
  id: string;
  name: string;
  description: string | null;
  roundRobin: boolean;
  memberIds: string[];
  openTicketsCount: number;
}

export interface PendingInviteSummary {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
  lastSentAt: string | null;
  sendError: string | null;
}

export interface TeamCommandBootstrap {
  me: { id: string; role: Role };
  canManageTeam: boolean;
  canManageGroups: boolean;
  canManageSettings: boolean;
  timezone: string;
  mailReady: boolean;
  mailFrom: string | null;
  kpis: {
    availableAgents: number;
    totalActiveAgents: number;
    waitingChats: number;
    atRiskSlas: number;
    aiNeedsReview: number;
    overloadedAgents: number;
  };
  aiWorkload: {
    activeConversations: number;
    repliesToday: number;
    primaryAgentName: string | null;
  };
  attention: AttentionItem[];
  members: AgentRosterMember[];
  groups: TeamGroupSummary[];
  invitations: PendingInviteSummary[];
  roleMatrix: {
    roles: Array<{ role: Role; label: string; description: string }>;
    capabilities: Array<{ key: Capability; label: string; allowedRoles: Role[] }>;
  };
}

const CAPABILITY_LABELS: Record<Capability, string> = {
  view: 'View conversations, tickets & dashboard',
  add_note: 'Add internal team notes',
  reply: 'Reply publicly to customers & claim chats',
  edit_ticket: 'Edit ticket status, priority & assignees',
  edit_content: 'Publish knowledge articles & AI QA cards',
  manage_groups: 'Create and edit teams & round-robin groups',
  manage_team: 'Invite, assign roles, set capacities & deactivate members',
  manage_settings: 'Manage schedule, compliance, handoff & workspace settings',
};

export async function getTeamCommandCenterAction(workspaceId: string): Promise<TeamCommandBootstrap> {
  const access = await getWorkspaceAccess(workspaceId, 'view');

  const [
    wsRows,
    agentRows,
    groupRows,
    membershipRows,
    openTickets,
    waitingConvos,
    slaRisks,
    aiReviews,
    aiWorkloadRows,
    aiAgentRows,
    surveyRows,
    inviteRows,
  ] = await Promise.all([
    queryRows<{ timezone: string | null; smtp_settings: Record<string, unknown> | null }>(
      `SELECT timezone, smtp_settings FROM public.workspaces WHERE id = $1 LIMIT 1`,
      [workspaceId],
    ),
    queryRows<{
      id: string;
      name: string;
      email: string;
      avatar_url: string | null;
      role: string;
      status: string;
      is_active: boolean;
      deactivated_at: string | null;
      max_open_tickets: number | null;
      manual_status: string | null;
      max_concurrent_chats: number | null;
      active_handoff_chats: string;
    }>(
      `SELECT a.id, a.name, a.email, a.avatar_url, a.role, a.status, a.is_active, a.deactivated_at, a.max_open_tickets,
              s.manual_status, s.max_concurrent_chats,
              (
                SELECT COUNT(*)
                FROM public.conversations c
                WHERE c.workspace_id = $1
                  AND c.assigned_agent_id = a.id
                  AND c.status = 'open'
              )::text AS active_handoff_chats
       FROM public.agents a
       LEFT JOIN public.agent_status s ON s.agent_id = a.id AND s.workspace_id = $1
       WHERE a.workspace_id = $1
       ORDER BY (a.role = 'owner') DESC, a.is_active DESC, a.name ASC`,
      [workspaceId],
    ),
    queryRows<{ id: string; name: string; description: string | null; round_robin: boolean }>(
      `SELECT id, name, description, round_robin FROM public.ticket_groups WHERE workspace_id = $1 ORDER BY name ASC`,
      [workspaceId],
    ),
    queryRows<{ group_id: string; agent_id: string }>(
      `SELECT group_id, agent_id FROM public.ticket_group_members WHERE workspace_id = $1`,
      [workspaceId],
    ),
    queryRows<{ id: string; subject: string | null; priority: string; assignee_id: string | null; group_id: string | null; status: string }>(
      `SELECT id, subject, priority, assignee_id, group_id, status
       FROM public.tickets
       WHERE workspace_id = $1 AND status IN ('new', 'open')`,
      [workspaceId],
    ),
    queryRows<{
      id: string;
      channel: string | null;
      handoff_status: string;
      handoff_reason: string | null;
      handoff_requested_at: string | null;
      created_at: string;
      visitor_name: string | null;
      summary: string | null;
    }>(
      `SELECT c.id, c.channel, c.handoff_status, c.handoff_reason, c.handoff_requested_at, c.created_at,
              v.name AS visitor_name, c.summary
       FROM public.conversations c
       LEFT JOIN public.visitors v ON v.id = c.visitor_id
       WHERE c.workspace_id = $1
         AND c.status = 'open'
         AND c.handoff_status IN ('waiting_for_agent', 'offline_queued', 'handoff_offered')
       ORDER BY COALESCE(c.handoff_requested_at, c.updated_at) ASC
       LIMIT 20`,
      [workspaceId],
    ),
    queryRows<{
      ticket_id: string;
      metric: string;
      status: string;
      due_at: string | null;
      subject: string | null;
      assignee_id: string | null;
      assignee_name: string | null;
    }>(
      `SELECT t.ticket_id, t.metric, t.status, t.due_at, tk.subject, tk.assignee_id, a.name AS assignee_name
       FROM public.ticket_sla_timers t
       JOIN public.tickets tk ON tk.id = t.ticket_id
       LEFT JOIN public.agents a ON a.id = tk.assignee_id
       WHERE t.workspace_id = $1
         AND t.status IN ('warning', 'breached')
         AND tk.status IN ('new', 'open')
       ORDER BY (t.status = 'breached') DESC, t.due_at ASC NULLS LAST
       LIMIT 12`,
      [workspaceId],
    ),
    queryRows<{ id: string; agent_name: string | null; customer_question: string; created_at: string }>(
      `SELECT id, agent_name, customer_question, created_at
       FROM public.ai_verification_logs
       WHERE workspace_id = $1
         AND verdict = 'needs_review'
         AND human_review IS NULL
       ORDER BY created_at DESC
       LIMIT 10`,
      [workspaceId],
    ),
    queryRows<{ active_ai: string; replies_today: string }>(
      `SELECT
         (SELECT COUNT(*) FROM public.conversations WHERE workspace_id = $1 AND status = 'open' AND handoff_status IN ('bot_active', 'handoff_offered') AND ai_enabled = true)::text AS active_ai,
         (SELECT COUNT(*) FROM public.ai_reply_events WHERE workspace_id = $1 AND event IN ('reply_delivered', 'replied') AND created_at >= date_trunc('day', now()))::text AS replies_today`,
      [workspaceId],
    ),
    queryRows<{ name: string }>(
      `SELECT name FROM public.ai_agents WHERE workspace_id = $1 AND status = 'live' ORDER BY is_primary DESC, updated_at DESC LIMIT 1`,
      [workspaceId],
    ),
    queryRows<{ assigned_agent_id: string | null; score: number }>(
      `SELECT c.assigned_agent_id, s.score
       FROM public.survey_responses s
       JOIN public.conversations c ON c.id = s.conversation_id
       WHERE s.workspace_id = $1
         AND c.assigned_agent_id IS NOT NULL`,
      [workspaceId],
    ),
    queryRows<{
      id: string;
      email: string;
      name: string;
      role: string;
      created_at: string;
      expires_at: string;
      last_sent_at: string | null;
      send_error: string | null;
    }>(
      `SELECT id, email, name, role, created_at, expires_at, last_sent_at, send_error
       FROM public.workspace_invitations
       WHERE workspace_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [workspaceId],
    ),
  ]);

  const openTicketCountByAgent = new Map<string, number>();
  const openTicketCountByGroup = new Map<string, number>();
  for (const tk of openTickets) {
    if (tk.assignee_id) {
      openTicketCountByAgent.set(tk.assignee_id, (openTicketCountByAgent.get(tk.assignee_id) || 0) + 1);
    }
    if (tk.group_id) {
      openTicketCountByGroup.set(tk.group_id, (openTicketCountByGroup.get(tk.group_id) || 0) + 1);
    }
  }

  const csatByAgent = new Map<string, { sum: number; count: number }>();
  for (const sr of surveyRows) {
    if (!sr.assigned_agent_id) continue;
    const prev = csatByAgent.get(sr.assigned_agent_id) || { sum: 0, count: 0 };
    prev.sum += Number(sr.score) || 0;
    prev.count += 1;
    csatByAgent.set(sr.assigned_agent_id, prev);
  }

  const members: AgentRosterMember[] = agentRows.map((a) => {
    const rawStatus = a.manual_status || a.status || 'offline';
    const status: 'online' | 'away' | 'offline' =
      rawStatus === 'online' || rawStatus === 'away' ? rawStatus : 'offline';
    const openTk = openTicketCountByAgent.get(a.id) || 0;
    const activeChats = Number(a.active_handoff_chats || 0);
    const effectiveCap = a.max_open_tickets ?? a.max_concurrent_chats ?? 8;
    const loadBase = Math.max(openTk, activeChats);
    const loadPct = effectiveCap > 0 ? Math.min(100, Math.round((loadBase / effectiveCap) * 100)) : 0;
    const loadSlots = effectiveCap > 0 ? Math.min(8, Math.round((loadBase / effectiveCap) * 8)) : 0;
    const csat = csatByAgent.get(a.id);

    return {
      id: a.id,
      name: a.name,
      email: a.email,
      avatarUrl: a.avatar_url,
      role: isRole(a.role) ? a.role : 'agent',
      status,
      isActive: a.is_active !== false,
      deactivatedAt: a.deactivated_at,
      maxCapacity: a.max_open_tickets,
      effectiveCapacity: effectiveCap,
      openTickets: openTk,
      activeChats,
      loadPct,
      loadSlots,
      isOverloaded: a.is_active !== false && a.max_open_tickets !== null && openTk >= a.max_open_tickets,
      csatAvg: csat && csat.count > 0 ? Math.round((csat.sum / csat.count) * 10) / 10 : null,
      csatCount: csat?.count || 0,
      groupIds: membershipRows.filter((m) => m.agent_id === a.id).map((m) => m.group_id),
    };
  });

  const attention: AttentionItem[] = [];
  for (const s of slaRisks) {
    attention.push({
      id: `sla-${s.ticket_id}-${s.metric}`,
      kind: 'sla_risk',
      severity: s.status === 'breached' ? 'high' : 'medium',
      title: s.subject?.trim() || `Ticket ${s.ticket_id.slice(0, 8)}`,
      subtitle: `${s.status === 'breached' ? 'SLA breached' : 'SLA warning'} (${s.metric.replace('_', ' ')})${s.assignee_name ? ` · Assigned to ${s.assignee_name}` : ' · Unassigned'}`,
      targetType: 'ticket',
      targetId: s.ticket_id,
      actionHref: `/app/tickets?ticket=${s.ticket_id}`,
      assigneeId: s.assignee_id,
    });
  }
  for (const w of waitingConvos) {
    attention.push({
      id: `handoff-${w.id}`,
      kind: 'waiting_handoff',
      severity: w.handoff_status === 'waiting_for_agent' ? 'high' : 'medium',
      title: `${w.visitor_name || 'Customer'} · ${(w.channel || 'chat').toUpperCase()}`,
      subtitle: w.handoff_reason || w.summary || `Status: ${w.handoff_status.replaceAll('_', ' ')}`,
      targetType: 'conversation',
      targetId: w.id,
      actionHref: `/app/inbox?conversation=${w.id}`,
      assigneeId: null,
    });
  }
  for (const r of aiReviews) {
    attention.push({
      id: `airev-${r.id}`,
      kind: 'ai_review',
      severity: 'medium',
      title: `AI review needed (${r.agent_name || 'AI Assistant'})`,
      subtitle: r.customer_question.slice(0, 110),
      targetType: 'ai_review',
      targetId: r.id,
      actionHref: '/app/ai-quality',
      assigneeId: null,
    });
  }
  for (const m of members.filter((x) => x.isOverloaded)) {
    attention.push({
      id: `over-${m.id}`,
      kind: 'overloaded_agent',
      severity: 'medium',
      title: `${m.name} is at capacity (${m.openTickets}/${m.maxCapacity})`,
      subtitle: 'Reassign open tickets or raise capacity limit',
      targetType: 'agent',
      targetId: m.id,
      actionHref: `/app/tickets?assignee=${m.id}`,
      assigneeId: m.id,
    });
  }

  const smtp = wsRows[0]?.smtp_settings;
  const mailFrom = typeof smtp?.from_email === 'string' && smtp.from_email.trim() ? smtp.from_email.trim() : null;
  const activeMembers = members.filter((m) => m.isActive);

  return {
    me: { id: access.user.id, role: access.role },
    canManageTeam: roleCan(access.role, 'manage_team'),
    canManageGroups: roleCan(access.role, 'manage_groups'),
    canManageSettings: roleCan(access.role, 'manage_settings'),
    timezone: wsRows[0]?.timezone || 'UTC',
    mailReady: Boolean(smtp && smtp.host),
    mailFrom,
    kpis: {
      availableAgents: activeMembers.filter((m) => m.status === 'online' && m.role !== 'light_agent').length,
      totalActiveAgents: activeMembers.length,
      waitingChats: waitingConvos.length,
      atRiskSlas: slaRisks.length,
      aiNeedsReview: aiReviews.length,
      overloadedAgents: activeMembers.filter((m) => m.isOverloaded).length,
    },
    aiWorkload: {
      activeConversations: Number(aiWorkloadRows[0]?.active_ai || 0),
      repliesToday: Number(aiWorkloadRows[0]?.replies_today || 0),
      primaryAgentName: aiAgentRows[0]?.name || null,
    },
    attention: attention.slice(0, 12),
    members,
    groups: groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      roundRobin: Boolean(g.round_robin),
      memberIds: membershipRows.filter((m) => m.group_id === g.id).map((m) => m.agent_id),
      openTicketsCount: openTicketCountByGroup.get(g.id) || 0,
    })),
    invitations: inviteRows
      .filter((i) => isRole(i.role))
      .map((i) => ({
        id: i.id,
        email: i.email,
        name: i.name,
        role: i.role as Role,
        createdAt: i.created_at,
        expiresAt: i.expires_at,
        lastSentAt: i.last_sent_at,
        sendError: i.send_error,
      })),
    roleMatrix: {
      roles: ROLES.map((r) => ({ role: r, label: ROLE_LABELS[r], description: ROLE_DESCRIPTIONS[r] })),
      capabilities: CAPABILITIES.map((c) => ({
        key: c,
        label: CAPABILITY_LABELS[c],
        allowedRoles: ROLES.filter((r) => roleCan(r, c)),
      })),
    },
  };
}

export async function reassignTicketQuickAction(
  workspaceId: string,
  ticketId: string,
  assigneeId: string | null,
): Promise<{ success: boolean }> {
  const access = await getWorkspaceAccess(workspaceId, 'edit_ticket');
  if (!UUID.test(ticketId || '')) throw userError('Invalid ticket id.');
  if (assigneeId !== null && !UUID.test(assigneeId)) throw userError('Invalid teammate id.');

  if (assigneeId) {
    const member = await queryRows<{ id: string }>(
      `SELECT id FROM public.agents WHERE id = $1 AND workspace_id = $2 AND is_active = true LIMIT 1`,
      [assigneeId, workspaceId],
    );
    if (!member[0]) throw userError('Selected teammate does not belong to this workspace.');
  }

  const res = await query(
    `UPDATE public.tickets
     SET assignee_id = $1, updated_at = now()
     WHERE id = $2 AND workspace_id = $3
     RETURNING id`,
    [assigneeId, ticketId, workspaceId],
  );
  if (!res.rows.length) throw userError('Ticket not found.');

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'ticket.reassigned', $4, $5::jsonb)`,
    [
      workspaceId,
      access.user.id,
      access.user.email || 'Agent',
      ticketId,
      JSON.stringify({ assignee_id: assigneeId }),
    ],
  ).catch(() => {});

  return { success: true };
}
