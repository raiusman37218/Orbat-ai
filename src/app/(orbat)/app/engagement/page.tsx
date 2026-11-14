import type { Metadata } from 'next';
import { EngagementScreen } from '@/components/orbat/engagement/EngagementScreen';

export const metadata: Metadata = {
  title: 'Engagement · ORBAT AI',
};

export default function EngagementPage() {
  return <EngagementScreen />;
}
