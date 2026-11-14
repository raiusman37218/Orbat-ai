import { CustomerPortalScreen } from '@/components/orbat/public/CustomerPortalScreen';

export default async function HelpRequestsPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string; workspace?: string }>;
}) {
  const sp = await searchParams;
  return <CustomerPortalScreen initialWorkspaceKey={sp.ws || sp.workspace || null} />;
}
