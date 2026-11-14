'use client';

import {
  getHandoffConsoleAction,
  runHandoffQueueCommandAction,
  saveHandoffPolicyAction,
  type HandoffAgentPresence,
  type HandoffConsoleBootstrap,
  type LiveHandoffQueueItem,
} from '@/app/actions/handoff';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

// TODO(backend): Add optional automated "AI Team second-attempt escalation" cron job after ring timeout before transitioning stale handoffs to offline_queued.

export type { HandoffAgentPresence, HandoffConsoleBootstrap, LiveHandoffQueueItem };

export function getHandoffConsole(workspaceId: string) {
  return getHandoffConsoleAction(workspaceId);
}

export function saveHandoffPolicy(
  workspaceId: string,
  input: Parameters<typeof saveHandoffPolicyAction>[1],
) {
  return saveHandoffPolicyAction(workspaceId, input);
}

export function runHandoffQueueCommand(
  workspaceId: string,
  conversationId: string,
  command: 'claim' | 'skip' | 'return_to_ai',
) {
  return runHandoffQueueCommandAction(workspaceId, conversationId, command);
}

export function useHandoffLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
) {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 12_000,
    onRefresh,
  });
}
