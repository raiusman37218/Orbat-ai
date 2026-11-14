'use client';

import {
  advanceJourneyEnrollmentAction,
  createJourneyAction,
  deleteJourneyAction,
  enrollInJourneyAction,
  getJourneysBootstrapAction,
  saveJourneyStagesAction,
  suggestJourneyStepCopyAction,
  toggleJourneyStatusAction,
  type AvailableVisitorSummary,
  type EnrollmentStatus,
  type JourneyEnrollmentRecord,
  type JourneyRecord,
  type JourneyStage,
  type JourneyStatus,
  type JourneyStep,
  type JourneyStepKind,
  type JourneysBootstrap,
  type StageFunnelRow,
} from '@/app/actions/journeys';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

export type {
  AvailableVisitorSummary,
  EnrollmentStatus,
  JourneyEnrollmentRecord,
  JourneyRecord,
  JourneyStage,
  JourneyStatus,
  JourneyStep,
  JourneyStepKind,
  JourneysBootstrap,
  StageFunnelRow,
};

// TODO(backend): Customer Journeys persists lifecycle stages, step copy,
// real visitor enrollments, and funnel conversion metrics in Postgres.
// Automatic timed delay progression (`Wait 48 hours`) and autonomous outbound
// Email/WhatsApp step execution await scheduled queue cron + provider dispatchers.

export function getJourneysBootstrap(
  workspaceId: string,
  selectedJourneyId?: string | null,
) {
  return getJourneysBootstrapAction(workspaceId, selectedJourneyId);
}

export function createJourney(
  workspaceId: string,
  input: Parameters<typeof createJourneyAction>[1],
) {
  return createJourneyAction(workspaceId, input);
}

export function saveJourneyStages(
  workspaceId: string,
  input: Parameters<typeof saveJourneyStagesAction>[1],
) {
  return saveJourneyStagesAction(workspaceId, input);
}

export function toggleJourneyStatus(
  workspaceId: string,
  journeyId: string,
  status: JourneyStatus,
) {
  return toggleJourneyStatusAction(workspaceId, journeyId, status);
}

export function deleteJourney(workspaceId: string, journeyId: string) {
  return deleteJourneyAction(workspaceId, journeyId);
}

export function enrollInJourney(
  workspaceId: string,
  input: Parameters<typeof enrollInJourneyAction>[1],
) {
  return enrollInJourneyAction(workspaceId, input);
}

export function advanceJourneyEnrollment(
  workspaceId: string,
  input: Parameters<typeof advanceJourneyEnrollmentAction>[1],
) {
  return advanceJourneyEnrollmentAction(workspaceId, input);
}

export function suggestJourneyStepCopy(
  workspaceId: string,
  input: Parameters<typeof suggestJourneyStepCopyAction>[1],
) {
  return suggestJourneyStepCopyAction(workspaceId, input);
}

export function useJourneysLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
) {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 20_000,
    onRefresh,
  });
}
