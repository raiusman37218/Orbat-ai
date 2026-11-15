import type { Metadata } from 'next';
import { CustomerPortalScreen } from '@/components/orbat/public/CustomerPortalScreen';

export const metadata: Metadata = {
  title: 'Customer Portal · ORBAT AI',
  description: 'View your support requests, order updates, and conversation replies.',
};

export default async function CustomerPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string | string[]; workspace?: string | string[] }>;
}) {
  const sp = await searchParams;
  const pick = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) || null;
  return <CustomerPortalScreen initialWorkspaceKey={pick(sp.ws) || pick(sp.workspace)} />;
}
