'use client';

import {
  createKnowledgeCollectionAction,
  deleteKnowledgeArticleAction,
  getKnowledgeArticleDetailAction,
  getKnowledgeHubAction,
  importKnowledgeSourceAction,
  reindexWorkspaceKnowledgeAction,
  restoreArticleVersionAction,
  runKnowledgeAiToolAction,
  saveKnowledgeArticleAction,
  saveTeamAnswerAction,
  type ArticleVersionSnapshot,
  type ImportKnowledgeSourceInput,
  type KnowledgeArticleDetail,
  type KnowledgeArticleStatus,
  type KnowledgeArticleSummary,
  type KnowledgeGapItem,
  type KnowledgeHubBootstrap,
  type KnowledgeSectionItem,
  type KnowledgeSourceItem,
  type TeamAnswerItem,
} from '@/app/actions/knowledge-hub';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

export type {
  ArticleVersionSnapshot,
  ImportKnowledgeSourceInput,
  KnowledgeArticleDetail,
  KnowledgeArticleStatus,
  KnowledgeArticleSummary,
  KnowledgeGapItem,
  KnowledgeHubBootstrap,
  KnowledgeSectionItem,
  KnowledgeSourceItem,
  TeamAnswerItem,
};

export function getKnowledgeHub(workspaceId: string) {
  return getKnowledgeHubAction(workspaceId);
}

export function getKnowledgeArticleDetail(workspaceId: string, articleId: string) {
  return getKnowledgeArticleDetailAction(workspaceId, articleId);
}

export function saveKnowledgeArticle(
  workspaceId: string,
  input: Parameters<typeof saveKnowledgeArticleAction>[1],
) {
  return saveKnowledgeArticleAction(workspaceId, input);
}

export function restoreArticleVersion(
  workspaceId: string,
  articleId: string,
  versionId: string,
) {
  return restoreArticleVersionAction(workspaceId, articleId, versionId);
}

export function deleteKnowledgeArticle(workspaceId: string, articleId: string) {
  return deleteKnowledgeArticleAction(workspaceId, articleId);
}

export function createKnowledgeCollection(
  workspaceId: string,
  input: { name: string; description?: string; icon?: string },
) {
  return createKnowledgeCollectionAction(workspaceId, input);
}

export function saveTeamAnswer(
  workspaceId: string,
  input: Parameters<typeof saveTeamAnswerAction>[1],
) {
  return saveTeamAnswerAction(workspaceId, input);
}

export function runKnowledgeAiTool(
  workspaceId: string,
  input: Parameters<typeof runKnowledgeAiToolAction>[1],
) {
  return runKnowledgeAiToolAction(workspaceId, input);
}

export function importKnowledgeSource(
  workspaceId: string,
  input: ImportKnowledgeSourceInput,
) {
  return importKnowledgeSourceAction(workspaceId, input);
}

export function reindexWorkspaceKnowledge(workspaceId: string) {
  return reindexWorkspaceKnowledgeAction(workspaceId);
}

export function useKnowledgeLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
): void {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 15_000,
    onRefresh,
  });
}
