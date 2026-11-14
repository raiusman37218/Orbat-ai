import type { Metadata } from 'next';
import { AutomationScreen } from '@/components/orbat/automation/AutomationScreen';

export const metadata: Metadata = {
  title: 'Automation Studio · ORBAT AI',
};

export default function AutomationPage() {
  return <AutomationScreen />;
}
