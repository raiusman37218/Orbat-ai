'use server';

import {
  extractKnowledgeDocumentFromBuffer,
  fetchAndExtractUrl,
  MAX_INGEST_FILE_BYTES,
} from '@/lib/ai/document-ingest';
import { syncWorkspaceArticleEmbeddings } from '@/lib/ai/semantic-retrieval';

import { query, queryRows } from '@/lib/db';
import { serviceClient } from '@/lib/pg/service';
import { getWorkspaceAccess } from '@/lib/team/access';
import { errorMessage, userError } from '@/lib/errors/user-error';
import { generateSlug } from '@/lib/slug';
import { assertWorkspaceLimit } from '@/lib/plans/enforce';
import { ensureUniqueArticleSlug } from '@/app/actions/helpdesk';
import { saveQuickQaAnswerAction } from '@/app/actions/unanswered';
import { invalidateHelpIndex } from '@/lib/ai/help-answer';
import { invalidateBotAnswerCacheForArticle } from '@/lib/ai/answer-cache';
import {
  deleteArticleChunks,
  describeEmbeddingProvider,
  syncArticleChunks,
} from '@/lib/ai/semantic-retrieval';
import { refreshHelpCenter } from '@/lib/help/refresh';
import { getWorkspaceHelpCenterUrl } from '@/lib/domain';
import { tryWorkspaceChat } from '@/lib/ai/agent-runtime';
import type { PublicWorkspace, Workspace } from '@/types/database';

export type KnowledgeArticleStatus = 'published' | 'draft' | 'archived';

export interface KnowledgeSectionItem {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  orderIndex: number;
  articleCount: number;
}

export interface KnowledgeArticleSummary {
  id: string;
  sectionId: string | null;
  sectionName: string | null;
  title: string;
  slug: string | null;
  summary: string | null;
  status: KnowledgeArticleStatus;
  languages: string[];
  viewsCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulPct: number | null;
  authorName: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface KnowledgeGapItem {
  kind: 'unanswered' | 'low_helpful';
  id: string;
  title: string;
  detail: string;
  priorityScore: number;
  questionText?: string;
  articleId?: string;
}

export interface TeamAnswerItem {
  id: string;
  question: string;
  reason: string | null;
  timesAsked: number;
  status: string;
  proposedAnswer: string | null;
  lastAskedAt: string;
}

export interface ArticleVersionSnapshot {
  id: string;
  versionNumber: number;
  title: string;
  content: string;
  status: string;
  editedByName: string | null;
  changeSummary: string | null;
  createdAt: string;
}

export interface KnowledgeArticleDetail extends KnowledgeArticleSummary {
  content: string;
  versions: ArticleVersionSnapshot[];
}

export interface KnowledgeHubBootstrap {
  canEdit: boolean;
  canManage: boolean;
  helpCenterUrl: string | null;
  embeddingProvider: string;
  sections: KnowledgeSectionItem[];
  articles: KnowledgeArticleSummary[];
  gaps: KnowledgeGapItem[];
  teamAnswers: TeamAnswerItem[];
  botKnowledgeCount: number;
  metrics: {
    totalArticles: number;
    publishedCount: number;
    draftCount: number;
    archivedCount: number;
    openUnansweredCount: number;
  };
  knowledgeSources?: KnowledgeSourceItem[];
}

export interface KnowledgeSourceItem {
  id: string;
  sourceType: 'file' | 'url';
  title: string;
  sourceUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  sectionId: string | null;
  articleId: string | null;
  status: 'processing' | 'indexed' | 'failed';
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
}

export async function getKnowledgeHubAction(
  workspaceId: string,
): Promise<KnowledgeHubBootstrap> {
  const { role } = await getWorkspaceAccess(workspaceId, 'view');
  const canEdit = role === 'owner' || role === 'admin' || role === 'agent';
  const canManage = role === 'owner' || role === 'admin';

  const [wsRows, sectionRows, articleRows, unansweredRows, bkRows, embedStatus, sourceRows] =
    await Promise.all([
      queryRows<{
        id: string;
        name: string;
        slug: string | null;
        website_url: string | null;
        custom_domain: string | null;
        custom_domain_status: string | null;
        brand_color: string | null;
        greeting_title: string | null;
        greeting_message: string | null;
        owner_id: string;
        created_at: string;
      }>(
        `SELECT id, name, slug, website_url, custom_domain, custom_domain_status,
                brand_color, greeting_title, greeting_message, owner_id, created_at
         FROM public.workspaces WHERE id = $1 LIMIT 1`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT id, name, description, icon, order_index
         FROM public.help_sections
         WHERE workspace_id = $1
         ORDER BY order_index ASC, name ASC`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT a.id, a.section_id, a.title, a.slug, a.summary, a.status, a.languages,
                a.views_count, a.helpful_count, a.not_helpful_count, a.created_at, a.updated_at,
                s.name AS section_name,
                ag.name AS author_name
         FROM public.articles a
         LEFT JOIN public.help_sections s ON s.id = a.section_id
         LEFT JOIN public.agents ag ON ag.id = a.author_id
         WHERE a.workspace_id = $1
         ORDER BY a.updated_at DESC, a.created_at DESC`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT id, question, reason, times_asked, status, proposed_answer, last_asked_at
         FROM public.unanswered_questions
         WHERE workspace_id = $1 AND status IN ('open', 'pending_approval')
         ORDER BY times_asked DESC, last_asked_at DESC
         LIMIT 50`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.bot_knowledge WHERE workspace_id = $1`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
      describeEmbeddingProvider().catch(() => ({ provider: 'local', model: 'fallback' })),
      queryRows<Record<string, unknown>>(
        `SELECT id, source_type, title, source_url, file_name, mime_type, file_size,
                section_id, article_id, status, chunk_count, error_message, created_at
         FROM public.knowledge_sources
         WHERE workspace_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [workspaceId],
      ).catch(() => []),
    ]);

  const ws = wsRows[0];
  const helpCenterWorkspace: Workspace | null = ws
    ? {
        id: ws.id,
        name: ws.name,
        slug: ws.slug || undefined,
        website_url: ws.website_url || '',
        custom_domain: ws.custom_domain || undefined,
        custom_domain_status: (ws.custom_domain_status || undefined) as PublicWorkspace['custom_domain_status'],
        brand_color: ws.brand_color || '#111827',
        greeting_title: ws.greeting_title || ws.name,
        greeting_message: ws.greeting_message || '',
        owner_id: ws.owner_id,
        created_at: ws.created_at,
      }
    : null;
  const helpCenterUrl = helpCenterWorkspace ? getWorkspaceHelpCenterUrl(helpCenterWorkspace) : null;

  const sectionCounts = new Map<string, number>();
  const articles: KnowledgeArticleSummary[] = articleRows.map((a) => {
    const sid = a.section_id ? String(a.section_id) : null;
    if (sid) sectionCounts.set(sid, (sectionCounts.get(sid) ?? 0) + 1);
    const helpful = Number(a.helpful_count || 0);
    const notHelpful = Number(a.not_helpful_count || 0);
    const totalVotes = helpful + notHelpful;
    const statusRaw = String(a.status || 'draft');
    const status: KnowledgeArticleStatus =
      statusRaw === 'published' || statusRaw === 'archived' ? statusRaw : 'draft';
    return {
      id: String(a.id),
      sectionId: sid,
      sectionName: a.section_name ? String(a.section_name) : null,
      title: String(a.title || 'Untitled'),
      slug: a.slug ? String(a.slug) : null,
      summary: a.summary ? String(a.summary) : null,
      status,
      languages: Array.isArray(a.languages) && a.languages.length > 0 ? a.languages.map(String) : ['en'],
      viewsCount: Number(a.views_count || 0),
      helpfulCount: helpful,
      notHelpfulCount: notHelpful,
      helpfulPct: totalVotes > 0 ? Math.round((helpful / totalVotes) * 100) : null,
      authorName: a.author_name ? String(a.author_name) : null,
      updatedAt: String(a.updated_at || a.created_at),
      createdAt: String(a.created_at),
    };
  });

  const sections: KnowledgeSectionItem[] = sectionRows.map((s) => ({
    id: String(s.id),
    name: String(s.name || 'Section'),
    description: s.description ? String(s.description) : null,
    icon: String(s.icon || '📚'),
    orderIndex: Number(s.order_index || 0),
    articleCount: sectionCounts.get(String(s.id)) ?? 0,
  }));

  const teamAnswers: TeamAnswerItem[] = unansweredRows.map((u) => ({
    id: String(u.id),
    question: String(u.question || ''),
    reason: u.reason ? String(u.reason) : null,
    timesAsked: Number(u.times_asked || 1),
    status: String(u.status || 'open'),
    proposedAnswer: u.proposed_answer ? String(u.proposed_answer) : null,
    lastAskedAt: String(u.last_asked_at),
  }));

  const gaps: KnowledgeGapItem[] = [
    ...teamAnswers.slice(0, 6).map((t) => ({
      kind: 'unanswered' as const,
      id: t.id,
      title: t.question,
      detail: `Asked ${t.timesAsked}x without an approved Help Center article${t.reason ? ` · ${t.reason}` : ''}`,
      priorityScore: t.timesAsked,
      questionText: t.question,
    })),
    ...articles
      .filter((a) => a.status === 'published' && a.helpfulPct !== null && a.helpfulPct < 60 && a.notHelpfulCount >= 2)
      .slice(0, 3)
      .map((a) => ({
        kind: 'low_helpful' as const,
        id: `low-${a.id}`,
        title: a.title,
        detail: `${a.helpfulPct}% helpful (${a.notHelpfulCount} unhelpful votes) — consider rewriting or clarifying examples`,
        priorityScore: a.notHelpfulCount,
        articleId: a.id,
      })),
  ];

  return {
    canEdit,
    canManage,
    helpCenterUrl,
    embeddingProvider: typeof embedStatus?.provider === 'string' ? embedStatus.provider : 'built-in',
    sections,
    articles,
    gaps,
    teamAnswers,
    botKnowledgeCount: Number(bkRows[0]?.cnt || 0),
    metrics: {
      totalArticles: articles.length,
      publishedCount: articles.filter((a) => a.status === 'published').length,
      draftCount: articles.filter((a) => a.status === 'draft').length,
      archivedCount: articles.filter((a) => a.status === 'archived').length,
      openUnansweredCount: teamAnswers.length,
    },
    knowledgeSources: (sourceRows || []).map((src) => ({
      id: String(src.id),
      sourceType: src.source_type === 'url' ? 'url' : 'file',
      title: String(src.title || 'Untitled'),
      sourceUrl: src.source_url ? String(src.source_url) : null,
      fileName: src.file_name ? String(src.file_name) : null,
      mimeType: src.mime_type ? String(src.mime_type) : null,
      fileSize: src.file_size != null ? Number(src.file_size) : null,
      sectionId: src.section_id ? String(src.section_id) : null,
      articleId: src.article_id ? String(src.article_id) : null,
      status:
        src.status === 'processing' || src.status === 'failed' ? src.status : 'indexed',
      chunkCount: Number(src.chunk_count || 0),
      errorMessage: src.error_message ? String(src.error_message) : null,
      createdAt: String(src.created_at),
    })),
  };
}

export async function getKnowledgeArticleDetailAction(
  workspaceId: string,
  articleId: string,
): Promise<{ success: boolean; article?: KnowledgeArticleDetail; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'view');
    const [artRows, versionRows] = await Promise.all([
      queryRows<Record<string, unknown>>(
        `SELECT a.*, s.name AS section_name, ag.name AS author_name
         FROM public.articles a
         LEFT JOIN public.help_sections s ON s.id = a.section_id
         LEFT JOIN public.agents ag ON ag.id = a.author_id
         WHERE a.workspace_id = $1 AND a.id = $2
         LIMIT 1`,
        [workspaceId, articleId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT id, version_number, title, content, status, edited_by_name, change_summary, created_at
         FROM public.article_versions
         WHERE workspace_id = $1 AND article_id = $2
         ORDER BY version_number DESC
         LIMIT 25`,
        [workspaceId, articleId],
      ),
    ]);

    const a = artRows[0];
    if (!a) return { success: false, error: 'Article not found.' };

    const helpful = Number(a.helpful_count || 0);
    const notHelpful = Number(a.not_helpful_count || 0);
    const votes = helpful + notHelpful;
    const statusRaw = String(a.status || 'draft');
    const status: KnowledgeArticleStatus =
      statusRaw === 'published' || statusRaw === 'archived' ? statusRaw : 'draft';

    return {
      success: true,
      article: {
        id: String(a.id),
        sectionId: a.section_id ? String(a.section_id) : null,
        sectionName: a.section_name ? String(a.section_name) : null,
        title: String(a.title || ''),
        slug: a.slug ? String(a.slug) : null,
        summary: a.summary ? String(a.summary) : null,
        content: String(a.content || ''),
        status,
        languages: Array.isArray(a.languages) && a.languages.length > 0 ? a.languages.map(String) : ['en'],
        viewsCount: Number(a.views_count || 0),
        helpfulCount: helpful,
        notHelpfulCount: notHelpful,
        helpfulPct: votes > 0 ? Math.round((helpful / votes) * 100) : null,
        authorName: a.author_name ? String(a.author_name) : null,
        updatedAt: String(a.updated_at || a.created_at),
        createdAt: String(a.created_at),
        versions: versionRows.map((v) => ({
          id: String(v.id),
          versionNumber: Number(v.version_number || 1),
          title: String(v.title || ''),
          content: String(v.content || ''),
          status: String(v.status || 'draft'),
          editedByName: v.edited_by_name ? String(v.edited_by_name) : null,
          changeSummary: v.change_summary ? String(v.change_summary) : null,
          createdAt: String(v.created_at),
        })),
      },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to load article.') };
  }
}

export async function saveKnowledgeArticleAction(
  workspaceId: string,
  input: {
    id?: string | null;
    title: string;
    slug?: string | null;
    sectionId?: string | null;
    summary?: string | null;
    content: string;
    status: KnowledgeArticleStatus;
    languages?: string[];
    changeSummary?: string | null;
    resolvedUnansweredId?: string | null;
  },
): Promise<{ success: boolean; article?: KnowledgeArticleDetail; error?: string }> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'edit_content');
    const title = input.title.trim();
    if (!title) throw userError('Give the article a title before saving.');

    const content = input.content.trim();
    const languages =
      input.languages && input.languages.length > 0
        ? Array.from(new Set(input.languages.map((l) => l.trim().toLowerCase()).filter(Boolean)))
        : ['en'];

    const supabase = serviceClient();
    const isCreate = !input.id;
    if (isCreate) {
      await assertWorkspaceLimit(workspaceId, 'max_articles');
    }

    let sectionName = 'General';
    if (input.sectionId) {
      const secRows = await queryRows<{ name: string }>(
        `SELECT name FROM public.help_sections WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
        [input.sectionId, workspaceId],
      );
      if (secRows[0]?.name) sectionName = secRows[0].name;
    }

    const desiredSlug = input.slug?.trim() || generateSlug(title) || 'article';
    const uniqueSlug = await ensureUniqueArticleSlug(
      supabase,
      workspaceId,
      desiredSlug,
      input.id ?? undefined,
    );

    let savedId = input.id ?? '';
    if (isCreate) {
      const inserted = await queryRows<{ id: string }>(
        `INSERT INTO public.articles (
           workspace_id, section_id, title, slug, category, summary, content,
           status, languages, author_id, order_index
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, 1)
         RETURNING id`,
        [
          workspaceId,
          input.sectionId || null,
          title,
          uniqueSlug,
          sectionName,
          input.summary?.trim() || null,
          content,
          input.status,
          languages,
          agent?.id ?? null,
        ],
      );
      savedId = inserted[0]?.id;
    } else {
      const prev = await queryRows<{ slug: string | null }>(
        `SELECT slug FROM public.articles WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
        [input.id, workspaceId],
      );
      const oldSlug = prev[0]?.slug;
      if (oldSlug && oldSlug !== uniqueSlug) {
        await query(
          `INSERT INTO public.article_slug_redirects (workspace_id, article_id, old_slug)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [workspaceId, input.id, oldSlug],
        ).catch(() => {});
      }

      await query(
        `UPDATE public.articles
         SET section_id = $3,
             title = $4,
             slug = $5,
             category = $6,
             summary = $7,
             content = $8,
             status = $9,
             languages = $10::text[],
             updated_at = now()
         WHERE id = $1 AND workspace_id = $2`,
        [
          input.id,
          workspaceId,
          input.sectionId || null,
          title,
          uniqueSlug,
          sectionName,
          input.summary?.trim() || null,
          content,
          input.status,
          languages,
        ],
      );
      savedId = input.id!;
    }

    // Record version snapshot
    const maxVerRow = await queryRows<{ next_ver: string }>(
      `SELECT (COALESCE(MAX(version_number), 0) + 1)::text AS next_ver
       FROM public.article_versions WHERE article_id = $1`,
      [savedId],
    );
    const nextVer = Number(maxVerRow[0]?.next_ver || 1);
    await query(
      `INSERT INTO public.article_versions (
         workspace_id, article_id, version_number, title, content, status,
         edited_by, edited_by_name, change_summary
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        workspaceId,
        savedId,
        nextVer,
        title,
        content,
        input.status,
        agent?.id ?? null,
        agent?.name || 'Editor',
        input.changeSummary || (input.status === 'published' ? 'Published update' : 'Saved draft'),
      ],
    );

    if (input.status === 'published') {
      await syncArticleChunks(savedId, workspaceId).catch(() => {});
    } else {
      await deleteArticleChunks(savedId).catch(() => {});
    }
    invalidateHelpIndex(workspaceId);
    await invalidateBotAnswerCacheForArticle(workspaceId, savedId).catch(() => {});
    refreshHelpCenter(workspaceId);

    if (input.resolvedUnansweredId && input.status === 'published') {
      await query(
        `UPDATE public.unanswered_questions
         SET status = 'answered', resolved_article_id = $3, resolved_by = $4
         WHERE id = $1 AND workspace_id = $2`,
        [input.resolvedUnansweredId, workspaceId, savedId, agent?.id ?? null],
      ).catch(() => {});
    }

    const detail = await getKnowledgeArticleDetailAction(workspaceId, savedId);
    return { success: true, article: detail.article };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not save article.') };
  }
}

export async function restoreArticleVersionAction(
  workspaceId: string,
  articleId: string,
  versionId: string,
): Promise<{ success: boolean; article?: KnowledgeArticleDetail; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'edit_content');
    const verRows = await queryRows<{
      version_number: number;
      title: string;
      content: string;
      status: string;
    }>(
      `SELECT version_number, title, content, status
       FROM public.article_versions
       WHERE id = $1 AND article_id = $2 AND workspace_id = $3
       LIMIT 1`,
      [versionId, articleId, workspaceId],
    );
    const v = verRows[0];
    if (!v) return { success: false, error: 'Version snapshot not found.' };

    return saveKnowledgeArticleAction(workspaceId, {
      id: articleId,
      title: v.title,
      content: v.content,
      status: v.status === 'published' ? 'published' : v.status === 'archived' ? 'archived' : 'draft',
      changeSummary: `Restored v${v.version_number}`,
    });
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not restore article version.') };
  }
}

export async function deleteKnowledgeArticleAction(
  workspaceId: string,
  articleId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'edit_content');
    await deleteArticleChunks(articleId).catch(() => {});
    await query(`DELETE FROM public.articles WHERE id = $1 AND workspace_id = $2`, [
      articleId,
      workspaceId,
    ]);
    invalidateHelpIndex(workspaceId);
    await invalidateBotAnswerCacheForArticle(workspaceId, articleId).catch(() => {});
    refreshHelpCenter(workspaceId);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not delete article.') };
  }
}

export async function createKnowledgeCollectionAction(
  workspaceId: string,
  input: { name: string; description?: string; icon?: string },
): Promise<{ success: boolean; section?: KnowledgeSectionItem; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'edit_content');
    const name = input.name.trim();
    if (!name) return { success: false, error: 'Collection name is required.' };

    const orderRow = await queryRows<{ max_ord: string }>(
      `SELECT COALESCE(MAX(order_index), 0)::text AS max_ord FROM public.help_sections WHERE workspace_id = $1`,
      [workspaceId],
    );
    const nextOrder = Number(orderRow[0]?.max_ord || 0) + 1;

    const inserted = await queryRows<Record<string, unknown>>(
      `INSERT INTO public.help_sections (workspace_id, name, description, icon, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, icon, order_index`,
      [workspaceId, name, input.description?.trim() || null, input.icon?.trim() || '📚', nextOrder],
    );

    const row = inserted[0];
    if (!row) return { success: false, error: 'Failed to create collection.' };
    refreshHelpCenter(workspaceId);
    return {
      success: true,
      section: {
        id: String(row.id),
        name: String(row.name),
        description: row.description ? String(row.description) : null,
        icon: String(row.icon || '📚'),
        orderIndex: Number(row.order_index || nextOrder),
        articleCount: 0,
      },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not create collection.') };
  }
}

export async function saveTeamAnswerAction(
  workspaceId: string,
  input: {
    unansweredId: string;
    question: string;
    answer: string;
    alsoAddToHelpCenter: boolean;
    sectionId?: string | null;
  },
): Promise<{ success: boolean; pendingApproval?: boolean; articleId?: string; error?: string }> {
  try {
    const answer = input.answer.trim();
    const question = input.question.trim();
    if (!answer) return { success: false, error: 'Please write an answer before saving.' };
    if (!question) return { success: false, error: 'Question cannot be empty.' };

    if (input.alsoAddToHelpCenter) {
      const res = await saveKnowledgeArticleAction(workspaceId, {
        title: question,
        sectionId: input.sectionId || null,
        summary: answer.slice(0, 160),
        content: `## ${question}\n\n${answer}`,
        status: 'published',
        changeSummary: 'Created from Team answers queue',
        resolvedUnansweredId: input.unansweredId,
      });
      if (!res.success) return { success: false, error: res.error };
      return { success: true, pendingApproval: false, articleId: res.article?.id };
    }

    const qaRes = await saveQuickQaAnswerAction(workspaceId, input.unansweredId, {
      question,
      answer,
    });
    return { success: true, pendingApproval: qaRes.pendingApproval };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not save team answer.') };
  }
}

export async function runKnowledgeAiToolAction(
  workspaceId: string,
  input: {
    mode: 'draft' | 'improve' | 'summarize' | 'faqs';
    title: string;
    content: string;
    contextQuestion?: string;
  },
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'edit_content');
    const title = input.title.trim() || input.contextQuestion?.trim() || 'Help Center Article';
    const content = input.content.trim();

    const instructions: Record<typeof input.mode, string> = {
      draft:
        'Write a clear, structured Markdown Help Center article (short intro, numbered steps, important edge cases/notes). Do not invent specific pricing, SLAs, or policies that are not mentioned in the prompt; mark any placeholders clearly in [brackets].',
      improve:
        'Rewrite and improve this Markdown Help Center article for clarity, concise headings, scannable bullet steps, and calm helpful tone without changing factual meaning or inventing numbers.',
      summarize:
        'Write a crisp 1-2 sentence Help Center summary (max 160 characters) describing what a reader learns from this article. Output plain text only.',
      faqs:
        'Generate 3-5 relevant FAQ Q&A pairs in Markdown (`### Question\nAnswer...`) derived directly from the article content.',
    };

    const output = await tryWorkspaceChat(
      workspaceId,
      `You are a Knowledge Base editor assistant. ${instructions[input.mode]}`,
      `Article title: ${title}\n${input.contextQuestion ? `Customer question: ${input.contextQuestion}\n` : ''}\nCurrent content:\n${content || '(empty)'}`,
      900,
    );

    if (!output) {
      return {
        success: false,
        error:
          'No AI model provider is configured for this workspace yet. Add your OpenAI, Anthropic, or Gemini key in Settings -> AI provider to use Knowledge AI tools.',
      };
    }

    return { success: true, output };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Knowledge AI tool failed.') };
  }
}

export type ImportKnowledgeSourceInput =
  | {
      mode: 'file';
      fileName: string;
      mimeType?: string | null;
      base64Data: string;
      title?: string;
      sectionId?: string | null;
      publishImmediately?: boolean;
    }
  | {
      mode: 'url';
      url: string;
      title?: string;
      sectionId?: string | null;
      publishImmediately?: boolean;
    };

export async function importKnowledgeSourceAction(
  workspaceId: string,
  input: ImportKnowledgeSourceInput,
): Promise<{
  success: boolean;
  articleId?: string;
  sourceId?: string;
  title?: string;
  chunkCount?: number;
  error?: string;
}> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'edit_content');

    let extractedTitle = '';
    let extractedSummary = '';
    let extractedContent = '';
    let sourceUrl: string | null = null;
    let fileName: string | null = null;
    let mimeType: string | null = null;
    let fileSize: number | null = null;

    if (input.mode === 'file') {
      const b64 = (input.base64Data || '').replace(/^data:[^;]+;base64,/, '').trim();
      if (!b64) {
        return { success: false, error: 'Uploaded file data is missing.' };
      }
      const buffer = Buffer.from(b64, 'base64');
      if (buffer.length > MAX_INGEST_FILE_BYTES) {
        return { success: false, error: 'Uploaded file exceeds the 5 MB size limit.' };
      }
      const parsed = extractKnowledgeDocumentFromBuffer({
        fileName: input.fileName || 'document.txt',
        mimeType: input.mimeType,
        buffer,
        titleOverride: input.title,
      });
      extractedTitle = parsed.title;
      extractedSummary = parsed.summary;
      extractedContent = parsed.content;
      fileName = input.fileName || 'document.txt';
      mimeType = input.mimeType || parsed.format;
      fileSize = buffer.length;
    } else {
      const parsed = await fetchAndExtractUrl(input.url);
      extractedTitle = (input.title || '').trim() || parsed.title;
      extractedSummary = parsed.summary;
      extractedContent = parsed.content;
      sourceUrl = parsed.finalUrl;
    }

    const publishNow = input.publishImmediately !== false;
    const saved = await saveKnowledgeArticleAction(workspaceId, {
      title: extractedTitle,
      sectionId: input.sectionId || null,
      summary: extractedSummary,
      content: extractedContent,
      status: publishNow ? 'published' : 'draft',
      changeSummary:
        input.mode === 'url'
          ? `Imported from URL: ${sourceUrl || input.url}`
          : `Imported from file: ${fileName || 'upload'}`,
    });

    if (!saved.success || !saved.article) {
      return { success: false, error: saved.error || 'Could not save imported content.' };
    }

    const chunkCountRows = await queryRows<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM public.article_chunks WHERE workspace_id = $1 AND article_id = $2`,
      [workspaceId, saved.article.id],
    ).catch(() => [{ cnt: '0' }]);
    const chunkCount = Number(chunkCountRows[0]?.cnt || 0);

    let sourceId: string | undefined;
    try {
      const inserted = await queryRows<{ id: string }>(
        `INSERT INTO public.knowledge_sources (
           workspace_id, source_type, title, source_url, file_name, mime_type, file_size,
           section_id, article_id, status, chunk_count, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          workspaceId,
          input.mode,
          extractedTitle,
          sourceUrl,
          fileName,
          mimeType,
          fileSize,
          input.sectionId || null,
          saved.article.id,
          'indexed',
          chunkCount,
          user?.id || null,
        ],
      );
      sourceId = inserted[0]?.id;
    } catch {
      // Non-fatal if knowledge_sources table migration has not been applied yet
    }

    return {
      success: true,
      articleId: saved.article.id,
      sourceId,
      title: extractedTitle,
      chunkCount,
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to import knowledge source.') };
  }
}

export async function reindexWorkspaceKnowledgeAction(
  workspaceId: string,
): Promise<{
  success: boolean;
  indexedArticles?: number;
  totalChunks?: number;
  error?: string;
}> {
  try {
    await getWorkspaceAccess(workspaceId, 'edit_content');
    const result = await syncWorkspaceArticleEmbeddings(workspaceId);
    invalidateHelpIndex(workspaceId);
    refreshHelpCenter(workspaceId);
    return {
      success: true,
      indexedArticles: result.indexedArticles,
      totalChunks: result.totalChunks,
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not re-index Knowledge Base embeddings.') };
  }
}
