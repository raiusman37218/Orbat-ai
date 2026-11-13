"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ai_engine_service_1 = require("./ai-engine.service");
const ai_usage_service_1 = require("./ai-usage.service");
const mock_fallback_provider_1 = require("./providers/mock-fallback.provider");
(0, vitest_1.describe)('AI Engine & Usage Accounting', () => {
    let aiService;
    let aiUsage;
    let mockDb;
    let mockLlm;
    let mockRetrieval;
    let mockMessagesService;
    let mockConversationsService;
    (0, vitest_1.beforeEach)(() => {
        mockDb = {
            query: vitest_1.vi.fn(),
        };
        mockLlm = new mock_fallback_provider_1.MockFallbackProvider();
        mockRetrieval = {
            retrieveChunks: vitest_1.vi.fn().mockResolvedValue([
                { chunkId: 'c-1', knowledgeId: 'k-1', title: 'Hours', content: 'Open 9am-6pm', similarityScore: 0.9 },
            ]),
        };
        mockMessagesService = {
            sendMessage: vitest_1.vi.fn().mockResolvedValue({ id: 'msg-bot-1', content: 'Support is open 9am-6pm.' }),
            getMessages: vitest_1.vi.fn().mockResolvedValue([
                { sender_type: 'visitor', content: 'Hi, when are you open?' },
            ]),
        };
        mockConversationsService = {
            requestHandoff: vitest_1.vi.fn().mockResolvedValue({ status: 'waiting_for_agent' }),
        };
        aiUsage = new ai_usage_service_1.AiUsageService(mockDb);
        vitest_1.vi.spyOn(aiUsage, 'checkQuota').mockResolvedValue({ allowed: true, used: 10, limit: 1000 });
        vitest_1.vi.spyOn(aiUsage, 'recordTokenUsage').mockResolvedValue(undefined);
        vitest_1.vi.spyOn(aiUsage, 'recordBillableReply').mockResolvedValue(undefined);
        aiService = new ai_engine_service_1.AiEngineService(mockDb, mockLlm, mockRetrieval, aiUsage, mockMessagesService, mockConversationsService);
    });
    (0, vitest_1.it)('should generate grounded bot response and account for exactly 1 billable reply', async () => {
        const result = await aiService.generateBotResponse('ws-1', 'conv-1', 'What are your support hours?');
        (0, vitest_1.expect)(result.replied).toBe(true);
        (0, vitest_1.expect)(mockRetrieval.retrieveChunks).toHaveBeenCalled();
        (0, vitest_1.expect)(mockMessagesService.sendMessage).toHaveBeenCalledWith('ws-1', 'conv-1', vitest_1.expect.objectContaining({ senderType: 'ai' }));
        (0, vitest_1.expect)(aiUsage.recordBillableReply).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(aiUsage.recordBillableReply).toHaveBeenCalledWith('ws-1', 'conv-1', 'msg-bot-1');
    });
    (0, vitest_1.it)('should detect human handoff keywords and transition conversation without billing reply', async () => {
        const result = await aiService.generateBotResponse('ws-1', 'conv-1', 'I need to speak to a real human agent now');
        (0, vitest_1.expect)(result.replied).toBe(false);
        (0, vitest_1.expect)(result.reason).toBe('handoff_requested');
        (0, vitest_1.expect)(mockConversationsService.requestHandoff).toHaveBeenCalledWith('ws-1', 'conv-1');
        (0, vitest_1.expect)(mockMessagesService.sendMessage).not.toHaveBeenCalled();
        (0, vitest_1.expect)(aiUsage.recordBillableReply).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('should halt bot reply and request handoff when monthly quota is exceeded', async () => {
        vitest_1.vi.spyOn(aiUsage, 'checkQuota').mockResolvedValueOnce({ allowed: false, used: 1000, limit: 1000 });
        const result = await aiService.generateBotResponse('ws-1', 'conv-1', 'How do I reset my password?');
        (0, vitest_1.expect)(result.replied).toBe(false);
        (0, vitest_1.expect)(result.reason).toBe('quota_exceeded');
        (0, vitest_1.expect)(mockConversationsService.requestHandoff).toHaveBeenCalledWith('ws-1', 'conv-1');
        (0, vitest_1.expect)(mockMessagesService.sendMessage).not.toHaveBeenCalled();
        (0, vitest_1.expect)(aiUsage.recordBillableReply).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('should provide copilot suggestions without charging billable reply', async () => {
        const res = await aiService.suggestCopilotReply('ws-1', 'conv-1');
        (0, vitest_1.expect)(res.suggestions).toBeDefined();
        (0, vitest_1.expect)(aiUsage.recordTokenUsage).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ purpose: 'copilot_suggest', isBillableReply: false }));
        (0, vitest_1.expect)(aiUsage.recordBillableReply).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('should summarize conversation without charging billable reply', async () => {
        const res = await aiService.summarizeConversation('ws-1', 'conv-1');
        (0, vitest_1.expect)(res.summary).toBeDefined();
        (0, vitest_1.expect)(aiUsage.recordTokenUsage).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ purpose: 'summarization', isBillableReply: false }));
        (0, vitest_1.expect)(aiUsage.recordBillableReply).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=ai-engine.service.spec.js.map