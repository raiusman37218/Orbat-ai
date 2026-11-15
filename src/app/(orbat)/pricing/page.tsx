import type { Metadata } from 'next';
import { PricingScreen } from '@/components/orbat/public/PricingScreen';

export const metadata: Metadata = {
  title: 'Pricing · ORBAT AI',
  description: 'Transparent AI customer support plans and pay-as-you-go rates with zero seat fees.',
};

export default function PricingPage() {
  return <PricingScreen />;
}
