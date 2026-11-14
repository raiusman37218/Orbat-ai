import type { Metadata } from 'next';
import { JourneysScreen } from '@/components/orbat/journeys/JourneysScreen';

export const metadata: Metadata = {
  title: 'Customer Journeys · ORBAT AI',
};

export default function JourneysPage() {
  return <JourneysScreen />;
}
