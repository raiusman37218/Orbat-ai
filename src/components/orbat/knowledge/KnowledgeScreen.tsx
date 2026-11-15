'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Code,
  ExternalLink,
  FolderPlus,
  Globe,
  RefreshCw,
  Upload,
  FileText,
  History,
  List,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  SkeletonRows,
  Table,
  Textarea,
  useOrbToast,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, fmtPct, timeAgo } from '@/components/orbat/overview/format';
import {
  createKnowledgeCollection,
  importKnowledgeSource,
  reindexWorkspaceKnowledge,
  deleteKnowledgeArticle,
  getKnowledgeArticleDetail,
  getKnowledgeHub,
  restoreArticleVersion,
  runKnowledgeAiTool,
  saveKnowledgeArticle,
  saveTeamAnswer,
  useKnowledgeLiveSync,
  type KnowledgeArticleDetail,
  type KnowledgeArticleStatus,
  type KnowledgeArticleSummary,
  type TeamAnswerItem,
} from '@/lib/data/knowledge';
import { useData } from '@/lib/data/use-data';

type StatusFilter = 'all' | KnowledgeArticleStatus;

function statusBadge(s: KnowledgeArticleStatus) {
  if (s === 'published') return <Badge tone="ok">Published</Badge>;
  if (s === 'archived') return <Badge tone="neutral">Archived</Badge>;
  return <Badge tone="warn">Draft</Badge>;
}

export function KnowledgeScreen() {
  const { workspace } = useShellSession();
  const toast = useOrbToast();
  const workspaceId = workspace.id;

  const [mode, setMode] = useState<'library' | 'editor'>('library');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Team Answer inline composer state
  const [answeringItem, setAnsweringItem] = useState<TeamAnswerItem | null>(null);
  const [teamAnswerText, setTeamAnswerText] = useState('');
  const [alsoAddHc, setAlsoAddHc] = useState(true);
  const [teamAnswerSectionId, setTeamAnswerSectionId] = useState('');
  const [teamBusy, setTeamBusy] = useState(false);

  // Collection modal
  const [newColOpen, setNewColOpen] = useState(false);
  const [colName, setColName] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colBusy, setColBusy] = useState(false);

  // Editor state
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticleDetail | null>(null);
  const [edTitle, setEdTitle] = useState('');
  const [edSlug, setEdSlug] = useState('');
  const [edSectionId, setEdSectionId] = useState('');
  const [edSummary, setEdSummary] = useState('');
  const [edContent, setEdContent] = useState('');
  const [edLangsText, setEdLangsText] = useState('en');
  const [edStatus, setEdStatus] = useState<KnowledgeArticleStatus>('draft');
  const [edGapId, setEdGapId] = useState<string | null>(null);
  const [edPreview, setEdPreview] = useState(false);
  const [edSaving, setEdSaving] = useState(false);
  const [edAiBusy, setEdAiBusy] = useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const hubState = useData(
    () => getKnowledgeHub(workspaceId),
    ['knowledge-hub', workspaceId],
  );
  useKnowledgeLiveSync(workspaceId, hubState.reload, mode === 'library');

  const data = hubState.data;
  const canEdit = Boolean(data?.canEdit);

  // Document / URL import & re-index state (Part 5)
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<'file' | 'url'>('file');
  const [importUrl, setImportUrl] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importSectionId, setImportSectionId] = useState('');
  const [importPublish, setImportPublish] = useState(true);
  const [importFile, setImportFile] = useState<{
    name: string;
    mimeType: string;
    size: number;
    base64Data: string;
  } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [reindexBusy, setReindexBusy] = useState(false);

  const handleSelectImportFile = (file: File | null) => {
    if (!file) {
      setImportFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.show({ tone: 'bad', message: 'File exceeds the 5 MB upload limit.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] || '' : result;
      setImportFile({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        base64Data: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleImportSubmit = async () => {
    setImportBusy(true);
    try {
      const res =
        importTab === 'file'
          ? await importKnowledgeSource(workspaceId, {
              mode: 'file',
              fileName: importFile?.name || '',
              mimeType: importFile?.mimeType,
              base64Data: importFile?.base64Data || '',
              title: importTitle.trim() || undefined,
              sectionId: importSectionId || null,
              publishImmediately: importPublish,
            })
          : await importKnowledgeSource(workspaceId, {
              mode: 'url',
              url: importUrl.trim(),
              title: importTitle.trim() || undefined,
              sectionId: importSectionId || null,
              publishImmediately: importPublish,
            });
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error || 'Import failed.' });
        return;
      }
      toast.show({
        tone: 'ok',
        message: `Imported "${res.title || 'Source'}" (${res.chunkCount ?? 0} chunks indexed).`,
      });
      setImportOpen(false);
      setImportUrl('');
      setImportTitle('');
      setImportFile(null);
      hubState.reload();
    } finally {
      setImportBusy(false);
    }
  };

  const handleReindexAll = async () => {
    setReindexBusy(true);
    try {
      const res = await reindexWorkspaceKnowledge(workspaceId);
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error || 'Re-index failed.' });
        return;
      }
      toast.show({
        tone: 'ok',
        message: `Re-indexed ${fmtInt(res.indexedArticles ?? 0)} article(s) across ${fmtInt(res.totalChunks ?? 0)} vector chunk(s).`,
      });
      hubState.reload();
    } finally {
      setReindexBusy(false);
    }
  };

  const filteredArticles = useMemo(() => {
    const list = data?.articles ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (sectionFilter !== 'all' && a.sectionId !== sectionFilter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        (a.summary ?? '').toLowerCase().includes(q) ||
        (a.sectionName ?? '').toLowerCase().includes(q)
      );
    });
  }, [data?.articles, search, sectionFilter, statusFilter]);

  const openNewArticleEditor = (prefillTitle = '', prefillGapId: string | null = null) => {
    setEditingArticle(null);
    setEdTitle(prefillTitle);
    setEdSlug('');
    setEdSectionId(data?.sections[0]?.id ?? '');
    setEdSummary('');
    setEdContent(prefillTitle ? `## ${prefillTitle}\n\n` : '');
    setEdLangsText('en');
    setEdStatus('draft');
    setEdGapId(prefillGapId);
    setEdPreview(false);
    setMode('editor');
  };

  const openExistingArticle = async (summaryRow: KnowledgeArticleSummary) => {
    const res = await getKnowledgeArticleDetail(workspaceId, summaryRow.id);
    if (!res.success || !res.article) {
      toast.show({ tone: 'bad', message: res.error || 'Could not open article.' });
      return;
    }
    const art = res.article;
    setEditingArticle(art);
    setEdTitle(art.title);
    setEdSlug(art.slug || '');
    setEdSectionId(art.sectionId || '');
    setEdSummary(art.summary || '');
    setEdContent(art.content);
    setEdLangsText((art.languages || ['en']).join(', '));
    setEdStatus(art.status);
    setEdGapId(null);
    setEdPreview(false);
    setMode('editor');
  };

  const handleSaveArticle = async (targetStatus: KnowledgeArticleStatus) => {
    setEdSaving(true);
    try {
      const langs = edLangsText
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const res = await saveKnowledgeArticle(workspaceId, {
        id: editingArticle?.id ?? null,
        title: edTitle,
        slug: edSlug,
        sectionId: edSectionId || null,
        summary: edSummary,
        content: edContent,
        status: targetStatus,
        languages: langs.length ? langs : ['en'],
        resolvedUnansweredId: edGapId,
      });
      if (!res.success || !res.article) {
        toast.show({ tone: 'bad', message: res.error || 'Save failed.' });
        return;
      }
      setEditingArticle(res.article);
      setEdSlug(res.article.slug || '');
      setEdStatus(res.article.status);
      setEdGapId(null);
      toast.show({
        tone: 'ok',
        message:
          targetStatus === 'published'
            ? 'Article published and indexed for AI answers.'
            : `Article saved as ${targetStatus}.`,
      });
      hubState.reload();
    } finally {
      setEdSaving(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!editingArticle) return;
    const res = await restoreArticleVersion(workspaceId, editingArticle.id, versionId);
    if (!res.success || !res.article) {
      toast.show({ tone: 'bad', message: res.error || 'Could not restore version.' });
      return;
    }
    setEditingArticle(res.article);
    setEdTitle(res.article.title);
    setEdContent(res.article.content);
    setEdStatus(res.article.status);
    setVersionsOpen(false);
    toast.show({ tone: 'ok', message: 'Restored snapshot into editor.' });
    hubState.reload();
  };

  const handleDeleteArticle = async () => {
    if (!editingArticle) return;
    const res = await deleteKnowledgeArticle(workspaceId, editingArticle.id);
    if (!res.success) {
      toast.show({ tone: 'bad', message: res.error || 'Delete failed.' });
      return;
    }
    toast.show({ tone: 'ok', message: `Deleted "${editingArticle.title}".` });
    setConfirmDeleteOpen(false);
    setEditingArticle(null);
    setMode('library');
    hubState.reload();
  };

  const handleAiTool = async (aiMode: 'draft' | 'improve' | 'summarize' | 'faqs') => {
    setEdAiBusy(aiMode);
    try {
      const res = await runKnowledgeAiTool(workspaceId, {
        mode: aiMode,
        title: edTitle,
        content: edContent,
      });
      if (!res.success || !res.output) {
        toast.show({ tone: 'bad', message: res.error || 'Knowledge AI tool unavailable.' });
        return;
      }
      if (aiMode === 'summarize') {
        setEdSummary(res.output);
        toast.show({ tone: 'ok', message: 'Updated SEO/preview summary.' });
      } else if (aiMode === 'faqs') {
        setEdContent((prev) => `${prev.trim()}\n\n## Frequently asked questions\n\n${res.output}`);
        toast.show({ tone: 'ok', message: 'Appended FAQ pairs to article body.' });
      } else {
        setEdContent(res.output);
        toast.show({
          tone: 'ok',
          message: aiMode === 'draft' ? 'Generated article draft.' : 'Improved article clarity.',
        });
      }
    } finally {
      setEdAiBusy(null);
    }
  };

  const handleSaveTeamAnswer = async () => {
    if (!answeringItem) return;
    setTeamBusy(true);
    try {
      const res = await saveTeamAnswer(workspaceId, {
        unansweredId: answeringItem.id,
        question: answeringItem.question,
        answer: teamAnswerText,
        alsoAddToHelpCenter: alsoAddHc,
        sectionId: teamAnswerSectionId || data?.sections[0]?.id || null,
      });
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error || 'Failed to save team answer.' });
        return;
      }
      toast.show({
        tone: 'ok',
        message: alsoAddHc
          ? 'Published Help Center article & resolved question.'
          : res.pendingApproval
            ? 'Submitted answer for admin approval.'
            : 'Saved Quick Q&A into AI Knowledge.',
      });
      setAnsweringItem(null);
      setTeamAnswerText('');
      hubState.reload();
    } finally {
      setTeamBusy(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!colName.trim()) return;
    setColBusy(true);
    try {
      const res = await createKnowledgeCollection(workspaceId, {
        name: colName.trim(),
        description: colDesc.trim(),
      });
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error || 'Could not create collection.' });
        return;
      }
      toast.show({ tone: 'ok', message: `Created "${colName.trim()}".` });
      setColName('');
      setColDesc('');
      setNewColOpen(false);
      hubState.reload();
    } finally {
      setColBusy(false);
    }
  };

  const columns: Column<KnowledgeArticleSummary>[] = [
    {
      key: 'title',
      header: 'Article',
      cell: (r) => (
        <div className="py-0.5">
          <div className="font-medium text-o-text">{r.title}</div>
          <div className="line-clamp-1 max-w-[340px] text-[12px] text-o-text-3">
            {r.summary || `/${r.slug || r.id}`}
          </div>
        </div>
      ),
    },
    {
      key: 'collection',
      header: 'Collection',
      hideBelow: 'md',
      cell: (r) => <Badge tone="neutral">{r.sectionName || 'General'}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => statusBadge(r.status),
    },
    {
      key: 'langs',
      header: 'Languages',
      hideBelow: 'lg',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.languages.slice(0, 3).map((l) => (
            <Badge key={l} tone="neutral">
              {l.toUpperCase()}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'helpful',
      header: 'Helpful',
      align: 'right',
      hideBelow: 'sm',
      cell: (r) => (
        <span className="o-num text-[12.5px] text-o-text-2">
          {r.helpfulPct !== null ? fmtPct(r.helpfulPct) : '—'}
        </span>
      ),
    },
    {
      key: 'views',
      header: 'Views',
      align: 'right',
      hideBelow: 'sm',
      cell: (r) => <span className="o-num text-[12.5px] text-o-text-2">{fmtInt(r.viewsCount)}</span>,
    },
    {
      key: 'updated',
      header: 'Updated',
      align: 'right',
      hideBelow: 'md',
      cell: (r) => <span className="text-[12px] text-o-text-3">{timeAgo(r.updatedAt)}</span>,
    },
  ];

  // EDITOR MODE
  if (mode === 'editor') {
    return (
      <PageContainer>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-o-border bg-o-surface px-4 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              leading={<ArrowLeft size={14} />}
              onClick={() => setMode('library')}
            >
              Library
            </Button>
            {statusBadge(edStatus)}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEdPreview((v) => !v)}
            >
              {edPreview ? 'Edit markdown' : 'Preview'}
            </Button>
            {editingArticle ? (
              <Button
                variant="ghost"
                size="sm"
                leading={<History size={14} />}
                onClick={() => setVersionsOpen(true)}
              >
                History ({editingArticle.versions.length})
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editingArticle && canEdit ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Delete article"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 size={14} />
              </Button>
            ) : null}
            {canEdit ? (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  loading={edSaving}
                  onClick={() => handleSaveArticle('draft')}
                >
                  Save draft
                </Button>
                <Button
                  variant="ai"
                  size="md"
                  loading={edSaving}
                  onClick={() => handleSaveArticle('published')}
                >
                  Publish
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <Card size="lg">
            {/* Toolbar + AI writing tools */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-o-border pb-3">
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEdContent((p) => `${p}\n\n## Section heading\n`)}
                >
                  H2
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEdContent((p) => `${p}\n- List item`)}
                >
                  <List size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEdContent((p) => `${p}\n\`\`\`\ncode\n\`\`\``)}
                >
                  <Code size={14} />
                </Button>
              </div>

              {canEdit ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={edAiBusy === 'draft'}
                    leading={<Sparkles size={13} className="text-o-ai-text" />}
                    onClick={() => handleAiTool('draft')}
                  >
                    Generate draft
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={edAiBusy === 'improve'}
                    onClick={() => handleAiTool('improve')}
                  >
                    Improve
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={edAiBusy === 'summarize'}
                    onClick={() => handleAiTool('summarize')}
                  >
                    Summarize
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={edAiBusy === 'faqs'}
                    onClick={() => handleAiTool('faqs')}
                  >
                    Generate FAQs
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <Field label="Article title">
                <Input
                  value={edTitle}
                  disabled={!canEdit}
                  onChange={(e) => setEdTitle(e.target.value)}
                  placeholder="How do I update my billing method?"
                />
              </Field>

              {edPreview ? (
                <div className="min-h-[360px] rounded-[12px] border border-o-border bg-o-bg p-5">
                  <h1 className="font-o-display text-[22px] font-semibold text-o-text">
                    {edTitle || 'Untitled article'}
                  </h1>
                  {edSummary ? (
                    <p className="mt-1.5 text-[14px] text-o-text-3">{edSummary}</p>
                  ) : null}
                  <div className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-o-text-2">
                    {edContent || 'No body content yet.'}
                  </div>
                </div>
              ) : (
                <Field label="Content (Markdown)">
                  <Textarea
                    rows={16}
                    value={edContent}
                    disabled={!canEdit}
                    onChange={(e) => setEdContent(e.target.value)}
                    placeholder="Write clear steps, policies, and edge-case notes in Markdown…"
                    className="font-mono text-[13px]"
                  />
                </Field>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Publishing metadata" />
              <div className="space-y-3.5">
                <Field label="Collection">
                  <Select
                    value={edSectionId}
                    disabled={!canEdit}
                    onChange={(e) => setEdSectionId(e.target.value)}
                    options={[
                      { value: '', label: 'General (unassigned)' },
                      ...(data?.sections ?? []).map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </Field>
                <Field label="URL slug">
                  <Input
                    value={edSlug}
                    disabled={!canEdit}
                    onChange={(e) => setEdSlug(e.target.value)}
                    placeholder="auto-generated-from-title"
                  />
                </Field>
                <Field label="Short summary">
                  <Textarea
                    rows={3}
                    value={edSummary}
                    disabled={!canEdit}
                    onChange={(e) => setEdSummary(e.target.value)}
                    placeholder="1–2 sentence search & SEO summary"
                  />
                </Field>
                <Field label="Languages (comma-separated)">
                  <Input
                    value={edLangsText}
                    disabled={!canEdit}
                    onChange={(e) => setEdLangsText(e.target.value)}
                    placeholder="en, ur, ar, es"
                  />
                </Field>
              </div>
            </Card>
          </div>
        </div>

        <Modal
          open={versionsOpen}
          onClose={() => setVersionsOpen(false)}
          title="Article version history"
        >
          {!editingArticle || editingArticle.versions.length === 0 ? (
            <EmptyState title="No saved snapshots yet" body="Save or publish this article to track revisions." />
          ) : (
            <div className="divide-y divide-o-border">
              {editingArticle.versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="o-num font-semibold text-o-text">v{v.versionNumber}</span>
                      <Badge tone={v.status === 'published' ? 'ok' : 'neutral'}>{v.status}</Badge>
                      <span className="text-[12px] text-o-text-3">{timeAgo(v.createdAt)}</span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-o-text-2">
                      {v.changeSummary || 'Saved snapshot'} {v.editedByName ? `· ${v.editedByName}` : ''}
                    </div>
                  </div>
                  {canEdit ? (
                    <Button variant="secondary" size="sm" onClick={() => handleRestoreVersion(v.id)}>
                      Restore
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Modal>

        <ConfirmDialog
          open={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={handleDeleteArticle}
          title="Delete article permanently?"
          body="This removes the article and its search embeddings from your Help Center and AI assistant."
          confirmLabel="Delete article"
          variant="danger"
        />
      </PageContainer>
    );
  }

  // LIBRARY MODE
  return (
    <PageContainer>
      <PageHeader
        title="Knowledge Base"
        description={
          data
            ? `${fmtInt(data.metrics.publishedCount)} published · ${fmtInt(data.metrics.draftCount)} drafts · ${fmtInt(data.botKnowledgeCount)} internal notes (${data.embeddingProvider} embeddings)`
            : 'Help Center collections, Markdown editor, and AI knowledge gap detection'
        }
        actions={
          <>
            {data?.helpCenterUrl ? (
              <ButtonLink
                href={data.helpCenterUrl}
                target="_blank"
                rel="noreferrer"
                variant="secondary"
                size="md"
                trailing={<ExternalLink size={13} />}
              >
                Help center
              </ButtonLink>
            ) : null}
            {canEdit ? (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  loading={reindexBusy}
                  leading={<RefreshCw size={14} />}
                  onClick={handleReindexAll}
                >
                  Re-index
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  leading={<Upload size={14} />}
                  onClick={() => {
                    setImportSectionId(data?.sections[0]?.id ?? '');
                    setImportOpen(true);
                  }}
                >
                  Import File / URL
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  leading={<FolderPlus size={14} />}
                  onClick={() => setNewColOpen(true)}
                >
                  Collection
                </Button>
                <Button
                  variant="ai"
                  size="md"
                  leading={<Plus size={14} />}
                  onClick={() => openNewArticleEditor()}
                >
                  New article
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {hubState.loading && !data ? (
        <Card>
          <SkeletonRows rows={6} />
        </Card>
      ) : hubState.error ? (
        <ErrorState title="Could not load Knowledge Base" body={hubState.error} onRetry={hubState.reload} />
      ) : data ? (
        <div className="space-y-4">
          {data.knowledgeSources && data.knowledgeSources.length > 0 ? (
            <Card>
              <CardHeader
                title="Imported documents & URLs"
                sub={`${data.knowledgeSources.length} ingested source(s) synced with pgvector chunks`}
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.knowledgeSources.slice(0, 6).map((src) => (
                  <div
                    key={src.id}
                    className="flex items-center justify-between gap-2.5 rounded-[12px] border border-o-border bg-o-surface-2 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {src.sourceType === 'url' ? (
                        <Globe size={14} className="shrink-0 text-o-ai-text" />
                      ) : (
                        <FileText size={14} className="shrink-0 text-o-ai-text" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-semibold text-o-text">
                          {src.title}
                        </div>
                        <div className="truncate text-[11px] text-o-text-3">
                          {src.sourceUrl || src.fileName || 'Document'} · {fmtInt(src.chunkCount)} chunks
                        </div>
                      </div>
                    </div>
                    <Badge tone={src.status === 'failed' ? 'bad' : 'ok'}>
                      {src.status === 'failed' ? 'Failed' : 'Indexed'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {/* Knowledge Gap Detector + Team Answers */}
          {data.gaps.length > 0 ? (
            <Card className="border-o-ai/30 bg-o-ai-soft/25">
              <CardHeader
                title="Knowledge gap detector"
                sub={`${data.gaps.length} high-priority topic(s) missing clear Help Center coverage`}
              />
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {data.gaps.slice(0, 4).map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 rounded-[12px] border border-o-border bg-o-surface p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-o-text">{g.title}</div>
                      <div className="line-clamp-1 text-[12px] text-o-text-3">{g.detail}</div>
                    </div>
                    {canEdit ? (
                      <Button
                        variant="ai"
                        size="sm"
                        onClick={() => {
                          if (g.kind === 'unanswered' && g.questionText) {
                            openNewArticleEditor(g.questionText, g.id);
                          } else if (g.articleId) {
                            const found = data.articles.find((a) => a.id === g.articleId);
                            if (found) openExistingArticle(found);
                          }
                        }}
                      >
                        {g.kind === 'unanswered' ? 'Draft article' : 'Improve'}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {data.teamAnswers.length > 0 ? (
            <Card>
              <CardHeader
                title="Team answers queue"
                sub="Quickly resolve customer questions and optionally publish to your public Help Center"
              />
              <div className="divide-y divide-o-border">
                {data.teamAnswers.slice(0, 6).map((item) => {
                  const isOpen = answeringItem?.id === item.id;
                  return (
                    <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-o-text">{item.question}</div>
                          <div className="text-[12px] text-o-text-3">
                            Asked {fmtInt(item.timesAsked)}x · {timeAgo(item.lastAskedAt)}
                            {item.reason ? ` · ${item.reason}` : ''}
                          </div>
                        </div>
                        {canEdit ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setAnsweringItem(isOpen ? null : item);
                              setTeamAnswerText(item.proposedAnswer || '');
                              setTeamAnswerSectionId(data.sections[0]?.id || '');
                            }}
                          >
                            {isOpen ? 'Close' : 'Write answer'}
                          </Button>
                        ) : null}
                      </div>

                      {isOpen ? (
                        <div className="mt-3 space-y-3 rounded-[12px] border border-o-border bg-o-surface-2 p-3">
                          <Textarea
                            rows={3}
                            value={teamAnswerText}
                            onChange={(e) => setTeamAnswerText(e.target.value)}
                            placeholder="Write the verified answer for customers and the AI assistant…"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-o-text-2">
                              <input
                                type="checkbox"
                                checked={alsoAddHc}
                                onChange={(e) => setAlsoAddHc(e.target.checked)}
                              />
                              <span>Also publish as a Help Center article</span>
                            </label>
                            <div className="flex items-center gap-2">
                              {alsoAddHc && data.sections.length > 0 ? (
                                <Select
                                  aria-label="Target collection"
                                  value={teamAnswerSectionId}
                                  onChange={(e) => setTeamAnswerSectionId(e.target.value)}
                                  options={data.sections.map((s) => ({ value: s.id, label: s.name }))}
                                  className="w-[170px]"
                                />
                              ) : null}
                              <Button
                                variant="ai"
                                size="sm"
                                loading={teamBusy}
                                onClick={handleSaveTeamAnswer}
                              >
                                Save & index
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {/* Sidebar Collections + Main Article Table */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <nav
              aria-label="Knowledge filters"
              className="w-full shrink-0 space-y-4 rounded-[20px] border border-o-border bg-o-surface p-3 lg:w-[236px]"
            >
              <div>
                <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
                  Status
                </div>
                {([
                  { id: 'all', label: 'All articles', count: data.metrics.totalArticles },
                  { id: 'published', label: 'Published', count: data.metrics.publishedCount },
                  { id: 'draft', label: 'Drafts', count: data.metrics.draftCount },
                  { id: 'archived', label: 'Archived', count: data.metrics.archivedCount },
                ] as const).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={statusFilter === item.id}
                    onClick={() => setStatusFilter(item.id)}
                    className={`flex h-8 w-full items-center justify-between rounded-lg px-2 text-[13px] transition-colors ${
                      statusFilter === item.id
                        ? 'bg-o-accent-soft text-o-accent-text font-semibold'
                        : 'text-o-text-2 hover:bg-o-surface-2 hover:text-o-text'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="o-num text-[12px] text-o-text-3">{fmtInt(item.count)}</span>
                  </button>
                ))}
              </div>

              <div>
                <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
                  Collections
                </div>
                <button
                  type="button"
                  aria-pressed={sectionFilter === 'all'}
                  onClick={() => setSectionFilter('all')}
                  className={`flex h-8 w-full items-center justify-between rounded-lg px-2 text-[13px] transition-colors ${
                    sectionFilter === 'all'
                      ? 'bg-o-accent-soft text-o-accent-text font-semibold'
                      : 'text-o-text-2 hover:bg-o-surface-2 hover:text-o-text'
                  }`}
                >
                  <span>All collections</span>
                  <span className="o-num text-[12px] text-o-text-3">{fmtInt(data.metrics.totalArticles)}</span>
                </button>
                {data.sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    aria-pressed={sectionFilter === sec.id}
                    onClick={() => setSectionFilter(sec.id)}
                    className={`flex h-8 w-full items-center justify-between rounded-lg px-2 text-[13px] transition-colors ${
                      sectionFilter === sec.id
                        ? 'bg-o-accent-soft text-o-accent-text font-semibold'
                        : 'text-o-text-2 hover:bg-o-surface-2 hover:text-o-text'
                    }`}
                  >
                    <span className="truncate">{sec.name}</span>
                    <span className="o-num text-[12px] text-o-text-3">{fmtInt(sec.articleCount)}</span>
                  </button>
                ))}
              </div>
            </nav>

            <Card className="min-w-0 flex-1">
              <CardHeader
                title="Articles"
                sub={`${fmtInt(filteredArticles.length)} shown`}
                actions={
                  <div className="relative w-full sm:w-[240px]">
                    <Search
                      size={13}
                      className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-o-text-3"
                    />
                    <Input
                      aria-label="Search articles"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search title or summary…"
                      className="pl-8"
                    />
                  </div>
                }
              />

              {filteredArticles.length === 0 ? (
                <EmptyState
                  icon={<BookOpen size={20} />}
                  title="No matching articles"
                  body="Create your first Help Center article so your AI agents and customers always share a single source of truth."
                  action={
                    canEdit ? (
                      <Button variant="ai" size="md" onClick={() => openNewArticleEditor()}>
                        Write first article
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <Table<KnowledgeArticleSummary>
                  caption="Knowledge base articles"
                  rows={filteredArticles}
                  rowKey={(r) => r.id}
                  columns={columns}
                  onRowClick={openExistingArticle}
                />
              )}
            </Card>
          </div>
        </div>
      ) : null}

      <Modal
        open={newColOpen}
        onClose={() => setNewColOpen(false)}
        title="New Knowledge collection"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setNewColOpen(false)}>
              Cancel
            </Button>
            <Button variant="ai" size="md" loading={colBusy} onClick={handleCreateCollection}>
              Create collection
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Collection name">
            <Input
              value={colName}
              onChange={(e) => setColName(e.target.value)}
              placeholder="e.g. Billing & Invoices, Security & API"
            />
          </Field>
          <Field label="Description (optional)">
            <Textarea
              rows={2}
              value={colDesc}
              onChange={(e) => setColDesc(e.target.value)}
              placeholder="Shown on your Help Center index page"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Knowledge Source"
        description="Upload PDF, DOCX, TXT, or Markdown files, or ingest a public webpage URL into your RAG vector store."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="ai"
              size="md"
              loading={importBusy}
              disabled={importTab === 'file' ? !importFile : !importUrl.trim()}
              onClick={handleImportSubmit}
            >
              Import & index
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImportTab('file')}
              className={`flex-1 rounded-[10px] border px-3 py-2 text-[13px] font-medium transition-colors ${
                importTab === 'file'
                  ? 'border-o-ai bg-o-ai-soft text-o-ai-text'
                  : 'border-o-border bg-o-surface text-o-text-2 hover:bg-o-surface-2'
              }`}
            >
              <Upload size={13} className="mr-1.5 inline" />
              Upload document
            </button>
            <button
              type="button"
              onClick={() => setImportTab('url')}
              className={`flex-1 rounded-[10px] border px-3 py-2 text-[13px] font-medium transition-colors ${
                importTab === 'url'
                  ? 'border-o-ai bg-o-ai-soft text-o-ai-text'
                  : 'border-o-border bg-o-surface text-o-text-2 hover:bg-o-surface-2'
              }`}
            >
              <Globe size={13} className="mr-1.5 inline" />
              Website URL
            </button>
          </div>

          {importTab === 'file' ? (
            <div className="space-y-1.5">
              <Field label="Document file (PDF, DOCX, TXT, MD, CSV, HTML — max 5 MB)">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm"
                  onChange={(e) => handleSelectImportFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-[10px] border border-o-border bg-o-surface px-3 py-2 text-[13px] text-o-text file:mr-3 file:rounded-md file:border-0 file:bg-o-ai-soft file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-o-ai-text"
                />
              </Field>
              {importFile ? (
                <div className="text-[12px] text-o-text-3">
                  Selected: <strong className="text-o-text">{importFile.name}</strong> ({Math.max(1, Math.round(importFile.size / 1024))} KB)
                </div>
              ) : null}
            </div>
          ) : (
            <Field label="Public documentation or Help Center URL">
              <Input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://docs.example.com/refund-policy"
              />
            </Field>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Article title (optional override)">
              <Input
                value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)}
                placeholder="Auto-detected from file / title"
              />
            </Field>
            {data && data.sections.length > 0 ? (
              <Field label="Target collection">
                <Select
                  value={importSectionId}
                  onChange={(e) => setImportSectionId(e.target.value)}
                  options={[
                    { value: '', label: 'General (no collection)' },
                    ...data.sections.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </Field>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-o-text-2">
            <input
              type="checkbox"
              checked={importPublish}
              onChange={(e) => setImportPublish(e.target.checked)}
            />
            <span>Publish immediately and generate pgvector search chunks</span>
          </label>
        </div>
      </Modal>
    </PageContainer>
  );
}
