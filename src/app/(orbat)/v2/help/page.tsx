import { HelpCenterScreen } from '@/components/orbat/public/HelpCenterScreen';

export default async function HelpCenterV2Page({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string; workspace?: string }>;
}) {
  const sp = await searchParams;
  return <HelpCenterScreen initialWorkspaceKey={sp.ws || sp.workspace || null} />;
}
