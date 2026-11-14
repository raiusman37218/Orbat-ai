'use client';

import {
  assignOnCallShiftAction,
  getScheduleAction,
  saveScheduleAction,
  type AfterHoursRules,
  type AvailabilityThresholds,
  type OnCallShiftRow,
  type ScheduleBootstrap,
} from '@/app/actions/schedule';
import { deleteHolidayAction, saveHolidayAction } from '@/app/actions/sla';
import type { HolidayItem, WeeklyDaySlot } from '@/lib/schedule/hours';
import type { HolidayInput } from '@/lib/sla/policy';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

// TODO(backend): Connect external SMS / PSTN ring provider (Twilio / voice gateway) to page on-call shift assignees outside office hours when wakeOnCallForUrgent triggers.

export type {
  AfterHoursRules,
  AvailabilityThresholds,
  HolidayInput,
  HolidayItem,
  OnCallShiftRow,
  ScheduleBootstrap,
  WeeklyDaySlot,
};

export function getSchedule(workspaceId: string, weekOffset = 0) {
  return getScheduleAction(workspaceId, weekOffset);
}

export function saveSchedule(
  workspaceId: string,
  input: Parameters<typeof saveScheduleAction>[1],
) {
  return saveScheduleAction(workspaceId, input);
}

export function saveHoliday(workspaceId: string, input: HolidayInput) {
  return saveHolidayAction(workspaceId, input);
}

export function deleteHoliday(workspaceId: string, holidayId: string) {
  return deleteHolidayAction(workspaceId, holidayId);
}

export function assignOnCallShift(
  workspaceId: string,
  input: Parameters<typeof assignOnCallShiftAction>[1],
) {
  return assignOnCallShiftAction(workspaceId, input);
}

export function useScheduleLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
) {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 60_000,
    onRefresh,
  });
}
