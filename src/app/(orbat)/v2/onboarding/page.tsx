import { OnboardingWizardScreen } from '@/components/orbat/onboarding/OnboardingWizardScreen';

export default async function OnboardingV2Page({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const sp = await searchParams;
  return <OnboardingWizardScreen initialPlanSlug={sp.plan || null} />;
}
