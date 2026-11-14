import type { Metadata } from 'next';
import { TeamScreen } from '@/components/orbat/team/TeamScreen';

export const metadata: Metadata = {
  title: 'Team & Command Center · ORBAT AI',
};

export default function TeamPage() {
  return <TeamScreen />;
}
