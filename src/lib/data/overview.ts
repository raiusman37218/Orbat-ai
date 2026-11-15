'use client';

import { listDashboardConversationsAction } from '@/app/actions/inbox';
import { getTicketsBootstrapAction } from '@/app/actions/tickets';
import { getKnowledgeGapsSummaryAction } from '@/app/actions/unanswered';
import type { ReportsDashboardData, ReportsSummary } from '@/lib/reports/metrics';
import type { AgentPresence } from './types';

/* Data for the Overview screen (docs/design/design/Main.dc.html).
   Period numbers come from /api/reports (the same engine as the old Reports
   page, built on reporting_events); live numbers come from the ticket
   bootstrap the tickets screen uses. */

export type OverviewRange = '7d' | '30d' | '90d';

export const OVERVIEW_RANGES: { id: OverviewRange; label: string; days: number }[] = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
];

export interface VolumePoint {
  date: string;
  label: string;
  created: number;
  solved: number;
}

export interface ChannelShare {
  key: string;
  label: string;
  count: number;
  percentage: number;
}

export interface OverviewReport {
  summary: ReportsSummary;
  /** The same-length period just before, for the deltas. */
  previous: ReportsSummary | null;
  series: VolumePoint[];
  channels: ChannelShare[];
}

async function fetchReport(
  workspaceId: string,
  start: Date,
  end: Date,
  includePrevious = false,
): Promise<ReportsDashboardData & { previousSummary?: ReportsSummary | null }> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    range: 'custom',
    start_date: start.toISOString(),
    end_date: end.toISOString(),
  });
  if (includePrevious) {
    params.set('include_previous', '1');
  }
  const res = await fetch(`/api/reports?${params}`, { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || 'The report could not be loaded.');
  return body as ReportsDashboardData & { previousSummary?: ReportsSummary | null };
}

export async function getOverviewReport(workspaceId: string, range: OverviewRange): Promise<OverviewReport> {
  const days = OVERVIEW_RANGES.find((r) => r.id === range)?.days ?? 7;
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);

  const current = await fetchReport(workspaceId, start, end, true);

  return {
    summary: current.summary,
    previous: current.previousSummary ?? null,
    series: current.createdVsSolved.map((p) => ({ date: p.date, label: p.label, created: p.created, solved: p.solved })),
    channels: current.channelBreakdown.map((c) => ({
      key: c.key,
      label: c.label,
      count: c.count,
      percentage: c.percentage,
    })),
  };
}

export interface TeamMemberLoad {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: AgentPresence;
  role: string;
  openTickets: number;
  capacity: number | null;
}

export interface OverviewLive {
  openCount: number;
  unassignedCount: number;
  myOpenCount: number;
  team: TeamMemberLoad[];
}

const STATUS_ORDER: Record<AgentPresence, number> = { online: 0, away: 1, offline: 2 };

export async function getOverviewLive(workspaceId: string): Promise<OverviewLive> {
  const boot = await getTicketsBootstrapAction(workspaceId);
  const team = boot.agents
    .filter((a) => a.is_active && a.role !== 'light_agent')
    .map((a) => ({
      id: a.id,
      name: a.name || 'Teammate',
      avatarUrl: a.avatar_url,
      status: (a.status === 'online' || a.status === 'away' ? a.status : 'offline') as AgentPresence,
      role: a.role,
      openTickets: a.open_tickets,
      capacity: a.max_open_tickets,
    }))
    .sort((x, y) => STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || y.openTickets - x.openTickets);

  return {
    openCount: boot.counts['system:all_open'] ?? 0,
    unassignedCount: boot.counts['system:unassigned'] ?? 0,
    myOpenCount: boot.counts['system:my_open'] ?? 0,
    team,
  };
}

export interface RecentConversation {
  id: string;
  customer: string;
  preview: string;
  channel: string;
  status: 'open' | 'pending' | 'snoozed' | 'closed';
  handledBy: string;
  handledByAi: boolean;
  updatedAt: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  web: 'Website chat',
  widget: 'Website chat',
  chat: 'Website chat',
  email: 'Email',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  facebook: 'Messenger',
  x: 'X',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  api: 'API',
};

export function channelLabel(channel: string | null | undefined): string {
  if (!channel) return 'Website chat';
  return CHANNEL_LABELS[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1);
}

export async function listRecentConversations(workspaceId: string, limit = 5): Promise<RecentConversation[]> {
  const { conversations } = await listDashboardConversationsAction(workspaceId, 0, limit);
  return conversations.map((c) => {
    const visitor = c.visitor;
    const ai = !c.assigned_agent_id && c.ai_mode === 'autopilot';
    return {
      id: c.id,
      customer: visitor?.name || visitor?.email || 'Visitor',
      preview: (c.last_message?.content || c.summary || '').replace(/\s+/g, ' ').trim(),
      channel: channelLabel(c.channel),
      status: (['open', 'pending', 'snoozed', 'closed'].includes(c.status) ? c.status : 'open') as RecentConversation['status'],
      handledBy: c.agent?.name || (ai ? 'AI assistant' : 'Unassigned'),
      handledByAi: ai,
      updatedAt: c.updated_at,
    };
  });
}

export interface KnowledgeGaps {
  openCount: number;
  topQuestion: { text: string; timesAsked: number } | null;
}

export async function getKnowledgeGaps(workspaceId: string): Promise<KnowledgeGaps> {
  return getKnowledgeGapsSummaryAction(workspaceId);
}

export interface ActivityItem {
  id: string;
  text: string;
  at: string;
  tone: 'ai' | 'ok' | 'bad' | 'accent' | 'warn';
}

/* TODO(backend): no workspace activity feed of support events (handoffs,
   solved tickets, failed workflows, published articles, low ratings).
   `workspace_audit_logs` only records settings changes, for admins.
   Tracked in docs/design/BACKEND_GAPS.md. */
export async function listRecentActivity(workspaceId: string): Promise<ActivityItem[]> {
  void workspaceId;
  return [];
}
