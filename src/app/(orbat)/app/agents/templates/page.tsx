import type { Metadata } from 'next';
import { AgentTemplatesScreen } from '@/components/orbat/agents/AgentTemplatesScreen';

export const metadata: Metadata = {
  title: 'Agent Templates · ORBAT AI',
};

export default function AgentTemplatesPage() {
  return <AgentTemplatesScreen />;
}
