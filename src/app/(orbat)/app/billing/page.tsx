import { BillingScreen } from '@/components/orbat/billing/BillingScreen';

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string; billing?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  return (
    <BillingScreen
      selectedPlanSlug={sp.plan}
      selectedBillingPeriod={
        sp.billing === 'yearly' ? 'yearly' : sp.billing === 'monthly' ? 'monthly' : undefined
      }
    />
  );
}
