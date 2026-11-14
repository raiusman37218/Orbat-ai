import type { Metadata } from 'next';
import { PoliciesScreen } from '@/components/orbat/compliance/PoliciesScreen';

export const metadata: Metadata = {
  title: 'Policy to Guardrails · ORBAT AI',
};

export default function PoliciesPage() {
  return <PoliciesScreen />;
}
