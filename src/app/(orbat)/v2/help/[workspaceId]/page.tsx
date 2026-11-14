import { HelpCenterScreen } from '@/components/orbat/public/HelpCenterScreen';

export default async function HelpCenterWorkspaceV2Page({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <HelpCenterScreen initialWorkspaceKey={workspaceId} />;
}
