import type { Metadata } from 'next';
import { OnboardingWizardScreen } from '@/components/orbat/onboarding/OnboardingWizardScreen';

export const metadata: Metadata = {
  title: 'Set up workspace · ORBAT AI',
  description: 'Configure your AI support agent, compliance baselines, and customer channels in minutes.',
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const sp = await searchParams;
  const plan = Array.isArray(sp.plan) ? sp.plan[0] : sp.plan;
  return <OnboardingWizardScreen initialPlanSlug={plan || null} />;
}
