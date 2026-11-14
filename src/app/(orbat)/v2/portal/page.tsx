import { CustomerPortalScreen } from '@/components/orbat/public/CustomerPortalScreen';

export default async function CustomerPortalV2Page({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string; workspace?: string }>;
}) {
  const sp = await searchParams;
  return <CustomerPortalScreen initialWorkspaceKey={sp.ws || sp.workspace || null} />;
}
