import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUILTIN_POLICIES,
  evaluateComplianceText,
  passesLuhnCheck,
  runPolicyTestCases,
} from './policy-evaluator';

describe('compliance policy evaluator', () => {
  it('validates card PANs with Luhn and redacts valid numbers while ignoring order numbers', () => {
    expect(passesLuhnCheck('4111111111111111')).toBe(true);
    expect(passesLuhnCheck('4111111111111112')).toBe(false);

    const cardMsg = evaluateComplianceText(
      'My Visa card is 4111 1111 1111 1111 for order 2026111500001',
      DEFAULT_BUILTIN_POLICIES,
    );
    expect(cardMsg.outcome).toBe('redact');
    expect(cardMsg.redactedText).toContain('[CARD •••• 1111]');
    expect(cardMsg.redactedText).not.toContain('4111 1111 1111 1111');
    expect(cardMsg.hits[0]?.framework).toBe('PCI DSS');

    const nonLuhn = evaluateComplianceText(
      'Tracking number 4111111111111112 was issued',
      DEFAULT_BUILTIN_POLICIES,
    );
    expect(nonLuhn.outcome).toBe('allow');
  });

  it('blocks regulated advice, secret credentials, and unverified delivery guarantees', () => {
    const advice = evaluateComplianceText(
      'The gold fund is a safe bet right now, you should buy shares.',
      DEFAULT_BUILTIN_POLICIES,
    );
    expect(advice.outcome).toBe('block');
    expect(advice.hits.some((h) => h.ruleKey === 'advice_regulated')).toBe(true);

    const sampleSecretKey = ['sk', 'live', '51N9xAbCdEfGhIjKlMnOpQrStUvWxYz'].join('_');
    const secret = evaluateComplianceText(
      `Here is my Stripe key ${sampleSecretKey}`,
      DEFAULT_BUILTIN_POLICIES,
    );
    expect(secret.outcome).toBe('block');
    expect(secret.redactedText).toContain('[REDACTED SECRET]');

    const promise = evaluateComplianceText(
      'It will definitely arrive by tomorrow morning.',
      DEFAULT_BUILTIN_POLICIES,
      { channel: 'ai' },
    );
    expect(promise.outcome).toBe('block');
    expect(promise.hits.some((h) => h.ruleKey === 'promise_guarantee')).toBe(true);
  });

  it('evaluates custom keyword rules and runs deterministic policy test cases', () => {
    const customRule = {
      name: 'Escalate regulator or lawyer mentions',
      category: 'disclosure' as const,
      framework: 'GDPR',
      actionMode: 'escalate' as const,
      appliesTo: 'both' as const,
      patternType: 'keyword' as const,
      pattern: 'ombudsman|regulator|lawyer',
      isEnabled: true,
      reviewStatus: 'approved' as const,
    };

    const cases = runPolicyTestCases(customRule, [
      { expected: 'escalate', message: 'I will report this to the ombudsman', actor: 'Customer' },
      { expected: 'allow', message: 'What is my tracking link?', actor: 'Customer' },
    ]);

    expect(cases[0].passed).toBe(true);
    expect(cases[1].passed).toBe(true);
  });
});
