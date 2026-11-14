/**
 * Masks payment card PANs and US SSNs in voice transcripts before persistence
 * when workspace PII/PCI redaction is enabled.
 */
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const SSN_RE = /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g;

export function redactVoicePii(
  input: string,
  enabled: boolean,
): { text: string; redacted: boolean } {
  const clean = (input || '').trim();
  if (!enabled || !clean) return { text: clean, redacted: false };

  let redacted = false;
  let next = clean.replace(SSN_RE, () => {
    redacted = true;
    return '[REDACTED • SSN]';
  });
  next = next.replace(CARD_RE, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19) {
      redacted = true;
      return `[REDACTED • Card ending ${digits.slice(-4)}]`;
    }
    return match;
  });

  return { text: next, redacted };
}
