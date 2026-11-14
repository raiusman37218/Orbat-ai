import {
  completeOnboardingWizardAction,
  getOnboardingDraftAction,
  type OnboardingDraftBundle,
  type OnboardingWizardPayload,
} from '@/app/actions/lifecycle-studio';

export type { OnboardingDraftBundle, OnboardingWizardPayload };

export async function loadOnboardingDraft(): Promise<OnboardingDraftBundle> {
  const res = await getOnboardingDraftAction();
  if (!res.success) throw new Error(res.error);
  return res.data;
}

// TODO(backend): OAuth connector provisioning for Shopify, HubSpot, Salesforce and Slack happens in Channels / Connect CRM after onboarding finishes when external provider client secrets are configured.
export async function completeOnboardingWizard(payload: OnboardingWizardPayload) {
  const res = await completeOnboardingWizardAction(payload);
  if (!res.success) throw new Error(res.error || 'Could not complete onboarding setup.');
  return res;
}
