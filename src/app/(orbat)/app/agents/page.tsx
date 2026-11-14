import type { Metadata } from 'next';
import { AiAgentsScreen } from '@/components/orbat/agents/AiAgentsScreen';

export const metadata: Metadata = {
  title: 'AI Agents · ORBAT AI',
};

export default function AiAgentsPage() {
  return <AiAgentsScreen />;
}
