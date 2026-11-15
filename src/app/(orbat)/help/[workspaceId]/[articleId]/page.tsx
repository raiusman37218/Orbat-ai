import type { Metadata } from 'next';
import { HelpCenterScreen } from '@/components/orbat/public/HelpCenterScreen';

export const metadata: Metadata = {
  title: 'Help Article · ORBAT AI',
};

export default async function WorkspaceHelpArticlePage({
  params,
}: {
  params: Promise<{ workspaceId: string; articleId: string }>;
}) {
  const { workspaceId, articleId } = await params;
  return (
    <HelpCenterScreen
      initialWorkspaceKey={workspaceId}
      initialArticleKey={articleId}
    />
  );
}
