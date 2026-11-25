import { NextRequest, NextResponse } from 'next/server';
import { guardWorkspace } from '@/lib/team/route-guard';
import { queryRows } from '@/lib/db';
import {
  calculateReportsDashboard,
  calculateWorkspaceRoi,
  generateHourBuckets,
  normalizeTimeZone,
  type AiAgentSummaryRow,
  type OverviewActionQueue,
  type SlaEventItem,
} from '@/lib/reports/metrics';
import type { ReportingEvent } from '@/types/database';

export const dynamic = 'force-dynamic';

type SupabaseClient = Awaited<ReturnType<typeof guardWorkspace>> & { ok: true } extends infer T
  ? T extends { access: { supabase: infer S } }
    ? S
    : never
  : never;

function shouldUseDirectPg(): boolean {
  return !process.env.VITEST || Boolean(process.env.TEST_DATABASE_URL);
}

function positiveNum(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function loadWorkspaceConfig(
  workspaceId: string,
  supabase: SupabaseClient,
): Promise<{ timeZone: string; avgHandleMinutes?: number; hourlyRateUsd?: number }> {
  let row: {
    timezone?: string | null;
    ai_settings?: Record<string, unknown> | null;
    company_profile?: Record<string, unknown> | null;
  } | null = null;

  if (shouldUseDirectPg()) {
    try {
      const rows = await queryRows<{
        timezone: string | null;
        ai_settings: Record<string, unknown> | null;
        company_profile: Record<string, unknown> | null;
      }>(
        `SELECT timezone, ai_settings, company_profile
         FROM public.workspaces
         WHERE id = $1
         LIMIT 1`,
        [workspaceId],
      );
      if (rows[0]) row = rows[0];
    } catch {
      row = null;
    }
  }

  if (!row) {
    try {
      const { data } = await supabase
        .from('workspaces')
        .select('timezone, ai_settings, company_profile')
        .eq('id', workspaceId)
        .maybeSingle();
      if (data && typeof data === 'object') {
        row = data as typeof row;
      }
    } catch {
      row = null;
    }
  }

  const aiSettings = row?.ai_settings && typeof row.ai_settings === 'object' ? row.ai_settings : null;
  const companyProfile =
    row?.company_profile && typeof row.company_profile === 'object' ? row.company_profile : null;

  return {
    timeZone: normalizeTimeZone(row?.timezone),
    avgHandleMinutes: positiveNum(aiSettings?.avg_handle_minutes ?? companyProfile?.avg_handle_minutes),
    hourlyRateUsd: positiveNum(
      aiSettings?.agent_hourly_rate_usd ?? companyProfile?.agent_hourly_rate_usd,
    ),
  };
}

async function loadAiAgentsSummary(
  workspaceId: string,
  supabase: SupabaseClient,
  startDate: Date,
  endDate: Date,
  channel?: string,
): Promise<AiAgentSummaryRow[]> {
  let agentRows: Array<{
    id: string;
    name: string;
    role_title: string | null;
    status: string | null;
    is_primary: boolean | null;
    channels: string[] | null;
    updated_at?: string | null;
  }> = [];

  if (shouldUseDirectPg()) {
    try {
      agentRows = await queryRows(
        `SELECT id, name, role_title, status, is_primary, channels, updated_at
         FROM public.ai_agents
         WHERE workspace_id = $1
         ORDER BY is_primary DESC, (status = 'live') DESC, updated_at DESC`,
        [workspaceId],
      );
    } catch {
      agentRows = [];
    }
  } else {
    try {
      const { data } = await supabase
        .from('ai_agents')
        .select('id, name, role_title, status, is_primary, channels, updated_at')
        .eq('workspace_id', workspaceId)
        .order('is_primary', { ascending: false });
      agentRows = Array.isArray(data) ? (data as typeof agentRows) : [];
    } catch {
      agentRows = [];
    }
  }

  if (agentRows.length === 0) return [];

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();
  const primaryId = agentRows.find((a) => a.is_primary)?.id ?? agentRows[0].id;

  const statsMap = new Map<
    string,
    {
      total: number;
      supported: number;
      flagged: number;
      escalated: number;
      confSum: number;
      confCount: number;
    }
  >();

  for (const a of agentRows) {
    statsMap.set(a.id, { total: 0, supported: 0, flagged: 0, escalated: 0, confSum: 0, confCount: 0 });
  }

  let logRows: Array<{
    agent_id: string | null;
    verdict: string | null;
    human_review: string | null;
    confidence: number | string | null;
  }> = [];

  if (shouldUseDirectPg()) {
    try {
      const params: unknown[] = [workspaceId, startIso, endIso];
      const channelClause = channel ? ` AND channel = $${params.push(channel)}` : '';
      logRows = await queryRows(
        `SELECT agent_id, verdict, human_review, confidence
         FROM public.ai_verification_logs
         WHERE workspace_id = $1
           AND created_at >= $2
           AND created_at <= $3${channelClause}`,
        params,
      );
    } catch {
      logRows = [];
    }
  } else {
    try {
      let q = supabase
        .from('ai_verification_logs')
        .select('agent_id, verdict, human_review, confidence')
        .eq('workspace_id', workspaceId)
        .gte('created_at', startIso)
        .lte('created_at', endIso);
      if (channel) q = q.eq('channel', channel);
      const { data } = await q;
      logRows = Array.isArray(data) ? (data as typeof logRows) : [];
    } catch {
      logRows = [];
    }
  }

  for (const log of logRows) {
    const targetId = log.agent_id && statsMap.has(log.agent_id) ? log.agent_id : primaryId;
    const entry = statsMap.get(targetId);
    if (!entry) continue;

    entry.total += 1;
    if (log.verdict === 'supported' || log.human_review === 'correct') {
      entry.supported += 1;
    }
    if (
      log.verdict === 'needs_review' ||
      log.verdict === 'blocked_fixed' ||
      log.human_review === 'wrong'
    ) {
      entry.flagged += 1;
    }
    if (log.verdict === 'blocked_human') {
      entry.escalated += 1;
    }
    if (log.confidence !== null && log.confidence !== undefined) {
      const num = Number(log.confidence);
      if (Number.isFinite(num) && num >= 0) {
        entry.confSum += num > 1 ? num : num * 100;
        entry.confCount += 1;
      }
    }
  }

  return agentRows
    .map((a) => {
      const st = statsMap.get(a.id)!;
      const groundingPct = st.total > 0 ? Math.round((st.supported / st.total) * 100) : null;
      const avgConfidencePct = st.confCount > 0 ? Math.round(st.confSum / st.confCount) : null;
      return {
        id: a.id,
        name: a.name || 'AI Assistant',
        roleTitle: a.role_title || null,
        status: a.status || 'draft',
        isPrimary: Boolean(a.is_primary),
        channels: Array.isArray(a.channels) ? a.channels.filter((c): c is string => typeof c === 'string') : [],
        totalReplies: st.total,
        supportedCount: st.supported,
        flaggedCount: st.flagged,
        escalatedCount: st.escalated,
        groundingPct,
        avgConfidencePct,
      };
    })
    .sort(
      (a, b) =>
        Number(b.isPrimary) - Number(a.isPrimary) ||
        Number(b.status === 'live') - Number(a.status === 'live') ||
        b.totalReplies - a.totalReplies,
    );
}

async function loadActionQueue(
  workspaceId: string,
  supabase: SupabaseClient,
): Promise<OverviewActionQueue> {
  if (shouldUseDirectPg()) {
    try {
      const [slaRows, handoffRows, flagRows] = await Promise.all([
        queryRows<{ breached: number; breaching_soon: number }>(
          `SELECT
             COUNT(*) FILTER (WHERE sla_breached_at IS NOT NULL)::int AS breached,
             COUNT(*) FILTER (
               WHERE sla_breached_at IS NULL
                 AND sla_state = 'running'
                 AND sla_next_warn_at IS NOT NULL
                 AND sla_next_warn_at <= now()
             )::int AS breaching_soon
           FROM public.tickets
           WHERE workspace_id = $1
             AND status IN ('new', 'open', 'pending', 'on_hold')`,
          [workspaceId],
        ),
        queryRows<{ cnt: number }>(
          `SELECT COUNT(*)::int AS cnt
           FROM public.conversations
           WHERE workspace_id = $1
             AND status = 'open'
             AND handoff_status IN ('waiting_for_agent', 'offline_queued', 'handoff_offered')`,
          [workspaceId],
        ),
        queryRows<{ cnt: number }>(
          `SELECT COUNT(*)::int AS cnt
           FROM public.ai_verification_logs
           WHERE workspace_id = $1
             AND ((verdict IN ('needs_review', 'blocked_fixed') AND human_review IS NULL) OR human_review = 'wrong')`,
          [workspaceId],
        ),
      ]);

      const breachedCount = Number(slaRows[0]?.breached ?? 0);
      const breachingSoonCount = Number(slaRows[0]?.breaching_soon ?? 0);
      return {
        urgentSlaCount: breachedCount + breachingSoonCount,
        breachedCount,
        breachingSoonCount,
        aiQualityFlagsCount: Number(flagRows[0]?.cnt ?? 0),
        waitingHandoffsCount: Number(handoffRows[0]?.cnt ?? 0),
      };
    } catch {
      // Fallback below
    }
  }

  try {
    const nowIso = new Date().toISOString();
    const [ticketsRes, handoffRes, flagsRes] = await Promise.all([
      supabase
        .from('tickets')
        .select('sla_breached_at, sla_state, sla_next_warn_at')
        .eq('workspace_id', workspaceId)
        .in('status', ['new', 'open', 'pending', 'on_hold']),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'open')
        .in('handoff_status', ['waiting_for_agent', 'offline_queued', 'handoff_offered']),
      supabase
        .from('ai_verification_logs')
        .select('id, verdict, human_review')
        .eq('workspace_id', workspaceId),
    ]);

    const tRows = (ticketsRes.data || []) as Array<{
      sla_breached_at?: string | null;
      sla_state?: string | null;
      sla_next_warn_at?: string | null;
    }>;
    let breachedCount = 0;
    let breachingSoonCount = 0;
    for (const t of tRows) {
      if (t.sla_breached_at) breachedCount += 1;
      else if (t.sla_state === 'running' && t.sla_next_warn_at && t.sla_next_warn_at <= nowIso) {
        breachingSoonCount += 1;
      }
    }

    const fRows = (flagsRes.data || []) as Array<{
      verdict?: string | null;
      human_review?: string | null;
    }>;
    const aiQualityFlagsCount = fRows.filter(
      (f) =>
        ((f.verdict === 'needs_review' || f.verdict === 'blocked_fixed') && !f.human_review) ||
        f.human_review === 'wrong',
    ).length;

    return {
      urgentSlaCount: breachedCount + breachingSoonCount,
      breachedCount,
      breachingSoonCount,
      aiQualityFlagsCount,
      waitingHandoffsCount: handoffRes.count ?? 0,
    };
  } catch {
    return {
      urgentSlaCount: 0,
      breachedCount: 0,
      breachingSoonCount: 0,
      aiQualityFlagsCount: 0,
      waitingHandoffsCount: 0,
    };
  }
}

async function reconcileAiClosedConversations(
  workspaceId: string,
  supabase: SupabaseClient,
  startIso: string,
  endIso: string,
  existingEvents: ReportingEvent[],
  channel?: string,
  agentId?: string,
): Promise<ReportingEvent[]> {
  if (agentId) return existingEvents;

  let closedConvs: Array<{
    id: string;
    current_ticket_id: string | null;
    channel: string | null;
    priority: string | null;
    tags: string[] | null;
    closed_at: string | null;
    created_at: string;
  }> = [];

  if (shouldUseDirectPg()) {
    try {
      const params: unknown[] = [workspaceId, startIso, endIso];
      const channelClause = channel ? ` AND c.channel = $${params.push(channel)}` : '';
      closedConvs = await queryRows(
        `SELECT c.id, c.current_ticket_id, c.channel, c.priority, c.tags, c.closed_at, c.created_at
         FROM public.conversations c
         WHERE c.workspace_id = $1
           AND c.status = 'closed'
           AND c.assigned_agent_id IS NULL
           AND c.closed_at IS NOT NULL
           AND c.closed_at >= $2
           AND c.closed_at <= $3${channelClause}
           AND EXISTS (
             SELECT 1 FROM public.messages m
             WHERE m.conversation_id = c.id AND m.sender_type = 'ai'
           )`,
        params,
      );
    } catch {
      closedConvs = [];
    }
  } else {
    try {
      let q = supabase
        .from('conversations')
        .select('id, current_ticket_id, channel, priority, tags, closed_at, created_at')
        .eq('workspace_id', workspaceId)
        .eq('status', 'closed')
        .is('assigned_agent_id', null)
        .gte('closed_at', startIso)
        .lte('closed_at', endIso);
      if (channel) q = q.eq('channel', channel);
      const { data } = await q;
      closedConvs = Array.isArray(data) ? (data as typeof closedConvs) : [];
    } catch {
      closedConvs = [];
    }
  }

  if (closedConvs.length === 0) return existingEvents;

  const createdTicketIds = new Set<string>();
  const solvedTicketIds = new Set<string>();
  const botResolvedTicketIds = new Set<string>();
  const ticketChannelById = new Map<string, string>();
  for (const e of existingEvents) {
    if (!e.ticket_id) continue;
    if (e.channel && !ticketChannelById.has(e.ticket_id)) {
      ticketChannelById.set(e.ticket_id, e.channel);
    }
    if (e.event_type === 'ticket_created') createdTicketIds.add(e.ticket_id);
    if (e.event_type === 'ticket_solved') solvedTicketIds.add(e.ticket_id);
    if (e.event_type === 'bot_resolved') botResolvedTicketIds.add(e.ticket_id);
  }

  const additions: ReportingEvent[] = [];
  let syntheticId = -1;

  for (const c of closedConvs) {
    const keyId = c.current_ticket_id || c.id;
    const ch = ticketChannelById.get(keyId) || c.channel || 'web';
    const tags = Array.isArray(c.tags) ? c.tags : [];
    const closedAt = c.closed_at || c.created_at;

    if (!c.current_ticket_id && !createdTicketIds.has(keyId) && c.created_at >= startIso && c.created_at <= endIso) {
      createdTicketIds.add(keyId);
      additions.push({
        id: syntheticId--,
        workspace_id: workspaceId,
        ticket_id: keyId,
        event_type: 'ticket_created',
        occurred_at: c.created_at,
        agent_id: null,
        group_id: null,
        channel: ch,
        priority: c.priority || 'normal',
        tags,
        duration_seconds: null,
        csat_rating: null,
        csat_comment: null,
        metadata: {},
      });
    }

    if (!solvedTicketIds.has(keyId)) {
      solvedTicketIds.add(keyId);
      additions.push({
        id: syntheticId--,
        workspace_id: workspaceId,
        ticket_id: keyId,
        event_type: 'ticket_solved',
        occurred_at: closedAt,
        agent_id: null,
        group_id: null,
        channel: ch,
        priority: c.priority || 'normal',
        tags,
        duration_seconds: null,
        csat_rating: null,
        csat_comment: null,
        metadata: {},
      });
    }

    if (!botResolvedTicketIds.has(keyId)) {
      botResolvedTicketIds.add(keyId);
      additions.push({
        id: syntheticId--,
        workspace_id: workspaceId,
        ticket_id: keyId,
        event_type: 'bot_resolved',
        occurred_at: closedAt,
        agent_id: null,
        group_id: null,
        channel: ch,
        priority: c.priority || 'normal',
        tags,
        duration_seconds: null,
        csat_rating: null,
        csat_comment: null,
        metadata: {},
      });
    }
  }

  return additions.length > 0 ? [...existingEvents, ...additions] : existingEvents;
}

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
    const wsConfig = await loadWorkspaceConfig(workspaceId, supabase);
    const timeZone = wsConfig.timeZone;

    // Filters
    const range = searchParams.get('range') || '30d'; // 'today' | '7d' | '30d' | '90d' | 'custom'
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
    let granularity: 'day' | 'hour' = 'day';

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid custom dates' }, { status: 400 });
      }
      if (range === 'today') {
        granularity = 'hour';
      }
    } else if (range === 'today') {
      granularity = 'hour';
      const hourBuckets = generateHourBuckets(now, timeZone, 24);
      startDate = hourBuckets[0].start;
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
      if (shouldUseDirectPg()) {
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

    // 4. Fetch all report datasets, handoff events, live AI agent stats & action queue concurrently
    const handoffPromise = (async () => {
      try {
        return await supabase
          .from('conversation_events')
          .select('type, meta, created_at')
          .eq('workspace_id', workspaceId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', queryEndIso);
      } catch (handoffErr) {
        console.warn('[Reports] Failed to query handoff events:', handoffErr);
        return { data: null };
      }
    })();

    const [
      { data: eventsData, error: eventsErr },
      priorCounts,
      { data: slaData },
      { data: agentsData },
      { data: groupsData },
      handoffRes,
      aiAgentsSummary,
      actionQueue,
    ] = await Promise.all([
      eventsQuery,
      priorCountsPromise,
      slaQuery,
      supabase.from('agents').select('id, name, email, role, avatar_url').eq('workspace_id', workspaceId),
      supabase.from('ticket_groups').select('id, name').eq('workspace_id', workspaceId),
      handoffPromise,
      loadAiAgentsSummary(workspaceId, supabase, startDate, endDate, channel),
      loadActionQueue(workspaceId, supabase),
    ]);

    if (eventsErr) {
      console.error('[Reports Error] Failed to load reporting events:', eventsErr);
      return NextResponse.json({ error: 'Could not load report metrics' }, { status: 500 });
    }

    const baseEvents = (eventsData || []) as ReportingEvent[];
    const allEvents = await reconcileAiClosedConversations(
      workspaceId,
      supabase,
      queryStartIso,
      queryEndIso,
      baseEvents,
      channel,
      agentId,
    );
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
        { groupId, agentId, channel, granularity, timeZone },
      ).summary;

      dashboardData = calculateReportsDashboard(
        currentEvents,
        currentSlaEvents,
        agents,
        currentInitialBacklog,
        startDate,
        endDate,
        { groupId, agentId, channel, granularity, timeZone },
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
        { groupId, agentId, channel, granularity, timeZone },
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

    for (const ev of (handoffRes?.data || []) as Array<{
      type: string;
      meta: Record<string, unknown> | null;
      created_at: string;
    }>) {
      if (ev.type === 'offer_handoff') handoffOffered++;
      if (ev.type === 'request_handoff') {
        handoffRequested++;
        const rawReason = ev.meta?.reason;
        const reason = typeof rawReason === 'string' && rawReason ? rawReason : 'Customer request';
        reasonsMap[reason] = (reasonsMap[reason] || 0) + 1;
      }
      if (ev.type === 'offline_queue') handoffOffline++;
      if (ev.type === 'agent_claim') {
        handoffClaimed++;
        const wait = Number(ev.meta?.wait_time_seconds ?? ev.meta?.wait_seconds);
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

    const aiResolvedSum = Math.max(
      dashboardData.summary.botResolvedCount,
      dashboardData.createdVsSolved.reduce((acc, p) => acc + p.aiResolved, 0),
    );
    dashboardData.aiAgents = aiAgentsSummary;
    dashboardData.roi = calculateWorkspaceRoi(aiResolvedSum, {
      avgHandleMinutes: wsConfig.avgHandleMinutes,
      hourlyRateUsd: wsConfig.hourlyRateUsd,
    });
    dashboardData.actionQueue = actionQueue;

    return NextResponse.json({
      ...dashboardData,
      ...(previousSummary ? { previousSummary } : {}),
      meta: {
        workspace_id: workspaceId,
        range,
        granularity,
        timezone: timeZone,
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
