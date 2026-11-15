import type { Metadata } from 'next';
import { SuperAdminScreen, type AdminNavId } from '@/components/orbat/admin/SuperAdminScreen';

export const metadata: Metadata = {
  title: 'Platform Super Admin · ORBAT AI',
  description: 'Manage platform workspaces, plans, AI models, staff access, and system settings.',
};

const VALID_TABS = new Set<AdminNavId>([
  'overview',
  'workspaces',
  'plans',
  'ai',
  'staff',
  'settings',
]);

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab)?.trim() as AdminNavId | undefined;
  const initialTab: AdminNavId = raw && VALID_TABS.has(raw) ? raw : 'overview';
  return <SuperAdminScreen initialTab={initialTab} />;
}
