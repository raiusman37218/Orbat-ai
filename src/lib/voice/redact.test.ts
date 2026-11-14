import { describe, expect, it } from 'vitest';
import { redactVoicePii } from './redact';

describe('redactVoicePii', () => {
  it('masks credit card PANs and SSNs when redaction is enabled', () => {
    const out = redactVoicePii('Card is 4242 4242 4242 4242 and SSN 123-45-6789', true);
    expect(out.redacted).toBe(true);
    expect(out.text).toContain('[REDACTED • Card ending 4242]');
    expect(out.text).toContain('[REDACTED • SSN]');
    expect(out.text).not.toContain('4242 4242');
    expect(out.text).not.toContain('123-45-6789');
  });

  it('leaves normal order numbers untouched and skips masking when disabled', () => {
    const orderText = 'Checking order 48219';
    expect(redactVoicePii(orderText, true)).toEqual({ text: orderText, redacted: false });
    expect(redactVoicePii('123-45-6789', false)).toEqual({ text: '123-45-6789', redacted: false });
  });
});
