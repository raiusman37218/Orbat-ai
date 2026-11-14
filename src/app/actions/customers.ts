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

export interface CustomerProfileData {
  customer: CustomerRecord;
  notes: CustomerNoteRecord[];
  orders: CustomerOrderRecord[];
  conversations: CustomerConversationItem[];
  tickets: CustomerTicketItem[];
  pageHistory: CustomerPageVisitItem[];
  csatAverage: number | null;
  csatCount: number;
}

export interface CustomersBootstrap {
  systemSegments: CustomerSegmentRecord[];
  customSegments: CustomerSegmentRecord[];
  countries: string[];
  tags: string[];
  canEdit: boolean;
  canAddNote: boolean;
  canReply: boolean;
  currentAgentId: string;
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

  const [countsRow] = await queryRows<{
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
  );

  const customRows = await queryRows<{
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
  );

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

  const [countryRows, tagRows] = await Promise.all([
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
  ]);

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

  const [countRow] = await queryRows<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM public.visitors v WHERE ${whereSql}`,
    values,
  );

  const listValues = [...values, pageSize, page * pageSize];
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
     WHERE ${whereSql}
     ORDER BY ${sortExpr} ${sortDir}, v.last_seen_at DESC
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues,
  );

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

  const [notes, orders, conversations, tickets, pageHistory] = await Promise.all([
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
