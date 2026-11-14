import type { Metadata } from 'next';
import { ComplianceScreen } from '@/components/orbat/compliance/ComplianceScreen';

export const metadata: Metadata = {
  title: 'Compliance Center · ORBAT AI',
};

export default function CompliancePage() {
  return <ComplianceScreen />;
}
