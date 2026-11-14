import { describe, expect, it } from 'vitest';
import {
  computeBarPercent,
  computeOpenStatus,
  defaultWeeklySchedule,
  fromBusinessHoursConfig,
  getWeekDates,
  toBusinessHoursConfig,
} from './hours';

describe('schedule hours helper', () => {
  it('round-trips weekly office hours with BusinessHoursConfig format', () => {
    const weekly = defaultWeeklySchedule();
    weekly[5] = { ...weekly[5], enabled: true, open: '10:00', close: '14:00' };
    const cfg = toBusinessHoursConfig({
      enabled: true,
      timezone: 'Europe/Berlin',
      weekly,
    });

    expect(cfg.enabled).toBe(true);
    expect(cfg.timezone).toBe('Europe/Berlin');
    expect(cfg.schedule?.saturday).toMatchObject({ start: '10:00', end: '14:00' });

    const parsed = fromBusinessHoursConfig(cfg);
    expect(parsed.enabled).toBe(true);
    expect(parsed.timezone).toBe('Europe/Berlin');
    expect(parsed.weekly[5]).toMatchObject({ day: 'sat', enabled: true, open: '10:00', close: '14:00' });
  });

  it('computes open/closed status respecting holidays and local timezone', () => {
    const weekly = defaultWeeklySchedule();
    // Monday 2026-11-09 10:30 UTC
    const monMorning = new Date('2026-11-09T10:30:00Z');
    const open = computeOpenStatus({
      enabled: true,
      timezone: 'UTC',
      weekly,
      holidays: [],
      now: monMorning,
    });
    expect(open.isOpen).toBe(true);
    expect(open.reason).toBe('open');
    expect(open.activeDayKey).toBe('mon');

    const holiday = computeOpenStatus({
      enabled: true,
      timezone: 'UTC',
      weekly,
      holidays: [
        {
          id: 'h1',
          name: 'Founders Day',
          starts_on: '2026-11-09',
          ends_on: '2026-11-09',
          repeats_yearly: false,
        },
      ],
      now: monMorning,
    });
    expect(holiday.isOpen).toBe(false);
    expect(holiday.reason).toBe('holiday');
    expect(holiday.holidayName).toBe('Founders Day');

    const disabled = computeOpenStatus({
      enabled: false,
      timezone: 'UTC',
      weekly,
      holidays: [],
      now: new Date('2026-11-08T03:00:00Z'),
    });
    expect(disabled.isOpen).toBe(true);
    expect(disabled.reason).toBe('disabled_24_7');
  });

  it('builds a 7-day Monday-start week matrix and computes 24h bar positions', () => {
    const cells = getWeekDates(0, 'UTC', new Date('2026-11-11T12:00:00Z'));
    expect(cells).toHaveLength(7);
    expect(cells[0].isoDate).toBe('2026-11-09');
    expect(cells[0].dayShort).toBe('Mon');
    expect(cells[2].isToday).toBe(true);
    expect(cells[6].isoDate).toBe('2026-11-15');

    const bar = computeBarPercent('09:00', '18:00');
    expect(bar.leftPct).toBeCloseTo(37.5, 1);
    expect(bar.widthPct).toBeCloseTo(37.5, 1);
  });
});
