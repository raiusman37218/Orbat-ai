"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AiEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiEngineService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const llm_provider_interface_1 = require("./interfaces/llm-provider.interface");
const hybrid_retrieval_service_1 = require("./retrieval/hybrid-retrieval.service");
const ai_usage_service_1 = require("./ai-usage.service");
const messages_service_1 = require("../messages/messages.service");
const conversations_service_1 = require("../conversations/conversations.service");
const HUMAN_HANDOFF_KEYWORDS = [
    'human',
    'agent',
    'representative',
    'real person',
    'speak to someone',
    'manager',
    'talk to a person',
];
let AiEngineService = AiEngineService_1 = class AiEngineService {
    constructor(db, llm, retrieval, usage, messagesService, conversationsService) {
        this.db = db;
        this.llm = llm;
        this.retrieval = retrieval;
        this.usage = usage;
        this.messagesService = messagesService;
        this.conversationsService = conversationsService;
        this.logger = new common_1.Logger(AiEngineService_1.name);
    }
    async generateBotResponse(workspaceId, conversationId, triggerMessage, triggerMessageId) {
        const quota = await this.usage.checkQuota(workspaceId);
        if (!quota.allowed) {
            this.logger.warn(`Workspace ${workspaceId} exceeded monthly AI quota (${quota.used}/${quota.limit})`);
            await this.logReplyEvent(workspaceId, conversationId, triggerMessageId, 'quota_exceeded', 'Plan monthly limit reached');
            await this.conversationsService.requestHandoff(workspaceId, conversationId);
            return { replied: false, reason: 'quota_exceeded' };
        }
        const normalized = triggerMessage.toLowerCase();
        const needsHandoff = HUMAN_HANDOFF_KEYWORDS.some((kw) => normalized.includes(kw));
        if (needsHandoff) {
            this.logger.log(`Customer requested human handoff in conversation ${conversationId}`);
            await this.logReplyEvent(workspaceId, conversationId, triggerMessageId, 'handoff_requested', 'Customer asked for human agent');
            await this.conversationsService.requestHandoff(workspaceId, conversationId);
            return { replied: false, reason: 'handoff_requested' };
        }
        const chunks = await this.retrieval.retrieveChunks(workspaceId, triggerMessage, undefined, 3);
        const knowledgeContext = chunks.map((c) => `[Source: ${c.title}]\n${c.content}`).join('\n\n');
        const systemPrompt = `You are Orbat AI, an intelligent customer support assistant.
Provide clear, polite, and helpful answers based strictly on the provided knowledge sources.
If the answer is not contained in the knowledge base, state that you do not have sufficient information and offer to connect the customer with a support specialist.

Knowledge Sources:
${knowledgeContext || 'No specific articles found. Answer general greetings politely.'}`;
        const completion = await this.llm.generateCompletion({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: triggerMessage },
            ],
            temperature: 0.2,
            maxTokens: 512,
        });
        const botMsg = await this.messagesService.sendMessage(workspaceId, conversationId, {
            content: completion.content,
            senderType: 'agent',
        });
        await this.usage.recordTokenUsage({
            workspaceId,
            conversationId,
            botMessageId: botMsg.id,
            provider: completion.provider,
            model: completion.model,
            purpose: 'reply_generation',
            promptTokens: completion.usage.promptTokens,
            completionTokens: completion.usage.completionTokens,
            costUsd: completion.estimatedCostUsd,
            isBillableReply: true,
            metadata: { chunksUsed: chunks.length },
        });
        await this.usage.recordBillableReply(workspaceId, conversationId, botMsg.id);
        await this.logReplyEvent(workspaceId, conversationId, triggerMessageId, 'replied', 'Grounded reply dispatched', {
            botMessageId: botMsg.id,
            chunksCount: chunks.length,
            model: completion.model,
        });
        return {
            replied: true,
            message: botMsg,
            chunksUsed: chunks.length,
        };
    }
    async suggestCopilotReply(workspaceId, conversationId) {
        const recentMessages = await this.messagesService.getMessages(workspaceId, conversationId, 5);
        const history = recentMessages
            .map((m) => `${m.sender_type}: ${m.content}`)
            .join('\n');
        const prompt = `Based on the following conversation between customer and agent, provide 2 short, professional recommended next replies for the agent:\n\n${history}\n\nFormat as JSON array: ["Suggestion 1", "Suggestion 2"]`;
        const completion = await this.llm.generateCompletion({
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 256,
            temperature: 0.4,
        });
        await this.usage.recordTokenUsage({
            workspaceId,
            conversationId,
            provider: completion.provider,
            model: completion.model,
            purpose: 'copilot_suggest',
            promptTokens: completion.usage.promptTokens,
            completionTokens: completion.usage.completionTokens,
            costUsd: completion.estimatedCostUsd,
            isBillableReply: false,
        });
        let suggestions = [];
        try {
            suggestions = JSON.parse(completion.content);
        }
        catch {
            suggestions = [completion.content.trim()];
        }
        return { suggestions };
    }
    async summarizeConversation(workspaceId, conversationId) {
        const messages = await this.messagesService.getMessages(workspaceId, conversationId, 20);
        const text = messages.map((m) => `${m.sender_type}: ${m.content}`).join('\n');
        const completion = await this.llm.generateCompletion({
            messages: [
                {
                    role: 'system',
                    content: 'You summarize customer support conversations into 2 concise sentences.',
                },
                { role: 'user', content: `Summarize this conversation:\n${text}` },
            ],
            maxTokens: 150,
            temperature: 0.2,
        });
        await this.usage.recordTokenUsage({
            workspaceId,
            conversationId,
            provider: completion.provider,
            model: completion.model,
            purpose: 'summarization',
            promptTokens: completion.usage.promptTokens,
            completionTokens: completion.usage.completionTokens,
            costUsd: completion.estimatedCostUsd,
            isBillableReply: false,
        });
        return { summary: completion.content.trim() };
    }
    async logReplyEvent(workspaceId, conversationId, visitorMessageId, event = 'replied', reason, detail = {}) {
        await this.db.query(`INSERT INTO public.ai_reply_events (
         workspace_id, conversation_id, visitor_message_id, event, reason, detail
       )
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            workspaceId,
            conversationId,
            visitorMessageId || null,
            event,
            reason || null,
            JSON.stringify(detail),
        ]);
    }
};
exports.AiEngineService = AiEngineService;
exports.AiEngineService = AiEngineService = AiEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(llm_provider_interface_1.LLM_PROVIDER)),
    __param(4, (0, common_1.Inject)((0, common_1.forwardRef)(() => messages_service_1.MessagesService))),
    __param(5, (0, common_1.Inject)((0, common_1.forwardRef)(() => conversations_service_1.ConversationsService))),
    __metadata("design:paramtypes", [database_service_1.DatabaseService, Object, hybrid_retrieval_service_1.HybridRetrievalService,
        ai_usage_service_1.AiUsageService,
        messages_service_1.MessagesService,
        conversations_service_1.ConversationsService])
], AiEngineService);
//# sourceMappingURL=ai-engine.service.js.map