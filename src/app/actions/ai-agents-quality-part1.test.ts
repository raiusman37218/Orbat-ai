import { beforeEach, describe, expect, it, vi } from 'vitest';

const WS_ID = '11111111-1111-4111-8111-111111111111';
const AGENT_PRIMARY_ID = '22222222-2222-4222-8222-222222222222';
const AGENT_SPECIALIST_ID = '33333333-3333-4333-8333-333333333333';

const mockState = vi.hoisted(() => ({
  role: 'admin' as 'owner' | 'admin' | 'agent' | 'light_agent',
  workspaceIndustry: null as string | null,
  savedAgentIndustry: null as string | null,
  sqlCalls: [] as { sql: string; params: unknown[] }[],
  capturedPromptArgs: [] as { industry?: string | null; prompt: string }[],
}));

const PRIMARY_AGENT_ROW = {
  id: AGENT_PRIMARY_ID,
  workspace_id: WS_ID,
  slug: 'primary-assistant',
  name: 'Primary Assistant',
  role_title: 'Support Specialist',
  description: '',
  template_id: null,
  industry: null,
  status: 'live',
  is_primary: true,
  channels: { web_chat: true },
  tone: 'friendly',
  reply_language_mode: 'match_customer',
  answer_mode: 'agent',
  system_prompt: '',
  guardrails: [],
  escalation_rules: { blockedTopics: [], handoffPhrases: [], minConfidence: 0.7, maxConsecutiveLowConf: 2, escalateOnNegativeSentiment: true, escalateOnVip: true },
  knowledge_scope: { mode: 'all', categories: [], excludeIds: [], citeSources: true },
  capabilities: { actions: [], frameworks: [], subAgentId: null },
  autonomy_default: 2,
  appearance: {},
  version: 1,
  published_at: null,
  created_by: null,
  updated_by: null,
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
};

const SPECIALIST_AGENT_ROW = {
  ...PRIMARY_AGENT_ROW,
  id: AGENT_SPECIALIST_ID,
  slug: 'billing-specialist',
  name: 'Billing Specialist',
  role_title: 'Billing Agent',
  is_primary: false,
};

vi.mock('@/lib/team/access', () => ({
  getWorkspaceAccess: vi.fn(async () => ({
    role: mockState.role,
    user: { id: 'user-1', email: 'test@orbat.test' },
    agent: { id: 'member-1', role: mockState.role },
  })),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    mockState.sqlCalls.push({ sql, params });
    return { rows: [], rowCount: 0 };
  }),
  queryRows: vi.fn(async (sql: string, params: unknown[] = []) => {
    mockState.sqlCalls.push({ sql, params });

    if (sql.includes('FROM public.ai_agents WHERE id = $1')) {
      return [{ industry: mockState.savedAgentIndustry }];
    }
    if (sql.includes('FROM public.ai_agents')) {
      return [PRIMARY_AGENT_ROW, SPECIALIST_AGENT_ROW];
    }
    if (sql.includes('FROM public.workspaces')) {
      return [{
        name: 'Acme Services',
        industry: mockState.workspaceIndustry,
        slug: 'acme',
        custom_domain: null,
        custom_domain_status: null,
      }];
    }
    if (sql.includes("COUNT(*) FILTER (WHERE event IN ('reply_delivered', 'replied'))::text AS replied_cnt")) {
      return [{ agent_id: AGENT_PRIMARY_ID, replied_cnt: '12', handover_cnt: '3' }];
    }
    if (sql.includes("percentile_cont(0.5)")) {
      return [{ median_sec: '2.4' }];
    }
    if (sql.includes('FROM public.ai_reply_events e')) {
      return [{
        id: 'ev-1',
        event: 'reply_delivered',
        reason: null,
        conversation_id: 'conv-1',
        detail: { agent_id: AGENT_PRIMARY_ID },
        created_at: '2026-11-15T10:00:00.000Z',
        conv_status: 'open',
      }];
    }
    if (sql.includes('checked_cnt')) {
      return [{
        checked_cnt: '10',
        supported_cnt: '8',
        fixed_cnt: '1',
        human_cnt: '1',
        review_cnt: '0',
      }];
    }
    return [];
  }),
}));

vi.mock('@/lib/ai/agent-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/agent-runtime')>();
  return {
    ...actual,
    ensurePrimaryAiAgent: vi.fn(async () => AGENT_PRIMARY_ID),
    recordAiVerificationLog: vi.fn(async () => undefined),
    syncPrimaryAgentToWorkspaceAiSettings: vi.fn(async () => undefined),
    tryWorkspaceChat: vi.fn(async () => null),
    verifyReplyClaimsAgainstKnowledge: vi.fn(async () => ({ verdict: 'supported', claims: [], confidence: 0.95 })),
  };
});

vi.mock('@/lib/ai/help-answer', async () => {
  const { buildIndex } = await import('@/lib/ai/retrieval');
  return {
    freshKnowledgeIndex: vi.fn(async () =>
      buildIndex([
        {
          id: 'art-1',
          slug: 'hours',
          title: 'Support Hours',
          content: 'Support is open Monday to Friday 9am to 5pm.',
          section_id: 'sec-1',
          sectionName: 'General',
          category: 'General',
        },
      ]),
    ),
  };
});

vi.mock('@/lib/ai/translator', () => ({
  detectLanguage: vi.fn(() => 'en'),
  getLanguageInfo: vi.fn((lang: string) => ({ code: lang, name: 'English' })),
  isRomanizedText: vi.fn(() => false),
  translateAgentReply: vi.fn(async ({ text }: { text: string }) => text),
}));

vi.mock('@/lib/ai/support-agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/support-agent')>();
  return {
    ...actual,
    buildSupportAgentPrompt: vi.fn((input: Parameters<typeof actual.buildSupportAgentPrompt>[0]) => {
      const prompt = actual.buildSupportAgentPrompt(input);
      mockState.capturedPromptArgs.push({ industry: input.industry, prompt });
      return prompt;
    }),
  };
});

vi.mock('@/app/actions/bot-learning', () => ({
  approveLearningCandidateAction: vi.fn(async () => ({ success: true })),
  rejectLearningCandidateAction: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/app/actions/unanswered', () => ({
  approvePendingAnswerAction: vi.fn(async () => ({ success: true })),
  dismissUnansweredQuestionAction: vi.fn(async () => ({ success: true })),
  saveQuickQaAnswerAction: vi.fn(async () => ({ success: true })),
}));

import { DEFAULT_ESCALATION_RULES, DEFAULT_KNOWLEDGE_SCOPE } from '@/lib/ai/agent-templates';
import { getAiAgentsBootstrapAction, runAgentPlaygroundAction } from './ai-agents';
import { getAiQualityBootstrapAction } from './ai-quality';

describe('Part 1 server actions: metrics consistency, prop-firm leak prevention, quality scoping & RBAC', () => {
  beforeEach(() => {
    mockState.role = 'admin';
    mockState.workspaceIndustry = null;
    mockState.savedAgentIndustry = null;
    mockState.sqlCalls = [];
    mockState.capturedPromptArgs = [];
  });

  it('counts reply_delivered events, preserves activity event names, and excludes playground from median latency', async () => {
    const boot = await getAiAgentsBootstrapAction(WS_ID);

    expect(boot.kpis.allReplies30d).toBe(12);
    expect(boot.kpis.resolvedPct).toBe(80);
    expect(boot.kpis.medianReplySeconds).toBe(2.4);
    expect(boot.activityLogs[0]?.event).toBe('reply_delivered');

    const eventCountsQuery = mockState.sqlCalls.find((c) => c.sql.includes('AS replied_cnt'));
    expect(eventCountsQuery?.sql).toContain("event IN ('reply_delivered', 'replied')");

    const weeklyQuery = mockState.sqlCalls.find((c) => c.sql.includes('AS resolved_cnt'));
    expect(weeklyQuery?.sql).toContain("event IN ('reply_delivered', 'replied')");

    const medianQuery = mockState.sqlCalls.find((c) => c.sql.includes('percentile_cont(0.5)'));
    expect(medianQuery?.sql).toContain("<> 'playground'");
    expect(medianQuery?.sql).toContain("metadata->>'playground'");
  });

  it('computes canManage and canEditContent strictly from workspace role', async () => {
    mockState.role = 'light_agent';
    const light = await getAiAgentsBootstrapAction(WS_ID);
    expect(light.canManage).toBe(false);
    expect(light.canEditContent).toBe(false);

    mockState.role = 'agent';
    const regularAgent = await getAiAgentsBootstrapAction(WS_ID);
    expect(regularAgent.canManage).toBe(false);
    expect(regularAgent.canEditContent).toBe(true);

    mockState.role = 'admin';
    const admin = await getAiAgentsBootstrapAction(WS_ID);
    expect(admin.canManage).toBe(true);
    expect(admin.canEditContent).toBe(true);
  });

  it('prevents prop-firm persona leakage in Playground when workspace industry is null or uses saved/draft industry', async () => {
    mockState.workspaceIndustry = null;
    const r0 = await runAgentPlaygroundAction(WS_ID, {
      agentId: null,
      agentName: 'Aria',
      tone: 'friendly',
      systemPrompt: '',
      guardrails: [],
      escalationRules: DEFAULT_ESCALATION_RULES,
      knowledgeScope: DEFAULT_KNOWLEDGE_SCOPE,
      message: 'What are your hours?',
      persona: 'standard',
      language: 'en',
    });

    expect(r0).toMatchObject({ success: true });
    expect(mockState.capturedPromptArgs[0]?.industry).toBe('generic');
    expect(mockState.capturedPromptArgs[0]?.prompt).not.toMatch(/proprietary trading|prop[\s-]firm|HOW TRADERS TALK/i);

    mockState.savedAgentIndustry = 'Insurance';
    const r1 = await runAgentPlaygroundAction(WS_ID, {
      agentId: AGENT_SPECIALIST_ID,
      agentName: 'Claims Bot',
      tone: 'formal',
      systemPrompt: '',
      guardrails: [],
      escalationRules: DEFAULT_ESCALATION_RULES,
      knowledgeScope: DEFAULT_KNOWLEDGE_SCOPE,
      message: 'How do I file a claim?',
      persona: 'standard',
      language: 'en',
    });

    expect(r1).toMatchObject({ success: true });
    expect(mockState.capturedPromptArgs[1]?.industry).toBe('Insurance');
    expect(mockState.capturedPromptArgs[1]?.prompt.toLowerCase()).toContain('insurance policy');
    expect(mockState.capturedPromptArgs[1]?.prompt).not.toMatch(/proprietary trading|prop[\s-]firm/i);

    const r2 = await runAgentPlaygroundAction(WS_ID, {
      agentId: null,
      agentName: 'Estate Bot',
      industry: 'Real estate',
      tone: 'friendly',
      systemPrompt: '',
      guardrails: [],
      escalationRules: DEFAULT_ESCALATION_RULES,
      knowledgeScope: DEFAULT_KNOWLEDGE_SCOPE,
      message: 'Can I book a viewing?',
      persona: 'standard',
      language: 'en',
    });

    expect(r2).toMatchObject({ success: true });
    expect(mockState.capturedPromptArgs[2]?.industry).toBe('Real estate');
    expect(mockState.capturedPromptArgs[2]?.prompt.toLowerCase()).toContain('real estate');
  });

  it('scopes AI quality verification KPIs, topic stats, and checks to active agent and excludes playground logs', async () => {
    await getAiQualityBootstrapAction(WS_ID, AGENT_PRIMARY_ID);
    const primaryTopic = mockState.sqlCalls.find((c) => c.sql.includes('AS topic_key'));
    const primaryKpi = mockState.sqlCalls.find((c) => c.sql.includes('AS checked_cnt'));
    const primaryList = mockState.sqlCalls.find((c) => c.sql.includes('AS resolved_agent_name'));

    for (const q of [primaryTopic, primaryKpi, primaryList]) {
      expect(q).toBeDefined();
      expect(q?.sql).toContain("<> 'playground'");
      expect(q?.sql).toContain("metadata->>'playground'");
      expect(q?.sql).toContain('($3::boolean AND');
      expect(q?.params).toEqual([WS_ID, AGENT_PRIMARY_ID, true]);
    }

    mockState.sqlCalls = [];
    await getAiQualityBootstrapAction(WS_ID, AGENT_SPECIALIST_ID);
    const specTopic = mockState.sqlCalls.find((c) => c.sql.includes('AS topic_key'));
    const specKpi = mockState.sqlCalls.find((c) => c.sql.includes('AS checked_cnt'));
    const specList = mockState.sqlCalls.find((c) => c.sql.includes('AS resolved_agent_name'));

    for (const q of [specTopic, specKpi, specList]) {
      expect(q).toBeDefined();
      expect(q?.params).toEqual([WS_ID, AGENT_SPECIALIST_ID, false]);
    }
  });
});
