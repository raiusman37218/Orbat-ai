import type { BusinessHoursConfig, BusinessHoursScheduleDay } from '@/types/database';

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_META: Record<DayKey, { label: string; short: string; longKey: keyof NonNullable<BusinessHoursConfig['schedule']> }> = {
  mon: { label: 'Monday', short: 'Mon', longKey: 'monday' },
  tue: { label: 'Tuesday', short: 'Tue', longKey: 'tuesday' },
  wed: { label: 'Wednesday', short: 'Wed', longKey: 'wednesday' },
  thu: { label: 'Thursday', short: 'Thu', longKey: 'thursday' },
  fri: { label: 'Friday', short: 'Fri', longKey: 'friday' },
  sat: { label: 'Saturday', short: 'Sat', longKey: 'saturday' },
  sun: { label: 'Sunday', short: 'Sun', longKey: 'sunday' },
};

export interface WeeklyDaySlot {
  day: DayKey;
  label: string;
  short: string;
  enabled: boolean;
  open: string;
  close: string;
}

export interface HolidayItem {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  repeats_yearly: boolean;
}

export interface OpenStatusSummary {
  isOpen: boolean;
  reason: 'open' | 'outside_hours' | 'holiday' | 'disabled_24_7';
  holidayName: string | null;
  localTimeLabel: string;
  localDateIso: string;
  activeDayKey: DayKey;
}

const VALID_HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeTimeHHMM(val: unknown, fallback: string): string {
  const s = typeof val === 'string' ? val.trim() : '';
  return VALID_HHMM.test(s) ? s : fallback;
}

export function timeToMinutes(hhmm: string): number {
  const m = VALID_HHMM.exec(hhmm);
  if (!m) return 9 * 60;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function defaultWeeklySchedule(): WeeklyDaySlot[] {
  return DAY_KEYS.map((day) => ({
    day,
    label: DAY_META[day].label,
    short: DAY_META[day].short,
    enabled: day !== 'sat' && day !== 'sun',
    open: '09:00',
    close: '18:00',
  }));
}

export function fromBusinessHoursConfig(
  raw: BusinessHoursConfig | Record<string, unknown> | null | undefined,
): { enabled: boolean; timezone: string; weekly: WeeklyDaySlot[] } {
  const defaults = defaultWeeklySchedule();
  if (!raw || typeof raw !== 'object') {
    return { enabled: false, timezone: 'UTC', weekly: defaults };
  }
  const obj = raw as Record<string, unknown>;
  const enabled = Boolean(obj.enabled);
  const timezone = typeof obj.timezone === 'string' && obj.timezone.trim() ? obj.timezone.trim() : 'UTC';
  const sched = (obj.schedule && typeof obj.schedule === 'object' ? obj.schedule : obj) as Record<string, unknown>;

  const weekly: WeeklyDaySlot[] = defaults.map((def) => {
    const meta = DAY_META[def.day];
    const candidate = (sched[meta.longKey] ?? sched[def.day]) as
      | (Partial<BusinessHoursScheduleDay> & { active?: boolean; open?: string; close?: string })
      | undefined;
    if (!candidate || typeof candidate !== 'object') return def;
    const dayEnabled =
      typeof candidate.enabled === 'boolean'
        ? candidate.enabled
        : typeof candidate.active === 'boolean'
          ? candidate.active
          : def.enabled;
    return {
      ...def,
      enabled: dayEnabled,
      open: normalizeTimeHHMM(candidate.start ?? candidate.open, def.open),
      close: normalizeTimeHHMM(candidate.end ?? candidate.close, def.close),
    };
  });

  return { enabled, timezone, weekly };
}

export function toBusinessHoursConfig(input: {
  enabled: boolean;
  timezone: string;
  weekly: WeeklyDaySlot[];
}): BusinessHoursConfig {
  const schedule: Record<string, BusinessHoursScheduleDay & { active: boolean }> = {};
  for (const row of input.weekly) {
    const meta = DAY_META[row.day];
    const open = normalizeTimeHHMM(row.open, '09:00');
    const close = normalizeTimeHHMM(row.close, '18:00');
    schedule[meta.longKey] = {
      active: row.enabled,
      enabled: row.enabled,
      start: open,
      end: close,
    };
  }
  return {
    enabled: Boolean(input.enabled),
    timezone: input.timezone || 'UTC',
    schedule: schedule as unknown as BusinessHoursConfig['schedule'],
  };
}

function getLocalParts(now: Date, timeZone: string): {
  weekdayShort: string;
  dateIso: string;
  hhmm: string;
} {
  let parts: Intl.DateTimeFormatPart[];
  let safeTz = timeZone || 'UTC';
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    safeTz = 'UTC';
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
  }

  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value || '';
  const year = get('year') || '2026';
  const month = get('month') || '01';
  const day = get('day') || '01';
  const hour = String(Number(get('hour') || '0') % 24).padStart(2, '0');
  const minute = get('minute').padStart(2, '0');
  const weekdayShort = get('weekday').slice(0, 3).toLowerCase();

  return {
    weekdayShort,
    dateIso: `${year}-${month}-${day}`,
    hhmm: `${hour}:${minute}`,
  };
}

export function isHolidayOnDate(holiday: HolidayItem, dateIso: string): boolean {
  if (!holiday.starts_on || !holiday.ends_on) return false;
  if (!holiday.repeats_yearly) {
    return dateIso >= holiday.starts_on && dateIso <= holiday.ends_on;
  }
  const mmdd = dateIso.slice(5, 10);
  const startMmdd = holiday.starts_on.slice(5, 10);
  const endMmdd = holiday.ends_on.slice(5, 10);
  if (startMmdd <= endMmdd) {
    return mmdd >= startMmdd && mmdd <= endMmdd;
  }
  return mmdd >= startMmdd || mmdd <= endMmdd;
}

export function computeOpenStatus(input: {
  enabled: boolean;
  timezone: string;
  weekly: WeeklyDaySlot[];
  holidays?: HolidayItem[];
  now?: Date;
}): OpenStatusSummary {
  const now = input.now ?? new Date();
  const { weekdayShort, dateIso, hhmm } = getLocalParts(now, input.timezone);
  const activeDayKey: DayKey = (DAY_KEYS.find((k) => k === weekdayShort) ?? 'mon');

  const holiday = (input.holidays || []).find((h) => isHolidayOnDate(h, dateIso));
  if (holiday) {
    return {
      isOpen: false,
      reason: 'holiday',
      holidayName: holiday.name,
      localTimeLabel: `${DAY_META[activeDayKey].short} ${hhmm}`,
      localDateIso: dateIso,
      activeDayKey,
    };
  }

  if (!input.enabled) {
    return {
      isOpen: true,
      reason: 'disabled_24_7',
      holidayName: null,
      localTimeLabel: `${DAY_META[activeDayKey].short} ${hhmm}`,
      localDateIso: dateIso,
      activeDayKey,
    };
  }

  const slot = input.weekly.find((d) => d.day === activeDayKey);
  if (!slot || !slot.enabled) {
    return {
      isOpen: false,
      reason: 'outside_hours',
      holidayName: null,
      localTimeLabel: `${DAY_META[activeDayKey].short} ${hhmm}`,
      localDateIso: dateIso,
      activeDayKey,
    };
  }

  const curMin = timeToMinutes(hhmm);
  const openMin = timeToMinutes(slot.open);
  const closeMin = timeToMinutes(slot.close);
  const isOpen = closeMin > openMin && curMin >= openMin && curMin < closeMin;

  return {
    isOpen,
    reason: isOpen ? 'open' : 'outside_hours',
    holidayName: null,
    localTimeLabel: `${DAY_META[activeDayKey].short} ${hhmm}`,
    localDateIso: dateIso,
    activeDayKey,
  };
}

export interface WeekDateCell {
  isoDate: string;
  dayShort: string;
  dateLabel: string;
  isToday: boolean;
}

export function getWeekDates(weekOffset: number, timeZone: string, now?: Date): WeekDateCell[] {
  const ref = now ?? new Date();
  const { dateIso } = getLocalParts(ref, timeZone);
  const [y, m, d] = dateIso.split('-').map(Number);
  const baseUtc = new Date(Date.UTC(y, m - 1, d));
  const dow = baseUtc.getUTCDay();
  const mondayDelta = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(Date.UTC(y, m - 1, d + mondayDelta + weekOffset * 7));

  const out: WeekDateCell[] = [];
  const shortNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday.getTime() + i * 86_400_000);
    const isoDate = dt.toISOString().slice(0, 10);
    out.push({
      isoDate,
      dayShort: shortNames[i],
      dateLabel: `${monthNames[dt.getUTCMonth()]} ${dt.getUTCDate()}`,
      isToday: isoDate === dateIso,
    });
  }
  return out;
}

export function computeBarPercent(open: string, close: string): { leftPct: number; widthPct: number } {
  const start = timeToMinutes(open);
  const end = timeToMinutes(close);
  if (end <= start) return { leftPct: 0, widthPct: 0 };
  const leftPct = Math.round((start / 1440) * 1000) / 10;
  const widthPct = Math.max(4, Math.round(((end - start) / 1440) * 1000) / 10);
  return { leftPct, widthPct };
}
