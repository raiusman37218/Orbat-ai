'use client';

import {
  getLanguagesBootstrapAction,
  testLanguagePipelineAction,
  updateLanguageConfigAction,
  type LanguageCoverageRow,
  type LanguagesBootstrap,
  type PipelineTestResult,
} from '@/app/actions/ai-languages';
import type { AgentReplyLanguageMode } from '@/lib/ai/agent-templates';
import type { LanguageConfigRow } from '@/lib/ai/agent-runtime';

export type {
  AgentReplyLanguageMode,
  LanguageConfigRow,
  LanguageCoverageRow,
  LanguagesBootstrap,
  PipelineTestResult,
};

// TODO(backend): Voice-note audio output synthesis (`reply_voice_notes_audio`) stores
// the workspace preference cleanly in `ai_language_configs`; real-time outbound TTS audio
// file rendering awaits speech provider / telephony codec selection (`[TO BE CHOSEN]`).

/** Quick test inputs to run straight through the live 5-step pipeline tester. */
export const PIPELINE_QUICK_TESTS: { label: string; text: string }[] = [
  { label: 'Roman Urdu', text: 'Mera order abhi tak deliver nahi hua, kab tak milega?' },
  { label: 'Arabic', text: 'مرحبًا، ما هي ساعات عمل خدمة العملاء وهل يمكنني استرداد المبلغ؟' },
  { label: 'Roman Hindi', text: 'Kya main apna subscription plan cancel ya refund kar sakta hoon?' },
  { label: 'Spanish', text: 'Hola, como puedo restablecer mi contraseña o hablar con soporte?' },
];

export function getLanguagesBootstrap(workspaceId: string) {
  return getLanguagesBootstrapAction(workspaceId);
}

export function updateLanguageConfig(
  workspaceId: string,
  input: Parameters<typeof updateLanguageConfigAction>[1],
) {
  return updateLanguageConfigAction(workspaceId, input);
}

export function testLanguagePipeline(workspaceId: string, text: string) {
  return testLanguagePipelineAction(workspaceId, { text });
}
