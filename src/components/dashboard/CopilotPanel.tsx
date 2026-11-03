'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileText,
  HelpCircle,
  Lock,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wand2,
  X,
} from 'lucide-react';
import {
  Conversation,
  CopilotMessage,
  CopilotNextSteps,
  CopilotRewriteMode,
  CopilotSource,
  CopilotSummary,
  Message,
  Workspace,
} from '@/types/database';
import {
  askCopilotQuestionAction,
  generateCopilotNextStepsAction,
  generateCopilotSummaryAction,
  getCopilotPanelStateAction,
  recordCopilotDraftDispositionAction,
  recordCopilotFeedbackAction,
  rewriteCopilotTextAction,
  suggestCopilotReplyAction,
} from '@/app/actions/copilot';
import { CopilotAvailability } from '@/lib/ai/copilot/service';
import { CopilotReplyLanguage } from '@/lib/ai/copilot/prompts';
import { cn, formatTimeAgo } from '@/lib/utils';
import { errorMessage } from '@/lib/errors/user-error';

export interface ActiveDraftSuggestion {
  text: string;
  sources: CopilotSource[];
  knowledgeFound: boolean;
  noteForAgent: string | null;
  missingKnowledgeRecorded: boolean;
  resolvedLanguage: 'en' | 'ur' | 'roman_ur';
  eventId: string | null;
  feedback?: 'up' | 'down' | null;
}

interface CopilotPanelProps {
  workspace: Workspace;
  conversation: Conversation;
  messages: Message[];
  composerText: string;
  onUseDraft: (draftText: string, eventId: string | null) => void;
  onAcceptRewrite: (rewrittenText: string, eventId: string | null) => void;
  onOpenMissingKnowledge?: () => void;
  onOpenSettings?: () => void;
  onClose?: () => void;
  externalDraft?: ActiveDraftSuggestion | null;
  onClearExternalDraft?: () => void;
}

type CopilotTab = 'assist' | 'ask' | 'steps';

const LANGUAGE_OPTIONS: { value: CopilotReplyLanguage; label: string }[] = [
  { value: 'auto', label: 'Auto (Match customer)' },
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'Urdu (اردو)' },
  { value: 'roman_ur', label: 'Roman Urdu' },
];

const REWRITE_OPTIONS: { mode: CopilotRewriteMode; label: string }[] = [
  { mode: 'shorter', label: 'Shorter' },
  { mode: 'professional', label: 'More professional' },
  { mode: 'friendly', label: 'Friendlier' },
  { mode: 'grammar', label: 'Fix grammar' },
  { mode: 'translate_en', label: 'Translate → English' },
  { mode: 'translate_ur', label: 'Translate → Urdu' },
  { mode: 'translate_roman_ur', label: 'Translate → Roman Urdu' },
];

function FeedbackButtons({
  eventId,
  workspaceId,
  messageId,
  initialFeedback,
}: {
  eventId?: string | null;
  workspaceId: string;
  messageId?: string | null;
  initialFeedback?: 'up' | 'down' | null;
}) {
  const [voted, setVoted] = useState<'up' | 'down' | null>(initialFeedback || null);

  if (!eventId && !messageId) return null;

  const handleVote = async (val: 'up' | 'down') => {
    setVoted(val);
    try {
      await recordCopilotFeedbackAction(workspaceId, eventId, val, messageId);
    } catch {
      // Ignore feedback telemetry errors
    }
  };

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label="Rate Copilot output">
      <button
        type="button"
        onClick={() => handleVote('up')}
        title="Helpful"
        aria-label="Helpful"
        className={cn(
          'p-1 rounded transition-colors cursor-pointer',
          voted === 'up'
            ? 'bg-success-soft text-success border border-success-line'
            : 'text-ink-3 hover:text-ink hover:bg-surface-2'
        )}
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={() => handleVote('down')}
        title="Not helpful"
        aria-label="Not helpful"
        className={cn(
          'p-1 rounded transition-colors cursor-pointer',
          voted === 'down'
            ? 'bg-danger-soft text-danger border border-danger-line'
            : 'text-ink-3 hover:text-danger hover:bg-surface-2'
        )}
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
}

function SourcesList({ sources }: { sources: CopilotSource[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="pt-2 border-t border-line flex flex-wrap items-center gap-1.5">
      <span className="text-2xs font-semibold text-ink-3 flex items-center gap-1">
        <BookOpen className="w-3 h-3 text-accent" />
        <span>Sources:</span>
      </span>
      {sources.map((src) =>
        src.url ? (
          <a
            key={`${src.kind}:${src.id}`}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-line text-2xs font-medium text-accent hover:border-accent-line transition-colors max-w-[210px]"
            title={src.title}
          >
            <span className="truncate">{src.title}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
          </a>
        ) : (
          <span
            key={`${src.kind}:${src.id}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 border border-line text-2xs font-medium text-ink-2 max-w-[210px]"
            title={src.title}
          >
            <FileText className="w-2.5 h-2.5 text-ink-3 shrink-0" />
            <span className="truncate">{src.title}</span>
          </span>
        )
      )}
    </div>
  );
}

export function CopilotPanel({
  workspace,
  conversation,
  messages,
  composerText,
  onUseDraft,
  onAcceptRewrite,
  onOpenMissingKnowledge,
  onOpenSettings,
  onClose,
  externalDraft,
  onClearExternalDraft,
}: CopilotPanelProps) {
  const [activeTab, setActiveTab] = useState<CopilotTab>('assist');
  const [loadingInit, setLoadingInit] = useState(true);
  const [availability, setAvailability] = useState<CopilotAvailability | null>(null);

  // 1. Summary state
  const [summary, setSummary] = useState<CopilotSummary | null>(
    conversation.copilot_summary || null
  );
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const autoSummarizedConvRef = useRef<string | null>(null);

  // 2. Suggested Reply state
  const [replyLanguage, setReplyLanguage] = useState<CopilotReplyLanguage>('auto');
  const [draftResult, setDraftResult] = useState<ActiveDraftSuggestion | null>(
    externalDraft || null
  );
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // 3. Ask Copilot private chat state
  const [copilotChat, setCopilotChat] = useState<CopilotMessage[]>([]);
  const [askInput, setAskInput] = useState('');
  const [loadingAsk, setLoadingAsk] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 4. Rewrite preview state
  const [rewritePreview, setRewritePreview] = useState<{
    mode: CopilotRewriteMode;
    text: string;
    eventId: string | null;
  } | null>(null);
  const [loadingRewrite, setLoadingRewrite] = useState<CopilotRewriteMode | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  // 5. Next steps state
  const [nextSteps, setNextSteps] = useState<CopilotNextSteps | null>(
    conversation.copilot_next_steps || null
  );
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);

  // Mark cached summary as outdated locally when new non-internal messages arrive
  const currentNonInternalCount = messages.filter((m) => !m.is_internal).length;
  const isSummaryOutdated = Boolean(
    summary &&
      (summary.is_outdated ||
        (summary.message_count !== undefined && currentNonInternalCount > summary.message_count))
  );

  const handleGenerateSummary = useCallback(
    async (forceRefresh = false) => {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const res = await generateCopilotSummaryAction(
          workspace.id,
          conversation.id,
          forceRefresh
        );
        if (res.availability) setAvailability(res.availability);
        if (res.ok && res.summary) {
          setSummary(res.summary);
        } else {
          setSummaryError(res.error || 'Could not generate conversation summary.');
        }
      } catch (err) {
        setSummaryError(errorMessage(err, 'Failed to generate summary.'));
      } finally {
        setLoadingSummary(false);
      }
    },
    [workspace.id, conversation.id]
  );

  // Load initial Copilot state on conversation change
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const state = await getCopilotPanelStateAction(workspace.id, conversation.id);
        if (!active) return;
        setAvailability(state.availability);
        setSummary(state.summary || conversation.copilot_summary || null);
        setNextSteps(state.nextSteps || conversation.copilot_next_steps || null);
        setCopilotChat(state.copilotMessages);
        setSummaryError(null);
        setDraftError(null);
        setAskError(null);
        setStepsError(null);
        setRewritePreview(null);
        setRewriteError(null);

        // Requirement 1: Generate automatically ONLY when opening a conversation
        // that has enough messages (>= 3) and no current summary.
        if (
          state.availability.available &&
          !state.summary &&
          state.nonInternalMessageCount >= 3 &&
          autoSummarizedConvRef.current !== conversation.id
        ) {
          autoSummarizedConvRef.current = conversation.id;
          void handleGenerateSummary(false);
        }
      } catch (err) {
        if (!active) return;
        setSummaryError(errorMessage(err, 'Could not load Copilot state.'));
      } finally {
        if (active) setLoadingInit(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [workspace.id, conversation.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuggestReply = async () => {
    setLoadingDraft(true);
    setDraftError(null);
    try {
      const res = await suggestCopilotReplyAction(
        workspace.id,
        conversation.id,
        replyLanguage
      );
      if (res.availability) setAvailability(res.availability);
      if (res.ok && res.draft) {
        setDraftResult({
          text: res.draft,
          sources: res.sources || [],
          knowledgeFound: Boolean(res.knowledgeFound),
          noteForAgent: res.noteForAgent || null,
          missingKnowledgeRecorded: Boolean(res.missingKnowledgeRecorded),
          resolvedLanguage: res.resolvedLanguage || 'en',
          eventId: res.eventId || null,
        });
        setAvailability((prev) =>
          prev ? { ...prev, requestsUsed: prev.requestsUsed + 1 } : prev
        );
      } else {
        setDraftError(res.error || 'Could not draft a reply.');
      }
    } catch (err) {
      setDraftError(errorMessage(err, 'Failed to generate suggested reply.'));
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleDiscardDraft = async () => {
    const evId = draftResult?.eventId;
    setDraftResult(null);
    onClearExternalDraft?.();
    if (evId) {
      try {
        await recordCopilotDraftDispositionAction(workspace.id, evId, 'discarded');
      } catch {
        // Ignore telemetry error
      }
    }
  };

  const handleUseDraft = () => {
    if (!draftResult) return;
    onUseDraft(draftResult.text, draftResult.eventId);
    setDraftResult(null);
    onClearExternalDraft?.();
  };

  const handleAskCopilot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = askInput.trim();
    if (!q || loadingAsk) return;

    setLoadingAsk(true);
    setAskError(null);
    try {
      const res = await askCopilotQuestionAction(workspace.id, conversation.id, q);
      if (res.availability) setAvailability(res.availability);
      if (res.ok && res.agentMessage && res.copilotMessage) {
        setAskInput('');
        setCopilotChat((prev) => [
          ...prev,
          {
            ...res.agentMessage!,
            workspace_id: workspace.id,
            conversation_id: conversation.id,
            agent_id: '',
            event_id: null,
            feedback: null,
          },
          {
            ...res.copilotMessage!,
            workspace_id: workspace.id,
            conversation_id: conversation.id,
            agent_id: '',
          },
        ]);
        setAvailability((prev) =>
          prev ? { ...prev, requestsUsed: prev.requestsUsed + 1 } : prev
        );
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      } else {
        setAskError(res.error || 'Could not answer your question.');
      }
    } catch (err) {
      setAskError(errorMessage(err, 'Failed to ask Copilot.'));
    } finally {
      setLoadingAsk(false);
    }
  };

  const handleRewrite = async (mode: CopilotRewriteMode) => {
    if (!composerText.trim()) {
      setRewriteError('Type a draft in the reply composer below first.');
      return;
    }
    setLoadingRewrite(mode);
    setRewriteError(null);
    try {
      const res = await rewriteCopilotTextAction(
        workspace.id,
        composerText,
        mode,
        conversation.id
      );
      if (res.availability) setAvailability(res.availability);
      if (res.ok && res.rewritten) {
        setRewritePreview({
          mode,
          text: res.rewritten,
          eventId: res.eventId || null,
        });
        setAvailability((prev) =>
          prev ? { ...prev, requestsUsed: prev.requestsUsed + 1 } : prev
        );
      } else {
        setRewriteError(res.error || 'Could not rewrite text.');
      }
    } catch (err) {
      setRewriteError(errorMessage(err, 'Rewrite failed.'));
    } finally {
      setLoadingRewrite(null);
    }
  };

  const handleGenerateNextSteps = async () => {
    setLoadingSteps(true);
    setStepsError(null);
    try {
      const res = await generateCopilotNextStepsAction(workspace.id, conversation.id);
      if (res.availability) setAvailability(res.availability);
      if (res.ok && res.nextSteps) {
        setNextSteps(res.nextSteps);
        setAvailability((prev) =>
          prev ? { ...prev, requestsUsed: prev.requestsUsed + 1 } : prev
        );
      } else {
        setStepsError(res.error || 'Could not analyze next steps.');
      }
    } catch (err) {
      setStepsError(errorMessage(err, 'Failed to analyze next steps.'));
    } finally {
      setLoadingSteps(false);
    }
  };

  const isBlocked = availability && !availability.available;

  return (
    <aside
      aria-label="AI Copilot"
      className="flex w-full h-full border-l border-line bg-surface flex-col overflow-hidden relative z-20"
    >
      {/* ── Panel Header ── */}
      <div className="shrink-0 px-4 py-3 border-b border-line flex items-center justify-between gap-2 bg-surface">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-accent-soft border border-accent-line flex items-center justify-center text-accent shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-semibold text-ink truncate">AI Copilot</h2>
              <span className="px-1.5 py-0.5 rounded bg-surface-2 border border-line text-2xs font-medium text-ink-3">
                Agent Only
              </span>
            </div>
            {availability && (
              <p className="text-2xs text-ink-3 truncate font-mono">
                {availability.monthlyLimit !== null
                  ? `${availability.requestsUsed.toLocaleString()} / ${availability.monthlyLimit.toLocaleString()} actions this mo`
                  : `${availability.requestsUsed.toLocaleString()} actions used · Unlimited`}
              </p>
            )}
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close Copilot panel"
            aria-label="Close Copilot panel"
            className="btn btn-ghost btn-xs btn-icon shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="shrink-0 px-3 pt-2.5 pb-2 border-b border-line bg-surface-2">
        <div role="tablist" aria-label="Copilot sections" className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-surface border border-line">
          {(
            [
              { id: 'assist', label: 'Assist & Draft', Icon: Sparkles },
              { id: 'ask', label: 'Ask Copilot', Icon: MessageSquare },
              { id: 'steps', label: 'Next Steps', Icon: Compass },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'py-1.5 px-2 rounded-md text-2xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer',
                activeTab === id
                  ? 'bg-accent-soft text-accent border border-accent-line'
                  : 'text-ink-3 hover:text-ink'
              )}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Unavailable / Quota Reached Banner ── */}
      {isBlocked && (
        <div
          role="alert"
          className="m-3 p-3.5 rounded-xl border border-warn-line bg-warn-soft text-xs space-y-2 shrink-0"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="font-semibold text-ink">Copilot Unavailable</p>
              <p className="text-2xs text-ink-2 leading-relaxed">
                {availability?.message ||
                  'Agent Copilot is currently disabled or has reached its monthly plan limit. Your inbox remains fully operational.'}
              </p>
            </div>
          </div>
          {onOpenSettings &&
            (availability?.reason === 'workspace_copilot_disabled' ||
              availability?.reason === 'limit_reached' ||
              availability?.reason === 'copilot_disabled_in_plan') && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="btn btn-secondary btn-xs w-full justify-center"
              >
                <span>Open AI & Plan Settings</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
        </div>
      )}

      {/* ── Tab Content Area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4">
        {loadingInit ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-ink-3">
            <RefreshCw className="w-4 h-4 animate-spin text-accent" />
            <span>Loading Copilot…</span>
          </div>
        ) : activeTab === 'assist' ? (
          <>
            {/* 1. CONVERSATION SUMMARY CARD */}
            <section className="rounded-xl border border-line bg-surface-2 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-accent" />
                  <h3 className="text-xs font-semibold text-ink">Conversation Summary</h3>
                  {isSummaryOutdated && (
                    <span className="px-1.5 py-0.5 rounded bg-warn-soft border border-warn-line text-2xs font-semibold text-warn">
                      Outdated
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {summary && (
                    <FeedbackButtons
                      workspaceId={workspace.id}
                      eventId={summary.event_id}
                    />
                  )}
                  <button
                    type="button"
                    disabled={loadingSummary || Boolean(isBlocked)}
                    onClick={() => handleGenerateSummary(true)}
                    className="btn btn-ghost btn-xs inline-flex items-center gap-1"
                    title={summary ? 'Refresh summary' : 'Generate summary'}
                  >
                    <RefreshCw className={cn('w-3 h-3', loadingSummary && 'animate-spin')} />
                    <span>{summary ? 'Refresh' : 'Summarize'}</span>
                  </button>
                </div>
              </div>

              {loadingSummary ? (
                <div className="py-4 flex items-center gap-2 text-xs text-ink-3">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
                  <span>Summarizing conversation…</span>
                </div>
              ) : summaryError ? (
                <div className="p-2.5 rounded-lg border border-danger-line bg-danger-soft text-2xs text-danger flex items-center justify-between gap-2">
                  <span>{summaryError}</span>
                  <button
                    type="button"
                    onClick={() => handleGenerateSummary(true)}
                    className="font-semibold underline shrink-0 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : summary ? (
                <div className="space-y-2 text-xs">
                  {isSummaryOutdated && (
                    <div className="p-2 rounded-lg bg-warn-soft border border-warn-line text-2xs text-warn flex items-center justify-between gap-2">
                      <span>New messages arrived since this summary was saved.</span>
                      <button
                        type="button"
                        disabled={Boolean(isBlocked)}
                        onClick={() => handleGenerateSummary(true)}
                        className="font-semibold underline shrink-0 cursor-pointer"
                      >
                        Update
                      </button>
                    </div>
                  )}
                  <div className="p-2.5 rounded-lg bg-surface border border-line space-y-1">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-ink-3 block">
                      Issue
                    </span>
                    <p className="text-ink leading-relaxed">{summary.issue}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-line space-y-1">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-ink-3 block">
                      What Has Been Tried
                    </span>
                    <p className="text-ink-2 leading-relaxed">{summary.tried}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="p-2.5 rounded-lg bg-surface border border-line space-y-0.5">
                      <span className="text-2xs font-semibold uppercase tracking-wider text-ink-3 block">
                        Current Status
                      </span>
                      <p className="text-ink font-medium">{summary.status}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-accent-soft border border-accent-line space-y-0.5">
                      <span className="text-2xs font-semibold uppercase tracking-wider text-accent block">
                        Pending Action
                      </span>
                      <p className="text-ink font-medium">{summary.pending_action}</p>
                    </div>
                  </div>
                  {summary.generated_at && (
                    <p className="text-2xs text-ink-3 text-right">
                      Updated {formatTimeAgo(summary.generated_at)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-3 text-center space-y-2">
                  <p className="text-2xs text-ink-3">
                    Summarize the issue, what has been tried, current status, and pending action.
                  </p>
                  <button
                    type="button"
                    disabled={loadingSummary || Boolean(isBlocked) || currentNonInternalCount === 0}
                    onClick={() => handleGenerateSummary(true)}
                    className="btn btn-secondary btn-xs"
                  >
                    <Sparkles className="w-3 h-3 text-accent" />
                    <span>Generate Summary</span>
                  </button>
                </div>
              )}
            </section>

            {/* 2. SUGGESTED REPLY SECTION */}
            <section className="rounded-xl border border-line bg-surface-2 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <h3 className="text-xs font-semibold text-ink">Suggested Reply</h3>
                </div>
                <select
                  aria-label="Reply language"
                  value={replyLanguage}
                  onChange={(e) => setReplyLanguage(e.target.value as CopilotReplyLanguage)}
                  className="input input-xs w-auto text-2xs"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={loadingDraft || Boolean(isBlocked)}
                onClick={handleSuggestReply}
                className="btn btn-primary btn-sm w-full justify-center gap-1.5"
              >
                <Sparkles className={cn('w-3.5 h-3.5', loadingDraft && 'animate-spin')} />
                <span>{loadingDraft ? 'Drafting from knowledge…' : 'Suggest reply'}</span>
              </button>

              {draftError && (
                <div className="p-2.5 rounded-lg border border-danger-line bg-danger-soft text-2xs text-danger flex items-center justify-between gap-2">
                  <span>{draftError}</span>
                  <button
                    type="button"
                    onClick={handleSuggestReply}
                    className="font-semibold underline shrink-0 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {draftResult && (
                <div className="p-3 rounded-xl bg-surface border border-accent-line space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs font-semibold text-accent uppercase tracking-wider">
                      Draft ({draftResult.resolvedLanguage === 'ur' ? 'Urdu' : draftResult.resolvedLanguage === 'roman_ur' ? 'Roman Urdu' : 'English'})
                    </span>
                    <FeedbackButtons
                      workspaceId={workspace.id}
                      eventId={draftResult.eventId}
                    />
                  </div>

                  {!draftResult.knowledgeFound && (
                    <div className="p-2.5 rounded-lg border border-warn-line bg-warn-soft text-2xs text-warn space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-ink">
                            Not found in workspace knowledge
                          </p>
                          <p className="text-ink-2 mt-0.5">
                            {draftResult.noteForAgent ||
                              'No policies or articles matched this question. A safe clarifying/escalation draft is shown below and a Missing Knowledge item was logged.'}
                          </p>
                        </div>
                      </div>
                      {onOpenMissingKnowledge && (
                        <button
                          type="button"
                          onClick={onOpenMissingKnowledge}
                          className="text-2xs font-semibold text-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Missing Knowledge</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-ink whitespace-pre-wrap leading-relaxed bg-surface-2 p-2.5 rounded-lg border border-line">
                    {draftResult.text}
                  </p>

                  <SourcesList sources={draftResult.sources} />

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleUseDraft}
                      className="btn btn-primary btn-xs flex-1 justify-center"
                    >
                      <Check className="w-3 h-3" />
                      <span>Use draft in composer</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardDraft}
                      className="btn btn-ghost btn-xs"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 4. REWRITE COMPOSER TEXT SECTION */}
            <section className="rounded-xl border border-line bg-surface-2 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-accent" />
                  <h3 className="text-xs font-semibold text-ink">Rewrite Composer Draft</h3>
                </div>
                <span className="text-2xs text-ink-3">Preview before replacing</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {REWRITE_OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    disabled={
                      Boolean(loadingRewrite) ||
                      Boolean(isBlocked) ||
                      !composerText.trim()
                    }
                    onClick={() => handleRewrite(opt.mode)}
                    className="px-2 py-1 rounded-md border border-line bg-surface hover:bg-surface-3 text-2xs font-medium text-ink-2 hover:text-ink disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {loadingRewrite === opt.mode ? 'Rewriting…' : opt.label}
                  </button>
                ))}
              </div>

              {!composerText.trim() && !rewritePreview && (
                <p className="text-2xs text-ink-3">
                  Type a message in the reply composer to unlock rewrite and translation tools.
                </p>
              )}

              {rewriteError && (
                <p className="text-2xs text-danger">{rewriteError}</p>
              )}

              {rewritePreview && (
                <div className="p-3 rounded-xl bg-surface border border-accent-line space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-semibold text-accent uppercase">
                      Rewrite Preview ({REWRITE_OPTIONS.find((o) => o.mode === rewritePreview.mode)?.label})
                    </span>
                    <FeedbackButtons
                      workspaceId={workspace.id}
                      eventId={rewritePreview.eventId}
                    />
                  </div>
                  <p className="text-xs text-ink whitespace-pre-wrap leading-relaxed bg-surface-2 p-2.5 rounded-lg border border-line">
                    {rewritePreview.text}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onAcceptRewrite(rewritePreview.text, rewritePreview.eventId);
                        setRewritePreview(null);
                      }}
                      className="btn btn-primary btn-xs flex-1 justify-center"
                    >
                      <Check className="w-3 h-3" />
                      <span>Accept & Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (rewritePreview.eventId) {
                          void recordCopilotDraftDispositionAction(
                            workspace.id,
                            rewritePreview.eventId,
                            'discarded'
                          );
                        }
                        setRewritePreview(null);
                      }}
                      className="btn btn-ghost btn-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : activeTab === 'ask' ? (
          /* 3. ASK COPILOT PRIVATE CHAT */
          <div className="flex flex-col h-full min-h-[380px] justify-between gap-3">
            <div className="p-2.5 rounded-lg bg-surface-2 border border-line flex items-center gap-2 text-2xs text-ink-2 shrink-0">
              <Lock className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>
                Private agent Q&amp;A about this conversation or workspace knowledge. Never visible to the customer.
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {copilotChat.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <MessageSquare className="w-6 h-6 text-ink-3 mx-auto" />
                  <p className="text-xs font-medium text-ink">Ask Copilot anything</p>
                  <p className="text-2xs text-ink-3 max-w-xs mx-auto">
                    Ask about refund rules, pricing, what the customer already tried, or company policies.
                  </p>
                </div>
              ) : (
                copilotChat.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'p-3 rounded-xl text-xs space-y-2',
                      m.role === 'agent'
                        ? 'bg-accent-soft border border-accent-line text-ink ml-6'
                        : 'bg-surface-2 border border-line text-ink mr-2'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-2xs text-ink-3">
                      <span className="font-semibold text-ink-2">
                        {m.role === 'agent' ? 'You (Private)' : 'Copilot'}
                      </span>
                      {m.role === 'copilot' && (
                        <FeedbackButtons
                          workspaceId={workspace.id}
                          eventId={m.event_id}
                          messageId={m.id}
                          initialFeedback={m.feedback}
                        />
                      )}
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    {m.role === 'copilot' && m.sources && m.sources.length > 0 && (
                      <SourcesList sources={m.sources} />
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {askError && (
              <div className="p-2.5 rounded-lg border border-danger-line bg-danger-soft text-2xs text-danger flex items-center justify-between gap-2">
                <span>{askError}</span>
                <button
                  type="button"
                  onClick={() => handleAskCopilot()}
                  className="font-semibold underline shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            <form onSubmit={handleAskCopilot} className="pt-2 border-t border-line flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                disabled={loadingAsk || Boolean(isBlocked)}
                placeholder="Ask about this chat or policies…"
                className="input input-sm flex-1 text-xs"
              />
              <button
                type="submit"
                disabled={loadingAsk || !askInput.trim() || Boolean(isBlocked)}
                className="btn btn-primary btn-sm btn-icon shrink-0"
                title="Ask Copilot"
                aria-label="Ask Copilot"
              >
                {loadingAsk ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </form>
          </div>
        ) : (
          /* 5. NEXT STEPS & TRIAGE SUGGESTIONS */
          <div className="space-y-3">
            <div className="p-2.5 rounded-lg bg-surface-2 border border-line flex items-center justify-between gap-2 text-2xs text-ink-2">
              <span>
                <strong>Suggestions only:</strong> Copilot never changes ticket status, tags, or assignment automatically.
              </span>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-ink">Triage &amp; Recommended Next Steps</h3>
              <button
                type="button"
                disabled={loadingSteps || Boolean(isBlocked)}
                onClick={handleGenerateNextSteps}
                className="btn btn-secondary btn-xs"
              >
                <RefreshCw className={cn('w-3 h-3', loadingSteps && 'animate-spin')} />
                <span>{nextSteps ? 'Re-analyze' : 'Analyze'}</span>
              </button>
            </div>

            {stepsError && (
              <div className="p-2.5 rounded-lg border border-danger-line bg-danger-soft text-2xs text-danger flex items-center justify-between gap-2">
                <span>{stepsError}</span>
                <button
                  type="button"
                  onClick={handleGenerateNextSteps}
                  className="font-semibold underline shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {loadingSteps ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-ink-3">
                <RefreshCw className="w-4 h-4 animate-spin text-accent" />
                <span>Analyzing conversation…</span>
              </div>
            ) : nextSteps ? (
              <div className="rounded-xl border border-line bg-surface-2 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-ink-3">
                    Suggested Assessment
                  </span>
                  <FeedbackButtons
                    workspaceId={workspace.id}
                    eventId={nextSteps.event_id}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-surface border border-line">
                    <span className="text-2xs text-ink-3 block">Issue Type</span>
                    <span className="font-semibold text-ink mt-0.5 block">
                      {nextSteps.issue_type}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-line">
                    <span className="text-2xs text-ink-3 block">Customer Sentiment</span>
                    <span
                      className={cn(
                        'font-semibold capitalize mt-0.5 inline-block',
                        nextSteps.sentiment === 'positive' && 'text-success',
                        nextSteps.sentiment === 'neutral' && 'text-ink',
                        (nextSteps.sentiment === 'frustrated' || nextSteps.sentiment === 'urgent') &&
                          'text-danger'
                      )}
                    >
                      {nextSteps.sentiment}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-surface border border-line space-y-2">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-ink-3 block">
                    Suggested Next Steps
                  </span>
                  <ul className="space-y-1.5 text-xs text-ink">
                    {nextSteps.next_steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className={cn(
                    'p-3 rounded-lg border text-xs flex items-start gap-2.5',
                    nextSteps.specialist_needed
                      ? 'bg-warn-soft border-warn-line text-warn'
                      : 'bg-surface border-line text-ink-2'
                  )}
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-ink">
                      {nextSteps.specialist_needed
                        ? 'Specialist / Manager Attention Suggested'
                        : 'No Specialist Escalation Needed'}
                    </p>
                    <p className="text-2xs text-ink-2 mt-0.5">
                      {nextSteps.specialist_reason ||
                        'Standard support handling appears sufficient for this conversation.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center rounded-xl border border-line bg-surface-2 p-4 space-y-2">
                <Compass className="w-6 h-6 text-ink-3 mx-auto" />
                <p className="text-xs font-medium text-ink">Get Next-Step Suggestions</p>
                <p className="text-2xs text-ink-3">
                  Identify the issue type, customer sentiment, recommended steps, and whether a specialist or manager is needed.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
