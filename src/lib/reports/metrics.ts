/**
 * Metrics calculation engine for reports and analytics.
 * Computes all metrics from stored events (reporting_events, sla_events)
 * without scanning historical tickets on every page load.
 */

import type { ReportingEvent } from '@/types/database';

export interface SlaEventItem {
  id?: number | string;
  metric: 'first_reply' | 'next_reply' | 'resolution' | string;
  event: 'met' | 'breached' | 'warning' | string;
  target_minutes?: number;
  occurred_at: string;
  assignee_id?: string | null;
  group_id?: string | null;
  late?: boolean;
}

export interface MetricFilterOptions {
  groupId?: string | null;
  agentId?: string | null;
  channel?: string | null;
  granularity?: 'day' | 'hour';
  timeZone?: string | null;
}

export interface DateBucket {
  key: string;       // YYYY-MM-DD (day) or YYYY-MM-DDTHH (hour)
  label: string;     // e.g. "Oct 12" or "2pm"
  start: Date;
  end: Date;
}

export interface CreatedVsSolvedPoint {
  date: string;
  label: string;
  created: number;
  solved: number;
  aiResolved: number;
  humanResolved: number;
  stillOpen: number;
}

export interface BacklogPoint {
  date: string;
  label: string;
  backlog: number;
}

export interface BreakdownItem {
  key: string;
  label: string;
  count: number;
  percentage: number;
  aiResolvedCount?: number;
  aiResolutionPct?: number | null;
}

export interface AiAgentSummaryRow {
  id: string;
  name: string;
  roleTitle: string | null;
  status: 'live' | 'draft' | 'paused' | string;
  isPrimary: boolean;
  channels: string[];
  totalReplies: number;
  supportedCount: number;
  flaggedCount: number;
  escalatedCount: number;
  groundingPct: number | null;
  avgConfidencePct: number | null;
}

export interface WorkspaceAiRoi {
  aiResolvedCount: number;
  avgHandleMinutes: number;
  hourlyRateUsd: number;
  hoursSaved: number;
  costSavedUsd: number;
}

export interface OverviewActionQueue {
  urgentSlaCount: number;
  breachedCount: number;
  breachingSoonCount: number;
  aiQualityFlagsCount: number;
  waitingHandoffsCount: number;
}

export interface HeatmapCell {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayName: string;   // 'Sun', 'Mon', etc.
  hour: number;      // 0 - 23
  count: number;
}

export interface AgentLeaderboardRow {
  agentId: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  solvedCount: number;
  avgFrtSeconds: number | null;
  medianFrtSeconds: number | null;
  avgResolutionSeconds: number | null;
  medianResolutionSeconds: number | null;
  csatGood: number;
  csatBad: number;
  totalCsat: number;
  csatPercent: number | null; // e.g. 95.0
}

export interface CsatFeedbackItem {
  ticketId: string | null;
  rating: 'good' | 'bad';
  comment: string | null;
  occurredAt: string;
  agentId?: string | null;
  channel?: string | null;
}

export interface ReportsSummary {
  totalCreated: number;
  totalSolved: number;
  resolutionRatePercent: number | null;
  initialBacklog: number;
  finalBacklog: number;
  netBacklogChange: number;

  avgFrtSeconds: number | null;
  medianFrtSeconds: number | null;
  avgResolutionSeconds: number | null;
  medianResolutionSeconds: number | null;

  totalSlaMet: number;
  totalSlaBreached: number;
  overallSlaPercent: number | null;
  firstReplySlaPercent: number | null;
  nextReplySlaPercent: number | null;
  resolutionSlaPercent: number | null;

  totalCsatRatings: number;
  goodCsatRatings: number;
  badCsatRatings: number;
  csatPercent: number | null;
  csatResponseRatePercent: number | null;

  botResolvedCount: number;
  botHandoverCount: number;
  totalBotInquiries: number;
  botResolutionRatePercent: number | null;
}

export interface HandoffReportMetrics {
  offered: number;
  requested: number;
  claimed: number;
  offline_queued: number;
  acceptance_rate_percent: number;
  avg_wait_seconds: number;
  reasons: Array<{ reason: string; count: number }>;
}

export interface ReportsDashboardData {
  summary: ReportsSummary;
  createdVsSolved: CreatedVsSolvedPoint[];
  backlogOverTime: BacklogPoint[];
  channelBreakdown: BreakdownItem[];
  priorityBreakdown: BreakdownItem[];
  tagBreakdown: BreakdownItem[];
  heatmap: HeatmapCell[];
  peakHour: { dayName: string; hour: number; label: string; count: number } | null;
  leaderboard: AgentLeaderboardRow[];
  recentFeedback: CsatFeedbackItem[];
  handoff?: HandoffReportMetrics;
  aiAgents?: AiAgentSummaryRow[];
  roi?: WorkspaceAiRoi;
  actionQueue?: OverviewActionQueue;
  granularity?: 'day' | 'hour';
  timeZone?: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/* ── Math & Stat Helpers ──────────────────────────────────────────────── */

/** Computes the median of an array of numbers. Returns null if empty. */
export function calculateMedian(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

/** Computes the arithmetic mean. Returns null if empty. */
export function calculateAverage(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / values.length);
}

/** Formats duration into human-readable SaaS format (e.g. 15m, 2h 30m, 1d 4h). */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '—';
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `${seconds}s`;

  const mins = Math.floor(seconds / 60);
  if (mins < 60) {
    const remSecs = seconds % 60;
    return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  }

  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const zonedFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function normalizeTimeZone(tz?: string | null): string {
  const candidate = (tz || '').trim();
  if (!candidate) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

function getZonedFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = zonedFormatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    zonedFormatterCache.set(timeZone, fmt);
  }
  return fmt;
}

function getZonedParts(date: Date, timeZone: string): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: number;
  second: number;
} {
  const parts = getZonedFormatter(timeZone).formatToParts(date);
  let year = '1970';
  let month = '01';
  let day = '01';
  let hour = '00';
  let minute = 0;
  let second = 0;
  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    else if (p.type === 'month') month = p.value;
    else if (p.type === 'day') day = p.value;
    else if (p.type === 'hour') hour = p.value === '24' ? '00' : p.value;
    else if (p.type === 'minute') minute = Number(p.value) || 0;
    else if (p.type === 'second') second = Number(p.value) || 0;
  }
  return { year, month, day, hour, minute, second };
}

function formatHourLabel(hour24: number): string {
  const h = ((hour24 % 24) + 24) % 24;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? 'am' : 'pm'}`;
}

function formatDayLabel(monthStr: string, dayStr: string): string {
  const monthIdx = Math.max(0, Math.min(11, (Number(monthStr) || 1) - 1));
  return `${MONTH_SHORT[monthIdx]} ${Number(dayStr) || 1}`;
}

/** Generates daily buckets between start and end dates in the specified timezone (default UTC). */
export function generateDateBuckets(startDate: Date, endDate: Date, timeZone = 'UTC'): DateBucket[] {
  const tz = normalizeTimeZone(timeZone);
  if (tz === 'UTC') {
    const buckets: DateBucket[] = [];
    const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    while (current <= end) {
      const key = current.toISOString().slice(0, 10);
      const month = current.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const day = current.getUTCDate();
      buckets.push({
        key,
        label: `${month} ${day}`,
        start: new Date(current),
        end: new Date(current.getTime() + 24 * 60 * 60 * 1000 - 1),
      });
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return buckets;
  }

  const buckets: DateBucket[] = [];
  const seenKeys = new Set<string>();
  const endParts = getZonedParts(endDate, tz);
  const endKey = `${endParts.year}-${endParts.month}-${endParts.day}`;

  // Step hour-by-hour in UTC instants so non-UTC calendars (including DST transitions) capture every local date cleanly.
  const startMidnightApprox = new Date(startDate.getTime() - 24 * 3_600_000);
  const maxSteps = Math.max(24, Math.ceil((endDate.getTime() - startDate.getTime()) / 3_600_000) + 48);
  let started = false;
  const startParts = getZonedParts(startDate, tz);
  const startKey = `${startParts.year}-${startParts.month}-${startParts.day}`;

  for (let h = 0; h <= maxSteps; h++) {
    const probe = new Date(startMidnightApprox.getTime() + h * 3_600_000);
    const parts = getZonedParts(probe, tz);
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    if (!started && key < startKey) continue;
    started = true;
    if (key > endKey) break;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      const bucketStartMs =
        probe.getTime() - ((Number(parts.hour) * 3600 + parts.minute * 60 + parts.second) * 1000 + probe.getUTCMilliseconds());
      buckets.push({
        key,
        label: formatDayLabel(parts.month, parts.day),
        start: new Date(bucketStartMs),
        end: new Date(bucketStartMs + 24 * 3_600_000 - 1),
      });
    }
  }
  return buckets;
}

/** Generates consecutive hourly buckets ending at the current hour in `timeZone` (default 24 hours). */
export function generateHourBuckets(
  endDate: Date,
  timeZone = 'UTC',
  hoursCount = 24,
): DateBucket[] {
  const tz = normalizeTimeZone(timeZone);
  const count = Math.max(1, Math.min(168, Math.floor(hoursCount)));
  const endParts = getZonedParts(endDate, tz);
  const currentHourStartMs =
    endDate.getTime() - ((endParts.minute * 60 + endParts.second) * 1000 + endDate.getUTCMilliseconds());

  const buckets: DateBucket[] = [];
  const keyCounts = new Map<string, number>();

  for (let i = count - 1; i >= 0; i--) {
    const startMs = currentHourStartMs - i * 3_600_000;
    const slotStart = new Date(startMs);
    const parts = getZonedParts(slotStart, tz);
    const baseKey = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;
    const seen = (keyCounts.get(baseKey) || 0) + 1;
    keyCounts.set(baseKey, seen);
    const key = seen > 1 ? `${baseKey}#${seen}` : baseKey;

    buckets.push({
      key,
      label: formatHourLabel(Number(parts.hour)),
      start: slotStart,
      end: new Date(startMs + 3_600_000 - 1),
    });
  }

  return buckets;
}

/* ── Event Filtering ──────────────────────────────────────────────────── */

export function filterReportingEvents(
  events: ReportingEvent[],
  filters: MetricFilterOptions
): ReportingEvent[] {
  return events.filter((e) => {
    if (filters.groupId && e.group_id !== filters.groupId) return false;
    if (filters.agentId && e.agent_id !== filters.agentId) return false;
    if (filters.channel && e.channel !== filters.channel) return false;
    return true;
  });
}

export function filterSlaEvents(
  events: SlaEventItem[],
  filters: MetricFilterOptions
): SlaEventItem[] {
  return events.filter((e) => {
    if (filters.groupId && e.group_id !== filters.groupId) return false;
    if (filters.agentId && e.assignee_id !== filters.agentId) return false;
    return true;
  });
}

/* ── Metric Calculations ──────────────────────────────────────────────── */

function toIsoTimestamp(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  const parsed = new Date(value as unknown as string);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function buildBucketLookup(buckets: DateBucket[]): Map<string, DateBucket[]> {
  const map = new Map<string, DateBucket[]>();
  for (const b of buckets) {
    const baseKey = b.key.split('#')[0];
    const arr = map.get(baseKey);
    if (arr) arr.push(b);
    else map.set(baseKey, [b]);
  }
  return map;
}

function resolveEventBucketKey(
  occurredAt: string | Date,
  granularity: 'day' | 'hour',
  timeZone: string,
  bucketLookup: Map<string, DateBucket[]>,
): string | null {
  const iso = toIsoTimestamp(occurredAt);
  if (!iso) return null;

  if (granularity === 'day' && timeZone === 'UTC') {
    const key = iso.slice(0, 10);
    return bucketLookup.has(key) ? key : null;
  }

  const parsed = occurredAt instanceof Date ? occurredAt : new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = getZonedParts(parsed, timeZone);
  const baseKey =
    granularity === 'hour'
      ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`
      : `${parts.year}-${parts.month}-${parts.day}`;

  const matches = bucketLookup.get(baseKey);
  if (!matches || matches.length === 0) return null;
  if (matches.length === 1) return matches[0].key;

  const ts = parsed.getTime();
  const exact = matches.find((b) => ts >= b.start.getTime() && ts <= b.end.getTime());
  return (exact ?? matches[0]).key;
}

function eventOrderRank(eventType: string): number {
  if (eventType === 'ticket_created') return 1;
  if (eventType === 'ticket_reopened') return 2;
  if (eventType === 'ticket_solved') return 3;
  if (eventType === 'bot_resolved') return 4;
  return 0;
}

/** 1. Created vs Solved timeline (including AI vs human resolution & still-open breakdown) */
export function calculateCreatedVsSolved(
  events: ReportingEvent[],
  buckets: DateBucket[],
  options?: { granularity?: 'day' | 'hour'; timeZone?: string | null },
): CreatedVsSolvedPoint[] {
  const granularity: 'day' | 'hour' =
    options?.granularity ?? (buckets.some((b) => b.key.includes('T')) ? 'hour' : 'day');
  const timeZone = normalizeTimeZone(options?.timeZone);
  const bucketLookup = buildBucketLookup(buckets);

  const pointMap = new Map<
    string,
    {
      created: number;
      solved: number;
      aiResolved: number;
      humanResolved: number;
      stillOpen: number;
      unmatchedCreated: number;
      unmatchedSolved: number;
    }
  >();
  for (const b of buckets) {
    pointMap.set(b.key, {
      created: 0,
      solved: 0,
      aiResolved: 0,
      humanResolved: 0,
      stillOpen: 0,
      unmatchedCreated: 0,
      unmatchedSolved: 0,
    });
  }

  const botResolvedTicketIds = new Set<string>();
  const latestTicketStatus = new Map<string, { status: 'open' | 'solved'; ts: number; rank: number }>();

  for (const e of events) {
    if (e.event_type === 'bot_resolved' && e.ticket_id) {
      botResolvedTicketIds.add(e.ticket_id);
    }
    const rank = eventOrderRank(e.event_type);
    if (e.ticket_id && rank > 0) {
      const ts = new Date(toIsoTimestamp(e.occurred_at)).getTime() || 0;
      const status: 'open' | 'solved' =
        e.event_type === 'ticket_solved' || e.event_type === 'bot_resolved' ? 'solved' : 'open';
      const prev = latestTicketStatus.get(e.ticket_id);
      if (!prev || ts > prev.ts || (ts === prev.ts && rank >= prev.rank)) {
        latestTicketStatus.set(e.ticket_id, { status, ts, rank });
      }
    }
  }

  const matchedBotTicketIds = new Set<string>();

  for (const e of events) {
    const bucketKey = resolveEventBucketKey(e.occurred_at, granularity, timeZone, bucketLookup);
    const pt = bucketKey ? pointMap.get(bucketKey) : undefined;
    if (!pt) continue;

    if (e.event_type === 'ticket_created') {
      pt.created += 1;
      if (e.ticket_id) {
        if (latestTicketStatus.get(e.ticket_id)?.status !== 'solved') {
          pt.stillOpen += 1;
        }
      } else {
        pt.unmatchedCreated += 1;
      }
    } else if (e.event_type === 'ticket_solved') {
      pt.solved += 1;
      if (!e.ticket_id) {
        pt.unmatchedSolved += 1;
      }
      if (e.ticket_id && botResolvedTicketIds.has(e.ticket_id)) {
        pt.aiResolved += 1;
        matchedBotTicketIds.add(e.ticket_id);
      } else {
        pt.humanResolved += 1;
      }
    }
  }

  // Fallback for standalone `bot_resolved` events emitted without a corresponding `ticket_solved`
  for (const e of events) {
    if (e.event_type !== 'bot_resolved') continue;
    if (e.ticket_id && matchedBotTicketIds.has(e.ticket_id)) continue;
    if (e.ticket_id) matchedBotTicketIds.add(e.ticket_id);

    const bucketKey = resolveEventBucketKey(e.occurred_at, granularity, timeZone, bucketLookup);
    const pt = bucketKey ? pointMap.get(bucketKey) : undefined;
    if (!pt) continue;
    pt.aiResolved += 1;
    pt.solved += 1;
    if (!e.ticket_id) pt.unmatchedSolved += 1;
  }

  return buckets.map((b) => {
    const pt = pointMap.get(b.key)!;
    const extraOpen = Math.max(0, pt.unmatchedCreated - pt.unmatchedSolved);
    return {
      date: b.key,
      label: b.label,
      created: pt.created,
      solved: pt.solved,
      aiResolved: pt.aiResolved,
      humanResolved: pt.humanResolved,
      stillOpen: pt.stillOpen + extraOpen,
    };
  });
}

/** 2. Backlog over time */
export function calculateBacklogOverTime(
  initialBacklog: number,
  events: ReportingEvent[],
  buckets: DateBucket[],
  options?: { granularity?: 'day' | 'hour'; timeZone?: string | null },
): BacklogPoint[] {
  const granularity: 'day' | 'hour' =
    options?.granularity ?? (buckets.some((b) => b.key.includes('T')) ? 'hour' : 'day');
  const timeZone = normalizeTimeZone(options?.timeZone);
  const bucketLookup = buildBucketLookup(buckets);

  const dayDelta = new Map<string, number>();
  for (const b of buckets) {
    dayDelta.set(b.key, 0);
  }

  for (const e of events) {
    const bucketKey = resolveEventBucketKey(e.occurred_at, granularity, timeZone, bucketLookup);
    if (!bucketKey || !dayDelta.has(bucketKey)) continue;

    if (e.event_type === 'ticket_created') {
      dayDelta.set(bucketKey, dayDelta.get(bucketKey)! + 1);
    } else if (e.event_type === 'ticket_solved') {
      dayDelta.set(bucketKey, dayDelta.get(bucketKey)! - 1);
    } else if (e.event_type === 'ticket_reopened') {
      dayDelta.set(bucketKey, dayDelta.get(bucketKey)! + 1);
    }
  }

  let running = Math.max(0, initialBacklog);
  return buckets.map((b) => {
    running = Math.max(0, running + (dayDelta.get(b.key) || 0));
    return {
      date: b.key,
      label: b.label,
      backlog: running,
    };
  });
}

/** 3. First Reply Time & Resolution Time (Median and Average) */
export function calculateResponseTimes(events: ReportingEvent[]): {
  avgFrtSeconds: number | null;
  medianFrtSeconds: number | null;
  avgResolutionSeconds: number | null;
  medianResolutionSeconds: number | null;
} {
  const frtList: number[] = [];
  const resList: number[] = [];

  for (const e of events) {
    if (e.event_type === 'first_reply' && typeof e.duration_seconds === 'number') {
      frtList.push(e.duration_seconds);
    } else if (e.event_type === 'ticket_solved' && typeof e.duration_seconds === 'number') {
      resList.push(e.duration_seconds);
    }
  }

  return {
    avgFrtSeconds: calculateAverage(frtList),
    medianFrtSeconds: calculateMedian(frtList),
    avgResolutionSeconds: calculateAverage(resList),
    medianResolutionSeconds: calculateMedian(resList),
  };
}

/** 4. SLA achievement % */
export function calculateSlaAchievement(slaEvents: SlaEventItem[]): {
  totalMet: number;
  totalBreached: number;
  overallPercent: number | null;
  firstReplyPercent: number | null;
  nextReplyPercent: number | null;
  resolutionPercent: number | null;
} {
  let metTotal = 0;
  let breachedTotal = 0;

  const metricCounts: Record<string, { met: number; breached: number }> = {
    first_reply: { met: 0, breached: 0 },
    next_reply: { met: 0, breached: 0 },
    resolution: { met: 0, breached: 0 },
  };

  for (const e of slaEvents) {
    if (e.event === 'met') {
      metTotal += 1;
      if (metricCounts[e.metric]) metricCounts[e.metric].met += 1;
    } else if (e.event === 'breached') {
      breachedTotal += 1;
      if (metricCounts[e.metric]) metricCounts[e.metric].breached += 1;
    }
  }

  const calcPct = (met: number, breached: number): number | null => {
    const total = met + breached;
    if (total === 0) return null;
    return Number(((met / total) * 100).toFixed(1));
  };

  return {
    totalMet: metTotal,
    totalBreached: breachedTotal,
    overallPercent: calcPct(metTotal, breachedTotal),
    firstReplyPercent: calcPct(metricCounts.first_reply.met, metricCounts.first_reply.breached),
    nextReplyPercent: calcPct(metricCounts.next_reply.met, metricCounts.next_reply.breached),
    resolutionPercent: calcPct(metricCounts.resolution.met, metricCounts.resolution.breached),
  };
}

/** 5. CSAT % */
export function calculateCsatMetrics(
  events: ReportingEvent[],
  totalSolved: number
): {
  totalRatings: number;
  goodRatings: number;
  badRatings: number;
  csatPercent: number | null;
  responseRatePercent: number | null;
  recentFeedback: CsatFeedbackItem[];
} {
  let good = 0;
  let bad = 0;
  const feedbackList: CsatFeedbackItem[] = [];

  for (const e of events) {
    if (e.event_type === 'csat_rated' && e.csat_rating) {
      if (e.csat_rating === 'good') good += 1;
      else if (e.csat_rating === 'bad') bad += 1;

      feedbackList.push({
        ticketId: e.ticket_id,
        rating: e.csat_rating,
        comment: e.csat_comment,
        occurredAt: toIsoTimestamp(e.occurred_at),
        agentId: e.agent_id,
        channel: e.channel,
      });
    }
  }

  const total = good + bad;
  const csatPercent = total > 0 ? Number(((good / total) * 100).toFixed(1)) : null;
  const responseRate = totalSolved > 0 ? Number(((total / totalSolved) * 100).toFixed(1)) : null;

  // Sort feedback descending by timestamp
  feedbackList.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return {
    totalRatings: total,
    goodRatings: good,
    badRatings: bad,
    csatPercent,
    responseRatePercent: responseRate,
    recentFeedback: feedbackList.slice(0, 20),
  };
}

/** 6. Breakdowns by Channel (with AI deflection rate), Priority, Tag */
export function calculateBreakdowns(events: ReportingEvent[]): {
  channelBreakdown: BreakdownItem[];
  priorityBreakdown: BreakdownItem[];
  tagBreakdown: BreakdownItem[];
} {
  const channelMap = new Map<string, number>();
  const channelBotResolvedMap = new Map<string, number>();
  const channelBotHandoverMap = new Map<string, number>();
  const seenBotResolvedTickets = new Set<string>();
  const priorityMap = new Map<string, number>();
  const tagMap = new Map<string, number>();

  let totalTickets = 0;

  for (const e of events) {
    const ch = e.channel || 'chat';
    if (e.event_type === 'ticket_created') {
      totalTickets += 1;
      channelMap.set(ch, (channelMap.get(ch) || 0) + 1);

      const pr = e.priority || 'normal';
      priorityMap.set(pr, (priorityMap.get(pr) || 0) + 1);

      if (Array.isArray(e.tags)) {
        for (const t of e.tags) {
          if (t && typeof t === 'string') {
            const clean = t.trim().toLowerCase();
            if (clean) tagMap.set(clean, (tagMap.get(clean) || 0) + 1);
          }
        }
      }
    } else if (e.event_type === 'bot_resolved') {
      if (e.ticket_id) {
        if (seenBotResolvedTickets.has(e.ticket_id)) continue;
        seenBotResolvedTickets.add(e.ticket_id);
      }
      channelBotResolvedMap.set(ch, (channelBotResolvedMap.get(ch) || 0) + 1);
    } else if (e.event_type === 'bot_handover') {
      channelBotHandoverMap.set(ch, (channelBotHandoverMap.get(ch) || 0) + 1);
    }
  }

  const toBreakdown = (map: Map<string, number>, includeAi = false): BreakdownItem[] => {
    return Array.from(map.entries())
      .map(([key, count]) => {
        const base: BreakdownItem = {
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
          count,
          percentage: totalTickets > 0 ? Number(((count / totalTickets) * 100).toFixed(1)) : 0,
        };
        if (includeAi) {
          const aiResolvedCount = channelBotResolvedMap.get(key) || 0;
          const handovers = channelBotHandoverMap.get(key) || 0;
          const denom = Math.max(count, aiResolvedCount + handovers);
          base.aiResolvedCount = aiResolvedCount;
          base.aiResolutionPct =
            denom > 0 ? Number(((Math.min(aiResolvedCount, denom) / denom) * 100).toFixed(1)) : 0;
        }
        return base;
      })
      .sort((a, b) => b.count - a.count);
  };

  return {
    channelBreakdown: toBreakdown(channelMap, true),
    priorityBreakdown: toBreakdown(priorityMap),
    tagBreakdown: toBreakdown(tagMap).slice(0, 10),
  };
}

/** 7. Busiest hours heatmap (7 days of week × 24 hours) */
export function calculateBusiestHoursHeatmap(events: ReportingEvent[]): {
  heatmap: HeatmapCell[];
  peakHour: { dayName: string; hour: number; label: string; count: number } | null;
} {
  // Matrix grid 7 x 24
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const e of events) {
    if (e.event_type === 'ticket_created') {
      const d = new Date(e.occurred_at);
      const day = d.getUTCDay(); // 0..6
      const hour = d.getUTCHours(); // 0..23
      if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
        grid[day][hour] += 1;
      }
    }
  }

  const cells: HeatmapCell[] = [];
  let maxCount = -1;
  let peak: { dayName: string; hour: number; label: string; count: number } | null = null;

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = grid[day][hour];
      cells.push({
        dayOfWeek: day,
        dayName: DAY_NAMES[day],
        hour,
        count,
      });

      if (count > maxCount && count > 0) {
        maxCount = count;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        peak = {
          dayName: DAY_NAMES[day],
          hour,
          label: `${DAY_NAMES[day]} at ${displayHour}:00 ${ampm}`,
          count,
        };
      }
    }
  }

  return { heatmap: cells, peakHour: peak };
}

/** 8. AI Bot Resolved vs Handed to Human */
export function calculateBotMetrics(events: ReportingEvent[]): {
  botResolvedCount: number;
  botHandoverCount: number;
  totalBotInquiries: number;
  botResolutionRatePercent: number | null;
} {
  let resolved = 0;
  let handedOver = 0;

  for (const e of events) {
    if (e.event_type === 'bot_resolved') resolved += 1;
    else if (e.event_type === 'bot_handover') handedOver += 1;
  }

  const total = resolved + handedOver;
  const rate = total > 0 ? Number(((resolved / total) * 100).toFixed(1)) : null;

  return {
    botResolvedCount: resolved,
    botHandoverCount: handedOver,
    totalBotInquiries: total,
    botResolutionRatePercent: rate,
  };
}

/** 9. Agent Leaderboard */
export function calculateAgentLeaderboard(
  events: ReportingEvent[],
  agents: Array<{ id: string; name: string; email: string; role: string; avatar_url?: string | null }>
): AgentLeaderboardRow[] {
  const map = new Map<
    string,
    {
      solvedCount: number;
      frtList: number[];
      resList: number[];
      good: number;
      bad: number;
    }
  >();

  for (const a of agents) {
    map.set(a.id, {
      solvedCount: 0,
      frtList: [],
      resList: [],
      good: 0,
      bad: 0,
    });
  }

  for (const e of events) {
    if (!e.agent_id || !map.has(e.agent_id)) continue;
    const item = map.get(e.agent_id)!;

    if (e.event_type === 'ticket_solved') {
      item.solvedCount += 1;
      if (typeof e.duration_seconds === 'number') {
        item.resList.push(e.duration_seconds);
      }
    } else if (e.event_type === 'first_reply') {
      if (typeof e.duration_seconds === 'number') {
        item.frtList.push(e.duration_seconds);
      }
    } else if (e.event_type === 'csat_rated') {
      if (e.csat_rating === 'good') item.good += 1;
      else if (e.csat_rating === 'bad') item.bad += 1;
    }
  }

  return agents
    .map((a) => {
      const stats = map.get(a.id)!;
      const totalCsat = stats.good + stats.bad;
      const csatPercent = totalCsat > 0 ? Number(((stats.good / totalCsat) * 100).toFixed(1)) : null;

      return {
        agentId: a.id,
        name: a.name || 'Unnamed Agent',
        email: a.email,
        role: a.role,
        avatarUrl: a.avatar_url,
        solvedCount: stats.solvedCount,
        avgFrtSeconds: calculateAverage(stats.frtList),
        medianFrtSeconds: calculateMedian(stats.frtList),
        avgResolutionSeconds: calculateAverage(stats.resList),
        medianResolutionSeconds: calculateMedian(stats.resList),
        csatGood: stats.good,
        csatBad: stats.bad,
        totalCsat,
        csatPercent,
      };
    })
    .sort((a, b) => b.solvedCount - a.solvedCount);
}

export function calculateWorkspaceRoi(
  aiResolvedCount: number,
  options?: { avgHandleMinutes?: number; hourlyRateUsd?: number },
): WorkspaceAiRoi {
  const cleanResolved = Number.isFinite(aiResolvedCount) ? Math.max(0, Math.round(aiResolvedCount)) : 0;
  const avgHandleMinutes =
    typeof options?.avgHandleMinutes === 'number' &&
    Number.isFinite(options.avgHandleMinutes) &&
    options.avgHandleMinutes > 0
      ? Number(options.avgHandleMinutes.toFixed(1))
      : 10;
  const hourlyRateUsd =
    typeof options?.hourlyRateUsd === 'number' &&
    Number.isFinite(options.hourlyRateUsd) &&
    options.hourlyRateUsd > 0
      ? Math.round(options.hourlyRateUsd)
      : 28;
  const hoursSaved = Number(((cleanResolved * avgHandleMinutes) / 60).toFixed(1));
  const costSavedUsd = Math.round(((cleanResolved * avgHandleMinutes) / 60) * hourlyRateUsd);
  return {
    aiResolvedCount: cleanResolved,
    avgHandleMinutes,
    hourlyRateUsd,
    hoursSaved,
    costSavedUsd,
  };
}

/** Master calculation function */
export function calculateReportsDashboard(
  events: ReportingEvent[],
  slaEvents: SlaEventItem[],
  agents: Array<{ id: string; name: string; email: string; role: string; avatar_url?: string | null }>,
  initialBacklog: number,
  startDate: Date,
  endDate: Date,
  filters: MetricFilterOptions = {}
): ReportsDashboardData {
  const filteredEvents = filterReportingEvents(events, filters);
  const filteredSla = filterSlaEvents(slaEvents, filters);
  const granularity: 'day' | 'hour' = filters.granularity === 'hour' ? 'hour' : 'day';
  const timeZone = normalizeTimeZone(filters.timeZone);
  const buckets =
    granularity === 'hour'
      ? generateHourBuckets(endDate, timeZone, 24)
      : generateDateBuckets(startDate, endDate, timeZone);

  const createdVsSolved = calculateCreatedVsSolved(filteredEvents, buckets, { granularity, timeZone });
  const backlogOverTime = calculateBacklogOverTime(initialBacklog, filteredEvents, buckets, { granularity, timeZone });
  const responseTimes = calculateResponseTimes(filteredEvents);
  const slaAchievement = calculateSlaAchievement(filteredSla);

  let totalCreated = 0;
  let totalSolved = 0;
  for (const e of filteredEvents) {
    if (e.event_type === 'ticket_created') totalCreated += 1;
    else if (e.event_type === 'ticket_solved') totalSolved += 1;
  }

  const csat = calculateCsatMetrics(filteredEvents, totalSolved);
  const breakdowns = calculateBreakdowns(filteredEvents);
  const heatmapResult = calculateBusiestHoursHeatmap(filteredEvents);
  const botMetrics = calculateBotMetrics(filteredEvents);
  const leaderboard = calculateAgentLeaderboard(filteredEvents, agents);

  const finalBacklog = backlogOverTime.length > 0 ? backlogOverTime[backlogOverTime.length - 1].backlog : initialBacklog;

  const summary: ReportsSummary = {
    totalCreated,
    totalSolved,
    resolutionRatePercent: totalCreated > 0 ? Number(((totalSolved / totalCreated) * 100).toFixed(1)) : null,
    initialBacklog,
    finalBacklog,
    netBacklogChange: finalBacklog - initialBacklog,
    avgFrtSeconds: responseTimes.avgFrtSeconds,
    medianFrtSeconds: responseTimes.medianFrtSeconds,
    avgResolutionSeconds: responseTimes.avgResolutionSeconds,
    medianResolutionSeconds: responseTimes.medianResolutionSeconds,
    totalSlaMet: slaAchievement.totalMet,
    totalSlaBreached: slaAchievement.totalBreached,
    overallSlaPercent: slaAchievement.overallPercent,
    firstReplySlaPercent: slaAchievement.firstReplyPercent,
    nextReplySlaPercent: slaAchievement.nextReplyPercent,
    resolutionSlaPercent: slaAchievement.resolutionPercent,
    totalCsatRatings: csat.totalRatings,
    goodCsatRatings: csat.goodRatings,
    badCsatRatings: csat.badRatings,
    csatPercent: csat.csatPercent,
    csatResponseRatePercent: csat.responseRatePercent,
    botResolvedCount: botMetrics.botResolvedCount,
    botHandoverCount: botMetrics.botHandoverCount,
    totalBotInquiries: botMetrics.totalBotInquiries,
    botResolutionRatePercent: botMetrics.botResolutionRatePercent,
  };

  return {
    summary,
    createdVsSolved,
    backlogOverTime,
    channelBreakdown: breakdowns.channelBreakdown,
    priorityBreakdown: breakdowns.priorityBreakdown,
    tagBreakdown: breakdowns.tagBreakdown,
    heatmap: heatmapResult.heatmap,
    peakHour: heatmapResult.peakHour,
    leaderboard,
    recentFeedback: csat.recentFeedback,
    granularity,
    timeZone,
  };
}

/* ── CSV Export Generators ────────────────────────────────────────────── */

export function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCreatedVsSolvedCsv(
  data: Array<
    Pick<CreatedVsSolvedPoint, 'date' | 'created' | 'solved'> &
      Partial<Pick<CreatedVsSolvedPoint, 'label' | 'aiResolved' | 'humanResolved' | 'stillOpen'>>
  >,
): string {
  const headers = ['Date', 'Tickets Created', 'Tickets Solved', 'AI Resolved', 'Human Resolved', 'Still Open'];
  const rows = data.map((pt) =>
    [
      escapeCsv(pt.date),
      escapeCsv(pt.created),
      escapeCsv(pt.solved),
      escapeCsv(pt.aiResolved ?? 0),
      escapeCsv(pt.humanResolved ?? Math.max(0, pt.solved - (pt.aiResolved ?? 0))),
      escapeCsv(pt.stillOpen ?? Math.max(0, pt.created - pt.solved)),
    ].join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

export function exportBacklogCsv(data: BacklogPoint[]): string {
  const headers = ['Date', 'Active Backlog'];
  const rows = data.map((pt) => [escapeCsv(pt.date), escapeCsv(pt.backlog)].join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function exportAgentLeaderboardCsv(data: AgentLeaderboardRow[]): string {
  const headers = [
    'Agent Name',
    'Email',
    'Role',
    'Solved Tickets',
    'Avg First Reply Time',
    'Median First Reply Time',
    'Avg Resolution Time',
    'Median Resolution Time',
    'Good CSAT',
    'Bad CSAT',
    'Total Ratings',
    'CSAT %',
  ];
  const rows = data.map((r) =>
    [
      escapeCsv(r.name),
      escapeCsv(r.email),
      escapeCsv(r.role),
      escapeCsv(r.solvedCount),
      escapeCsv(formatDuration(r.avgFrtSeconds)),
      escapeCsv(formatDuration(r.medianFrtSeconds)),
      escapeCsv(formatDuration(r.avgResolutionSeconds)),
      escapeCsv(formatDuration(r.medianResolutionSeconds)),
      escapeCsv(r.csatGood),
      escapeCsv(r.csatBad),
      escapeCsv(r.totalCsat),
      escapeCsv(r.csatPercent !== null ? `${r.csatPercent}%` : '—'),
    ].join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export function exportBreakdownsCsv(
  channels: BreakdownItem[],
  priorities: BreakdownItem[],
  tags: BreakdownItem[]
): string {
  const lines = ['Dimension,Key,Count,Percentage'];
  for (const c of channels) {
    lines.push(`Channel,${escapeCsv(c.label)},${escapeCsv(c.count)},${escapeCsv(c.percentage)}%`);
  }
  for (const p of priorities) {
    lines.push(`Priority,${escapeCsv(p.label)},${escapeCsv(p.count)},${escapeCsv(p.percentage)}%`);
  }
  for (const t of tags) {
    lines.push(`Tag,${escapeCsv(t.label)},${escapeCsv(t.count)},${escapeCsv(t.percentage)}%`);
  }
  return lines.join('\n');
}

export function exportHeatmapCsv(heatmap: HeatmapCell[]): string {
  const headers = ['Day of Week', 'Hour of Day (UTC)', 'Tickets Created'];
  const rows = heatmap.map((c) => [escapeCsv(c.dayName), escapeCsv(c.hour), escapeCsv(c.count)].join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function exportSummaryOverviewCsv(summary: ReportsSummary): string {
  const rows = [
    ['Metric', 'Value'],
    ['Tickets Created', summary.totalCreated],
    ['Tickets Solved', summary.totalSolved],
    ['Resolution Rate %', summary.resolutionRatePercent !== null ? `${summary.resolutionRatePercent}%` : '—'],
    ['Initial Backlog', summary.initialBacklog],
    ['Final Backlog', summary.finalBacklog],
    ['Net Backlog Change', summary.netBacklogChange],
    ['Avg First Reply Time', formatDuration(summary.avgFrtSeconds)],
    ['Median First Reply Time', formatDuration(summary.medianFrtSeconds)],
    ['Avg Resolution Time', formatDuration(summary.avgResolutionSeconds)],
    ['Median Resolution Time', formatDuration(summary.medianResolutionSeconds)],
    ['SLA Achievement %', summary.overallSlaPercent !== null ? `${summary.overallSlaPercent}%` : '—'],
    ['First Reply SLA %', summary.firstReplySlaPercent !== null ? `${summary.firstReplySlaPercent}%` : '—'],
    ['Resolution SLA %', summary.resolutionSlaPercent !== null ? `${summary.resolutionSlaPercent}%` : '—'],
    ['CSAT Satisfaction %', summary.csatPercent !== null ? `${summary.csatPercent}%` : '—'],
    ['Total CSAT Ratings', summary.totalCsatRatings],
    ['Good CSAT Ratings', summary.goodCsatRatings],
    ['Bad CSAT Ratings', summary.badCsatRatings],
    ['CSAT Response Rate %', summary.csatResponseRatePercent !== null ? `${summary.csatResponseRatePercent}%` : '—'],
    ['Bot Resolved Count', summary.botResolvedCount],
    ['Bot Handed to Human Count', summary.botHandoverCount],
    ['Bot Resolution %', summary.botResolutionRatePercent !== null ? `${summary.botResolutionRatePercent}%` : '—'],
  ];
  return rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
}
