import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  LLM_PROVIDER,
  LlmProvider,
} from './interfaces/llm-provider.interface';
import { HybridRetrievalService } from './retrieval/hybrid-retrieval.service';
import { AiUsageService } from './ai-usage.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';

const HUMAN_HANDOFF_KEYWORDS = [
  'human',
  'agent',
  'representative',
  'real person',
  'speak to someone',
  'manager',
  'talk to a person',
];

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(LLM_PROVIDER)
    private readonly llm: LlmProvider,
    private readonly retrieval: HybridRetrievalService,
    private readonly usage: AiUsageService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationsService: ConversationsService,
  ) {}

  async generateBotResponse(
    workspaceId: string,
    conversationId: string,
    triggerMessage: string,
    triggerMessageId?: string,
  ) {
    // 1. Quota Check
    const quota = await this.usage.checkQuota(workspaceId);
    if (!quota.allowed) {
      this.logger.warn(`Workspace ${workspaceId} exceeded monthly AI quota (${quota.used}/${quota.limit})`);
      await this.logReplyEvent(workspaceId, conversationId, triggerMessageId, 'quota_exceeded', 'Plan monthly limit reached');
      await this.conversationsService.requestHandoff(workspaceId, conversationId);
      return { replied: false, reason: 'quota_exceeded' };
    }

    // 2. Human handoff intent detection
    const normalized = triggerMessage.toLowerCase();
    const needsHandoff = HUMAN_HANDOFF_KEYWORDS.some((kw) => normalized.includes(kw));
    if (needsHandoff) {
      this.logger.log(`Customer requested human handoff in conversation ${conversationId}`);
      await this.logReplyEvent(workspaceId, conversationId, triggerMessageId, 'handoff_requested', 'Customer asked for human agent');
      await this.conversationsService.requestHandoff(workspaceId, conversationId);
      return { replied: false, reason: 'handoff_requested' };
    }

    // 3. RAG Knowledge Retrieval
    const chunks = await this.retrieval.retrieveChunks(workspaceId, triggerMessage, undefined, 3);
    const knowledgeContext = chunks.map((c) => `[Source: ${c.title}]\n${c.content}`).join('\n\n');

    // 4. Construct System & User Prompt
    const systemPrompt = `You are Orbat AI, an intelligent customer support assistant.
Provide clear, polite, and helpful answers based strictly on the provided knowledge sources.
If the answer is not contained in the knowledge base, state that you do not have sufficient information and offer to connect the customer with a support specialist.

Knowledge Sources:
${knowledgeContext || 'No specific articles found. Answer general greetings politely.'}`;

    // 5. Generate LLM Completion
    const completion = await this.llm.generateCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: triggerMessage },
      ],
      temperature: 0.2,
      maxTokens: 512,
    });

    // 6. Post Bot Reply Message
    const botMsg = await this.messagesService.sendMessage(
      workspaceId,
      conversationId,
      {
        content: completion.content,
        senderType: 'agent',
      },
    );

    // 7. Record Detailed Token Usage (Internal accounting)
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

    // 8. Atomically increment exactly 1 billable reply
    await this.usage.recordBillableReply(workspaceId, conversationId, botMsg.id);

    // 9. Log Audit Event
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

  async suggestCopilotReply(workspaceId: string, conversationId: string) {
    const recentMessages = await this.messagesService.getMessages(workspaceId, conversationId, 5);
    const history = recentMessages
      .map((m: any) => `${m.sender_type}: ${m.content}`)
      .join('\n');

    const prompt = `Based on the following conversation between customer and agent, provide 2 short, professional recommended next replies for the agent:\n\n${history}\n\nFormat as JSON array: ["Suggestion 1", "Suggestion 2"]`;

    const completion = await this.llm.generateCompletion({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 256,
      temperature: 0.4,
    });

    // Record internal token usage (not billable reply)
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

    let suggestions: string[] = [];
    try {
      suggestions = JSON.parse(completion.content);
    } catch {
      suggestions = [completion.content.trim()];
    }

    return { suggestions };
  }

  async summarizeConversation(workspaceId: string, conversationId: string) {
    const messages = await this.messagesService.getMessages(workspaceId, conversationId, 20);
    const text = messages.map((m: any) => `${m.sender_type}: ${m.content}`).join('\n');

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

  private async logReplyEvent(
    workspaceId: string,
    conversationId: string,
    visitorMessageId?: string,
    event: string = 'replied',
    reason?: string,
    detail: Record<string, any> = {},
  ) {
    await this.db.query(
      `INSERT INTO public.ai_reply_events (
         workspace_id, conversation_id, visitor_message_id, event, reason, detail
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        workspaceId,
        conversationId,
        visitorMessageId || null,
        event,
        reason || null,
        JSON.stringify(detail),
      ],
    );
  }
}

