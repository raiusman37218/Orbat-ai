import { serviceClient } from '@/lib/pg/service';
import type { ProviderConfig } from './provider';
import { chat, isConfigured } from './provider';
import { getPlatformAiConfigServerOnly } from './platform-gateway';
import type { RetrievedChunk } from '@/types/database';
import { userError } from '@/lib/errors/user-error';
import { searchQueriesFor, understandMessage } from './understanding';
import {
  normalizeKnowledgeScope,
  resolveEffectiveRagOptions,
  type AgentKnowledgeScope,
  type AgentRagConfig,
  type RagTrace,
} from './agent-templates';
import { buildHydePassage, rerankRetrievedChunks } from './reranker';

/**
 * Semantic retrieval and embedding engine with pgvector.
 *
 * Replaces pure keyword overlap with:
 * 1. 300-500 token chunking with title & section metadata preserved on every chunk.
 * 2. Supabase pgvector cosine embeddings + automatic sync on article lifecycle.
 * 3. Hybrid search combining cosine similarity and exact keyword/phrase matching.
 * 4. Conversational query rewriting using the last 6 conversation messages.
 */

export interface ArticleChunkInput {
  workspace_id: string;
  article_id: string;
  article_title: string;
  section_name: string | null;
  article_slug: string | null;
  chunk_index: number;
  content: string;
  token_count: number;
}

/**
 * Estimates token count for English and multilingual text.
 * Standard heuristic: 1 token ~= 4 chars or 0.75 words.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  return Math.max(1, Math.round(Math.max(words * 1.3, chars / 4)));
}

/**
 * Splits markdown content into structural blocks (headers, code, paragraphs, lists).
 */
function splitMarkdownBlocks(markdown: string): string[] {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inCode = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      current.push(line);
      continue;
    }
    if (inCode) {
      current.push(line);
      continue;
    }
    if (/^#{1,6}\s+/.test(line.trim())) {
      if (current.length) {
        blocks.push(current.join('\n').trim());
        current = [];
      }
      current.push(line);
      continue;
    }
    if (line.trim() === '' && current.length) {
      blocks.push(current.join('\n').trim());
      current = [];
      continue;
    }
    if (line.trim() !== '') {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n').trim());
  return blocks.filter(Boolean);
}

/**
 * Splits a published help article into chunks of roughly 300 to 500 tokens,
 * keeping the article title and section name with each chunk.
 */
export function splitArticleIntoChunks(article: {
  id: string;
  workspace_id: string;
  title: string;
  sectionName?: string | null;
  category?: string | null;
  slug?: string | null;
  summary?: string | null;
  content: string;
}): ArticleChunkInput[] {
  const title = (article.title || '').trim();
  const sectionName = (article.sectionName || article.category || 'General').trim();
  const header = `Article: ${title}\nSection: ${sectionName}\n\n`;
  const headerTokens = estimateTokenCount(header);

  const TARGET_MAX_TOKENS = 650;
  const blocks = splitMarkdownBlocks(article.content);
  const rawChunks: string[] = [];
  let currentBodyBlocks: string[] = [];
  let currentTokens = headerTokens;

  for (const block of blocks) {
    const blockTokens = estimateTokenCount(block);

    // If a single block exceeds the max chunk budget, split by sentences
    if (blockTokens > TARGET_MAX_TOKENS) {
      if (currentBodyBlocks.length > 0) {
        rawChunks.push(header + currentBodyBlocks.join('\n\n'));
        currentBodyBlocks = [];
        currentTokens = headerTokens;
      }
      const sentences = block.split(/(?<=[.!?])\s+/);
      let subSentences: string[] = [];
      let subTokens = headerTokens;
      for (const sent of sentences) {
        const sTokens = estimateTokenCount(sent);
        if (subTokens + sTokens > TARGET_MAX_TOKENS && subSentences.length > 0) {
          rawChunks.push(header + subSentences.join(' '));
          subSentences = [];
          subTokens = headerTokens;
        }
        subSentences.push(sent);
        subTokens += sTokens;
      }
      if (subSentences.length > 0) {
        rawChunks.push(header + subSentences.join(' '));
      }
      continue;
    }

    // If adding this block exceeds the token target, flush current chunk
    if (currentTokens + blockTokens > TARGET_MAX_TOKENS && currentBodyBlocks.length > 0) {
      rawChunks.push(header + currentBodyBlocks.join('\n\n'));
      currentBodyBlocks = [];
      currentTokens = headerTokens;
    }

    currentBodyBlocks.push(block);
    currentTokens += blockTokens;
  }

  if (currentBodyBlocks.length > 0) {
    rawChunks.push(header + currentBodyBlocks.join('\n\n'));
  }

  // If the article had no blocks (empty content), create a minimal chunk with title & summary
  if (rawChunks.length === 0) {
    rawChunks.push(`${header}${article.summary ? `${article.summary}\n\n` : ''}${title}`);
  }

  return rawChunks.map((content, idx) => ({
    workspace_id: article.workspace_id,
    article_id: article.id,
    article_title: title,
    section_name: sectionName,
    article_slug: article.slug || null,
    chunk_index: idx,
    content,
    token_count: estimateTokenCount(content),
  }));
}

/**
 * Resolves API key for embeddings, checking provider config and environment fallbacks.
 */
function resolveEmbeddingCredentials(providerConfig?: ProviderConfig | null): {
  provider: 'google' | 'openai' | 'compatible';
  apiKey: string;
  baseUrl?: string | null;
} | null {
  const p = providerConfig?.provider;
  const cfgKey = providerConfig?.apiKey;

  if (p === 'google' && cfgKey) {
    return { provider: 'google', apiKey: cfgKey };
  }
  if (p === 'openai' && cfgKey) {
    return { provider: 'openai', apiKey: cfgKey, baseUrl: providerConfig?.baseUrl };
  }
  if (p === 'compatible' && cfgKey) {
    return { provider: 'compatible', apiKey: cfgKey, baseUrl: providerConfig?.baseUrl };
  }

  // Environment fallbacks
  const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (googleKey) return { provider: 'google', apiKey: googleKey };

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) return { provider: 'openai', apiKey: openaiKey };

  return null;
}

/**
 * Generates 768-dimensional float embeddings for an array of texts.
 */
export async function generateEmbeddings(
  texts: string[],
  providerConfig?: ProviderConfig | null
): Promise<number[][]> {
  if (!texts.length) return [];

  let creds = resolveEmbeddingCredentials(providerConfig);
  if (!creds) {
    const platform = await getPlatformAiConfigServerOnly().catch(() => null);
    if (platform?.config) {
      creds = resolveEmbeddingCredentials(platform.config);
    }
  }

  if (!creds) {
    throw userError('No embedding API key configured for Google, OpenAI, or platform AI provider.');
  }

  if (creds.provider === 'google') {
    return generateGoogleEmbeddings(texts, creds.apiKey);
  } else {
    return generateOpenAiEmbeddings(texts, creds.apiKey, creds.baseUrl);
  }
}

async function generateGoogleEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const BATCH_SIZE = 15;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents';
    const requests = batch.map((text) => ({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }));

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({ requests }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw userError(`Google embeddings error ${res.status}: ${err}`);
    }

    const data = await res.json();
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw userError('Invalid response structure from Gemini embeddings API');
    }

    for (const e of data.embeddings) {
      results.push(e.values);
    }
  }

  return results;
}

async function generateOpenAiEmbeddings(
  texts: string[],
  apiKey: string,
  baseUrl?: string | null
): Promise<number[][]> {
  const url = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/embeddings';
  const isDeepInfra = (baseUrl || '').includes('deepinfra.com');
  const isCustomBase = Boolean(baseUrl && !baseUrl.includes('api.openai.com'));
  let model = isDeepInfra ? 'google/embeddinggemma-300m' : 'text-embedding-3-small';
  const BATCH_SIZE = 20;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const bodyPayload: Record<string, unknown> = {
      model,
      input: batch,
    };
    if (model === 'text-embedding-3-small') {
      bodyPayload.dimensions = 768;
    }

    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok && model === 'text-embedding-3-small' && isCustomBase) {
      // Fallback for compatible providers hosting embeddinggemma-300m or bge-base
      model = isDeepInfra ? 'google/embeddinggemma-300m' : 'BAAI/bge-base-en-v1.5';
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: batch,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw userError(`OpenAI embeddings error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const sorted = (data.data || []).sort(
      (a: { index: number }, b: { index: number }) => a.index - b.index
    );
    for (const item of sorted) {
      results.push(item.embedding);
    }
  }

  return results;
}

/**
 * Embeddings when a Google/OpenAI key is available; otherwise nulls.
 *
 * Chunks are stored either way: hybrid search also ranks by keywords, so an
 * article without a vector is still found. Throwing here used to mean that a
 * workspace on Anthropic or DeepSeek (no embedding API) stored no chunks at
 * all, and the assistant answered "I don't have that information" about
 * articles that were right there.
 */
async function embedOrNothing(
  texts: string[],
  providerConfig?: ProviderConfig | null
): Promise<(number[] | null)[]> {
  try {
    const out = await generateEmbeddings(texts, providerConfig);
    if (out.length === texts.length) return out;
  } catch (err) {
    console.warn('[Semantic Retrieval] Embeddings unavailable, storing keyword-only chunks:', (err as Error)?.message);
  }
  return texts.map(() => null);
}

/**
 * Re-embeds an article automatically when created, edited, published or unpublished.
 */
export async function syncArticleChunks(articleId: string, workspaceId: string): Promise<void> {
  const chunks = await chunkPublishedArticle(articleId, workspaceId);
  if (!chunks) {
    await deleteArticleChunks(articleId);
    return;
  }

  const { config: providerConfig } = await getPlatformAiConfigServerOnly();
  const embeddings = await embedOrNothing(chunks.map((c) => c.content), providerConfig);
  await replaceArticleChunks(articleId, chunks, embeddings);
}

/**
 * The article's chunks, or null when it should have none (deleted, a draft,
 * or empty).
 */
async function chunkPublishedArticle(
  articleId: string,
  workspaceId: string
): Promise<ArticleChunkInput[] | null> {
  const { data: article } = await serviceClient()
    .from('articles')
    .select('*, section:help_sections(name)')
    .eq('id', articleId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!article || article.status !== 'published') return null;

  const chunks = splitArticleIntoChunks({
    id: article.id,
    workspace_id: workspaceId,
    title: article.title,
    sectionName: article.section?.name || article.category || 'General',
    slug: article.slug,
    summary: article.summary,
    content: article.content,
  });
  return chunks.length ? chunks : null;
}

async function replaceArticleChunks(
  articleId: string,
  chunks: ArticleChunkInput[],
  embeddings: (number[] | null)[]
): Promise<void> {
  const supabase = serviceClient();
  const { error: delErr } = await supabase.from('article_chunks').delete().eq('article_id', articleId);
  if (delErr) throw userError(`Failed to clear article chunks: ${delErr.message}`);

  const rows = chunks.map((chunk, idx) => ({
    ...chunk,
    embedding: (embeddings[idx] as unknown as string) || null,
  }));
  const { error: insErr } = await supabase.from('article_chunks').insert(rows);
  if (insErr) {
    console.error('[Semantic Retrieval] Failed to insert article chunks:', insErr);
    throw userError(`Failed to store article chunks: ${insErr.message}`);
  }
}

/** Which embedding service the platform settings resolve to, if any. */
export async function describeEmbeddingProvider(): Promise<{ available: boolean; provider: string | null }> {
  let creds = resolveEmbeddingCredentials(null);
  if (!creds) {
    const platform = await getPlatformAiConfigServerOnly().catch(() => null);
    if (platform?.config) creds = resolveEmbeddingCredentials(platform.config);
  }
  if (!creds) return { available: false, provider: null };
  const host = creds.baseUrl ? (() => { try { return new URL(creds!.baseUrl!).host; } catch { return null; } })() : null;
  return { available: true, provider: host || creds.provider };
}

export interface ArticleReindexResult {
  articleId: string;
  status: 'embedded' | 'removed' | 'failed';
  chunks: number;
  error?: string;
}

/**
 * Re-embeds one article for the "Re-index knowledge" button. Unlike
 * syncArticleChunks, a failed embedding call is reported rather than stored
 * as keyword-only chunks, and the article's existing chunks are left as they
 * were, so a flaky provider cannot wipe embeddings that already worked.
 */
export async function reindexArticleStrict(articleId: string, workspaceId: string): Promise<ArticleReindexResult> {
  try {
    const chunks = await chunkPublishedArticle(articleId, workspaceId);
    if (!chunks) {
      // Scoped to the workspace: the id comes from the browser, and an id
      // from another workspace must not clear that workspace's chunks.
      const { error } = await serviceClient()
        .from('article_chunks')
        .delete()
        .eq('article_id', articleId)
        .eq('workspace_id', workspaceId);
      if (error) throw userError(error.message);
      return { articleId, status: 'removed', chunks: 0 };
    }

    const { config: providerConfig } = await getPlatformAiConfigServerOnly();
    const embeddings = await generateEmbeddings(chunks.map((c) => c.content), providerConfig);
    if (embeddings.length !== chunks.length || embeddings.some((e) => !Array.isArray(e) || !e.length)) {
      throw userError('The embedding service returned an incomplete result.');
    }

    await replaceArticleChunks(articleId, chunks, embeddings);
    return { articleId, status: 'embedded', chunks: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Semantic Retrieval] Re-index failed for article ${articleId}:`, message);
    return { articleId, status: 'failed', chunks: 0, error: message.slice(0, 300) };
  }
}

/**
 * Deletes all chunks belonging to an article.
 */
export async function deleteArticleChunks(articleId: string): Promise<void> {
  const supabase = serviceClient();
  await supabase.from('article_chunks').delete().eq('article_id', articleId);
}

/**
 * Synchronizes/backfills embeddings for all published articles in a workspace.
 */
export async function syncWorkspaceArticleEmbeddings(
  workspaceId: string
): Promise<{ indexedArticles: number; totalChunks: number }> {
  const supabase = serviceClient();
  const [{ data: sections }, { data: articles }] = await Promise.all([
    supabase.from('help_sections').select('id, name').eq('workspace_id', workspaceId),
    supabase
      .from('articles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'published'),
  ]);

  if (!articles || !articles.length) {
    return { indexedArticles: 0, totalChunks: 0 };
  }

  const { config: providerConfig } = await getPlatformAiConfigServerOnly();

  const secMap = new Map((sections || []).map((s) => [s.id, s.name]));
  const allChunks: (ArticleChunkInput & { embedding?: number[] })[] = [];

  for (const art of articles) {
    const secName = art.section_id ? secMap.get(art.section_id) : art.category;
    const chunks = splitArticleIntoChunks({
      ...art,
      sectionName: secName,
    });
    allChunks.push(...chunks);
  }

  if (allChunks.length === 0) return { indexedArticles: 0, totalChunks: 0 };

  const texts = allChunks.map((c) => c.content);
  const embeddings = await embedOrNothing(texts, providerConfig);

  // Clear existing workspace chunks and insert fresh ones
  await supabase.from('article_chunks').delete().eq('workspace_id', workspaceId);

  const BATCH_SIZE = 25;
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE).map((c, idx) => ({
      ...c,
      embedding: (embeddings[i + idx] as unknown as string) || null,
    }));
    const { error } = await supabase.from('article_chunks').insert(batch);
    if (error) {
      console.error('[Semantic Retrieval] Batch insert error:', error);
      throw error;
    }
  }

  return { indexedArticles: articles.length, totalChunks: allChunks.length };
}

/**
 * Backfills embeddings for all published articles across all workspaces.
 */
export async function backfillAllWorkspacesArticleEmbeddings(): Promise<{
  workspacesProcessed: number;
  totalArticlesIndexed: number;
  totalChunksCreated: number;
}> {
  const supabase = serviceClient();
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name');

  if (error || !workspaces) {
    console.error('[Semantic Retrieval] Failed to fetch workspaces for backfill:', error);
    return { workspacesProcessed: 0, totalArticlesIndexed: 0, totalChunksCreated: 0 };
  }

  let totalArticlesIndexed = 0;
  let totalChunksCreated = 0;
  let workspacesProcessed = 0;

  for (const ws of workspaces) {
    try {
      const res = await syncWorkspaceArticleEmbeddings(ws.id);
      if (res.indexedArticles > 0) {
        workspacesProcessed++;
        totalArticlesIndexed += res.indexedArticles;
        totalChunksCreated += res.totalChunks;
        console.log(`[Semantic Retrieval] Workspace "${ws.name}" (${ws.id}): indexed ${res.indexedArticles} articles, ${res.totalChunks} chunks.`);
      }
    } catch (wsErr) {
      console.warn(`[Semantic Retrieval] Failed to sync workspace ${ws.id}:`, wsErr);
    }
  }

  return {
    workspacesProcessed,
    totalArticlesIndexed,
    totalChunksCreated,
  };
}

const NON_ENGLISH_MARKERS =
  /\b(?:kya|kia|hai|hain|mera|meri|mere|mujhe|kaise|kese|nahi|nahin|aap|ap|ka|ki|ke|ko|se|mein|kitna|kitne|chahiye|karna|kar|hota|hoti|wala|wali)\b/i;
const FOLLOW_UP_MARKERS =
  /^(?:and|also|but|so|then|ok|okay|what\s+about|how\s+about)\b|\b(?:it|its|it's|that|this|those|these|they|them|there|same|one|ones|above)\b/i;

/**
 * True when the message already works as a search query: plain English, long
 * enough to carry its own meaning, and (with a conversation behind it) not a
 * follow-up that leans on an earlier turn. Most questions are like this, and
 * rewriting them would spend a model call to get the same words back.
 */
export function isStandaloneEnglishQuery(message: string, hasHistory: boolean): boolean {
  if (!/^[\x20-\x7E]+$/.test(message)) return false;
  const words = message.split(/\s+/).filter(Boolean).length;
  // Short queries are where shorthand and typos live ("25k instant accounts ruls"):
  // they go through the rewrite, which also fixes spelling.
  if (words < 6 || words > 25) return false;
  if (NON_ENGLISH_MARKERS.test(message)) return false;
  return !hasHistory || !FOLLOW_UP_MARKERS.test(message);
}

/**
 * Rewrites the visitor message into a standalone English search query
 * using the recent messages of the conversation.
 *
 * Handles:
 * - Follow-up questions (e.g. "and what about instant accounts?")
 * - Languages like Roman Urdu/Hindi, Arabic, French, Spanish, Uzbek
 * - Spelling errors, typos, and abbreviations
 * - Preserving exact terms, figures, percentages (e.g. "1% rule", "80/20", "drawdown")
 *
 * Messages that are already standalone English skip the model call.
 */
export async function rewriteVisitorMessageToEnglishQuery({
  visitorMessage,
  recentMessages = [],
  providerConfig,
}: {
  visitorMessage: string;
  recentMessages?: { sender_type?: string; role?: string; content?: string }[];
  providerConfig?: ProviderConfig | null;
}): Promise<string> {
  const trimmed = visitorMessage.trim();
  if (!trimmed) return '';

  // Filter and take the last 6 conversation messages for context
  const last6 = (recentMessages || [])
    .filter((m) => typeof m.content === 'string' && m.content.trim())
    .slice(-6)
    .map((m) => {
      const isUser = m.sender_type === 'visitor' || m.role === 'user';
      return `${isUser ? 'Customer' : 'Assistant'}: ${m.content!.trim()}`;
    });

  if (!isConfigured(providerConfig) || isStandaloneEnglishQuery(trimmed, last6.length > 0)) {
    return trimmed;
  }

  // Kept short: this runs before almost every help-centre answer.
  const systemInstruction = [
    'Rewrite the customer’s latest message as one standalone English search query (4-12 words) for a support help center.',
    'Resolve follow-ups ("it", "that", "and what about X?") from the conversation, translate any language (including Roman Urdu) into English, fix typos, and keep exact names, numbers and acronyms.',
    'Output only the query: no quotes, prefixes or explanation.',
  ].join('\n');

  const userContent = [
    last6.length ? `Conversation:\n${last6.slice(-4).join('\n')}\n` : '',
    `Latest message: ${trimmed}`,
  ].join('\n');

  try {
    const res = await chat(providerConfig!, {
      system: systemInstruction,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 60,
      temperature: 0.1,
      reasoning: 'fast',
      // The rewrite only sharpens retrieval; the raw message still works, so
      // it must not eat the reply's time budget on a slow provider.
      timeoutMs: 6000,
    });

    const rewritten = (res.text || '').trim().replace(/^["']|["']$/g, '');
    return rewritten && rewritten.length > 2 ? rewritten : trimmed;
  } catch (err) {
    console.warn('[Semantic Retrieval] Query rewrite model call failed, using raw query:', err);
    return trimmed;
  }
}

/**
 * What a message is asking, as up to three English search queries written
 * the way a help centre would phrase it, one per separate question. One
 * model call, the same budget the single rewrite had. "3 din se pyout nahi
 * aaya, scam hai kya?" becomes ["payout not received after 3 days",
 * "payout processing time", "is the firm legit"].
 *
 * The rules (understanding.ts) give the model a cleaned-up reading as a hint
 * and are the whole answer when there is no model or the message already
 * reads as a standalone English question.
 */
export async function expandVisitorQueries({
  visitorMessage,
  recentMessages = [],
  providerConfig,
}: {
  visitorMessage: string;
  recentMessages?: { sender_type?: string; role?: string; content?: string }[];
  providerConfig?: ProviderConfig | null;
}): Promise<string[]> {
  const trimmed = visitorMessage.trim();
  if (!trimmed) return [];
  const understood = understandMessage(trimmed);
  const history = (recentMessages || [])
    .filter((m) => typeof m.content === 'string' && m.content.trim() && m.content.trim() !== trimmed)
    .slice(-4)
    .map((m) => `${m.sender_type === 'visitor' || m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content!.trim().slice(0, 300)}`);

  if (!isConfigured(providerConfig) || (isStandaloneEnglishQuery(trimmed, history.length > 0) && !understood.parts.length)) {
    return searchQueriesFor(trimmed);
  }

  const system = [
    'You turn a customer\'s chat message into search queries for the workspace\'s customer support help center.',
    'Customers type fast: typos, shorthand (acc = account, pwd = password, inv = invoice, sub = subscription), Roman Urdu, mixed languages, slang, venting. Look past the words to what they actually need.',
    'Resolve follow-ups ("aur pro plan pe?", "and for step 2?") from the conversation. Ignore greetings and venting; keep the request.',
    'Write 1-3 short English queries (3-10 words each), worded like help-center headings or FAQ questions. One per separate question; if there is one question, add a second wording of it. Keep exact numbers, sizes and names.',
    'Output only a JSON array of strings, e.g. ["billing refund policy","change account password"].',
  ].join('\n');
  const user = [
    history.length ? `Conversation:\n${history.join('\n')}\n` : '',
    `Latest message: ${trimmed}`,
    understood.core && understood.core !== trimmed.toLowerCase() ? `Rough reading (may be imperfect): ${understood.core}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await chat(providerConfig!, {
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 90,
      temperature: 0.1,
      reasoning: 'fast',
      timeoutMs: 6000,
    });
    return searchQueriesFor(trimmed, parseQueryList(res.text || ''));
  } catch (err) {
    console.warn('[Semantic Retrieval] Query expansion failed, using the rules:', (err as Error)?.message);
    return searchQueriesFor(trimmed);
  }
}

/** The model's JSON array, or its lines when it ignored the format. */
export function parseQueryList(raw: string): string[] {
  const text = raw.trim();
  const json = text.match(/\[[\s\S]*\]/)?.[0];
  if (json) {
    try {
      const arr = JSON.parse(json);
      if (Array.isArray(arr)) return arr.filter((q): q is string => typeof q === 'string' && q.trim().length > 2).map((q) => q.trim()).slice(0, 3);
    } catch {
      // fall through to lines
    }
  }
  return text
    .split('\n')
    .map((l) => l.replace(/^[\s\-*\d.)"']+|["',]+$/g, '').trim())
    .filter((l) => l.length > 2 && !/^\[|\]$/.test(l))
    .slice(0, 3);
}

/** Reciprocal rank fusion: the usual k, so rank 1 is not everything. */
const RRF_K = 60;

/**
 * Merges the result lists of several queries. A passage found by several
 * wordings of the question ranks above one found by a single wording, which
 * is the agreement a human reader would look for. Each merged chunk keeps its
 * best raw scores, so the threshold check still means what it meant.
 */
export function fuseRankings(lists: RetrievedChunk[][]): (RetrievedChunk & { fused_score: number; hits: number })[] {
  const merged = new Map<string, RetrievedChunk & { fused_score: number; hits: number }>();
  for (const list of lists) {
    list.forEach((c, rank) => {
      const key = `${c.source ?? 'article'}:${c.id}`;
      const prev = merged.get(key);
      const add = 1 / (RRF_K + rank + 1);
      if (!prev) {
        merged.set(key, { ...c, fused_score: add, hits: 1 });
      } else {
        prev.fused_score += add;
        prev.hits += 1;
        prev.similarity = Math.max(prev.similarity, c.similarity);
        prev.keyword_score = Math.max(prev.keyword_score, c.keyword_score);
        prev.combined_score = Math.max(prev.combined_score, c.combined_score);
      }
    });
  }
  return [...merged.values()].sort((a, b) => b.fused_score - a.fused_score || b.combined_score - a.combined_score);
}

/**
 * Executes hybrid search over workspace article chunks:
 * 1. Cosine similarity via pgvector (embedding <=> query_embedding)
 * 2. Full text search and exact phrase matching
 * 3. Scoped strictly to the workspace
 * Returns top 6 chunks.
 */
export async function hybridSearchWorkspaceChunks({
  workspaceId,
  queryText,
  queryEmbedding,
  limit = 6,
  sectionIds = null,
}: {
  workspaceId: string;
  queryText: string;
  queryEmbedding?: number[] | null;
  limit?: number;
  /** Optional help_sections filter; null searches all sections, [] short-circuits to no hits. */
  sectionIds?: string[] | null;
}): Promise<RetrievedChunk[]> {
  if (Array.isArray(sectionIds) && sectionIds.length === 0) {
    return [];
  }

  const supabase = serviceClient();
  const rpcArgs: Record<string, unknown> = {
    p_workspace_id: workspaceId,
    p_query_text: queryText,
    p_query_embedding: queryEmbedding || null,
    p_limit: limit,
  };
  if (Array.isArray(sectionIds)) {
    rpcArgs.p_section_ids = sectionIds;
  }

  const { data, error } = await supabase.rpc('fn_hybrid_search_chunks', rpcArgs);

  if (error) {
    console.warn('[Semantic Retrieval] fn_hybrid_search_chunks RPC failed:', error.message);
    return [];
  }

  return (data as RetrievedChunk[]) || [];
}

/** Section label on Bot knowledge chunks, for the model and the keyword index. */
export const BOT_KNOWLEDGE_SECTION = 'Team knowledge';

/**
 * Hybrid search over the workspace's Bot knowledge entries (only those that
 * have been embedded), shaped like article chunks so the two lists merge.
 * Scored the same way as fn_hybrid_search_chunks.
 */
export async function hybridSearchBotKnowledge({
  workspaceId,
  queryText,
  queryEmbedding,
  limit = 6,
}: {
  workspaceId: string;
  queryText: string;
  queryEmbedding?: number[] | null;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const { data, error } = await serviceClient().rpc('fn_hybrid_search_bot_knowledge', {
    p_workspace_id: workspaceId,
    p_query_text: queryText,
    p_query_embedding: queryEmbedding || null,
    p_limit: limit,
  });

  if (error) {
    // Before the migration has run the function does not exist; articles still answer.
    console.warn('[Semantic Retrieval] fn_hybrid_search_bot_knowledge RPC failed:', error.message);
    return [];
  }

  return ((data as { id: string; knowledge_id: string; title: string; chunk_index: number; content: string; similarity: number; keyword_score: number; combined_score: number }[]) || []).map((row) => ({
    id: row.id,
    article_id: row.knowledge_id,
    article_title: row.title,
    section_name: BOT_KNOWLEDGE_SECTION,
    article_slug: null,
    chunk_index: row.chunk_index,
    content: row.content,
    similarity: row.similarity,
    keyword_score: row.keyword_score,
    combined_score: row.combined_score,
    source: 'knowledge' as const,
  }));
}

function stripChunkHeaderPrefix(raw: string): string {
  return (raw || '')
    .replace(/^Article:[^\r\n]*\r?\n(?:Section:[^\r\n]*\r?\n)?\r?\n*/i, '')
    .trim();
}

function buildRelaxedCorrectiveQuery(original: string, rewritten: string): string {
  const combined = `${rewritten} ${original}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  const unique = Array.from(new Set(combined)).slice(0, 8);
  return unique.join(' ').trim() || rewritten || original;
}

/**
 * Fetches immediate neighbor chunks (`chunk_index - 1`, `chunk_index + 1`) from the
 * same article / knowledge entry so split paragraphs and multi-row tables stay intact.
 * Strictly preserves workspace and article/knowledge boundaries.
 */
export async function expandAdjacentChunks({
  workspaceId,
  chunks,
  includeBotKnowledge = true,
}: {
  workspaceId: string;
  chunks: RetrievedChunk[];
  includeBotKnowledge?: boolean;
}): Promise<{ chunks: RetrievedChunk[]; expandedCount: number }> {
  if (!chunks.length) {
    return { chunks: [], expandedCount: 0 };
  }

  const targets = chunks.slice(0, 4);
  const existingKeys = new Set(
    chunks.map((c) => `${c.source === 'knowledge' ? 'knowledge' : 'article'}:${c.article_id}:${c.chunk_index}`),
  );

  const articleIds = new Set<string>();
  const kbIds = new Set<string>();
  for (const c of targets) {
    if (c.source === 'knowledge') {
      if (includeBotKnowledge) kbIds.add(c.article_id);
    } else {
      articleIds.add(c.article_id);
    }
  }

  const supabase = serviceClient();
  const [articleNeighborRes, kbNeighborRes] = await Promise.all([
    articleIds.size > 0
      ? supabase
          .from('article_chunks')
          .select('article_id, chunk_index, content')
          .eq('workspace_id', workspaceId)
          .in('article_id', [...articleIds])
      : Promise.resolve({ data: null, error: null }),
    includeBotKnowledge && kbIds.size > 0
      ? supabase
          .from('bot_knowledge_chunks')
          .select('knowledge_id, chunk_index, content')
          .eq('workspace_id', workspaceId)
          .in('knowledge_id', [...kbIds])
      : Promise.resolve({ data: null, error: null }),
  ]);

  const neighborText = new Map<string, string>();
  for (const row of ((articleNeighborRes?.data as { article_id?: string; chunk_index?: number; content?: string }[] | null) || [])) {
    if (row.article_id && typeof row.chunk_index === 'number' && row.content) {
      neighborText.set(`article:${row.article_id}:${row.chunk_index}`, stripChunkHeaderPrefix(row.content));
    }
  }
  for (const row of ((kbNeighborRes?.data as { knowledge_id?: string; chunk_index?: number; content?: string }[] | null) || [])) {
    if (row.knowledge_id && typeof row.chunk_index === 'number' && row.content) {
      neighborText.set(`knowledge:${row.knowledge_id}:${row.chunk_index}`, stripChunkHeaderPrefix(row.content));
    }
  }

  let expandedCount = 0;
  const updated = chunks.map((chunk, i) => {
    if (i >= 4) return chunk;
    const src = chunk.source === 'knowledge' ? 'knowledge' : 'article';
    const prevKey = `${src}:${chunk.article_id}:${chunk.chunk_index - 1}`;
    const nextKey = `${src}:${chunk.article_id}:${chunk.chunk_index + 1}`;
    const prevBody = chunk.chunk_index > 0 && !existingKeys.has(prevKey) ? neighborText.get(prevKey) : undefined;
    const nextBody = !existingKeys.has(nextKey) ? neighborText.get(nextKey) : undefined;

    if (!prevBody && !nextBody) return chunk;

    expandedCount += 1;
    const parts: string[] = [];
    if (prevBody) parts.push(`[Previous section]\n${prevBody.slice(-850)}`);
    parts.push(chunk.content);
    if (nextBody) parts.push(`[Continuation]\n${nextBody.slice(0, 850)}`);

    return {
      ...chunk,
      content: parts.join('\n\n'),
    };
  });

  return { chunks: updated, expandedCount };
}

/**
 * Builds the AI model context from semantic retrieved chunks:
 * 1. Rewrites visitor query (plus optional HyDE hypothetical passage in Advanced RAG).
 * 2. Embeds query variants.
 * 3. Retrieves candidate chunks via pgvector hybrid search (wider pool for rerank).
 * 4. Runs optional Corrective fallback, AI/lexical Reranker, and Parent-Child expansion.
 * 5. Filters below threshold and assembles clean context blocks with URLs and RagTrace.
 */
export async function buildSemanticModelContext({
  workspaceId,
  visitorMessage,
  recentMessages = [],
  providerConfig,
  limit = 6,
  messageEmbedding,
  knowledgeScope,
  minScore,
  ragConfig,
}: {
  workspaceId: string;
  visitorMessage: string;
  recentMessages?: { sender_type?: string; role?: string; content?: string }[];
  providerConfig?: ProviderConfig | null;
  limit?: number;
  helpCenterUrl?: string | null;
  /** Embedding of `visitorMessage` itself, reused when the query is not rewritten. */
  messageEmbedding?: number[] | null;
  /** Per-agent collection & Bot knowledge visibility boundaries. */
  knowledgeScope?: Partial<AgentKnowledgeScope> | null;
  /** Optional stricter similarity/combined score floor configured on the agent. */
  minScore?: number;
  /** Per-agent RAG mode & Advanced RAG feature toggles. */
  ragConfig?: Partial<AgentRagConfig> | null;
}): Promise<{
  text: string;
  used: { id: string; title: string; source: 'article' | 'knowledge' }[];
  rewrittenQuery: string;
  /** Every query searched (understanding.ts), the first being rewrittenQuery. */
  queries: string[];
  queryEmbedding?: number[] | null;
  chunks: RetrievedChunk[];
  belowThreshold: boolean;
  ragTrace: RagTrace;
}> {
  const ragOpts = resolveEffectiveRagOptions({
    mode: ragConfig?.mode,
    topK: ragConfig?.topK ?? limit,
    rerank: ragConfig?.rerank,
    hyde: ragConfig?.hyde,
    parentChild: ragConfig?.parentChild,
    correctiveFallback: ragConfig?.correctiveFallback,
    minScore: ragConfig?.minScore ?? minScore,
    citations: ragConfig?.citations,
  });
  const effectiveLimit = ragOpts.topK;
  const effectiveMinScore = ragOpts.minScore;
  const emptyTrace = (partial?: Partial<RagTrace>): RagTrace => ({
    mode: ragOpts.mode,
    hydeUsed: false,
    reranked: false,
    parentExpanded: false,
    correctiveRetried: false,
    candidateCount: 0,
    ...partial,
  });

  const normalizedScope = knowledgeScope ? normalizeKnowledgeScope(knowledgeScope) : null;
  const searchArticles =
    !normalizedScope || normalizedScope.allArticles || normalizedScope.sectionIds.length > 0;
  const articleSectionIds =
    normalizedScope && !normalizedScope.allArticles ? normalizedScope.sectionIds : null;
  const includeBotKnowledge = !normalizedScope || normalizedScope.includeBotKnowledge;

  if (!searchArticles && !includeBotKnowledge) {
    const cleaned = visitorMessage.trim();
    return {
      text: '',
      used: [],
      rewrittenQuery: cleaned,
      queries: cleaned ? [cleaned] : [],
      queryEmbedding: messageEmbedding ?? null,
      chunks: [],
      belowThreshold: true,
      ragTrace: emptyTrace(),
    };
  }

  let activeConfig = providerConfig;
  if (!isConfigured(activeConfig)) {
    const platform = await getPlatformAiConfigServerOnly().catch(() => null);
    if (platform?.config) activeConfig = platform.config;
  }

  // 1. Expand visitor query variants, plus optional HyDE hypothetical passage.
  const queries = await expandVisitorQueries({ visitorMessage, recentMessages, providerConfig: activeConfig });
  if (!queries.length) queries.push(visitorMessage.trim());
  const rewrittenQuery = queries[0];

  const hydePassage = ragOpts.hyde
    ? await buildHydePassage({ question: rewrittenQuery || visitorMessage, providerConfig: activeConfig })
    : null;
  const hydeUsed = Boolean(hydePassage);
  const searchQueries = hydePassage ? [...queries, hydePassage] : [...queries];

  // 2. Embed expanded queries (+ HyDE passage) in a single batched call.
  let embeddings: (number[] | null)[] = searchQueries.map((q) =>
    messageEmbedding?.length && q === visitorMessage.trim() ? messageEmbedding : null,
  );
  const missing = searchQueries.filter((_, i) => !embeddings[i]);
  if (missing.length) {
    try {
      const made = await generateEmbeddings(missing, activeConfig);
      let k = 0;
      embeddings = embeddings.map((e) => e ?? made[k++] ?? null);
    } catch (err) {
      console.warn('[Semantic Retrieval] Query embedding failed, continuing with keyword search:', err);
    }
  }
  const queryEmbedding = embeddings[0] ?? null;

  // 3. Hybrid search across wider candidate pool when reranking / Advanced RAG is active.
  const candidateLimit =
    ragOpts.rerank || ragOpts.mode === 'advanced' ? Math.max(15, effectiveLimit * 2) : effectiveLimit;

  const runHybridQuery = async (queryText: string, queryEmb?: number[] | null) => {
    const [articleChunks, knowledgeChunks] = await Promise.all([
      searchArticles
        ? hybridSearchWorkspaceChunks({
            workspaceId,
            queryText,
            queryEmbedding: queryEmb,
            limit: candidateLimit,
            sectionIds: articleSectionIds,
          })
        : Promise.resolve([]),
      includeBotKnowledge
        ? hybridSearchBotKnowledge({
            workspaceId,
            queryText,
            queryEmbedding: queryEmb,
            limit: candidateLimit,
          })
        : Promise.resolve([]),
    ]);
    return [...articleChunks, ...knowledgeChunks].sort(
      (a, b) => b.combined_score - a.combined_score || b.similarity - a.similarity,
    );
  };

  const lists = await Promise.all(searchQueries.map((qText, i) => runHybridQuery(qText, embeddings[i])));
  let candidatePool: RetrievedChunk[] = fuseRankings(lists);
  let correctiveRetried = false;

  // 4. Corrective RAG Gate: retry once with normalized keyword query when initial candidates are weak.
  const correctiveFloor = Math.max(0.28, effectiveMinScore);
  const bestInitialScore = candidatePool.length
    ? Math.max(...candidatePool.map((c) => Math.max(Number(c.combined_score || 0), Number(c.similarity || 0))))
    : 0;
  if (ragOpts.correctiveFallback && (!candidatePool.length || bestInitialScore < correctiveFloor)) {
    const relaxedQuery = buildRelaxedCorrectiveQuery(visitorMessage, rewrittenQuery);
    if (relaxedQuery && !searchQueries.includes(relaxedQuery)) {
      correctiveRetried = true;
      const retryHits = await runHybridQuery(relaxedQuery, queryEmbedding).catch(() => []);
      if (retryHits.length > 0) {
        candidatePool = fuseRankings([...lists, retryHits]);
      }
    }
  }

  const candidateCount = candidatePool.length;
  if (!candidatePool.length) {
    return {
      text: '',
      used: [],
      rewrittenQuery,
      queries,
      queryEmbedding,
      chunks: [],
      belowThreshold: true,
      ragTrace: emptyTrace({ hydeUsed, correctiveRetried, candidateCount: 0 }),
    };
  }

  // 5. Optional AI / hybrid reranker narrows candidate pool down to topK crisp matches.
  let reranked = false;
  let chunks: RetrievedChunk[];
  if (ragOpts.rerank) {
    const rerankRes = await rerankRetrievedChunks({
      query: rewrittenQuery || visitorMessage,
      queries,
      chunks: candidatePool,
      topK: effectiveLimit,
      providerConfig: activeConfig,
    });
    chunks = rerankRes.chunks;
    reranked = rerankRes.reranked;
  } else {
    chunks = candidatePool.slice(0, effectiveLimit);
  }

  if (!chunks.length) {
    return {
      text: '',
      used: [],
      rewrittenQuery,
      queries,
      queryEmbedding,
      chunks: [],
      belowThreshold: true,
      ragTrace: emptyTrace({ hydeUsed, reranked, correctiveRetried, candidateCount }),
    };
  }

  // 6. Threshold check: refuse weak matches to prevent hallucinated grounding.
  const topChunk = chunks[0];
  const baseBelowThreshold =
    topChunk.similarity < 0.42 && topChunk.keyword_score < 0.20 && topChunk.combined_score < 0.38;
  const stricterMinScore =
    typeof effectiveMinScore === 'number' &&
    effectiveMinScore > 0.25 &&
    Math.max(topChunk.similarity, topChunk.combined_score) < effectiveMinScore;
  const isBelowThreshold = baseBelowThreshold || stricterMinScore;

  if (isBelowThreshold) {
    return {
      text: '',
      used: [],
      rewrittenQuery,
      queries,
      queryEmbedding,
      chunks: [],
      belowThreshold: true,
      ragTrace: emptyTrace({ hydeUsed, reranked, correctiveRetried, candidateCount }),
    };
  }

  // 7. Filter secondary chunks, optionally stitch parent/adjacent neighbor context, and cap prompt chars.
  const MAX_KNOWLEDGE_CHARS = 9000;
  const maxContextChunks = effectiveLimit > 6 ? Math.min(effectiveLimit, 12) : 5;
  let eligibleChunks = chunks
    .filter((c, i) => i === 0 || c.similarity >= 0.38 || c.combined_score >= 0.35)
    .slice(0, maxContextChunks);

  let parentExpanded = false;
  if (ragOpts.parentChild && eligibleChunks.length > 0) {
    const expanded = await expandAdjacentChunks({
      workspaceId,
      chunks: eligibleChunks,
      includeBotKnowledge,
    }).catch(() => ({ chunks: eligibleChunks, expandedCount: 0 }));
    eligibleChunks = expanded.chunks;
    parentExpanded = expanded.expandedCount > 0;
  }

  const usedMap = new Map<string, { id: string; title: string; source: 'article' | 'knowledge' }>();
  const blocks: string[] = [];
  const finalChunks: RetrievedChunk[] = [];
  let totalChars = 0;

  for (let idx = 0; idx < eligibleChunks.length; idx++) {
    const c = eligibleChunks[idx];
    const cleanContent = c.content.replace(/^Article:\s*.*?\nSection:\s*.*?\n\n/i, '').trim();

    // No URL for the model: it is told not to write links, and the citation is added by code.
    const lines = [
      `[CHUNK ${idx + 1}]`,
      `Article: ${c.article_title}`,
      `Section: ${c.section_name || 'General'}`,
      '',
      cleanContent,
    ];
    const blockText = lines.join('\n');

    if (totalChars + blockText.length > MAX_KNOWLEDGE_CHARS && blocks.length >= 3) {
      break;
    }

    blocks.push(blockText);
    finalChunks.push(c);
    totalChars += blockText.length;
    usedMap.set(c.article_id, {
      id: c.article_id,
      title: c.article_title,
      source: c.source === 'knowledge' ? 'knowledge' : 'article',
    });
  }

  return {
    text: blocks.join('\n\n---\n\n'),
    used: Array.from(usedMap.values()),
    rewrittenQuery,
    queries,
    queryEmbedding,
    chunks: finalChunks,
    belowThreshold: false,
    ragTrace: emptyTrace({ hydeUsed, reranked, parentExpanded, correctiveRetried, candidateCount }),
  };
}
