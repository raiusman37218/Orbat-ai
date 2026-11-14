import type { Metadata } from 'next';
import { HandoffScreen } from '@/components/orbat/handoff/HandoffScreen';

export const metadata: Metadata = {
  title: 'AI to Human Handoff · ORBAT AI',
};

export default function HandoffPage() {
  return <HandoffScreen />;
}
