'use client';

import {
  addVoiceCallTurnAction,
  createVoiceCampaignAction,
  createVoiceTicketAction,
  endVoiceCallAction,
  getVoiceBootstrapAction,
  getVoiceCallDetailAction,
  handBackVoiceCallToAiAction,
  logVoiceCallAction,
  rotateVoiceWebhookSecretAction,
  takeOverVoiceCallAction,
  toggleVoiceListenAction,
  updateVoiceCampaignStatusAction,
  updateVoiceSettingsAction,
  type VoiceAfterHoursMode,
  type VoiceBootstrap,
  type VoiceCallRecord,
  type VoiceCallStatus,
  type VoiceCallTurnRecord,
  type VoiceCampaignRecord,
  type VoiceCampaignStatus,
  type VoiceKpis,
  type VoiceProvider,
  type VoiceSettingsRecord,
} from '@/app/actions/voice';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

export type {
  VoiceAfterHoursMode,
  VoiceBootstrap,
  VoiceCallRecord,
  VoiceCallStatus,
  VoiceCallTurnRecord,
  VoiceCampaignRecord,
  VoiceCampaignStatus,
  VoiceKpis,
  VoiceProvider,
  VoiceSettingsRecord,
};

export type VoiceCallFilter = 'all' | 'live' | 'ai' | 'transferred';

export function formatDurationSeconds(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// TODO(backend): Provision live telephony media/SIP carrier credentials ([TO BE CHOSEN]) and browser WebRTC audio transport.
export async function getVoiceBootstrap(
  workspaceId: string,
  filter: VoiceCallFilter = 'all',
  q?: string,
) {
  return getVoiceBootstrapAction(workspaceId, filter, q);
}

export async function getVoiceCallDetail(workspaceId: string, callId: string) {
  return getVoiceCallDetailAction(workspaceId, callId);
}

export async function setVoiceListening(workspaceId: string, callId: string, listening: boolean) {
  return toggleVoiceListenAction(workspaceId, callId, listening);
}

export async function takeOverVoiceCall(workspaceId: string, callId: string) {
  return takeOverVoiceCallAction(workspaceId, callId);
}

export async function handBackVoiceCallToAi(workspaceId: string, callId: string) {
  return handBackVoiceCallToAiAction(workspaceId, callId);
}

export async function endVoiceCall(
  workspaceId: string,
  callId: string,
  outcome?: Exclude<VoiceCallStatus, 'live'>,
) {
  return endVoiceCallAction(workspaceId, callId, outcome);
}

export async function addVoiceTurn(
  workspaceId: string,
  callId: string,
  input: { speaker?: 'caller' | 'ai' | 'agent' | 'system'; transcript: string; translatedText?: string },
) {
  return addVoiceCallTurnAction(workspaceId, callId, input);
}

export async function createTicketFromVoiceCall(workspaceId: string, callId: string) {
  return createVoiceTicketAction(workspaceId, callId);
}

export async function updateVoiceSettings(
  workspaceId: string,
  patch: Parameters<typeof updateVoiceSettingsAction>[1],
) {
  return updateVoiceSettingsAction(workspaceId, patch);
}

export async function rotateVoiceWebhookSecret(workspaceId: string) {
  return rotateVoiceWebhookSecretAction(workspaceId);
}

export async function createVoiceCampaign(
  workspaceId: string,
  input: Parameters<typeof createVoiceCampaignAction>[1],
) {
  return createVoiceCampaignAction(workspaceId, input);
}

export async function updateVoiceCampaignStatus(
  workspaceId: string,
  campaignId: string,
  status: VoiceCampaignStatus,
) {
  return updateVoiceCampaignStatusAction(workspaceId, campaignId, status);
}

export async function logVoiceCall(
  workspaceId: string,
  input: Parameters<typeof logVoiceCallAction>[1],
) {
  return logVoiceCallAction(workspaceId, input);
}

export function useVoiceLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  hasLiveCall: boolean,
  enabled = true,
): void {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: hasLiveCall ? 3500 : 10_000,
    onRefresh,
  });
}
