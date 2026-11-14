import { ChatWidgetStudioScreen } from '@/components/orbat/public/ChatWidgetStudioScreen';

export default async function ChatWidgetStudioV2Page({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string; workspace?: string }>;
}) {
  const sp = await searchParams;
  return <ChatWidgetStudioScreen initialWorkspaceKey={sp.ws || sp.workspace || null} />;
}
