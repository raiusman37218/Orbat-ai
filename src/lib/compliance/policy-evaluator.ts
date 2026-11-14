export type PolicyCategory = 'pii' | 'advice' | 'disclosure' | 'financial' | 'custom';
export type PolicyActionMode = 'redact' | 'block' | 'flag' | 'escalate' | 'approval' | 'require';
export type PolicyAppliesTo = 'ai' | 'human' | 'both';
export type PolicyPatternType = 'builtin' | 'regex' | 'keyword' | 'semantic';

export interface PolicyTestCase {
  expected: 'block' | 'allow' | 'hold' | 'escalate' | 'redact';
  message: string;
  actor: string;
  passed?: boolean;
}

export interface EvaluablePolicy {
  id?: string;
  ruleKey?: string | null;
  name: string;
  description?: string;
  category: PolicyCategory;
  framework: string;
  actionMode: PolicyActionMode;
  appliesTo: PolicyAppliesTo;
  patternType: PolicyPatternType;
  pattern: string;
  isEnabled: boolean;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
}

export interface PolicyEvaluationHit {
  policyId?: string;
  ruleKey?: string | null;
  ruleName: string;
  framework: string;
  category: PolicyCategory;
  actionMode: PolicyActionMode;
  severity: 'high' | 'medium' | 'low';
  matchedPreview: string;
}

export interface PolicyEvaluationResult {
  outcome: 'allow' | 'redact' | 'block' | 'escalate' | 'approval' | 'flag';
  redactedText: string;
  hits: PolicyEvaluationHit[];
}

export const DEFAULT_BUILTIN_POLICIES: Omit<EvaluablePolicy, 'id'>[] = [
  {
    ruleKey: 'pii_card',
    name: 'Card numbers (PAN)',
    description: 'Detect 13–19 digit payment card numbers via Luhn verification and redact before storage or reply.',
    category: 'pii',
    framework: 'PCI DSS',
    actionMode: 'redact',
    appliesTo: 'both',
    patternType: 'builtin',
    pattern: 'pii_card',
    isEnabled: true,
    reviewStatus: 'approved',
  },
  {
    ruleKey: 'pii_ssn',
    name: 'National IDs / SSNs',
    description: 'Detect Social Security numbers and structured taxpayer identifiers in messages.',
    category: 'pii',
    framework: 'HIPAA',
    actionMode: 'redact',
    appliesTo: 'both',
    patternType: 'builtin',
    pattern: 'pii_ssn',
    isEnabled: true,
    reviewStatus: 'approved',
  },
  {
    ruleKey: 'secret_credentials',
    name: 'Passwords & API keys',
    description: 'Block messages containing live secret keys, AWS access keys, or inline password disclosures.',
    category: 'pii',
    framework: 'SOC 2',
    actionMode: 'block',
    appliesTo: 'both',
    patternType: 'builtin',
    pattern: 'secret_credentials',
    isEnabled: true,
    reviewStatus: 'approved',
  },
  {
    ruleKey: 'pii_phi',
    name: 'Medical & PHI mentions',
    description: 'Flag health diagnoses, prescriptions, or patient record references for privacy officer review.',
    category: 'pii',
    framework: 'HIPAA',
    actionMode: 'flag',
    appliesTo: 'both',
    patternType: 'builtin',
    pattern: 'pii_phi',
    isEnabled: true,
    reviewStatus: 'approved',
  },
  {
    ruleKey: 'promise_guarantee',
    name: 'Delivery & SLA promises',
    description: 'Block replies guaranteeing exact carrier arrival dates not confirmed by live tracking.',
    category: 'disclosure',
    framework: 'EU AI Act',
    actionMode: 'block',
    appliesTo: 'ai',
    patternType: 'builtin',
    pattern: 'promise_guarantee',
    isEnabled: true,
    reviewStatus: 'approved',
  },
  {
    ruleKey: 'advice_regulated',
    name: 'Financial, medical or legal advice',
    description: 'Block regulated investment picks, medical stoppage advice, or legal recommendations.',
    category: 'advice',
    framework: 'EU AI Act',
    actionMode: 'block',
    appliesTo: 'both',
    patternType: 'builtin',
    pattern: 'advice_regulated',
    isEnabled: true,
    reviewStatus: 'approved',
  },
];

export function passesLuhnCheck(rawDigits: string): boolean {
  const digits = rawDigits.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function safeCompileRegex(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (!trimmed || trimmed.length > 300) return null;
  // Reject obvious catastrophic-backtracking nested quantifiers
  if (/\((?:[^()\\]|\\.)*[+*][^)]*\)[+*?]/.test(trimmed)) return null;
  try {
    return new RegExp(trimmed, 'gi');
  } catch {
    return null;
  }
}

const SSN_RE = /\b(\d{3}-\d{2}-\d{4})\b/g;
const CARD_CANDIDATE_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const SECRET_RE = /\b(sk_(?:live|test)_[A-Za-z0-9]{12,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,})\b|(?:\bpassword\s*(?:is|:|=)\s*\S+)/gi;
const PHI_RE = /\b(diagnosis|prescription|dosage|insulin|chemotherapy|medical\s+record|patient\s+id|blood\s+pressure|lab\s+results?)\b/i;
const PROMISE_RE = /\b(definitely\s+(?:arrive|deliver|get\s+there)|100%\s+guarantee[sd]?|guaranteed?\s+delivery\s+(?:by|tomorrow|friday|saturday|monday))\b/i;
const ADVICE_RE = /\b(safe\s+bet\s+right\s+now|you\s+should\s+(?:buy|invest\s+in|short|sue|stop\s+taking)|guaranteed\s+returns?|fastest\s+growing\s+fund)\b/i;
const ESCALATE_LEGAL_RE = /\b(ombudsman|regulator|financial\s+authority|my\s+lawyer|legal\s+action|lawsuit|sue\s+you)\b/i;

function severityForAction(mode: PolicyActionMode, category: PolicyCategory): 'high' | 'medium' | 'low' {
  if (mode === 'block' || mode === 'redact' || category === 'pii') return 'high';
  if (mode === 'escalate' || mode === 'approval' || category === 'advice' || category === 'financial') return 'medium';
  return 'low';
}

const ACTION_PRECEDENCE: Record<PolicyEvaluationResult['outcome'], number> = {
  allow: 0,
  flag: 1,
  approval: 2,
  escalate: 3,
  redact: 4,
  block: 5,
};

export function evaluateComplianceText(
  text: string,
  policies: EvaluablePolicy[],
  options?: { channel?: 'ai' | 'human' },
): PolicyEvaluationResult {
  const input = (text || '').trim();
  if (!input) return { outcome: 'allow', redactedText: input, hits: [] };

  const channel = options?.channel ?? 'ai';
  let redacted = input;
  const hits: PolicyEvaluationHit[] = [];

  for (const policy of policies) {
    if (!policy.isEnabled) continue;
    if (policy.reviewStatus && policy.reviewStatus !== 'approved') continue;
    if (policy.appliesTo !== 'both' && policy.appliesTo !== channel) continue;

    const key = (policy.ruleKey || policy.pattern || '').trim();
    let matchedPreview: string | null = null;

    if (policy.patternType === 'builtin' || key === 'pii_card' || key === 'pii_ssn' || key === 'secret_credentials' || key === 'pii_phi' || key === 'promise_guarantee' || key === 'advice_regulated') {
      if (key === 'pii_card') {
        redacted = redacted.replace(CARD_CANDIDATE_RE, (raw) => {
          const digits = raw.replace(/\D/g, '');
          if (!passesLuhnCheck(digits)) return raw;
          const tail = digits.slice(-4);
          matchedPreview = `•••• •••• •••• ${tail}`;
          return `[CARD •••• ${tail}]`;
        });
      } else if (key === 'pii_ssn') {
        redacted = redacted.replace(SSN_RE, (raw) => {
          matchedPreview = `•••-••-${raw.slice(-4)}`;
          return `[SSN •••-${raw.slice(-4)}]`;
        });
      } else if (key === 'secret_credentials') {
        redacted = redacted.replace(SECRET_RE, () => {
          matchedPreview = '[SECRET REDACTED]';
          return '[REDACTED SECRET]';
        });
      } else if (key === 'pii_phi') {
        const m = PHI_RE.exec(input);
        if (m) matchedPreview = m[0];
      } else if (key === 'promise_guarantee') {
        const m = PROMISE_RE.exec(input);
        if (m) matchedPreview = m[0];
      } else if (key === 'advice_regulated') {
        const m = ADVICE_RE.exec(input);
        if (m) matchedPreview = m[0];
      }
    } else if (policy.patternType === 'regex') {
      const re = safeCompileRegex(policy.pattern);
      if (re) {
        if (policy.actionMode === 'redact') {
          redacted = redacted.replace(re, (m) => {
            matchedPreview = `[REDACTED:${m.slice(0, 12)}]`;
            return '[REDACTED]';
          });
        } else {
          const m = re.exec(input);
          if (m) matchedPreview = m[0].slice(0, 60);
        }
      }
    } else {
      // keyword / semantic pattern: support pipe- or comma-separated phrases
      const terms = (policy.pattern || policy.name)
        .split(/[|,\n]/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 2);
      const lower = input.toLowerCase();
      const matchedTerm = terms.find((t) => lower.includes(t));
      if (matchedTerm) {
        matchedPreview = matchedTerm;
      } else if (policy.actionMode === 'escalate' && ESCALATE_LEGAL_RE.test(input)) {
        matchedPreview = ESCALATE_LEGAL_RE.exec(input)?.[0] || null;
      }
    }

    if (matchedPreview) {
      hits.push({
        policyId: policy.id,
        ruleKey: policy.ruleKey ?? null,
        ruleName: policy.name,
        framework: policy.framework,
        category: policy.category,
        actionMode: policy.actionMode,
        severity: severityForAction(policy.actionMode, policy.category),
        matchedPreview,
      });
    }
  }

  let outcome: PolicyEvaluationResult['outcome'] = 'allow';
  for (const hit of hits) {
    const mapped: PolicyEvaluationResult['outcome'] =
      hit.actionMode === 'require'
        ? 'approval'
        : hit.actionMode;
    if (ACTION_PRECEDENCE[mapped] > ACTION_PRECEDENCE[outcome]) {
      outcome = mapped;
    }
  }

  return {
    outcome,
    redactedText: redacted,
    hits,
  };
}

export function runPolicyTestCases(
  policy: EvaluablePolicy,
  cases: PolicyTestCase[],
): PolicyTestCase[] {
  const runnablePolicy: EvaluablePolicy = {
    ...policy,
    isEnabled: true,
    reviewStatus: 'approved',
  };
  return cases.map((tc) => {
    const res = evaluateComplianceText(tc.message, [runnablePolicy], {
      channel: tc.actor.toLowerCase().includes('human') ? 'human' : 'ai',
    });
    const hasHit = res.hits.length > 0;
    let passed = false;
    if (tc.expected === 'allow') {
      passed = !hasHit;
    } else if (tc.expected === 'redact') {
      passed = res.outcome === 'redact' || hasHit;
    } else if (tc.expected === 'escalate') {
      passed = res.outcome === 'escalate' || hasHit;
    } else if (tc.expected === 'hold') {
      passed = res.outcome === 'approval' || hasHit;
    } else {
      passed = res.outcome === 'block' || hasHit;
    }
    return { ...tc, passed };
  });
}
