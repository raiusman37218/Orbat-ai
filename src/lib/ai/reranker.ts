/**
 * Advanced RAG utilities: HyDE hypothetical passage generation and
 * AI + deterministic hybrid reranking for candidate chunks.
 */

import type { RetrievedChunk } from '@/types/database';
import { chat, isConfigured, type ProviderConfig } from './provider';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'was',
  'were', 'can', 'how', 'what', 'when', 'where', 'why', 'who', 'will', 'would',
  'could', 'should', 'have', 'has', 'had', 'not', 'but', 'all', 'any', 'into',
  'about', 'please', 'help', 'need', 'want', 'does', 'did', 'kya', 'hai', 'hain',
  'mein', 'ka', 'ke', 'ki', 'ko', 'aur', 'hum', 'aap', 'kar', 'karna',
]);

function tokenizeMeaningful(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Generates a concise hypothetical Help Center answer (HyDE) to bridge vocabulary
 * gaps between conversational questions and formal documentation chunks.
 * Returns null safely when no AI provider is configured or the call fails.
 */
export async function buildHydePassage({
  question,
  providerConfig,
  timeoutMs = 3500,
}: {
  question: string;
  providerConfig?: ProviderConfig | null;
  timeoutMs?: number;
}): Promise<string | null> {
  const cleaned = (question || '').trim();
  if (!cleaned || cleaned.length < 4 || !isConfigured(providerConfig)) {
    return null;
  }

  try {
    const res = await chat(providerConfig!, {
      system:
        'Write a brief, neutral 2-3 sentence Help Center excerpt that directly answers the topic of the user question using clear technical and product terminology. Do not invent specific dollar amounts, dates, or URLs; focus on standard domain concepts and workflows. Plain text only.',
      messages: [{ role: 'user', content: cleaned }],
      maxTokens: 150,
      temperature: 0.2,
      reasoning: 'fast',
      timeoutMs,
    });
    const text = (res.text || '').replace(/\s+/g, ' ').trim();
    return text.length >= 20 ? text.slice(0, 480) : null;
  } catch {
    return null;
  }
}

/**
 * Deterministic relevance score in [0, 1] combining query token coverage,
 * title/phrase matching, and pgvector hybrid similarity.
 */
export function computeDeterministicRelevance(
  query: string,
  expandedQueries: string[],
  chunk: Pick<RetrievedChunk, 'article_title' | 'section_name' | 'content' | 'combined_score' | 'similarity' | 'keyword_score'>,
): number {
  const haystack = `${chunk.article_title || ''} ${chunk.section_name || ''} ${chunk.content || ''}`.toLowerCase();
  const titleLower = (chunk.article_title || '').toLowerCase();
  const queryTerms = Array.from(
    new Set([query, ...expandedQueries].flatMap((q) => tokenizeMeaningful(q))),
  );

  let termHits = 0;
  let titleHits = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) termHits += 1;
    if (titleLower.includes(term)) titleHits += 1;
  }

  const coverage = queryTerms.length > 0 ? termHits / queryTerms.length : 0;
  const titleBoost = queryTerms.length > 0 ? Math.min(0.25, (titleHits / queryTerms.length) * 0.25) : 0;
  const cleanedPhrase = (query || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const phraseBoost = cleanedPhrase.length >= 8 && haystack.includes(cleanedPhrase) ? 0.15 : 0;

  const baseScore = Math.min(
    1,
    Math.max(0, Number(chunk.combined_score ?? chunk.similarity ?? chunk.keyword_score ?? 0)),
  );

  return Math.min(1, Math.max(0, baseScore * 0.5 + coverage * 0.35 + titleBoost + phraseBoost));
}

function parseRerankScores(rawText: string, maxIdx: number): Map<number, number> | null {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const bracketMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!bracketMatch) return null;
    try {
      parsed = JSON.parse(bracketMatch[0]);
    } catch {
      return null;
    }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { scores?: unknown[] }).scores)
      ? (parsed as { scores: unknown[] }).scores
      : null;
  if (!list || list.length === 0) return null;

  const map = new Map<number, number>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const idx = Number(rec.index);
    const score = Number(rec.score);
    if (Number.isInteger(idx) && idx >= 0 && idx < maxIdx && Number.isFinite(score)) {
      map.set(idx, Math.min(1, Math.max(0, score)));
    }
  }
  return map.size > 0 ? map : null;
}

/**
 * Reranks candidate chunks using fast structured AI scoring when a model is
 * configured, blending cleanly with deterministic lexical & vector relevance.
 */
export async function rerankRetrievedChunks<T extends RetrievedChunk>({
  query,
  queries = [],
  chunks,
  topK = 6,
  providerConfig,
  timeoutMs = 4000,
}: {
  query: string;
  queries?: string[];
  chunks: T[];
  topK?: number;
  providerConfig?: ProviderConfig | null;
  timeoutMs?: number;
}): Promise<{
  chunks: T[];
  reranked: boolean;
  usedLlm: boolean;
}> {
  if (!chunks.length) {
    return { chunks: [], reranked: false, usedLlm: false };
  }
  if (chunks.length === 1) {
    return { chunks: chunks.slice(0, topK), reranked: false, usedLlm: false };
  }

  const candidates = chunks.slice(0, 18);
  const heuristicScores = candidates.map((c) => computeDeterministicRelevance(query, queries, c));

  let llmScores: Map<number, number> | null = null;
  if (isConfigured(providerConfig)) {
    try {
      const passageList = candidates
        .map((c, idx) => {
          const snippet = (c.content || '').replace(/\s+/g, ' ').slice(0, 340);
          return `[${idx}] Title: ${c.article_title || 'Untitled'} (${c.section_name || 'General'})\n${snippet}`;
        })
        .join('\n\n');

      const res = await chat(providerConfig!, {
        system:
          'You are a retrieval relevance judge. Score how directly each candidate passage answers the customer query from 0.0 (irrelevant) to 1.0 (exact direct answer). Return ONLY a valid JSON array like [{"index":0,"score":0.92}].',
        messages: [
          {
            role: 'user',
            content: `Query: ${query}\n\nCandidates:\n${passageList}`,
          },
        ],
        maxTokens: 280,
        temperature: 0,
        reasoning: 'fast',
        timeoutMs,
      });

      llmScores = parseRerankScores(res.text || '', candidates.length);
    } catch {
      llmScores = null;
    }
  }

  const scored = candidates.map((chunk, idx) => {
    const detScore = heuristicScores[idx];
    const llmScore = llmScores?.get(idx);
    const blended =
      typeof llmScore === 'number'
        ? Number((llmScore * 0.72 + detScore * 0.28).toFixed(4))
        : Number(detScore.toFixed(4));
    return {
      chunk: {
        ...chunk,
        combined_score: Math.max(Number(chunk.combined_score ?? 0) * 0.25 + blended * 0.75, blended),
      } as T,
      score: blended,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    chunks: scored.slice(0, topK).map((s) => s.chunk),
    reranked: true,
    usedLlm: Boolean(llmScores && llmScores.size > 0),
  };
}
