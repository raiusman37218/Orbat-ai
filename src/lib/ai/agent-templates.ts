/**
 * Curated industry AI Agent templates & shared Agent Builder / Trust Ladder metadata.
 * Pure module (zero server imports) so both Server Actions and Client Components
 * can share exact template defaults, compliance guardrails, and autonomy levels.
 */

export type AgentStatus = 'live' | 'draft' | 'paused';
export type AgentReplyLanguageMode = 'match_customer' | 'native_script' | 'english_only';
export type AgentAnswerMode = 'agent' | 'strict';

export interface AgentEscalationRules {
  confidenceThreshold: number;
  handoffOnFrustration: boolean;
  maxBotTurns: number;
  requireConfirmation: boolean;
  blockedTopics: string[];
  handoffGroupId: string | null;
}

export interface AgentKnowledgeScope {
  allArticles: boolean;
  sectionIds: string[];
  includeBotKnowledge: boolean;
}

export interface AgentCapabilities {
  actions: string[];
  frameworks: string[];
  subAgentId: string | null;
}

export interface AgentAppearance {
  badgeLabel: string;
  showCitations: boolean;
  welcomeMessage: string;
}

export interface AgentTemplateActionItem {
  title: string;
  detail: string;
}

export interface AgentTemplateSampleTurn {
  from: 'customer' | 'agent';
  text: string;
}

export interface AgentTemplateSpec {
  id: string;
  name: string;
  industry: string;
  tagline: string;
  frameworks: string[];
  actionsCount: number;
  workflowsCount: number;
  badge: string;
  roleTitle: string;
  tone: string;
  channels: string[];
  actions: AgentTemplateActionItem[];
  guardrails: string[];
  worksWith: string[];
  sampleConversation: AgentTemplateSampleTurn[];
  systemPrompt: string;
}

export const AGENT_TEMPLATE_INDUSTRIES = [
  'All',
  'Finance',
  'Healthcare',
  'Retail',
  'SaaS',
  'Insurance',
  'Education',
  'Travel',
  'Telecom',
  'Public sector',
  'Real estate',
] as const;

export const DEFAULT_ESCALATION_RULES: AgentEscalationRules = {
  confidenceThreshold: 0.7,
  handoffOnFrustration: true,
  maxBotTurns: 8,
  requireConfirmation: true,
  blockedTopics: [],
  handoffGroupId: null,
};

export const DEFAULT_KNOWLEDGE_SCOPE: AgentKnowledgeScope = {
  allArticles: true,
  sectionIds: [],
  includeBotKnowledge: true,
};

export const DEFAULT_AGENT_APPEARANCE: AgentAppearance = {
  badgeLabel: 'AI agent',
  showCitations: true,
  welcomeMessage: '',
};

export const AUTONOMY_LEVEL_DEFS = [
  {
    level: 1 as const,
    name: 'Shadow',
    description:
      'AI drafts silently while a human answers. Drafts are compared with what the human sent.',
    promotionRule: 'Drafts agree with humans >= 85% over 100+ conversations',
  },
  {
    level: 2 as const,
    name: 'Suggest',
    description: 'The draft appears in Copilot. A team member reviews and sends with one click.',
    promotionRule: '>= 80% of suggested drafts sent without edits',
  },
  {
    level: 3 as const,
    name: 'Supervised',
    description: 'AI sends replies directly. A sample is audited by a supervisor in the review queue.',
    promotionRule: 'Correction and complaint rate stays below 2%',
  },
  {
    level: 4 as const,
    name: 'Autonomous',
    description: 'AI sends replies and executes approved workflow actions within guardrails.',
    promotionRule: 'Remains active while verified quality holds',
  },
] as const;

export const AGENT_TEMPLATES: AgentTemplateSpec[] = [
  {
    id: 'fintech-support',
    name: 'Fintech support',
    industry: 'Finance',
    tagline:
      'Card disputes, wire status, KYC checks, and limits with KYC/AML and GDPR compliance guardrails.',
    frameworks: ['GDPR', 'KYC / AML', 'PSD2'],
    actionsCount: 5,
    workflowsCount: 3,
    badge: 'Finance · Compliance',
    roleTitle: 'Fintech compliance & account specialist',
    tone: 'Calm, accurate, transparent',
    channels: ['web', 'email', 'whatsapp'],
    actions: [
      {
        title: 'Look up transfer status',
        detail: 'Checks settlement rail state & timestamps when customer identity is verified.',
      },
      {
        title: 'Start card freeze workflow',
        detail: 'Guides lost/stolen card lock and escalates chargeback disputes to Risk team.',
      },
      {
        title: 'Explain fee & FX limits',
        detail: 'Quotes exact verified schedule fees and transfer windows from Help Center.',
      },
      {
        title: 'KYC verification guide',
        detail: 'Explains acceptable ID & proof-of-address formats without storing files in chat.',
      },
      {
        title: 'Compliance handoff trigger',
        detail: 'Escalates fraud reports, AML holds, and chargebacks to specialist queue.',
      },
    ],
    guardrails: [
      'Never quote balance, IBAN, or transaction details before session identity is confirmed.',
      'Never give financial, tax, or investment advice or promise dispute outcomes.',
      'Never ask for full PAN card numbers, CVV, PINs, or one-time passwords.',
    ],
    worksWith: ['Help Center', 'Stripe / Ledger webhook', 'Risk queue', 'Compliance audit log'],
    sampleConversation: [
      { from: 'customer', text: 'My international wire has been pending for 2 days. Where is it?' },
      {
        from: 'agent',
        text: 'SWIFT wires typically settle within 1–3 business days depending on intermediary banks. Once I verify your transfer reference, I can check its current rail status or connect you with Payments Ops.',
      },
    ],
    systemPrompt:
      'Act as a careful fintech support specialist. Quote exact published fee schedules and settlement windows. Always escalate suspected fraud, unauthorized transactions, or AML holds to a verified specialist immediately.',
  },
  {
    id: 'clinic-concierge',
    name: 'Clinic & patient concierge',
    industry: 'Healthcare',
    tagline:
      'Appointment scheduling, preparation instructions, and insurance basics with strict HIPAA boundaries.',
    frameworks: ['HIPAA', 'GDPR'],
    actionsCount: 4,
    workflowsCount: 2,
    badge: 'Healthcare · PHI-safe',
    roleTitle: 'Patient scheduling & clinic guide',
    tone: 'Reassuring, respectful, clear',
    channels: ['web', 'whatsapp', 'voice'],
    actions: [
      {
        title: 'Share clinic hours & locations',
        detail: 'Provides exact branch timings, parking, and telehealth joining steps.',
      },
      {
        title: 'Appointment preparation checklist',
        detail: 'Shares non-clinical fasting or document checklists prior to visits.',
      },
      {
        title: 'Verify accepted insurance panels',
        detail: 'Looks up published insurer networks and co-pay billing FAQs.',
      },
      {
        title: 'Triage urgent symptoms to nurse desk',
        detail: 'Immediately hands off clinical or symptom questions and reminds caller of emergency numbers.',
      },
    ],
    guardrails: [
      'Never diagnose symptoms, interpret lab results, or suggest medications.',
      'Never ask patients to paste sensitive medical history into unauthenticated web chat.',
      'For chest pain, severe distress, or emergencies, instruct immediately to contact local emergency services.',
    ],
    worksWith: ['Help Center', 'Clinic directory', 'Scheduling inbox'],
    sampleConversation: [
      { from: 'customer', text: 'Do I need to fast before my morning blood draw tomorrow?' },
      {
        from: 'agent',
        text: 'For standard lipid and fasting glucose panels, our clinic guide recommends fasting (water only) for 8–12 hours beforehand. Let me know the panel name or I can connect our nurse desk to confirm your exact requisition.',
      },
    ],
    systemPrompt:
      'Act as a calm patient concierge. Handle scheduling, directions, clinic policies, and insurance panel questions from approved documentation. Never give medical advice or collect unnecessary PHI.',
  },
  {
    id: 'commerce-concierge',
    name: 'Retail & e-commerce concierge',
    industry: 'Retail',
    tagline:
      'Resolves where-is-my-order questions, returns, exchanges, sizing, and promo policies 24/7.',
    frameworks: ['PCI-DSS', 'CCPA'],
    actionsCount: 6,
    workflowsCount: 4,
    badge: 'Retail · High automation',
    roleTitle: 'Order & returns concierge',
    tone: 'Friendly, proactive, concise',
    channels: ['web', 'whatsapp', 'instagram', 'email'],
    actions: [
      {
        title: 'Order tracking & delivery status',
        detail: 'Matches customer orders and shares carrier windows and trace procedures.',
      },
      {
        title: 'Return & exchange eligibility',
        detail: 'Evaluates item return window and explains pre-paid label policy.',
      },
      {
        title: 'Discount & promo troubleshooting',
        detail: 'Checks stackability rules and minimum spend thresholds.',
      },
      {
        title: 'Damaged item photo intake',
        detail: 'Requests order number and photo evidence then routes high-value claims.',
      },
      {
        title: 'VIP high-value order handoff',
        detail: 'Transfers orders above threshold or repeat frustration to senior care.',
      },
      {
        title: 'Multilingual storefront replies',
        detail: 'Replies natively in English, Roman Urdu, Hinglish, Arabic, Spanish, and more.',
      },
    ],
    guardrails: [
      'Never invent delivery guarantees not listed in shipping documentation.',
      'Escalate refund amounts exceeding your workspace approval cap to a supervisor.',
      'Never collect credit card numbers in chat.',
    ],
    worksWith: ['Customer orders', 'Help Center', 'WhatsApp & Instagram', 'Inbox'],
    sampleConversation: [
      { from: 'customer', text: 'My parcel has been stuck in transit for 4 days, what happens now?' },
      {
        from: 'agent',
        text: 'If tracking shows no carrier scan for 3 business days, we open a carrier trace right away. Share your order number and email, and I will hand this over to start the trace for you.',
      },
    ],
    systemPrompt:
      'Act as a warm retail care concierge. Lead with the exact policy or order timeline from the knowledge base, ask only one clear question when an order number is needed, and hand over high-value refunds or carrier losses cleanly.',
  },
  {
    id: 'saas-onboarding',
    name: 'SaaS onboarding & billing desk',
    industry: 'SaaS',
    tagline:
      'Guides SSO, API keys, webhooks, seat billing, and workspace setup without exposing secrets.',
    frameworks: ['SOC 2', 'GDPR'],
    actionsCount: 5,
    workflowsCount: 3,
    badge: 'SaaS · Technical',
    roleTitle: 'Product & billing specialist',
    tone: 'Crisp, technical, structured',
    channels: ['web', 'email', 'slack'],
    actions: [
      {
        title: 'Plan & seat pricing explainer',
        detail: 'Compares plan quotas, annual vs monthly billing, and overage behavior.',
      },
      {
        title: 'Webhook & API quickstart',
        detail: 'Points developers to documented endpoints, auth headers, and rate limits.',
      },
      {
        title: 'Invoice & VAT receipt guide',
        detail: 'Walks billing admins through invoice download and tax ID updates.',
      },
      {
        title: 'SSO / 2FA lockout handoff',
        detail: 'Routes workspace lockouts to Security Admin review with verification steps.',
      },
      {
        title: 'Bug report intake ticket',
        detail: 'Captures repro steps, browser/SDK version, and escalates to Engineering Triage.',
      },
    ],
    guardrails: [
      'Never echo back API keys, bearer tokens, webhook secrets, or user passwords.',
      'Never promise unannounced roadmap features or custom Enterprise pricing.',
      'Do not fabricate endpoint paths or JSON field names missing from documentation.',
    ],
    worksWith: ['Help Center', 'Tickets', 'API docs', 'Billing workspace'],
    sampleConversation: [
      { from: 'customer', text: 'How do I add 4 seats mid-cycle without losing our annual discount?' },
      {
        from: 'agent',
        text: 'Seats added mid-cycle are prorated for the remaining days of your annual term at your locked per-seat rate. An owner or admin can add them in Billing → Seats, or I can pass this to our billing team if you need a PO invoice.',
      },
    ],
    systemPrompt:
      'Act as a concise B2B SaaS support specialist. Give numbered troubleshooting steps from documented product articles, never guess API fields, and immediately route security lockouts or enterprise quotes to the team.',
  },
  {
    id: 'claims-intake',
    name: 'Insurance policy & claims intake',
    industry: 'Insurance',
    tagline:
      'Coverage summaries, FNOL claim document checklists, and deductible explanations with compliance locks.',
    frameworks: ['GDPR', 'HIPAA', 'SOX'],
    actionsCount: 4,
    workflowsCount: 3,
    badge: 'Insurance · Audited',
    roleTitle: 'Claims intake & policy assistant',
    tone: 'Steady, empathetic, exact',
    channels: ['web', 'email', 'voice'],
    actions: [
      {
        title: 'Policy coverage FAQ search',
        detail: 'Cites published policy booklet clauses for covered perils and deductibles.',
      },
      {
        title: 'Claim document checklist',
        detail: 'Lists exact itemized receipts, police report, or adjuster forms needed.',
      },
      {
        title: 'Locked claim determination handoff',
        detail: 'Routes liability, coverage denial, and settlement negotiations to licensed adjusters.',
      },
      {
        title: 'FNOL summary builder',
        detail: 'Collects incident date, policy reference, and hands off structured internal note.',
      },
    ],
    guardrails: [
      'Never state that a claim is approved or denied — only licensed adjusters issue determinations.',
      'Never reinterpret legal exclusions beyond published policy language.',
      'Always cite the exact policy section heading when summarizing deductibles.',
    ],
    worksWith: ['Help Center', 'Tickets', 'Voice intake'],
    sampleConversation: [
      { from: 'customer', text: 'My luggage was damaged by the airline. What do I upload for a claim?' },
      {
        from: 'agent',
        text: 'Please upload your carrier Property Irregularity Report (PIR), boarding pass, and repair quote or purchase receipt. Once ready, I can route your file to a claims specialist to review.',
      },
    ],
    systemPrompt:
      'Act as a licensed-adjacent claims intake assistant. Provide clear documentation checklists and published policy summaries. Always lock coverage determinations to human adjusters.',
  },
  {
    id: 'student-advising',
    name: 'Admissions & student services desk',
    industry: 'Education',
    tagline:
      'Answers enrollment deadlines, tuition installments, LMS logins, and transcript requests.',
    frameworks: ['FERPA', 'GDPR'],
    actionsCount: 4,
    workflowsCount: 2,
    badge: 'Education · FERPA-ready',
    roleTitle: 'Student success advisor',
    tone: 'Encouraging, clear, helpful',
    channels: ['web', 'whatsapp', 'email'],
    actions: [
      {
        title: 'Admissions timeline & prerequisites',
        detail: 'Shares intake windows, application fees, and transcript submission steps.',
      },
      {
        title: 'Tuition & installment schedules',
        detail: 'Explains fee payment plans and scholarship deadlines from approved guides.',
      },
      {
        title: 'LMS & portal access help',
        detail: 'Resolves SSO, course enrollment visibility, and password reset steps.',
      },
      {
        title: 'Advisor record handoff',
        detail: 'Escalates grade appeals, financial aid exceptions, and FERPA record requests.',
      },
    ],
    guardrails: [
      'Never disclose grades, attendance, or financial aid records without registrar verification.',
      'Never waive application deadlines or grant credit transfers autonomously.',
    ],
    worksWith: ['Help Center', 'Inbox', 'Tickets'],
    sampleConversation: [
      { from: 'customer', text: 'When is the fall intake tuition installment deadline?' },
      {
        from: 'agent',
        text: 'Under our Fall Payment Plan guide, the first 50% installment is due August 15 and the remaining balance on October 1. If you need a bursar extension, I can connect you with Financial Services.',
      },
    ],
    systemPrompt:
      'Act as a supportive admissions and student services advisor. Answer policy, deadline, syllabus, and portal questions strictly from Help Center guides, and route grade/aid exceptions to registrars.',
  },
  {
    id: 'travel-rebooking',
    name: 'Travel & booking concierge',
    industry: 'Travel',
    tagline:
      'Baggage rules, fare flexibility, cancellation windows, and disruption escalation for travelers.',
    frameworks: ['DOT / EU261', 'PCI-DSS'],
    actionsCount: 5,
    workflowsCount: 3,
    badge: 'Travel · Multilingual',
    roleTitle: 'Booking & disruption specialist',
    tone: 'Calm under pressure, swift, clear',
    channels: ['web', 'whatsapp', 'instagram'],
    actions: [
      {
        title: 'Cancellation & fare rules',
        detail: 'Explains 24-hour grace periods, credit vouchers, and change fees by fare class.',
      },
      {
        title: 'Baggage allowance lookup',
        detail: 'Shares cabin/checked weight limits and sports equipment surcharges.',
      },
      {
        title: 'EU261 / DOT delay rights guide',
        detail: 'Provides documented passenger rights and meal/hotel voucher claim forms.',
      },
      {
        title: 'Flight disruption urgent handoff',
        detail: 'Marks missed-connection travelers as high priority for live reservation agents.',
      },
      {
        title: 'Multi-script traveler support',
        detail: 'Assists travelers smoothly in Arabic, Spanish, French, Urdu, Hindi, and English.',
      },
    ],
    guardrails: [
      'Never confirm seat upgrades, waived change fees, or rebooked flights autonomously without reservation tool confirmation.',
      'Never ask for passport photos inside unverified web chat.',
    ],
    worksWith: ['Help Center', 'Multilingual engine', 'Priority Inbox'],
    sampleConversation: [
      { from: 'customer', text: 'My flight got delayed 4 hours, can I switch to the evening departure?' },
      {
        from: 'agent',
        text: 'Delays over 3 hours qualify for complimentary same-day rebooking on available flights under our disruption policy. Share your booking code and I will route you to our priority desk right now.',
      },
    ],
    systemPrompt:
      'Act as a fast, reassuring travel concierge. Explain published baggage, fare flexibility, and passenger rights clearly, and escalate missed connections or rebookings as priority.',
  },
  {
    id: 'telecom-plan-billing',
    name: 'Telecom plan, SIM & roaming specialist',
    industry: 'Telecom',
    tagline:
      'Handles eSIM activation steps, roaming packs, bill cycle queries, and outage checks.',
    frameworks: ['GDPR', 'CPNI'],
    actionsCount: 5,
    workflowsCount: 2,
    badge: 'Telecom · High volume',
    roleTitle: 'Connectivity & billing specialist',
    tone: 'Direct, step-by-step, patient',
    channels: ['web', 'whatsapp', 'voice'],
    actions: [
      {
        title: 'eSIM activation walkthrough',
        detail: 'Walks iOS and Android users through QR installation and APN setup.',
      },
      {
        title: 'Roaming pass explainer',
        detail: 'Compares regional roaming day passes and data cap alerts.',
      },
      {
        title: 'Bill breakdown explainer',
        detail: 'Clarifies proration, taxes, and recurring add-on descriptions.',
      },
      {
        title: 'Port-out & SIM-swap lock',
        detail: 'Blocks SIM-swap or number port queries for verified human security team.',
      },
      {
        title: 'Network ticket escalation',
        detail: 'Collects ZIP/city + signal bars and opens ticket for NOC review.',
      },
    ],
    guardrails: [
      'Never process SIM-swap, number porting, or account ownership transfers autonomously.',
      'Protect CPNI call logs and account PINs; never request PINs in chat.',
    ],
    worksWith: ['Help Center', 'Voice Desk', 'Tickets'],
    sampleConversation: [
      { from: 'customer', text: 'Just landed in Dubai, how do I turn on my travel data pass?' },
      {
        from: 'agent',
        text: 'Enable Data Roaming under Cellular Settings and keep your primary line active for the Travel Pass — it activates automatically when data is used for a flat daily rate.',
      },
    ],
    systemPrompt:
      'Act as a practical telecom specialist. Give device-specific configuration steps cleanly and always escalate SIM-swap, number-porting, and account billing disputes to security agents.',
  },
  {
    id: 'benefits-intake',
    name: 'Public sector & citizen services desk',
    industry: 'Public sector',
    tagline:
      'Clear plain-language eligibility guides, permit checklists, and WCAG-accessible responses.',
    frameworks: ['ADA / WCAG', 'GDPR'],
    actionsCount: 3,
    workflowsCount: 2,
    badge: 'Public · Accessible',
    roleTitle: 'Citizen services assistant',
    tone: 'Plain-language, neutral, respectful',
    channels: ['web', 'email'],
    actions: [
      {
        title: 'Eligibility & form finder',
        detail: 'Directs residents to exact permit, license, or benefit filing checklists.',
      },
      {
        title: 'Office locations & hours',
        detail: 'Provides accessible branch hours, holiday closures, and appointment links.',
      },
      {
        title: 'Caseworker referral',
        detail: 'Transfers complex application appeals with concise topic summary.',
      },
    ],
    guardrails: [
      'Never approve or reject statutory benefit eligibility.',
      'Avoid bureaucratic jargon; keep sentences short and readable.',
    ],
    worksWith: ['Help Center', 'Tickets'],
    sampleConversation: [
      { from: 'customer', text: 'What documents do I bring to renew a business permit?' },
      {
        from: 'agent',
        text: 'Bring your current permit number, government-issued ID, and updated municipal tax clearance certificate. In-person counters are open Monday–Friday, 8:30 AM to 4:30 PM.',
      },
    ],
    systemPrompt:
      'Act as a clear, neutral public services guide. Use short plain-language sentences grounded strictly in official published requirements, and never issue eligibility determinations.',
  },
  {
    id: 'leasing-assistant',
    name: 'Real estate & leasing coordinator',
    industry: 'Real estate',
    tagline:
      'Answers listing availability, tour booking policies, application fees, and maintenance intake.',
    frameworks: ['Fair Housing', 'GDPR'],
    actionsCount: 4,
    workflowsCount: 3,
    badge: 'Real estate · Fair Housing',
    roleTitle: 'Leasing & resident coordinator',
    tone: 'Welcoming, neutral, prompt',
    channels: ['web', 'whatsapp', 'instagram'],
    actions: [
      {
        title: 'Property & amenity Q&A',
        detail: 'Quotes pet policies, parking fees, utilities included, and lease lengths.',
      },
      {
        title: 'Tour scheduling guide',
        detail: 'Explains ID check-in requirements and self-guided vs agent tour slots.',
      },
      {
        title: 'Maintenance priority triage',
        detail: 'Flags water leaks, heat loss, or lockouts as urgent tickets for dispatch.',
      },
      {
        title: 'Fair Housing compliance guard',
        detail: 'Ensures consistent objective screening criteria without steering.',
      },
    ],
    guardrails: [
      'Strictly comply with Fair Housing rules: never characterize neighborhoods or steer applicants.',
      'Route emergency maintenance (gas smell, active flooding, fire) with emergency shutoff notice immediately.',
    ],
    worksWith: ['Help Center', 'Tickets', 'Inbox'],
    sampleConversation: [
      { from: 'customer', text: 'Are dogs allowed at Oakwood Apartments and what is the pet deposit?' },
      {
        from: 'agent',
        text: 'Up to 2 pets (dogs or cats, breed restrictions in the lease guide apply) are welcome with a $300 refundable deposit and $35 monthly pet rent. Would you like our tour hours?',
      },
    ],
    systemPrompt:
      'Act as a courteous leasing and resident coordinator. Share published pet, utility, application criteria, and tour policies consistently without steering, and flag maintenance emergencies immediately.',
  },
];

export function getAgentTemplate(templateId: string | null | undefined): AgentTemplateSpec | null {
  if (!templateId) return null;
  return AGENT_TEMPLATES.find((t) => t.id === templateId) ?? null;
}

export function slugifyAgentName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48) || 'ai-agent'
  );
}
