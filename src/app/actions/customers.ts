'use server';

import { queryRows } from '@/lib/db';
import { userError } from '@/lib/errors/user-error';
import { isValidEmail } from '@/lib/email/smtp';
import { getWorkspaceAccess } from '@/lib/team/access';
import { roleCan } from '@/lib/team/permissions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BuiltInSegmentSlug = 'all' | 'vip' | 'churn_risk' | 'new_month' | 'leads' | 'wholesale';
export type CustomerSortField = 'last_seen_at' | 'name' | 'lifetime_value_cents' | 'orders_count' | 'first_seen_at';

export interface CustomerRecord {
  id: string;
  workspace_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  segment: string;
  tags: string[];
  plan: string | null;
  ip_location_city: string | null;
  ip_location_country: string | null;
  timezone: string | null;
  language: string | null;
  is_online: boolean;
  visit_count: number;
  lifetime_value_cents: number;
  orders_count: number;
  marketing_opt_in: boolean;
  first_seen_at: string;
  last_seen_at: string;
  latest_sentiment: string | null;
  conversations_count: number;
  open_conversations_count: number;
  tickets_count: number;
  open_tickets_count: number;
  ai_summary: string | null;
  ai_signals: Array<{ label: string; tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'ai' }>;
}

export interface CustomerSegmentFilters {
  segmentKey?: string;
  country?: string;
  minLtvCents?: number;
  tag?: string;
}

export interface CustomerSegmentRecord {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  description: string | null;
  filters: CustomerSegmentFilters;
  is_system: boolean;
  position: number;
  count: number;
  created_at: string;
}

export interface CustomerNoteRecord {
  id: string;
  visitor_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface CustomerOrderRecord {
  id: string;
  visitor_id: string;
  order_number: string;
  status: 'pending' | 'paid' | 'fulfilled' | 'refunded' | 'cancelled';
  currency: string;
  total_cents: number;
  items_summary: string | null;
  external_source: string | null;
  ordered_at: string;
}

export interface CustomerConversationItem {
  id: string;
  status: string;
  priority: string;
  channel: string | null;
  sentiment: string | null;
  csat_rating: number | null;
  assigned_agent_name: string | null;
  last_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerTicketItem {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  csat_rating: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerPageVisitItem {
  id: string;
  page_url: string;
  page_title: string | null;
  visited_at: string;
}

export type CrmDealStage = 'lead' | 'qualified' | 'demo' | 'proposal' | 'won' | 'lost';
export type CrmTaskKind = 'call' | 'email' | 'meeting' | 'follow_up' | 'todo';
export type CrmTaskPriority = 'low' | 'normal' | 'high';
export type CrmTaskStatus = 'open' | 'completed';

export interface CrmDealRecord {
  id: string;
  workspace_id: string;
  visitor_id: string | null;
  company_id: string | null;
  title: string;
  stage: CrmDealStage;
  value_cents: number;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  owner_id: string | null;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  visitor_name: string | null;
  visitor_email: string | null;
  company_name: string | null;
  owner_name: string | null;
}

export interface CrmDealsSummary {
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  pipelineValueCents: number;
  weightedValueCents: number;
  wonValueCents: number;
  lostValueCents: number;
  winRatePercent: number | null;
}

export interface CrmTaskRecord {
  id: string;
  workspace_id: string;
  visitor_id: string | null;
  deal_id: string | null;
  title: string;
  description: string | null;
  kind: CrmTaskKind;
  priority: CrmTaskPriority;
  status: CrmTaskStatus;
  due_at: string | null;
  assignee_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  visitor_name: string | null;
  visitor_email: string | null;
  deal_title: string | null;
  assignee_name: string | null;
}

export interface CrmCompanyRecord {
  id: string;
  workspace_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  website: string | null;
  annual_revenue_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contacts_count: number;
  open_deals_count: number;
  pipeline_value_cents: number;
  lifetime_value_cents: number;
}

export interface CrmPickerOptions {
  contacts: Array<{ id: string; label: string; company: string | null }>;
  companies: Array<{ id: string; label: string }>;
  deals: Array<{ id: string; label: string; visitor_id: string | null }>;
  agents: Array<{ id: string; label: string }>;
}

export interface CustomerProfileData {
  customer: CustomerRecord;
  notes: CustomerNoteRecord[];
  orders: CustomerOrderRecord[];
  conversations: CustomerConversationItem[];
  tickets: CustomerTicketItem[];
  pageHistory: CustomerPageVisitItem[];
  deals: CrmDealRecord[];
  tasks: CrmTaskRecord[];
  csatAverage: number | null;
  csatCount: number;
}

export interface CustomersBootstrap {
  systemSegments: CustomerSegmentRecord[];
  customSegments: CustomerSegmentRecord[];
  countries: string[];
  tags: string[];
  crmCounts: {
    openDeals: number;
    openTasks: number;
    overdueTasks: number;
    companies: number;
  };
  canEdit: boolean;
  canAddNote: boolean;
  canReply: boolean;
  currentAgentId: string;
}

const gCrmSchema = globalThis as typeof globalThis & {
  __orbatCrmSalesSchemaPromise?: Promise<void>;
};

async function ensureSalesCrmTables(): Promise<void> {
  if (!gCrmSchema.__orbatCrmSalesSchemaPromise) {
    gCrmSchema.__orbatCrmSalesSchemaPromise = (async () => {
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
      await Promise.all([
        queryRows('CREATE INDEX IF NOT EXISTS idx_crm_companies_ws_name ON public.crm_companies (workspace_id, LOWER(name))'),
        queryRows('CREATE INDEX IF NOT EXISTS idx_crm_deals_ws_stage ON public.crm_deals (workspace_id, stage, updated_at DESC)'),
        queryRows('CREATE INDEX IF NOT EXISTS idx_crm_deals_ws_visitor ON public.crm_deals (workspace_id, visitor_id) WHERE visitor_id IS NOT NULL'),
        queryRows('CREATE INDEX IF NOT EXISTS idx_crm_deals_ws_company ON public.crm_deals (workspace_id, company_id) WHERE company_id IS NOT NULL'),
        queryRows('CREATE INDEX IF NOT EXISTS idx_crm_tasks_ws_status_due ON public.crm_tasks (workspace_id, status, due_at ASC NULLS LAST, created_at DESC)'),
        queryRows('CREATE INDEX IF NOT EXISTS idx_crm_tasks_ws_visitor ON public.crm_tasks (workspace_id, visitor_id) WHERE visitor_id IS NOT NULL'),
      ]);
    })().catch((err) => {
      gCrmSchema.__orbatCrmSalesSchemaPromise = undefined;
      throw err;
    });
  }
  return gCrmSchema.__orbatCrmSalesSchemaPromise;
}

function assertUuid(id: string, label: string): void {
  if (!UUID_RE.test(id || '')) throw userError(`Invalid ${label}.`);
}

function cleanTagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().slice(0, 48);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 25) break;
  }
  return out;
}

function normalizeSegmentKey(raw: string | null | undefined): string {
  const s = (raw || 'standard').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  return s || 'standard';
}

function slugifySegmentName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return s || `seg_${Date.now().toString(36)}`;
}

function sanitizeSignals(raw: unknown): CustomerRecord['ai_signals'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return { label: item, tone: 'neutral' as const };
      if (item && typeof item === 'object' && typeof (item as { label?: unknown }).label === 'string') {
        const toneRaw = (item as { tone?: unknown }).tone;
        const tone =
          toneRaw === 'accent' || toneRaw === 'ok' || toneRaw === 'warn' || toneRaw === 'bad' || toneRaw === 'ai'
            ? toneRaw
            : ('neutral' as const);
        return { label: String((item as { label: string }).label), tone };
      }
      return null;
    })
    .filter((x): x is { label: string; tone: 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'ai' } => Boolean(x))
    .slice(0, 8);
}

function mapCustomerRow(r: Record<string, unknown>): CustomerRecord {
  return {
    id: String(r.id),
    workspace_id: String(r.workspace_id),
    name: r.name ? String(r.name) : null,
    email: r.email ? String(r.email) : null,
    phone: r.phone ? String(r.phone) : null,
    company: r.company ? String(r.company) : null,
    segment: String(r.segment || 'standard'),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    plan: r.plan ? String(r.plan) : null,
    ip_location_city: r.ip_location_city ? String(r.ip_location_city) : null,
    ip_location_country: r.ip_location_country ? String(r.ip_location_country) : null,
    timezone: r.timezone ? String(r.timezone) : null,
    language: r.language ? String(r.language) : null,
    is_online: Boolean(r.is_online),
    visit_count: Number(r.visit_count ?? 1),
    lifetime_value_cents: Number(r.lifetime_value_cents ?? 0),
    orders_count: Number(r.orders_count ?? 0),
    marketing_opt_in: Boolean(r.marketing_opt_in),
    first_seen_at: String(r.first_seen_at),
    last_seen_at: String(r.last_seen_at),
    latest_sentiment: r.latest_sentiment ? String(r.latest_sentiment) : null,
    conversations_count: Number(r.conversations_count ?? 0),
    open_conversations_count: Number(r.open_conversations_count ?? 0),
    tickets_count: Number(r.tickets_count ?? 0),
    open_tickets_count: Number(r.open_tickets_count ?? 0),
    ai_summary: r.ai_summary ? String(r.ai_summary) : null,
    ai_signals: sanitizeSignals(r.ai_signals),
  };
}

function buildCustomSegmentPredicate(
  filters: CustomerSegmentFilters,
  params: unknown[],
): string {
  const parts: string[] = [];
  if (filters.segmentKey) {
    params.push(filters.segmentKey);
    parts.push(`v.segment = $${params.length}`);
  }
  if (filters.country) {
    params.push(filters.country);
    parts.push(`LOWER(COALESCE(v.ip_location_country, '')) = LOWER($${params.length})`);
  }
  if (typeof filters.minLtvCents === 'number' && Number.isFinite(filters.minLtvCents) && filters.minLtvCents > 0) {
    params.push(Math.floor(filters.minLtvCents));
    parts.push(`v.lifetime_value_cents >= $${params.length}`);
  }
  if (filters.tag) {
    params.push([filters.tag]);
    parts.push(`v.tags && $${params.length}::text[]`);
  }
  return parts.length ? `(${parts.join(' AND ')})` : 'TRUE';
}

export async function getCustomersBootstrapAction(workspaceId: string): Promise<CustomersBootstrap> {
  const { role, agent } = await getWorkspaceAccess(workspaceId, 'view');
  await ensureSalesCrmTables();

  const [countsRows, customRows, countryRows, tagRows, crmCountsRows] = await Promise.all([
    queryRows<{
      total: number;
      vip: number;
      churn_risk: number;
      new_month: number;
      leads: number;
      wholesale: number;
    }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE segment = 'vip' OR lifetime_value_cents >= 100000)::int AS vip,
         COUNT(*) FILTER (WHERE segment = 'churn_risk')::int AS churn_risk,
         COUNT(*) FILTER (WHERE first_seen_at >= (now() - interval '30 days'))::int AS new_month,
         COUNT(*) FILTER (WHERE segment = 'lead' OR (orders_count = 0 AND segment = 'standard'))::int AS leads,
         COUNT(*) FILTER (WHERE segment = 'wholesale')::int AS wholesale
       FROM public.visitors
       WHERE workspace_id = $1`,
      [workspaceId],
    ),
    queryRows<{
      id: string;
      workspace_id: string;
      slug: string;
      name: string;
      description: string | null;
      filters: CustomerSegmentFilters;
      is_system: boolean;
      position: number;
      created_at: string;
    }>(
      `SELECT id, workspace_id, slug, name, description, filters, is_system, position, created_at
       FROM public.customer_segments
       WHERE workspace_id = $1
       ORDER BY position ASC, created_at ASC`,
      [workspaceId],
    ),
    queryRows<{ country: string }>(
      `SELECT DISTINCT TRIM(ip_location_country) AS country
       FROM public.visitors
       WHERE workspace_id = $1 AND ip_location_country IS NOT NULL AND TRIM(ip_location_country) <> ''
       ORDER BY country ASC
       LIMIT 100`,
      [workspaceId],
    ),
    queryRows<{ tag: string }>(
      `SELECT DISTINCT unnest(tags) AS tag
       FROM public.visitors
       WHERE workspace_id = $1 AND array_length(tags, 1) > 0
       ORDER BY tag ASC
       LIMIT 100`,
      [workspaceId],
    ),
    queryRows<{
      open_deals: number;
      open_tasks: number;
      overdue_tasks: number;
      companies: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM public.crm_deals d WHERE d.workspace_id = $1 AND d.stage NOT IN ('won', 'lost')) AS open_deals,
         (SELECT COUNT(*)::int FROM public.crm_tasks t WHERE t.workspace_id = $1 AND t.status = 'open') AS open_tasks,
         (SELECT COUNT(*)::int FROM public.crm_tasks t WHERE t.workspace_id = $1 AND t.status = 'open' AND t.due_at IS NOT NULL AND t.due_at < now()) AS overdue_tasks,
         (SELECT COUNT(*)::int FROM public.crm_companies c WHERE c.workspace_id = $1) AS companies`,
      [workspaceId],
    ),
  ]);

  const countsRow = countsRows[0];
  const crmCountsRow = crmCountsRows[0];

  const customSegments: CustomerSegmentRecord[] = await Promise.all(
    customRows.map(async (seg) => {
      const filters = (seg.filters && typeof seg.filters === 'object' ? seg.filters : {}) as CustomerSegmentFilters;
      const params: unknown[] = [workspaceId];
      const pred = buildCustomSegmentPredicate(filters, params);
      const [cRow] = await queryRows<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM public.visitors v WHERE v.workspace_id = $1 AND ${pred}`,
        params,
      );
      return {
        ...seg,
        filters,
        count: Number(cRow?.cnt ?? 0),
      };
    }),
  );

  const counts = countsRow ?? { total: 0, vip: 0, churn_risk: 0, new_month: 0, leads: 0, wholesale: 0 };
  const nowIso = new Date().toISOString();

  const systemSegments: CustomerSegmentRecord[] = [
    { id: 'sys:all', workspace_id: workspaceId, slug: 'all', name: 'All customers', description: 'Every identified customer and visitor in your workspace.', filters: {}, is_system: true, position: 0, count: counts.total, created_at: nowIso },
    { id: 'sys:vip', workspace_id: workspaceId, slug: 'vip', name: 'VIP', description: 'Tagged VIP or $1,000+ lifetime spend.', filters: { segmentKey: 'vip' }, is_system: true, position: 1, count: counts.vip, created_at: nowIso },
    { id: 'sys:churn_risk', workspace_id: workspaceId, slug: 'churn_risk', name: 'Churn risk', description: 'Flagged at risk of churning.', filters: { segmentKey: 'churn_risk' }, is_system: true, position: 2, count: counts.churn_risk, created_at: nowIso },
    { id: 'sys:new_month', workspace_id: workspaceId, slug: 'new_month', name: 'New this month', description: 'First seen in the last 30 days.', filters: {}, is_system: true, position: 3, count: counts.new_month, created_at: nowIso },
    { id: 'sys:leads', workspace_id: workspaceId, slug: 'leads', name: 'Leads', description: 'Pre-purchase visitors and leads.', filters: { segmentKey: 'lead' }, is_system: true, position: 4, count: counts.leads, created_at: nowIso },
    { id: 'sys:wholesale', workspace_id: workspaceId, slug: 'wholesale', name: 'Wholesale', description: 'B2B / wholesale accounts.', filters: { segmentKey: 'wholesale' }, is_system: true, position: 5, count: counts.wholesale, created_at: nowIso },
  ];

  return {
    systemSegments,
    customSegments,
    countries: countryRows.map((r) => r.country),
    tags: tagRows.map((r) => r.tag),
    crmCounts: {
      openDeals: Number(crmCountsRow?.open_deals ?? 0),
      openTasks: Number(crmCountsRow?.open_tasks ?? 0),
      overdueTasks: Number(crmCountsRow?.overdue_tasks ?? 0),
      companies: Number(crmCountsRow?.companies ?? 0),
    },
    canEdit: roleCan(role, 'edit_content'),
    canAddNote: roleCan(role, 'add_note'),
    canReply: roleCan(role, 'reply'),
    currentAgentId: agent.id,
  };
}

export async function listCustomersAction(
  workspaceId: string,
  params: {
    segmentSlug?: string;
    customSegmentId?: string;
    q?: string;
    country?: string;
    minLtvCents?: number;
    maxLtvCents?: number;
    sortBy?: CustomerSortField;
    sortDir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ customers: CustomerRecord[]; total: number; page: number; pageSize: number }> {
  await getWorkspaceAccess(workspaceId, 'view');

  const page = Math.max(0, Math.floor(params.page ?? 0));
  const pageSize = Math.min(100, Math.max(10, Math.floor(params.pageSize ?? 25)));
  const values: unknown[] = [workspaceId];
  const where: string[] = ['v.workspace_id = $1'];

  if (params.customSegmentId && UUID_RE.test(params.customSegmentId)) {
    const [seg] = await queryRows<{ filters: CustomerSegmentFilters }>(
      'SELECT filters FROM public.customer_segments WHERE workspace_id = $1 AND id = $2 LIMIT 1',
      [workspaceId, params.customSegmentId],
    );
    if (seg?.filters && typeof seg.filters === 'object') {
      where.push(buildCustomSegmentPredicate(seg.filters, values));
    }
  } else if (params.segmentSlug && params.segmentSlug !== 'all') {
    switch (params.segmentSlug) {
      case 'vip':
        where.push("(v.segment = 'vip' OR v.lifetime_value_cents >= 100000)");
        break;
      case 'churn_risk':
        where.push("v.segment = 'churn_risk'");
        break;
      case 'new_month':
        where.push("v.first_seen_at >= (now() - interval '30 days')");
        break;
      case 'leads':
        where.push("(v.segment = 'lead' OR (v.orders_count = 0 AND v.segment = 'standard'))");
        break;
      case 'wholesale':
        where.push("v.segment = 'wholesale'");
        break;
      default:
        values.push(normalizeSegmentKey(params.segmentSlug));
        where.push(`v.segment = $${values.length}`);
        break;
    }
  }

  const q = (params.q || '').trim();
  if (q) {
    values.push(`%${q}%`);
    const p = `$${values.length}`;
    where.push(
      `(COALESCE(v.name, '') ILIKE ${p} OR COALESCE(v.email, '') ILIKE ${p} OR COALESCE(v.company, '') ILIKE ${p} OR COALESCE(v.phone, '') ILIKE ${p} OR array_to_string(v.tags, ',') ILIKE ${p})`,
    );
  }

  const country = (params.country || '').trim();
  if (country) {
    values.push(country);
    where.push(`LOWER(COALESCE(v.ip_location_country, '')) = LOWER($${values.length})`);
  }

  if (typeof params.minLtvCents === 'number' && Number.isFinite(params.minLtvCents)) {
    values.push(Math.max(0, Math.floor(params.minLtvCents)));
    where.push(`v.lifetime_value_cents >= $${values.length}`);
  }
  if (typeof params.maxLtvCents === 'number' && Number.isFinite(params.maxLtvCents)) {
    values.push(Math.max(0, Math.floor(params.maxLtvCents)));
    where.push(`v.lifetime_value_cents <= $${values.length}`);
  }

  const sortMap: Record<CustomerSortField, string> = {
    last_seen_at: 'v.last_seen_at',
    name: "LOWER(COALESCE(NULLIF(v.name, ''), NULLIF(v.email, ''), 'zzz'))",
    lifetime_value_cents: 'v.lifetime_value_cents',
    orders_count: 'v.orders_count',
    first_seen_at: 'v.first_seen_at',
  };
  const sortExpr = sortMap[params.sortBy ?? 'last_seen_at'] ?? sortMap.last_seen_at;
  const sortDir = params.sortDir === 'asc' ? 'ASC' : 'DESC';
  const whereSql = where.join(' AND ');

  const listValues = [...values, pageSize, page * pageSize];
  const [countRows, rows] = await Promise.all([
    queryRows<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM public.visitors v WHERE ${whereSql}`,
      values,
    ),
    queryRows<Record<string, unknown>>(
      `SELECT
         v.id, v.workspace_id, v.name, v.email, v.phone, v.company, v.segment, v.tags, v.plan,
         v.ip_location_city, v.ip_location_country, v.timezone, v.language,
         v.is_online, v.visit_count, v.lifetime_value_cents, v.orders_count, v.marketing_opt_in,
         v.first_seen_at, v.last_seen_at, v.ai_summary, v.ai_signals,
         (SELECT c.sentiment FROM public.conversations c
          WHERE c.workspace_id = $1 AND c.visitor_id = v.id AND c.sentiment IS NOT NULL
          ORDER BY c.updated_at DESC LIMIT 1) AS latest_sentiment,
         (SELECT COUNT(*)::int FROM public.conversations c
          WHERE c.workspace_id = $1 AND c.visitor_id = v.id) AS conversations_count,
         (SELECT COUNT(*)::int FROM public.conversations c
          WHERE c.workspace_id = $1 AND c.visitor_id = v.id AND c.status IN ('open', 'waiting', 'snoozed')) AS open_conversations_count,
         (SELECT COUNT(*)::int FROM public.tickets t
          WHERE t.workspace_id = $1 AND t.requester_id = v.id) AS tickets_count,
         (SELECT COUNT(*)::int FROM public.tickets t
          WHERE t.workspace_id = $1 AND t.requester_id = v.id AND t.status IN ('new', 'open', 'pending', 'on_hold')) AS open_tickets_count
       FROM public.visitors v
       WHERE ${whereSql}
       ORDER BY ${sortExpr} ${sortDir}, v.last_seen_at DESC
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues,
    ),
  ]);
  const countRow = countRows[0];

  return {
    customers: rows.map(mapCustomerRow),
    total: Number(countRow?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getCustomerProfileAction(
  workspaceId: string,
  visitorId: string,
): Promise<CustomerProfileData> {
  await getWorkspaceAccess(workspaceId, 'view');
  assertUuid(visitorId, 'customer');
  await ensureSalesCrmTables();

  const rows = await queryRows<Record<string, unknown>>(
    `SELECT
       v.id, v.workspace_id, v.name, v.email, v.phone, v.company, v.segment, v.tags, v.plan,
       v.ip_location_city, v.ip_location_country, v.timezone, v.language,
       v.is_online, v.visit_count, v.lifetime_value_cents, v.orders_count, v.marketing_opt_in,
       v.first_seen_at, v.last_seen_at, v.ai_summary, v.ai_signals,
       (SELECT c.sentiment FROM public.conversations c
        WHERE c.workspace_id = $1 AND c.visitor_id = v.id AND c.sentiment IS NOT NULL
        ORDER BY c.updated_at DESC LIMIT 1) AS latest_sentiment,
       (SELECT COUNT(*)::int FROM public.conversations c
        WHERE c.workspace_id = $1 AND c.visitor_id = v.id) AS conversations_count,
       (SELECT COUNT(*)::int FROM public.conversations c
        WHERE c.workspace_id = $1 AND c.visitor_id = v.id AND c.status IN ('open', 'waiting', 'snoozed')) AS open_conversations_count,
       (SELECT COUNT(*)::int FROM public.tickets t
        WHERE t.workspace_id = $1 AND t.requester_id = v.id) AS tickets_count,
       (SELECT COUNT(*)::int FROM public.tickets t
        WHERE t.workspace_id = $1 AND t.requester_id = v.id AND t.status IN ('new', 'open', 'pending', 'on_hold')) AS open_tickets_count
     FROM public.visitors v
     WHERE v.workspace_id = $1 AND v.id = $2
     LIMIT 1`,
    [workspaceId, visitorId],
  );
  if (!rows[0]) throw userError('Customer not found.');

  const [notes, orders, conversations, tickets, pageHistory, dealRows, taskRows] = await Promise.all([
    queryRows<CustomerNoteRecord>(
      `SELECT id, visitor_id, author_id, author_name, body, created_at
       FROM public.visitor_notes
       WHERE workspace_id = $1 AND visitor_id = $2
       ORDER BY created_at DESC
       LIMIT 100`,
      [workspaceId, visitorId],
    ),
    queryRows<CustomerOrderRecord>(
      `SELECT id, visitor_id, order_number, status, currency, total_cents, items_summary, external_source, ordered_at
       FROM public.customer_orders
       WHERE workspace_id = $1 AND visitor_id = $2
       ORDER BY ordered_at DESC
       LIMIT 100`,
      [workspaceId, visitorId],
    ),
    queryRows<CustomerConversationItem>(
      `SELECT
         c.id, c.status, c.priority, c.channel, c.sentiment, c.csat_rating,
         a.name AS assigned_agent_name,
         (SELECT m.content FROM public.messages m WHERE m.conversation_id = c.id AND COALESCE(m.is_internal, false) = false ORDER BY m.created_at DESC LIMIT 1) AS last_message,
         c.created_at, c.updated_at
       FROM public.conversations c
       LEFT JOIN public.agents a ON a.id = c.assigned_agent_id
       WHERE c.workspace_id = $1 AND c.visitor_id = $2
       ORDER BY c.updated_at DESC
       LIMIT 50`,
      [workspaceId, visitorId],
    ),
    queryRows<CustomerTicketItem>(
      `SELECT id, number, subject, status, priority, channel, csat_rating, created_at, updated_at
       FROM public.tickets
       WHERE workspace_id = $1 AND requester_id = $2
       ORDER BY updated_at DESC
       LIMIT 50`,
      [workspaceId, visitorId],
    ),
    queryRows<CustomerPageVisitItem>(
      `SELECT id, page_url, page_title, visited_at
       FROM public.visitor_page_history
       WHERE workspace_id = $1 AND visitor_id = $2
       ORDER BY visited_at DESC
       LIMIT 30`,
      [workspaceId, visitorId],
    ),
    queryRows<Record<string, unknown>>(
      `SELECT d.*, v.name AS visitor_name, v.email AS visitor_email, co.name AS company_name, a.name AS owner_name
       FROM public.crm_deals d
       LEFT JOIN public.visitors v ON v.id = d.visitor_id
       LEFT JOIN public.crm_companies co ON co.id = d.company_id
       LEFT JOIN public.agents a ON a.id = d.owner_id
       WHERE d.workspace_id = $1 AND d.visitor_id = $2
       ORDER BY d.updated_at DESC
       LIMIT 50`,
      [workspaceId, visitorId],
    ),
    queryRows<Record<string, unknown>>(
      `SELECT t.*, v.name AS visitor_name, v.email AS visitor_email, d.title AS deal_title, a.name AS assignee_name
       FROM public.crm_tasks t
       LEFT JOIN public.visitors v ON v.id = t.visitor_id
       LEFT JOIN public.crm_deals d ON d.id = t.deal_id
       LEFT JOIN public.agents a ON a.id = t.assignee_id
       WHERE t.workspace_id = $1 AND t.visitor_id = $2
       ORDER BY CASE WHEN t.status = 'open' THEN 0 ELSE 1 END, t.due_at ASC NULLS LAST, t.created_at DESC
       LIMIT 50`,
      [workspaceId, visitorId],
    ),
  ]);

  const ratings = conversations.map((c) => c.csat_rating).filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 5);
  const csatAverage = ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : null;

  return {
    customer: mapCustomerRow(rows[0]),
    notes,
    orders,
    conversations,
    tickets,
    pageHistory,
    deals: dealRows.map(mapDealRow),
    tasks: taskRows.map(mapTaskRow),
    csatAverage,
    csatCount: ratings.length,
  };
}

export async function createCustomerAction(
  workspaceId: string,
  input: {
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    segment?: string | null;
    plan?: string | null;
    ipLocationCity?: string | null;
    ipLocationCountry?: string | null;
    timezone?: string | null;
    language?: string | null;
    tags?: string[];
    marketingOptIn?: boolean;
  },
): Promise<{ id: string }> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  const name = (input.name || '').trim().slice(0, 120);
  const email = (input.email || '').trim().toLowerCase() || null;
  if (!name && !email) throw userError('Enter a name or email address.');
  if (email && !isValidEmail(email)) throw userError('Enter a valid email address.');

  if (email) {
    const existing = await queryRows<{ id: string }>(
      'SELECT id FROM public.visitors WHERE workspace_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1',
      [workspaceId, email],
    );
    if (existing[0]) throw userError('A customer with that email already exists.');
  }

  const tags = cleanTagList(input.tags);
  const segment = normalizeSegmentKey(input.segment);
  const now = new Date().toISOString();
  const [inserted] = await queryRows<{ id: string }>(
    `INSERT INTO public.visitors (
       workspace_id, name, email, phone, company, segment, tags, plan,
       ip_location_city, ip_location_country, timezone, language,
       marketing_opt_in, current_page_url, is_online, visit_count,
       channel, first_seen_at, last_seen_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9, $10, $11, $12, $13, '', false, 1, 'manual', $14, $14)
     RETURNING id`,
    [
      workspaceId,
      name || email?.split('@')[0] || 'Customer',
      email,
      (input.phone || '').trim().slice(0, 40) || null,
      (input.company || '').trim().slice(0, 120) || null,
      segment,
      tags,
      (input.plan || '').trim().slice(0, 60) || null,
      (input.ipLocationCity || '').trim().slice(0, 80) || null,
      (input.ipLocationCountry || '').trim().slice(0, 80) || null,
      (input.timezone || '').trim().slice(0, 80) || null,
      (input.language || '').trim().slice(0, 24) || null,
      Boolean(input.marketingOptIn),
      now,
    ],
  );
  if (!inserted) throw userError('Could not create customer.');
  return inserted;
}

export async function updateCustomerAction(
  workspaceId: string,
  visitorId: string,
  patch: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    segment?: string | null;
    plan?: string | null;
    ipLocationCity?: string | null;
    ipLocationCountry?: string | null;
    timezone?: string | null;
    language?: string | null;
    tags?: string[];
    marketingOptIn?: boolean;
  },
): Promise<void> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  assertUuid(visitorId, 'customer');

  const sets: string[] = [];
  const params: unknown[] = [workspaceId, visitorId];
  const pushSet = (col: string, val: unknown, cast = '') => {
    params.push(val);
    sets.push(`${col} = $${params.length}${cast}`);
  };

  if (patch.name !== undefined) pushSet('name', (patch.name || '').trim().slice(0, 120) || null);
  if (patch.email !== undefined) {
    const clean = (patch.email || '').trim().toLowerCase() || null;
    if (clean && !isValidEmail(clean)) throw userError('Enter a valid email address.');
    if (clean) {
      const conflict = await queryRows<{ id: string }>(
        'SELECT id FROM public.visitors WHERE workspace_id = $1 AND LOWER(email) = LOWER($2) AND id <> $3 LIMIT 1',
        [workspaceId, clean, visitorId],
      );
      if (conflict[0]) throw userError('Another customer already uses that email.');
    }
    pushSet('email', clean);
  }
  if (patch.phone !== undefined) pushSet('phone', (patch.phone || '').trim().slice(0, 40) || null);
  if (patch.company !== undefined) pushSet('company', (patch.company || '').trim().slice(0, 120) || null);
  if (patch.segment !== undefined) pushSet('segment', normalizeSegmentKey(patch.segment));
  if (patch.plan !== undefined) pushSet('plan', (patch.plan || '').trim().slice(0, 60) || null);
  if (patch.ipLocationCity !== undefined) pushSet('ip_location_city', (patch.ipLocationCity || '').trim().slice(0, 80) || null);
  if (patch.ipLocationCountry !== undefined) pushSet('ip_location_country', (patch.ipLocationCountry || '').trim().slice(0, 80) || null);
  if (patch.timezone !== undefined) pushSet('timezone', (patch.timezone || '').trim().slice(0, 80) || null);
  if (patch.language !== undefined) pushSet('language', (patch.language || '').trim().slice(0, 24) || null);
  if (patch.tags !== undefined) pushSet('tags', cleanTagList(patch.tags), '::text[]');
  if (patch.marketingOptIn !== undefined) pushSet('marketing_opt_in', Boolean(patch.marketingOptIn));

  if (!sets.length) return;
  const updated = await queryRows<{ id: string }>(
    `UPDATE public.visitors SET ${sets.join(', ')} WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    params,
  );
  if (!updated[0]) throw userError('Customer not found.');
}

export async function addCustomerNoteAction(
  workspaceId: string,
  visitorId: string,
  body: string,
): Promise<CustomerNoteRecord> {
  const { agent } = await getWorkspaceAccess(workspaceId, 'add_note');
  assertUuid(visitorId, 'customer');
  const clean = (body || '').trim();
  if (!clean) throw userError('Enter a note first.');
  if (clean.length > 4000) throw userError('Note must be at most 4000 characters.');

  const exists = await queryRows<{ id: string }>(
    'SELECT id FROM public.visitors WHERE workspace_id = $1 AND id = $2 LIMIT 1',
    [workspaceId, visitorId],
  );
  if (!exists[0]) throw userError('Customer not found.');

  const [note] = await queryRows<CustomerNoteRecord>(
    `INSERT INTO public.visitor_notes (workspace_id, visitor_id, author_id, author_name, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, visitor_id, author_id, author_name, body, created_at`,
    [workspaceId, visitorId, agent.id, agent.name || 'Team member', clean],
  );
  if (!note) throw userError('Could not save note.');
  return note;
}

export async function deleteCustomerNoteAction(workspaceId: string, noteId: string): Promise<void> {
  const { agent, role } = await getWorkspaceAccess(workspaceId, 'add_note');
  assertUuid(noteId, 'note');
  const [note] = await queryRows<{ id: string; author_id: string | null }>(
    'SELECT id, author_id FROM public.visitor_notes WHERE workspace_id = $1 AND id = $2 LIMIT 1',
    [workspaceId, noteId],
  );
  if (!note) throw userError('Note not found.');
  if (note.author_id !== agent.id && !roleCan(role, 'manage_team')) {
    throw userError('You can only delete your own notes.');
  }
  await queryRows('DELETE FROM public.visitor_notes WHERE workspace_id = $1 AND id = $2', [workspaceId, noteId]);
}

export async function addCustomerOrderAction(
  workspaceId: string,
  visitorId: string,
  input: {
    orderNumber: string;
    status?: CustomerOrderRecord['status'];
    currency?: string;
    totalCents: number;
    itemsSummary?: string;
  },
): Promise<CustomerOrderRecord> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  assertUuid(visitorId, 'customer');
  const orderNumber = (input.orderNumber || '').trim().slice(0, 64);
  if (!orderNumber) throw userError('Enter an order number.');
  const totalCents = Math.max(0, Math.round(Number(input.totalCents) || 0));
  const status = (['pending', 'paid', 'fulfilled', 'refunded', 'cancelled'] as const).includes(
    input.status as CustomerOrderRecord['status'],
  )
    ? (input.status as CustomerOrderRecord['status'])
    : 'paid';
  const currency = (input.currency || 'USD').trim().toUpperCase().slice(0, 8) || 'USD';

  const [order] = await queryRows<CustomerOrderRecord>(
    `INSERT INTO public.customer_orders (
       workspace_id, visitor_id, order_number, status, currency, total_cents, items_summary, external_source
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')
     RETURNING id, visitor_id, order_number, status, currency, total_cents, items_summary, external_source, ordered_at`,
    [workspaceId, visitorId, orderNumber, status, currency, totalCents, (input.itemsSummary || '').trim().slice(0, 240) || null],
  );
  if (!order) throw userError('Could not record order.');
  return order;
}

export async function createCustomerSegmentAction(
  workspaceId: string,
  input: { name: string; description?: string; filters: CustomerSegmentFilters },
): Promise<CustomerSegmentRecord> {
  const { agent } = await getWorkspaceAccess(workspaceId, 'edit_content');
  const name = (input.name || '').trim().slice(0, 64);
  if (!name) throw userError('Give the segment a name.');
  const slug = slugifySegmentName(name);

  const safeFilters: CustomerSegmentFilters = {};
  if (input.filters?.segmentKey?.trim()) safeFilters.segmentKey = normalizeSegmentKey(input.filters.segmentKey);
  if (input.filters?.country?.trim()) safeFilters.country = input.filters.country.trim().slice(0, 80);
  if (typeof input.filters?.minLtvCents === 'number' && input.filters.minLtvCents > 0) {
    safeFilters.minLtvCents = Math.floor(input.filters.minLtvCents);
  }
  if (input.filters?.tag?.trim()) safeFilters.tag = input.filters.tag.trim().slice(0, 48);

  const [seg] = await queryRows<{
    id: string;
    workspace_id: string;
    slug: string;
    name: string;
    description: string | null;
    filters: CustomerSegmentFilters;
    is_system: boolean;
    position: number;
    created_at: string;
  }>(
    `INSERT INTO public.customer_segments (workspace_id, slug, name, description, filters, is_system, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, false, $6)
     ON CONFLICT (workspace_id, slug) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       filters = EXCLUDED.filters,
       updated_at = now()
     RETURNING id, workspace_id, slug, name, description, filters, is_system, position, created_at`,
    [workspaceId, slug, name, (input.description || '').trim().slice(0, 240) || null, JSON.stringify(safeFilters), agent.id],
  );
  if (!seg) throw userError('Could not save segment.');
  return { ...seg, filters: seg.filters ?? {}, count: 0 };
}

export async function deleteCustomerSegmentAction(workspaceId: string, segmentId: string): Promise<void> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  assertUuid(segmentId, 'segment');
  await queryRows('DELETE FROM public.customer_segments WHERE workspace_id = $1 AND id = $2 AND is_system = false', [
    workspaceId,
    segmentId,
  ]);
}

export async function importCustomersCsvAction(
  workspaceId: string,
  rows: Array<{
    name?: string;
    email: string;
    phone?: string;
    company?: string;
    segment?: string;
    country?: string;
    city?: string;
    tags?: string[];
    plan?: string;
  }>,
): Promise<{ created: number; updated: number; skipped: number }> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  if (!Array.isArray(rows) || rows.length === 0) throw userError('No rows to import.');
  if (rows.length > 500) throw userError('Import up to 500 customers at a time.');

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const email = (row.email || '').trim().toLowerCase();
    const name = (row.name || '').trim().slice(0, 120);
    if (!email || !isValidEmail(email)) {
      skipped++;
      continue;
    }
    const existing = await queryRows<{ id: string }>(
      'SELECT id FROM public.visitors WHERE workspace_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1',
      [workspaceId, email],
    );
    const segment = row.segment ? normalizeSegmentKey(row.segment) : undefined;
    const tags = cleanTagList(row.tags);

    if (existing[0]) {
      await queryRows(
        `UPDATE public.visitors
         SET name = COALESCE(NULLIF($3, ''), name),
             phone = COALESCE(NULLIF($4, ''), phone),
             company = COALESCE(NULLIF($5, ''), company),
             segment = COALESCE($6, segment),
             ip_location_country = COALESCE(NULLIF($7, ''), ip_location_country),
             ip_location_city = COALESCE(NULLIF($8, ''), ip_location_city),
             plan = COALESCE(NULLIF($9, ''), plan),
             tags = CASE WHEN array_length($10::text[], 1) > 0 THEN $10::text[] ELSE tags END
         WHERE workspace_id = $1 AND id = $2`,
        [
          workspaceId,
          existing[0].id,
          name,
          (row.phone || '').trim().slice(0, 40),
          (row.company || '').trim().slice(0, 120),
          segment ?? null,
          (row.country || '').trim().slice(0, 80),
          (row.city || '').trim().slice(0, 80),
          (row.plan || '').trim().slice(0, 60),
          tags,
        ],
      );
      updated++;
    } else {
      await queryRows(
        `INSERT INTO public.visitors (
           workspace_id, name, email, phone, company, segment, tags, plan,
           ip_location_city, ip_location_country, current_page_url, is_online, visit_count,
           channel, first_seen_at, last_seen_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9, $10, '', false, 1, 'import', $11, $11)`,
        [
          workspaceId,
          name || email.split('@')[0],
          email,
          (row.phone || '').trim().slice(0, 40) || null,
          (row.company || '').trim().slice(0, 120) || null,
          segment ?? 'standard',
          tags,
          (row.plan || '').trim().slice(0, 60) || null,
          (row.city || '').trim().slice(0, 80) || null,
          (row.country || '').trim().slice(0, 80) || null,
          now,
        ],
      );
      created++;
    }
  }

  return { created, updated, skipped };
}

export async function refreshCustomerAiSummaryAction(
  workspaceId: string,
  visitorId: string,
): Promise<{ summary: string; signals: CustomerRecord['ai_signals'] }> {
  await getWorkspaceAccess(workspaceId, 'view');
  assertUuid(visitorId, 'customer');
  const profile = await getCustomerProfileAction(workspaceId, visitorId);
  const c = profile.customer;

  const openTickets = profile.tickets.filter((t) => !['solved', 'closed'].includes(t.status)).length;
  const openConvs = profile.conversations.filter((cv) => cv.status === 'open' || cv.status === 'waiting').length;
  const negativeConvs = profile.conversations.filter((cv) => cv.sentiment === 'negative').length;
  const recentTicket = profile.tickets[0];
  const recentOrder = profile.orders[0];

  const parts: string[] = [];
  if (c.orders_count > 0) {
    parts.push(`${c.orders_count} recorded order${c.orders_count === 1 ? '' : 's'} totaling $${(c.lifetime_value_cents / 100).toFixed(2)}`);
  } else {
    parts.push('no recorded orders yet');
  }
  if (profile.conversations.length > 0 || profile.tickets.length > 0) {
    parts.push(`${profile.conversations.length} conversation${profile.conversations.length === 1 ? '' : 's'} and ${profile.tickets.length} ticket${profile.tickets.length === 1 ? '' : 's'}`);
  } else {
    parts.push('no support history yet');
  }
  if (recentTicket) {
    parts.push(`most recent ticket #${recentTicket.number} (“${recentTicket.subject}”) is ${recentTicket.status}`);
  } else if (recentOrder) {
    parts.push(`latest order ${recentOrder.order_number} is ${recentOrder.status}`);
  }

  const summary = `${c.name || c.email || 'This customer'} has ${parts.join('; ')}.`;
  const signals: CustomerRecord['ai_signals'] = [];
  if (c.lifetime_value_cents >= 100000 || c.segment === 'vip') {
    signals.push({ label: 'High-value customer', tone: 'ok' });
  }
  if (negativeConvs > 0 || c.segment === 'churn_risk') {
    signals.push({ label: 'Needs proactive follow-up', tone: 'warn' });
  }
  if (openTickets > 0 || openConvs > 0) {
    signals.push({ label: `${openTickets + openConvs} active issue${openTickets + openConvs === 1 ? '' : 's'}`, tone: 'accent' });
  }
  if (profile.csatAverage !== null) {
    signals.push({
      label: `CSAT ${profile.csatAverage}/5 (${profile.csatCount})`,
      tone: profile.csatAverage >= 4 ? 'ok' : profile.csatAverage < 3 ? 'bad' : 'neutral',
    });
  }
  if (signals.length === 0) {
    signals.push({ label: `Segment: ${c.segment}`, tone: 'neutral' });
  }

  await queryRows(
    `UPDATE public.visitors
     SET ai_summary = $3, ai_signals = $4::jsonb
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, visitorId, summary, JSON.stringify(signals)],
  );

  return { summary, signals };
}

export async function startCustomerConversationAction(
  workspaceId: string,
  visitorId: string,
): Promise<{ conversationId: string }> {
  const { agent } = await getWorkspaceAccess(workspaceId, 'reply');
  assertUuid(visitorId, 'customer');

  const existing = await queryRows<{ id: string }>(
    `SELECT id FROM public.conversations
     WHERE workspace_id = $1 AND visitor_id = $2 AND status IN ('open', 'waiting', 'snoozed')
     ORDER BY updated_at DESC
     LIMIT 1`,
    [workspaceId, visitorId],
  );
  if (existing[0]) return { conversationId: existing[0].id };

  const [visitor] = await queryRows<{ email: string | null; channel: string | null }>(
    'SELECT email, channel FROM public.visitors WHERE workspace_id = $1 AND id = $2 LIMIT 1',
    [workspaceId, visitorId],
  );
  if (!visitor) throw userError('Customer not found.');

  const [created] = await queryRows<{ id: string }>(
    `INSERT INTO public.conversations (
       workspace_id, visitor_id, assigned_agent_id, status, priority, channel, customer_email, ai_enabled
     ) VALUES ($1, $2, $3, 'open', 'normal', $4, $5, false)
     RETURNING id`,
    [workspaceId, visitorId, agent.id, visitor.channel || 'web', visitor.email],
  );
  if (!created) throw userError('Could not start conversation.');
  return { conversationId: created.id };
}

const VALID_DEAL_STAGES: readonly CrmDealStage[] = ['lead', 'qualified', 'demo', 'proposal', 'won', 'lost'];
const STAGE_DEFAULT_PROBABILITY: Record<CrmDealStage, number> = {
  lead: 20,
  qualified: 40,
  demo: 60,
  proposal: 80,
  won: 100,
  lost: 0,
};
const VALID_TASK_KINDS: readonly CrmTaskKind[] = ['call', 'email', 'meeting', 'follow_up', 'todo'];
const VALID_TASK_PRIORITIES: readonly CrmTaskPriority[] = ['low', 'normal', 'high'];
const VALID_TASK_STATUSES: readonly CrmTaskStatus[] = ['open', 'completed'];

function normalizeDealStage(raw: unknown): CrmDealStage {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if ((VALID_DEAL_STAGES as readonly string[]).includes(s)) return s as CrmDealStage;
  return 'lead';
}

function normalizeTaskKind(raw: unknown): CrmTaskKind {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if ((VALID_TASK_KINDS as readonly string[]).includes(s)) return s as CrmTaskKind;
  return 'follow_up';
}

function normalizeTaskPriority(raw: unknown): CrmTaskPriority {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if ((VALID_TASK_PRIORITIES as readonly string[]).includes(s)) return s as CrmTaskPriority;
  return 'normal';
}

function normalizeTaskStatus(raw: unknown): CrmTaskStatus {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if ((VALID_TASK_STATUSES as readonly string[]).includes(s)) return s as CrmTaskStatus;
  return 'open';
}

function normalizeDateOnly(raw: string | null | undefined): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) throw userError('Enter a valid close date.');
  return parsed.toISOString().slice(0, 10);
}

function normalizeOptionalTimestamp(raw: string | null | undefined): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) throw userError('Enter a valid due date.');
  return parsed.toISOString();
}

function mapDealRow(r: Record<string, unknown>): CrmDealRecord {
  return {
    id: String(r.id),
    workspace_id: String(r.workspace_id),
    visitor_id: r.visitor_id ? String(r.visitor_id) : null,
    company_id: r.company_id ? String(r.company_id) : null,
    title: String(r.title || 'Untitled deal'),
    stage: normalizeDealStage(r.stage),
    value_cents: Number(r.value_cents ?? 0),
    currency: String(r.currency || 'USD'),
    probability: Number(r.probability ?? 0),
    expected_close_date: r.expected_close_date ? String(r.expected_close_date).slice(0, 10) : null,
    owner_id: r.owner_id ? String(r.owner_id) : null,
    notes: r.notes ? String(r.notes) : null,
    closed_at: r.closed_at ? String(r.closed_at) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    visitor_name: r.visitor_name ? String(r.visitor_name) : null,
    visitor_email: r.visitor_email ? String(r.visitor_email) : null,
    company_name: r.company_name ? String(r.company_name) : null,
    owner_name: r.owner_name ? String(r.owner_name) : null,
  };
}

function mapTaskRow(r: Record<string, unknown>): CrmTaskRecord {
  return {
    id: String(r.id),
    workspace_id: String(r.workspace_id),
    visitor_id: r.visitor_id ? String(r.visitor_id) : null,
    deal_id: r.deal_id ? String(r.deal_id) : null,
    title: String(r.title || ''),
    description: r.description ? String(r.description) : null,
    kind: normalizeTaskKind(r.kind),
    priority: normalizeTaskPriority(r.priority),
    status: normalizeTaskStatus(r.status),
    due_at: r.due_at ? String(r.due_at) : null,
    assignee_id: r.assignee_id ? String(r.assignee_id) : null,
    completed_at: r.completed_at ? String(r.completed_at) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    visitor_name: r.visitor_name ? String(r.visitor_name) : null,
    visitor_email: r.visitor_email ? String(r.visitor_email) : null,
    deal_title: r.deal_title ? String(r.deal_title) : null,
    assignee_name: r.assignee_name ? String(r.assignee_name) : null,
  };
}

function mapCompanyRow(r: Record<string, unknown>): CrmCompanyRecord {
  return {
    id: String(r.id),
    workspace_id: String(r.workspace_id),
    name: String(r.name || ''),
    domain: r.domain ? String(r.domain) : null,
    industry: r.industry ? String(r.industry) : null,
    size: r.size ? String(r.size) : null,
    website: r.website ? String(r.website) : null,
    annual_revenue_cents: Number(r.annual_revenue_cents ?? 0),
    notes: r.notes ? String(r.notes) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    contacts_count: Number(r.contacts_count ?? 0),
    open_deals_count: Number(r.open_deals_count ?? 0),
    pipeline_value_cents: Number(r.pipeline_value_cents ?? 0),
    lifetime_value_cents: Number(r.lifetime_value_cents ?? 0),
  };
}

export async function getCrmPickerOptionsAction(workspaceId: string): Promise<CrmPickerOptions> {
  await getWorkspaceAccess(workspaceId, 'view');
  await ensureSalesCrmTables();

  const [contactRows, companyRows, dealRows, agentRows] = await Promise.all([
    queryRows<{ id: string; name: string | null; email: string | null; company: string | null }>(
      `SELECT id, name, email, company
       FROM public.visitors
       WHERE workspace_id = $1
       ORDER BY last_seen_at DESC
       LIMIT 200`,
      [workspaceId],
    ),
    queryRows<{ id: string; name: string }>(
      `SELECT id, name
       FROM public.crm_companies
       WHERE workspace_id = $1
       ORDER BY LOWER(name) ASC
       LIMIT 200`,
      [workspaceId],
    ),
    queryRows<{ id: string; title: string; visitor_id: string | null }>(
      `SELECT id, title, visitor_id
       FROM public.crm_deals
       WHERE workspace_id = $1
       ORDER BY updated_at DESC
       LIMIT 200`,
      [workspaceId],
    ),
    queryRows<{ id: string; name: string | null; email: string | null }>(
      `SELECT id, name, email
       FROM public.agents
       WHERE workspace_id = $1 AND COALESCE(is_active, true) = true
       ORDER BY LOWER(COALESCE(name, email, '')) ASC
       LIMIT 100`,
      [workspaceId],
    ),
  ]);

  return {
    contacts: contactRows.map((c) => ({
      id: c.id,
      label: c.name || c.email || c.company || 'Unnamed contact',
      company: c.company,
    })),
    companies: companyRows.map((co) => ({
      id: co.id,
      label: co.name,
    })),
    deals: dealRows.map((d) => ({
      id: d.id,
      label: d.title,
      visitor_id: d.visitor_id,
    })),
    agents: agentRows.map((a) => ({
      id: a.id,
      label: a.name || a.email || 'Team member',
    })),
  };
}

export async function listCrmDealsAction(
  workspaceId: string,
  params: {
    stage?: CrmDealStage | 'all';
    q?: string;
    visitorId?: string;
    companyId?: string;
  } = {},
): Promise<{ deals: CrmDealRecord[]; summary: CrmDealsSummary }> {
  await getWorkspaceAccess(workspaceId, 'view');
  await ensureSalesCrmTables();

  const values: unknown[] = [workspaceId];
  const where: string[] = ['d.workspace_id = $1'];

  if (params.stage && params.stage !== 'all') {
    values.push(normalizeDealStage(params.stage));
    where.push(`d.stage = $${values.length}`);
  }
  if (params.visitorId) {
    assertUuid(params.visitorId, 'customer');
    values.push(params.visitorId);
    where.push(`d.visitor_id = $${values.length}`);
  }
  if (params.companyId) {
    assertUuid(params.companyId, 'company');
    values.push(params.companyId);
    where.push(`d.company_id = $${values.length}`);
  }
  const q = (params.q || '').trim();
  if (q) {
    values.push(`%${q}%`);
    const p = `$${values.length}`;
    where.push(
      `(d.title ILIKE ${p} OR COALESCE(v.name, '') ILIKE ${p} OR COALESCE(v.email, '') ILIKE ${p} OR COALESCE(co.name, '') ILIKE ${p} OR COALESCE(d.notes, '') ILIKE ${p})`,
    );
  }

  const [dealRows, summaryRows] = await Promise.all([
    queryRows<Record<string, unknown>>(
      `SELECT d.*, v.name AS visitor_name, v.email AS visitor_email, co.name AS company_name, a.name AS owner_name
       FROM public.crm_deals d
       LEFT JOIN public.visitors v ON v.id = d.visitor_id
       LEFT JOIN public.crm_companies co ON co.id = d.company_id
       LEFT JOIN public.agents a ON a.id = d.owner_id
       WHERE ${where.join(' AND ')}
       ORDER BY d.updated_at DESC
       LIMIT 250`,
      values,
    ),
    queryRows<{
      total_deals: number;
      open_deals: number;
      won_deals: number;
      lost_deals: number;
      pipeline_value_cents: string | number;
      weighted_value_cents: string | number;
      won_value_cents: string | number;
      lost_value_cents: string | number;
    }>(
      `SELECT
         COUNT(*)::int AS total_deals,
         COUNT(*) FILTER (WHERE stage NOT IN ('won', 'lost'))::int AS open_deals,
         COUNT(*) FILTER (WHERE stage = 'won')::int AS won_deals,
         COUNT(*) FILTER (WHERE stage = 'lost')::int AS lost_deals,
         COALESCE(SUM(value_cents) FILTER (WHERE stage NOT IN ('won', 'lost')), 0)::bigint AS pipeline_value_cents,
         COALESCE(SUM(ROUND(value_cents * probability / 100.0)) FILTER (WHERE stage NOT IN ('won', 'lost')), 0)::bigint AS weighted_value_cents,
         COALESCE(SUM(value_cents) FILTER (WHERE stage = 'won'), 0)::bigint AS won_value_cents,
         COALESCE(SUM(value_cents) FILTER (WHERE stage = 'lost'), 0)::bigint AS lost_value_cents
       FROM public.crm_deals
       WHERE workspace_id = $1`,
      [workspaceId],
    ),
  ]);

  const sRow = summaryRows[0];
  const wonDeals = Number(sRow?.won_deals ?? 0);
  const lostDeals = Number(sRow?.lost_deals ?? 0);
  const decided = wonDeals + lostDeals;

  return {
    deals: dealRows.map(mapDealRow),
    summary: {
      totalDeals: Number(sRow?.total_deals ?? 0),
      openDeals: Number(sRow?.open_deals ?? 0),
      wonDeals,
      lostDeals,
      pipelineValueCents: Number(sRow?.pipeline_value_cents ?? 0),
      weightedValueCents: Number(sRow?.weighted_value_cents ?? 0),
      wonValueCents: Number(sRow?.won_value_cents ?? 0),
      lostValueCents: Number(sRow?.lost_value_cents ?? 0),
      winRatePercent: decided > 0 ? Math.round((wonDeals / decided) * 100) : null,
    },
  };
}

export async function createCrmDealAction(
  workspaceId: string,
  input: {
    title: string;
    stage?: CrmDealStage;
    valueCents?: number;
    currency?: string;
    probability?: number;
    expectedCloseDate?: string | null;
    visitorId?: string | null;
    companyId?: string | null;
    ownerId?: string | null;
    notes?: string | null;
  },
): Promise<CrmDealRecord> {
  const { agent } = await getWorkspaceAccess(workspaceId, 'edit_content');
  await ensureSalesCrmTables();

  const title = (input.title || '').trim().slice(0, 160);
  if (!title) throw userError('Give the deal a title.');
  const stage = normalizeDealStage(input.stage);
  const valueCents = Math.max(0, Math.round(Number(input.valueCents) || 0));
  const currency = (input.currency || 'USD').trim().toUpperCase().slice(0, 8) || 'USD';
  const probability =
    typeof input.probability === 'number' && Number.isFinite(input.probability)
      ? Math.max(0, Math.min(100, Math.round(input.probability)))
      : STAGE_DEFAULT_PROBABILITY[stage];
  const expectedCloseDate = normalizeDateOnly(input.expectedCloseDate);

  const visitorId = input.visitorId?.trim() || null;
  if (visitorId) assertUuid(visitorId, 'customer');
  const companyId = input.companyId?.trim() || null;
  if (companyId) assertUuid(companyId, 'company');
  const ownerId = input.ownerId === null ? null : input.ownerId?.trim() || agent.id;
  if (ownerId) assertUuid(ownerId, 'owner');

  const closedAt = stage === 'won' || stage === 'lost' ? new Date().toISOString() : null;
  const notes = (input.notes || '').trim().slice(0, 4000) || null;

  const [created] = await queryRows<{ id: string }>(
    `INSERT INTO public.crm_deals (
       workspace_id, visitor_id, company_id, title, stage, value_cents, currency,
       probability, expected_close_date, owner_id, notes, closed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [workspaceId, visitorId, companyId, title, stage, valueCents, currency, probability, expectedCloseDate, ownerId, notes, closedAt],
  );
  if (!created) throw userError('Could not create deal.');

  const [full] = await queryRows<Record<string, unknown>>(
    `SELECT d.*, v.name AS visitor_name, v.email AS visitor_email, co.name AS company_name, a.name AS owner_name
     FROM public.crm_deals d
     LEFT JOIN public.visitors v ON v.id = d.visitor_id
     LEFT JOIN public.crm_companies co ON co.id = d.company_id
     LEFT JOIN public.agents a ON a.id = d.owner_id
     WHERE d.workspace_id = $1 AND d.id = $2
     LIMIT 1`,
    [workspaceId, created.id],
  );
  if (!full) throw userError('Could not load created deal.');
  return mapDealRow(full);
}

export async function updateCrmDealAction(
  workspaceId: string,
  dealId: string,
  patch: {
    title?: string;
    stage?: CrmDealStage;
    valueCents?: number;
    currency?: string;
    probability?: number;
    expectedCloseDate?: string | null;
    visitorId?: string | null;
    companyId?: string | null;
    ownerId?: string | null;
    notes?: string | null;
  },
): Promise<CrmDealRecord> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  assertUuid(dealId, 'deal');
  await ensureSalesCrmTables();

  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [workspaceId, dealId];
  const pushSet = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (patch.title !== undefined) {
    const clean = (patch.title || '').trim().slice(0, 160);
    if (!clean) throw userError('Deal title cannot be empty.');
    pushSet('title', clean);
  }
  if (patch.stage !== undefined) {
    const stage = normalizeDealStage(patch.stage);
    pushSet('stage', stage);
    if (stage === 'won' || stage === 'lost') {
      pushSet('closed_at', new Date().toISOString());
      if (patch.probability === undefined) {
        pushSet('probability', STAGE_DEFAULT_PROBABILITY[stage]);
      }
    } else {
      pushSet('closed_at', null);
    }
  }
  if (patch.valueCents !== undefined) {
    pushSet('value_cents', Math.max(0, Math.round(Number(patch.valueCents) || 0)));
  }
  if (patch.currency !== undefined) {
    pushSet('currency', (patch.currency || 'USD').trim().toUpperCase().slice(0, 8) || 'USD');
  }
  if (patch.probability !== undefined) {
    pushSet('probability', Math.max(0, Math.min(100, Math.round(Number(patch.probability) || 0))));
  }
  if (patch.expectedCloseDate !== undefined) {
    pushSet('expected_close_date', normalizeDateOnly(patch.expectedCloseDate));
  }
  if (patch.visitorId !== undefined) {
    const v = patch.visitorId?.trim() || null;
    if (v) assertUuid(v, 'customer');
    pushSet('visitor_id', v);
  }
  if (patch.companyId !== undefined) {
    const co = patch.companyId?.trim() || null;
    if (co) assertUuid(co, 'company');
    pushSet('company_id', co);
  }
  if (patch.ownerId !== undefined) {
    const o = patch.ownerId?.trim() || null;
    if (o) assertUuid(o, 'owner');
    pushSet('owner_id', o);
  }
  if (patch.notes !== undefined) {
    pushSet('notes', (patch.notes || '').trim().slice(0, 4000) || null);
  }

  const updated = await queryRows<{ id: string }>(
    `UPDATE public.crm_deals SET ${sets.join(', ')} WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    params,
  );
  if (!updated[0]) throw userError('Deal not found.');

  const [full] = await queryRows<Record<string, unknown>>(
    `SELECT d.*, v.name AS visitor_name, v.email AS visitor_email, co.name AS company_name, a.name AS owner_name
     FROM public.crm_deals d
     LEFT JOIN public.visitors v ON v.id = d.visitor_id
     LEFT JOIN public.crm_companies co ON co.id = d.company_id
     LEFT JOIN public.agents a ON a.id = d.owner_id
     WHERE d.workspace_id = $1 AND d.id = $2
     LIMIT 1`,
    [workspaceId, dealId],
  );
  if (!full) throw userError('Deal not found.');
  return mapDealRow(full);
}

export async function deleteCrmDealAction(workspaceId: string, dealId: string): Promise<void> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  assertUuid(dealId, 'deal');
  await ensureSalesCrmTables();
  await queryRows('DELETE FROM public.crm_deals WHERE workspace_id = $1 AND id = $2', [workspaceId, dealId]);
}

export async function listCrmTasksAction(
  workspaceId: string,
  params: {
    filter?: 'open' | 'overdue' | 'completed' | 'all';
    q?: string;
    visitorId?: string;
    dealId?: string;
  } = {},
): Promise<{ tasks: CrmTaskRecord[]; counts: { open: number; overdue: number; completed: number } }> {
  await getWorkspaceAccess(workspaceId, 'view');
  await ensureSalesCrmTables();

  const scopeValues: unknown[] = [workspaceId];
  const scopeWhere: string[] = ['t.workspace_id = $1'];
  if (params.visitorId) {
    assertUuid(params.visitorId, 'customer');
    scopeValues.push(params.visitorId);
    scopeWhere.push(`t.visitor_id = $${scopeValues.length}`);
  }
  if (params.dealId) {
    assertUuid(params.dealId, 'deal');
    scopeValues.push(params.dealId);
    scopeWhere.push(`t.deal_id = $${scopeValues.length}`);
  }

  const listValues = [...scopeValues];
  const listWhere = [...scopeWhere];

  const filter = params.filter ?? 'open';
  if (filter === 'open') {
    listWhere.push("t.status = 'open'");
  } else if (filter === 'overdue') {
    listWhere.push("t.status = 'open' AND t.due_at IS NOT NULL AND t.due_at < now()");
  } else if (filter === 'completed') {
    listWhere.push("t.status = 'completed'");
  }

  const q = (params.q || '').trim();
  if (q) {
    listValues.push(`%${q}%`);
    const p = `$${listValues.length}`;
    listWhere.push(
      `(t.title ILIKE ${p} OR COALESCE(t.description, '') ILIKE ${p} OR COALESCE(v.name, '') ILIKE ${p} OR COALESCE(d.title, '') ILIKE ${p})`,
    );
  }

  const [taskRows, countRows] = await Promise.all([
    queryRows<Record<string, unknown>>(
      `SELECT t.*, v.name AS visitor_name, v.email AS visitor_email, d.title AS deal_title, a.name AS assignee_name
       FROM public.crm_tasks t
       LEFT JOIN public.visitors v ON v.id = t.visitor_id
       LEFT JOIN public.crm_deals d ON d.id = t.deal_id
       LEFT JOIN public.agents a ON a.id = t.assignee_id
       WHERE ${listWhere.join(' AND ')}
       ORDER BY CASE WHEN t.status = 'open' THEN 0 ELSE 1 END, t.due_at ASC NULLS LAST, t.created_at DESC
       LIMIT 250`,
      listValues,
    ),
    queryRows<{ open: number; overdue: number; completed: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE t.status = 'open')::int AS open,
         COUNT(*) FILTER (WHERE t.status = 'open' AND t.due_at IS NOT NULL AND t.due_at < now())::int AS overdue,
         COUNT(*) FILTER (WHERE t.status = 'completed')::int AS completed
       FROM public.crm_tasks t
       WHERE ${scopeWhere.join(' AND ')}`,
      scopeValues,
    ),
  ]);

  const counts = countRows[0] ?? { open: 0, overdue: 0, completed: 0 };
  return {
    tasks: taskRows.map(mapTaskRow),
    counts: {
      open: Number(counts.open ?? 0),
      overdue: Number(counts.overdue ?? 0),
      completed: Number(counts.completed ?? 0),
    },
  };
}

export async function createCrmTaskAction(
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    kind?: CrmTaskKind;
    priority?: CrmTaskPriority;
    dueAt?: string | null;
    visitorId?: string | null;
    dealId?: string | null;
    assigneeId?: string | null;
  },
): Promise<CrmTaskRecord> {
  const { agent } = await getWorkspaceAccess(workspaceId, 'add_note');
  await ensureSalesCrmTables();

  const title = (input.title || '').trim().slice(0, 180);
  if (!title) throw userError('Give the task a title.');
  const kind = normalizeTaskKind(input.kind);
  const priority = normalizeTaskPriority(input.priority);
  const dueAt = normalizeOptionalTimestamp(input.dueAt);
  const description = (input.description || '').trim().slice(0, 2000) || null;

  const visitorId = input.visitorId?.trim() || null;
  if (visitorId) assertUuid(visitorId, 'customer');
  const dealId = input.dealId?.trim() || null;
  if (dealId) assertUuid(dealId, 'deal');
  const assigneeId = input.assigneeId === null ? null : input.assigneeId?.trim() || agent.id;
  if (assigneeId) assertUuid(assigneeId, 'assignee');

  const [created] = await queryRows<{ id: string }>(
    `INSERT INTO public.crm_tasks (
       workspace_id, visitor_id, deal_id, title, description, kind, priority, status, due_at, assignee_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9)
     RETURNING id`,
    [workspaceId, visitorId, dealId, title, description, kind, priority, dueAt, assigneeId],
  );
  if (!created) throw userError('Could not create task.');

  const [full] = await queryRows<Record<string, unknown>>(
    `SELECT t.*, v.name AS visitor_name, v.email AS visitor_email, d.title AS deal_title, a.name AS assignee_name
     FROM public.crm_tasks t
     LEFT JOIN public.visitors v ON v.id = t.visitor_id
     LEFT JOIN public.crm_deals d ON d.id = t.deal_id
     LEFT JOIN public.agents a ON a.id = t.assignee_id
     WHERE t.workspace_id = $1 AND t.id = $2
     LIMIT 1`,
    [workspaceId, created.id],
  );
  if (!full) throw userError('Could not load created task.');
  return mapTaskRow(full);
}

export async function updateCrmTaskAction(
  workspaceId: string,
  taskId: string,
  patch: {
    title?: string;
    description?: string | null;
    kind?: CrmTaskKind;
    priority?: CrmTaskPriority;
    status?: CrmTaskStatus;
    dueAt?: string | null;
    visitorId?: string | null;
    dealId?: string | null;
    assigneeId?: string | null;
  },
): Promise<CrmTaskRecord> {
  await getWorkspaceAccess(workspaceId, 'add_note');
  assertUuid(taskId, 'task');
  await ensureSalesCrmTables();

  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [workspaceId, taskId];
  const pushSet = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (patch.title !== undefined) {
    const clean = (patch.title || '').trim().slice(0, 180);
    if (!clean) throw userError('Task title cannot be empty.');
    pushSet('title', clean);
  }
  if (patch.description !== undefined) {
    pushSet('description', (patch.description || '').trim().slice(0, 2000) || null);
  }
  if (patch.kind !== undefined) pushSet('kind', normalizeTaskKind(patch.kind));
  if (patch.priority !== undefined) pushSet('priority', normalizeTaskPriority(patch.priority));
  if (patch.status !== undefined) {
    const status = normalizeTaskStatus(patch.status);
    pushSet('status', status);
    pushSet('completed_at', status === 'completed' ? new Date().toISOString() : null);
  }
  if (patch.dueAt !== undefined) pushSet('due_at', normalizeOptionalTimestamp(patch.dueAt));
  if (patch.visitorId !== undefined) {
    const v = patch.visitorId?.trim() || null;
    if (v) assertUuid(v, 'customer');
    pushSet('visitor_id', v);
  }
  if (patch.dealId !== undefined) {
    const d = patch.dealId?.trim() || null;
    if (d) assertUuid(d, 'deal');
    pushSet('deal_id', d);
  }
  if (patch.assigneeId !== undefined) {
    const a = patch.assigneeId?.trim() || null;
    if (a) assertUuid(a, 'assignee');
    pushSet('assignee_id', a);
  }

  const updated = await queryRows<{ id: string }>(
    `UPDATE public.crm_tasks SET ${sets.join(', ')} WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    params,
  );
  if (!updated[0]) throw userError('Task not found.');

  const [full] = await queryRows<Record<string, unknown>>(
    `SELECT t.*, v.name AS visitor_name, v.email AS visitor_email, d.title AS deal_title, a.name AS assignee_name
     FROM public.crm_tasks t
     LEFT JOIN public.visitors v ON v.id = t.visitor_id
     LEFT JOIN public.crm_deals d ON d.id = t.deal_id
     LEFT JOIN public.agents a ON a.id = t.assignee_id
     WHERE t.workspace_id = $1 AND t.id = $2
     LIMIT 1`,
    [workspaceId, taskId],
  );
  if (!full) throw userError('Task not found.');
  return mapTaskRow(full);
}

export async function deleteCrmTaskAction(workspaceId: string, taskId: string): Promise<void> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  assertUuid(taskId, 'task');
  await ensureSalesCrmTables();
  await queryRows('DELETE FROM public.crm_tasks WHERE workspace_id = $1 AND id = $2', [workspaceId, taskId]);
}

export async function listCrmCompaniesAction(
  workspaceId: string,
  params: { q?: string } = {},
): Promise<CrmCompanyRecord[]> {
  await getWorkspaceAccess(workspaceId, 'view');
  await ensureSalesCrmTables();

  const values: unknown[] = [workspaceId];
  const where: string[] = ['co.workspace_id = $1'];
  const q = (params.q || '').trim();
  if (q) {
    values.push(`%${q}%`);
    const p = `$${values.length}`;
    where.push(
      `(co.name ILIKE ${p} OR COALESCE(co.domain, '') ILIKE ${p} OR COALESCE(co.industry, '') ILIKE ${p} OR COALESCE(co.website, '') ILIKE ${p})`,
    );
  }

  const rows = await queryRows<Record<string, unknown>>(
    `SELECT
       co.*,
       COALESCE(vs.contacts_count, 0)::int AS contacts_count,
       COALESCE(vs.lifetime_value_cents, 0)::bigint AS lifetime_value_cents,
       COALESCE(ds.open_deals_count, 0)::int AS open_deals_count,
       COALESCE(ds.pipeline_value_cents, 0)::bigint AS pipeline_value_cents
     FROM public.crm_companies co
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS contacts_count, COALESCE(SUM(v.lifetime_value_cents), 0)::bigint AS lifetime_value_cents
       FROM public.visitors v
       WHERE v.workspace_id = co.workspace_id
         AND (
           LOWER(TRIM(COALESCE(v.company, ''))) = LOWER(TRIM(co.name))
           OR (co.domain IS NOT NULL AND co.domain <> '' AND LOWER(COALESCE(v.email, '')) LIKE '%@' || LOWER(TRIM(co.domain)))
         )
     ) vs ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS open_deals_count, COALESCE(SUM(d.value_cents), 0)::bigint AS pipeline_value_cents
       FROM public.crm_deals d
       WHERE d.workspace_id = co.workspace_id AND d.company_id = co.id AND d.stage NOT IN ('won', 'lost')
     ) ds ON true
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(ds.pipeline_value_cents, 0) DESC, COALESCE(vs.lifetime_value_cents, 0) DESC, LOWER(co.name) ASC
     LIMIT 250`,
    values,
  );

  return rows.map(mapCompanyRow);
}

export async function createCrmCompanyAction(
  workspaceId: string,
  input: {
    name: string;
    domain?: string | null;
    industry?: string | null;
    size?: string | null;
    website?: string | null;
    annualRevenueCents?: number;
    notes?: string | null;
  },
): Promise<CrmCompanyRecord> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  await ensureSalesCrmTables();

  const name = (input.name || '').trim().slice(0, 140);
  if (!name) throw userError('Enter a company name.');

  const [created] = await queryRows<Record<string, unknown>>(
    `INSERT INTO public.crm_companies (
       workspace_id, name, domain, industry, size, website, annual_revenue_cents, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *, 0 AS contacts_count, 0 AS open_deals_count, 0 AS pipeline_value_cents, 0 AS lifetime_value_cents`,
    [
      workspaceId,
      name,
      (input.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 120) || null,
      (input.industry || '').trim().slice(0, 80) || null,
      (input.size || '').trim().slice(0, 40) || null,
      (input.website || '').trim().slice(0, 240) || null,
      Math.max(0, Math.round(Number(input.annualRevenueCents) || 0)),
      (input.notes || '').trim().slice(0, 4000) || null,
    ],
  );
  if (!created) throw userError('Could not create company.');
  return mapCompanyRow(created);
}

export async function updateCrmCompanyAction(
  workspaceId: string,
  companyId: string,
  patch: {
    name?: string;
    domain?: string | null;
    industry?: string | null;
    size?: string | null;
    website?: string | null;
    annualRevenueCents?: number;
    notes?: string | null;
  },
): Promise<void> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  assertUuid(companyId, 'company');
  await ensureSalesCrmTables();

  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [workspaceId, companyId];
  const pushSet = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (patch.name !== undefined) {
    const clean = (patch.name || '').trim().slice(0, 140);
    if (!clean) throw userError('Company name cannot be empty.');
    pushSet('name', clean);
  }
  if (patch.domain !== undefined) {
    pushSet('domain', (patch.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 120) || null);
  }
  if (patch.industry !== undefined) pushSet('industry', (patch.industry || '').trim().slice(0, 80) || null);
  if (patch.size !== undefined) pushSet('size', (patch.size || '').trim().slice(0, 40) || null);
  if (patch.website !== undefined) pushSet('website', (patch.website || '').trim().slice(0, 240) || null);
  if (patch.annualRevenueCents !== undefined) {
    pushSet('annual_revenue_cents', Math.max(0, Math.round(Number(patch.annualRevenueCents) || 0)));
  }
  if (patch.notes !== undefined) pushSet('notes', (patch.notes || '').trim().slice(0, 4000) || null);

  const updated = await queryRows<{ id: string }>(
    `UPDATE public.crm_companies SET ${sets.join(', ')} WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    params,
  );
  if (!updated[0]) throw userError('Company not found.');
}

export async function deleteCrmCompanyAction(workspaceId: string, companyId: string): Promise<void> {
  await getWorkspaceAccess(workspaceId, 'edit_content');
  assertUuid(companyId, 'company');
  await ensureSalesCrmTables();
  await queryRows('DELETE FROM public.crm_companies WHERE workspace_id = $1 AND id = $2', [workspaceId, companyId]);
}
