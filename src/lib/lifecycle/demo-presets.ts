/**
 * Pure client-safe presets, personas, channels, and result contracts
 * for the 1-Click Demo Seeder and Live Customer Chat Simulator.
 */

export type DemoChannel = 'web' | 'whatsapp' | 'email' | 'instagram';

export type DemoPersona = 'new_visitor' | 'vip_pro' | 'frustrated_buyer';

export type DemoScenarioKey =
  | 'pricing_rag'
  | 'refund_langgraph'
  | 'angry_handoff'
  | 'roman_urdu'
  | 'enterprise_quote_adk';

export interface DemoChannelOption {
  id: DemoChannel;
  label: string;
  shortLabel: string;
}

export interface DemoPersonaOption {
  id: DemoPersona;
  label: string;
  subtitle: string;
  defaultName: string;
  defaultEmail: string;
  planTier: string;
}

export interface DemoScenarioPreset {
  key: DemoScenarioKey;
  label: string;
  badge: string;
  defaultPersona: DemoPersona;
  defaultChannel: DemoChannel;
  message: string;
  hint: string;
}

export interface DemoSeedSummary {
  sectionsCreated: number;
  articlesCreated: number;
  chunksSynced: number;
  agentsConfigured: number;
  companiesCreated: number;
  visitorsUpserted: number;
  ordersCreated: number;
  dealsCreated: number;
  tasksCreated: number;
  conversationsCreated: number;
  ticketsCreated: number;
  handoffsCreated: number;
  approvalsCreated: number;
  embeddingMode: 'pgvector' | 'keyword_fallback';
}

export interface SimulateChatResult {
  success: boolean;
  conversationId: string;
  inboundMessageId: string;
  ticketNumber: number | null;
  channel: DemoChannel;
  persona: DemoPersona;
  visitorName: string;
  visitorEmail: string | null;
  aiReplied: boolean;
  aiReplyText: string | null;
  aiEngine: string | null;
  aiAgentName: string | null;
  status: 'replied' | 'paused_approval' | 'handoff_queued' | 'handoff_offered' | 'blocked_or_skipped' | 'no_reply';
  reason: string | null;
  handoffStatus: string | null;
  approvalId: string | null;
  runId: string | null;
  citedArticles: Array<{ title: string; slug: string }>;
  createdDeal: { id: string; title: string; stage: string; amount: number } | null;
  inboxHref: string;
  handoffHref: string;
  error?: string;
}

export const DEMO_CHANNELS: readonly DemoChannelOption[] = [
  { id: 'web', label: 'Web Widget', shortLabel: 'Web' },
  { id: 'whatsapp', label: 'WhatsApp', shortLabel: 'WhatsApp' },
  { id: 'email', label: 'Email', shortLabel: 'Email' },
  { id: 'instagram', label: 'Instagram', shortLabel: 'Instagram' },
] as const;

export const DEMO_PERSONAS: readonly DemoPersonaOption[] = [
  {
    id: 'new_visitor',
    label: 'New Visitor',
    subtitle: 'First-time evaluator comparing plans',
    defaultName: 'Amina Tariq',
    defaultEmail: 'amina.tariq@demo-prospect.io',
    planTier: 'free',
  },
  {
    id: 'vip_pro',
    label: 'VIP Pro Customer',
    subtitle: 'Active Pro account · $24k ARR · paid invoices',
    defaultName: 'Zainab Malik',
    defaultEmail: 'zainab.malik@northstar-labs.io',
    planTier: 'pro',
  },
  {
    id: 'frustrated_buyer',
    label: 'Frustrated Buyer',
    subtitle: 'Urgent billing issue · expects fast escalation',
    defaultName: 'Bilal Siddiqui',
    defaultEmail: 'bilal.siddiqui@crescent-retail.co',
    planTier: 'business',
  },
] as const;

export const DEMO_SCENARIO_PRESETS: readonly DemoScenarioPreset[] = [
  {
    key: 'pricing_rag',
    label: 'Pricing Question (RAG)',
    badge: 'RAG',
    defaultPersona: 'new_visitor',
    defaultChannel: 'web',
    message:
      'What are your Pro and Business pricing tiers, and does the Pro plan include WhatsApp and AI Copilot?',
    hint: 'Retrieves grounded Knowledge Base articles and answers directly with citations.',
  },
  {
    key: 'refund_langgraph',
    label: 'Refund Approval (LangGraph Pause)',
    badge: 'Approval',
    defaultPersona: 'vip_pro',
    defaultChannel: 'email',
    message:
      'Please process a full refund of $480 for order ORD-9421 because our annual workspace seats were double-billed.',
    hint: 'Hits the Refund Trust Ladder guardrail (Level 2) and pauses for human approval.',
  },
  {
    key: 'angry_handoff',
    label: 'Angry Customer (Handoff Queue)',
    badge: 'Handoff',
    defaultPersona: 'frustrated_buyer',
    defaultChannel: 'whatsapp',
    message:
      'This is unacceptable! Our checkout webhook has been failing all morning. Connect me to a human support manager immediately.',
    hint: 'Detects urgent escalation intent and routes the thread to the human Handoff Queue.',
  },
  {
    key: 'roman_urdu',
    label: 'Roman Urdu Query',
    badge: 'Roman Urdu',
    defaultPersona: 'new_visitor',
    defaultChannel: 'instagram',
    message:
      'Assalam o alaikum, Orbat AI ke Pro plan ki monthly price kya hai aur kya WhatsApp support shamil hai?',
    hint: 'Detects Roman Urdu phrasing and replies in natural Roman Urdu using KB pricing facts.',
  },
  {
    key: 'enterprise_quote_adk',
    label: 'Enterprise Quote (ADK CRM Deal)',
    badge: 'ADK Deal',
    defaultPersona: 'vip_pro',
    defaultChannel: 'web',
    message:
      'We need an enterprise quote and custom plan with an annual contract for 100 seats. Please set up a crm deal for our rollout.',
    hint: 'Routes to the Google ADK Enterprise Sales specialist to qualify and create a CRM deal.',
  },
] as const;

export function isDemoChannel(value: unknown): value is DemoChannel {
  return value === 'web' || value === 'whatsapp' || value === 'email' || value === 'instagram';
}

export function isDemoPersona(value: unknown): value is DemoPersona {
  return value === 'new_visitor' || value === 'vip_pro' || value === 'frustrated_buyer';
}

export function getDemoScenarioPreset(key: DemoScenarioKey): DemoScenarioPreset {
  const found = DEMO_SCENARIO_PRESETS.find((preset) => preset.key === key);
  return found ?? DEMO_SCENARIO_PRESETS[0];
}

export function getDemoPersonaOption(persona: DemoPersona): DemoPersonaOption {
  const found = DEMO_PERSONAS.find((item) => item.id === persona);
  return found ?? DEMO_PERSONAS[0];
}

export function normalizeSimulateMessage(input: string): string {
  return input.trim().slice(0, 4000);
}
