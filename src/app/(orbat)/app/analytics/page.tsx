import type { Metadata } from 'next';
import { AnalyticsScreen } from '@/components/orbat/analytics/AnalyticsScreen';

export const metadata: Metadata = {
  title: 'Analytics & Reports · ORBAT AI',
};

export default function AnalyticsPage() {
  return <AnalyticsScreen />;
}
