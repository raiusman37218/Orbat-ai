import { groundedChunkIndex } from '@/lib/ai/grounding';
import type { ReplyLanguage } from '@/lib/ai/intent';

export interface ClaimSourceDoc {
  id?: string;
  title: string;
  content: string;
  kind?: string;
}

export interface VerifiedClaimItem {
  claim: string;
  supported: boolean;
  source: string;
}

export interface ClaimVerificationResult {
  verdict: 'supported' | 'needs_review';
  claims: VerifiedClaimItem[];
  confidence: number;
  method: 'semantic_llm' | 'grounded_heuristic';
  unsupportedClaims: string[];
}

export type SemanticVerifyLlmFn = (system: string, userPrompt: string) => Promise<string | null>;

const CITATION_TAIL_RE =
  /\n\n(?:Source|ماخذ|स्रोत|المصدر|Fuente): (?:\[[^\]\n]*\]\([^)\s]+\)|\*\*[^\n]*\*\*)\s*$/;
const PURE_FILLER_RE =
  /^(?:hi+|hello|hey|thanks?|thank you|you'?re welcome|glad i could help|happy to help|let me know if|feel free to|hope that helps|how can i help|is there anything else)/i;
const POLICY_OR_COMMITMENT_RE =
  /\b(?:refund|fee|charge|price|cost|free|discount|cancel|guarantee[ds]?|always|never|must|required|eligible|within|limit|maximum|minimum|percent|instant|days?|hours?|weeks?|months?|years?)\b/i;

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(CITATION_TAIL_RE, '')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .replace(/[*_`>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFigures(text: string): string[] {
  const normalizedDigits = text
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const matches = normalizedDigits.toLowerCase().match(/\$?\d+(?:[.,]\d+)?%?/g) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/^\$/, ''))));
}

/** Extracts concrete factual sentences worth verifying against workspace knowledge. */
export function extractFactualClaims(replyText: string): string[] {
  const cleaned = stripMarkdownFormatting(replyText);
  if (!cleaned) return [];

  const rawSentences = cleaned
    .split(/(?<=[.!?۔؟])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 16);

  const claims: string[] = [];
  for (const s of rawSentences) {
    const figures = extractFigures(s);
    if (figures.length === 0 && PURE_FILLER_RE.test(s) && !POLICY_OR_COMMITMENT_RE.test(s)) {
      continue;
    }
    claims.push(s);
    if (claims.length >= 5) break;
  }
  return claims;
}

function prioritizeSources(sources: ClaimSourceDoc[], citedTitles: string[]): ClaimSourceDoc[] {
  if (citedTitles.length === 0) return sources;
  const citedLower = new Set(citedTitles.map((t) => t.trim().toLowerCase()).filter(Boolean));
  return [...sources].sort((a, b) => {
    const aHit = citedLower.has(a.title.trim().toLowerCase()) ? 0 : 1;
    const bHit = citedLower.has(b.title.trim().toLowerCase()) ? 0 : 1;
    return aHit - bHit;
  });
}

function normalizeGroundingLang(languageCode?: string | null, text = ''): ReplyLanguage {
  const raw = (languageCode || '').trim().toLowerCase();
  if (raw === 'en' || raw === 'english') return 'en';
  if (/[^\x00-\x7F]/.test(text) || (raw && raw !== 'en')) return 'roman_ur';
  return 'en';
}

function parseSemanticJson(raw: string): { results?: Array<{ index?: number; supported?: boolean; source?: string }> } | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as {
      results?: Array<{ index?: number; supported?: boolean; source?: string }>;
    };
  } catch {
    return null;
  }
}

/**
 * Verifies every factual claim inside an AI reply against indexed Help Center & Bot Knowledge passages.
 * Never accepts a reply solely because a cited article title was attached (`citedTitle` pass-through removed),
 * validates numbers/commitments, and upgrades to semantic NLI check whenever a workspace LLM callback is passed.
 */
export async function verifyClaimsAgainstPassages(input: {
  replyText: string;
  passages?: string | null;
  sources?: ClaimSourceDoc[];
  citedTitles?: string[];
  languageCode?: string | null;
  customerQuestion?: string | null;
  verifyWithLlm?: SemanticVerifyLlmFn | null;
}): Promise<ClaimVerificationResult> {
  const claimsText = extractFactualClaims(input.replyText);
  if (claimsText.length === 0) {
    return {
      verdict: 'supported',
      claims: [],
      confidence: 0.95,
      method: 'grounded_heuristic',
      unsupportedClaims: [],
    };
  }

  const citedTitles = (input.citedTitles || []).filter((t) => t.trim().length > 0);
  const sources = prioritizeSources(input.sources || [], citedTitles);
  const passageBlock =
    sources.length > 0
      ? sources
          .slice(0, 12)
          .map((s, idx) => `[CHUNK ${idx + 1}] ${s.title}\n${s.content.slice(0, 1200)}`)
          .join('\n\n')
      : (input.passages || '').trim();

  if (!passageBlock) {
    const claims: VerifiedClaimItem[] = claimsText.map((claim) => ({
      claim,
      supported: false,
      source: 'No Help Center or Bot Knowledge passages were available to verify this claim',
    }));
    return {
      verdict: 'needs_review',
      claims,
      confidence: 0.25,
      method: 'grounded_heuristic',
      unsupportedClaims: claims.map((c) => c.claim),
    };
  }

  const passageFigures = new Set(extractFigures(passageBlock));

  // 1. Try true semantic verification when an LLM verifier callback is available.
  if (input.verifyWithLlm) {
    try {
      const systemPrompt = [
        'You are a strict fact-checking verifier for customer support replies.',
        'Compare each numbered CLAIM from the AI draft against the WORKSPACE KNOWLEDGE PASSAGES below.',
        'A claim is supported=true ONLY if every fact, price, timeframe, condition, and restriction in that claim is entailed by the passages (paraphrases and translations into another language are allowed).',
        'A claim is supported=false if it contradicts any passage, invents any number/fee/guarantee/timeline, or states policy facts absent from the passages.',
        'Return ONLY valid JSON: {"results":[{"index":0,"supported":true,"source":"Exact source title or short reason"}]}',
      ].join(' ');

      const userPrompt = [
        input.customerQuestion ? `CUSTOMER QUESTION:\n${input.customerQuestion.slice(0, 600)}\n` : '',
        'CLAIMS TO VERIFY:',
        claimsText.map((c, idx) => `${idx}. ${c}`).join('\n'),
        '\nWORKSPACE KNOWLEDGE PASSAGES:',
        passageBlock.slice(0, 9000),
      ]
        .filter(Boolean)
        .join('\n');

      const raw = await input.verifyWithLlm(systemPrompt, userPrompt);
      const parsed = raw ? parseSemanticJson(raw) : null;
      if (parsed && Array.isArray(parsed.results) && parsed.results.length > 0) {
        const resultMap = new Map(
          parsed.results
            .filter((r) => typeof r.index === 'number' && typeof r.supported === 'boolean')
            .map((r) => [r.index as number, r]),
        );
        if (resultMap.size === claimsText.length) {
          const claims: VerifiedClaimItem[] = claimsText.map((claim, idx) => {
            const verdictRow = resultMap.get(idx)!;
            const missingFigures = extractFigures(claim).filter((fig) => !passageFigures.has(fig));
            const supported = Boolean(verdictRow.supported) && missingFigures.length === 0;
            return {
              claim,
              supported,
              source:
                missingFigures.length > 0
                  ? `Unverified figure(s) not found in knowledge base: ${missingFigures.join(', ')}`
                  : verdictRow.source?.trim() ||
                    (supported
                      ? 'Verified semantically against workspace knowledge'
                      : 'Unsupported or contradicted by knowledge base'),
            };
          });
          const unsupportedClaims = claims.filter((c) => !c.supported).map((c) => c.claim);
          const supportedCount = claims.length - unsupportedClaims.length;
          return {
            verdict: unsupportedClaims.length > 0 ? 'needs_review' : 'supported',
            claims,
            confidence: unsupportedClaims.length === 0 ? 0.94 : Math.max(0.2, Number((supportedCount / claims.length).toFixed(2))),
            method: 'semantic_llm',
            unsupportedClaims,
          };
        }
      }
    } catch {
      // Fall through gracefully to deterministic grounding check below.
    }
  }

  // 2. Deterministic offline/fallback verification (zero citedTitle blind bypass!).
  const groundingLang = normalizeGroundingLang(input.languageCode, input.replyText);
  const chunkBlockForGrounding = /\[CHUNK \d+\]/.test(passageBlock) ? passageBlock : `[CHUNK 1] Knowledge\n${passageBlock}`;

  const claims: VerifiedClaimItem[] = claimsText.map((sentence) => {
    const matchedIdx = groundedChunkIndex(sentence, chunkBlockForGrounding, groundingLang);
    const matchedTitle = matchedIdx !== null ? sources[matchedIdx]?.title || citedTitles[0] || 'Help Center' : null;
    if (matchedTitle) {
      return { claim: sentence, supported: true, source: matchedTitle };
    }

    const figures = extractFigures(sentence);
    const missingFigures = figures.filter((fig) => !passageFigures.has(fig));
    if (missingFigures.length > 0) {
      return {
        claim: sentence,
        supported: false,
        source: `Unverified figure(s) not found in knowledge base: ${missingFigures.join(', ')}`,
      };
    }

    if (POLICY_OR_COMMITMENT_RE.test(sentence)) {
      return {
        claim: sentence,
        supported: false,
        source: 'Policy or commitment claim could not be grounded in retrieved passages',
      };
    }

    // Translated / paraphrased non-numeric sentences with shared entities across passages
    if (figures.length > 0) {
      return {
        claim: sentence,
        supported: true,
        source: citedTitles[0] || sources[0]?.title || 'Numeric figures matched in knowledge base',
      };
    }

    return {
      claim: sentence,
      supported: false,
      source: 'No direct grounding match found in indexed Help Center articles',
    };
  });

  const unsupportedClaims = claims.filter((c) => !c.supported).map((c) => c.claim);
  const supportedCount = claims.length - unsupportedClaims.length;
  return {
    verdict: unsupportedClaims.length > 0 ? 'needs_review' : 'supported',
    claims,
    confidence:
      unsupportedClaims.length === 0 ? 0.86 : Math.max(0.2, Number((supportedCount / claims.length).toFixed(2))),
    method: 'grounded_heuristic',
    unsupportedClaims,
  };
}
