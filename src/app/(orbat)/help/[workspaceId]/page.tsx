import type { Metadata } from 'next';
import { HelpCenterScreen } from '@/components/orbat/public/HelpCenterScreen';

export const metadata: Metadata = {
  title: 'Help Center · ORBAT AI',
};

export default async function WorkspaceHelpCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ article?: string | string[] }>;
}) {
  const [{ workspaceId }, sp] = await Promise.all([params, searchParams]);
  const article = Array.isArray(sp.article) ? sp.article[0] : sp.article;
  return (
    <HelpCenterScreen
      initialWorkspaceKey={workspaceId}
      initialArticleKey={article || null}
    />
  );
}
