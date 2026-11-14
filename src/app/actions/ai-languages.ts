'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import { errorMessage } from '@/lib/errors/user-error';
import { getLanguageConfig, resolveWorkspaceLlmConfig, tryWorkspaceChat, verifyReplyClaimsAgainstKnowledge, type LanguageConfigRow } from '@/lib/ai/agent-runtime';
import {
  detectLanguage,
  getLanguageInfo,
  isNonLatinLanguage,
  isRomanizedText,
  romanUrduToUrdu,
  translateAgentReply,
  translateToEnglish,
} from '@/lib/ai/translator';
import { freshKnowledgeIndex } from '@/lib/ai/help-answer';
import { search } from '@/lib/ai/retrieval';
import { buildSupportAgentPrompt } from '@/lib/ai/support-agent';
import type { AgentReplyLanguageMode } from '@/lib/ai/agent-templates';

export interface LanguageCoverageRow {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  nativeSupport: 'Yes' | 'Partial' | 'No';
  romanizedSupport: 'Yes' | 'Partial' | 'No';
  mixedSupport: 'Yes' | 'Partial' | 'No';
  voiceSupport: 'Yes' | 'Partial' | 'No';
  enabled: boolean;
  inboundCount30d: number;
  sharePct30d: number;
  accuracyPct30d: number | null;
}

export interface LanguagesBootstrap {
  canManage: boolean;
  config: LanguageConfigRow;
  kpis: {
    languagesDetected30d: number;
    nonEnglishReplies30d: number;
    romanizedHandled30d: number;
    multilingualAccuracyPct: number | null;
    voiceNotesTranscribed30d: number;
  };
  languages: LanguageCoverageRow[];
}

export interface PipelineTestResult {
  inputText: string;
  detectedCode: string;
  detectedName: string;
  scriptMode: 'native' | 'romanized' | 'mixed';
  normalizedEnglish: string;
  knowledgeHits: { id: string; title: string; slug: string | null; score: number }[];
  customerReply: string;
  agentEnglishPreview: string;
  verificationVerdict: 'supported' | 'needs_review';
  verificationSummary: string;
  confidencePct: number;
  wouldHandoff: boolean;
  handoffReason: string | null;
  usedLlm: boolean;
  steps: {
    id: string;
    label: string;
    detail: string;
    durationMs: number;
  }[];
}

const CAPABILITY_MATRIX: Record<
  string,
  {
    nativeSupport: 'Yes' | 'Partial' | 'No';
    romanizedSupport: 'Yes' | 'Partial' | 'No';
    mixedSupport: 'Yes' | 'Partial' | 'No';
    voiceSupport: 'Yes' | 'Partial' | 'No';
  }
> = {
  en: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  ur: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  hi: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  ar: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  es: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  fr: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  bn: { nativeSupport: 'Yes', romanizedSupport: 'Partial', mixedSupport: 'Partial', voiceSupport: 'Partial' },
  tl: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  id: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  pt: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  de: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  tr: { nativeSupport: 'Yes', romanizedSupport: 'Yes', mixedSupport: 'Yes', voiceSupport: 'Yes' },
  zh: { nativeSupport: 'Yes', romanizedSupport: 'Partial', mixedSupport: 'Partial', voiceSupport: 'Yes' },
  ja: { nativeSupport: 'Yes', romanizedSupport: 'Partial', mixedSupport: 'Partial', voiceSupport: 'Yes' },
};

export async function getLanguagesBootstrapAction(
  workspaceId: string,
): Promise<LanguagesBootstrap> {
  const { role } = await getWorkspaceAccess(workspaceId, 'view');
  const canManage = role === 'owner' || role === 'admin';

  const [config, msgLangRows, verifLangRows] = await Promise.all([
    getLanguageConfig(workspaceId),
    queryRows<{
      lang_code: string;
      is_romanized: boolean;
      has_translation: boolean;
      has_voice: boolean;
      cnt: string;
    }>(
      `SELECT
         LOWER(COALESCE(NULLIF(m.metadata->>'detected_language', ''), 'en')) AS lang_code,
         COALESCE((m.metadata->>'is_romanized')::boolean, false) AS is_romanized,
         (m.metadata ? 'translated_text' OR m.metadata ? 'english_text') AS has_translation,
         (m.metadata ? 'voice_transcription' OR COALESCE(m.attachment_url, '') ~* '\\.(ogg|mp3|wav|webm|m4a)$') AS has_voice,
         COUNT(*)::text AS cnt
       FROM public.messages m
       JOIN public.conversations c ON c.id = m.conversation_id
       WHERE c.workspace_id = $1
         AND m.created_at >= now() - interval '30 days'
         AND m.sender_type = 'visitor'
       GROUP BY 1, 2, 3, 4`,
      [workspaceId],
    ).catch(() => []),
    queryRows<{
      lang_code: string;
      reviewed_cnt: string;
      correct_cnt: string;
    }>(
      `SELECT
         LOWER(COALESCE(NULLIF(metadata->>'detected_language', ''), NULLIF(metadata->>'language', ''), '')) AS lang_code,
         COUNT(*) FILTER (WHERE human_review IS NOT NULL)::text AS reviewed_cnt,
         COUNT(*) FILTER (WHERE human_review = 'correct')::text AS correct_cnt
       FROM public.ai_verification_logs
       WHERE workspace_id = $1
         AND created_at >= now() - interval '30 days'
       GROUP BY 1`,
      [workspaceId],
    ).catch(() => []),
  ]);

  const countsByLang = new Map<string, number>();
  let totalVisitorMsgs = 0;
  let nonEnglishCount = 0;
  let romanizedCount = 0;
  let voiceNotesCount = 0;

  for (const row of msgLangRows) {
    const code = (row.lang_code || 'en').trim().toLowerCase() || 'en';
    const cnt = Number(row.cnt || 0);
    totalVisitorMsgs += cnt;
    countsByLang.set(code, (countsByLang.get(code) ?? 0) + cnt);
    if (code !== 'en') nonEnglishCount += cnt;
    if (row.is_romanized) romanizedCount += cnt;
    if (row.has_voice) voiceNotesCount += cnt;
  }

  let totalReviewed = 0;
  let totalCorrect = 0;
  const accuracyByLang = new Map<string, number>();
  for (const row of verifLangRows) {
    const rev = Number(row.reviewed_cnt || 0);
    const cor = Number(row.correct_cnt || 0);
    if (rev > 0) {
      if (row.lang_code && row.lang_code !== 'en') {
        totalReviewed += rev;
        totalCorrect += cor;
      }
      if (row.lang_code) {
        accuracyByLang.set(row.lang_code, Math.round((cor / rev) * 100));
      }
    }
  }

  const allCodes = new Set<string>([
    ...Object.keys(CAPABILITY_MATRIX),
    ...Object.keys(config.enabled_languages || {}),
    ...Array.from(countsByLang.keys()),
  ]);

  const languages: LanguageCoverageRow[] = Array.from(allCodes)
    .map((code) => {
      const info = getLanguageInfo(code);
      const caps = CAPABILITY_MATRIX[code] ?? {
        nativeSupport: 'Yes' as const,
        romanizedSupport: isNonLatinLanguage(code) ? ('Partial' as const) : ('Yes' as const),
        mixedSupport: 'Partial' as const,
        voiceSupport: 'Partial' as const,
      };
      const inboundCount30d = countsByLang.get(code) ?? 0;
      const sharePct30d =
        totalVisitorMsgs > 0 ? Number(((inboundCount30d / totalVisitorMsgs) * 100).toFixed(1)) : 0;
      const enabled =
        code in config.enabled_languages
          ? Boolean(config.enabled_languages[code])
          : true;

      return {
        code,
        name: info.name,
        nativeName: info.nativeName || info.name,
        flag: info.flag || '🌐',
        nativeSupport: caps.nativeSupport,
        romanizedSupport: caps.romanizedSupport,
        mixedSupport: caps.mixedSupport,
        voiceSupport: caps.voiceSupport,
        enabled,
        inboundCount30d,
        sharePct30d,
        accuracyPct30d: accuracyByLang.get(code) ?? null,
      };
    })
    .sort((a, b) => {
      if (b.inboundCount30d !== a.inboundCount30d) return b.inboundCount30d - a.inboundCount30d;
      if (a.code === 'en') return -1;
      if (b.code === 'en') return 1;
      return a.name.localeCompare(b.name);
    });

  return {
    canManage,
    config,
    kpis: {
      languagesDetected30d: countsByLang.size,
      nonEnglishReplies30d: nonEnglishCount,
      romanizedHandled30d: romanizedCount,
      multilingualAccuracyPct:
        totalReviewed > 0 ? Math.round((totalCorrect / totalReviewed) * 100) : null,
      voiceNotesTranscribed30d: voiceNotesCount,
    },
    languages,
  };
}

export async function updateLanguageConfigAction(
  workspaceId: string,
  input: {
    replyStyle?: AgentReplyLanguageMode;
    switchMidConversation?: boolean;
    showTranslationToAgents?: boolean;
    transcribeVoiceNotes?: boolean;
    replyVoiceNotesAudio?: boolean;
    handoffLowConfidence?: boolean;
    lowConfidenceThreshold?: number;
    enabledLanguages?: Record<string, boolean>;
  },
): Promise<{ success: boolean; config?: LanguageConfigRow; error?: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const current = await getLanguageConfig(workspaceId);

    const nextReplyStyle = input.replyStyle ?? current.reply_style;
    const nextSwitchMid = input.switchMidConversation ?? current.switch_mid_conversation;
    const nextShowTrans = input.showTranslationToAgents ?? current.show_translation_to_agents;
    const nextTranscribe = input.transcribeVoiceNotes ?? current.transcribe_voice_notes;
    const nextVoiceAudio = input.replyVoiceNotesAudio ?? current.reply_voice_notes_audio;
    const nextHandoffLow = input.handoffLowConfidence ?? current.handoff_low_confidence;
    const nextThreshold = Math.min(
      0.99,
      Math.max(0.3, Number(input.lowConfidenceThreshold ?? current.low_confidence_threshold)),
    );
    const nextEnabled = {
      ...current.enabled_languages,
      ...(input.enabledLanguages ?? {}),
    };

    await query(
      `INSERT INTO public.ai_language_configs (
         workspace_id, reply_style, switch_mid_conversation, show_translation_to_agents,
         transcribe_voice_notes, reply_voice_notes_audio, handoff_low_confidence,
         low_confidence_threshold, enabled_languages, updated_by, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,now())
       ON CONFLICT (workspace_id) DO UPDATE SET
         reply_style = EXCLUDED.reply_style,
         switch_mid_conversation = EXCLUDED.switch_mid_conversation,
         show_translation_to_agents = EXCLUDED.show_translation_to_agents,
         transcribe_voice_notes = EXCLUDED.transcribe_voice_notes,
         reply_voice_notes_audio = EXCLUDED.reply_voice_notes_audio,
         handoff_low_confidence = EXCLUDED.handoff_low_confidence,
         low_confidence_threshold = EXCLUDED.low_confidence_threshold,
         enabled_languages = EXCLUDED.enabled_languages,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [
        workspaceId,
        nextReplyStyle,
        nextSwitchMid,
        nextShowTrans,
        nextTranscribe,
        nextVoiceAudio,
        nextHandoffLow,
        nextThreshold,
        JSON.stringify(nextEnabled),
        user.id,
      ],
    );

    // Keep primary agent's reply_language_mode aligned if replyStyle was updated
    if (input.replyStyle) {
      await query(
        `UPDATE public.ai_agents
         SET reply_language_mode = $2, updated_at = now()
         WHERE workspace_id = $1 AND is_primary = true`,
        [workspaceId, nextReplyStyle],
      );
    }

    const updated = await getLanguageConfig(workspaceId);
    return { success: true, config: updated };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not update language configuration.') };
  }
}

export async function testLanguagePipelineAction(
  workspaceId: string,
  input: { text: string },
): Promise<{ success: boolean; result?: PipelineTestResult; error?: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'view');
    const text = input.text.trim();
    if (!text) return { success: false, error: 'Enter a sample customer message first.' };

    const [config, providerConfig, wsRows] = await Promise.all([
      getLanguageConfig(workspaceId),
      resolveWorkspaceLlmConfig(workspaceId),
      queryRows<{ name: string; industry: string | null }>(
        `SELECT name, industry FROM public.workspaces WHERE id = $1 LIMIT 1`,
        [workspaceId],
      ),
    ]);
    const wsName = wsRows[0]?.name || 'Workspace';

    // Step 1: Detect
    const t0 = Date.now();
    const detected = detectLanguage(text);
    const isRoman = isRomanizedText(detected.code, text);
    const info = getLanguageInfo(detected.code);
    const hasMixedLatin =
      detected.code !== 'en' && /[a-zA-Z]{2,}/.test(text) && /[^\u0000-\u007F]/.test(text);
    const scriptMode: PipelineTestResult['scriptMode'] = isRoman
      ? 'romanized'
      : hasMixedLatin
        ? 'mixed'
        : 'native';
    const t1 = Date.now();

    // Step 2: Normalise -> English
    const normalized = await translateToEnglish({
      text,
      detectedLanguage: detected.code,
      providerConfig,
    });
    const finalLangCode = normalized.detectedLanguageCode || detected.code || 'en';
    const finalInfo = getLanguageInfo(finalLangCode);
    const finalIsRoman = isRomanizedText(finalLangCode, text);
    const urduHint =
      finalLangCode === 'ur' && finalIsRoman ? ` -> ${romanUrduToUrdu(text).slice(0, 80)}` : '';
    const t2 = Date.now();

    // Step 3: Search English index
    const index = await freshKnowledgeIndex(workspaceId);
    const hits = search(index, normalized.englishText || text, { limit: 3 });
    const knowledgeHits = hits.map((h) => ({
      id: h.article.id,
      title: h.article.title,
      slug: h.article.slug ?? null,
      score: Number(h.score.toFixed(2)),
    }));
    const t3 = Date.now();

    // Step 4: Draft + Verify + Sentinel
    const knowledgeBlock = hits
      .map((h, i) => `[ARTICLE ${i + 1}: ${h.article.title}]\n${h.article.content.slice(0, 1400)}`)
      .join('\n\n---\n\n');

    const englishPrompt = buildSupportAgentPrompt({
      botName: `${wsName} Support`,
      businessName: wsName,
      industry: wsRows[0]?.industry ?? null,
      knowledge: knowledgeBlock || 'No published workspace knowledge articles matched this query.',
      lang: 'en',
    });

    const llmEnglish = await tryWorkspaceChat(
      workspaceId,
      englishPrompt,
      `Customer question (normalised to English): ${normalized.englishText || text}`,
      450,
    );

    let agentEnglishPreview = '';
    let usedLlm = false;
    let wouldHandoff = false;
    let handoffReason: string | null = null;

    if (llmEnglish) {
      usedLlm = true;
      if (/\[HANDOVER(?::\s*([^\]]*))?\]/i.test(llmEnglish)) {
        wouldHandoff = true;
        const m = llmEnglish.match(/\[HANDOVER(?::\s*([^\]]*))?\]/i);
        handoffReason = m?.[1]?.trim() || 'Model marked query for human specialist';
        agentEnglishPreview = llmEnglish.replace(/\[(?:SOURCE|HANDOVER|NOT_COVERED)[^\]]*\]/gi, '').trim();
      } else {
        agentEnglishPreview = llmEnglish.replace(/\[(?:SOURCE|HANDOVER|NOT_COVERED)[^\]]*\]/gi, '').trim();
      }
    } else if (hits.length > 0 && hits[0].score > 0.35) {
      const clean = hits[0].article.content.replace(/\s+/g, ' ').trim();
      agentEnglishPreview = `${clean.slice(0, 320)}${clean.length > 320 ? '…' : ''}`;
    } else {
      wouldHandoff = true;
      handoffReason = 'No Knowledge Base match met the workspace confidence threshold';
      agentEnglishPreview =
        index.docs.length === 0
          ? 'I could not find any published Knowledge Base articles yet, so I am routing this message to a team specialist.'
          : 'I could not verify a specific answer from our Help Center docs, so I am routing this conversation to a specialist on our team.';
    }

    const verification = await verifyReplyClaimsAgainstKnowledge(
      workspaceId,
      agentEnglishPreview,
      hits[0]?.article.title ?? null,
    );
    const topScore = hits[0]?.score ?? 0;
    const confidencePct = Math.min(
      98,
      Math.max(32, Math.round((usedLlm ? 56 : 38) + Math.min(topScore, 1) * 40)),
    );
    if (
      config.handoff_low_confidence &&
      confidencePct < Math.round(config.low_confidence_threshold * 100)
    ) {
      wouldHandoff = true;
      handoffReason =
        handoffReason ||
        `Confidence (${confidencePct}%) fell below ${Math.round(config.low_confidence_threshold * 100)}% handoff threshold`;
    }
    const t4 = Date.now();

    // Step 5: Render customer answer in configured style/script
    let customerReply = agentEnglishPreview;
    if (config.reply_style !== 'english_only' && finalLangCode !== 'en') {
      const wantRoman = config.reply_style === 'match_customer' ? finalIsRoman : false;
      const translated = await translateAgentReply({
        text: agentEnglishPreview,
        targetLanguageCode: finalLangCode,
        sourceLanguageCode: 'en',
        romanize: wantRoman,
        providerConfig,
        businessName: wsName,
      });
      if (translated.translatedText) {
        customerReply = translated.translatedText;
      }
    }
    const t5 = Date.now();

    return {
      success: true,
      result: {
        inputText: text,
        detectedCode: finalLangCode,
        detectedName: finalIsRoman ? `Roman ${finalInfo.name}` : finalInfo.name,
        scriptMode,
        normalizedEnglish: normalized.englishText,
        knowledgeHits,
        customerReply,
        agentEnglishPreview,
        verificationVerdict: verification.verdict,
        verificationSummary: `${verification.claims.filter((c) => c.supported).length}/${Math.max(verification.claims.length, 1)} claims verified${wouldHandoff ? ' · routed to handoff' : ''}`,
        confidencePct,
        wouldHandoff,
        handoffReason,
        usedLlm,
        steps: [
          {
            id: 'detect',
            label: 'Detect',
            detail: `${finalIsRoman ? `Roman ${finalInfo.name}` : info.name} (${finalLangCode}, ${scriptMode})${urduHint}`,
            durationMs: Math.max(1, t1 - t0),
          },
          {
            id: 'normalise',
            label: 'Normalise',
            detail: `English meaning: "${normalized.englishText.slice(0, 120)}${normalized.englishText.length > 120 ? '…' : ''}"`,
            durationMs: Math.max(1, t2 - t1),
          },
          {
            id: 'search',
            label: 'Search',
            detail:
              knowledgeHits.length > 0
                ? `Top match: ${knowledgeHits[0].title} (${knowledgeHits[0].score})`
                : `Searched ${index.docs.length} workspace articles (no strong hit)`,
            durationMs: Math.max(1, t3 - t2),
          },
          {
            id: 'verify',
            label: 'Verify + Sentinel',
            detail: `${verification.verdict} · confidence ${confidencePct}%${wouldHandoff ? ' · escalation' : ''}`,
            durationMs: Math.max(1, t4 - t3),
          },
          {
            id: 'answer',
            label: 'Answer',
            detail: `Style: ${config.reply_style.replace(/_/g, ' ')} -> ${config.reply_style === 'english_only' ? 'English' : finalIsRoman && config.reply_style === 'match_customer' ? `Roman ${finalInfo.name}` : finalInfo.name}`,
            durationMs: Math.max(1, t5 - t4),
          },
        ],
      },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Pipeline test failed.') };
  }
}
