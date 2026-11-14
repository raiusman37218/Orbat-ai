import { CheckoutScreen } from '@/components/orbat/billing/CheckoutScreen';
import { OrbToastProvider } from '@/components/orbat/primitives';
import { ShellSessionProvider } from '@/components/orbat/shell/session-context';
import { requireShellSession } from '@/lib/data/session';

export default async function CheckoutPage() {
  const session = await requireShellSession('/checkout');
  return (
    <OrbToastProvider>
      <ShellSessionProvider session={session}>
        <CheckoutScreen />
      </ShellSessionProvider>
    </OrbToastProvider>
  );
}
