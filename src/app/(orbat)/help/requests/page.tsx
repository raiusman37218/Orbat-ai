import type { Metadata } from 'next';
import { CustomerPortalScreen } from '@/components/orbat/public/CustomerPortalScreen';

export const metadata: Metadata = {
  title: 'My Support Requests · ORBAT AI',
  description: 'Track open support tickets, reply to your support team, and share feedback.',
};

export default async function HelpRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string | string[]; workspace?: string | string[] }>;
}) {
  const sp = await searchParams;
  const pick = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) || null;
  return <CustomerPortalScreen initialWorkspaceKey={pick(sp.ws) || pick(sp.workspace)} />;
}
