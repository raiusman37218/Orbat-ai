import {
  getGettingStartedBundleAction,
  publishPrimaryAgentFromOnboardingAction,
  toggleGettingStartedStepAction,
  type GettingStartedBundle,
  type GettingStartedStepItem,
} from '@/app/actions/lifecycle-studio';
import type { GettingStartedStepKey } from '@/lib/lifecycle/onboarding-catalog';

export type { GettingStartedBundle, GettingStartedStepItem, GettingStartedStepKey };

export async function loadGettingStarted(workspaceId: string): Promise<GettingStartedBundle> {
  const res = await getGettingStartedBundleAction(workspaceId);
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function setGettingStartedStep(
  workspaceId: string,
  stepKey: GettingStartedStepKey,
  completed: boolean,
) {
  const res = await toggleGettingStartedStepAction(workspaceId, stepKey, completed);
  if (!res.success) throw new Error(res.error || 'Could not update step.');
  return res;
}

export async function publishGettingStartedAgent(
  workspaceId: string,
  nextStatus: 'live' | 'draft',
) {
  const res = await publishPrimaryAgentFromOnboardingAction(workspaceId, nextStatus);
  if (!res.success) throw new Error(res.error || 'Could not update AI agent status.');
  return res;
}
