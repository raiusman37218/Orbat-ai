'use client';

import {
  addAutonomyTopicAction,
  getAiQualityBootstrapAction,
  reviewAnswerCardAction,
  setTopicAutonomyAction,
  toggleTopicLockAction,
  type AiQualityBootstrap,
  type AnswerCardItem,
  type AutonomyLevel,
  type AutonomyPolicyRow,
  type VerificationCheckItem,
} from '@/app/actions/ai-quality';
import { submitAgentReviewVerdictAction } from '@/app/actions/ai-agents';
import { AUTONOMY_LEVEL_DEFS } from '@/lib/ai/agent-templates';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

export type {
  AiQualityBootstrap,
  AnswerCardItem,
  AutonomyLevel,
  AutonomyPolicyRow,
  VerificationCheckItem,
};

export { AUTONOMY_LEVEL_DEFS };

export function getAiQualityBootstrap(
  workspaceId: string,
  agentId?: string | null,
) {
  return getAiQualityBootstrapAction(workspaceId, agentId);
}

export function setTopicAutonomy(
  workspaceId: string,
  input: { agentId: string; topic: string; level: AutonomyLevel; changeNote?: string },
) {
  return setTopicAutonomyAction(workspaceId, input);
}

export function toggleTopicLock(
  workspaceId: string,
  input: { agentId: string; topic: string; locked: boolean; lockReason?: string },
) {
  return toggleTopicLockAction(workspaceId, input);
}

export function addAutonomyTopic(
  workspaceId: string,
  input: { agentId: string; topic: string; level?: AutonomyLevel },
) {
  return addAutonomyTopicAction(workspaceId, input);
}

export function reviewAnswerCard(
  workspaceId: string,
  input: Parameters<typeof reviewAnswerCardAction>[1],
) {
  return reviewAnswerCardAction(workspaceId, input);
}

export function submitQualityReviewVerdict(
  workspaceId: string,
  logId: string,
  verdict: 'correct' | 'wrong',
) {
  return submitAgentReviewVerdictAction(workspaceId, logId, verdict);
}

export function useAiQualityLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
): void {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 15_000,
    onRefresh,
  });
}
