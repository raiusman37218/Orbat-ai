/* Number and delta formatting for the overview cards. */

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

export interface Delta {
  text: string;
  tone: 'ok' | 'bad' | 'neutral';
}

/* Percent change vs the previous period. `lowerIsBetter` flips the colour
   (response times). Null when there is nothing to compare against. */
export function pctDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  { lowerIsBetter = false }: { lowerIsBetter?: boolean } = {},
): Delta | null {
  if (current == null || previous == null || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  if (!Number.isFinite(change)) return null;
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return { text: '0%', tone: 'neutral' };
  const better = lowerIsBetter ? rounded < 0 : rounded > 0;
  return { text: `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}%`, tone: better ? 'ok' : 'bad' };
}

/* Difference in percentage points (rates such as CSAT). */
export function ptsDelta(current: number | null | undefined, previous: number | null | undefined): Delta | null {
  if (current == null || previous == null) return null;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { text: '0 pts', tone: 'neutral' };
  return { text: `${diff > 0 ? '+' : '−'}${Math.abs(diff)} pts`, tone: diff > 0 ? 'ok' : 'bad' };
}

export function timeAgo(iso: string, now = Date.now()): string {
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* A round axis top so gridlines land on tidy numbers. */
export function niceCeil(max: number): number {
  if (max <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 1.5, 2, 3, 4, 5, 6, 8, 10]) {
    if (step * pow >= max) return step * pow;
  }
  return 10 * pow;
}
