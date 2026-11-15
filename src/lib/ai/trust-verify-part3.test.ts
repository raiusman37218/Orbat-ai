import { describe, expect, it, vi } from 'vitest';
import { verifyClaimsAgainstPassages } from '@/lib/ai/claim-verifier';
import { resolveAutonomyDecision, type AutonomyPolicyRecord } from '@/lib/ai/trust-ladder';

const SAMPLE_POLICIES: AutonomyPolicyRecord[] = [
  { id: 'p-gen', topic: 'General inquiries', level: 4, locked: false, lockReason: null },
  { id: 'p-bill', topic: 'Billing & refunds', level: 2, locked: false, lockReason: null },
  { id: 'p-acc', topic: 'Account & access', level: 3, locked: false, lockReason: null },
  { id: 'p-tech', topic: 'Technical troubleshooting', level: 1, locked: false, lockReason: null },
  {
    id: 'p-vip',
    topic: 'VIP Withdrawals',
    level: 1,
    locked: true,
    lockReason: 'Compliance team must approve VIP withdrawal exceptions.',
  },
];

describe('Part 3 — Claim Verifier (Closed citedTitle loophole + Semantic LLM + Figures)', () => {
  it('blocks fabricated numbers/claims even when a cited article title is supplied', async () => {
    const res = await verifyClaimsAgainstPassages({
      replyText: 'You will receive a $500 instant refund within 24 hours.',
      passages: 'Refunds are processed within 7 business days up to $100 per order after inspection.',
      citedTitles: ['Refund Policy'],
    });

    expect(res.verdict).toBe('needs_review');
    expect(res.method).toBe('grounded_heuristic');
    expect(res.unsupportedClaims.length).toBeGreaterThanOrEqual(1);
    expect(res.claims.some((c) => !c.supported)).toBe(true);
  });

  it('approves grounded replies whose claims and figures match indexed passages', async () => {
    const res = await verifyClaimsAgainstPassages({
      replyText: 'Refunds are processed within 7 business days up to $100 per order after inspection.',
      passages: 'Refunds are processed within 7 business days up to $100 per order after inspection.',
      citedTitles: ['Refund Policy'],
    });

    expect(res.verdict).toBe('supported');
    expect(res.unsupportedClaims).toHaveLength(0);
    expect(res.claims.every((c) => c.supported)).toBe(true);
  });

  it('uses semantic LLM NLI when available to validate Urdu / paraphrased replies', async () => {
    const verifyWithLlm = vi.fn(async () =>
      JSON.stringify({
        results: [
          {
            index: 0,
            supported: true,
            source: 'Refund Policy',
          },
        ],
      }),
    );

    const res = await verifyClaimsAgainstPassages({
      replyText: 'آپ کا ریفنڈ 7 کاروباری دنوں میں پروسیس ہوتا ہے۔',
      passages: 'Refund Policy: Refunds take 7 business days to process.',
      citedTitles: ['Refund Policy'],
      languageCode: 'ur',
      customerQuestion: 'Mera refund kab tak milega?',
      verifyWithLlm,
    });

    expect(verifyWithLlm).toHaveBeenCalledTimes(1);
    expect(res.method).toBe('semantic_llm');
    expect(res.verdict).toBe('supported');
    expect(res.confidence).toBeCloseTo(0.94, 2);
  });

  it('catches fabricated figures as a safety invariant even if semantic LLM approves them', async () => {
    const verifyWithLlm = vi.fn(async () =>
      JSON.stringify({
        results: [{ index: 0, supported: true, source: 'Promo FAQ' }],
      }),
    );

    const res = await verifyClaimsAgainstPassages({
      replyText: 'You will get a $999 bonus credit immediately.',
      passages: 'Promo FAQ: Standard welcome credit is $25 after verification.',
      citedTitles: ['Promo FAQ'],
      verifyWithLlm,
    });

    expect(res.method).toBe('semantic_llm');
    expect(res.verdict).toBe('needs_review');
    expect(res.unsupportedClaims.some((c) => c.includes('999'))).toBe(true);
  });
});

describe('Part 3 — Shared Trust Ladder Policy Resolution', () => {
  it('prioritizes locked Help Center section and custom topics over fallback rules', () => {
    const decision = resolveAutonomyDecision({
      policies: SAMPLE_POLICIES,
      message: 'Please check my request status.',
      citedSectionNames: ['VIP Withdrawals'],
    });

    expect(decision.locked).toBe(true);
    expect(decision.mode).toBe('human_only');
    expect(decision.topic).toBe('VIP Withdrawals');
    expect(decision.allowAutoSend).toBe(false);
    expect(decision.requiresHumanApproval).toBe(true);
  });

  it('maps messages to canonical AI Quality topics across Levels 1..4', () => {
    const l1 = resolveAutonomyDecision({
      policies: SAMPLE_POLICIES,
      message: 'My MT5 platform throws a connection error on login.',
      subAgent: 'platform',
    });
    expect(l1.topic).toBe('Technical troubleshooting');
    expect(l1.level).toBe(1);
    expect(l1.mode).toBe('shadow');
    expect(l1.allowAutoSend).toBe(false);

    const l2 = resolveAutonomyDecision({
      policies: SAMPLE_POLICIES,
      message: 'I want a refund for my last invoice.',
    });
    expect(l2.topic).toBe('Billing & refunds');
    expect(l2.level).toBe(2);
    expect(l2.mode).toBe('suggest');
    expect(l2.allowAutoSend).toBe(false);

    const l3 = resolveAutonomyDecision({
      policies: SAMPLE_POLICIES,
      message: 'How do I reset my 2FA password?',
    });
    expect(l3.topic).toBe('Account & access');
    expect(l3.level).toBe(3);
    expect(l3.mode).toBe('supervised');
    expect(l3.allowAutoSend).toBe(true);
    expect(l3.queueForSupervisorAudit).toBe(true);

    const l4 = resolveAutonomyDecision({
      policies: SAMPLE_POLICIES,
      message: 'What are your weekend support hours?',
    });
    expect(l4.topic).toBe('General inquiries');
    expect(l4.level).toBe(4);
    expect(l4.mode).toBe('autonomous');
    expect(l4.allowAutoSend).toBe(true);
    expect(l4.queueForSupervisorAudit).toBe(false);
  });
});
