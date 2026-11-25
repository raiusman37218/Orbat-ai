import { NextRequest, NextResponse } from 'next/server';
import { listRecentActivityAction } from '@/app/actions/overview';
import { queryRows } from '@/lib/db';
import { AccessError, getWorkspaceAccess } from '@/lib/team/access';
import type { AgentPresence } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

const STATUS_ORDER: Record<AgentPresence, number> = { online: 0, away: 1, offline: 2 };

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

function formatChannelLabel(channel: string | null | undefined): string {
  if (!channel) return 'Website chat';
  return CHANNEL_LABELS[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1);
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace_id')?.trim() || '';
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id is required.' }, { status: 400 });
  }

  const rawLimit = Number(req.nextUrl.searchParams.get('recent_limit') || '6');
  const recentLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(20, Math.floor(rawLimit))) : 6;

  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'view');

    const [ticketCountsRows, teamRows, recentRows, gapsRows, activity] = await Promise.all([
      queryRows<{ all_open: number; unassigned: number; my_open: number }>(
        `SELECT
          COUNT(*) FILTER (WHERE status IN ('new', 'open', 'pending', 'on_hold'))::int AS all_open,
          COUNT(*) FILTER (WHERE assignee_id IS NULL AND status IN ('new', 'open', 'pending', 'on_hold'))::int AS unassigned,
          COUNT(*) FILTER (WHERE assignee_id = $2 AND status IN ('new', 'open'))::int AS my_open
         FROM public.tickets
         WHERE workspace_id = $1`,
        [workspaceId, agent.id],
      ).catch(() => []),

      queryRows<{
        id: string;
        name: string | null;
        avatar_url: string | null;
        status: string | null;
        role: string | null;
        max_open_tickets: number | null;
        open_tickets: number;
      }>(
        `SELECT
          a.id::text AS id,
          a.name,
          a.avatar_url,
          a.status,
          a.role,
          a.max_open_tickets,
          COALESCE(t.open_tickets, 0)::int AS open_tickets
         FROM public.agents a
         LEFT JOIN (
           SELECT assignee_id, COUNT(*)::int AS open_tickets
           FROM public.tickets
           WHERE workspace_id = $1
             AND status IN ('new', 'open')
             AND assignee_id IS NOT NULL
           GROUP BY assignee_id
         ) t ON t.assignee_id = a.id
         WHERE a.workspace_id = $1
           AND COALESCE(a.is_active, true) = true
           AND COALESCE(a.role, 'agent') <> 'light_agent'
         ORDER BY a.name ASC`,
        [workspaceId],
      ).catch(() => []),

      queryRows<{
        id: string;
        channel: string | null;
        status: string | null;
        assigned_agent_id: string | null;
        ai_mode: string | null;
        summary: string | null;
        updated_at: string;
        visitor_name: string | null;
        visitor_email: string | null;
        agent_name: string | null;
        last_message_content: string | null;
      }>(
        `SELECT
          c.id::text AS id,
          c.channel,
          c.status,
          c.assigned_agent_id::text AS assigned_agent_id,
          c.ai_mode,
          c.summary,
          c.updated_at,
          v.name AS visitor_name,
          v.email AS visitor_email,
          a.name AS agent_name,
          lm.content AS last_message_content
         FROM public.conversations c
         LEFT JOIN public.visitors v ON v.id = c.visitor_id
         LEFT JOIN public.agents a ON a.id = c.assigned_agent_id
         LEFT JOIN LATERAL (
           SELECT m.content
           FROM public.messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC
           LIMIT 1
         ) lm ON true
         WHERE c.workspace_id = $1
         ORDER BY c.updated_at DESC
         LIMIT $2`,
        [workspaceId, recentLimit],
      ).catch(() => []),

      queryRows<{
        open_count: number;
        top_question: string | null;
        top_times_asked: number | null;
      }>(
        `SELECT
          (SELECT COUNT(*)::int FROM public.unanswered_questions WHERE workspace_id = $1 AND status IN ('open', 'pending_approval')) AS open_count,
          top_q.question AS top_question,
          top_q.times_asked AS top_times_asked
         FROM (SELECT 1) AS _one
         LEFT JOIN LATERAL (
           SELECT question, times_asked
           FROM public.unanswered_questions
           WHERE workspace_id = $1 AND status = 'open'
           ORDER BY times_asked DESC, last_asked_at DESC
           LIMIT 1
         ) top_q ON true`,
        [workspaceId],
      ).catch(() => []),

      listRecentActivityAction(workspaceId, 15).catch(() => []),
    ]);

    const countsRow = ticketCountsRows[0];
    const team = teamRows
      .map((a) => ({
        id: a.id,
        name: a.name || 'Teammate',
        avatarUrl: a.avatar_url ?? null,
        status: (a.status === 'online' || a.status === 'away' ? a.status : 'offline') as AgentPresence,
        role: a.role || 'agent',
        openTickets: Number(a.open_tickets ?? 0),
        capacity: a.max_open_tickets ?? null,
      }))
      .sort((x, y) => STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || y.openTickets - x.openTickets);

    const live = {
      openCount: Number(countsRow?.all_open ?? 0),
      unassignedCount: Number(countsRow?.unassigned ?? 0),
      myOpenCount: Number(countsRow?.my_open ?? 0),
      team,
    };

    const recent = recentRows.map((c) => {
      const ai = !c.assigned_agent_id && c.ai_mode === 'autopilot';
      const status = (['open', 'pending', 'snoozed', 'closed'].includes(c.status || '')
        ? c.status
        : 'open') as 'open' | 'pending' | 'snoozed' | 'closed';
      return {
        id: c.id,
        customer: c.visitor_name || c.visitor_email || 'Visitor',
        preview: (c.last_message_content || c.summary || '').replace(/\s+/g, ' ').trim(),
        channel: formatChannelLabel(c.channel),
        status,
        handledBy: c.agent_name || (ai ? 'AI assistant' : 'Unassigned'),
        handledByAi: ai,
        updatedAt: new Date(c.updated_at).toISOString(),
      };
    });

    const gapRow = gapsRows[0];
    const gaps = {
      openCount: Number(gapRow?.open_count ?? 0),
      topQuestion: gapRow?.top_question
        ? { text: gapRow.top_question, timesAsked: Number(gapRow.top_times_asked ?? 1) }
        : null,
    };

    return NextResponse.json(
      { live, recent, gaps, activity },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    if (err instanceof AccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[GET /api/workspace/overview-bootstrap]:', err);
    return NextResponse.json({ error: 'Failed to load workspace overview.' }, { status: 500 });
  }
}
