'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Unlock,
} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  SkeletonRows,
  Tabs,
  Textarea,
  useOrbToast,
  type BadgeTone,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, fmtPct, timeAgo } from '@/components/orbat/overview/format';
import {
  AUTONOMY_LEVEL_DEFS,
  addAutonomyTopic,
  getAiQualityBootstrap,
  reviewAnswerCard,
  setTopicAutonomy,
  submitQualityReviewVerdict,
  toggleTopicLock,
  useAiQualityLiveSync,
  type AnswerCardItem,
  type AutonomyLevel,
  type AutonomyPolicyRow,
  type VerificationCheckItem,
} from '@/lib/data/ai-quality';
import { useData } from '@/lib/data/use-data';

type QualityTab = 'ladder' | 'verified' | 'cards';

function verdictMeta(v: VerificationCheckItem['verdict']): { label: string; tone: BadgeTone } {
  switch (v) {
    case 'supported':
      return { label: 'Supported', tone: 'ok' };
    case 'blocked_fixed':
      return { label: 'Fixed before send', tone: 'warn' };
    case 'blocked_human':
      return { label: 'Sent to human', tone: 'bad' };
    default:
      return { label: 'Needs review', tone: 'ai' };
  }
}

export function AiQualityScreen() {
  const { workspace } = useShellSession();
  const toast = useOrbToast();
  const workspaceId = workspace.id;

  const [tab, setTab] = useState<QualityTab>('ladder');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<'all' | VerificationCheckItem['verdict']>('all');

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicLevel, setNewTopicLevel] = useState<AutonomyLevel>(2);

  const [editCard, setEditCard] = useState<AnswerCardItem | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  const state = useData(
    () => getAiQualityBootstrap(workspaceId, selectedAgentId || null),
    ['ai-quality-bootstrap', workspaceId, selectedAgentId],
  );
  useAiQualityLiveSync(workspaceId, state.reload);

  const data = state.data;
  const canManage = Boolean(data?.canManage);
  const canEditContent = Boolean(data?.canEditContent);
  const activeAgentId = selectedAgentId || data?.selectedAgentId || '';

  const filteredChecks = useMemo(() => {
    const list = data?.verificationChecks ?? [];
    if (verdictFilter === 'all') return list;
    return list.filter((c) => c.verdict === verdictFilter);
  }, [data?.verificationChecks, verdictFilter]);

  const activeCheck = useMemo(() => {
    if (selectedCheckId) {
      const match = filteredChecks.find((c) => c.id === selectedCheckId);
      if (match) return match;
    }
    return filteredChecks[0] ?? null;
  }, [filteredChecks, selectedCheckId]);

  const handleSetLevel = async (row: AutonomyPolicyRow, level: AutonomyLevel) => {
    if (!activeAgentId) return;
    setBusyKey(`lvl-${row.id}`);
    try {
      const res = await setTopicAutonomy(workspaceId, {
        agentId: row.agentId,
        topic: row.topic,
        level,
      });
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error || 'Could not update autonomy level.' });
        return;
      }
      toast.show({
        tone: 'ok',
        message: `${row.topic} set to Level ${level}.`,
      });
      state.reload();
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleLock = async (row: AutonomyPolicyRow) => {
    setBusyKey(`lock-${row.id}`);
    try {
      const nextLocked = !row.locked;
      const res = await toggleTopicLock(workspaceId, {
        agentId: row.agentId,
        topic: row.topic,
        locked: nextLocked,
      });
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error || 'Could not update lock state.' });
        return;
      }
      toast.show({
        tone: 'ok',
        message: nextLocked ? `${row.topic} locked against autonomous promotion.` : `Unlocked ${row.topic}.`,
      });
      state.reload();
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddTopic = async () => {
    if (!activeAgentId || !newTopicName.trim()) return;
    setBusyKey('add-topic');
    try {
      const res = await addAutonomyTopic(workspaceId, {
        agentId: activeAgentId,
        topic: newTopicName.trim(),
        level: newTopicLevel,
      });
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error || 'Could not add topic.' });
        return;
      }
      toast.show({ tone: 'ok', message: `Added "${newTopicName.trim()}" to Trust Ladder.` });
      setNewTopicName('');
      setAddTopicOpen(false);
      state.reload();
    } finally {
      setBusyKey(null);
    }
  };

  const handleCheckReview = async (logId: string, verdict: 'correct' | 'wrong') => {
    setBusyKey(`verdict-${logId}`);
    try {
      const res = await submitQualityReviewVerdict(workspaceId, logId, verdict);
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return;
      }
      toast.show({ tone: 'ok', message: `Marked answer check as ${verdict}.` });
      state.reload();
    } finally {
      setBusyKey(null);
    }
  };

  const handleCardDecision = async (
    card: AnswerCardItem,
    decision: 'approve' | 'reject',
    customQuestion?: string,
    customAnswer?: string,
  ) => {
    setBusyKey(`card-${card.id}`);
    try {
      const res = await reviewAnswerCard(workspaceId, {
        source: card.source,
        id: card.id,
        decision,
        question: customQuestion ?? card.question,
        answer: customAnswer ?? card.answer,
      });
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error || 'Could not save review decision.' });
        return;
      }
      toast.show({
        tone: 'ok',
        message: decision === 'approve' ? 'Answer card approved & indexed.' : 'Dismissed candidate.',
      });
      setEditCard(null);
      state.reload();
    } finally {
      setBusyKey(null);
    }
  };

  const kpis = data?.verificationKpis;

  return (
    <PageContainer>
      <PageHeader
        title="AI quality & trust"
        description="Per-topic autonomy guardrails, grounded claim verification, and answer-card approvals"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data && data.agents.length > 0 ? (
              <Select
                aria-label="Filter by AI agent"
                value={activeAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                options={data.agents.map((a) => ({
                  value: a.id,
                  label: `${a.name}${a.is_primary ? ' (Primary)' : ''}`,
                }))}
                className="w-[210px]"
              />
            ) : null}
            <ButtonLink href="/app/agents" variant="secondary" size="md">
              Agents
            </ButtonLink>
          </div>
        }
      />

      <Tabs<QualityTab>
        idBase="ai-quality-tabs"
        label="AI quality sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'ladder', label: 'Trust Ladder', count: data?.policies.length },
          {
            id: 'verified',
            label: 'Verified Answers',
            count: (kpis?.needsReviewCount ?? 0) > 0 ? kpis?.needsReviewCount : undefined,
          },
          { id: 'cards', label: 'Answer cards', count: data?.answerCards.length },
        ]}
      />

      {state.loading && !data ? (
        <div className="mt-4 space-y-4">
          <Card>
            <SkeletonRows rows={4} />
          </Card>
        </div>
      ) : state.error ? (
        <div className="mt-4">
          <ErrorState title="Could not load AI Quality data" body={state.error} onRetry={state.reload} />
        </div>
      ) : null}

      {/* TAB 1: TRUST LADDER */}
      {data && tab === 'ladder' ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AUTONOMY_LEVEL_DEFS.map((lvl) => (
              <Card key={lvl.level}>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={lvl.level >= 3 ? 'ai' : 'neutral'}>
                    Level {lvl.level} · {lvl.name}
                  </Badge>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-o-text-2">{lvl.description}</p>
                <div className="mt-2.5 border-t border-o-border pt-2 text-[11.5px] text-o-text-3">
                  Rule: {lvl.promotionRule}
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              title="Per-topic autonomy controls"
              sub="Promote proven topics or lock regulated topics so the AI never answers autonomously"
              actions={
                canManage ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leading={<Plus size={14} />}
                    onClick={() => setAddTopicOpen(true)}
                  >
                    Add topic
                  </Button>
                ) : null
              }
            />

            {data.policies.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck size={20} />}
                title="No topic policies configured"
                body="Create a topic policy to control autonomy level per category."
              />
            ) : (
              <div className="divide-y divide-o-border">
                {data.policies.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-3 py-3.5 first:pt-1 last:pb-1 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-o-text">{row.topic}</span>
                        <Badge tone={row.level >= 3 ? 'ai' : 'neutral'}>
                          L{row.level} · {row.levelLabel}
                        </Badge>
                        {row.locked ? (
                          <Badge tone="bad">
                            <Lock size={11} className="mr-1" />
                            Locked
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[12px] text-o-text-3">
                        <span className="o-num">{fmtInt(row.conversations30d)} checks (30d)</span>
                        <span>
                          Agreement:{' '}
                          <span className="o-num font-medium text-o-text-2">
                            {row.agreementPct !== null ? fmtPct(row.agreementPct) : '—'}
                          </span>
                        </span>
                        <span>
                          Escalated:{' '}
                          <span className="o-num font-medium text-o-text-2">
                            {fmtInt(row.escalations30d)}
                          </span>
                        </span>
                        {row.lockReason ? <span className="text-o-warn">{row.lockReason}</span> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <div
                        className="inline-flex rounded-[10px] border border-o-border bg-o-surface-2 p-0.5"
                        role="group"
                        aria-label={`Set autonomy level for ${row.topic}`}
                      >
                        {AUTONOMY_LEVEL_DEFS.map((d) => {
                          const active = row.level === d.level;
                          return (
                            <button
                              key={d.level}
                              type="button"
                              disabled={!canManage || row.locked || busyKey === `lvl-${row.id}`}
                              onClick={() => handleSetLevel(row, d.level)}
                              className={`rounded-[8px] px-2.5 py-1 text-[12px] font-medium transition-colors ${
                                active
                                  ? 'bg-o-ai text-white'
                                  : 'text-o-text-2 hover:text-o-text disabled:opacity-40'
                              }`}
                            >
                              {d.name}
                            </button>
                          );
                        })}
                      </div>

                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyKey === `lock-${row.id}`}
                          leading={row.locked ? <Unlock size={13} /> : <Lock size={13} />}
                          onClick={() => handleToggleLock(row)}
                        >
                          {row.locked ? 'Unlock' : 'Lock'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {/* TAB 2: VERIFIED ANSWERS */}
      {data && tab === 'verified' ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Replies checked (30d)</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-text">
                {fmtInt(kpis?.checked30d ?? 0)}
              </div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Passed first try</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-ok">
                {kpis?.passedFirstTryPct !== null && kpis?.passedFirstTryPct !== undefined
                  ? fmtPct(kpis.passedFirstTryPct)
                  : '—'}
              </div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Fixed before sending</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-warn">
                {fmtInt(kpis?.fixedBeforeSendCount ?? 0)}
              </div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Escalated to human</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-bad">
                {fmtInt(kpis?.sentToHumanCount ?? 0)}
              </div>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <div className="text-[12px] font-medium text-o-text-3">Pending QA audit</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-ai-text">
                {fmtInt(kpis?.needsReviewCount ?? 0)}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
            <Card className="lg:col-span-6">
              <CardHeader
                title="Recent verification checks"
                sub="Select any reply to inspect cited claim checks"
                actions={
                  <Select
                    aria-label="Filter verification checks"
                    value={verdictFilter}
                    onChange={(e) => setVerdictFilter(e.target.value as typeof verdictFilter)}
                    options={[
                      { value: 'all', label: 'All verdicts' },
                      { value: 'supported', label: 'Supported' },
                      { value: 'needs_review', label: 'Needs review' },
                      { value: 'blocked_fixed', label: 'Fixed before send' },
                      { value: 'blocked_human', label: 'Sent to human' },
                    ]}
                    className="w-[170px]"
                  />
                }
              />

              {filteredChecks.length === 0 ? (
                <EmptyState
                  title="No verification checks yet"
                  body="Once AI replies run in Autopilot or Playground, every claim check appears here."
                />
              ) : (
                <div className="divide-y divide-o-border">
                  {filteredChecks.map((chk) => {
                    const vm = verdictMeta(chk.verdict);
                    const selected = activeCheck?.id === chk.id;
                    return (
                      <button
                        key={chk.id}
                        type="button"
                        onClick={() => setSelectedCheckId(chk.id)}
                        className={`w-full rounded-[10px] px-3 py-3 text-left transition-colors ${
                          selected ? 'bg-o-ai-soft/60' : 'hover:bg-o-surface-2'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={vm.tone}>{vm.label}</Badge>
                            <span className="text-[12.5px] font-medium text-o-text">{chk.agentName}</span>
                            <Badge tone="neutral">{chk.channel}</Badge>
                          </div>
                          <span className="text-[11.5px] text-o-text-3">{timeAgo(chk.createdAt)}</span>
                        </div>
                        <div className="mt-1.5 line-clamp-2 text-[13px] font-medium text-o-text">
                          {chk.customerQuestion}
                        </div>
                        {chk.outcomeNote ? (
                          <div className="mt-0.5 truncate text-[12px] text-o-text-3">{chk.outcomeNote}</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="lg:sticky lg:top-[76px] lg:col-span-6">
              <CardHeader
                title="Claim check inspector"
                sub="Line-by-line grounding against Knowledge Base"
                actions={
                  activeCheck &&
                  (activeCheck.verdict !== 'supported' || activeCheck.humanReview === 'wrong') ? (
                    <ButtonLink
                      href={`/app/knowledge?fixTitle=${encodeURIComponent(activeCheck.customerQuestion.slice(0, 80))}&fixQuestion=${encodeURIComponent(activeCheck.customerQuestion)}`}
                      variant="secondary"
                      size="sm"
                      leading={<BookOpen size={13} />}
                    >
                      Fix in KB
                    </ButtonLink>
                  ) : null
                }
              />
              {!activeCheck ? (
                <EmptyState
                  title="Select a check"
                  body="Click any check on the left to inspect supported vs unsupported claims."
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={verdictMeta(activeCheck.verdict).tone}>
                        {verdictMeta(activeCheck.verdict).label}
                      </Badge>
                      {activeCheck.confidence !== null ? (
                        <Badge tone="neutral">
                          {Math.round(activeCheck.confidence * 100)}% confidence
                        </Badge>
                      ) : null}
                      {activeCheck.humanReview ? (
                        <Badge tone={activeCheck.humanReview === 'correct' ? 'ok' : 'bad'}>
                          QA: {activeCheck.humanReview}
                        </Badge>
                      ) : null}
                    </div>
                    {canEditContent ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant={activeCheck.humanReview === 'correct' ? 'primary' : 'secondary'}
                          size="sm"
                          disabled={busyKey === `verdict-${activeCheck.id}`}
                          leading={<ThumbsUp size={13} />}
                          onClick={() => handleCheckReview(activeCheck.id, 'correct')}
                        >
                          Correct
                        </Button>
                        <Button
                          variant={activeCheck.humanReview === 'wrong' ? 'danger' : 'secondary'}
                          size="sm"
                          disabled={busyKey === `verdict-${activeCheck.id}`}
                          leading={<ThumbsDown size={13} />}
                          onClick={() => handleCheckReview(activeCheck.id, 'wrong')}
                        >
                          Wrong
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[12px] border border-o-border bg-o-surface-2 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
                      Customer question
                    </div>
                    <p className="mt-1 text-[13px] text-o-text">{activeCheck.customerQuestion}</p>
                  </div>

                  <div className="rounded-[12px] border border-o-border bg-o-surface-2 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
                      Reply checked
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-o-text">
                      {activeCheck.finalReply || activeCheck.draftReply}
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
                      Claim grounding ({activeCheck.claims.length})
                    </div>
                    {activeCheck.claims.length === 0 ? (
                      <div className="text-[12.5px] text-o-text-3">
                        No structured claims were extracted for this reply.
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {activeCheck.claims.map((c, idx) => (
                          <li
                            key={idx}
                            className={`rounded-[10px] border p-2.5 text-[12.5px] ${
                              c.supported
                                ? 'border-o-ok/25 bg-o-ok-soft/40'
                                : 'border-o-bad/25 bg-o-bad-soft/40'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {c.supported ? (
                                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-o-ok" />
                              ) : (
                                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-o-bad" />
                              )}
                              <div>
                                <div className="font-medium text-o-text">{c.claim}</div>
                                <div className="mt-0.5 text-[11.5px] text-o-text-3">
                                  Source: {c.source}
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {/* TAB 3: ANSWER CARDS */}
      {data && tab === 'cards' ? (
        <div className="mt-4">
          {data.answerCards.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Sparkles size={20} />}
                title="No answer cards awaiting approval"
                body="As conversations teach new Q&As or customers ask unanswered questions, candidate cards appear here for review."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.answerCards.map((card) => {
                const isPending =
                  card.status === 'pending_review' ||
                  card.status === 'pending_approval' ||
                  card.status === 'open' ||
                  card.status === 'stale';
                return (
                  <Card key={`${card.source}-${card.id}`} className="flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={card.source === 'learning_candidate' ? 'ai' : 'warn'}>
                            {card.source === 'learning_candidate' ? 'Self-learning' : 'Unanswered gap'}
                          </Badge>
                          <Badge
                            tone={
                              card.status === 'approved' || card.status === 'auto_approved'
                                ? 'ok'
                                : card.status === 'rejected'
                                  ? 'bad'
                                  : 'neutral'
                            }
                          >
                            {card.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <span className="o-num text-[11.5px] text-o-text-3">
                          Seen {fmtInt(card.occurrences)}x · {timeAgo(card.lastSeenAt)}
                        </span>
                      </div>

                      <h3 className="mt-2.5 text-[14.5px] font-semibold text-o-text">{card.question}</h3>
                      <p className="mt-1.5 rounded-[10px] border border-o-border bg-o-surface-2 p-2.5 text-[13px] leading-relaxed text-o-text-2">
                        {card.answer || 'No proposed answer drafted yet — click Edit & approve to supply the official answer.'}
                      </p>
                      {card.reason ? (
                        <div className="mt-1.5 text-[11.5px] text-o-text-3">{card.reason}</div>
                      ) : null}
                    </div>

                    {isPending && (canManage || (card.source === 'unanswered_question' && canEditContent)) ? (
                      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-o-border pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyKey === `card-${card.id}`}
                          onClick={() => handleCardDecision(card, 'reject')}
                        >
                          Dismiss
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditCard(card);
                            setEditQuestion(card.question);
                            setEditAnswer(card.answer);
                          }}
                        >
                          Edit & approve
                        </Button>
                        {card.answer.trim() ? (
                          <Button
                            variant="ai"
                            size="sm"
                            loading={busyKey === `card-${card.id}`}
                            leading={<Check size={13} />}
                            onClick={() => handleCardDecision(card, 'approve')}
                          >
                            Approve
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* Add Topic Modal */}
      <Modal
        open={addTopicOpen}
        onClose={() => setAddTopicOpen(false)}
        title="Add autonomy topic"
        description="Track and configure an explicit autonomy level for a support topic"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setAddTopicOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="ai"
              size="md"
              loading={busyKey === 'add-topic'}
              onClick={handleAddTopic}
            >
              Add topic
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Topic name">
            <Input
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="e.g. Wire transfers, Plan upgrades, Cancellations"
            />
          </Field>
          <Field label="Starting autonomy level">
            <Select
              value={String(newTopicLevel)}
              onChange={(e) => setNewTopicLevel(Number(e.target.value) as AutonomyLevel)}
              options={AUTONOMY_LEVEL_DEFS.map((d) => ({
                value: String(d.level),
                label: `Level ${d.level} · ${d.name}`,
              }))}
            />
          </Field>
        </div>
      </Modal>

      {/* Edit & Approve Answer Card Modal */}
      <Modal
        open={Boolean(editCard)}
        onClose={() => setEditCard(null)}
        title="Edit & approve answer card"
        description="Refine the Q&A before adding it to your AI knowledge index"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setEditCard(null)}>
              Cancel
            </Button>
            <Button
              variant="ai"
              size="md"
              loading={editCard ? busyKey === `card-${editCard.id}` : false}
              onClick={() =>
                editCard && handleCardDecision(editCard, 'approve', editQuestion, editAnswer)
              }
            >
              Save & approve
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Question">
            <Input value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)} />
          </Field>
          <Field label="Verified answer">
            <Textarea
              rows={5}
              value={editAnswer}
              onChange={(e) => setEditAnswer(e.target.value)}
              placeholder="Write the exact verified response the AI should cite…"
            />
          </Field>
        </div>
      </Modal>
    </PageContainer>
  );
}
