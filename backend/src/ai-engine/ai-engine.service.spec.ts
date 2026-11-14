import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiEngineService } from './ai-engine.service';
import { AiUsageService } from './ai-usage.service';
import { MockFallbackProvider } from './providers/mock-fallback.provider';

describe('AI Engine & Usage Accounting', () => {
  let aiService: AiEngineService;
  let aiUsage: AiUsageService;
  let mockDb: any;
  let mockLlm: any;
  let mockRetrieval: any;
  let mockMessagesService: any;
  let mockConversationsService: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    mockLlm = new MockFallbackProvider();
    mockRetrieval = {
      retrieveChunks: vi.fn().mockResolvedValue([
        { chunkId: 'c-1', knowledgeId: 'k-1', title: 'Hours', content: 'Open 9am-6pm', similarityScore: 0.9 },
      ]),
    };
    mockMessagesService = {
      sendMessage: vi.fn().mockResolvedValue({ id: 'msg-bot-1', content: 'Support is open 9am-6pm.' }),
      getMessages: vi.fn().mockResolvedValue([
        { sender_type: 'visitor', content: 'Hi, when are you open?' },
      ]),
    };
    mockConversationsService = {
      requestHandoff: vi.fn().mockResolvedValue({ status: 'waiting_for_agent' }),
    };

    aiUsage = new AiUsageService(mockDb);
    // spy on usage methods
    vi.spyOn(aiUsage, 'checkQuota').mockResolvedValue({ allowed: true, used: 10, limit: 1000 });
    vi.spyOn(aiUsage, 'recordTokenUsage').mockResolvedValue(undefined as any);
    vi.spyOn(aiUsage, 'recordBillableReply').mockResolvedValue(undefined as any);

    aiService = new AiEngineService(
      mockDb,
      mockLlm,
      mockRetrieval,
      aiUsage,
      mockMessagesService,
      mockConversationsService,
    );
  });

  it('should generate grounded bot response and account for exactly 1 billable reply', async () => {
    const result = await aiService.generateBotResponse('ws-1', 'conv-1', 'What are your support hours?');

    expect(result.replied).toBe(true);
    expect(mockRetrieval.retrieveChunks).toHaveBeenCalled();
    expect(mockMessagesService.sendMessage).toHaveBeenCalledWith(
      'ws-1',
      'conv-1',
      expect.objectContaining({ senderType: 'ai' }),
    );
    // CRITICAL: Billable reply must be called exactly once
    expect(aiUsage.recordBillableReply).toHaveBeenCalledTimes(1);
    expect(aiUsage.recordBillableReply).toHaveBeenCalledWith('ws-1', 'conv-1', 'msg-bot-1');
  });

  it('should detect human handoff keywords and transition conversation without billing reply', async () => {
    const result = await aiService.generateBotResponse('ws-1', 'conv-1', 'I need to speak to a real human agent now');

    expect(result.replied).toBe(false);
    expect(result.reason).toBe('handoff_requested');
    expect(mockConversationsService.requestHandoff).toHaveBeenCalledWith('ws-1', 'conv-1');
    expect(mockMessagesService.sendMessage).not.toHaveBeenCalled();
    // Billable reply must NOT be charged
    expect(aiUsage.recordBillableReply).not.toHaveBeenCalled();
  });

  it('should halt bot reply and request handoff when monthly quota is exceeded', async () => {
    vi.spyOn(aiUsage, 'checkQuota').mockResolvedValueOnce({ allowed: false, used: 1000, limit: 1000 });

    const result = await aiService.generateBotResponse('ws-1', 'conv-1', 'How do I reset my password?');

    expect(result.replied).toBe(false);
    expect(result.reason).toBe('quota_exceeded');
    expect(mockConversationsService.requestHandoff).toHaveBeenCalledWith('ws-1', 'conv-1');
    expect(mockMessagesService.sendMessage).not.toHaveBeenCalled();
    expect(aiUsage.recordBillableReply).not.toHaveBeenCalled();
  });

  it('should provide copilot suggestions without charging billable reply', async () => {
    const res = await aiService.suggestCopilotReply('ws-1', 'conv-1');
    expect(res.suggestions).toBeDefined();
    expect(aiUsage.recordTokenUsage).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'copilot_suggest', isBillableReply: false }),
    );
    expect(aiUsage.recordBillableReply).not.toHaveBeenCalled();
  });

  it('should summarize conversation without charging billable reply', async () => {
    const res = await aiService.summarizeConversation('ws-1', 'conv-1');
    expect(res.summary).toBeDefined();
    expect(aiUsage.recordTokenUsage).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'summarization', isBillableReply: false }),
    );
    expect(aiUsage.recordBillableReply).not.toHaveBeenCalled();
  });

  it('should apply active ai_agents prompt, guardrails, and blocked-topic handoffs', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'agent-fin-1',
          name: 'Fintech Specialist',
          tone: 'Calm, accurate',
          system_prompt: 'Always verify KYC before quoting limits.',
          guardrails: ['Never ask for full PIN or CVV'],
          escalation_rules: { blockedTopics: ['chargeback fraud'] },
        },
      ],
    });

    const blocked = await aiService.generateBotResponse(
      'ws-1',
      'conv-1',
      'I want to report chargeback fraud immediately',
    );
    expect(blocked.replied).toBe(false);
    expect(blocked.reason).toBe('blocked_topic_handoff');
    expect(mockConversationsService.requestHandoff).toHaveBeenCalledWith('ws-1', 'conv-1');
  });

  it('should redact sensitive patterns matched by enabled compliance_policies before sending AI reply', async () => {
    vi.spyOn(mockLlm, 'generateCompletion').mockResolvedValueOnce({
      content: 'Use card 4111 1111 1111 1111 or SSN 123-45-6789 to verify.',
      provider: 'mock',
      model: 'mock-model',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      estimatedCostUsd: 0,
    });
    // 1st query: ai_agents -> empty, 2nd query: workspaces -> fallback, 3rd query: compliance_policies
    mockDb.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: 'Acme', ai_settings: {} }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'pol-1',
            rule_key: 'pii_card',
            name: 'Card numbers',
            framework: 'PCI DSS',
            action_mode: 'redact',
            pattern_type: 'builtin',
            pattern: 'pii_card',
            sentinel_enabled: true,
          },
          {
            id: 'pol-2',
            rule_key: 'pii_ssn',
            name: 'SSN numbers',
            framework: 'HIPAA',
            action_mode: 'redact',
            pattern_type: 'builtin',
            pattern: 'pii_ssn',
            sentinel_enabled: true,
          },
        ],
      })
      .mockResolvedValue({ rows: [] });

    const res = await aiService.generateBotResponse('ws-1', 'conv-1', 'Check my verification');
    expect(res.replied).toBe(true);
    expect(mockMessagesService.sendMessage).toHaveBeenCalledWith(
      'ws-1',
      'conv-1',
      expect.objectContaining({
        senderType: 'ai',
        content: 'Use card [CARD •••• 1111] or SSN [SSN •••-6789] to verify.',
      }),
    );
  });
});

