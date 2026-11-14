'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Globe,
  Languages as LanguagesIcon,
  Play,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
  SkeletonRows,
  Table,
  Toggle,
  useOrbToast,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, fmtPct } from '@/components/orbat/overview/format';
import {
  PIPELINE_QUICK_TESTS,
  getLanguagesBootstrap,
  testLanguagePipeline,
  updateLanguageConfig,
  type AgentReplyLanguageMode,
  type LanguageCoverageRow,
  type PipelineTestResult,
} from '@/lib/data/languages';
import { useData } from '@/lib/data/use-data';

function capBadge(val: 'Yes' | 'Partial' | 'No') {
  if (val === 'Yes') return <Badge tone="ok">Yes</Badge>;
  if (val === 'Partial') return <Badge tone="warn">Partial</Badge>;
  return <Badge tone="neutral">No</Badge>;
}

export function LanguagesScreen() {
  const { workspace } = useShellSession();
  const toast = useOrbToast();
  const workspaceId = workspace.id;

  const [langSearch, setLangSearch] = useState('');
  const [testInput, setTestInput] = useState(PIPELINE_QUICK_TESTS[0].text);
  const [testing, setTesting] = useState(false);
  const [pipelineRes, setPipelineRes] = useState<PipelineTestResult | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const state = useData(
    () => getLanguagesBootstrap(workspaceId),
    ['languages-bootstrap', workspaceId],
  );

  const data = state.data;
  const canManage = Boolean(data?.canManage);

  const filteredLanguages = useMemo(() => {
    const rows = data?.languages ?? [];
    const q = langSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.nativeName.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q),
    );
  }, [data?.languages, langSearch]);

  const runPipeline = async (overrideText?: string) => {
    const query = (overrideText ?? testInput).trim();
    if (!query) return;
    if (overrideText) setTestInput(overrideText);
    setTesting(true);
    try {
      const res = await testLanguagePipeline(workspaceId, query);
      if (!res.success || !res.result) {
        toast.show({ tone: 'bad', message: res.error || 'Pipeline test failed.' });
        return;
      }
      setPipelineRes(res.result);
    } finally {
      setTesting(false);
    }
  };

  const patchConfig = async (
    key: string,
    patch: Parameters<typeof updateLanguageConfig>[1],
    toastMsg: string,
  ) => {
    setSavingKey(key);
    try {
      const res = await updateLanguageConfig(workspaceId, patch);
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error || 'Could not update setting.' });
        return;
      }
      toast.show({ tone: 'ok', message: toastMsg });
      state.reload();
    } finally {
      setSavingKey(null);
    }
  };

  const columns: Column<LanguageCoverageRow>[] = [
    {
      key: 'lang',
      header: 'Language',
      cell: (r) => (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-[16px]" aria-hidden="true">
            {r.flag}
          </span>
          <div>
            <div className="font-medium text-o-text">{r.name}</div>
            <div className="text-[11.5px] text-o-text-3">
              {r.nativeName} · {r.code.toUpperCase()}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'native',
      header: 'Native',
      hideBelow: 'md',
      cell: (r) => capBadge(r.nativeSupport),
    },
    {
      key: 'roman',
      header: 'Romanized',
      hideBelow: 'sm',
      cell: (r) => capBadge(r.romanizedSupport),
    },
    {
      key: 'mixed',
      header: 'Mixed',
      hideBelow: 'lg',
      cell: (r) => capBadge(r.mixedSupport),
    },
    {
      key: 'voice',
      header: 'Voice',
      hideBelow: 'lg',
      cell: (r) => capBadge(r.voiceSupport),
    },
    {
      key: 'share',
      header: '30d volume',
      align: 'right',
      cell: (r) => (
        <span className="o-num text-[12.5px] text-o-text">
          {fmtInt(r.inboundCount30d)} {r.sharePct30d > 0 ? `(${r.sharePct30d}%)` : ''}
        </span>
      ),
    },
    {
      key: 'acc',
      header: 'Accuracy',
      align: 'right',
      hideBelow: 'sm',
      cell: (r) => (
        <span className="o-num text-[12.5px] text-o-text-2">
          {r.accuracyPct30d !== null ? fmtPct(r.accuracyPct30d) : '—'}
        </span>
      ),
    },
    {
      key: 'on',
      header: 'Enabled',
      align: 'right',
      cell: (r) => (
        <Toggle
          hideLabel
          label={`Enable ${r.name}`}
          checked={r.enabled}
          disabled={!canManage || savingKey === `lang-${r.code}` || r.code === 'en'}
          onChange={(checked) =>
            patchConfig(
              `lang-${r.code}`,
              { enabledLanguages: { [r.code]: checked } },
              `${r.name} ${checked ? 'enabled' : 'disabled'} for autopilot.`,
            )
          }
        />
      ),
    },
  ];

  const kpis = data?.kpis;
  const cfg = data?.config;

  return (
    <PageContainer>
      <PageHeader
        title="Languages"
        description="Real-time script detection, Romanized normalization, verified translation, and agent English previews"
      />

      {state.loading && !data ? (
        <Card>
          <SkeletonRows rows={6} />
        </Card>
      ) : state.error ? (
        <ErrorState title="Could not load multilingual settings" body={state.error} onRetry={state.reload} />
      ) : data ? (
        <div className="space-y-4">
          {/* 5 KPI Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Languages active (30d)</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-text">
                {fmtInt(kpis?.languagesDetected30d ?? 0)}
              </div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Non-English messages</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-text">
                {fmtInt(kpis?.nonEnglishReplies30d ?? 0)}
              </div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Romanized handled</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-ai-text">
                {fmtInt(kpis?.romanizedHandled30d ?? 0)}
              </div>
            </Card>
            <Card>
              <div className="text-[12px] font-medium text-o-text-3">Multilingual QA</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-ok">
                {kpis?.multilingualAccuracyPct !== null && kpis?.multilingualAccuracyPct !== undefined
                  ? fmtPct(kpis.multilingualAccuracyPct)
                  : '—'}
              </div>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <div className="text-[12px] font-medium text-o-text-3">Voice notes</div>
              <div className="o-num mt-1 text-[22px] font-semibold text-o-text">
                {fmtInt(kpis?.voiceNotesTranscribed30d ?? 0)}
              </div>
            </Card>
          </div>

          {/* Try the Engine 5-step Live Pipeline Card */}
          <Card>
            <CardHeader
              title="Try the multilingual engine"
              sub="Test how incoming messages run live through Detect -> Normalise -> Search -> Verify -> Answer"
            />

            <div className="mb-3 flex flex-wrap gap-1.5">
              {PIPELINE_QUICK_TESTS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => runPipeline(sample.text)}
                  className="rounded-full border border-o-border bg-o-surface-2 px-3 py-1 text-[12px] font-medium text-o-text-2 hover:border-o-ai hover:text-o-text"
                >
                  <Sparkles size={11} className="mr-1 inline text-o-ai-text" />
                  {sample.label}
                </button>
              ))}
            </div>

            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                runPipeline();
              }}
            >
              <Input
                aria-label="Sample customer message"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Type any customer question in Arabic, Roman Urdu, Hindi, Spanish, French…"
              />
              <Button
                type="submit"
                variant="ai"
                size="md"
                loading={testing}
                leading={<Play size={14} />}
                className="shrink-0"
              >
                Run pipeline
              </Button>
            </form>

            {pipelineRes ? (
              <div className="mt-4 space-y-4">
                {/* 5 pipeline stage pills */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {pipelineRes.steps.map((st, idx) => (
                    <div
                      key={st.id}
                      className="rounded-[12px] border border-o-border bg-o-surface-2 p-2.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-o-ai-text">
                        <span>
                          {idx + 1}. {st.label}
                        </span>
                        <span className="o-num text-o-text-3">{st.durationMs}ms</span>
                      </div>
                      <div className="mt-1 text-[12px] leading-snug text-o-text-2">{st.detail}</div>
                    </div>
                  ))}
                </div>

                {/* Customer vs Agent view */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-[12px] border border-o-border bg-o-bg p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
                        Customer receives ({pipelineRes.detectedName})
                      </span>
                      <Badge tone="ai">{pipelineRes.confidencePct}% confidence</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-o-text">
                      {pipelineRes.customerReply}
                    </p>
                  </div>

                  <div className="rounded-[12px] border border-o-border bg-o-bg p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
                        Agent Inbox sees (English)
                      </span>
                      {pipelineRes.wouldHandoff ? (
                        <Badge tone="warn">
                          <AlertTriangle size={11} className="mr-1" />
                          Handoff triggered
                        </Badge>
                      ) : (
                        <Badge tone="ok">{pipelineRes.verificationVerdict}</Badge>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-o-text">
                      {pipelineRes.agentEnglishPreview}
                    </p>
                    {pipelineRes.handoffReason ? (
                      <div className="mt-2 text-[12px] text-o-warn">{pipelineRes.handoffReason}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </Card>

          {/* Table + Behaviour Settings */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
            <Card className="lg:col-span-8">
              <CardHeader
                title="Language coverage"
                sub="Native script, Romanized transliteration, mixed-language & real 30-day workspace volume"
                actions={
                  <div className="relative w-full sm:w-[210px]">
                    <Search
                      size={13}
                      className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-o-text-3"
                    />
                    <Input
                      aria-label="Filter languages"
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      placeholder="Filter language…"
                      className="pl-8"
                    />
                  </div>
                }
              />

              {filteredLanguages.length === 0 ? (
                <EmptyState
                  icon={<Globe size={18} />}
                  title="No matching languages"
                  body="Clear your search filter to inspect all supported languages."
                />
              ) : (
                <Table<LanguageCoverageRow>
                  caption="Supported languages coverage"
                  rows={filteredLanguages}
                  rowKey={(r) => r.code}
                  columns={columns}
                />
              )}
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader
                title="Translation & reply behaviour"
                sub="Applies to AI Autopilot and Inbox translation"
              />
              {cfg ? (
                <div className="space-y-4">
                  <Field label="AI reply script style">
                    <Select
                      aria-label="AI reply script style"
                      value={cfg.reply_style}
                      disabled={!canManage || savingKey === 'reply_style'}
                      onChange={(e) =>
                        patchConfig(
                          'reply_style',
                          { replyStyle: e.target.value as AgentReplyLanguageMode },
                          'Updated AI reply language style.',
                        )
                      }
                      options={[
                        { value: 'match_customer', label: 'Match customer language & script' },
                        { value: 'native_script', label: 'Prefer native script' },
                        { value: 'english_only', label: 'Reply in English only' },
                      ]}
                    />
                  </Field>

                  <Toggle
                    label="Switch language mid-conversation"
                    description="Adapts dynamically if customer changes scripts."
                    checked={cfg.switch_mid_conversation}
                    disabled={!canManage || savingKey === 'switch_mid'}
                    onChange={(v) =>
                      patchConfig('switch_mid', { switchMidConversation: v }, 'Updated mid-conversation switching.')
                    }
                  />

                  <Toggle
                    label="Show English translation in Inbox"
                    description="Adds readable English meaning alongside foreign threads."
                    checked={cfg.show_translation_to_agents}
                    disabled={!canManage || savingKey === 'show_trans'}
                    onChange={(v) =>
                      patchConfig('show_trans', { showTranslationToAgents: v }, 'Updated agent English translation preview.')
                    }
                  />

                  <Toggle
                    label="Transcribe incoming voice notes"
                    checked={cfg.transcribe_voice_notes}
                    disabled={!canManage || savingKey === 'transcribe'}
                    onChange={(v) =>
                      patchConfig('transcribe', { transcribeVoiceNotes: v }, 'Updated voice transcription preference.')
                    }
                  />

                  <Toggle
                    label="Reply to voice notes with audio"
                    description="Stores audio reply preference; TTS codec synthesis awaits [TO BE CHOSEN] voice provider."
                    checked={cfg.reply_voice_notes_audio}
                    disabled={!canManage || savingKey === 'voice_audio'}
                    onChange={(v) =>
                      patchConfig('voice_audio', { replyVoiceNotesAudio: v }, 'Saved audio reply preference.')
                    }
                  />

                  <Toggle
                    label="Handoff below confidence threshold"
                    checked={cfg.handoff_low_confidence}
                    disabled={!canManage || savingKey === 'handoff_conf'}
                    onChange={(v) =>
                      patchConfig('handoff_conf', { handoffLowConfidence: v }, 'Updated confidence escalation setting.')
                    }
                  />

                  <Field
                    label={`Escalation threshold (${Math.round(cfg.low_confidence_threshold * 100)}%)`}
                  >
                    <input
                      type="range"
                      min={0.35}
                      max={0.95}
                      step={0.05}
                      disabled={!canManage}
                      value={cfg.low_confidence_threshold}
                      onChange={(e) =>
                        patchConfig(
                          'threshold',
                          { lowConfidenceThreshold: Number(e.target.value) },
                          'Updated low-confidence handoff threshold.',
                        )
                      }
                      className="w-full accent-o-ai"
                    />
                  </Field>

                  <Alert tone="ai">
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <LanguagesIcon size={13} />
                      Inbound agent replies translate back automatically in Inbox <ArrowRight size={12} /> customer script.
                    </span>
                  </Alert>
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
