'use client';

import {
  createCampaignAction,
  createProactiveMessageAction,
  deleteCampaignAction,
  deleteProactiveMessageAction,
  getEngagementBootstrapAction,
  recordSurveyResponseAction,
  updateCampaignAction,
  updateProactiveMessageAction,
  type CampaignChannel,
  type CampaignRecord,
  type CampaignStatus,
  type EngagementBootstrap,
  type ProactiveMessageRecord,
  type SurveyResponseRecord,
} from '@/app/actions/engagement';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

export type {
  CampaignChannel,
  CampaignRecord,
  CampaignStatus,
  EngagementBootstrap,
  ProactiveMessageRecord,
  SurveyResponseRecord,
};

// TODO(backend): Proactive chat triggers (`GET /api/v1/widget/config` &
// `POST /api/v1/widget/proactive/:id/event`) and CSAT ratings (`/api/csat/rate`
// + NestJS `widget/csat`) persist live. Automated bulk Email/WhatsApp broadcast
// dispatch and scheduled recurring NPS survey mailer jobs await external
// messaging queue fan-out workers.

export function getEngagementBootstrap(workspaceId: string) {
  return getEngagementBootstrapAction(workspaceId);
}

export function createCampaign(
  workspaceId: string,
  input: Parameters<typeof createCampaignAction>[1],
) {
  return createCampaignAction(workspaceId, input);
}

export function updateCampaign(
  workspaceId: string,
  input: Parameters<typeof updateCampaignAction>[1],
) {
  return updateCampaignAction(workspaceId, input);
}

export function deleteCampaign(workspaceId: string, campaignId: string) {
  return deleteCampaignAction(workspaceId, campaignId);
}

export function createProactiveMessage(
  workspaceId: string,
  input: Parameters<typeof createProactiveMessageAction>[1],
) {
  return createProactiveMessageAction(workspaceId, input);
}

export function updateProactiveMessage(
  workspaceId: string,
  input: Parameters<typeof updateProactiveMessageAction>[1],
) {
  return updateProactiveMessageAction(workspaceId, input);
}

export function deleteProactiveMessage(workspaceId: string, messageId: string) {
  return deleteProactiveMessageAction(workspaceId, messageId);
}

export function recordSurveyResponse(
  workspaceId: string,
  input: Parameters<typeof recordSurveyResponseAction>[1],
) {
  return recordSurveyResponseAction(workspaceId, input);
}

export function useEngagementLiveSync(
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
