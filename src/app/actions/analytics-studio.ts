'use server';

import { query, queryRows } from '@/lib/db';
import { userError, errorMessage } from '@/lib/errors/user-error';
import { getWorkspaceAccess } from '@/lib/team/access';
import { roleCan } from '@/lib/team/permissions';

export type AnalyticsSection = 'conv' | 'ai' | 'agents' | 'calls' | 'csat' | 'biz';
export type AnalyticsRangeDays = 7 | 30 | 90;

export interface AnalyticsKpi {
  label: string;
  value: string;
  deltaPct: number | null;
  deltaUnit?: '%' | 'pts';
  foot: string;
  tone?: 'ai' | 'ok' | 'warn' | 'bad';
}

export interface AnalyticsSeriesPoint {
  date: string;
  label: string;
  value: number;
  secondaryValue: number;
  previousValue: number;
}

export interface HeatmapCell {
  dow: number; // 0=Sun..6=Sat (mapped to Mon..Sun in UI)
  hour: number; // 8..19
  count: number;
}

export interface AnalyticsBreakdownRow {
  key: string;
  label: string;
  meta?: string;
  count: number;
  secondaryLabel: string;
  ratioPct: number;
}

export interface CustomReportRecord {
  id: string;
  name: string;
  description: string;
  section: AnalyticsSection;
  rangeDays: AnalyticsRangeDays;
  comparePrevious: boolean;
  createdAt: string;
}

export interface AnalyticsStudioBundle {
  canEdit: boolean;
  section: AnalyticsSection;
  rangeDays: AnalyticsRangeDays;
  comparePrevious: boolean;
  seriesTitle: string;
  primarySeriesLabel: string;
  secondarySeriesLabel: string;
  kpis: AnalyticsKpi[];
  series: AnalyticsSeriesPoint[];
  heatmap: HeatmapCell[];
  breakdownTitle: string;
  breakdownPrimaryCol: string;
  breakdownSecondaryCol: string;
  breakdown: AnalyticsBreakdownRow[];
  customReports: CustomReportRecord[];
}

function pctDiff(curr: number, prev: number): number | null {
  if (prev <= 0 && curr <= 0) return null;
  if (prev <= 0) return 100;
  return Math.round(((curr - prev) / prev) * 100);
}

function ptsDiff(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null) return null;
  return Math.round((curr - prev) * 10) / 10;
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildDateAxis(days: number): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    out.push({ iso, label });
  }
  return out;
}

async function loadPeakHoursHeatmap(
  workspaceId: string,
  table: 'conversations' | 'voice_calls' | 'customer_orders' | 'survey_responses',
  rangeDays: number,
): Promise<HeatmapCell[]> {
  const timeCol =
    table === 'voice_calls'
      ? 'COALESCE(started_at, created_at)'
      : table === 'customer_orders'
        ? 'COALESCE(ordered_at, created_at)'
        : 'created_at';
  const rows = await queryRows<{ dow: number; hr: number; cnt: string }>(
    `SELECT EXTRACT(DOW FROM ${timeCol})::int AS dow,
            EXTRACT(HOUR FROM ${timeCol})::int AS hr,
            COUNT(*)::text AS cnt
     FROM public.${table}
     WHERE workspace_id = $1
       AND ${timeCol} >= now() - ($2::text || ' days')::interval
       AND EXTRACT(HOUR FROM ${timeCol})::int BETWEEN 8 AND 19
     GROUP BY 1, 2`,
    [workspaceId, String(rangeDays)],
  ).catch(() => []);

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(`${r.dow}-${r.hr}`, Number(r.cnt ?? 0));
  }

  const cells: HeatmapCell[] = [];
  for (const dow of [1, 2, 3, 4, 5, 6, 0]) {
    for (let hour = 8; hour <= 19; hour++) {
      cells.push({ dow, hour, count: map.get(`${dow}-${hour}`) ?? 0 });
    }
  }
  return cells;
}

export async function getAnalyticsStudioAction(
  workspaceId: string,
  section: AnalyticsSection = 'conv',
  rangeDays: AnalyticsRangeDays = 30,
  comparePrevious = true,
): Promise<AnalyticsStudioBundle> {
  try {
    const { role } = await getWorkspaceAccess(workspaceId, 'view');
    const canEdit = roleCan(role, 'edit_content');
    const days: AnalyticsRangeDays = rangeDays === 7 || rangeDays === 90 ? rangeDays : 30;
    const axis = buildDateAxis(days);

    const customReportRows = await queryRows<Record<string, unknown>>(
      `SELECT id, name, description, section, range_days, compare_previous, created_at
       FROM public.analytics_custom_reports
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId],
    ).catch(() => []);

    const customReports: CustomReportRecord[] = customReportRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: String(r.description || ''),
      section: (String(r.section || 'conv') as AnalyticsSection),
      rangeDays: (Number(r.range_days) === 7 || Number(r.range_days) === 90
        ? Number(r.range_days)
        : 30) as AnalyticsRangeDays,
      comparePrevious: Boolean(r.compare_previous),
      createdAt: String(r.created_at || new Date().toISOString()),
    }));

    const heatmapTable =
      section === 'calls'
        ? 'voice_calls'
        : section === 'biz'
          ? 'customer_orders'
          : section === 'csat'
            ? 'survey_responses'
            : 'conversations';

    const heatmap = await loadPeakHoursHeatmap(workspaceId, heatmapTable, days);

    if (section === 'conv' || section === 'ai') {
      const [currAgg, prevAgg, dailyCurr, dailyPrev, channelRows, gapRows] = await Promise.all([
        queryRows<Record<string, string | null>>(
          `SELECT
             COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE status = 'closed' AND assigned_agent_id IS NULL)::text AS ai_resolved,
             AVG(EXTRACT(EPOCH FROM (first_agent_reply_at - created_at)))
               FILTER (WHERE first_agent_reply_at IS NOT NULL AND first_agent_reply_at >= created_at)::text AS avg_frt_sec,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (closed_at - created_at)))
               FILTER (WHERE closed_at IS NOT NULL AND closed_at >= created_at)::text AS med_res_sec
           FROM public.conversations
           WHERE workspace_id = $1 AND created_at >= now() - ($2::text || ' days')::interval`,
          [workspaceId, String(days)],
        ),
        comparePrevious
          ? queryRows<Record<string, string | null>>(
              `SELECT
                 COUNT(*)::text AS total,
                 COUNT(*) FILTER (WHERE status = 'closed' AND assigned_agent_id IS NULL)::text AS ai_resolved,
                 AVG(EXTRACT(EPOCH FROM (first_agent_reply_at - created_at)))
                   FILTER (WHERE first_agent_reply_at IS NOT NULL AND first_agent_reply_at >= created_at)::text AS avg_frt_sec
               FROM public.conversations
               WHERE workspace_id = $1
                 AND created_at >= now() - ($2::text || ' days')::interval
                 AND created_at < now() - ($3::text || ' days')::interval`,
              [workspaceId, String(days * 2), String(days)],
            )
          : Promise.resolve([]),
        queryRows<{ day: string; total: string; ai_res: string }>(
          `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                  COUNT(*)::text AS total,
                  COUNT(*) FILTER (WHERE status = 'closed' AND assigned_agent_id IS NULL)::text AS ai_res
           FROM public.conversations
           WHERE workspace_id = $1 AND created_at >= now() - ($2::text || ' days')::interval
           GROUP BY 1 ORDER BY 1`,
          [workspaceId, String(days)],
        ),
        comparePrevious
          ? queryRows<{ day_offset: number; total: string }>(
              `SELECT FLOOR(EXTRACT(EPOCH FROM (created_at - (now() - ($2::text || ' days')::interval))) / 86400)::int AS day_offset,
                      COUNT(*)::text AS total
               FROM public.conversations
               WHERE workspace_id = $1
                 AND created_at >= now() - ($2::text || ' days')::interval
                 AND created_at < now() - ($3::text || ' days')::interval
               GROUP BY 1`,
              [workspaceId, String(days * 2), String(days)],
            )
          : Promise.resolve([]),
        queryRows<{ channel: string; cnt: string; ai_res: string }>(
          `SELECT COALESCE(channel, 'web') AS channel,
                  COUNT(*)::text AS cnt,
                  COUNT(*) FILTER (WHERE status = 'closed' AND assigned_agent_id IS NULL)::text AS ai_res
           FROM public.conversations
           WHERE workspace_id = $1 AND created_at >= now() - ($2::text || ' days')::interval
           GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 10`,
          [workspaceId, String(days)],
        ),
        section === 'ai'
          ? queryRows<{ verdict: string; cnt: string; avg_conf: string | null }>(
              `SELECT verdict, COUNT(*)::text AS cnt, AVG(confidence)::text AS avg_conf
               FROM public.ai_verification_logs
               WHERE workspace_id = $1 AND created_at >= now() - ($2::text || ' days')::interval
               GROUP BY 1 ORDER BY COUNT(*) DESC`,
              [workspaceId, String(days)],
            ).catch(() => [])
          : Promise.resolve([]),
      ]);

      const cTotal = Number(currAgg[0]?.total ?? 0);
      const cAi = Number(currAgg[0]?.ai_resolved ?? 0);
      const pTotal = Number(prevAgg[0]?.total ?? 0);
      const pAi = Number(prevAgg[0]?.ai_resolved ?? 0);
      const cRate = cTotal > 0 ? Math.round((cAi / cTotal) * 100) : null;
      const pRate = pTotal > 0 ? Math.round((pAi / pTotal) * 100) : null;
      const avgFrt = currAgg[0]?.avg_frt_sec ? Number(currAgg[0].avg_frt_sec) : null;
      const prevFrt = prevAgg[0]?.avg_frt_sec ? Number(prevAgg[0].avg_frt_sec) : null;
      const medRes = currAgg[0]?.med_res_sec ? Number(currAgg[0].med_res_sec) : null;

      const currByDay = new Map(dailyCurr.map((d) => [d.day, d]));
      const prevByOffset = new Map(dailyPrev.map((d) => [d.day_offset, Number(d.total)]));
      const series: AnalyticsSeriesPoint[] = axis.map((d, idx) => {
        const hit = currByDay.get(d.iso);
        const total = Number(hit?.total ?? 0);
        const aiRes = Number(hit?.ai_res ?? 0);
        return {
          date: d.iso,
          label: d.label,
          value: section === 'ai' ? aiRes : total,
          secondaryValue: section === 'ai' ? Math.max(0, total - aiRes) : aiRes,
          previousValue: comparePrevious ? prevByOffset.get(idx) ?? 0 : 0,
        };
      });

      if (section === 'ai') {
        const totalVerdicts = gapRows.reduce((s, r) => s + Number(r.cnt ?? 0), 0);
        const supportedCount = gapRows
          .filter((r) => r.verdict === 'supported')
          .reduce((s, r) => s + Number(r.cnt ?? 0), 0);
        const groundingRate =
          totalVerdicts > 0 ? Math.round((supportedCount / totalVerdicts) * 100) : null;

        return {
          canEdit,
          section,
          rangeDays: days,
          comparePrevious,
          seriesTitle: 'Daily AI resolutions vs escalated threads',
          primarySeriesLabel: 'AI resolved',
          secondarySeriesLabel: 'Escalated / open',
          kpis: [
            {
              label: 'AI resolved',
              value: cAi.toLocaleString(),
              deltaPct: comparePrevious ? pctDiff(cAi, pAi) : null,
              foot: `Last ${days} days`,
              tone: 'ai',
            },
            {
              label: 'Deflection rate',
              value: cRate === null ? '—' : `${cRate}%`,
              deltaPct: comparePrevious ? ptsDiff(cRate, pRate) : null,
              deltaUnit: 'pts',
              foot: 'Closed without human assignment',
              tone: 'ai',
            },
            {
              label: 'Verified grounded',
              value: groundingRate === null ? '—' : `${groundingRate}%`,
              deltaPct: null,
              foot: `${totalVerdicts} checked drafts`,
              tone: 'ok',
            },
            {
              label: 'Escalated threads',
              value: Math.max(0, cTotal - cAi).toLocaleString(),
              deltaPct: comparePrevious ? pctDiff(Math.max(0, cTotal - cAi), Math.max(0, pTotal - pAi)) : null,
              foot: 'Handed to human queue',
            },
          ],
          series,
          heatmap,
          breakdownTitle: gapRows.length > 0 ? 'AI answer verification outcomes' : 'AI deflection by channel',
          breakdownPrimaryCol: 'Volume',
          breakdownSecondaryCol: gapRows.length > 0 ? 'Avg confidence' : 'AI rate',
          breakdown:
            gapRows.length > 0
              ? gapRows.map((g) => {
                  const cnt = Number(g.cnt ?? 0);
                  const conf = g.avg_conf ? `${Math.round(Number(g.avg_conf) * 100)}%` : '—';
                  return {
                    key: g.verdict,
                    label: g.verdict.replace(/_/g, ' '),
                    count: cnt,
                    secondaryLabel: conf,
                    ratioPct: totalVerdicts > 0 ? Math.round((cnt / totalVerdicts) * 100) : 0,
                  };
                })
              : channelRows.map((c) => {
                  const cnt = Number(c.cnt ?? 0);
                  const ai = Number(c.ai_res ?? 0);
                  return {
                    key: c.channel,
                    label: c.channel,
                    count: cnt,
                    secondaryLabel: cnt > 0 ? `${Math.round((ai / cnt) * 100)}% AI` : '0%',
                    ratioPct: cTotal > 0 ? Math.round((cnt / cTotal) * 100) : 0,
                  };
                }),
          customReports,
        };
      }

      return {
        canEdit,
        section,
        rangeDays: days,
        comparePrevious,
        seriesTitle: 'Daily conversation volume',
        primarySeriesLabel: 'Conversations',
        secondarySeriesLabel: 'AI resolved',
        kpis: [
          {
            label: 'Total conversations',
            value: cTotal.toLocaleString(),
            deltaPct: comparePrevious ? pctDiff(cTotal, pTotal) : null,
            foot: `Last ${days} days`,
          },
          {
            label: 'AI resolved rate',
            value: cRate === null ? '—' : `${cRate}%`,
            deltaPct: comparePrevious ? ptsDiff(cRate, pRate) : null,
            deltaUnit: 'pts',
            foot: `${cAi.toLocaleString()} auto-resolved`,
            tone: 'ai',
          },
          {
            label: 'Avg first response',
            value: formatDurationSeconds(avgFrt),
            deltaPct: comparePrevious && avgFrt && prevFrt ? pctDiff(avgFrt, prevFrt) : null,
            foot: 'Human agent initial reply',
          },
          {
            label: 'Median resolution',
            value: formatDurationSeconds(medRes),
            deltaPct: null,
            foot: 'Created to closed',
          },
        ],
        series,
        heatmap,
        breakdownTitle: 'Conversations by channel',
        breakdownPrimaryCol: 'Volume',
        breakdownSecondaryCol: 'AI resolved',
        breakdown: channelRows.map((c) => {
          const cnt = Number(c.cnt ?? 0);
          const ai = Number(c.ai_res ?? 0);
          return {
            key: c.channel,
            label: c.channel,
            count: cnt,
            secondaryLabel: cnt > 0 ? `${ai} (${Math.round((ai / cnt) * 100)}%)` : '0',
            ratioPct: cTotal > 0 ? Math.round((cnt / cTotal) * 100) : 0,
          };
        }),
        customReports,
      };
    }

    if (section === 'agents') {
      const [agentRows, dailyRows] = await Promise.all([
        queryRows<{
          id: string;
          name: string;
          status: string;
          assigned_cnt: string;
          closed_cnt: string;
          avg_frt_sec: string | null;
          avg_csat: string | null;
        }>(
          `SELECT a.id, COALESCE(a.name, a.email, 'Agent') AS name, COALESCE(a.status, 'offline') AS status,
                  COUNT(c.id)::text AS assigned_cnt,
                  COUNT(c.id) FILTER (WHERE c.status = 'closed')::text AS closed_cnt,
                  AVG(EXTRACT(EPOCH FROM (c.first_agent_reply_at - c.created_at)))
                    FILTER (WHERE c.first_agent_reply_at IS NOT NULL)::text AS avg_frt_sec,
                  AVG(c.csat_rating)::text AS avg_csat
           FROM public.agents a
           LEFT JOIN public.conversations c
             ON c.assigned_agent_id = a.id
            AND c.workspace_id = $1
            AND c.created_at >= now() - ($2::text || ' days')::interval
           WHERE a.workspace_id = $1 AND a.is_active = true
           GROUP BY a.id, a.name, a.email, a.status
           ORDER BY COUNT(c.id) DESC, a.name ASC`,
          [workspaceId, String(days)],
        ),
        queryRows<{ day: string; cnt: string; closed_cnt: string }>(
          `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                  COUNT(*)::text AS cnt,
                  COUNT(*) FILTER (WHERE status = 'closed')::text AS closed_cnt
           FROM public.conversations
           WHERE workspace_id = $1
             AND assigned_agent_id IS NOT NULL
             AND created_at >= now() - ($2::text || ' days')::interval
           GROUP BY 1 ORDER BY 1`,
          [workspaceId, String(days)],
        ),
      ]);

      const totalAssigned = agentRows.reduce((s, r) => s + Number(r.assigned_cnt ?? 0), 0);
      const totalClosed = agentRows.reduce((s, r) => s + Number(r.closed_cnt ?? 0), 0);
      const onlineCount = agentRows.filter((a) => a.status === 'online').length;
      const frts = agentRows
        .map((a) => (a.avg_frt_sec ? Number(a.avg_frt_sec) : null))
        .filter((v): v is number => v !== null && Number.isFinite(v));
      const meanFrt = frts.length > 0 ? frts.reduce((a, b) => a + b, 0) / frts.length : null;

      const byDay = new Map(dailyRows.map((d) => [d.day, d]));
      const series: AnalyticsSeriesPoint[] = axis.map((d) => {
        const hit = byDay.get(d.iso);
        return {
          date: d.iso,
          label: d.label,
          value: Number(hit?.cnt ?? 0),
          secondaryValue: Number(hit?.closed_cnt ?? 0),
          previousValue: 0,
        };
      });

      return {
        canEdit,
        section,
        rangeDays: days,
        comparePrevious,
        seriesTitle: 'Daily agent-handled conversations',
        primarySeriesLabel: 'Assigned',
        secondarySeriesLabel: 'Closed',
        kpis: [
          {
            label: 'Active agents',
            value: agentRows.length.toLocaleString(),
            deltaPct: null,
            foot: `${onlineCount} currently online`,
          },
          {
            label: 'Agent handled',
            value: totalAssigned.toLocaleString(),
            deltaPct: null,
            foot: `Last ${days} days`,
          },
          {
            label: 'Closed by team',
            value: totalClosed.toLocaleString(),
            deltaPct: null,
            foot: totalAssigned > 0 ? `${Math.round((totalClosed / totalAssigned) * 100)}% closure` : 'No assigned threads',
            tone: 'ok',
          },
          {
            label: 'Avg response time',
            value: formatDurationSeconds(meanFrt),
            deltaPct: null,
            foot: 'Across active teammates',
          },
        ],
        series,
        heatmap,
        breakdownTitle: 'Team leaderboard',
        breakdownPrimaryCol: 'Assigned',
        breakdownSecondaryCol: 'Closed · Avg response',
        breakdown: agentRows.map((a) => {
          const assigned = Number(a.assigned_cnt ?? 0);
          const closed = Number(a.closed_cnt ?? 0);
          const frt = a.avg_frt_sec ? formatDurationSeconds(Number(a.avg_frt_sec)) : '—';
          return {
            key: a.id,
            label: a.name,
            meta: a.status,
            count: assigned,
            secondaryLabel: `${closed} closed · ${frt}`,
            ratioPct: totalAssigned > 0 ? Math.round((assigned / totalAssigned) * 100) : 0,
          };
        }),
        customReports,
      };
    }

    if (section === 'calls') {
      const [agg, daily, byStatus] = await Promise.all([
        queryRows<Record<string, string | null>>(
          `SELECT COUNT(*)::text AS total,
                  COUNT(*) FILTER (WHERE handler = 'ai')::text AS ai_handled,
                  COUNT(*) FILTER (WHERE status = 'missed')::text AS missed,
                  AVG(duration_seconds) FILTER (WHERE duration_seconds > 0)::text AS avg_dur
           FROM public.voice_calls
           WHERE workspace_id = $1 AND COALESCE(started_at, created_at) >= now() - ($2::text || ' days')::interval`,
          [workspaceId, String(days)],
        ),
        queryRows<{ day: string; total: string; ai_cnt: string }>(
          `SELECT to_char(date_trunc('day', COALESCE(started_at, created_at) AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                  COUNT(*)::text AS total,
                  COUNT(*) FILTER (WHERE handler = 'ai')::text AS ai_cnt
           FROM public.voice_calls
           WHERE workspace_id = $1 AND COALESCE(started_at, created_at) >= now() - ($2::text || ' days')::interval
           GROUP BY 1 ORDER BY 1`,
          [workspaceId, String(days)],
        ),
        queryRows<{ status: string; cnt: string; avg_dur: string | null }>(
          `SELECT COALESCE(status, 'completed') AS status,
                  COUNT(*)::text AS cnt,
                  AVG(duration_seconds)::text AS avg_dur
           FROM public.voice_calls
           WHERE workspace_id = $1 AND COALESCE(started_at, created_at) >= now() - ($2::text || ' days')::interval
           GROUP BY 1 ORDER BY COUNT(*) DESC`,
          [workspaceId, String(days)],
        ),
      ]);

      const total = Number(agg[0]?.total ?? 0);
      const aiHandled = Number(agg[0]?.ai_handled ?? 0);
      const missed = Number(agg[0]?.missed ?? 0);
      const avgDur = agg[0]?.avg_dur ? Number(agg[0].avg_dur) : null;
      const byDay = new Map(daily.map((d) => [d.day, d]));

      return {
        canEdit,
        section,
        rangeDays: days,
        comparePrevious,
        seriesTitle: 'Daily voice calls',
        primarySeriesLabel: 'Total calls',
        secondarySeriesLabel: 'AI handled',
        kpis: [
          { label: 'Total calls', value: total.toLocaleString(), deltaPct: null, foot: `Last ${days} days` },
          {
            label: 'AI voice handled',
            value: aiHandled.toLocaleString(),
            deltaPct: null,
            foot: total > 0 ? `${Math.round((aiHandled / total) * 100)}% of calls` : 'No calls',
            tone: 'ai',
          },
          {
            label: 'Missed calls',
            value: missed.toLocaleString(),
            deltaPct: null,
            foot: 'Unanswered inbound',
            tone: missed > 0 ? 'warn' : undefined,
          },
          {
            label: 'Avg call length',
            value: formatDurationSeconds(avgDur),
            deltaPct: null,
            foot: 'Completed calls',
          },
        ],
        series: axis.map((d) => {
          const hit = byDay.get(d.iso);
          return {
            date: d.iso,
            label: d.label,
            value: Number(hit?.total ?? 0),
            secondaryValue: Number(hit?.ai_cnt ?? 0),
            previousValue: 0,
          };
        }),
        heatmap,
        breakdownTitle: 'Calls by status',
        breakdownPrimaryCol: 'Calls',
        breakdownSecondaryCol: 'Avg duration',
        breakdown: byStatus.map((s) => {
          const cnt = Number(s.cnt ?? 0);
          return {
            key: s.status,
            label: s.status,
            count: cnt,
            secondaryLabel: formatDurationSeconds(s.avg_dur ? Number(s.avg_dur) : null),
            ratioPct: total > 0 ? Math.round((cnt / total) * 100) : 0,
          };
        }),
        customReports,
      };
    }

    if (section === 'csat') {
      const [srRows, convFallbackRows] = await Promise.all([
        queryRows<Record<string, unknown>>(
          `SELECT kind, score, channel, handler_type, created_at
           FROM public.survey_responses
           WHERE workspace_id = $1 AND created_at >= now() - ($2::text || ' days')::interval`,
          [workspaceId, String(days)],
        ),
        queryRows<Record<string, unknown>>(
          `SELECT csat_rating AS score, channel,
                  CASE WHEN assigned_agent_id IS NOT NULL THEN 'human' WHEN ai_enabled THEN 'ai' ELSE 'unknown' END AS handler_type,
                  updated_at AS created_at
           FROM public.conversations c
           WHERE workspace_id = $1
             AND csat_rating IS NOT NULL
             AND updated_at >= now() - ($2::text || ' days')::interval
             AND NOT EXISTS (
               SELECT 1 FROM public.survey_responses sr WHERE sr.workspace_id = $1 AND sr.conversation_id = c.id AND sr.kind = 'csat'
             )`,
          [workspaceId, String(days)],
        ).catch(() => []),
      ]);

      const allCsat = [
        ...srRows.filter((r) => r.kind !== 'nps'),
        ...convFallbackRows,
      ];
      const allNps = srRows.filter((r) => r.kind === 'nps');
      const csatCount = allCsat.length;
      const csatGood = allCsat.filter((r) => Number(r.score ?? 0) >= 4).length;
      const csatPct = csatCount > 0 ? Math.round((csatGood / csatCount) * 100) : null;
      const avgStars =
        csatCount > 0
          ? Math.round((allCsat.reduce((s, r) => s + Number(r.score ?? 0), 0) / csatCount) * 100) / 100
          : null;

      const npsCount = allNps.length;
      const promoters = allNps.filter((r) => Number(r.score ?? 0) >= 9).length;
      const detractors = allNps.filter((r) => Number(r.score ?? 0) <= 6).length;
      const npsScore =
        npsCount > 0 ? Math.round(((promoters - detractors) / npsCount) * 100) : null;

      const byDay = new Map<string, { total: number; good: number }>();
      for (const r of allCsat) {
        const day = new Date(String(r.created_at)).toISOString().slice(0, 10);
        const cur = byDay.get(day) ?? { total: 0, good: 0 };
        cur.total += 1;
        if (Number(r.score ?? 0) >= 4) cur.good += 1;
        byDay.set(day, cur);
      }

      const byChannel = new Map<string, { count: number; sum: number }>();
      for (const r of allCsat) {
        const ch = String(r.channel || 'web');
        const cur = byChannel.get(ch) ?? { count: 0, sum: 0 };
        cur.count += 1;
        cur.sum += Number(r.score ?? 0);
        byChannel.set(ch, cur);
      }

      return {
        canEdit,
        section,
        rangeDays: days,
        comparePrevious,
        seriesTitle: 'Daily CSAT responses',
        primarySeriesLabel: 'Ratings',
        secondarySeriesLabel: 'Positive (4-5 stars)',
        kpis: [
          {
            label: 'CSAT score',
            value: csatPct === null ? '—' : `${csatPct}%`,
            deltaPct: null,
            foot: `${csatCount} ratings collected`,
            tone: 'ok',
          },
          {
            label: 'Average rating',
            value: avgStars === null ? '—' : `${avgStars} / 5`,
            deltaPct: null,
            foot: 'Star average',
          },
          {
            label: 'Net Promoter (NPS)',
            value: npsScore === null ? '—' : `${npsScore > 0 ? '+' : ''}${npsScore}`,
            deltaPct: null,
            foot: `${npsCount} NPS responses`,
          },
          {
            label: 'Positive share',
            value: csatGood.toLocaleString(),
            deltaPct: null,
            foot: 'Rated 4 or 5 stars',
          },
        ],
        series: axis.map((d) => {
          const hit = byDay.get(d.iso);
          return {
            date: d.iso,
            label: d.label,
            value: hit?.total ?? 0,
            secondaryValue: hit?.good ?? 0,
            previousValue: 0,
          };
        }),
        heatmap,
        breakdownTitle: 'Satisfaction by channel',
        breakdownPrimaryCol: 'Responses',
        breakdownSecondaryCol: 'Avg stars',
        breakdown: Array.from(byChannel.entries()).map(([ch, v]) => ({
          key: ch,
          label: ch,
          count: v.count,
          secondaryLabel: `${(v.sum / v.count).toFixed(2)} ★`,
          ratioPct: csatCount > 0 ? Math.round((v.count / csatCount) * 100) : 0,
        })),
        customReports,
      };
    }

    // 'biz': Commerce & business impact from customer_orders + journey conversions
    const [orderAgg, dailyOrders, byOrderStatus, goalRows] = await Promise.all([
      queryRows<Record<string, string | null>>(
        `SELECT COUNT(*)::text AS cnt,
                COALESCE(SUM(total_cents), 0)::text AS rev_cents,
                COUNT(*) FILTER (WHERE status IN ('refunded', 'cancelled'))::text AS refunded_cnt
         FROM public.customer_orders
         WHERE workspace_id = $1 AND COALESCE(ordered_at, created_at) >= now() - ($2::text || ' days')::interval`,
        [workspaceId, String(days)],
      ),
      queryRows<{ day: string; rev_dollars: string; cnt: string }>(
        `SELECT to_char(date_trunc('day', COALESCE(ordered_at, created_at) AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                ROUND(COALESCE(SUM(total_cents), 0) / 100.0)::text AS rev_dollars,
                COUNT(*)::text AS cnt
         FROM public.customer_orders
         WHERE workspace_id = $1 AND COALESCE(ordered_at, created_at) >= now() - ($2::text || ' days')::interval
         GROUP BY 1 ORDER BY 1`,
        [workspaceId, String(days)],
      ),
      queryRows<{ status: string; cnt: string; rev_cents: string }>(
        `SELECT COALESCE(status, 'pending') AS status,
                COUNT(*)::text AS cnt,
                COALESCE(SUM(total_cents), 0)::text AS rev_cents
         FROM public.customer_orders
         WHERE workspace_id = $1 AND COALESCE(ordered_at, created_at) >= now() - ($2::text || ' days')::interval
         GROUP BY 1 ORDER BY SUM(total_cents) DESC`,
        [workspaceId, String(days)],
      ),
      queryRows<{ cnt: string; rev_cents: string }>(
        `SELECT COUNT(*)::text AS cnt, COALESCE(SUM(revenue_cents), 0)::text AS rev_cents
         FROM public.customer_journey_enrollments
         WHERE workspace_id = $1 AND status = 'goal_reached'`,
        [workspaceId],
      ).catch(() => [{ cnt: '0', rev_cents: '0' }]),
    ]);

    const orderCount = Number(orderAgg[0]?.cnt ?? 0);
    const totalRevCents = Number(orderAgg[0]?.rev_cents ?? 0);
    const refundedCnt = Number(orderAgg[0]?.refunded_cnt ?? 0);
    const aovCents = orderCount > 0 ? Math.round(totalRevCents / orderCount) : 0;
    const journeyGoalRevCents = Number(goalRows[0]?.rev_cents ?? 0);
    const byDay = new Map(dailyOrders.map((d) => [d.day, d]));

    return {
      canEdit,
      section,
      rangeDays: days,
      comparePrevious,
      seriesTitle: 'Daily order revenue ($)',
      primarySeriesLabel: 'Revenue ($)',
      secondarySeriesLabel: 'Orders',
      kpis: [
        {
          label: 'Order revenue',
          value: orderCount > 0 ? formatCents(totalRevCents) : '—',
          deltaPct: null,
          foot: `${orderCount} orders in ${days}d`,
          tone: 'ok',
        },
        {
          label: 'Average order value',
          value: orderCount > 0 ? formatCents(aovCents) : '—',
          deltaPct: null,
          foot: 'Mean order value',
        },
        {
          label: 'Journey attributed',
          value: journeyGoalRevCents > 0 ? formatCents(journeyGoalRevCents) : '—',
          deltaPct: null,
          foot: `${Number(goalRows[0]?.cnt ?? 0)} reached goals`,
          tone: 'ok',
        },
        {
          label: 'Refunds / cancelled',
          value: refundedCnt.toLocaleString(),
          deltaPct: null,
          foot: 'Flagged order statuses',
          tone: refundedCnt > 0 ? 'warn' : undefined,
        },
      ],
      series: axis.map((d) => {
        const hit = byDay.get(d.iso);
        return {
          date: d.iso,
          label: d.label,
          value: Number(hit?.rev_dollars ?? 0),
          secondaryValue: Number(hit?.cnt ?? 0),
          previousValue: 0,
        };
      }),
      heatmap,
      breakdownTitle: 'Orders by fulfillment status',
      breakdownPrimaryCol: 'Orders',
      breakdownSecondaryCol: 'Revenue',
      breakdown: byOrderStatus.map((o) => {
        const cnt = Number(o.cnt ?? 0);
        return {
          key: o.status,
          label: o.status,
          count: cnt,
          secondaryLabel: formatCents(Number(o.rev_cents ?? 0)),
          ratioPct: orderCount > 0 ? Math.round((cnt / orderCount) * 100) : 0,
        };
      }),
      customReports,
    };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not load analytics data.'));
  }
}

export async function saveCustomReportAction(
  workspaceId: string,
  input: {
    name: string;
    description?: string;
    section: AnalyticsSection;
    rangeDays: AnalyticsRangeDays;
    comparePrevious: boolean;
  },
): Promise<CustomReportRecord> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'edit_content');
    const cleanName = input.name.trim().slice(0, 120);
    if (!cleanName) throw new Error('Report name is required.');

    const rows = await queryRows<Record<string, unknown>>(
      `INSERT INTO public.analytics_custom_reports
         (workspace_id, name, description, section, range_days, compare_previous, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        workspaceId,
        cleanName,
        (input.description?.trim() || '').slice(0, 400),
        input.section,
        input.rangeDays,
        input.comparePrevious,
        agent.id,
      ],
    );
    const r = rows[0];
    if (!r) throw new Error('Could not save custom report');
    return {
      id: String(r.id),
      name: String(r.name),
      description: String(r.description || ''),
      section: r.section as AnalyticsSection,
      rangeDays: Number(r.range_days) as AnalyticsRangeDays,
      comparePrevious: Boolean(r.compare_previous),
      createdAt: String(r.created_at),
    };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not save custom report.'));
  }
}

export async function deleteCustomReportAction(
  workspaceId: string,
  reportId: string,
): Promise<{ deleted: true }> {
  try {
    await getWorkspaceAccess(workspaceId, 'edit_content');
    await query(
      `DELETE FROM public.analytics_custom_reports WHERE id = $1 AND workspace_id = $2`,
      [reportId, workspaceId],
    );
    return { deleted: true };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not delete custom report.'));
  }
}
