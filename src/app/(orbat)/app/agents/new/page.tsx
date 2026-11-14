import type { Metadata } from 'next';
import { AgentBuilderScreen } from '@/components/orbat/agents/AgentBuilderScreen';

export const metadata: Metadata = {
  title: 'New AI Agent · ORBAT AI',
};

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawTemplate = Array.isArray(params.template) ? params.template[0] : params.template;
  const templateId = rawTemplate?.trim() || null;

  return <AgentBuilderScreen key={`new-${templateId ?? 'blank'}`} agentId="new" templateId={templateId} />;
}
