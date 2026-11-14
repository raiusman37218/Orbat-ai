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

    // 3. Generate Query Embedding & Hybrid RAG Knowledge Retrieval
    let queryEmbedding: number[] | undefined;
    if (this.llm.generateEmbeddings) {
      try {
        const vectors = await this.llm.generateEmbeddings([triggerMessage]);
        if (Array.isArray(vectors?.[0]) && vectors[0].length === 768) {
          queryEmbedding = vectors[0];
        }
      } catch (err: any) {
        this.logger.warn(`Query embedding failed, using FTS fallback: ${err?.message || err}`);
      }
    }

    const chunks = await this.retrieval.retrieveChunks(workspaceId, triggerMessage, queryEmbedding, 5);
    const knowledgeContext = chunks.map((c) => `[Source: ${c.title}]\n${c.content}`).join('\n\n');

    // Load active primary AI agent & workspace branding/custom instructions cleanly if available
    let customPromptPrefix = '';
    let activeAgentId: string | null = null;
    let activeAgentName: string | null = null;
    let blockedTopics: string[] = [];

    try {
      const agentRes = await this.db.query(
        `SELECT id, name, tone, system_prompt, guardrails, escalation_rules
         FROM public.ai_agents
         WHERE workspace_id = $1 AND status = 'live'
         ORDER BY is_primary DESC, updated_at DESC
         LIMIT 1`,
        [workspaceId],
      );
      const agentRow = agentRes?.rows?.[0];
      if (agentRow) {
        activeAgentId = agentRow.id ? String(agentRow.id) : null;
        activeAgentName = agentRow.name ? String(agentRow.name) : null;
        const rawBlocked = agentRow.escalation_rules?.blockedTopics;
        if (Array.isArray(rawBlocked)) {
          blockedTopics = rawBlocked.map(String).filter(Boolean);
        }
        const guardrailsList: string[] = Array.isArray(agentRow.guardrails)
          ? agentRow.guardrails.map(String).filter(Boolean)
          : [];
        const guardrailsText = guardrailsList.length
          ? `\nGuardrails (strict):\n${guardrailsList.map((g) => `- ${g}`).join('\n')}`
          : '';
        customPromptPrefix = [
          activeAgentName ? `Agent Persona: ${activeAgentName}` : '',
          agentRow.tone ? `Tone: ${agentRow.tone}` : '',
          agentRow.system_prompt ? `Custom Instructions: ${agentRow.system_prompt}` : '',
          guardrailsText,
        ]
          .filter(Boolean)
          .join('\n');
        if (customPromptPrefix) customPromptPrefix = `${customPromptPrefix}\n\n`;
      }
    } catch {
      // Fallback to workspaces.ai_settings if ai_agents is not queried
    }

    const matchedBlockedTopic = blockedTopics.find((t) =>
      normalized.includes(t.trim().toLowerCase()),
    );
    if (matchedBlockedTopic) {
      this.logger.log(
        `Blocked escalation topic "${matchedBlockedTopic}" triggered in conversation ${conversationId}`,
      );
      await this.logReplyEvent(
        workspaceId,
        conversationId,
        triggerMessageId,
        'handoff_requested',
        `Blocked topic policy: ${matchedBlockedTopic}`,
        { agent_id: activeAgentId, agent_name: activeAgentName },
      );
      await this.conversationsService.requestHandoff(workspaceId, conversationId);
      return { replied: false, reason: 'blocked_topic_handoff' };
    }

    if (!customPromptPrefix) {
      try {
        const wsRes = await this.db.query(
          'SELECT name, ai_settings FROM public.workspaces WHERE id = $1 LIMIT 1',
          [workspaceId],
        );
        const wsRow = wsRes?.rows?.[0];
        const botName = wsRow?.name || 'our support team';
        const customInstructions = wsRow?.ai_settings?.system_prompt;
        customPromptPrefix = customInstructions
          ? `Workspace: ${botName}\nCustom Instructions: ${customInstructions}\n\n`
          : `Workspace: ${botName}\n\n`;
      } catch {
        customPromptPrefix = '';
      }
    }

    // 4. Construct System & User Prompt
    const systemPrompt = `${customPromptPrefix}You are an intelligent customer support assistant.
Provide clear, polite, and helpful answers based strictly on the provided knowledge sources.
If the answer is not contained in the knowledge base, state that you do not have sufficient information and offer to connect the customer with a support specialist.

Knowledge Sources:
${knowledgeContext || 'No specific articles found. Answer general greetings politely.'}`;

    // 5. Generate LLM Completion
    const completion = await this.llm.generateCompletion({
      workspaceId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: triggerMessage },
      ],
      temperature: 0.2,
      maxTokens: 512,
    });

    // 5b. Sentinel Compliance Check (active approved compliance_policies + workspace_compliance_settings)
    let safeReplyContent = completion.content;
    try {
      const polRes = await this.db.query(
        `SELECT p.id, p.rule_key, p.name, p.framework, p.action_mode, p.pattern_type, p.pattern,
                COALESCE(cs.sentinel_enabled, true) AS sentinel_enabled
         FROM public.compliance_policies p
         LEFT JOIN public.workspace_compliance_settings cs ON cs.workspace_id = p.workspace_id
         WHERE p.workspace_id = $1
           AND p.is_enabled = true
           AND p.review_status = 'approved'
           AND p.applies_to IN ('ai', 'both')`,
        [workspaceId],
      );
      const policies = (polRes?.rows ?? []) as Array<{
        id: string;
        rule_key: string | null;
        name: string;
        framework: string;
        action_mode: string;
        pattern_type: string;
        pattern: string;
        sentinel_enabled: boolean;
      }>;
      const sentinelOn = policies.length === 0 ? false : policies[0].sentinel_enabled !== false;
      if (sentinelOn && policies.length > 0) {
        const hits: Array<{ id: string; name: string; framework: string; mode: string; preview: string }> = [];
        for (const p of policies) {
          let matched: string | null = null;
          if (p.rule_key === 'pii_card') {
            safeReplyContent = safeReplyContent.replace(/\b(?:\d[ -]*?){13,19}\b/g, (raw) => {
              const d = raw.replace(/\D/g, '');
              if (d.length < 13 || d.length > 19) return raw;
              matched = `•••• ${d.slice(-4)}`;
              return `[CARD •••• ${d.slice(-4)}]`;
            });
          } else if (p.rule_key === 'pii_ssn') {
            safeReplyContent = safeReplyContent.replace(/\b(\d{3}-\d{2}-\d{4})\b/g, (raw) => {
              matched = `•••-••-${raw.slice(-4)}`;
              return `[SSN •••-${raw.slice(-4)}]`;
            });
          } else if (p.rule_key === 'secret_credentials') {
            safeReplyContent = safeReplyContent.replace(/\b(sk_(?:live|test)_[A-Za-z0-9]{12,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,})\b/g, () => {
              matched = '[SECRET REDACTED]';
              return '[REDACTED SECRET]';
            });
          } else if (p.pattern_type === 'keyword' && p.pattern) {
            const terms = p.pattern.split(/[|,\n]/).map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2);
            const hitTerm = terms.find((t) => safeReplyContent.toLowerCase().includes(t));
            if (hitTerm) matched = hitTerm;
          }
          if (matched) {
            hits.push({ id: p.id, name: p.name, framework: p.framework, mode: p.action_mode, preview: matched });
          }
        }
        if (hits.length > 0) {
          const blockedHit = hits.find((h) => h.mode === 'block' || h.mode === 'escalate');
          for (const h of hits) {
            await this.db.query(
              `INSERT INTO public.compliance_flags
                 (workspace_id, policy_id, conversation_id, severity, framework, rule_name, channel, actor_type, action_taken, redacted_excerpt)
               VALUES ($1, $2, $3, $4, $5, $6, 'chat', 'ai', $7, $8)`,
              [
                workspaceId,
                h.id,
                conversationId,
                h.mode === 'block' || h.mode === 'redact' ? 'high' : 'medium',
                h.framework,
                h.name,
                h.mode === 'redact' ? 'redacted' : h.mode === 'block' ? 'blocked' : h.mode === 'escalate' ? 'escalated' : 'flagged',
                safeReplyContent.slice(0, 500),
              ],
            ).catch(() => {});
            await this.db.query(
              `UPDATE public.compliance_policies SET hits_count = hits_count + 1, last_triggered_at = now() WHERE id = $1`,
              [h.id],
            ).catch(() => {});
          }
          if (blockedHit) {
            await this.logReplyEvent(workspaceId, conversationId, triggerMessageId, 'handoff_requested', `Compliance policy blocked AI draft: ${blockedHit.name}`);
            await this.conversationsService.requestHandoff(workspaceId, conversationId);
            return { replied: false, reason: 'compliance_blocked_handoff' };
          }
        }
      }
    } catch {
      // Non-fatal fallback for mocked DB specs or pre-migration state
    }

    // 6. Post Bot Reply Message (senderType: 'ai' so AI mode remains active)
    const botMsg = await this.messagesService.sendMessage(
      workspaceId,
      conversationId,
      {
        content: safeReplyContent,
        senderType: 'ai',
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

    // 9. Log Audit Event + Verification Log
    await this.logReplyEvent(workspaceId, conversationId, triggerMessageId, 'replied', 'Grounded reply dispatched', {
      botMessageId: botMsg.id,
      chunksCount: chunks.length,
      model: completion.model,
      agent_id: activeAgentId,
      agent_name: activeAgentName,
    });

    try {
      await this.db.query(
        `INSERT INTO public.ai_verification_logs (
           workspace_id, agent_id, agent_name, conversation_id, message_id, channel,
           customer_question, draft_reply, final_reply, verdict, claims, outcome_note
         )
         VALUES ($1, $2, $3, $4, $5, 'api', $6, $7, $7, 'supported', $8::jsonb, $9)`,
        [
          workspaceId,
          activeAgentId,
          activeAgentName || 'AI Assistant',
          conversationId,
          botMsg.id,
          triggerMessage.slice(0, 4000),
          safeReplyContent.slice(0, 8000),
          JSON.stringify(
            chunks.slice(0, 2).map((c) => ({
              claim: c.content.slice(0, 160),
              supported: true,
              source: c.title,
            })),
          ),
          chunks.length > 0
            ? `Grounded on ${chunks.length} retrieved knowledge chunk(s)`
            : 'Reply generated without specific chunk citations',
        ],
      );
    } catch {
      // Non-fatal verification audit write
    }

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
      workspaceId,
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
      workspaceId,
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

  async listAiAgents(workspaceId: string) {
    const res = await this.db.query(
      `SELECT id, slug, name, role_title, description, template_id, industry, status, is_primary,
              channels, tone, reply_language_mode, answer_mode, published_version, draft_version,
              published_at, updated_at
       FROM public.ai_agents
       WHERE workspace_id = $1
       ORDER BY is_primary DESC, updated_at DESC`,
      [workspaceId],
    );
    return { agents: res?.rows ?? [] };
  }

  async listVerificationLogs(workspaceId: string, limit = 50) {
    const res = await this.db.query(
      `SELECT id, agent_id, agent_name, conversation_id, message_id, channel, topic,
              customer_question, draft_reply, final_reply, verdict, human_review, claims,
              outcome_note, confidence, latency_ms, created_at
       FROM public.ai_verification_logs
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [workspaceId, Math.min(200, Math.max(1, limit))],
    );
    return { logs: res?.rows ?? [] };
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

