import type { Metadata } from 'next';
import { ChatWidgetStudioScreen } from '@/components/orbat/public/ChatWidgetStudioScreen';
import { StandaloneWidgetFrame } from '@/components/orbat/public/StandaloneWidgetFrame';

export const metadata: Metadata = {
  title: 'Chat Widget · ORBAT AI',
  description: 'Customize and preview the ORBAT AI customer chat widget.',
};

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{
    workspaceId?: string | string[];
    ws?: string | string[];
    workspace?: string | string[];
    embed?: string | string[];
    standalone?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const pick = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v)?.trim() || '';

  const workspaceId = pick(sp.workspaceId);
  const ws = pick(sp.ws) || pick(sp.workspace);
  const isStandalone = Boolean(workspaceId) || pick(sp.embed) === '1' || pick(sp.standalone) === '1';

  if (isStandalone) {
    return <StandaloneWidgetFrame workspaceId={workspaceId || ws} />;
  }

  return <ChatWidgetStudioScreen initialWorkspaceKey={ws || null} />;
}
