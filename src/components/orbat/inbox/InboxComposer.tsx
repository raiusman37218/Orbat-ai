'use client';

/**
 * Reply / Internal Note composer for ORBAT Inbox (`Inbox.dc.html` + `MobileInbox.dc.html`).
 * Wraps Copilot suggest/rewrite, saved replies (`/`), `@` mentions, article links,
 * image/PDF/TXT upload, emoji picker, and outbound auto-translation toggle.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import {
  BookOpen,
  CornerUpLeft,
  FileText,
  Globe,
  Loader2,
  Lock,
  Paperclip,
  Send,
  Smile,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  SkeletonRows,
  useOrbToast,
} from '@/components/orbat/primitives';
import {
  EMOJI_CATEGORIES,
  getLanguageInfo,
  recordInboxCopilotFeedback,
  recordInboxDraftDisposition,
  rewriteInboxText,
  searchInboxHelpArticles,
  sendInboxMessage,
  suggestInboxReply,
  uploadInboxAttachment,
  type InboxAgent,
  type InboxCannedReply,
  type InboxConversationItem,
  type InboxHelpArticle,
  type InboxMessageItem,
} from '@/lib/data/inbox';
import { cn } from '@/lib/utils';
import type { CopilotRewriteMode, CopilotSource } from '@/types/database';

type OpenPopover = 'ai' | 'canned' | 'articles' | 'emoji' | null;

const REWRITE_MODES: Array<{ mode: CopilotRewriteMode; label: string }> = [
  { mode: 'shorter', label: 'Make shorter' },
  { mode: 'professional', label: 'More professional' },
  { mode: 'friendly', label: 'Friendly tone' },
  { mode: 'grammar', label: 'Fix spelling & grammar' },
  { mode: 'translate_en', label: 'Translate to English' },
  { mode: 'translate_ur', label: 'Translate to Urdu' },
  { mode: 'translate_roman_ur', label: 'Translate to Roman Urdu' },
];

export function InboxComposer({
  workspaceId,
  conversation,
  mode,
  onModeChange,
  text,
  onTextChange,
  textareaRef,
  replyTo,
  onClearReplyTo,
  agents,
  cannedReplies,
  activeLanguageCode,
  copilotAvailable,
  onSent,
}: {
  workspaceId: string;
  conversation: InboxConversationItem;
  mode: 'reply' | 'note';
  onModeChange: (next: 'reply' | 'note') => void;
  text: string;
  onTextChange: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  replyTo: InboxMessageItem | null;
  onClearReplyTo: () => void;
  agents: InboxAgent[];
  cannedReplies: InboxCannedReply[];
  activeLanguageCode: string;
  copilotAvailable: boolean;
  onSent: () => Promise<void>;
}) {
  const toast = useOrbToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const popoverRootRef = useRef<HTMLDivElement | null>(null);

  const [popover, setPopover] = useState<OpenPopover>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
    isImage: boolean;
  } | null>(null);
  const [autoTranslateOutbound, setAutoTranslateOutbound] = useState(true);

  // Copilot suggest / rewrite state
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    draft: string;
    sources: CopilotSource[];
    knowledgeFound: boolean;
    noteForAgent: string | null;
    eventId: string | null;
    feedback: 'up' | 'down' | null;
  } | null>(null);
  const [activeDraftEvent, setActiveDraftEvent] = useState<{
    eventId: string;
    originalText: string;
  } | null>(null);

  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewritePreview, setRewritePreview] = useState<{
    label: string;
    text: string;
    eventId: string | null;
    feedback: 'up' | 'down' | null;
  } | null>(null);

  // Article picker state
  const [articleQuery, setArticleQuery] = useState('');
  const [articles, setArticles] = useState<InboxHelpArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState<string | null>(null);

  // Saved replies search inside popover
  const [cannedQuery, setCannedQuery] = useState('');

  // Close popovers on outside click / Escape
  useEffect(() => {
    if (!popover) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        popoverRootRef.current &&
        !popoverRootRef.current.contains(e.target as Node)
      ) {
        setPopover(null);
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popover]);

  // Load help articles when articles popover opens or search changes
  useEffect(() => {
    if (popover !== 'articles') return;
    let active = true;
    const timer = setTimeout(async () => {
      setArticlesLoading(true);
      setArticlesError(null);
      try {
        const res = await searchInboxHelpArticles(workspaceId, articleQuery);
        if (active) setArticles(res);
      } catch (err) {
        if (active) {
          setArticlesError(
            err instanceof Error ? err.message : 'Could not search articles.',
          );
        }
      } finally {
        if (active) setArticlesLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [popover, articleQuery, workspaceId]);

  const langInfo = getLanguageInfo(activeLanguageCode);
  const isForeignLang = activeLanguageCode !== 'en';

  // Slash canned-reply autocomplete & @mention detection
  const slashMatch = text.match(/\/([a-zA-Z0-9_-]*)$/);
  const slashResults = slashMatch
    ? cannedReplies
        .filter((r) => {
          const q = slashMatch[1].toLowerCase();
          return (
            !q ||
            r.shortcut.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q)
          );
        })
        .slice(0, 6)
    : [];

  const mentionMatch =
    mode === 'note' ? text.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/) : null;
  const mentionResults = mentionMatch
    ? agents
        .filter((a) => {
          const q = mentionMatch[1].toLowerCase();
          return a.isActive && (!q || a.name.toLowerCase().includes(q));
        })
        .slice(0, 6)
    : [];

  const handleSuggestDraft = async () => {
    if (suggestLoading) return;
    setPopover(null);
    setSuggestLoading(true);
    try {
      const res = await suggestInboxReply(workspaceId, conversation.id);
      if (res.ok && res.draft) {
        setSuggestion({
          draft: res.draft,
          sources: res.sources || [],
          knowledgeFound: res.knowledgeFound !== false,
          noteForAgent: res.noteForAgent ?? null,
          eventId: res.eventId ?? null,
          feedback: null,
        });
      } else {
        toast.show({
          message: res.error || 'Copilot could not draft a reply.',
          tone: 'bad',
        });
      }
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Suggest failed.',
        tone: 'bad',
      });
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleRewrite = async (modeKey: CopilotRewriteMode, label: string) => {
    if (!text.trim() || rewriteLoading) return;
    setPopover(null);
    setRewriteLoading(true);
    try {
      const res = await rewriteInboxText(
        workspaceId,
        text,
        modeKey,
        conversation.id,
      );
      if (res.ok && res.rewritten) {
        setRewritePreview({
          label,
          text: res.rewritten,
          eventId: res.eventId ?? null,
          feedback: null,
        });
      } else {
        toast.show({
          message: res.error || 'Could not rewrite text.',
          tone: 'bad',
        });
      }
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Rewrite failed.',
        tone: 'bad',
      });
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleUseSuggestion = () => {
    if (!suggestion) return;
    onModeChange('reply');
    onTextChange(suggestion.draft);
    if (suggestion.eventId) {
      setActiveDraftEvent({
        eventId: suggestion.eventId,
        originalText: suggestion.draft,
      });
    }
    setSuggestion(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleDismissSuggestion = () => {
    if (suggestion?.eventId) {
      void recordInboxDraftDisposition(
        workspaceId,
        suggestion.eventId,
        'discarded',
      );
    }
    setSuggestion(null);
  };

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadInboxAttachment(file);
      setAttachment(uploaded);
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Upload failed.',
        tone: 'bad',
      });
    } finally {
      setUploading(false);
    }
  };

  const insertCanned = (item: InboxCannedReply, replaceSlash: boolean) => {
    if (replaceSlash) {
      onTextChange(text.replace(/\/[a-zA-Z0-9_-]*$/, item.content));
    } else {
      onTextChange(text ? `${text.trimEnd()}\n${item.content}` : item.content);
    }
    setPopover(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const insertMention = (agent: InboxAgent) => {
    onTextChange(text.replace(/@[a-zA-Z0-9._-]*$/, `@${agent.name} `));
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const insertArticle = (art: InboxHelpArticle) => {
    const path = art.slug ? `/help/${art.slug}` : `/help`;
    const snippet = `[${art.title}](${path})`;
    onTextChange(text ? `${text.trimEnd()} ${snippet}` : snippet);
    setPopover(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || sending || uploading) return;
    setSending(true);
    try {
      const result = await sendInboxMessage(workspaceId, {
        conversationId: conversation.id,
        content: trimmed,
        channel: conversation.channel,
        isInternal: mode === 'note',
        replyToId: mode === 'reply' ? replyTo?.id ?? null : null,
        attachmentUrl: attachment?.url ?? null,
        targetLanguageCode:
          mode === 'reply' && autoTranslateOutbound ? activeLanguageCode : 'en',
      });

      if (activeDraftEvent) {
        const disposition =
          trimmed === activeDraftEvent.originalText.trim() ? 'used' : 'edited';
        void recordInboxDraftDisposition(
          workspaceId,
          activeDraftEvent.eventId,
          disposition,
        );
        setActiveDraftEvent(null);
      }

      if (result.translationFallbackUsed) {
        toast.show({
          message: 'Auto-translation unavailable — sent original text.',
          tone: 'info',
        });
      }

      onTextChange('');
      setAttachment(null);
      onClearReplyTo();
      await onSent();
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : 'Could not send message.',
        tone: 'bad',
      });
    } finally {
      setSending(false);
    }
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const filteredCanned = cannedReplies.filter((c) => {
    const q = cannedQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.shortcut.toLowerCase().includes(q) ||
      c.content.toLowerCase().includes(q)
    );
  });

  return (
    <div
      ref={popoverRootRef}
      className="relative flex-none border-t border-o-border bg-o-surface px-3 pb-3 pt-2.5 sm:px-4"
    >
      {/* AI Suggested Reply Banner */}
      {suggestion && (
        <div className="mb-2.5 rounded-[14px] border border-o-ai/30 bg-o-ai-soft p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-o-ai-text">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {suggestion.knowledgeFound
                  ? 'AI Suggested Reply'
                  : 'Clarifying Draft (No exact KB match)'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Helpful suggestion"
                onClick={() => {
                  setSuggestion((prev) =>
                    prev ? { ...prev, feedback: 'up' } : prev,
                  );
                  void recordInboxCopilotFeedback(
                    workspaceId,
                    suggestion.eventId,
                    'up',
                  );
                }}
                className={cn(
                  'o-focus rounded-md p-1 text-o-ai-text hover:bg-o-surface/60',
                  suggestion.feedback === 'up' && 'bg-o-surface font-semibold',
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Unhelpful suggestion"
                onClick={() => {
                  setSuggestion((prev) =>
                    prev ? { ...prev, feedback: 'down' } : prev,
                  );
                  void recordInboxCopilotFeedback(
                    workspaceId,
                    suggestion.eventId,
                    'down',
                  );
                }}
                className={cn(
                  'o-focus rounded-md p-1 text-o-ai-text hover:bg-o-surface/60',
                  suggestion.feedback === 'down' && 'bg-o-surface font-semibold',
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Dismiss suggestion"
                onClick={handleDismissSuggestion}
                className="o-focus rounded-md p-1 text-o-text-2 hover:text-o-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-o-text">
            {suggestion.draft}
          </p>

          {suggestion.noteForAgent && (
            <p className="mt-1 text-[11.5px] text-o-ai-text">
              Note: {suggestion.noteForAgent}
            </p>
          )}

          {suggestion.sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {suggestion.sources.map((src) => (
                <Badge key={src.id} tone="ai">
                  {src.title}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ai" onClick={handleUseSuggestion}>
              Use draft
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={suggestLoading}
              onClick={handleSuggestDraft}
            >
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {/* Inline Rewrite Preview Banner */}
      {rewritePreview && (
        <div className="mb-2.5 rounded-[14px] border border-o-ai/30 bg-o-ai-soft p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-o-ai-text">
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              Rewrite: {rewritePreview.label}
            </span>
            <button
              type="button"
              aria-label="Discard rewrite"
              onClick={() => setRewritePreview(null)}
              className="o-focus rounded-md p-1 text-o-text-2 hover:text-o-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-o-text">
            {rewritePreview.text}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Button
              size="sm"
              variant="ai"
              onClick={() => {
                onTextChange(rewritePreview.text);
                setRewritePreview(null);
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
            >
              Apply rewrite
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRewritePreview(null)}
            >
              Keep original
            </Button>
          </div>
        </div>
      )}

      {/* Reply-to preview bar */}
      {replyTo && mode === 'reply' && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-[10px] border border-o-border bg-o-surface-2 px-3 py-1.5 text-[12px]">
          <div className="flex min-w-0 items-center gap-2">
            <CornerUpLeft className="h-3.5 w-3.5 flex-none text-o-accent-text" />
            <span className="font-semibold text-o-text">{replyTo.senderName}:</span>
            <span className="truncate text-o-text-2">{replyTo.content}</span>
          </div>
          <button
            type="button"
            onClick={onClearReplyTo}
            aria-label="Cancel quote reply"
            className="o-focus rounded p-0.5 text-o-text-3 hover:text-o-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Attached file preview */}
      {attachment && (
        <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-[10px] border border-o-border bg-o-surface-2 px-2.5 py-1.5 text-[12px]">
          {attachment.isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.url}
              alt={attachment.name}
              className="h-8 w-8 rounded object-cover"
            />
          ) : (
            <FileText className="h-4 w-4 flex-none text-o-text-2" />
          )}
          <span className="truncate font-medium text-o-text">{attachment.name}</span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove attachment"
            className="o-focus rounded p-0.5 text-o-text-3 hover:text-o-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Slash / Mention Autocomplete */}
      {slashResults.length > 0 && (
        <div className="mb-2 max-h-48 overflow-y-auto rounded-[12px] border border-o-border bg-o-surface p-1 shadow-[var(--shadow-md)]">
          <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-o-text-3">
            Saved replies
          </div>
          {slashResults.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => insertCanned(r, true)}
              className="o-focus flex w-full flex-col rounded-[8px] px-2.5 py-1.5 text-left hover:bg-o-surface-2"
            >
              <span className="text-[12.5px] font-semibold text-o-text">
                /{r.shortcut || r.title}
              </span>
              <span className="line-clamp-1 text-[12px] text-o-text-2">
                {r.content}
              </span>
            </button>
          ))}
        </div>
      )}

      {mentionResults.length > 0 && (
        <div className="mb-2 max-h-44 overflow-y-auto rounded-[12px] border border-o-border bg-o-surface p-1 shadow-[var(--shadow-md)]">
          <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-o-text-3">
            Mention teammate
          </div>
          {mentionResults.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => insertMention(a)}
              className="o-focus flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[13px] hover:bg-o-surface-2"
            >
              <span className="font-medium text-o-text">{a.name}</span>
              <span className="text-[11px] text-o-text-3">{a.role}</span>
            </button>
          ))}
        </div>
      )}

      {/* Popovers anchored above composer */}
      {popover === 'ai' && (
        <div
          role="dialog"
          aria-label="AI writing tools"
          className="absolute bottom-[calc(100%-8px)] left-3 z-30 w-64 rounded-[14px] border border-o-border bg-o-surface p-1.5 shadow-[var(--shadow-lg)] sm:left-4"
        >
          <button
            type="button"
            disabled={!copilotAvailable || suggestLoading}
            onClick={() => void handleSuggestDraft()}
            className="o-focus flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold text-o-ai-text hover:bg-o-ai-soft disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Suggest reply from knowledge
          </button>
          <div className="my-1 border-t border-o-border" />
          <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-o-text-3">
            Rewrite draft
          </div>
          {REWRITE_MODES.map((item) => (
            <button
              key={item.mode}
              type="button"
              disabled={!copilotAvailable || !text.trim() || rewriteLoading}
              onClick={() => void handleRewrite(item.mode, item.label)}
              className="o-focus flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-o-text hover:bg-o-surface-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>{item.label}</span>
            </button>
          ))}
          {!copilotAvailable && (
            <p className="px-2.5 py-1.5 text-[11.5px] text-o-text-3">
              Enable AI Copilot in Workspace Settings to draft or rewrite replies.
            </p>
          )}
        </div>
      )}

      {popover === 'canned' && (
        <div
          role="dialog"
          aria-label="Saved replies"
          className="absolute bottom-[calc(100%-8px)] left-3 z-30 w-72 rounded-[14px] border border-o-border bg-o-surface p-2 shadow-[var(--shadow-lg)] sm:left-4"
        >
          <input
            type="search"
            value={cannedQuery}
            onChange={(e) => setCannedQuery(e.target.value)}
            placeholder="Filter saved replies…"
            className="o-input o-input--sm mb-2 w-full"
            autoFocus
          />
          <div className="max-h-56 overflow-y-auto">
            {filteredCanned.length === 0 ? (
              <EmptyState
                title="No saved replies"
                body="Create canned replies in Settings or type `/` when any exist."
                className="p-3"
              />
            ) : (
              filteredCanned.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => insertCanned(r, false)}
                  className="o-focus flex w-full flex-col rounded-[8px] px-2.5 py-2 text-left hover:bg-o-surface-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-o-text">
                      {r.title}
                    </span>
                    {r.shortcut && (
                      <span className="font-mono text-[11px] text-o-text-3">
                        /{r.shortcut}
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 line-clamp-2 text-[12px] text-o-text-2">
                    {r.content}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {popover === 'articles' && (
        <div
          role="dialog"
          aria-label="Insert help article"
          className="absolute bottom-[calc(100%-8px)] left-3 z-30 w-80 rounded-[14px] border border-o-border bg-o-surface p-2 shadow-[var(--shadow-lg)] sm:left-4"
        >
          <input
            type="search"
            value={articleQuery}
            onChange={(e) => setArticleQuery(e.target.value)}
            placeholder="Search published Help Center articles…"
            className="o-input o-input--sm mb-2 w-full"
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto">
            {articlesLoading ? (
              <SkeletonRows rows={3} label="Searching articles" />
            ) : articlesError ? (
              <ErrorState
                title="Search failed"
                body={articlesError}
                onRetry={() => setArticleQuery((q) => q)}
                className="p-3"
              />
            ) : articles.length === 0 ? (
              <EmptyState
                title="No matching articles"
                body="Publish articles in Knowledge Base to link them in replies."
                className="p-3"
              />
            ) : (
              articles.map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => insertArticle(art)}
                  className="o-focus flex w-full flex-col rounded-[8px] px-2.5 py-2 text-left hover:bg-o-surface-2"
                >
                  <span className="truncate text-[12.5px] font-semibold text-o-text">
                    {art.title}
                  </span>
                  {art.summary && (
                    <span className="mt-0.5 line-clamp-1 text-[11.5px] text-o-text-2">
                      {art.summary}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {popover === 'emoji' && (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className="absolute bottom-[calc(100%-8px)] left-3 z-30 w-72 rounded-[14px] border border-o-border bg-o-surface p-2.5 shadow-[var(--shadow-lg)] sm:left-4"
        >
          <div className="max-h-56 space-y-2.5 overflow-y-auto">
            {EMOJI_CATEGORIES.slice(0, 4).map((cat) => (
              <div key={cat.name}>
                <div className="mb-1 text-[11px] font-semibold text-o-text-3">
                  {cat.name}
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.slice(0, 24).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onTextChange(`${text}${emoji}`);
                        setPopover(null);
                        requestAnimationFrame(() => textareaRef.current?.focus());
                      }}
                      className="o-focus rounded-md p-1 text-[16px] hover:bg-o-surface-2"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Composer Box */}
      <div
        className={cn(
          'rounded-[16px] border p-2.5 transition-colors',
          mode === 'note'
            ? 'border-o-note-border bg-o-note'
            : 'border-o-border bg-o-surface-2 focus-within:border-o-accent-text',
        )}
      >
        {/* Top Mode Strip */}
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onModeChange('reply')}
              aria-pressed={mode === 'reply'}
              className={cn(
                'o-focus rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors',
                mode === 'reply'
                  ? 'bg-o-surface text-o-text shadow-xs'
                  : 'text-o-text-2 hover:text-o-text',
              )}
            >
              Reply
            </button>
            <button
              type="button"
              onClick={() => onModeChange('note')}
              aria-pressed={mode === 'note'}
              className={cn(
                'o-focus inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors',
                mode === 'note'
                  ? 'bg-o-surface text-o-text shadow-xs'
                  : 'text-o-text-2 hover:text-o-text',
              )}
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              Internal note
            </button>
            <button
              type="button"
              disabled={!copilotAvailable || suggestLoading}
              onClick={() => void handleSuggestDraft()}
              className="o-focus inline-flex items-center gap-1 rounded-full border border-o-ai/30 bg-o-ai-soft px-2.5 py-1 text-[12px] font-semibold text-o-ai-text hover:opacity-90 disabled:opacity-45"
            >
              {suggestLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Suggest
            </button>
          </div>

          {mode === 'reply' && isForeignLang && (
            <button
              type="button"
              onClick={() => setAutoTranslateOutbound((v) => !v)}
              aria-pressed={autoTranslateOutbound}
              className={cn(
                'o-focus inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                autoTranslateOutbound
                  ? 'border-o-accent-text/30 bg-o-accent-soft text-o-accent-text'
                  : 'border-o-border bg-o-surface text-o-text-3',
              )}
              title="Automatically translates your English reply before sending"
            >
              <Globe className="h-3 w-3" />
              {autoTranslateOutbound
                ? `Auto-translate → ${langInfo.name}`
                : `Send as written (${langInfo.name} off)`}
            </button>
          )}
        </div>

        <textarea
          ref={textareaRef}
          rows={2}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder={
            mode === 'note'
              ? 'Write a private team note… type @ to mention a teammate'
              : `Reply to ${conversation.visitorName}… type / for saved replies`
          }
          aria-label={mode === 'note' ? 'Internal note message' : 'Reply message'}
          className="w-full resize-none bg-transparent px-1 py-1 text-[13.5px] leading-relaxed text-o-text placeholder:text-o-text-3 focus:outline-none"
        />

        {/* Bottom Tools & Send */}
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="quiet"
              icon
              onClick={() => setPopover((p) => (p === 'ai' ? null : 'ai'))}
              aria-label="AI writing tools"
              title="AI writing tools"
            >
              {rewriteLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-o-ai-text" />
              ) : (
                <Wand2 className="h-4 w-4 text-o-ai-text" />
              )}
            </Button>
            <Button
              size="sm"
              variant="quiet"
              icon
              onClick={() =>
                setPopover((p) => (p === 'canned' ? null : 'canned'))
              }
              aria-label="Saved replies"
              title="Saved replies (/)"
            >
              <Zap className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="quiet"
              icon
              onClick={() =>
                setPopover((p) => (p === 'articles' ? null : 'articles'))
              }
              aria-label="Insert help article"
              title="Insert help article"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="quiet"
              icon
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image, PDF, or text file"
              title="Attach image, PDF, or TXT"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="quiet"
              icon
              onClick={() => setPopover((p) => (p === 'emoji' ? null : 'emoji'))}
              aria-label="Insert emoji"
              title="Insert emoji"
            >
              <Smile className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt"
              className="hidden"
              onChange={handlePickFile}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-o-text-3 sm:inline">
              Enter to send · Shift+Enter newline
            </span>
            <Button
              size="sm"
              variant={mode === 'note' ? 'secondary' : 'primary'}
              disabled={(!text.trim() && !attachment) || uploading}
              loading={sending}
              onClick={() => void handleSend()}
              trailing={<Send className="h-3.5 w-3.5" />}
            >
              {mode === 'note' ? 'Add note' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
