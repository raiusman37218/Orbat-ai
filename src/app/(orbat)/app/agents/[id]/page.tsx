import type { Metadata } from 'next';
import { AgentBuilderScreen } from '@/components/orbat/agents/AgentBuilderScreen';

export const metadata: Metadata = {
  title: 'Agent Builder · ORBAT AI',
};

export default async function AgentBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AgentBuilderScreen key={id} agentId={id} />;
}
