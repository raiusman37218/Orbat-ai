import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  normalizeAgentRagConfig,
  normalizeKnowledgeScope,
  type AgentKnowledgeScope,
  type AgentRagConfig,
} from '@/lib/ai/agent-templates';
import { buildModelContext } from '@/lib/ai/help-answer';
import type { ProviderConfig } from '@/lib/ai/provider';
import type { ChatTurn } from '@/lib/agent/engines/types';
import { queryRows } from '@/lib/db';

/* ── Tool Input Schemas (Zod v4 — shared by LangGraph, ADK & tests) ─────── */

export const SearchKnowledgeInputSchema = z.object({
  query: z.string().trim().min(1).max(1000).describe('Customer question or search query'),
  limit: z.number().int().min(1).max(12).optional().describe('Maximum chunks/articles to retrieve'),
});

export const CrmGetCustomer360InputSchema = z.object({
  visitorId: z.string().uuid().optional().describe('Workspace visitor UUID'),
  email: z.string().email().optional().describe('Visitor email address within this workspace'),
});

export const CrmDealStageSchema = z.enum([
  'lead',
  'qualified',
  'demo',
  'proposal',
  'won',
  'lost',
]);

export const CrmCreateOrUpdateDealInputSchema = z.object({
  dealId: z.string().uuid().optional().describe('Existing deal ID to update; omit to create'),
  visitorId: z.string().uuid().optional().describe('Visitor UUID to associate with the deal'),
  title: z.string().trim().min(1).max(200).describe('Short descriptive deal title'),
  stage: CrmDealStageSchema.default('qualified').describe('Pipeline stage'),
  valueCents: z.number().int().min(0).max(1_000_000_000).default(0).describe('Deal value in cents'),
  currency: z.string().trim().min(3).max(6).default('USD').describe('3-letter currency code'),
  probability: z.number().int().min(0).max(100).default(40).describe('Win probability percentage'),
  notes: z.string().trim().max(2000).optional().describe('Optional deal notes'),
});

export const CrmCreateFollowupTaskInputSchema = z.object({
  visitorId: z.string().uuid().optional().describe('Visitor UUID associated with this follow-up'),
  dealId: z.string().uuid().optional().describe('Optional CRM deal UUID'),
  title: z.string().trim().min(1).max(200).describe('Actionable follow-up task title'),
  description: z.string().trim().max(2000).optional().describe('Context for the assigned teammate'),
  kind: z.enum(['call', 'email', 'meeting', 'follow_up', 'todo']).default('follow_up'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  dueInHours: z.number().min(1).max(720).default(24).describe('Due time offset in hours from now'),
});

export const EscalateToTeamGroupInputSchema = z.object({
  reason: z.string().trim().min(2).max(500).describe('Clear reason for human specialist handover'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('high'),
  groupId: z.string().uuid().optional().describe('Optional target team group UUID'),
  internalNote: z.string().trim().max(2000).optional().describe('Summary note for the team'),
});

export const RequestHumanApprovalInputSchema = z.object({
  topic: z.string().trim().min(1).max(120).describe('Trust-ladder topic name'),
  reason: z.string().trim().min(2).max(500).describe('Why human approval is required'),
  draftReply: z.string().trim().min(1).max(4000).describe('Proposed reply awaiting approval'),
});

export type UnifiedToolName =
  | 'search_knowledge'
  | 'crm_get_customer_360'
  | 'crm_create_or_update_deal'
  | 'crm_create_followup_task'
  | 'escalate_to_team_group'
  | 'request_human_approval';

export type DbQueryFn = typeof queryRows;

export type SearchKnowledgeFn = typeof buildModelContext;

export interface AgentToolContext {
  workspaceId: string;
  conversationId?: string;
  visitorId?: string | null;
  visitorEmail?: string | null;
  agentId?: string | null;
  agentName?: string;
  handoffGroupId?: string | null;
  knowledgeScope?: AgentKnowledgeScope | null;
  ragConfig?: Partial<AgentRagConfig> | null;
  helpCenterUrl?: string | null;
  providerConfig?: ProviderConfig | null;
  historyTurns?: ChatTurn[];
  dryRun?: boolean;
  dbQuery?: DbQueryFn;
  searchKnowledgeFn?: SearchKnowledgeFn;
}

export interface AgentToolExecutionResult<T = unknown> {
  ok: boolean;
  toolName: UnifiedToolName;
  summary: string;
  data?: T;
  error?: string;
}

export const UNIFIED_TOOL_DEFINITIONS: Record<
  UnifiedToolName,
  {
    name: UnifiedToolName;
    description: string;
    mutating: boolean;
    schema: z.ZodTypeAny;
  }
> = {
  search_knowledge: {
    name: 'search_knowledge',
    description:
      'Search published Help Center articles and uploaded documents allowed by this agent Knowledge Scope.',
    mutating: false,
    schema: SearchKnowledgeInputSchema,
  },
  crm_get_customer_360: {
    name: 'crm_get_customer_360',
    description:
      'Fetch customer 360 CRM profile, recent orders, open deals, follow-up tasks, and recent support tickets strictly within this workspace.',
    mutating: false,
    schema: CrmGetCustomer360InputSchema,
  },
  crm_create_or_update_deal: {
    name: 'crm_create_or_update_deal',
    description:
      'Create a new CRM sales deal or update an existing deal stage/value in this workspace.',
    mutating: true,
    schema: CrmCreateOrUpdateDealInputSchema,
  },
  crm_create_followup_task: {
    name: 'crm_create_followup_task',
    description:
      'Create an actionable CRM follow-up task or reminder for the team within this workspace.',
    mutating: true,
    schema: CrmCreateFollowupTaskInputSchema,
  },
  escalate_to_team_group: {
    name: 'escalate_to_team_group',
    description:
      'Escalate the conversation to a human team specialist or configured handoff group.',
    mutating: true,
    schema: EscalateToTeamGroupInputSchema,
  },
  request_human_approval: {
    name: 'request_human_approval',
    description:
      'Pause execution for human teammate approval before sending a reply or executing a sensitive write action.',
    mutating: false,
    schema: RequestHumanApprovalInputSchema,
  },
};

function ensureWorkspaceId(ctx: AgentToolContext): string {
  const ws = (ctx.workspaceId || '').trim();
  if (!ws) {
    throw new Error('Workspace isolation violation: workspaceId is required.');
  }
  return ws;
}

async function safeQuery<T extends Record<string, unknown>>(
  db: DbQueryFn,
  sql: string,
  params: unknown[],
): Promise<T[]> {
  try {
    return await db<T>(sql, params);
  } catch {
    return [];
  }
}

/**
 * Executes any unified CRM or support tool strictly scoped to `ctx.workspaceId`.
 * Zod validates all arguments before running DB or RAG operations.
 */
export async function executeAgentTool(
  ctx: AgentToolContext,
  toolName: UnifiedToolName,
  rawArgs: unknown,
): Promise<AgentToolExecutionResult> {
  const workspaceId = ensureWorkspaceId(ctx);
  const db = ctx.dbQuery ?? queryRows;

  switch (toolName) {
    case 'search_knowledge': {
      const parsed = SearchKnowledgeInputSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          ok: false,
          toolName,
          summary: 'Invalid search_knowledge parameters',
          error: parsed.error.issues.map((i) => i.message).join('; '),
        };
      }
      const normalizedScope = normalizeKnowledgeScope(ctx.knowledgeScope);
      const normalizedRag = normalizeAgentRagConfig(ctx.ragConfig);
      const searchFn = ctx.searchKnowledgeFn ?? buildModelContext;
      const historyLines = (ctx.historyTurns || [])
        .filter((t) => t.role === 'user')
        .map((t) => t.content)
        .slice(-4);

      const rag = await searchFn(workspaceId, parsed.data.query, {
        history: historyLines,
        limit: parsed.data.limit ?? normalizedRag.topK,
        providerConfig: ctx.providerConfig ?? null,
        helpCenterUrl: ctx.helpCenterUrl ?? null,
        turns: ctx.historyTurns,
        knowledgeScope: normalizedScope,
        ragConfig: normalizedRag,
      });

      return {
        ok: true,
        toolName,
        summary: `Retrieved ${rag.sources.length} knowledge source(s) (${rag.confidence || 'low'} confidence)`,
        data: rag,
      };
    }

    case 'crm_get_customer_360': {
      const parsed = CrmGetCustomer360InputSchema.safeParse(rawArgs ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          toolName,
          summary: 'Invalid customer lookup arguments',
          error: parsed.error.issues.map((i) => i.message).join('; '),
        };
      }

      const targetVisitorId = parsed.data.visitorId || ctx.visitorId || null;
      const targetEmail = (parsed.data.email || ctx.visitorEmail || '').trim().toLowerCase() || null;
      if (!targetVisitorId && !targetEmail) {
        return {
          ok: true,
          toolName,
          summary: 'No visitor identifier available for Customer 360 lookup',
          data: {
            visitor: null,
            orders: [],
            deals: [],
            openTasks: [],
            recentTickets: [],
          },
        };
      }

      const visitors = targetVisitorId
        ? await safeQuery<Record<string, unknown>>(
            db,
            `SELECT id, name, email, phone, company, segment, tags, plan, lifetime_value_cents, orders_count, ai_summary
               FROM public.visitors
              WHERE workspace_id = $1 AND id = $2
              LIMIT 1`,
            [workspaceId, targetVisitorId],
          )
        : await safeQuery<Record<string, unknown>>(
            db,
            `SELECT id, name, email, phone, company, segment, tags, plan, lifetime_value_cents, orders_count, ai_summary
               FROM public.visitors
              WHERE workspace_id = $1 AND LOWER(email) = $2
              ORDER BY last_seen_at DESC NULLS LAST
              LIMIT 1`,
            [workspaceId, targetEmail],
          );

      const visitor = visitors[0] ?? null;
      const resolvedVisitorId = (visitor?.id as string | undefined) || targetVisitorId;

      if (!resolvedVisitorId) {
        return {
          ok: true,
          toolName,
          summary: 'Visitor not found in this workspace CRM',
          data: {
            visitor: null,
            orders: [],
            deals: [],
            openTasks: [],
            recentTickets: [],
          },
        };
      }

      const [orders, deals, openTasks, recentTickets] = await Promise.all([
        safeQuery<Record<string, unknown>>(
          db,
          `SELECT id, order_number, status, currency, total_cents, items_summary, ordered_at
             FROM public.customer_orders
            WHERE workspace_id = $1 AND visitor_id = $2
            ORDER BY ordered_at DESC NULLS LAST
            LIMIT 5`,
          [workspaceId, resolvedVisitorId],
        ),
        safeQuery<Record<string, unknown>>(
          db,
          `SELECT id, title, stage, value_cents, currency, probability, expected_close_date, updated_at
             FROM public.crm_deals
            WHERE workspace_id = $1 AND visitor_id = $2
            ORDER BY updated_at DESC
            LIMIT 5`,
          [workspaceId, resolvedVisitorId],
        ),
        safeQuery<Record<string, unknown>>(
          db,
          `SELECT id, title, kind, priority, status, due_at
             FROM public.crm_tasks
            WHERE workspace_id = $1 AND visitor_id = $2 AND status = 'open'
            ORDER BY due_at ASC NULLS LAST
            LIMIT 5`,
          [workspaceId, resolvedVisitorId],
        ),
        safeQuery<Record<string, unknown>>(
          db,
          `SELECT id, number, subject, status, priority, created_at
             FROM public.tickets
            WHERE workspace_id = $1 AND requester_id = $2
            ORDER BY created_at DESC
            LIMIT 5`,
          [workspaceId, resolvedVisitorId],
        ),
      ]);

      return {
        ok: true,
        toolName,
        summary: `Loaded Customer 360: ${orders.length} order(s), ${deals.length} deal(s), ${openTasks.length} open task(s), ${recentTickets.length} ticket(s)`,
        data: { visitor, orders, deals, openTasks, recentTickets },
      };
    }

    case 'crm_create_or_update_deal': {
      const parsed = CrmCreateOrUpdateDealInputSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          ok: false,
          toolName,
          summary: 'Invalid deal arguments',
          error: parsed.error.issues.map((i) => i.message).join('; '),
        };
      }
      const d = parsed.data;
      const visitorId = d.visitorId ?? ctx.visitorId ?? null;
      const currency = d.currency.toUpperCase();
      const closedAt = d.stage === 'won' || d.stage === 'lost' ? new Date().toISOString() : null;

      if (ctx.dryRun) {
        return {
          ok: true,
          toolName,
          summary: `[Dry Run] Would ${d.dealId ? 'update' : 'create'} deal "${d.title}" (${d.stage}, ${currency} ${(d.valueCents / 100).toFixed(2)})`,
          data: { dryRun: true, ...d, visitorId, currency },
        };
      }

      if (d.dealId) {
        const rows = await db<Record<string, unknown>>(
          `UPDATE public.crm_deals
              SET title = $3,
                  stage = $4,
                  value_cents = $5,
                  currency = $6,
                  probability = $7,
                  notes = COALESCE($8, notes),
                  closed_at = COALESCE($9, closed_at),
                  updated_at = now()
            WHERE workspace_id = $1 AND id = $2
            RETURNING id, title, stage, value_cents, currency, probability, visitor_id`,
          [
            workspaceId,
            d.dealId,
            d.title,
            d.stage,
            d.valueCents,
            currency,
            d.probability,
            d.notes ?? null,
            closedAt,
          ],
        );
        if (!rows[0]) {
          return {
            ok: false,
            toolName,
            summary: 'Deal not found in this workspace',
            error: 'No matching deal found for workspaceId + dealId',
          };
        }
        return {
          ok: true,
          toolName,
          summary: `Updated deal "${d.title}" to stage "${d.stage}"`,
          data: rows[0],
        };
      }

      const inserted = await db<Record<string, unknown>>(
        `INSERT INTO public.crm_deals
           (workspace_id, visitor_id, title, stage, value_cents, currency, probability, notes, closed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, title, stage, value_cents, currency, probability, visitor_id`,
        [
          workspaceId,
          visitorId,
          d.title,
          d.stage,
          d.valueCents,
          currency,
          d.probability,
          d.notes ?? null,
          closedAt,
        ],
      );
      return {
        ok: true,
        toolName,
        summary: `Created deal "${d.title}" (${d.stage}, ${currency} ${(d.valueCents / 100).toFixed(2)})`,
        data: inserted[0] ?? null,
      };
    }

    case 'crm_create_followup_task': {
      const parsed = CrmCreateFollowupTaskInputSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          ok: false,
          toolName,
          summary: 'Invalid follow-up task arguments',
          error: parsed.error.issues.map((i) => i.message).join('; '),
        };
      }
      const t = parsed.data;
      const visitorId = t.visitorId ?? ctx.visitorId ?? null;
      const dueAt = new Date(Date.now() + t.dueInHours * 3600_000).toISOString();

      if (ctx.dryRun) {
        return {
          ok: true,
          toolName,
          summary: `[Dry Run] Would schedule ${t.priority}-priority ${t.kind} task: "${t.title}"`,
          data: { dryRun: true, ...t, visitorId, dueAt },
        };
      }

      const rows = await db<Record<string, unknown>>(
        `INSERT INTO public.crm_tasks
           (workspace_id, visitor_id, deal_id, title, description, kind, priority, status, due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
         RETURNING id, title, kind, priority, status, due_at, visitor_id`,
        [
          workspaceId,
          visitorId,
          t.dealId ?? null,
          t.title,
          t.description ?? null,
          t.kind,
          t.priority,
          dueAt,
        ],
      );
      return {
        ok: true,
        toolName,
        summary: `Created ${t.priority}-priority CRM follow-up task "${t.title}"`,
        data: rows[0] ?? null,
      };
    }

    case 'escalate_to_team_group': {
      const parsed = EscalateToTeamGroupInputSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          ok: false,
          toolName,
          summary: 'Invalid escalation arguments',
          error: parsed.error.issues.map((i) => i.message).join('; '),
        };
      }
      const e = parsed.data;
      const targetGroupId = e.groupId ?? ctx.handoffGroupId ?? null;
      return {
        ok: true,
        toolName,
        summary: `Escalation staged (${e.priority}): ${e.reason}`,
        data: {
          shouldHandover: true,
          reason: e.reason,
          priority: e.priority,
          groupId: targetGroupId,
          internalNote: e.internalNote ?? e.reason,
        },
      };
    }

    case 'request_human_approval': {
      const parsed = RequestHumanApprovalInputSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          ok: false,
          toolName,
          summary: 'Invalid approval request arguments',
          error: parsed.error.issues.map((i) => i.message).join('; '),
        };
      }
      return {
        ok: true,
        toolName,
        summary: `Human approval requested for topic "${parsed.data.topic}"`,
        data: parsed.data,
      };
    }
  }
}

/**
 * Returns LangChain `@langchain/core/tools` DynamicStructuredTools backed by the
 * unified workspace-scoped CRM & Support tool registry.
 */
export function buildLangChainAgentTools(ctx: AgentToolContext) {
  return (Object.keys(UNIFIED_TOOL_DEFINITIONS) as UnifiedToolName[]).map((name) => {
    const def = UNIFIED_TOOL_DEFINITIONS[name];
    return tool(
      async (input: unknown) => {
        const res = await executeAgentTool(ctx, name, input);
        return JSON.stringify(res);
      },
      {
        name: def.name,
        description: def.description,
        schema: def.schema as z.ZodObject<z.ZodRawShape>,
      },
    );
  });
}
