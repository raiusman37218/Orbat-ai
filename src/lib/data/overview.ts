'use client';

import { listDashboardConversationsAction } from '@/app/actions/inbox';
import { listRecentActivityAction, type ActivityFeedItem } from '@/app/actions/overview';
import { getTicketsBootstrapAction } from '@/app/actions/tickets';
import { getKnowledgeGapsSummaryAction } from '@/app/actions/unanswered';
import type {
  AiAgentSummaryRow,
  OverviewActionQueue,
  ReportsDashboardData,
  ReportsSummary,
  WorkspaceAiRoi,
} from '@/lib/reports/metrics';
import type { AgentPresence } from './types';

/* Data for the Overview screen (docs/design/design/Main.dc.html).
   Period numbers come from /api/reports (supporting 'today' hourly buckets in
   workspace timezone plus 7d/30d/90d daily buckets); live numbers come from
   the ticket bootstrap and Postgres activity feed. */

export type OverviewRange = 'today' | '7d' | '30d' | '90d';

export const OVERVIEW_RANGES: { id: OverviewRange; label: string; days: number }[] = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
];

export type { AiAgentSummaryRow, OverviewActionQueue, WorkspaceAiRoi };

export interface VolumePoint {
  date: string;
  label: string;
  created: number;
  solved: number;
  aiResolved: number;
  humanResolved: number;
  stillOpen: number;
}

export interface ChannelShare {
  key: string;
  label: string;
  count: number;
  percentage: number;
  aiResolvedCount: number;
  aiResolutionPct: number | null;
}

export interface OverviewReport {
  summary: ReportsSummary;
  /** The same-length period just before, for the deltas. */
  previous: ReportsSummary | null;
  series: VolumePoint[];
  channels: ChannelShare[];
  aiAgents: AiAgentSummaryRow[];
  roi: WorkspaceAiRoi;
  actionQueue: OverviewActionQueue;
  granularity: 'day' | 'hour';
  timeZone: string;
}

async function fetchReport(
  workspaceId: string,
  range: OverviewRange,
  includePrevious = true,
): Promise<
  ReportsDashboardData & {
    previousSummary?: ReportsSummary | null;
    meta?: { granularity?: 'day' | 'hour'; timezone?: string };
  }
> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    range,
  });
  if (includePrevious) {
    params.set('include_previous', '1');
  }
  const res = await fetch(`/api/reports?${params}`, { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || 'The report could not be loaded.');
  return body as ReportsDashboardData & {
    previousSummary?: ReportsSummary | null;
    meta?: { granularity?: 'day' | 'hour'; timezone?: string };
  };
}

export async function getOverviewReport(workspaceId: string, range: OverviewRange): Promise<OverviewReport> {
  const current = await fetchReport(workspaceId, range, true);
  const granularity = current.granularity ?? current.meta?.granularity ?? (range === 'today' ? 'hour' : 'day');
  const timeZone = current.timeZone ?? current.meta?.timezone ?? 'UTC';

  return {
    summary: current.summary,
    previous: current.previousSummary ?? null,
    series: current.createdVsSolved.map((p) => ({
      date: p.date,
      label: p.label,
      created: p.created,
      solved: p.solved,
      aiResolved: p.aiResolved ?? 0,
      humanResolved: p.humanResolved ?? Math.max(0, p.solved - (p.aiResolved ?? 0)),
      stillOpen: p.stillOpen ?? Math.max(0, p.created - p.solved),
    })),
    channels: current.channelBreakdown.map((c) => ({
      key: c.key,
      label: channelLabel(c.key),
      count: c.count,
      percentage: c.percentage,
      aiResolvedCount: c.aiResolvedCount ?? 0,
      aiResolutionPct: c.aiResolutionPct ?? null,
    })),
    aiAgents: current.aiAgents ?? [],
    roi: current.roi ?? {
      aiResolvedCount: current.summary.botResolvedCount,
      avgHandleMinutes: 10,
      hourlyRateUsd: 28,
      hoursSaved: Number(((current.summary.botResolvedCount * 10) / 60).toFixed(1)),
      costSavedUsd: Math.round(((current.summary.botResolvedCount * 10) / 60) * 28),
    },
    actionQueue: current.actionQueue ?? {
      urgentSlaCount: 0,
      breachedCount: 0,
      breachingSoonCount: 0,
      aiQualityFlagsCount: 0,
      waitingHandoffsCount: 0,
    },
    granularity,
    timeZone,
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

export type ActivityItem = ActivityFeedItem;

export async function listRecentActivity(workspaceId: string): Promise<ActivityItem[]> {
  return listRecentActivityAction(workspaceId, 15);
}

export interface OverviewBootstrap {
  live: OverviewLive;
  recent: RecentConversation[];
  gaps: KnowledgeGaps;
  activity: ActivityItem[];
}

/** Loads live ticket/team stats, recent conversations, knowledge gaps, and recent activity
    in one parallel HTTP GET so Overview never queues 4 sequential Server Actions. */
export async function getOverviewBootstrap(
  workspaceId: string,
  recentLimit = 6,
): Promise<OverviewBootstrap> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    recent_limit: String(recentLimit),
  });
  const res = await fetch(`/api/workspace/overview-bootstrap?${params}`, { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error(body?.error || 'Overview data could not be loaded.');
  }
  return body as OverviewBootstrap;
}
