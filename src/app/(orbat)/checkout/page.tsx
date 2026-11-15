import { CheckoutScreen } from '@/components/orbat/billing/CheckoutScreen';
import { OrbToastProvider } from '@/components/orbat/primitives';
import { ShellSessionProvider } from '@/components/orbat/shell/session-context';
import { requireShellSession } from '@/lib/data/session';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string; billing?: string; mode?: string }>;
}) {
  const session = await requireShellSession('/checkout');
  const sp = (await searchParams) ?? {};
  const initialBillingPeriod =
    sp.billing === 'yearly' ? 'yearly' : sp.billing === 'monthly' ? 'monthly' : undefined;

  return (
    <OrbToastProvider>
      <ShellSessionProvider session={session}>
        <CheckoutScreen
          initialPlanSlug={sp.plan}
          initialBillingPeriod={initialBillingPeriod}
        />
      </ShellSessionProvider>
    </OrbToastProvider>
  );
}
