export type GettingStartedStepKey =
  | 'profile'
  | 'data'
  | 'agent'
  | 'widget'
  | 'channels'
  | 'team'
  | 'live';

export interface GettingStartedStepDefinition {
  key: GettingStartedStepKey;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
}

export const GETTING_STARTED_STEPS: GettingStartedStepDefinition[] = [
  {
    key: 'profile',
    title: 'Tell us about your business',
    description: 'Confirm your company details, website URL, industry, and operating region.',
    ctaLabel: 'Review settings',
    href: '/app/settings',
  },
  {
    key: 'data',
    title: 'Connect your store, CRM, or bookings',
    description: 'Let your AI agent look up live orders, customer profiles, and delivery updates.',
    ctaLabel: 'Connect a system',
    href: '/app/channels/connect',
  },
  {
    key: 'agent',
    title: 'Meet and test your AI agent',
    description: 'Review your agent template, add help articles or documents, and run a test reply.',
    ctaLabel: 'Open AI agents',
    href: '/app/agents',
  },
  {
    key: 'widget',
    title: 'Add the chat widget to your site',
    description: 'Customize your launcher and paste the one-line script into your store or website.',
    ctaLabel: 'Set up widget',
    href: '/v2/widget',
  },
  {
    key: 'channels',
    title: 'Turn on email, WhatsApp, or Instagram',
    description: 'Route incoming email and social conversations straight into the shared inbox.',
    ctaLabel: 'Open channels',
    href: '/app/channels',
  },
  {
    key: 'team',
    title: 'Invite your support team',
    description: 'Add teammates and set roles for human handoffs and escalations.',
    ctaLabel: 'Invite teammates',
    href: '/app/team',
  },
  {
    key: 'live',
    title: 'Turn your AI agent live',
    description: 'Publish your primary AI agent from draft to live so it answers real visitors.',
    ctaLabel: 'Go to AI agents',
    href: '/app/agents',
  },
];

export interface IndustryCatalogItem {
  id: string;
  label: string;
  subtitle: string;
  recommendedFrameworks: string[];
  agentTemplate: string;
  skills: string[];
  defaultTopics: string;
}

export const INDUSTRY_CATALOG: IndustryCatalogItem[] = [
  {
    id: 'ecom',
    label: 'E-commerce & retail',
    subtitle: 'Online stores, D2C brands',
    recommendedFrameworks: ['GDPR', 'CCPA', 'PCI'],
    agentTemplate: 'Order & returns agent',
    skills: ['Track orders', 'Start returns', 'Answer product questions', 'Recover carts'],
    defaultTopics: 'Order status, returns, sizing, shipping',
  },
  {
    id: 'saas',
    label: 'SaaS & technology',
    subtitle: 'Software, apps, platforms',
    recommendedFrameworks: ['GDPR', 'SOC2'],
    agentTemplate: 'Technical support agent',
    skills: ['Troubleshoot errors', 'Explain billing', 'Reset access', 'Log issues'],
    defaultTopics: 'Login issues, billing, bugs, how-to',
  },
  {
    id: 'fin',
    label: 'Banking & fintech',
    subtitle: 'Banks, wallets, lending',
    recommendedFrameworks: ['GDPR', 'PCI', 'SOC2', 'KYC'],
    agentTemplate: 'Card & account servicing agent',
    skills: ['Verify identity', 'Freeze cards', 'Explain transactions', 'Open disputes'],
    defaultTopics: 'Card disputes, transfers, KYC, fees',
  },
  {
    id: 'health',
    label: 'Healthcare',
    subtitle: 'Clinics, hospitals, telehealth',
    recommendedFrameworks: ['HIPAA', 'GDPR'],
    agentTemplate: 'Appointments & intake agent',
    skills: ['Book appointments', 'Collect intake forms', 'Send reminders', 'No medical advice'],
    defaultTopics: 'Appointments, prescription refills, billing',
  },
  {
    id: 'edu',
    label: 'Education',
    subtitle: 'Universities, schools, edtech',
    recommendedFrameworks: ['FERPA', 'GDPR'],
    agentTemplate: 'Admissions & student agent',
    skills: ['Answer admissions FAQs', 'Check application status', 'Schedule counselling'],
    defaultTopics: 'Admissions, fees, schedules, portal access',
  },
  {
    id: 'travel',
    label: 'Travel & hospitality',
    subtitle: 'Airlines, hotels, OTAs',
    recommendedFrameworks: ['GDPR', 'PCI'],
    agentTemplate: 'Booking changes agent',
    skills: ['Change bookings', 'Explain policies', 'Process cancellations'],
    defaultTopics: 'Bookings, changes, refunds, baggage',
  },
  {
    id: 'tel',
    label: 'Telecom & utilities',
    subtitle: 'Mobile, internet, energy',
    recommendedFrameworks: ['GDPR', 'CCPA'],
    agentTemplate: 'Plans & outages agent',
    skills: ['Check outages', 'Change plans', 'Explain bills'],
    defaultTopics: 'Outages, plan changes, bills, porting',
  },
  {
    id: 'ins',
    label: 'Insurance',
    subtitle: 'Policies, claims, brokers',
    recommendedFrameworks: ['GDPR', 'SOC2'],
    agentTemplate: 'Claims intake agent',
    skills: ['Open first notice of loss', 'Collect photos', 'Track claim status'],
    defaultTopics: 'Claims, policy changes, renewals',
  },
  {
    id: 'real',
    label: 'Real estate',
    subtitle: 'Agencies, property management',
    recommendedFrameworks: ['GDPR', 'CCPA'],
    agentTemplate: 'Lead qualification agent',
    skills: ['Qualify buyers', 'Book viewings', 'Log maintenance requests'],
    defaultTopics: 'Viewings, rent, maintenance, listings',
  },
  {
    id: 'log',
    label: 'Logistics & delivery',
    subtitle: 'Couriers, 3PL, freight',
    recommendedFrameworks: ['GDPR'],
    agentTemplate: 'Shipment tracking agent',
    skills: ['Track shipments', 'Reschedule delivery', 'File damage claims'],
    defaultTopics: 'Tracking, delivery slots, claims',
  },
  {
    id: 'gov',
    label: 'Public sector',
    subtitle: 'Government, councils, NGOs',
    recommendedFrameworks: ['GDPR', 'WCAG'],
    agentTemplate: 'Citizen services agent',
    skills: ['Answer service questions', 'Check application status', 'Route to departments'],
    defaultTopics: 'Permits, applications, payments, complaints',
  },
  {
    id: 'agency',
    label: 'Agencies & BPO',
    subtitle: 'Outsourced support teams',
    recommendedFrameworks: ['SOC2', 'GDPR'],
    agentTemplate: 'Multi-brand support agent',
    skills: ['Switch brand voice', 'Route by client', 'SLA reporting'],
    defaultTopics: 'Varies by client',
  },
];

export interface ComplianceFrameworkItem {
  id: string;
  label: string;
  description: string;
  category: 'pii' | 'advice' | 'disclosure' | 'financial' | 'custom';
}

export const COMPLIANCE_FRAMEWORKS: ComplianceFrameworkItem[] = [
  {
    id: 'GDPR',
    label: 'GDPR',
    description: 'EU/UK personal data: consent, access and deletion requests handled in 30 days',
    category: 'pii',
  },
  {
    id: 'CCPA',
    label: 'CCPA / CPRA',
    description: 'California privacy rights: opt-out, access and deletion disclosures',
    category: 'disclosure',
  },
  {
    id: 'HIPAA',
    label: 'HIPAA',
    description: 'Protected health information: BAA, PHI redaction, access logs',
    category: 'pii',
  },
  {
    id: 'PCI',
    label: 'PCI DSS',
    description: 'Card data never stored: card numbers auto-redacted in chat and email',
    category: 'financial',
  },
  {
    id: 'SOC2',
    label: 'SOC 2 controls',
    description: 'Access reviews, audit log export and change history for auditors',
    category: 'custom',
  },
  {
    id: 'KYC',
    label: 'KYC / AML disclosures',
    description: 'Identity verification before account actions, regulated wording',
    category: 'financial',
  },
  {
    id: 'FERPA',
    label: 'FERPA',
    description: 'Student records shared only with verified students or guardians',
    category: 'pii',
  },
  {
    id: 'WCAG',
    label: 'Accessibility (WCAG 2.2 AA)',
    description: 'Accessible widget and help center for public services',
    category: 'custom',
  },
];

export const ONBOARDING_CHANNELS = [
  { id: 'web', label: 'Website chat', description: 'Add a widget to your site' },
  { id: 'email', label: 'Email', description: 'Forward your support inbox' },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Business API number' },
  { id: 'instagram', label: 'Instagram', description: 'DMs and story replies' },
  { id: 'facebook', label: 'Messenger', description: 'Facebook page messages' },
  { id: 'voice', label: 'SMS & voice', description: 'Text and call transcripts' },
] as const;

export const ONBOARDING_CONNECTORS = [
  { id: 'shopify', initials: 'SH', label: 'Shopify', category: 'ecommerce' as const, description: 'Orders, customers, refunds' },
  { id: 'woocommerce', initials: 'WC', label: 'WooCommerce', category: 'ecommerce' as const, description: 'Orders and customers' },
  { id: 'hubspot', initials: 'HS', label: 'HubSpot', category: 'crm' as const, description: 'Contacts and deals' },
  { id: 'salesforce', initials: 'SF', label: 'Salesforce', category: 'crm' as const, description: 'Accounts and cases' },
  { id: 'stripe', initials: 'ST', label: 'Stripe', category: 'payments' as const, description: 'Payments and subscriptions' },
  { id: 'google_calendar', initials: 'GC', label: 'Google Calendar', category: 'crm' as const, description: 'Bookings and availability' },
] as const;

export interface PaygRateCatalog {
  conversationBaseUsd: number;
  aiLightUsd: number;
  aiStandardUsd: number;
  aiAdvancedUsd: number;
  voiceMinuteUsd: number;
  websiteAuditUsd: number;
}

export const DEFAULT_PAYG_RATES: PaygRateCatalog = {
  conversationBaseUsd: 0.1,
  aiLightUsd: 0.01,
  aiStandardUsd: 0.03,
  aiAdvancedUsd: 0.08,
  voiceMinuteUsd: 0.08,
  websiteAuditUsd: 4.0,
};

export function slugifyCompanyName(name: string): string {
  const cleaned = (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'your-company';
}

export function computeRecommendedFrameworks(industryId: string, country: string): string[] {
  const industry = INDUSTRY_CATALOG.find((item) => item.id === industryId);
  const set = new Set<string>(industry?.recommendedFrameworks ?? ['GDPR']);
  const c = (country || '').toLowerCase();
  if (c.includes('united states') || c === 'us') {
    set.add('CCPA');
  } else if (c.includes('united kingdom') || c.includes('germany') || c.includes('eu') || c.includes('france')) {
    set.add('GDPR');
  }
  return Array.from(set);
}

export function computeChecklistProgress(items: Array<{ completed: boolean }>): {
  doneCount: number;
  totalCount: number;
  percentage: number;
} {
  const totalCount = items.length;
  if (totalCount === 0) {
    return { doneCount: 0, totalCount: 0, percentage: 0 };
  }
  const doneCount = items.filter((item) => item.completed).length;
  return {
    doneCount,
    totalCount,
    percentage: Math.round((doneCount / totalCount) * 100),
  };
}

export function calculateTrialHoursSaved(aiRepliesCount: number): number {
  const count = Math.max(0, Math.floor(aiRepliesCount || 0));
  // 7 minutes saved per handled AI conversation/reply on average
  return Math.max(0, Math.round((count * 7) / 60));
}

export function computeRecommendedPlanSlug(
  usage: {
    aiConversations30d: number;
    agentsCount: number;
    channelsCount: number;
  },
  plans: Array<{
    slug: string;
    isPopular?: boolean;
    maxAiRepliesPerMonth: number | null;
    maxAgents: number | null;
    maxChannelsConnected: number | null;
    monthlyPrice: number;
  }>,
): string | null {
  const paidCandidates = plans
    .filter((p) => p.monthlyPrice > 0)
    .sort((a, b) => a.monthlyPrice - b.monthlyPrice);

  for (const plan of paidCandidates) {
    const fitsAi =
      plan.maxAiRepliesPerMonth === null || usage.aiConversations30d <= plan.maxAiRepliesPerMonth;
    const fitsAgents =
      plan.maxAgents === null || usage.agentsCount <= plan.maxAgents;
    const fitsChannels =
      plan.maxChannelsConnected === null || usage.channelsCount <= plan.maxChannelsConnected;
    if (fitsAi && fitsAgents && fitsChannels) {
      return plan.slug;
    }
  }

  return (
    paidCandidates.find((p) => p.isPopular)?.slug ??
    paidCandidates[paidCandidates.length - 1]?.slug ??
    plans[0]?.slug ??
    null
  );
}

export function calculatePerSeatComparison(input: {
  agentsCount: number;
  competitorPerSeatUsd?: number;
  fixedMonthlyPlanUsd: number;
}): {
  agentsCount: number;
  competitorMonthlyUsd: number;
  orbatMonthlyUsd: number;
  monthlySavingsUsd: number;
} {
  const agentsCount = Math.max(1, Math.min(200, Math.floor(input.agentsCount || 1)));
  const perSeat = Math.max(1, Number(input.competitorPerSeatUsd ?? 65));
  const competitorMonthlyUsd = Math.round(agentsCount * perSeat);
  const orbatMonthlyUsd = Math.max(0, Math.round(Number(input.fixedMonthlyPlanUsd || 0)));
  return {
    agentsCount,
    competitorMonthlyUsd,
    orbatMonthlyUsd,
    monthlySavingsUsd: Math.max(0, competitorMonthlyUsd - orbatMonthlyUsd),
  };
}
