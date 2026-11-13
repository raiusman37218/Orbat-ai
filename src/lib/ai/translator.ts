/**
 * Real-time bidirectional translation engine for customer support.
 *
 * Capabilities:
 * 1. Automatic language detection (Arabic, Hindi, Urdu, Spanish, French, German, Russian, Chinese, etc.)
 * 2. Translates customer foreign messages into clear English for support agents in the dashboard
 * 3. Translates agent English replies into the customer's native language with polite, human support tone
 * 4. Dual-layer engine: Uses configured LLM (OpenAI, Gemini, Anthropic, DeepSeek) with zero-config free translation fallback
 */

import { chat, isConfigured, ProviderConfig } from './provider';
import { getPlatformAiConfigServerOnly } from './platform-gateway';

import {
  isNonLatinLanguage,
  isRomanizedText,
  getLanguageInfo,
  isLatinScript,
  isRomanUrdu,
  translateWithGoogleGtx,
  translateViaFreeApi,
  isLikelyEnglishText,
  normalizeDetectedLanguage,
  detectLanguage,
  ROMAN_URDU_WORDS_REGEX,
  romanUrduToUrdu,
} from './translator-client';

export * from './translator-client';

/**
 * Translates customer text into English for support agents in the dashboard.
 * Auto-detects foreign languages (including Italian, Arabic, Urdu, Spanish, etc.) and guarantees English output.
 */
export async function translateToEnglish({
  text,
  detectedLanguage,
  providerConfig,
}: {
  text: string;
  detectedLanguage?: string;
  providerConfig?: ProviderConfig | null;
}): Promise<{
  englishText: string;
  sourceLanguage: string;
  detectedLanguageCode: string;
  isOriginalEnglish: boolean;
}> {
  if (!text || !text.trim()) {
    return {
      englishText: text || '',
      sourceLanguage: 'English',
      detectedLanguageCode: 'en',
      isOriginalEnglish: true,
    };
  }

  const trimmed = text.trim();

  // If text has only numbers, punctuation, or emojis (e.g. "5000", "???"),
  // or is plainly English, there is nothing to translate \u2014 and no reason to
  // spend a model call finding that out.
  if (!/[a-zA-Z\u00C0-\uFFFF]/.test(trimmed) || isLikelyEnglishText(trimmed)) {
    return {
      englishText: trimmed,
      sourceLanguage: 'English',
      detectedLanguageCode: 'en',
      isOriginalEnglish: true,
    };
  }

  // "Roman Urdu", "Roman Arabic", "Roman Russian": the language, typed in Latin letters.
  const nameFor = (code: string) =>
    isRomanizedText(code, trimmed) ? `Roman ${getLanguageInfo(code).name}` : getLanguageInfo(code).name;

  // 1. Try AI provider if configured in platform settings
  const activeConfig = isConfigured(providerConfig)
    ? providerConfig
    : (await getPlatformAiConfigServerOnly()).config;

  if (isConfigured(activeConfig)) {
    try {
      const res = await chat(activeConfig!, {
        system:
          'You are a professional real-time customer support translator.\n' +
          'Translate the customer message into clear, natural, accurate English so the support agent can easily understand their issue or question.\n' +
          'The message may be in any language, including a language typed in Latin letters (Roman Urdu/Hindi, Arabizi such as "kifak 3amel", transliterated Russian, Bengali, Persian, Greek, Hebrew, etc.) — translate those too, and report the language itself (e.g. "ar" for Arabizi).\n' +
          'Preserve all numbers, proper nouns, emails, and links exactly as they are.\n' +
          'Respond with ONLY a JSON object: {"english_text": "...", "detected_language": "ISO 639-1 code", "is_original_english": boolean}',
        messages: [{ role: 'user', content: trimmed }],
        maxTokens: 500,
        temperature: 0,
        reasoning: 'fast',
        timeoutMs: 6000,
      });

      const raw = res.text?.trim() || '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.english_text) {
          const code = normalizeDetectedLanguage(parsed.detected_language || 'en', trimmed);
          return {
            englishText: parsed.english_text.trim(),
            sourceLanguage: nameFor(code),
            detectedLanguageCode: code,
            isOriginalEnglish: Boolean(parsed.is_original_english || (code === 'en' && parsed.english_text.trim() === trimmed)),
          };
        }
      }
    } catch (err) {
      console.warn('[translateToEnglish] AI Provider error, falling back to Google engine:', err);
    }
  }

  // 2. High-speed Google GTX translation & language auto-detection
  const googleRes = await translateWithGoogleGtx(trimmed, 'en', 'auto');
  if (googleRes) {
    const code = googleRes.romanizedSource
      ? googleRes.detectedLanguage
      : normalizeDetectedLanguage(googleRes.detectedLanguage || 'en', trimmed);
    const isNonEnglish = code !== 'en';

    return {
      englishText: googleRes.translated,
      sourceLanguage: nameFor(code),
      detectedLanguageCode: code,
      isOriginalEnglish: !isNonEnglish,
    };
  }

  // 3. Fallback: MyMemory
  const heuristic = detectedLanguage
    ? { code: detectedLanguage, name: getLanguageInfo(detectedLanguage).name }
    : detectLanguage(trimmed);

  if (heuristic.code !== 'en') {
    const freeTranslation = await translateViaFreeApi(trimmed, heuristic.code, 'en');
    if (freeTranslation) {
      return {
        englishText: freeTranslation,
        sourceLanguage: heuristic.name,
        detectedLanguageCode: heuristic.code,
        isOriginalEnglish: false,
      };
    }
  }

  return {
    englishText: trimmed,
    sourceLanguage: heuristic.name,
    detectedLanguageCode: heuristic.code,
    isOriginalEnglish: heuristic.code === 'en',
  };
}

export interface AgentReplyTranslationResult {
  translatedText: string;
  englishText: string;
  detectedSourceLanguage: string;
  sourceLanguageName: string;
  targetLanguage: string;
  targetLanguageName: string;
  isTranslated: boolean;
}

/**
 * Translates support agent's reply from ANY language (English, Roman Urdu, Urdu, Hindi, Spanish, French, etc.)
 * into the customer's native target language, while also generating/preserving an English version for the agent's dashboard.
 */
export async function translateAgentReply({
  text,
  targetLanguageCode,
  sourceLanguageCode,
  providerConfig,
  businessName,
  romanize = false,
}: {
  text: string;
  targetLanguageCode: string;
  sourceLanguageCode?: string;
  providerConfig?: ProviderConfig | null;
  businessName?: string;
  /** The visitor writes this language in Latin letters (Roman Urdu / Hindi). */
  romanize?: boolean;
}): Promise<AgentReplyTranslationResult> {
  if (!text || !text.trim()) {
    const target = targetLanguageCode || 'en';
    return {
      translatedText: text,
      englishText: text,
      detectedSourceLanguage: 'en',
      sourceLanguageName: 'English',
      targetLanguage: target,
      targetLanguageName: getLanguageInfo(target).name,
      isTranslated: false,
    };
  }

  const targetLang = targetLanguageCode || 'en';
  const targetLangInfo = getLanguageInfo(targetLang);
  // Only meaningful for languages with their own script (Arabic, Hindi,
  // Russian, Bengali, Hebrew, Greek...); Spanish is Latin already.
  const romanTarget = romanize && isNonLatinLanguage(targetLang);
  const targetLabel = romanTarget
    ? `${targetLangInfo.name} written in Latin/English letters (Roman ${targetLangInfo.name}, the way the customer types it — e.g. Roman Urdu "aap ka order kal tak pohanch jayega", Arabizi "talabak rah yousal bokra") — never use the native script`
    : targetLangInfo.name;

  // 1. Try AI provider if configured in platform settings
  const activeConfig = isConfigured(providerConfig)
    ? providerConfig
    : (await getPlatformAiConfigServerOnly()).config;

  if (isConfigured(activeConfig)) {
    try {
      const brandContext = businessName ? ` representing ${businessName}` : '';
      const res = await chat(activeConfig!, {
        system:
          `You are an expert real-time multilingual customer support translation system${brandContext}.\n` +
          `A support agent wrote a reply to a customer in their preferred language (could be English, Roman Urdu, Urdu, Hindi, Spanish, French, Arabic, German, etc.).\n` +
          `The customer speaks: ${targetLabel} (language code: "${targetLang}").\n\n` +
          `Your task:\n` +
          `1. "customer_text": Translate the agent's message into natural, polite, respectful, and friendly ${targetLabel} for the customer. If target is English, provide clear English.\n` +
          `2. "english_text": Translate the agent's message into clear, natural, professional English for the support agent's dashboard. If the agent typed in English, keep it in English.\n` +
          `3. "detected_source_language": The 2-letter ISO code of the language the agent wrote in.\n\n` +
          `Important:\n` +
          `- Accurately understand Roman Urdu/Hindi Latin transliterations (e.g. "hum aapko 20% discount denge" -> English: "We will give you a 20% discount", translated to customer language).\n` +
          `- Keep all numbers, prices, URLs, emails, codes, and proper names untouched.\n` +
          `- Respond with ONLY a valid JSON object matching: {"customer_text": "...", "english_text": "...", "detected_source_language": "..."}`,
        messages: [{ role: 'user', content: text }],
        maxTokens: 1000,
        temperature: 0.1,
        reasoning: 'fast',
        timeoutMs: 8000,
      });

      const raw = res.text?.trim() || '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.customer_text && parsed.english_text) {
            const detectedCode = parsed.detected_source_language || 'en';
            return {
              translatedText: parsed.customer_text.trim(),
              englishText: parsed.english_text.trim(),
              detectedSourceLanguage: detectedCode,
              sourceLanguageName: getLanguageInfo(detectedCode).name,
              targetLanguage: targetLang,
              targetLanguageName: targetLangInfo.name,
              isTranslated: true,
            };
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[translateAgentReply] AI Provider failed, falling back to Google engine:', err);
    }
  }

  // 2. High-speed Google GTX translation engine
  // Step 2a: Generate English translation for dashboard
  let englishText = text;
  let detectedSourceLang = sourceLanguageCode || 'en';

  const enRes = isLikelyEnglishText(text)
    ? { translated: text, detectedLanguage: 'en' }
    : await translateWithGoogleGtx(text, 'en', sourceLanguageCode || 'auto');
  if (enRes) {
    englishText = enRes.translated;
    detectedSourceLang = enRes.detectedLanguage || 'en';
  } else {
    // Fallback: Check if Roman Urdu
    if (isRomanUrdu(text) || ROMAN_URDU_WORDS_REGEX.test(text)) {
      const urduScript = romanUrduToUrdu(text);
      const toEn = await translateViaFreeApi(urduScript, 'ur', 'en');
      if (toEn) englishText = toEn;
      detectedSourceLang = 'ur';
    }
  }

  // Step 2b: Translate to customer's target language
  let customerText = text;
  if (targetLang === 'en') {
    customerText = englishText;
  } else if (targetLang === detectedSourceLang && isLatinScript(text) === romanTarget) {
    // The agent already wrote in the customer's language and script.
    customerText = text;
  } else {
    // Pivot from englishText to customer's target language for maximum accuracy
    const targetRes = await translateWithGoogleGtx(englishText, targetLang, 'en', { romanize: romanTarget });
    if (targetRes?.translated) {
      customerText = targetRes.translated;
    } else {
      const direct = await translateViaFreeApi(text, detectedSourceLang, targetLang);
      if (direct) customerText = direct;
    }
  }

  const isActuallyTranslated =
    targetLang === 'en'
      ? englishText.trim().toLowerCase() !== text.trim().toLowerCase()
      : customerText.trim().toLowerCase() !== text.trim().toLowerCase();

  return {
    translatedText: customerText,
    englishText,
    detectedSourceLanguage: detectedSourceLang,
    sourceLanguageName: getLanguageInfo(detectedSourceLang).name,
    targetLanguage: targetLang,
    targetLanguageName: targetLangInfo.name,
    isTranslated: isActuallyTranslated,
  };
}

/**
 * Translates support agent English response into customer's native language.
 * (Maintained for backward-compatibility)
 */
export async function translateFromEnglish({
  englishText,
  targetLanguageCode,
  providerConfig,
  businessName,
}: {
  englishText: string;
  targetLanguageCode: string;
  providerConfig?: ProviderConfig | null;
  businessName?: string;
}): Promise<{ translatedText: string; targetLanguage: string; isTranslated: boolean }> {
  const res = await translateAgentReply({
    text: englishText,
    targetLanguageCode,
    providerConfig,
    businessName,
  });
  return {
    translatedText: res.translatedText,
    targetLanguage: res.targetLanguage,
    isTranslated: res.isTranslated,
  };
}

