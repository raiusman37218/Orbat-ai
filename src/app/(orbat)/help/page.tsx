import type { Metadata } from 'next';
import { HelpCenterScreen } from '@/components/orbat/public/HelpCenterScreen';

export const metadata: Metadata = {
  title: 'Help Center · ORBAT AI',
  description: 'Search help guides, track orders, and open support requests.',
};

export default async function HelpCenterRootPage({
  searchParams,
}: {
  searchParams: Promise<{
    ws?: string | string[];
    workspace?: string | string[];
    article?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const pick = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) || null;
  return (
    <HelpCenterScreen
      initialWorkspaceKey={pick(sp.ws) || pick(sp.workspace)}
      initialArticleKey={pick(sp.article)}
    />
  );
}
