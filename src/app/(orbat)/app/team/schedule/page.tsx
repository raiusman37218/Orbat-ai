import type { Metadata } from 'next';
import { ScheduleScreen } from '@/components/orbat/team/ScheduleScreen';

export const metadata: Metadata = {
  title: 'Office Hours & On-Call · ORBAT AI',
};

export default function SchedulePage() {
  return <ScheduleScreen />;
}
