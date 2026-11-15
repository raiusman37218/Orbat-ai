import { describe, expect, it } from 'vitest';
import {
  normalizeAgentChannel,
  selectTargetAiAgent,
  type AiAgentRow,
} from '@/lib/ai/agent-runtime';
import {
  DEFAULT_AGENT_APPEARANCE,
  DEFAULT_ESCALATION_RULES,
} from '@/lib/ai/agent-templates';
import { evaluateHandoffTrigger } from '@/lib/ai/handoff-detect';
import { autoAssignConversation } from '@/lib/team/auto-assign';

function makeAgent(overrides: Partial<AiAgentRow> = {}): AiAgentRow {
  return {
    id: overrides.id ?? 'agent-1',
    workspace_id: 'ws-1',
    slug: overrides.slug ?? 'primary-support',
    name: overrides.name ?? 'Nova',
    role_title: overrides.role_title ?? 'Customer Support Agent',
    description: overrides.description ?? 'General helpdesk assistant',
    avatar_color: '#6366f1',
    template_id: null,
    industry: overrides.industry ?? 'generic',
    status: overrides.status ?? 'live',
    is_primary: overrides.is_primary ?? false,
    channels: overrides.channels ?? ['web', 'email'],
    tone: 'friendly',
    reply_language_mode: 'match_customer',
    answer_mode: 'agent',
    system_prompt: '',
    guardrails: [],
    knowledge_scope: { allArticles: true, sectionIds: [], includeBotKnowledge: true },
    capabilities: overrides.capabilities ?? {
      subAgentId: null,
      frameworks: [],
      actions: [],
    },
    escalation_rules: overrides.escalation_rules ?? { ...DEFAULT_ESCALATION_RULES },
    appearance: overrides.appearance ?? { ...DEFAULT_AGENT_APPEARANCE },
    published_version: overrides.published_version ?? 1,
    draft_version: overrides.draft_version ?? 1,
    published_at: '2026-10-10T00:00:00Z',
    created_by: overrides.created_by ?? null,
    updated_by: overrides.updated_by ?? null,
    created_at: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
    ...overrides,
  };
}

describe('normalizeAgentChannel', () => {
  it('maps widget, social, and messaging aliases to builder channel ids', () => {
    expect(normalizeAgentChannel('chat')).toBe('web');
    expect(normalizeAgentChannel('web_chat')).toBe('web');
    expect(normalizeAgentChannel('widget')).toBe('web');
    expect(normalizeAgentChannel('WA')).toBe('whatsapp');
    expect(normalizeAgentChannel('messenger')).toBe('facebook');
    expect(normalizeAgentChannel('ig')).toBe('instagram');
    expect(normalizeAgentChannel('mail')).toBe('email');
    expect(normalizeAgentChannel('phone')).toBe('voice');
  });
});

describe('selectTargetAiAgent', () => {
  it('filters out non-live agents and agents not enabled for the channel', () => {
    const primaryWeb = makeAgent({ id: 'primary-web', is_primary: true, channels: ['web'] });
    const draftWhatsapp = makeAgent({ id: 'draft-wa', status: 'draft', channels: ['whatsapp'] });
    const liveWhatsapp = makeAgent({ id: 'live-wa', name: 'WhatsApp Concierge', channels: ['whatsapp'] });

    const waResult = selectTargetAiAgent([primaryWeb, draftWhatsapp, liveWhatsapp], {
      channel: 'whatsapp',
      message: 'Hello, need help',
    });
    expect(waResult.agent?.id).toBe('live-wa');

    const igResult = selectTargetAiAgent([primaryWeb, draftWhatsapp, liveWhatsapp], {
      channel: 'instagram',
      message: 'Hello',
    });
    expect(igResult.agent).toBeNull();
    expect(igResult.reason).toBe('no_live_agent_for_channel');
  });

  it('prefers specialist agent matching subAgentId / actions / role over primary fallback', () => {
    const primary = makeAgent({
      id: 'primary-1',
      name: 'General Helper',
      role_title: 'General Support',
      is_primary: true,
      channels: ['web', 'whatsapp'],
    });
    const payoutsSpecialist = makeAgent({
      id: 'payout-specialist',
      name: 'Payout Desk',
      role_title: 'Withdrawal & Payout Specialist',
      description: 'Handles profit splits, withdrawal requests and banking rails',
      channels: ['web', 'whatsapp'],
      capabilities: {
        subAgentId: 'payouts',
        frameworks: ['langgraph'],
        actions: ['Check withdrawal status', 'Explain payout schedule'],
      },
    });
    const refundsSpecialist = makeAgent({
      id: 'refund-specialist',
      name: 'Billing Desk',
      role_title: 'Refund & Invoice Specialist',
      description: 'Processes billing disputes and refunds',
      channels: ['web'],
      capabilities: {
        subAgentId: 'refunds',
        frameworks: ['langgraph'],
        actions: ['Process refund'],
      },
    });

    const payoutPick = selectTargetAiAgent([primary, payoutsSpecialist, refundsSpecialist], {
      channel: 'web',
      message: 'Where is my withdrawal status and when do payouts arrive?',
    });
    expect(payoutPick.agent?.id).toBe('payout-specialist');
    expect(payoutPick.reason).toBe('specialist_match');

    const genericPick = selectTargetAiAgent([primary, payoutsSpecialist, refundsSpecialist], {
      channel: 'web',
      message: 'Good morning!',
    });
    expect(genericPick.agent?.id).toBe('primary-1');
    expect(genericPick.reason).toBe('primary_fallback');
  });

  it('keeps specialist context on short follow-ups via recentUserMessages', () => {
    const primary = makeAgent({ id: 'primary-1', name: 'General Bot', role_title: 'Front Desk', is_primary: true, channels: ['web'] });
    const billing = makeAgent({
      id: 'billing-1',
      name: 'Invoice Desk',
      role_title: 'Billing Specialist',
      channels: ['web'],
    });

    const followUpPick = selectTargetAiAgent([primary, billing], {
      channel: 'web',
      message: 'How long usually?',
      recentUserMessages: ['I need help with my invoice billing'],
      routedSubAgentId: null,
    });
    expect(followUpPick.agent?.id).toBe('billing-1');
  });
});

describe('evaluateHandoffTrigger with escalation flags', () => {
  it('respects handoffOnFrustration = false and detects confidence below threshold', () => {
    const frustratedMuted = evaluateHandoffTrigger({
      incomingMessage: 'This is useless and pathetic service, worst experience',
      handoffOnFrustration: false,
    });
    expect(frustratedMuted.needsHandoff).toBe(false);

    const frustratedEnabled = evaluateHandoffTrigger({
      incomingMessage: 'This is useless and pathetic service, worst experience',
      handoffOnFrustration: true,
    });
    expect(frustratedEnabled.needsHandoff).toBe(true);
    expect(frustratedEnabled.triggerReason).toBe('frustration');

    const lowConf = evaluateHandoffTrigger({
      incomingMessage: 'What is the policy?',
      aiConfidence: 0.72,
      confidenceThreshold: 0.85,
    });
    expect(lowConf.needsHandoff).toBe(true);
    expect(lowConf.triggerReason).toBe('low_confidence');

    const highEnoughConf = evaluateHandoffTrigger({
      incomingMessage: 'What is the policy?',
      aiConfidence: 0.72,
      confidenceThreshold: 0.65,
    });
    expect(highEnoughConf.needsHandoff).toBe(false);
  });
});

describe('autoAssignConversation with groupId preference', () => {
  it('prefers online members of the requested ticket group and falls back if none available', async () => {
    const updatedPayloads: Record<string, unknown>[] = [];
    const tableData: Record<string, Record<string, unknown>[]> = {
      conversations: [{ id: 'conv-1', workspace_id: 'ws-1', assigned_agent_id: null }],
      workspaces: [{ id: 'ws-1', auto_assignment: { enabled: true }, timezone: 'UTC', business_hours: null }],
      agents: [
        { id: 'ag-general', workspace_id: 'ws-1', name: 'General Agent', email: 'g@test', avatar_url: null, status: 'online', role: 'admin', is_active: true, max_open_tickets: 10 },
        { id: 'ag-billing', workspace_id: 'ws-1', name: 'Billing Agent', email: 'b@test', avatar_url: null, status: 'online', role: 'agent', is_active: true, max_open_tickets: 10 },
      ],
      agent_shifts: [],
      tickets: [],
      ticket_group_members: [{ group_id: 'grp-billing', agent_id: 'ag-billing' }],
    };

    type MockQueryBuilder = {
      select: () => MockQueryBuilder;
      eq: (c: string, v: unknown) => MockQueryBuilder;
      in: (c: string, vals: unknown[]) => MockQueryBuilder;
      not: () => MockQueryBuilder;
      update: (p: Record<string, unknown>) => MockQueryBuilder;
      maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
      then: <T>(
        res: (v: { data: Record<string, unknown>[]; error: null }) => T,
        rej: (e: unknown) => T,
      ) => Promise<T>;
    };

    const makeMock = () => ({
      from(table: string) {
        const filters: Array<(r: Record<string, unknown>) => boolean> = [];
        let updatePatch: Record<string, unknown> | null = null;
        const exec = () => {
          const rows = (tableData[table] || []).filter((r) => filters.every((f) => f(r)));
          if (updatePatch) {
            updatedPayloads.push(updatePatch);
            rows.forEach((r) => Object.assign(r, updatePatch));
          }
          return { data: rows, error: null };
        };
        const b: MockQueryBuilder = {
          select: () => b,
          eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
          in: (c: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[c])), b),
          not: () => b,
          update: (p: Record<string, unknown>) => ((updatePatch = p), b),
          maybeSingle: async () => ({ data: exec().data[0] ?? null, error: null }),
          then: (res, rej) => Promise.resolve(exec()).then(res, rej),
        };
        return b;
      },
    });

    const preferred = await autoAssignConversation(makeMock(), 'conv-1', { groupId: 'grp-billing' });
    expect(preferred.assigned).toBe(true);
    expect(preferred.agent?.id).toBe('ag-billing');
    expect(updatedPayloads[0]).toMatchObject({ assigned_agent_id: 'ag-billing' });

    // When target group has no online member, gracefully falls back to online workspace agent.
    tableData.agents[1].status = 'offline';
    const fallback = await autoAssignConversation(makeMock(), 'conv-1', { groupId: 'grp-billing' });
    expect(fallback.assigned).toBe(true);
    expect(fallback.agent?.id).toBe('ag-general');
  });
});
