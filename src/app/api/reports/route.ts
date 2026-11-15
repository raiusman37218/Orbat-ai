import { NextRequest, NextResponse } from 'next/server';
import { guardWorkspace } from '@/lib/team/route-guard';
import { queryRows } from '@/lib/db';
import { calculateReportsDashboard, type SlaEventItem } from '@/lib/reports/metrics';
import type { ReportingEvent } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    const guard = await guardWorkspace(workspaceId, 'view');
    if (!guard.ok) return guard.response;

    const supabase = guard.access.supabase;

    // Filters
    const range = searchParams.get('range') || '30d'; // '7d' | '30d' | '90d' | 'custom'
    const customStart = searchParams.get('start_date');
    const customEnd = searchParams.get('end_date');
    const includePrevious =
      searchParams.get('include_previous') === '1' ||
      searchParams.get('include_previous') === 'true';
    const groupId = searchParams.get('group_id') || undefined;
    const agentId = searchParams.get('agent_id') || undefined;
    const channel = searchParams.get('channel') || undefined;

    // Date range computation
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid custom dates' }, { status: 400 });
      }
    } else {
      let daysBack = 30;
      if (range === '7d') daysBack = 7;
      else if (range === '90d') daysBack = 90;
      startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    const canIncludePrevious = includePrevious && durationMs > 0;
    const prevStartDate = canIncludePrevious ? new Date(startDate.getTime() - durationMs) : null;
    const queryStartIso = (prevStartDate || startDate).toISOString();
    const queryEndIso = endDate.toISOString();
    const priorCutoffIso = queryStartIso;

    // 1. Fetch reporting events in the period (plus preceding window when include_previous=1)
    let eventsQuery = supabase
      .from('reporting_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('occurred_at', queryStartIso)
      .lte('occurred_at', queryEndIso)
      .order('occurred_at', { ascending: true });

    if (groupId) eventsQuery = eventsQuery.eq('group_id', groupId);
    if (agentId) eventsQuery = eventsQuery.eq('agent_id', agentId);
    if (channel) eventsQuery = eventsQuery.eq('channel', channel);

    // 2. Fetch prior event counts before priorCutoffIso (single SQL query when DB pool is available)
    const priorCountsPromise = (async (): Promise<{
      created: number;
      solved: number;
      reopened: number;
    }> => {
      if (!process.env.VITEST || Boolean(process.env.TEST_DATABASE_URL)) {
        try {
          const params: unknown[] = [workspaceId, priorCutoffIso];
          const extraClauses: string[] = [];
          if (groupId) {
            params.push(groupId);
            extraClauses.push(`group_id = $${params.length}`);
          }
          if (agentId) {
            params.push(agentId);
            extraClauses.push(`agent_id = $${params.length}`);
          }
          if (channel) {
            params.push(channel);
            extraClauses.push(`channel = $${params.length}`);
          }
          const extraSql = extraClauses.length > 0 ? ` AND ${extraClauses.join(' AND ')}` : '';
          const rows = await queryRows<{ created: number; solved: number; reopened: number }>(
            `SELECT
               COUNT(*) FILTER (WHERE event_type = 'ticket_created')::int AS created,
               COUNT(*) FILTER (WHERE event_type = 'ticket_solved')::int AS solved,
               COUNT(*) FILTER (WHERE event_type = 'ticket_reopened')::int AS reopened
             FROM public.reporting_events
             WHERE workspace_id = $1 AND occurred_at < $2${extraSql}`,
            params,
          );
          if (rows[0]) {
            return {
              created: Number(rows[0].created ?? 0),
              solved: Number(rows[0].solved ?? 0),
              reopened: Number(rows[0].reopened ?? 0),
            };
          }
        } catch {
          // Fallback to individual Supabase queries below
        }
      }

      let priorCreatedQuery = supabase
        .from('reporting_events')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('event_type', 'ticket_created')
        .lt('occurred_at', priorCutoffIso);

      let priorSolvedQuery = supabase
        .from('reporting_events')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('event_type', 'ticket_solved')
        .lt('occurred_at', priorCutoffIso);

      let priorReopenedQuery = supabase
        .from('reporting_events')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('event_type', 'ticket_reopened')
        .lt('occurred_at', priorCutoffIso);

      if (groupId) {
        priorCreatedQuery = priorCreatedQuery.eq('group_id', groupId);
        priorSolvedQuery = priorSolvedQuery.eq('group_id', groupId);
        priorReopenedQuery = priorReopenedQuery.eq('group_id', groupId);
      }
      if (agentId) {
        priorCreatedQuery = priorCreatedQuery.eq('agent_id', agentId);
        priorSolvedQuery = priorSolvedQuery.eq('agent_id', agentId);
        priorReopenedQuery = priorReopenedQuery.eq('agent_id', agentId);
      }
      if (channel) {
        priorCreatedQuery = priorCreatedQuery.eq('channel', channel);
        priorSolvedQuery = priorSolvedQuery.eq('channel', channel);
        priorReopenedQuery = priorReopenedQuery.eq('channel', channel);
      }

      const [
        { count: priorCreatedCount },
        { count: priorSolvedCount },
        { count: priorReopenedCount },
      ] = await Promise.all([priorCreatedQuery, priorSolvedQuery, priorReopenedQuery]);

      return {
        created: priorCreatedCount || 0,
        solved: priorSolvedCount || 0,
        reopened: priorReopenedCount || 0,
      };
    })();

    // 3. Fetch SLA events in the period
    let slaQuery = supabase
      .from('sla_events')
      .select('id, metric, event, target_minutes, occurred_at, assignee_id, group_id, late')
      .eq('workspace_id', workspaceId)
      .gte('occurred_at', queryStartIso)
      .lte('occurred_at', queryEndIso)
      .order('occurred_at', { ascending: true });

    if (groupId) slaQuery = slaQuery.eq('group_id', groupId);
    if (agentId) slaQuery = slaQuery.eq('assignee_id', agentId);

    // 4. Fetch all report datasets and handoff events concurrently in a single wave
    const handoffPromise = Promise.resolve(
      supabase
        .from('conversation_events')
        .select('type, meta, created_at')
        .eq('workspace_id', workspaceId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', queryEndIso),
    ).catch((handoffErr) => {
      console.warn('[Reports] Failed to query handoff events:', handoffErr);
      return { data: null };
    });

    const [
      { data: eventsData, error: eventsErr },
      priorCounts,
      { data: slaData },
      { data: agentsData },
      { data: groupsData },
      handoffRes,
    ] = await Promise.all([
      eventsQuery,
      priorCountsPromise,
      slaQuery,
      supabase.from('agents').select('id, name, email, role, avatar_url').eq('workspace_id', workspaceId),
      supabase.from('ticket_groups').select('id, name').eq('workspace_id', workspaceId),
      handoffPromise,
    ]);

    if (eventsErr) {
      console.error('[Reports Error] Failed to load reporting events:', eventsErr);
      return NextResponse.json({ error: 'Could not load report metrics' }, { status: 500 });
    }

    const allEvents = (eventsData || []) as ReportingEvent[];
    const allSlaEvents = (slaData || []) as SlaEventItem[];
    const agents = (agentsData || []) as Array<{ id: string; name: string; email: string; role: string; avatar_url?: string | null }>;
    const groups = (groupsData || []) as Array<{ id: string; name: string }>;

    let dashboardData: ReturnType<typeof calculateReportsDashboard>;
    let previousSummary: ReturnType<typeof calculateReportsDashboard>['summary'] | undefined;

    if (canIncludePrevious && prevStartDate) {
      const startMs = startDate.getTime();
      const prevEvents: ReportingEvent[] = [];
      const currentEvents: ReportingEvent[] = [];
      let prevCreated = 0;
      let prevSolved = 0;
      let prevReopened = 0;

      for (const ev of allEvents) {
        if (new Date(ev.occurred_at).getTime() < startMs) {
          prevEvents.push(ev);
          if (ev.event_type === 'ticket_created') prevCreated++;
          else if (ev.event_type === 'ticket_solved') prevSolved++;
          else if (ev.event_type === 'ticket_reopened') prevReopened++;
        } else {
          currentEvents.push(ev);
        }
      }

      const prevSlaEvents: SlaEventItem[] = [];
      const currentSlaEvents: SlaEventItem[] = [];
      for (const s of allSlaEvents) {
        if (new Date(s.occurred_at).getTime() < startMs) {
          prevSlaEvents.push(s);
        } else {
          currentSlaEvents.push(s);
        }
      }

      const prevInitialBacklog = Math.max(0, priorCounts.created - priorCounts.solved + priorCounts.reopened);
      const currentInitialBacklog = Math.max(
        0,
        priorCounts.created + prevCreated - (priorCounts.solved + prevSolved) + (priorCounts.reopened + prevReopened),
      );

      previousSummary = calculateReportsDashboard(
        prevEvents,
        prevSlaEvents,
        agents,
        prevInitialBacklog,
        prevStartDate,
        startDate,
        { groupId, agentId, channel },
      ).summary;

      dashboardData = calculateReportsDashboard(
        currentEvents,
        currentSlaEvents,
        agents,
        currentInitialBacklog,
        startDate,
        endDate,
        { groupId, agentId, channel },
      );
    } else {
      const initialBacklog = Math.max(0, priorCounts.created - priorCounts.solved + priorCounts.reopened);
      dashboardData = calculateReportsDashboard(
        allEvents,
        allSlaEvents,
        agents,
        initialBacklog,
        startDate,
        endDate,
        { groupId, agentId, channel },
      );
    }

    // Compute handoff metrics from conversation_events
    let handoffOffered = 0;
    let handoffRequested = 0;
    let handoffClaimed = 0;
    let handoffOffline = 0;
    let totalWaitSeconds = 0;
    let waitSamples = 0;
    const reasonsMap: Record<string, number> = {};

    for (const ev of (handoffRes?.data || []) as Array<{ type: string; meta: any; created_at: string }>) {
      if (ev.type === 'offer_handoff') handoffOffered++;
      if (ev.type === 'request_handoff') {
        handoffRequested++;
        const reason = ev.meta?.reason || 'Customer request';
        reasonsMap[reason] = (reasonsMap[reason] || 0) + 1;
      }
      if (ev.type === 'offline_queue') handoffOffline++;
      if (ev.type === 'agent_claim') {
        handoffClaimed++;
        const wait = Number(ev.meta?.wait_time_seconds || ev.meta?.wait_seconds);
        if (Number.isFinite(wait) && wait >= 0) {
          totalWaitSeconds += wait;
          waitSamples++;
        }
      }
    }

    dashboardData.handoff = {
      offered: handoffOffered,
      requested: handoffRequested,
      claimed: handoffClaimed,
      offline_queued: handoffOffline,
      acceptance_rate_percent: handoffOffered > 0 ? Math.round((handoffRequested / handoffOffered) * 100) : 0,
      avg_wait_seconds: waitSamples > 0 ? Math.round(totalWaitSeconds / waitSamples) : 0,
      reasons: Object.entries(reasonsMap).map(([reason, count]) => ({ reason, count })),
    };

    return NextResponse.json({
      ...dashboardData,
      ...(previousSummary ? { previousSummary } : {}),
      meta: {
        workspace_id: workspaceId,
        range,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        groups,
        agents: agents.map((a) => ({ id: a.id, name: a.name || a.email, role: a.role })),
      },
    });
  } catch (err: unknown) {
    console.error('[Reports Route Error]:', err);
    return NextResponse.json({ error: 'An unexpected error occurred while calculating reports' }, { status: 500 });
  }
}
