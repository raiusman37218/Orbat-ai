import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { getDbPool, query, queryRows } from '@/lib/db';
import { POST as autoRespondPost } from '@/app/api/ai/auto-respond/route';
import { persistAgentRun } from '@/lib/agent/engines/run-store';
import {
  ensurePrimaryAiAgent,
  normalizeAgentRow,
  syncPrimaryAgentToWorkspaceAiSettings,
  type AiAgentRow,
} from '@/lib/ai/agent-runtime';
import {
  DEFAULT_AGENT_APPEARANCE,
  DEFAULT_AGENT_ENGINE_CONFIG,
  DEFAULT_AGENT_MODEL_CONFIG,
  DEFAULT_AGENT_RAG_CONFIG,
  DEFAULT_AGENT_ROUTING_RULES,
  DEFAULT_ESCALATION_RULES,
  DEFAULT_KNOWLEDGE_SCOPE,
} from '@/lib/ai/agent-templates';
import { invalidateHelpIndex } from '@/lib/ai/help-answer';
import { syncArticleChunks } from '@/lib/ai/semantic-retrieval';
import { refreshHelpCenter } from '@/lib/help/refresh';
import {
  DEMO_PERSONAS,
  getDemoPersonaOption,
  getDemoScenarioPreset,
  normalizeSimulateMessage,
  type DemoChannel,
  type DemoPersona,
  type DemoScenarioKey,
  type DemoSeedSummary,
  type SimulateChatResult,
} from './demo-presets';

const DEMO_TOOLS = [
  'search_knowledge',
  'crm_get_customer_360',
  'crm_create_or_update_deal',
  'crm_create_followup_task',
  'escalate_to_team_group',
  'request_human_approval',
];

const DEMO_CHANNELS_ALL: DemoChannel[] = ['web', 'whatsapp', 'email', 'instagram'];

interface DemoKbArticleSpec {
  sectionName: string;
  sectionSlug: string;
  sectionDescription: string;
  sectionIcon: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
}

const DEMO_KB_ARTICLES: DemoKbArticleSpec[] = [
  {
    sectionName: 'Plans, Pricing & Billing',
    sectionSlug: 'plans-pricing-billing',
    sectionDescription: 'Subscription tiers, annual discounts, invoices, and refund policies.',
    sectionIcon: '💳',
    title: 'Orbat AI Plans & Pricing Tiers',
    slug: 'demo-orbat-plans-pricing',
    summary: 'Compare Starter ($29/mo), Pro ($79/mo), Business ($199/mo), and Enterprise custom annual contracts.',
    content: `# Orbat AI Plans & Pricing Tiers

Choose a plan that scales from solo support desks to multi-channel AI revenue teams:

## Starter — $29/month
- Up to 2 support agents
- Web Chat Widget & Email channel
- 500 AI auto-resolutions/month
- Standard Help Center with CSV & article ingestion

## Pro — $79/month (Most Popular)
- Up to 10 support agents
- Includes **WhatsApp Business**, **Instagram DMs**, Web Widget, and Email
- Includes **AI Copilot**, **Trust Ladder Guardrails**, and 2,500 AI resolutions/month
- Multi-language auto-translation including Roman Urdu, Spanish, Arabic, and French
- Unlimited Help Center sections, collections, and RAG knowledge chunks

## Business — $199/month
- Up to 25 support agents
- Multi-Agent Router (**Hybrid Built-in + LangGraph Workflows + Google ADK Specialists**)
- Custom **SLA Policies** with breach warnings and business-hours calendars
- Full **Customer 360 CRM Pipeline** (Companies, Deals, Tasks, Order Lookup)

## Enterprise — Custom Annual Contract (50+ / 100+ seats)
- Dedicated SAML/SSO, custom seat bundles (e.g. 100+ seats), volume annual pricing, and audit exports
- Dedicated Solutions Architect & custom webhook integrations
- Contact Enterprise Sales in chat to receive a custom quote and CRM deal proposal.`,
  },
  {
    sectionName: 'Plans, Pricing & Billing',
    sectionSlug: 'plans-pricing-billing',
    sectionDescription: 'Subscription tiers, annual discounts, invoices, and refund policies.',
    sectionIcon: '💳',
    title: 'Refund & Double-Billing Policy',
    slug: 'demo-refund-double-billing-policy',
    summary: '30-day full refund guarantee for duplicate charges, accidental renewals, and billing errors.',
    content: `# Refund & Double-Billing Policy

We offer a 30-day no-questions-asked refund for duplicate charges or accidental annual renewals.

## How Refunds Work
- Duplicate card or invoice charges are refunded 100% back to the original payment method within 3–5 business days.
- Annual plan cancellations requested within 30 days of renewal qualify for a full refund.
- Refunds over **$250 USD** (or marked under Trust Ladder Level 2) automatically pause via **LangGraph human approval** so a billing owner can confirm the transaction before payout.`,
  },
  {
    sectionName: 'Channels & Integrations',
    sectionSlug: 'channels-integrations',
    sectionDescription: 'Connect Web Widget, WhatsApp Business, Email forwarding, and Instagram DMs.',
    sectionIcon: '🔌',
    title: 'Connecting WhatsApp Business & Instagram DMs',
    slug: 'demo-whatsapp-instagram-channels',
    summary: 'Step-by-step setup for WhatsApp Cloud API, Meta 24-hour customer windows, and Instagram DM automation.',
    content: `# Connecting WhatsApp Business & Instagram DMs

All Pro, Business, and Enterprise plans include native WhatsApp Business and Instagram DM support.

## Setup Steps
1. Open **Channels** in the sidebar and choose **WhatsApp** or **Instagram**.
2. Authorize via Meta Embedded Signup or enter your Cloud API phone number ID and permanent access token.
3. Inbound customer messages open a 24-hour interactive messaging window automatically.
4. Set AI mode to **Autopilot** for instant grounded replies or **Copilot** for human-reviewed drafts.`,
  },
  {
    sectionName: 'AI Studio & Workflows',
    sectionSlug: 'ai-studio-workflows',
    sectionDescription: 'Trust Ladder guardrails, LangGraph approvals, Google ADK tools, and RAG settings.',
    sectionIcon: '✨',
    title: 'Trust Ladder Autonomy & LangGraph Approvals',
    slug: 'demo-trust-ladder-langgraph-approvals',
    summary: 'Understand Autonomy Levels 1–4 and how Level 2 actions pause cleanly for human approval.',
    content: `# Trust Ladder Autonomy & LangGraph Approvals

The Trust Ladder controls what your AI agents can execute autonomously by topic:
- **Level 4 (Auto-Send)**: Answers grounded in Help Center citations send immediately (e.g. Pricing & General Inquiries).
- **Level 3 (Verified Send)**: Runs pre-delivery claim verification against KB chunks before sending.
- **Level 2 (Approval Pause)**: High-impact topics such as **Refunds** pause inside LangGraph and create an interactive approval card for your team in Inbox & Handoff.
- **Level 1 (Draft / Escalate)**: Routes directly to human agents.`,
  },
  {
    sectionName: 'AI Studio & Workflows',
    sectionSlug: 'ai-studio-workflows',
    sectionDescription: 'Trust Ladder guardrails, LangGraph approvals, Google ADK tools, and RAG settings.',
    sectionIcon: '✨',
    title: 'SLA Timers & Human Handoff Escalation',
    slug: 'demo-sla-timers-human-handoff',
    summary: 'Prioritized first-reply, next-reply, and resolution SLA targets plus frustration escalation.',
    content: `# SLA Timers & Human Handoff Escalation

Urgent incidents and billing disputes require rapid human intervention.

## Urgent Escalation Rules
- If a visitor asks for a manager, human agent, or reports an outage/broken checkout, Orbat AI immediately moves the conversation to the **Handoff Queue**.
- Standard SLA targets track **First Reply (15m urgent / 60m high)**, **Next Reply**, and **Resolution Time**.
- Pending and On-Hold ticket states pause SLA clocks automatically.`,
  },
  {
    sectionName: 'Orders & Webhooks',
    sectionSlug: 'orders-webhooks',
    sectionDescription: 'Troubleshooting order sync, webhook retries, and API rate limits.',
    sectionIcon: '📦',
    title: 'Order Lookup & Webhook Diagnostics',
    slug: 'demo-order-webhook-diagnostics',
    summary: 'Inspect Customer 360 orders like ORD-9421 and diagnose 502 webhook delivery failures.',
    content: `# Order Lookup & Webhook Diagnostics

Use **Customer 360** to inspect linked orders, invoices, and open deals alongside every ticket.

## Webhook Failures (HTTP 502 / Timeout)
- Outbound webhooks retry 5 times with exponential backoff over 30 minutes.
- If a checkout webhook consistently returns HTTP 502, verify TLS certificates on your endpoint and temporarily pause strict IP allowlisting while testing.`,
  },
];

async function ensureSalesCrmTablesIfNeeded(): Promise<void> {
  await queryRows(
    `CREATE TABLE IF NOT EXISTS public.crm_companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
      domain TEXT,
      industry TEXT,
      size TEXT,
      website TEXT,
      annual_revenue_cents BIGINT NOT NULL DEFAULT 0 CHECK (annual_revenue_cents >= 0),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
  await queryRows(
    `CREATE TABLE IF NOT EXISTS public.crm_deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      visitor_id UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
      company_id UUID REFERENCES public.crm_companies(id) ON DELETE SET NULL,
      title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
      stage TEXT NOT NULL DEFAULT 'lead'
        CHECK (stage IN ('lead', 'qualified', 'demo', 'proposal', 'won', 'lost')),
      value_cents BIGINT NOT NULL DEFAULT 0 CHECK (value_cents >= 0),
      currency TEXT NOT NULL DEFAULT 'USD',
      probability INTEGER NOT NULL DEFAULT 20 CHECK (probability >= 0 AND probability <= 100),
      expected_close_date DATE,
      owner_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
      notes TEXT,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
  await queryRows(
    `CREATE TABLE IF NOT EXISTS public.crm_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      visitor_id UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
      deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
      title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
      description TEXT,
      kind TEXT NOT NULL DEFAULT 'follow_up'
        CHECK (kind IN ('call', 'email', 'meeting', 'follow_up', 'todo')),
      priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high')),
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'completed')),
      due_at TIMESTAMPTZ,
      assignee_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
}

async function ensureDemoKnowledgeBase(
  workspaceId: string,
  agentId: string,
): Promise<{
  sectionsCreated: number;
  articlesCreated: number;
  chunksSynced: number;
  embeddingMode: 'pgvector' | 'keyword_fallback';
}> {
  let sectionsCreated = 0;
  let articlesCreated = 0;
  let chunksSynced = 0;

  const sectionIds = new Map<string, string>();
  const existingSections = await queryRows<{ id: string; name: string }>(
    `SELECT id, name FROM public.help_sections WHERE workspace_id = $1`,
    [workspaceId],
  );
  for (const s of existingSections) {
    sectionIds.set(s.name.toLowerCase(), s.id);
  }

  let nextSectionOrder = existingSections.length + 1;
  const articleIdsToSync: string[] = [];

  for (let i = 0; i < DEMO_KB_ARTICLES.length; i++) {
    const spec = DEMO_KB_ARTICLES[i];
    let sectionId = sectionIds.get(spec.sectionName.toLowerCase()) || null;

    if (!sectionId) {
      const insertedSection = await queryRows<{ id: string }>(
        `INSERT INTO public.help_sections (workspace_id, name, description, icon, order_index)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [workspaceId, spec.sectionName, spec.sectionDescription, spec.sectionIcon, nextSectionOrder++],
      );
      if (insertedSection[0]?.id) {
        sectionId = insertedSection[0].id;
        sectionIds.set(spec.sectionName.toLowerCase(), sectionId);
        sectionsCreated += 1;
      }
    }

    const existingArticle = await queryRows<{ id: string; chunk_count: string }>(
      `SELECT a.id,
              (SELECT COUNT(*)::text FROM public.article_chunks c WHERE c.article_id = a.id) AS chunk_count
       FROM public.articles a
       WHERE a.workspace_id = $1 AND LOWER(COALESCE(a.slug, '')) = LOWER($2)
       LIMIT 1`,
      [workspaceId, spec.slug],
    );

    if (existingArticle[0]?.id) {
      if (Number(existingArticle[0].chunk_count || 0) === 0) {
        articleIdsToSync.push(existingArticle[0].id);
      }
      continue;
    }

    const insertedArticle = await queryRows<{ id: string }>(
      `INSERT INTO public.articles (
         workspace_id, section_id, title, slug, category, summary, content, status, author_id, views_count, order_index
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', $8, $9, $10)
       RETURNING id`,
      [
        workspaceId,
        sectionId,
        spec.title,
        spec.slug,
        spec.sectionName,
        spec.summary,
        spec.content,
        agentId,
        42 + i * 19,
        i + 1,
      ],
    );
    if (insertedArticle[0]?.id) {
      articlesCreated += 1;
      articleIdsToSync.push(insertedArticle[0].id);
    }
  }

  for (const articleId of articleIdsToSync) {
    await syncArticleChunks(articleId, workspaceId).catch(() => {});
  }

  if (articleIdsToSync.length > 0) {
    const chunkCountRows = await queryRows<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM public.article_chunks
       WHERE workspace_id = $1 AND article_id = ANY($2::uuid[])`,
      [workspaceId, articleIdsToSync],
    ).catch(() => [{ cnt: '0' }]);
    chunksSynced = Number(chunkCountRows[0]?.cnt || 0);
  }

  const vectorCheck = await queryRows<{ vec_cnt: string }>(
    `SELECT COUNT(*) FILTER (WHERE embedding IS NOT NULL)::text AS vec_cnt
     FROM public.article_chunks
     WHERE workspace_id = $1`,
    [workspaceId],
  ).catch(() => [{ vec_cnt: '0' }]);

  const embeddingMode: 'pgvector' | 'keyword_fallback' =
    Number(vectorCheck[0]?.vec_cnt || 0) > 0 ? 'pgvector' : 'keyword_fallback';

  invalidateHelpIndex(workspaceId);
  refreshHelpCenter(workspaceId);

  return { sectionsCreated, articlesCreated, chunksSynced, embeddingMode };
}

async function upsertTrustPolicies(
  workspaceId: string,
  agentId: string,
  policies: Array<{ topic: string; level: 1 | 2 | 3 | 4; locked: boolean; lockReason: string | null; note: string }>,
): Promise<void> {
  for (const policy of policies) {
    await query(
      `INSERT INTO public.ai_autonomy_policies (
         workspace_id, agent_id, topic, level, locked, lock_reason, change_note, last_changed_by_name
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Demo Seeder')
       ON CONFLICT (workspace_id, agent_id, topic) DO UPDATE
       SET level = EXCLUDED.level,
           locked = EXCLUDED.locked,
           lock_reason = EXCLUDED.lock_reason,
           change_note = EXCLUDED.change_note,
           updated_at = now()`,
      [workspaceId, agentId, policy.topic, policy.level, policy.locked, policy.lockReason, policy.note],
    );
  }
}

async function getDemoOptionalSchemaSupport(): Promise<{
  hasAgentEngineCols: boolean;
  hasAgentRunsTable: boolean;
}> {
  const [cols, tbl] = await Promise.all([
    queryRows<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'ai_agents'
         AND column_name = ANY($1::text[])`,
      [['engine_type', 'engine_config', 'rag_config', 'model_config', 'routing_rules']],
    ).catch(() => []),
    queryRows<{ reg: string | null }>(
      `SELECT to_regclass('public.ai_agent_runs')::text AS reg`,
    ).catch(() => [{ reg: null }]),
  ]);

  const colSet = new Set(cols.map((c) => c.column_name));
  const hasAgentEngineCols =
    colSet.has('engine_type') &&
    colSet.has('engine_config') &&
    colSet.has('rag_config') &&
    colSet.has('model_config') &&
    colSet.has('routing_rules');
  const hasAgentRunsTable = Boolean(tbl[0]?.reg);

  return { hasAgentEngineCols, hasAgentRunsTable };
}

async function ensureDemoAiAgentsAndPolicies(
  workspaceId: string,
  agentId: string,
): Promise<{ primaryAgent: AiAgentRow; enterpriseAgent: AiAgentRow; agentsConfigured: number }> {
  const [{ hasAgentEngineCols }, basePrimary] = await Promise.all([
    getDemoOptionalSchemaSupport(),
    ensurePrimaryAiAgent(workspaceId),
  ]);
  if (!basePrimary) {
    throw new Error('Could not initialize workspace primary AI agent.');
  }
  let agentsConfigured = 0;

  const primaryRagConfig = {
    ...DEFAULT_AGENT_RAG_CONFIG,
    mode: 'advanced' as const,
    topK: 6,
    citations: true,
  };
  const primaryEngineConfig = {
    ...DEFAULT_AGENT_ENGINE_CONFIG,
    maxSteps: 6,
    enableMemory: true,
    allowedTools: DEMO_TOOLS,
  };

  const updatedPrimaryRows = hasAgentEngineCols
    ? await queryRows<Record<string, unknown>>(
        `UPDATE public.ai_agents
         SET status = 'live',
             engine_type = 'hybrid',
             channels = $3,
             reply_language_mode = 'match_customer',
             answer_mode = 'agent',
             published_version = GREATEST(published_version, 1),
             published_at = COALESCE(published_at, now()),
             engine_config = $4::jsonb,
             rag_config = $5::jsonb,
             updated_by = $6,
             updated_at = now()
         WHERE id = $1 AND workspace_id = $2
         RETURNING *`,
        [
          basePrimary.id,
          workspaceId,
          DEMO_CHANNELS_ALL,
          JSON.stringify(primaryEngineConfig),
          JSON.stringify(primaryRagConfig),
          agentId,
        ],
      )
    : await queryRows<Record<string, unknown>>(
        `UPDATE public.ai_agents
         SET status = 'live',
             channels = $3,
             reply_language_mode = 'match_customer',
             answer_mode = 'agent',
             published_version = GREATEST(published_version, 1),
             published_at = COALESCE(published_at, now()),
             updated_by = $4,
             updated_at = now()
         WHERE id = $1 AND workspace_id = $2
         RETURNING *`,
        [basePrimary.id, workspaceId, DEMO_CHANNELS_ALL, agentId],
      );
  const primaryAgent = updatedPrimaryRows[0] ? normalizeAgentRow(updatedPrimaryRows[0]) : basePrimary;
  agentsConfigured += 1;

  await syncPrimaryAgentToWorkspaceAiSettings(workspaceId, primaryAgent);
  await query(
    `UPDATE public.workspaces
     SET ai_settings = COALESCE(ai_settings, '{}'::jsonb) || '{"enabled":true,"auto_response_enabled":true}'::jsonb,
         updated_at = now()
     WHERE id = $1`,
    [workspaceId],
  ).catch(() => {});

  await upsertTrustPolicies(workspaceId, primaryAgent.id, [
    { topic: 'General inquiries', level: 4, locked: false, lockReason: null, note: 'Auto-send KB answers' },
    { topic: 'Billing & refunds', level: 4, locked: false, lockReason: null, note: 'Auto-send pricing tier info' },
    { topic: 'Technical troubleshooting', level: 3, locked: false, lockReason: null, note: 'Verified KB replies' },
    { topic: 'Account & access', level: 3, locked: false, lockReason: null, note: 'Verified account guidance' },
    {
      topic: 'Refund',
      level: 2,
      locked: true,
      lockReason: 'Refund approvals require supervisor sign-off via LangGraph interrupt.',
      note: 'LangGraph Approval Guardrail (Level 2)',
    },
  ]);

  const existingAdkRows = await queryRows<Record<string, unknown>>(
    `SELECT * FROM public.ai_agents
     WHERE workspace_id = $1 AND slug = 'enterprise-sales-adk'
     LIMIT 1`,
    [workspaceId],
  );

  const enterpriseCapabilities = {
    actions: ['enterprise quote', 'custom plan', 'annual contract', 'crm deal', '100 seats'],
    frameworks: ['Google ADK'],
    subAgentId: 'pricing_offers',
  };
  const enterpriseRouting = {
    ...DEFAULT_AGENT_ROUTING_RULES,
    intents: ['enterprise_quote', 'pricing_custom', 'crm_deal'],
    keywords: ['enterprise quote', 'custom plan', 'annual contract', '100 seats', 'crm deal'],
    channels: DEMO_CHANNELS_ALL,
    priority: 10,
  };
  const enterpriseEngineConfig = {
    ...DEFAULT_AGENT_ENGINE_CONFIG,
    maxSteps: 6,
    enableMemory: true,
    allowedTools: ['search_knowledge', 'crm_get_customer_360', 'crm_create_or_update_deal', 'crm_create_followup_task'],
  };

  let enterpriseAgent: AiAgentRow;
  if (existingAdkRows[0]) {
    const refreshedAdk = hasAgentEngineCols
      ? await queryRows<Record<string, unknown>>(
          `UPDATE public.ai_agents
           SET status = 'live',
               engine_type = 'adk',
               channels = $3,
               capabilities = $4::jsonb,
               routing_rules = $5::jsonb,
               engine_config = $6::jsonb,
               rag_config = $7::jsonb,
               published_version = GREATEST(published_version, 1),
               published_at = COALESCE(published_at, now()),
               updated_by = $8,
               updated_at = now()
           WHERE id = $1 AND workspace_id = $2
           RETURNING *`,
          [
            existingAdkRows[0].id,
            workspaceId,
            DEMO_CHANNELS_ALL,
            JSON.stringify(enterpriseCapabilities),
            JSON.stringify(enterpriseRouting),
            JSON.stringify(enterpriseEngineConfig),
            JSON.stringify(primaryRagConfig),
            agentId,
          ],
        )
      : await queryRows<Record<string, unknown>>(
          `UPDATE public.ai_agents
           SET status = 'live',
               channels = $3,
               capabilities = $4::jsonb,
               published_version = GREATEST(published_version, 1),
               published_at = COALESCE(published_at, now()),
               updated_by = $5,
               updated_at = now()
           WHERE id = $1 AND workspace_id = $2
           RETURNING *`,
          [existingAdkRows[0].id, workspaceId, DEMO_CHANNELS_ALL, JSON.stringify(enterpriseCapabilities), agentId],
        );
    enterpriseAgent = normalizeAgentRow(refreshedAdk[0] || existingAdkRows[0]);
  } else {
    const adkGuardrails = [
      'Never invent SLA contractual credits outside Pricing docs.',
      'Always create or update a CRM deal for enterprise quote requests.',
    ];
    const adkPrompt =
      'You are Atlas, an Enterprise Sales specialist powered by Google ADK. Whenever a buyer requests an enterprise quote, custom plan, or multi-seat rollout, inspect Help Center pricing tiers and call crm_create_or_update_deal to stage a qualified deal.';
    const adkAppearance = { ...DEFAULT_AGENT_APPEARANCE, badgeLabel: 'ADK Sales' };

    const insertedAdk = hasAgentEngineCols
      ? await queryRows<Record<string, unknown>>(
          `INSERT INTO public.ai_agents (
             workspace_id, slug, name, role_title, description, industry,
             status, is_primary, channels, tone, reply_language_mode, answer_mode,
             system_prompt, guardrails, escalation_rules, knowledge_scope, capabilities,
             appearance, published_version, draft_version, published_at, created_by, updated_by,
             engine_type, engine_config, rag_config, model_config, routing_rules
           )
           VALUES (
             $1, 'enterprise-sales-adk', 'Atlas · Enterprise Sales', 'Enterprise Sales Specialist',
             'Qualifies custom annual contracts, 50+ seat quotes, and stages B2B CRM deals via Google ADK.',
             'SaaS', 'live', false, $2, 'Consultative, crisp, ROI-focused', 'match_customer', 'agent',
             $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
             1, 1, now(), $9, $9, 'adk', $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb
           )
           RETURNING *`,
          [
            workspaceId,
            DEMO_CHANNELS_ALL,
            adkPrompt,
            adkGuardrails,
            JSON.stringify(DEFAULT_ESCALATION_RULES),
            JSON.stringify(DEFAULT_KNOWLEDGE_SCOPE),
            JSON.stringify(enterpriseCapabilities),
            JSON.stringify(adkAppearance),
            agentId,
            JSON.stringify(enterpriseEngineConfig),
            JSON.stringify(primaryRagConfig),
            JSON.stringify(DEFAULT_AGENT_MODEL_CONFIG),
            JSON.stringify(enterpriseRouting),
          ],
        )
      : await queryRows<Record<string, unknown>>(
          `INSERT INTO public.ai_agents (
             workspace_id, slug, name, role_title, description, industry,
             status, is_primary, channels, tone, reply_language_mode, answer_mode,
             system_prompt, guardrails, escalation_rules, knowledge_scope, capabilities,
             appearance, published_version, draft_version, published_at, created_by, updated_by
           )
           VALUES (
             $1, 'enterprise-sales-adk', 'Atlas · Enterprise Sales', 'Enterprise Sales Specialist',
             'Qualifies custom annual contracts, 50+ seat quotes, and stages B2B CRM deals via Google ADK.',
             'SaaS', 'live', false, $2, 'Consultative, crisp, ROI-focused', 'match_customer', 'agent',
             $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
             1, 1, now(), $9, $9
           )
           RETURNING *`,
          [
            workspaceId,
            DEMO_CHANNELS_ALL,
            adkPrompt,
            adkGuardrails,
            JSON.stringify(DEFAULT_ESCALATION_RULES),
            JSON.stringify(DEFAULT_KNOWLEDGE_SCOPE),
            JSON.stringify(enterpriseCapabilities),
            JSON.stringify(adkAppearance),
            agentId,
          ],
        );
    enterpriseAgent = normalizeAgentRow(insertedAdk[0]);
  }
  agentsConfigured += 1;

  await upsertTrustPolicies(workspaceId, enterpriseAgent.id, [
    { topic: 'General inquiries', level: 4, locked: false, lockReason: null, note: 'ADK auto-respond enabled' },
    { topic: 'Billing & refunds', level: 4, locked: false, lockReason: null, note: 'ADK Enterprise quoting enabled' },
  ]);

  return { primaryAgent, enterpriseAgent, agentsConfigured };
}

async function ensureDemoSlaPolicy(workspaceId: string): Promise<string | null> {
  const existing = await queryRows<{ id: string }>(
    `SELECT id FROM public.sla_policies
     WHERE workspace_id = $1 AND is_active = true
     ORDER BY position ASC, created_at ASC
     LIMIT 1`,
    [workspaceId],
  );
  if (existing[0]?.id) return existing[0].id;

  const inserted = await queryRows<{ id: string }>(
    `INSERT INTO public.sla_policies (
       workspace_id, name, description, position, is_active, conditions, targets,
       business_hours, alert_before_minutes, notify_assignee, notify_group
     )
     VALUES (
       $1, 'Standard Support SLA',
       'Tracks urgent outages (15m), high priority (60m), normal (4h), and low (8h) targets.',
       1, true, '{}'::jsonb,
       '{"urgent":{"first_reply":15,"next_reply":30,"resolution":120},"high":{"first_reply":60,"next_reply":120,"resolution":480},"normal":{"first_reply":240,"next_reply":480,"resolution":1440},"low":{"first_reply":480,"next_reply":720,"resolution":2880}}'::jsonb,
       false, 30, true, true
     )
     RETURNING id`,
    [workspaceId],
  );
  return inserted[0]?.id ?? null;
}

async function upsertVisitor(params: {
  workspaceId: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  segment: string;
  tags: string[];
  plan: string;
  city: string;
  country: string;
  language: string;
  channel: DemoChannel | 'manual';
  channelUserId?: string | null;
}): Promise<{ id: string; inserted: boolean }> {
  const existing = await queryRows<{ id: string }>(
    `SELECT id FROM public.visitors
     WHERE workspace_id = $1 AND LOWER(email) = LOWER($2)
     ORDER BY first_seen_at ASC NULLS LAST
     LIMIT 1`,
    [params.workspaceId, params.email],
  );

  if (existing[0]?.id) {
    await query(
      `UPDATE public.visitors
       SET last_seen_at = now(),
           last_seen = now(),
           is_online = true,
           visit_count = COALESCE(visit_count, 0) + 1
       WHERE id = $1`,
      [existing[0].id],
    );
    return { id: existing[0].id, inserted: false };
  }

  const inserted = await queryRows<{ id: string }>(
    `INSERT INTO public.visitors (
       workspace_id, name, email, phone, company, segment, tags, plan,
       ip_location_city, ip_location_country, timezone, language,
       marketing_opt_in, current_page_url, is_online, visit_count,
       channel, channel_user_id, first_seen_at, last_seen_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9, $10, 'UTC', $11, true, '/pricing', true, 3, $12, $13, now(), now())
     RETURNING id`,
    [
      params.workspaceId,
      params.name,
      params.email,
      params.phone ?? null,
      params.company ?? null,
      params.segment,
      params.tags,
      params.plan,
      params.city,
      params.country,
      params.language,
      params.channel === 'email' ? 'email' : params.channel,
      params.channelUserId ?? null,
    ],
  );
  return { id: inserted[0].id, inserted: true };
}

async function applyDemoSlaTimestamps(
  ticketId: string,
  policyId: string | null,
  mode: 'breached' | 'warning',
): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL zentry.sla_internal = 'on'`);
    await client.query(`SET LOCAL zentry.ticket_internal = 'on'`);

    if (mode === 'breached') {
      await client.query(
        `UPDATE public.ticket_sla_timers
         SET due_at = now() - interval '22 minutes',
             warn_at = now() - interval '37 minutes',
             warned_at = now() - interval '37 minutes',
             breached_at = now() - interval '22 minutes',
             updated_at = now()
         WHERE ticket_id = $1 AND status = 'running'`,
        [ticketId],
      );
      await client.query(
        `UPDATE public.tickets
         SET sla_policy_id = COALESCE(sla_policy_id, $2),
             sla_state = 'running',
             sla_next_due_at = now() - interval '22 minutes',
             sla_next_warn_at = now() - interval '37 minutes',
             sla_next_metric = COALESCE(sla_next_metric, 'first_reply'),
             sla_breached_at = now() - interval '22 minutes'
         WHERE id = $1`,
        [ticketId, policyId],
      );
    } else {
      await client.query(
        `UPDATE public.ticket_sla_timers
         SET due_at = now() + interval '12 minutes',
             warn_at = now() - interval '18 minutes',
             warned_at = now() - interval '18 minutes',
             breached_at = NULL,
             updated_at = now()
         WHERE ticket_id = $1 AND status = 'running'`,
        [ticketId],
      );
      await client.query(
        `UPDATE public.tickets
         SET sla_policy_id = COALESCE(sla_policy_id, $2),
             sla_state = 'running',
             sla_next_due_at = now() + interval '12 minutes',
             sla_next_warn_at = now() - interval '18 minutes',
             sla_next_metric = COALESCE(sla_next_metric, 'first_reply'),
             sla_breached_at = NULL
         WHERE id = $1`,
        [ticketId, policyId],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.warn('[Demo Seeder] Could not adjust SLA timestamps:', (err as Error)?.message);
  } finally {
    client.release();
  }
}

/**
 * Populates a complete, idempotent set of demo Help Center, AI Agents, Trust Ladder policies,
 * SLA policies, CRM companies/deals/tasks/orders, and omnichannel Inbox/Ticket/Handoff records.
 */
export async function seedCompleteDemoWorkspace(
  workspaceId: string,
  actor: { userId: string; agentId: string; agentName: string },
): Promise<DemoSeedSummary> {
  await ensureSalesCrmTablesIfNeeded();

  const slaPolicyId = await ensureDemoSlaPolicy(workspaceId);
  const kb = await ensureDemoKnowledgeBase(workspaceId, actor.agentId);
  const ai = await ensureDemoAiAgentsAndPolicies(workspaceId, actor.agentId);

  let companiesCreated = 0;
  let visitorsUpserted = 0;
  let ordersCreated = 0;
  let dealsCreated = 0;
  let tasksCreated = 0;
  let conversationsCreated = 0;
  let ticketsCreated = 0;
  let handoffsCreated = 0;
  let approvalsCreated = 0;

  const companySpecs = [
    {
      name: 'Northstar Labs',
      domain: 'northstar-labs.io',
      industry: 'B2B SaaS',
      size: '51-200',
      website: 'https://northstar-labs.io',
      annualRevenueCents: 1850000000,
      notes: 'Active Pro customer evaluating multi-brand Enterprise expansion.',
    },
    {
      name: 'Crescent Retail Group',
      domain: 'crescent-retail.co',
      industry: 'E-Commerce',
      size: '201-500',
      website: 'https://crescent-retail.co',
      annualRevenueCents: 4200000000,
      notes: 'High-volume WhatsApp & Instagram commerce account.',
    },
    {
      name: 'Karachi Fintech Stack',
      domain: 'karachifintech.pk',
      industry: 'Fintech',
      size: '11-50',
      website: 'https://karachifintech.pk',
      annualRevenueCents: 640000000,
      notes: 'Requires multilingual Roman Urdu & English support routing.',
    },
  ];

  const companyIds = new Map<string, string>();
  for (const co of companySpecs) {
    const existingCo = await queryRows<{ id: string }>(
      `SELECT id FROM public.crm_companies WHERE workspace_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [workspaceId, co.name],
    );
    if (existingCo[0]?.id) {
      companyIds.set(co.name, existingCo[0].id);
    } else {
      const insertedCo = await queryRows<{ id: string }>(
        `INSERT INTO public.crm_companies (
           workspace_id, name, domain, industry, size, website, annual_revenue_cents, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [workspaceId, co.name, co.domain, co.industry, co.size, co.website, co.annualRevenueCents, co.notes],
      );
      if (insertedCo[0]?.id) {
        companyIds.set(co.name, insertedCo[0].id);
        companiesCreated += 1;
      }
    }
  }

  const personaSpecs = [
    {
      key: 'vip_pro',
      name: 'Zainab Malik',
      email: 'zainab.malik@northstar-labs.io',
      phone: '+1 415 555 0148',
      company: 'Northstar Labs',
      segment: 'vip',
      tags: ['vip', 'pro-plan', 'enterprise-upsell'],
      plan: 'pro',
      city: 'San Francisco',
      country: 'United States',
      language: 'en-US',
      channel: 'email' as const,
      channelUserId: 'zainab.malik@northstar-labs.io',
    },
    {
      key: 'frustrated_buyer',
      name: 'Bilal Siddiqui',
      email: 'bilal.siddiqui@crescent-retail.co',
      phone: '+92 300 555 0192',
      company: 'Crescent Retail Group',
      segment: 'at_risk',
      tags: ['urgent', 'checkout-webhook', 'whatsapp'],
      plan: 'business',
      city: 'Lahore',
      country: 'Pakistan',
      language: 'en-PK',
      channel: 'whatsapp' as const,
      channelUserId: '+923005550192',
    },
    {
      key: 'new_visitor',
      name: 'Amina Tariq',
      email: 'amina.tariq@demo-prospect.io',
      phone: '+1 646 555 0114',
      company: 'Karachi Fintech Stack',
      segment: 'lead',
      tags: ['pricing', 'trial', 'web'],
      plan: 'free',
      city: 'New York',
      country: 'United States',
      language: 'en-US',
      channel: 'web' as const,
      channelUserId: null,
    },
    {
      key: 'instagram_creator',
      name: 'Sana Farooq',
      email: 'sana.farooq@studio-nova.co',
      phone: '+44 7700 900412',
      company: 'Crescent Retail Group',
      segment: 'active',
      tags: ['instagram', 'social-dm'],
      plan: 'pro',
      city: 'London',
      country: 'United Kingdom',
      language: 'en-GB',
      channel: 'instagram' as const,
      channelUserId: 'ig_sana_farooq',
    },
    {
      key: 'enterprise_buyer',
      name: 'Omar Hassan',
      email: 'omar.hassan@northstar-labs.io',
      phone: '+1 415 555 0177',
      company: 'Northstar Labs',
      segment: 'enterprise',
      tags: ['100-seats', 'sso', 'adk-qualified'],
      plan: 'enterprise',
      city: 'Austin',
      country: 'United States',
      language: 'en-US',
      channel: 'web' as const,
      channelUserId: null,
    },
    {
      key: 'api_ops',
      name: 'Nadia Khan',
      email: 'nadia.khan@karachifintech.pk',
      phone: '+92 321 555 0133',
      company: 'Karachi Fintech Stack',
      segment: 'active',
      tags: ['webhooks', 'api', 'email'],
      plan: 'business',
      city: 'Karachi',
      country: 'Pakistan',
      language: 'en-PK',
      channel: 'email' as const,
      channelUserId: 'nadia.khan@karachifintech.pk',
    },
  ];

  const visitorIds = new Map<string, string>();
  for (const spec of personaSpecs) {
    const res = await upsertVisitor({ workspaceId, ...spec });
    visitorIds.set(spec.key, res.id);
    visitorsUpserted += 1;
  }

  const orderSpecs = [
    {
      visitorKey: 'vip_pro',
      orderNumber: 'ORD-9421',
      status: 'paid',
      currency: 'USD',
      totalCents: 48000,
      itemsSummary: 'Orbat AI Pro Annual Renewal (Duplicate Invoice Charge)',
    },
    {
      visitorKey: 'frustrated_buyer',
      orderNumber: 'ORD-9388',
      status: 'fulfilled',
      currency: 'USD',
      totalCents: 19900,
      itemsSummary: 'Orbat AI Business Monthly · Priority SLA Add-on',
    },
    {
      visitorKey: 'enterprise_buyer',
      orderNumber: 'ORD-9450',
      status: 'pending',
      currency: 'USD',
      totalCents: 240000,
      itemsSummary: 'Enterprise Expansion Sandbox · 100 Seats + SAML SSO',
    },
  ];

  for (const ord of orderSpecs) {
    const vId = visitorIds.get(ord.visitorKey);
    if (!vId) continue;
    const exists = await queryRows<{ id: string }>(
      `SELECT id FROM public.customer_orders WHERE workspace_id = $1 AND order_number = $2 LIMIT 1`,
      [workspaceId, ord.orderNumber],
    );
    if (!exists[0]?.id) {
      await query(
        `INSERT INTO public.customer_orders (
           workspace_id, visitor_id, order_number, status, currency, total_cents, items_summary, external_source
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')`,
        [workspaceId, vId, ord.orderNumber, ord.status, ord.currency, ord.totalCents, ord.itemsSummary],
      );
      ordersCreated += 1;
    }
  }

  const dealSpecs = [
    {
      title: 'Northstar Labs · 100-Seat Enterprise Contract',
      stage: 'proposal',
      valueCents: 2400000,
      probability: 75,
      visitorKey: 'enterprise_buyer',
      companyName: 'Northstar Labs',
      notes: 'Security review completed; final MSA terms under procurement review.',
    },
    {
      title: 'Crescent Retail · Omnichannel WhatsApp Expansion',
      stage: 'demo',
      valueCents: 960000,
      probability: 55,
      visitorKey: 'frustrated_buyer',
      companyName: 'Crescent Retail Group',
      notes: 'Evaluating Meta Embedded Signup across 3 seasonal storefronts.',
    },
    {
      title: 'Karachi Fintech · Bilingual AI Support Rollout',
      stage: 'qualified',
      valueCents: 480000,
      probability: 40,
      visitorKey: 'new_visitor',
      companyName: 'Karachi Fintech Stack',
      notes: 'Requires English + Roman Urdu routing on Web and Email.',
    },
    {
      title: 'Northstar Labs · AI Copilot Add-On',
      stage: 'won',
      valueCents: 360000,
      probability: 100,
      visitorKey: 'vip_pro',
      companyName: 'Northstar Labs',
      notes: 'Signed 12-month expansion following Pro trial success.',
    },
    {
      title: 'Crescent Retail · Instagram Influencer Desk',
      stage: 'lead',
      valueCents: 280000,
      probability: 20,
      visitorKey: 'instagram_creator',
      companyName: 'Crescent Retail Group',
      notes: 'Inbound DM inquiry asking about automated order lookups.',
    },
  ];

  let firstDealId: string | null = null;
  for (const deal of dealSpecs) {
    const existingDeal = await queryRows<{ id: string }>(
      `SELECT id FROM public.crm_deals WHERE workspace_id = $1 AND LOWER(title) = LOWER($2) LIMIT 1`,
      [workspaceId, deal.title],
    );
    if (existingDeal[0]?.id) {
      if (!firstDealId) firstDealId = existingDeal[0].id;
      continue;
    }
    const insertedDeal = await queryRows<{ id: string }>(
      `INSERT INTO public.crm_deals (
         workspace_id, visitor_id, company_id, title, stage, value_cents, currency,
         probability, expected_close_date, owner_id, notes, closed_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, 'USD', $7, (CURRENT_DATE + interval '21 days')::date, $8, $9,
         CASE WHEN $5 = 'won' THEN now() ELSE NULL END
       )
       RETURNING id`,
      [
        workspaceId,
        visitorIds.get(deal.visitorKey) ?? null,
        companyIds.get(deal.companyName) ?? null,
        deal.title,
        deal.stage,
        deal.valueCents,
        deal.probability,
        actor.agentId,
        deal.notes,
      ],
    );
    if (insertedDeal[0]?.id) {
      if (!firstDealId) firstDealId = insertedDeal[0].id;
      dealsCreated += 1;
    }
  }

  const taskSpecs = [
    {
      title: 'Verify double charge refund #ORD-9421 for Northstar Labs',
      visitorKey: 'vip_pro',
      dealId: firstDealId,
      kind: 'follow_up',
      priority: 'high',
      dueHours: 4,
      description: 'Confirm Stripe charge duplication and approve paused LangGraph refund action.',
    },
    {
      title: 'Send 100-seat Enterprise SAML + SLA pricing sheet',
      visitorKey: 'enterprise_buyer',
      dealId: firstDealId,
      kind: 'email',
      priority: 'high',
      dueHours: 24,
      description: 'Follow up with custom annual discount schedule.',
    },
    {
      title: 'Call Bilal at Crescent Retail about webhook 502 spike',
      visitorKey: 'frustrated_buyer',
      dealId: null,
      kind: 'call',
      priority: 'normal',
      dueHours: 6,
      description: 'Walk through TLS handshake logs and retry configuration.',
    },
  ];

  for (const task of taskSpecs) {
    const exists = await queryRows<{ id: string }>(
      `SELECT id FROM public.crm_tasks WHERE workspace_id = $1 AND LOWER(title) = LOWER($2) LIMIT 1`,
      [workspaceId, task.title],
    );
    if (exists[0]?.id) continue;
    await query(
      `INSERT INTO public.crm_tasks (
         workspace_id, visitor_id, deal_id, title, description, kind, priority, status, due_at, assignee_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', now() + make_interval(hours => $8), $9)`,
      [
        workspaceId,
        visitorIds.get(task.visitorKey) ?? null,
        task.dealId,
        task.title,
        task.description,
        task.kind,
        task.priority,
        task.dueHours,
        actor.agentId,
      ],
    );
    tasksCreated += 1;
  }

  interface DemoConversationSpec {
    seedKey: string;
    visitorKey: string;
    channel: DemoChannel;
    channelUserId: string | null;
    subject: string;
    convStatus: 'open' | 'pending' | 'closed';
    ticketStatus: 'open' | 'pending' | 'solved';
    priority: 'urgent' | 'high' | 'normal' | 'low';
    aiMode: 'autopilot' | 'copilot';
    handoffStatus: 'bot_active' | 'waiting_for_agent' | 'offline_queued' | 'handoff_offered' | 'agent_active' | 'resolved';
    handoffReason: string | null;
    handoffSummary: string | null;
    assignedAgentId: string | null;
    slaMode?: 'breached' | 'warning';
    seedApproval?: boolean;
    tags: string[];
    messages: Array<{
      senderType: 'visitor' | 'ai' | 'agent';
      isInternal?: boolean;
      content: string;
      metadata?: Record<string, unknown>;
    }>;
  }

  const conversationSpecs: DemoConversationSpec[] = [
    {
      seedKey: 'demo_wa_outage_breach',
      visitorKey: 'frustrated_buyer',
      channel: 'whatsapp',
      channelUserId: '+923005550192',
      subject: '[Urgent] Checkout webhook returning HTTP 502 on WhatsApp orders',
      convStatus: 'open',
      ticketStatus: 'open',
      priority: 'urgent',
      aiMode: 'copilot',
      handoffStatus: 'waiting_for_agent',
      handoffReason: 'Urgent production checkout failure — human supervisor requested',
      handoffSummary: 'Crescent Retail reports 502 errors on checkout webhooks; needs immediate engineer escalation.',
      assignedAgentId: null,
      slaMode: 'breached',
      tags: ['urgent', 'webhook', 'whatsapp'],
      messages: [
        {
          senderType: 'visitor',
          content:
            'Hi, our checkout webhook has been returning HTTP 502 for the last 20 minutes and WhatsApp order confirmations are stalling. I need a human engineer ASAP!',
        },
        {
          senderType: 'ai',
          isInternal: true,
          content:
            'Escalated to Human Handoff Queue: high urgency + explicit request for human engineering support on live checkout webhooks.',
          metadata: { is_handover: true, demo_seed: 'demo_wa_outage_breach' },
        },
      ],
    },
    {
      seedKey: 'demo_email_refund_langgraph',
      visitorKey: 'vip_pro',
      channel: 'email',
      channelUserId: 'zainab.malik@northstar-labs.io',
      subject: 'Duplicate $480 annual invoice charge on ORD-9421 — Refund Request',
      convStatus: 'open',
      ticketStatus: 'open',
      priority: 'high',
      aiMode: 'autopilot',
      handoffStatus: 'waiting_for_agent',
      handoffReason: 'langgraph_approval: Refund ($480 exceeds $250 autonomy cap)',
      handoffSummary: 'Customer billed twice for Pro Annual renewal (#ORD-9421). LangGraph paused refund draft for admin approval.',
      assignedAgentId: null,
      slaMode: 'warning',
      seedApproval: true,
      tags: ['refund', 'billing', 'vip'],
      messages: [
        {
          senderType: 'visitor',
          content:
            'Hi billing team, we noticed a duplicate $480 charge on invoice ORD-9421 for our Pro workspace renewal. Could you please process a full refund of the duplicate charge?',
        },
      ],
    },
    {
      seedKey: 'demo_ig_pricing_offered',
      visitorKey: 'instagram_creator',
      channel: 'instagram',
      channelUserId: 'ig_sana_farooq',
      subject: 'Instagram DM: Migrating 8 agents + order lookup setup',
      convStatus: 'open',
      ticketStatus: 'open',
      priority: 'normal',
      aiMode: 'autopilot',
      handoffStatus: 'handoff_offered',
      handoffReason: 'Offered specialist onboarding consultation for multi-brand Instagram setup',
      handoffSummary: 'AI shared Pro tier specs and offered a specialist onboarding walkthrough.',
      assignedAgentId: null,
      tags: ['instagram', 'onboarding'],
      messages: [
        {
          senderType: 'visitor',
          content: 'Hey! Does the Pro plan support Instagram DMs for an 8-person team and show past orders?',
        },
        {
          senderType: 'ai',
          content:
            'Yes! The **Pro plan ($79/mo)** supports up to 10 agents with native WhatsApp Business and Instagram DMs plus Customer 360 order context. Would you like me to connect an onboarding specialist to walk through Meta setup?',
          metadata: {
            citations: [{ title: 'Orbat AI Plans & Pricing Tiers', slug: 'demo-orbat-plans-pricing' }],
          },
        },
      ],
    },
    {
      seedKey: 'demo_web_pricing_resolved',
      visitorKey: 'new_visitor',
      channel: 'web',
      channelUserId: null,
      subject: 'Plan comparison: Starter vs Pro features',
      convStatus: 'closed',
      ticketStatus: 'solved',
      priority: 'normal',
      aiMode: 'autopilot',
      handoffStatus: 'resolved',
      handoffReason: null,
      handoffSummary: 'Answered Starter vs Pro pricing & features with Knowledge Base citations.',
      assignedAgentId: null,
      tags: ['pricing', 'ai-resolved'],
      messages: [
        {
          senderType: 'visitor',
          content: 'What is the difference between Starter and Pro if we need AI Copilot and WhatsApp?',
        },
        {
          senderType: 'ai',
          content:
            'Starter ($29/mo) includes 2 agents on Web & Email. Upgrading to **Pro ($79/mo)** unlocks up to 10 agents, **WhatsApp Business & Instagram DMs**, **AI Copilot**, **Trust Ladder guardrails**, and 2,500 monthly AI resolutions.',
          metadata: {
            citations: [{ title: 'Orbat AI Plans & Pricing Tiers', slug: 'demo-orbat-plans-pricing' }],
          },
        },
      ],
    },
    {
      seedKey: 'demo_web_enterprise_deal',
      visitorKey: 'enterprise_buyer',
      channel: 'web',
      channelUserId: null,
      subject: 'Enterprise RFP: 100 seats + SAML SSO + Custom Annual Contract',
      convStatus: 'open',
      ticketStatus: 'open',
      priority: 'high',
      aiMode: 'copilot',
      handoffStatus: 'agent_active',
      handoffReason: 'Enterprise 100-seat quote staged by Atlas ADK into CRM Deals',
      handoffSummary: 'Enterprise Sales ADK qualified 100 seats ($24,000 ARR) and handed thread to account owner.',
      assignedAgentId: actor.agentId,
      tags: ['enterprise', 'adk-deal'],
      messages: [
        {
          senderType: 'visitor',
          content: 'We are standardizing 100 support seats across 3 regions with SAML SSO. Can you send an annual Enterprise quote?',
        },
        {
          senderType: 'ai',
          content:
            'Thanks Omar! I have staged your 100-seat Enterprise qualification in our CRM pipeline and looped in an account executive to finalize custom annual pricing and SAML terms.',
          metadata: { engine: 'adk', agent_name: 'Atlas · Enterprise Sales' },
        },
        {
          senderType: 'agent',
          content:
            'Hi Omar — I just sent over our SOC2 + SAML security packet and a 100-seat annual proposal draft. Happy to review any redlines today.',
        },
      ],
    },
    {
      seedKey: 'demo_email_offline_pending',
      visitorKey: 'api_ops',
      channel: 'email',
      channelUserId: 'nadia.khan@karachifintech.pk',
      subject: 'Webhook IP allowlist & signature verification header format',
      convStatus: 'pending',
      ticketStatus: 'pending',
      priority: 'normal',
      aiMode: 'copilot',
      handoffStatus: 'offline_queued',
      handoffReason: 'Queued after-hours API security verification request',
      handoffSummary: 'Customer awaiting engineering verification of outbound webhook signing headers.',
      assignedAgentId: null,
      tags: ['api', 'webhooks'],
      messages: [
        {
          senderType: 'visitor',
          content: 'Can you confirm the HMAC-SHA256 signature header name and retry intervals for outbound webhook events?',
        },
        {
          senderType: 'ai',
          isInternal: true,
          content: 'Draft note: Outbound webhooks retry 5 times over 30 minutes per Order Lookup & Webhook Diagnostics.',
          metadata: { is_handover: true },
        },
      ],
    },
  ];

  for (const spec of conversationSpecs) {
    const existingConv = await queryRows<{ id: string }>(
      `SELECT id FROM public.conversations
       WHERE workspace_id = $1 AND channel_metadata->>'demo_seed' = $2
       LIMIT 1`,
      [workspaceId, spec.seedKey],
    );
    if (existingConv[0]?.id) continue;

    const visitorId = visitorIds.get(spec.visitorKey);
    if (!visitorId) continue;

    const initialConvStatus = spec.convStatus === 'closed' ? 'open' : spec.convStatus;
    const insertedConv = await queryRows<{ id: string; current_ticket_id: string | null }>(
      `INSERT INTO public.conversations (
         workspace_id, visitor_id, assigned_agent_id, status, priority,
         channel, channel_user_id, channel_last_inbound_at, channel_metadata,
         ai_mode, ai_enabled, handoff_status, handoff_reason, handoff_summary,
         handoff_requested_at, handoff_offered_at, ai_needs_attention_at,
         tags
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, now(), $8::jsonb,
         $9, true, $10, $11, $12,
         CASE WHEN $10 IN ('waiting_for_agent', 'offline_queued') THEN now() ELSE NULL END,
         CASE WHEN $10 = 'handoff_offered' THEN now() ELSE NULL END,
         CASE WHEN $10 IN ('waiting_for_agent', 'offline_queued') THEN now() ELSE NULL END,
         $13::text[]
       )
       RETURNING id, current_ticket_id`,
      [
        workspaceId,
        visitorId,
        spec.assignedAgentId,
        initialConvStatus,
        spec.priority,
        spec.channel,
        spec.channelUserId,
        JSON.stringify({ ticket_subject: spec.subject, demo_seed: spec.seedKey }),
        spec.aiMode,
        spec.handoffStatus,
        spec.handoffReason,
        spec.handoffSummary,
        spec.tags,
      ],
    );

    const conv = insertedConv[0];
    if (!conv?.id) continue;
    conversationsCreated += 1;

    if (spec.handoffStatus === 'waiting_for_agent' || spec.handoffStatus === 'offline_queued' || spec.handoffStatus === 'handoff_offered') {
      handoffsCreated += 1;
    }

    for (const msg of spec.messages) {
      await query(
        `INSERT INTO public.messages (
           conversation_id, sender_type, sender_id, content, is_internal, metadata, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
        [
          conv.id,
          msg.senderType,
          msg.senderType === 'visitor' ? visitorId : msg.senderType === 'agent' ? actor.agentId : null,
          msg.content,
          Boolean(msg.isInternal),
          JSON.stringify(msg.metadata || {}),
        ],
      );
    }

    if (conv.current_ticket_id) {
      ticketsCreated += 1;
      await query(
        `UPDATE public.tickets
         SET subject = $2,
             status = $3,
             priority = $4,
             tags = $5::text[],
             assignee_id = COALESCE($6, assignee_id),
             csat_rating = CASE WHEN $3 = 'solved' THEN 'good' ELSE csat_rating END,
             csat_rated_at = CASE WHEN $3 = 'solved' THEN now() ELSE csat_rated_at END
         WHERE id = $1 AND workspace_id = $7`,
        [
          conv.current_ticket_id,
          spec.subject,
          spec.ticketStatus,
          spec.priority,
          spec.tags,
          spec.assignedAgentId,
          workspaceId,
        ],
      );

      if (spec.slaMode) {
        await applyDemoSlaTimestamps(conv.current_ticket_id, slaPolicyId, spec.slaMode);
      }
    }

    if (spec.convStatus === 'closed') {
      await query(
        `UPDATE public.conversations
         SET status = 'closed',
             closed_at = now(),
             last_resolved_at = now(),
             updated_at = now()
         WHERE id = $1 AND workspace_id = $2`,
        [conv.id, workspaceId],
      );
    }

    if (spec.seedApproval) {
      const threadId = `demo-lg-${conv.id.slice(0, 8)}`;
      const pendingActions = [
        {
          toolName: 'crm_create_followup_task',
          summary: 'Issue full $480 duplicate-charge refund for order ORD-9421 and notify Zainab Malik',
          args: { orderNumber: 'ORD-9421', amountCents: 48000, currency: 'USD', reason: 'Duplicate annual renewal charge' },
        },
      ];
      const approvalPayload = {
        topic: 'Refund',
        autonomyLevel: 2,
        reason: 'Trust Ladder Level 2 guardrail: financial refunds require admin approval before dispatch.',
        draftReply:
          'Hi Zainab, I confirmed the duplicate $480 charge on invoice #ORD-9421 and have queued your full refund back to the original payment method (3–5 business days).',
        pendingActions,
      };
      const persistedRunId = await persistAgentRun({
        workspaceId,
        conversationId: conv.id,
        agentId: ai.primaryAgent.id,
        engineType: 'langgraph',
        threadId,
        status: 'paused_approval',
        topic: approvalPayload.topic,
        pendingAction: {
          reason: approvalPayload.reason,
          pendingActions,
          shouldHandover: true,
          handoverReason: approvalPayload.reason,
        },
        draftReply: approvalPayload.draftReply,
        trace: [],
      });
      const runId = persistedRunId ?? crypto.randomUUID();
      await query(
        `INSERT INTO public.messages (
           conversation_id, sender_type, sender_id, content, is_internal, metadata, created_at
         )
         VALUES ($1, 'ai', NULL, $2, true, $3::jsonb, now())`,
        [
          conv.id,
          'LangGraph paused for approval: Refund guardrail triggered for $480 duplicate charge (#ORD-9421).',
          JSON.stringify({
            is_handover: true,
            langgraph_approval: {
              runId,
              threadId,
              agentId: ai.primaryAgent.id,
              agentName: ai.primaryAgent.name,
              topic: approvalPayload.topic,
              autonomyLevel: 2,
              reason: approvalPayload.reason,
              draftReply: approvalPayload.draftReply,
              pendingActions,
              status: 'pending',
              resolvedBy: null,
              resolvedAt: null,
            },
          }),
        ],
      );
      approvalsCreated += 1;
    }
  }

  return {
    sectionsCreated: kb.sectionsCreated,
    articlesCreated: kb.articlesCreated,
    chunksSynced: kb.chunksSynced,
    agentsConfigured: ai.agentsConfigured,
    companiesCreated,
    visitorsUpserted,
    ordersCreated,
    dealsCreated,
    tasksCreated,
    conversationsCreated,
    ticketsCreated,
    handoffsCreated,
    approvalsCreated,
    embeddingMode: kb.embeddingMode,
  };
}

/**
 * Simulates an inbound visitor message on Web, WhatsApp, Email, or Instagram,
 * persists it in Postgres with an open messaging window, and executes the live
 * /api/ai/auto-respond pipeline (Hybrid / LangGraph / Google ADK / Trust Ladder).
 */
export async function simulateCustomerInboundChat(input: {
  workspaceId: string;
  userId: string;
  agentId: string;
  channel: DemoChannel;
  persona: DemoPersona;
  scenarioKey?: DemoScenarioKey | 'custom';
  message: string;
  conversationId?: string | null;
}): Promise<SimulateChatResult> {
  const cleanMessage = normalizeSimulateMessage(input.message);
  if (!cleanMessage) {
    return {
      success: false,
      conversationId: '',
      inboundMessageId: '',
      ticketNumber: null,
      channel: input.channel,
      persona: input.persona,
      visitorName: getDemoPersonaOption(input.persona).defaultName,
      visitorEmail: getDemoPersonaOption(input.persona).defaultEmail,
      aiReplied: false,
      aiReplyText: null,
      aiEngine: null,
      aiAgentName: null,
      status: 'no_reply',
      reason: 'Enter a customer message to simulate.',
      handoffStatus: null,
      approvalId: null,
      runId: null,
      citedArticles: [],
      createdDeal: null,
      inboxHref: '/app/inbox',
      handoffHref: '/app/handoff',
      error: 'Enter a customer message to simulate.',
    };
  }

  await ensureSalesCrmTablesIfNeeded();

  // Ensure minimum KB + AI readiness even if the admin opens Simulator before clicking Seed.
  const kbCheck = await queryRows<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM public.articles WHERE workspace_id = $1 AND status = 'published'`,
    [input.workspaceId],
  );
  if (Number(kbCheck[0]?.cnt || 0) === 0) {
    await ensureDemoKnowledgeBase(input.workspaceId, input.agentId);
  }
  await ensureDemoAiAgentsAndPolicies(input.workspaceId, input.agentId);

  const personaMeta = getDemoPersonaOption(input.persona) || DEMO_PERSONAS[0];
  const scenarioPreset =
    input.scenarioKey && input.scenarioKey !== 'custom' ? getDemoScenarioPreset(input.scenarioKey) : null;

  const channelHandleMap: Record<DemoChannel, string | null> = {
    web: null,
    whatsapp: input.persona === 'frustrated_buyer' ? '+923005550192' : '+14155550148',
    email: personaMeta.defaultEmail,
    instagram: `ig_${input.persona}`,
  };

  const visitorRes = await upsertVisitor({
    workspaceId: input.workspaceId,
    name: personaMeta.defaultName,
    email: personaMeta.defaultEmail,
    phone: input.persona === 'frustrated_buyer' ? '+92 300 555 0192' : '+1 415 555 0148',
    company:
      input.persona === 'vip_pro'
        ? 'Northstar Labs'
        : input.persona === 'frustrated_buyer'
          ? 'Crescent Retail Group'
          : 'Karachi Fintech Stack',
    segment: input.persona === 'vip_pro' ? 'vip' : input.persona === 'frustrated_buyer' ? 'at_risk' : 'lead',
    tags: ['demo-simulator', input.channel, input.persona],
    plan: personaMeta.planTier,
    city: input.persona === 'frustrated_buyer' ? 'Lahore' : 'San Francisco',
    country: input.persona === 'frustrated_buyer' ? 'Pakistan' : 'United States',
    language: input.scenarioKey === 'roman_urdu' ? 'ur-Latn' : 'en-US',
    channel: input.channel,
    channelUserId: channelHandleMap[input.channel],
  });

  if (input.persona !== 'new_visitor') {
    const hasOrder = await queryRows<{ id: string }>(
      `SELECT id FROM public.customer_orders WHERE workspace_id = $1 AND visitor_id = $2 LIMIT 1`,
      [input.workspaceId, visitorRes.id],
    );
    if (!hasOrder[0]?.id) {
      await query(
        `INSERT INTO public.customer_orders (
           workspace_id, visitor_id, order_number, status, currency, total_cents, items_summary, external_source
         )
         VALUES ($1, $2, 'ORD-9421', 'paid', 'USD', 48000, 'Orbat AI Pro Annual Subscription', 'manual')`,
        [input.workspaceId, visitorRes.id],
      );
    }
  }

  let conversationId = (input.conversationId || '').trim();
  const subject = scenarioPreset
    ? `[Sim · ${input.channel.toUpperCase()}] ${scenarioPreset.label}`
    : `[Sim · ${input.channel.toUpperCase()}] ${cleanMessage.slice(0, 64)}`;

  if (conversationId) {
    const ownedConv = await queryRows<{ id: string }>(
      `SELECT id FROM public.conversations WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [conversationId, input.workspaceId],
    );
    if (!ownedConv[0]?.id) {
      conversationId = '';
    } else {
      await query(
        `UPDATE public.conversations
         SET channel = $3,
             channel_last_inbound_at = now(),
             status = 'open',
             ai_mode = 'autopilot',
             ai_enabled = true,
             handoff_status = 'bot_active',
             updated_at = now()
         WHERE id = $1 AND workspace_id = $2`,
        [conversationId, input.workspaceId, input.channel],
      );
    }
  }

  if (!conversationId) {
    const insertedConv = await queryRows<{ id: string }>(
      `INSERT INTO public.conversations (
         workspace_id, visitor_id, status, priority, channel, channel_user_id,
         channel_last_inbound_at, channel_metadata, ai_mode, ai_enabled, handoff_status, tags
       )
       VALUES (
         $1, $2, 'open', $3, $4, $5, now(), $6::jsonb, 'autopilot', true, 'bot_active', $7::text[]
       )
       RETURNING id`,
      [
        input.workspaceId,
        visitorRes.id,
        input.persona === 'frustrated_buyer' ? 'high' : 'normal',
        input.channel,
        channelHandleMap[input.channel],
        JSON.stringify({
          ticket_subject: subject,
          demo_simulator: true,
          scenario_key: input.scenarioKey ?? 'custom',
          persona: input.persona,
        }),
        ['demo-simulator', input.channel],
      ],
    );
    conversationId = insertedConv[0]?.id || '';
  }

  const beforeRunAt = new Date().toISOString();

  const insertedMsg = await queryRows<{ id: string; created_at: string }>(
    `INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, is_internal, metadata)
     VALUES ($1, 'visitor', $2, $3, false, $4::jsonb)
     RETURNING id, created_at::text`,
    [
      conversationId,
      visitorRes.id,
      cleanMessage,
      JSON.stringify({ demo_simulator: true, channel: input.channel, persona: input.persona }),
    ],
  );
  const inboundMessageId = insertedMsg[0]?.id || '';

  let autoRespondJson: Record<string, unknown> = {};
  try {
    const reqHeaders = await headers();
    const internalSecret =
      process.env.INTERNAL_API_SECRET || process.env.AI_INTERNAL_SECRET || process.env.CRON_SECRET || '';
    const cookieHeader = reqHeaders.get('cookie');
    const nextReq = new NextRequest('http://internal/api/ai/auto-respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalSecret ? { 'x-internal-secret': internalSecret } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        workspace_id: input.workspaceId,
        message_id: inboundMessageId,
      }),
    });

    const response = await autoRespondPost(nextReq);
    autoRespondJson = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (err) {
    autoRespondJson = { error: (err as Error)?.message || 'Auto-respond invocation failed.' };
  }

  const { hasAgentRunsTable } = await getDemoOptionalSchemaSupport();

  const [convRows, newMsgRows, runRows, dealRows] = await Promise.all([
    queryRows<{ handoff_status: string | null; handoff_reason: string | null; ticket_number: number | null }>(
      `SELECT c.handoff_status, c.handoff_reason, t.number AS ticket_number
       FROM public.conversations c
       LEFT JOIN public.tickets t ON t.id = c.current_ticket_id
       WHERE c.id = $1 AND c.workspace_id = $2
       LIMIT 1`,
      [conversationId, input.workspaceId],
    ),
    queryRows<{
      id: string;
      sender_type: string;
      is_internal: boolean;
      content: string;
      metadata: Record<string, unknown> | null;
    }>(
      `SELECT id, sender_type, COALESCE(is_internal, false) AS is_internal, content, metadata
       FROM public.messages
       WHERE conversation_id = $1 AND id <> $2 AND created_at >= $3::timestamptz
       ORDER BY created_at DESC`,
      [conversationId, inboundMessageId, beforeRunAt],
    ),
    hasAgentRunsTable
      ? queryRows<{
          id: string;
          engine_type: string | null;
          status: string;
          agent_name: string | null;
        }>(
          `SELECT r.id, r.engine_type, r.status, a.name AS agent_name
           FROM public.ai_agent_runs r
           LEFT JOIN public.ai_agents a ON a.id = r.agent_id
           WHERE r.conversation_id = $1 AND r.workspace_id = $2
           ORDER BY r.created_at DESC
           LIMIT 1`,
          [conversationId, input.workspaceId],
        ).catch(() => [])
      : Promise.resolve([]),
    queryRows<{ id: string; title: string; stage: string; value_cents: string | number }>(
      `SELECT id, title, stage, value_cents
       FROM public.crm_deals
       WHERE workspace_id = $1 AND visitor_id = $2 AND created_at >= $3::timestamptz
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.workspaceId, visitorRes.id, beforeRunAt],
    ),
  ]);

  const conv = convRows[0];
  const latestRun = runRows[0];
  const publicAiMsg = newMsgRows.find((m) => m.sender_type === 'ai' && !m.is_internal) || null;
  const approvalMsg = newMsgRows.find(
    (m) => Boolean(m.metadata?.langgraph_approval && typeof m.metadata.langgraph_approval === 'object'),
  );
  const approvalMeta = approvalMsg?.metadata?.langgraph_approval as Record<string, unknown> | undefined;

  const citedArticles: Array<{ title: string; slug: string }> = [];
  const rawCitations = publicAiMsg?.metadata?.citations;
  if (Array.isArray(rawCitations)) {
    for (const c of rawCitations) {
      if (c && typeof c === 'object') {
        const rec = c as Record<string, unknown>;
        const title = typeof rec.title === 'string' ? rec.title : '';
        const slug = typeof rec.slug === 'string' ? rec.slug : '';
        if (title) citedArticles.push({ title, slug });
      }
    }
  }

  let status: SimulateChatResult['status'] = 'no_reply';
  if (latestRun?.status === 'paused_approval' || approvalMeta?.status === 'pending' || autoRespondJson.pausedForApproval) {
    status = 'paused_approval';
  } else if (conv?.handoff_status === 'waiting_for_agent' || conv?.handoff_status === 'offline_queued') {
    status = 'handoff_queued';
  } else if (conv?.handoff_status === 'handoff_offered') {
    status = 'handoff_offered';
  } else if (publicAiMsg) {
    status = 'replied';
  } else if (autoRespondJson.error || autoRespondJson.code || autoRespondJson.reason) {
    status = 'blocked_or_skipped';
  }

  const aiReplyText =
    publicAiMsg?.content ||
    (typeof approvalMeta?.draftReply === 'string' && approvalMeta.draftReply) ||
    (typeof autoRespondJson.reply === 'string' ? autoRespondJson.reply : null);

  const createdDeal = dealRows[0]
    ? {
        id: dealRows[0].id,
        title: dealRows[0].title,
        stage: dealRows[0].stage,
        amount: Math.round(Number(dealRows[0].value_cents || 0) / 100),
      }
    : null;

  return {
    success: !autoRespondJson.error || Boolean(publicAiMsg || status === 'paused_approval' || status === 'handoff_queued'),
    conversationId,
    inboundMessageId,
    ticketNumber: conv?.ticket_number ? Number(conv.ticket_number) : null,
    channel: input.channel,
    persona: input.persona,
    visitorName: personaMeta.defaultName,
    visitorEmail: personaMeta.defaultEmail,
    aiReplied: Boolean(publicAiMsg),
    aiReplyText,
    aiEngine:
      latestRun?.engine_type ||
      (typeof publicAiMsg?.metadata?.engine === 'string' ? publicAiMsg.metadata.engine : null) ||
      (typeof autoRespondJson.engine === 'string' ? autoRespondJson.engine : null),
    aiAgentName:
      latestRun?.agent_name ||
      (typeof approvalMeta?.agentName === 'string' ? approvalMeta.agentName : null) ||
      (typeof autoRespondJson.agentName === 'string' ? autoRespondJson.agentName : null),
    status,
    reason:
      (typeof approvalMeta?.reason === 'string' ? approvalMeta.reason : null) ||
      conv?.handoff_reason ||
      (typeof autoRespondJson.reason === 'string' ? autoRespondJson.reason : null) ||
      (typeof autoRespondJson.error === 'string' ? autoRespondJson.error : null),
    handoffStatus: conv?.handoff_status ?? null,
    approvalId: typeof approvalMeta?.runId === 'string' ? approvalMeta.runId : latestRun?.id ?? null,
    runId: latestRun?.id ?? null,
    citedArticles,
    createdDeal,
    inboxHref: conversationId ? `/app/inbox?c=${encodeURIComponent(conversationId)}` : '/app/inbox',
    handoffHref: '/app/handoff',
    ...(typeof autoRespondJson.error === 'string' ? { error: autoRespondJson.error } : {}),
  };
}
