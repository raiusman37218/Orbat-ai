import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_CHANNELS,
  DEMO_PERSONAS,
  DEMO_SCENARIO_PRESETS,
  getDemoPersonaOption,
  getDemoScenarioPreset,
  isDemoChannel,
  isDemoPersona,
  normalizeSimulateMessage,
} from './demo-presets';

const accessState = vi.hoisted(() => ({
  denied: false,
}));

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(async () => ({ rows: [] })),
  queryRows: vi.fn(async () => []),
  getDbPool: vi.fn(),
}));

vi.mock('@/lib/team/access', () => ({
  getWorkspaceAccess: vi.fn(async (_ws: string, perm: string) => {
    if (accessState.denied) {
      throw new Error(`Permission denied for ${perm}`);
    }
    return {
      user: { id: 'user-owner-1', email: 'owner@example.com' },
      agent: { id: 'agent-owner-1', name: 'Owner User', role: 'owner' },
      role: 'owner',
    };
  }),
}));

vi.mock('./demo-workspace', () => ({
  seedCompleteDemoWorkspace: vi.fn(async () => ({
    sectionsCreated: 4,
    articlesCreated: 6,
    chunksSynced: 12,
    agentsConfigured: 2,
    companiesCreated: 3,
    visitorsUpserted: 6,
    ordersCreated: 3,
    dealsCreated: 5,
    tasksCreated: 3,
    conversationsCreated: 6,
    ticketsCreated: 6,
    handoffsCreated: 3,
    approvalsCreated: 1,
    embeddingMode: 'keyword_fallback',
  })),
  simulateCustomerInboundChat: vi.fn(async (input) => ({
    success: true,
    conversationId: '11111111-1111-1111-1111-111111111111',
    inboundMessageId: '22222222-2222-2222-2222-222222222222',
    ticketNumber: 101,
    channel: input.channel,
    persona: input.persona,
    visitorName: 'Amina Tariq',
    visitorEmail: 'amina@demo-prospect.io',
    aiReplied: true,
    aiReplyText: 'Pro costs $79/mo.',
    aiEngine: 'langgraph',
    aiAgentName: 'Orbat AI',
    status: 'replied',
    reason: null,
    handoffStatus: 'bot_active',
    approvalId: null,
    runId: null,
    citedArticles: [],
    createdDeal: null,
    inboxHref: '/app/inbox?c=11111111-1111-1111-1111-111111111111',
    handoffHref: '/app/handoff',
  })),
}));

import {
  seedCompleteDemoWorkspaceAction,
  simulateCustomerInboundChatAction,
} from '@/app/actions/lifecycle-studio';

describe('demo-presets & workspace access guards', () => {
  beforeEach(() => {
    accessState.denied = false;
  });

  it('defines all four supported demo channels and validates them strictly', () => {
    expect(DEMO_CHANNELS.map((c) => c.id)).toEqual(['web', 'whatsapp', 'email', 'instagram']);
    expect(isDemoChannel('web')).toBe(true);
    expect(isDemoChannel('whatsapp')).toBe(true);
    expect(isDemoChannel('email')).toBe(true);
    expect(isDemoChannel('instagram')).toBe(true);
    expect(isDemoChannel('sms')).toBe(false);
    expect(isDemoChannel(null)).toBe(false);
  });

  it('defines all three customer personas and resolves defaults safely', () => {
    expect(DEMO_PERSONAS.map((p) => p.id)).toEqual(['new_visitor', 'vip_pro', 'frustrated_buyer']);
    expect(isDemoPersona('vip_pro')).toBe(true);
    expect(isDemoPersona('enterprise_bot')).toBe(false);
    expect(getDemoPersonaOption('vip_pro').defaultEmail).toContain('@');
  });

  it('provides all five quick scenario presets with distinct channels/prompts', () => {
    expect(DEMO_SCENARIO_PRESETS.map((s) => s.key)).toEqual([
      'pricing_rag',
      'refund_langgraph',
      'angry_handoff',
      'roman_urdu',
      'enterprise_quote_adk',
    ]);

    for (const preset of DEMO_SCENARIO_PRESETS) {
      expect(isDemoChannel(preset.defaultChannel)).toBe(true);
      expect(isDemoPersona(preset.defaultPersona)).toBe(true);
      expect(preset.message.trim().length).toBeGreaterThan(15);
      expect(getDemoScenarioPreset(preset.key).label).toBe(preset.label);
    }

    // Ensure Roman Urdu preset avoids triggering the Refund approval keyword.
    expect(getDemoScenarioPreset('roman_urdu').message.toLowerCase()).not.toContain('refund');
    // Ensure Enterprise preset aligns with ADK specialist routing keywords.
    expect(getDemoScenarioPreset('enterprise_quote_adk').message.toLowerCase()).toContain('enterprise quote');
  });

  it('trims and bounds simulated customer messages', () => {
    expect(normalizeSimulateMessage('   Hello Orbat   ')).toBe('Hello Orbat');
    expect(normalizeSimulateMessage('x'.repeat(5000))).toHaveLength(4000);
  });

  it('enforces manage_settings access on demo seeder and chat simulator server actions', async () => {
    accessState.denied = true;

    const deniedSeed = await seedCompleteDemoWorkspaceAction('ws-demo-1');
    expect(deniedSeed.success).toBe(false);

    const deniedSim = await simulateCustomerInboundChatAction({
      workspaceId: 'ws-demo-1',
      channel: 'web',
      persona: 'new_visitor',
      message: 'Hello',
    });
    expect(deniedSim.success).toBe(false);

    accessState.denied = false;
    const okSeed = await seedCompleteDemoWorkspaceAction('ws-demo-1');
    expect(okSeed.success).toBe(true);

    const okSim = await simulateCustomerInboundChatAction({
      workspaceId: 'ws-demo-1',
      channel: 'whatsapp',
      persona: 'vip_pro',
      scenarioKey: 'pricing_rag',
      message: 'How much is Pro?',
    });
    expect(okSim.success).toBe(true);
    expect(okSim.inboxHref).toContain('/app/inbox?c=');
  });
});
