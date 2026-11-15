'use server';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { query, queryRows } from '@/lib/db';
import { sessionUser } from '@/lib/auth/session-user';
import { getPublicPlansAction } from '@/app/actions/plans';
import { getWorkspaceAccess } from '@/lib/team/access';
import { answerFromHelpCenter, buildModelContext } from '@/lib/ai/help-answer';
import { loadPlatformSmtp, loadWorkspaceSmtp } from '@/lib/email/workspace-smtp';
import { isValidEmail, sendSmtpEmail } from '@/lib/email/smtp';
import { generate6DigitCode } from '@/lib/auth/verification-code';
import { getRequestOrigin } from '@/lib/request-origin';
import { userError } from '@/lib/errors/user-error';
import { DEFAULT_PAYG_RATES, type PaygRateCatalog } from '@/lib/lifecycle/onboarding-catalog';
import {
  DEFAULT_LAUNCHER_ICON,
  DEFAULT_WIDGET_DESIGN,
  LAUNCHER_ICONS,
  WIDGET_COLOR_MODES,
  WIDGET_DESIGNS,
  isHexColor,
  isWidgetColorMode,
  isWidgetDesign,
  type WidgetColorMode,
  type WidgetDesignId,
  type WidgetIconChoice,
} from '@/lib/widget/launcher-icons';
import {
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_TTL_MS,
  hashPortalOtp,
  mapFourButtonCsatToDb,
  mapTicketStatusToPortalStep,
  parseTicketNumberQuery,
  signPortalSessionToken,
  verifyPortalSessionToken,
  type PortalCsatChoice,
} from '@/lib/portal/portal-helpers';
import type { PlatformPlan } from '@/types/plans';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Shared Public Workspace Resolution ─────────────────────────────────── */

export interface PublicWorkspaceSummary {
  id: string;
  name: string;
  slug: string | null;
  websiteUrl: string | null;
  brandColor: string;
  logoUrl: string | null;
  helpCenterTitle: string | null;
  helpCenterSubtitle: string | null;
  helpCenterFooterText: string | null;
  helpCenterAnnouncement: string | null;
  helpCenterEnabled: boolean;
  greetingTitle: string | null;
  greetingMessage: string | null;
}

interface WorkspaceDbRow {
  id: string;
  name: string;
  slug: string | null;
  website_url: string | null;
  brand_color: string | null;
  logo_url: string | null;
  help_center_title: string | null;
  help_center_subtitle: string | null;
  help_center_footer_text: string | null;
  help_center_theme: Record<string, unknown> | null;
  help_center_enabled: boolean | null;
  greeting_title: string | null;
  greeting_message: string | null;
  show_launcher_logo: boolean | null;
  widget_icon: string | null;
  widget_position: string | null;
  widget_disabled: boolean | null;
  launcher_offset_bottom: number | null;
  launcher_offset_side: number | null;
  widget_z_index: number | null;
  enable_proactive_welcome: boolean | null;
  proactive_delay_seconds: number | null;
  show_help_tab: boolean | null;
  help_center_tab_label: string | null;
  navbar_trigger_config: Record<string, unknown> | null;
}

function toWorkspaceSummary(row: WorkspaceDbRow): PublicWorkspaceSummary {
  const theme = row.help_center_theme && typeof row.help_center_theme === 'object' ? row.help_center_theme : {};
  const announcement =
    typeof theme.announcement === 'string' && theme.announcement.trim() ? theme.announcement.trim() : null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    websiteUrl: row.website_url,
    brandColor: row.brand_color && isHexColor(row.brand_color) ? row.brand_color : '#224F41',
    logoUrl: row.logo_url,
    helpCenterTitle: row.help_center_title,
    helpCenterSubtitle: row.help_center_subtitle,
    helpCenterFooterText: row.help_center_footer_text,
    helpCenterAnnouncement: announcement,
    helpCenterEnabled: row.help_center_enabled !== false,
    greetingTitle: row.greeting_title,
    greetingMessage: row.greeting_message,
  };
}

async function resolvePublicWorkspace(
  workspaceKey?: string | null,
): Promise<{
  workspace: WorkspaceDbRow | null;
  availableWorkspaces: Array<{ id: string; name: string; slug: string | null }>;
}> {
  const cleanKey = workspaceKey?.trim() || '';
  const allRows = await queryRows<{ id: string; name: string; slug: string | null }>(
    `SELECT id, name, slug
     FROM public.workspaces
     WHERE deleted_at IS NULL AND COALESCE(is_suspended, false) = false
     ORDER BY created_at ASC
     LIMIT 25`,
  );

  let resolvedId: string | null = null;
  if (cleanKey) {
    if (UUID_RE.test(cleanKey)) {
      const hit = await queryRows<{ id: string }>(
        `SELECT id FROM public.workspaces
         WHERE id = $1 AND deleted_at IS NULL AND COALESCE(is_suspended, false) = false
         LIMIT 1`,
        [cleanKey],
      );
      resolvedId = hit[0]?.id ?? null;
    } else {
      const hit = await queryRows<{ id: string }>(
        `SELECT id FROM public.workspaces
         WHERE LOWER(slug) = LOWER($1) AND deleted_at IS NULL AND COALESCE(is_suspended, false) = false
         LIMIT 1`,
        [cleanKey],
      );
      resolvedId = hit[0]?.id ?? null;
    }
  } else {
    try {
      const user = await sessionUser();
      if (user) {
        const agentWs = await queryRows<{ workspace_id: string | null }>(
          `SELECT workspace_id FROM public.agents WHERE id = $1 AND COALESCE(is_active, true) = true LIMIT 1`,
          [user.id],
        );
        if (agentWs[0]?.workspace_id) {
          resolvedId = agentWs[0].workspace_id;
        }
      }
    } catch {
      /* anonymous visitor */
    }
    if (!resolvedId && allRows[0]) {
      resolvedId = allRows[0].id;
    }
  }

  if (!resolvedId) {
    return { workspace: null, availableWorkspaces: allRows };
  }

  const wsRows = await queryRows<WorkspaceDbRow>(
    `SELECT id, name, slug, website_url, brand_color, logo_url,
            help_center_title, help_center_subtitle, help_center_footer_text,
            help_center_theme, help_center_enabled, greeting_title, greeting_message,
            show_launcher_logo, widget_icon, widget_position, widget_disabled,
            launcher_offset_bottom, launcher_offset_side, widget_z_index,
            enable_proactive_welcome, proactive_delay_seconds,
            show_help_tab, help_center_tab_label, navbar_trigger_config
     FROM public.workspaces
     WHERE id = $1 AND deleted_at IS NULL AND COALESCE(is_suspended, false) = false
     LIMIT 1`,
    [resolvedId],
  );

  return {
    workspace: wsRows[0] ?? null,
    availableWorkspaces: allRows,
  };
}

/* ── #36 Pricing Bundle ─────────────────────────────────────────────────── */

export interface PublicPricingBundle {
  plans: PlatformPlan[];
  paygRates: PaygRateCatalog;
  stripeCheckoutConfigured: boolean;
  isSignedIn: boolean;
}

export async function getPublicPricingBundleAction(): Promise<PublicPricingBundle> {
  const [plans, settingsRows, user] = await Promise.all([
    getPublicPlansAction(),
    queryRows<{ payg_rates: Record<string, unknown> | null }>(
      `SELECT payg_rates FROM public.platform_settings WHERE id = 'default' LIMIT 1`,
    ),
    sessionUser().catch(() => null),
  ]);

  const rawRates = settingsRows[0]?.payg_rates || {};
  const paygRates: PaygRateCatalog = {
    conversationBaseUsd: Number(
      rawRates.conversationBaseUsd ??
        rawRates.conversation_base ??
        DEFAULT_PAYG_RATES.conversationBaseUsd,
    ),
    aiLightUsd: Number(
      rawRates.aiLightUsd ?? rawRates.ai_light ?? DEFAULT_PAYG_RATES.aiLightUsd,
    ),
    aiStandardUsd: Number(
      rawRates.aiStandardUsd ?? rawRates.ai_standard ?? DEFAULT_PAYG_RATES.aiStandardUsd,
    ),
    aiAdvancedUsd: Number(
      rawRates.aiAdvancedUsd ?? rawRates.ai_advanced ?? DEFAULT_PAYG_RATES.aiAdvancedUsd,
    ),
    voiceMinuteUsd: Number(
      rawRates.voiceMinuteUsd ?? rawRates.voice_minute ?? DEFAULT_PAYG_RATES.voiceMinuteUsd,
    ),
    websiteAuditUsd: Number(
      rawRates.websiteAuditUsd ?? rawRates.website_audit ?? DEFAULT_PAYG_RATES.websiteAuditUsd,
    ),
  };

  return {
    plans,
    paygRates,
    stripeCheckoutConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    isSignedIn: Boolean(user),
  };
}

/* ── #37 Public Help Center ─────────────────────────────────────────────── */

export interface PublicHelpSection {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  articleCount: number;
}

export interface PublicHelpArticleSummary {
  id: string;
  sectionId: string | null;
  sectionName: string | null;
  title: string;
  slug: string | null;
  category: string;
  summary: string | null;
  content: string;
  viewsCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  updatedAt: string;
  authorName: string | null;
  languages: string[];
}

export interface PublicHelpCenterBundle {
  workspace: PublicWorkspaceSummary | null;
  availableWorkspaces: Array<{ id: string; name: string; slug: string | null }>;
  sections: PublicHelpSection[];
  articles: PublicHelpArticleSummary[];
  hasOrders: boolean;
}

export async function getPublicHelpCenterBundleAction(
  workspaceKey?: string | null,
): Promise<PublicHelpCenterBundle> {
  const { workspace, availableWorkspaces } = await resolvePublicWorkspace(workspaceKey);
  if (!workspace) {
    return {
      workspace: null,
      availableWorkspaces,
      sections: [],
      articles: [],
      hasOrders: false,
    };
  }

  const [sectionRows, articleRows, orderCountRows] = await Promise.all([
    queryRows<{ id: string; name: string; description: string | null; icon: string }>(
      `SELECT id, name, description, COALESCE(icon, 'book') AS icon
       FROM public.help_sections
       WHERE workspace_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [workspace.id],
    ),
    queryRows<{
      id: string;
      section_id: string | null;
      section_name: string | null;
      title: string;
      slug: string | null;
      category: string;
      summary: string | null;
      content: string;
      views_count: number;
      helpful_count: number;
      not_helpful_count: number;
      updated_at: string;
      author_name: string | null;
      languages: string[] | null;
    }>(
      `SELECT a.id, a.section_id, hs.name AS section_name, a.title, a.slug, a.category,
              a.summary, a.content, a.views_count, a.helpful_count, a.not_helpful_count,
              a.updated_at::text AS updated_at, ag.name AS author_name, a.languages
       FROM public.articles a
       LEFT JOIN public.help_sections hs ON hs.id = a.section_id
       LEFT JOIN public.agents ag ON ag.id = a.author_id
       WHERE a.workspace_id = $1 AND a.status = 'published'
       ORDER BY a.order_index ASC, a.views_count DESC, a.created_at ASC`,
      [workspace.id],
    ),
    queryRows<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM public.customer_orders WHERE workspace_id = $1`,
      [workspace.id],
    ),
  ]);

  const countsBySection = new Map<string, number>();
  for (const art of articleRows) {
    if (art.section_id) {
      countsBySection.set(art.section_id, (countsBySection.get(art.section_id) ?? 0) + 1);
    }
  }

  return {
    workspace: toWorkspaceSummary(workspace),
    availableWorkspaces,
    sections: sectionRows.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      icon: s.icon,
      articleCount: countsBySection.get(s.id) ?? 0,
    })),
    articles: articleRows.map((a) => ({
      id: a.id,
      sectionId: a.section_id,
      sectionName: a.section_name,
      title: a.title,
      slug: a.slug,
      category: a.category,
      summary: a.summary,
      content: a.content,
      viewsCount: Number(a.views_count ?? 0),
      helpfulCount: Number(a.helpful_count ?? 0),
      notHelpfulCount: Number(a.not_helpful_count ?? 0),
      updatedAt: a.updated_at,
      authorName: a.author_name,
      languages: Array.isArray(a.languages) ? a.languages : ['en'],
    })),
    hasOrders: Number(orderCountRows[0]?.cnt ?? 0) > 0,
  };
}

export async function recordHelpArticleViewAction(
  workspaceId: string,
  articleId: string,
): Promise<{ viewsCount: number }> {
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(articleId)) {
    throw userError('Article not found.');
  }
  const rows = await queryRows<{ views_count: number }>(
    `UPDATE public.articles
     SET views_count = views_count + 1
     WHERE workspace_id = $1 AND id = $2 AND status = 'published'
     RETURNING views_count`,
    [workspaceId, articleId],
  );
  return { viewsCount: Number(rows[0]?.views_count ?? 0) };
}

export async function voteHelpArticleHelpfulAction(
  workspaceId: string,
  articleId: string,
  helpful: boolean,
): Promise<{ helpfulCount: number; notHelpfulCount: number }> {
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(articleId)) {
    throw userError('Article not found.');
  }
  const rows = await queryRows<{ helpful_count: number; not_helpful_count: number }>(
    helpful
      ? `UPDATE public.articles
         SET helpful_count = helpful_count + 1
         WHERE workspace_id = $1 AND id = $2 AND status = 'published'
         RETURNING helpful_count, not_helpful_count`
      : `UPDATE public.articles
         SET not_helpful_count = not_helpful_count + 1
         WHERE workspace_id = $1 AND id = $2 AND status = 'published'
         RETURNING helpful_count, not_helpful_count`,
    [workspaceId, articleId],
  );
  if (!rows[0]) {
    throw userError('Article not found.');
  }
  return {
    helpfulCount: Number(rows[0].helpful_count ?? 0),
    notHelpfulCount: Number(rows[0].not_helpful_count ?? 0),
  };
}

export interface HelpSearchAiResult {
  query: string;
  answer: string | null;
  confidence: string;
  citedArticle: { id: string; title: string; slug: string | null } | null;
  reason: string;
  matchingArticleIds: string[];
}

export async function searchHelpCenterAndAskAction(
  workspaceId: string,
  queryText: string,
): Promise<HelpSearchAiResult> {
  if (!UUID_RE.test(workspaceId)) {
    throw userError('Workspace not found.');
  }
  const q = queryText.trim();
  if (!q) {
    return {
      query: '',
      answer: null,
      confidence: 'none',
      citedArticle: null,
      reason: 'Empty query',
      matchingArticleIds: [],
    };
  }

  const like = `%${q.toLowerCase()}%`;
  const [matchedRows, origin] = await Promise.all([
    queryRows<{ id: string }>(
      `SELECT id FROM public.articles
       WHERE workspace_id = $1 AND status = 'published'
         AND (LOWER(title) LIKE $2 OR LOWER(COALESCE(summary, '')) LIKE $2 OR LOWER(content) LIKE $2)
       ORDER BY CASE WHEN LOWER(title) LIKE $2 THEN 0 ELSE 1 END, views_count DESC
       LIMIT 20`,
      [workspaceId, like],
    ),
    getRequestOrigin().catch(() => 'https://orbatai.com'),
  ]);

  const helpUrl = `${origin}/help/${workspaceId}`;
  try {
    const retrieved = await buildModelContext(workspaceId, q, {
      articlesOnly: true,
      limit: 4,
      helpCenterUrl: helpUrl,
    });

    const ans = await answerFromHelpCenter({
      workspaceId,
      message: q,
      helpCenterUrl: helpUrl,
      chunks: retrieved.chunks,
      belowThreshold: retrieved.belowThreshold,
      queryEmbedding: retrieved.queryEmbedding,
      articlesOnly: true,
    });

    return {
      query: q,
      answer: ans.text,
      confidence: ans.confidence,
      citedArticle: ans.article
        ? { id: ans.article.id, title: ans.article.title, slug: ans.article.slug ?? null }
        : null,
      reason: ans.reason,
      matchingArticleIds: matchedRows.map((r) => r.id),
    };
  } catch {
    return {
      query: q,
      answer: null,
      confidence: 'none',
      citedArticle: null,
      reason: 'No matching published article answered this query.',
      matchingArticleIds: matchedRows.map((r) => r.id),
    };
  }
}

export interface PublicOrderLookupResult {
  found: boolean;
  message?: string;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    currency: string;
    totalCents: number;
    itemsSummary: string | null;
    orderedAt: string;
    externalSource: string | null;
  };
}

export async function lookupPublicOrderAction(
  workspaceId: string,
  orderNumber: string,
  verifier: string,
): Promise<PublicOrderLookupResult> {
  if (!UUID_RE.test(workspaceId)) {
    throw userError('Workspace not found.');
  }
  const cleanOrder = orderNumber.trim().replace(/^#/, '');
  const cleanVerifier = verifier.trim().toLowerCase();
  if (!cleanOrder || !cleanVerifier) {
    throw userError('Enter your order number and billing email or phone.');
  }

  const rows = await queryRows<{
    id: string;
    order_number: string;
    status: string;
    currency: string;
    total_cents: number;
    items_summary: string | null;
    ordered_at: string;
    external_source: string | null;
    visitor_email: string | null;
    visitor_phone: string | null;
  }>(
    `SELECT o.id, o.order_number, o.status, o.currency, o.total_cents, o.items_summary,
            o.ordered_at::text AS ordered_at, o.external_source,
            v.email AS visitor_email, v.phone AS visitor_phone
     FROM public.customer_orders o
     JOIN public.visitors v ON v.id = o.visitor_id
     WHERE o.workspace_id = $1
       AND LOWER(REPLACE(o.order_number, '#', '')) = LOWER($2)
     LIMIT 1`,
    [workspaceId, cleanOrder],
  );

  const row = rows[0];
  if (!row) {
    return {
      found: false,
      message: 'No order matched that number in this workspace.',
    };
  }

  const emailMatches = row.visitor_email?.trim().toLowerCase() === cleanVerifier;
  const normalizedPhone = (row.visitor_phone || '').replace(/\D+/g, '');
  const verifierDigits = cleanVerifier.replace(/\D+/g, '');
  const phoneMatches =
    verifierDigits.length >= 4 && normalizedPhone.endsWith(verifierDigits);

  if (!emailMatches && !phoneMatches) {
    return {
      found: false,
      message: 'Order found, but email or phone did not match.',
    };
  }

  return {
    found: true,
    order: {
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      currency: row.currency,
      totalCents: Number(row.total_cents ?? 0),
      itemsSummary: row.items_summary,
      orderedAt: row.ordered_at,
      externalSource: row.external_source,
    },
  };
}

async function setSignedPortalSessionCookie(
  workspaceId: string,
  email: string,
  name?: string | null,
): Promise<string[]> {
  const cleanEmail = email.trim().toLowerCase();
  const visitors = await queryRows<{ id: string; name: string | null }>(
    `SELECT id, name FROM public.visitors
     WHERE workspace_id = $1 AND LOWER(email) = $2
     ORDER BY last_seen_at DESC
     LIMIT 25`,
    [workspaceId, cleanEmail],
  );
  const visitorIds = visitors.map((v) => v.id);
  const resolvedName = name || visitors[0]?.name || null;
  const now = Date.now();
  const token = signPortalSessionToken({
    workspaceId,
    email: cleanEmail,
    name: resolvedName,
    visitorIds,
    issuedAt: now,
    expiresAt: now + PORTAL_SESSION_TTL_MS,
  });

  const store = await cookies();
  store.set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(PORTAL_SESSION_TTL_MS / 1000),
  });

  return visitorIds;
}

export async function submitHelpCenterTicketAction(input: {
  workspaceId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: string;
}): Promise<{ ticketId: string; ticketNumber: number }> {
  if (!UUID_RE.test(input.workspaceId)) {
    throw userError('Workspace not found.');
  }
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanName = input.name.trim() || cleanEmail.split('@')[0] || 'Customer';
  const cleanSubject = input.subject.trim();
  const cleanMessage = input.message.trim();

  if (!isValidEmail(cleanEmail)) throw userError('Enter a valid email address.');
  if (!cleanSubject) throw userError('Enter a short subject.');
  if (!cleanMessage) throw userError('Describe how we can help.');

  const existingVisitor = await queryRows<{ id: string }>(
    `SELECT id FROM public.visitors
     WHERE workspace_id = $1 AND LOWER(email) = $2
     ORDER BY last_seen_at DESC
     LIMIT 1`,
    [input.workspaceId, cleanEmail],
  );

  let visitorId = existingVisitor[0]?.id;
  if (!visitorId) {
    const insertedVisitor = await queryRows<{ id: string }>(
      `INSERT INTO public.visitors (workspace_id, name, email, current_page_url, channel)
       VALUES ($1, $2, $3, '/help', 'web_form')
       RETURNING id`,
      [input.workspaceId, cleanName, cleanEmail],
    );
    visitorId = insertedVisitor[0]?.id;
  }

  if (!visitorId) {
    throw new Error('Could not register customer contact record.');
  }

  const convRows = await queryRows<{ id: string; current_ticket_id: string | null }>(
    `INSERT INTO public.conversations
       (workspace_id, visitor_id, channel, status, priority, customer_email, channel_metadata)
     VALUES
       ($1, $2, 'web_form', 'open', 'normal', $3, $4::jsonb)
     RETURNING id, current_ticket_id`,
    [
      input.workspaceId,
      visitorId,
      cleanEmail,
      JSON.stringify({
        ticket_subject: cleanSubject.slice(0, 250),
        ticket_channel: 'web_form',
        ticket_type: 'question',
        category: input.category || null,
      }),
    ],
  );

  const conv = convRows[0];
  if (!conv?.id || !conv.current_ticket_id) {
    throw new Error('Could not open support request.');
  }

  const ticketRows = await queryRows<{ id: string; number: number }>(
    `SELECT id, number FROM public.tickets WHERE id = $1 LIMIT 1`,
    [conv.current_ticket_id],
  );

  await query(
    `INSERT INTO public.messages (conversation_id, ticket_id, sender_type, sender_id, content, is_internal)
     VALUES ($1, $2, 'visitor', $3, $4, false)`,
    [conv.id, conv.current_ticket_id, visitorId, cleanMessage.slice(0, 4000)],
  );

  await setSignedPortalSessionCookie(input.workspaceId, cleanEmail, cleanName);

  return {
    ticketId: ticketRows[0].id,
    ticketNumber: Number(ticketRows[0].number),
  };
}

/* ── #38 Customer Portal ────────────────────────────────────────────────── */

export interface PortalTicketMessage {
  id: string;
  senderType: 'visitor' | 'agent' | 'system' | 'ai';
  senderName: string;
  content: string;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface PortalTicketItem {
  id: string;
  number: number;
  subject: string;
  status: string;
  portalStep: 0 | 1 | 2;
  portalStepLabel: 'Received' | 'In progress' | 'Solved';
  portalBucket: 'open' | 'solved';
  channel: string;
  assigneeName: string | null;
  csatRating: string | null;
  csatRatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string | null;
  messages: PortalTicketMessage[];
}

export interface CustomerPortalBundle {
  workspace: PublicWorkspaceSummary | null;
  availableWorkspaces: Array<{ id: string; name: string; slug: string | null }>;
  signedIn: boolean;
  customerEmail: string | null;
  customerName: string | null;
  tickets: PortalTicketItem[];
  smtpConfigured: boolean;
}

async function readActivePortalSession(workspaceId: string) {
  const store = await cookies();
  const raw = store.get(PORTAL_SESSION_COOKIE)?.value;
  const parsed = verifyPortalSessionToken(raw);
  if (!parsed || parsed.workspaceId !== workspaceId) {
    return null;
  }
  return parsed;
}

export async function getCustomerPortalBundleAction(
  workspaceKey?: string | null,
): Promise<CustomerPortalBundle> {
  const { workspace, availableWorkspaces } = await resolvePublicWorkspace(workspaceKey);
  if (!workspace) {
    return {
      workspace: null,
      availableWorkspaces,
      signedIn: false,
      customerEmail: null,
      customerName: null,
      tickets: [],
      smtpConfigured: false,
    };
  }

  const [session, wsSmtp, platSmtp] = await Promise.all([
    readActivePortalSession(workspace.id),
    loadWorkspaceSmtp(workspace.id).catch(() => null),
    loadPlatformSmtp().catch(() => null),
  ]);
  const smtpConfigured = Boolean(wsSmtp || platSmtp);

  if (!session || session.visitorIds.length === 0) {
    return {
      workspace: toWorkspaceSummary(workspace),
      availableWorkspaces,
      signedIn: false,
      customerEmail: session?.email ?? null,
      customerName: session?.name ?? null,
      tickets: [],
      smtpConfigured,
    };
  }

  const ticketRows = await queryRows<{
    id: string;
    number: number;
    subject: string;
    status: string;
    channel: string;
    assignee_name: string | null;
    csat_rating: string | null;
    csat_rated_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT t.id, t.number, t.subject, t.status, t.channel,
            ag.name AS assignee_name, t.csat_rating, t.csat_rated_at::text AS csat_rated_at,
            t.created_at::text AS created_at, t.updated_at::text AS updated_at
     FROM public.tickets t
     LEFT JOIN public.agents ag ON ag.id = t.assignee_id
     WHERE t.workspace_id = $1
       AND t.requester_id = ANY($2::uuid[])
       AND t.merged_into_id IS NULL
     ORDER BY t.updated_at DESC
     LIMIT 50`,
    [workspace.id, session.visitorIds],
  );

  const ticketIds = ticketRows.map((t) => t.id);
  const messagesByTicket = new Map<string, PortalTicketMessage[]>();

  if (ticketIds.length > 0) {
    const msgRows = await queryRows<{
      id: string;
      ticket_id: string | null;
      sender_type: 'visitor' | 'agent' | 'system' | 'ai';
      sender_name: string | null;
      content: string;
      attachment_url: string | null;
      created_at: string;
    }>(
      `SELECT m.id, m.ticket_id, m.sender_type,
              CASE
                WHEN m.sender_type = 'agent' THEN COALESCE(ag.name, 'Support specialist')
                WHEN m.sender_type = 'ai' THEN COALESCE(ai.name, 'AI assistant')
                WHEN m.sender_type = 'system' THEN 'System'
                ELSE COALESCE(v.name, $2)
              END AS sender_name,
              m.content, m.attachment_url, m.created_at::text AS created_at
       FROM public.messages m
       LEFT JOIN public.agents ag ON ag.id = m.sender_id AND m.sender_type = 'agent'
       LEFT JOIN public.ai_agents ai ON ai.id = m.sender_id AND m.sender_type = 'ai'
       LEFT JOIN public.visitors v ON v.id = m.sender_id AND m.sender_type = 'visitor'
       WHERE m.ticket_id = ANY($1::uuid[])
         AND COALESCE(m.is_internal, false) = false
       ORDER BY m.created_at ASC`,
      [ticketIds, session.name || session.email],
    );

    for (const m of msgRows) {
      if (!m.ticket_id) continue;
      const list = messagesByTicket.get(m.ticket_id) ?? [];
      list.push({
        id: m.id,
        senderType: m.sender_type,
        senderName: m.sender_name || 'Customer',
        content: m.content,
        attachmentUrl: m.attachment_url,
        createdAt: m.created_at,
      });
      messagesByTicket.set(m.ticket_id, list);
    }
  }

  return {
    workspace: toWorkspaceSummary(workspace),
    availableWorkspaces,
    signedIn: true,
    customerEmail: session.email,
    customerName: session.name ?? session.email,
    tickets: ticketRows.map((t) => {
      const mapped = mapTicketStatusToPortalStep(t.status);
      const msgs = messagesByTicket.get(t.id) ?? [];
      const last = msgs[msgs.length - 1];
      return {
        id: t.id,
        number: Number(t.number),
        subject: t.subject || `Request #${t.number}`,
        status: t.status,
        portalStep: mapped.step,
        portalStepLabel: mapped.label,
        portalBucket: mapped.bucket,
        channel: t.channel,
        assigneeName: t.assignee_name,
        csatRating: t.csat_rating,
        csatRatedAt: t.csat_rated_at,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        lastMessagePreview: last ? last.content.slice(0, 140) : null,
        messages: msgs,
      };
    }),
    smtpConfigured,
  };
}

export async function verifyPortalByTicketAction(input: {
  workspaceId: string;
  email: string;
  ticketReference: string;
}): Promise<{ verified: boolean; error?: string }> {
  if (!UUID_RE.test(input.workspaceId)) {
    return { verified: false, error: 'Workspace not found.' };
  }
  const cleanEmail = input.email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    return { verified: false, error: 'Enter the email address used on your request.' };
  }
  const num = parseTicketNumberQuery(input.ticketReference);
  if (!num) {
    return { verified: false, error: 'Enter a valid ticket number (e.g. TCK-1001 or 1001).' };
  }

  const hit = await queryRows<{ ticket_id: string; visitor_name: string | null }>(
    `SELECT t.id AS ticket_id, v.name AS visitor_name
     FROM public.tickets t
     JOIN public.visitors v ON v.id = t.requester_id
     WHERE t.workspace_id = $1
       AND t.number = $2
       AND LOWER(v.email) = $3
     LIMIT 1`,
    [input.workspaceId, num, cleanEmail],
  );

  if (!hit[0]) {
    return {
      verified: false,
      error: 'No request matched that email and ticket number combination.',
    };
  }

  await setSignedPortalSessionCookie(input.workspaceId, cleanEmail, hit[0].visitor_name);
  return { verified: true };
}

export async function requestPortalVerificationCodeAction(input: {
  workspaceId: string;
  email: string;
}): Promise<{
  sent: boolean;
  deliveryMethod: 'smtp' | 'smtp_unconfigured' | 'failed';
  message: string;
}> {
  if (!UUID_RE.test(input.workspaceId)) {
    throw userError('Workspace not found.');
  }
  const cleanEmail = input.email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    throw userError('Enter a valid email address.');
  }

  const existing = await queryRows<{ id: string }>(
    `SELECT id FROM public.visitors WHERE workspace_id = $1 AND LOWER(email) = $2 LIMIT 1`,
    [input.workspaceId, cleanEmail],
  );
  if (!existing[0]) {
    return {
      sent: false,
      deliveryMethod: 'failed',
      message: 'No requests found under that email address in this workspace.',
    };
  }

  const smtp =
    (await loadWorkspaceSmtp(input.workspaceId).catch(() => null)) ||
    (await loadPlatformSmtp().catch(() => null));

  if (!smtp) {
    return {
      sent: false,
      deliveryMethod: 'smtp_unconfigured',
      message:
        'Workspace outbound SMTP is not configured yet. Sign in using your email and any ticket number (e.g. TCK-1001), or ask your team to configure SMTP in Settings.',
    };
  }

  const recent = await queryRows<{ created_at: string }>(
    `SELECT created_at::text AS created_at
     FROM public.customer_portal_verifications
     WHERE workspace_id = $1 AND LOWER(email) = $2
     ORDER BY created_at DESC LIMIT 1`,
    [input.workspaceId, cleanEmail],
  );
  if (recent[0]) {
    const elapsedSec = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000;
    if (elapsedSec < 60) {
      throw userError(`Please wait ${Math.ceil(60 - elapsedSec)}s before requesting another code.`);
    }
  }

  const code = generate6DigitCode();
  const codeHash = hashPortalOtp(cleanEmail, code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await query(
    `INSERT INTO public.customer_portal_verifications (workspace_id, email, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [input.workspaceId, cleanEmail, codeHash, expiresAt],
  );

  const wsRows = await queryRows<{ name: string }>(
    `SELECT name FROM public.workspaces WHERE id = $1 LIMIT 1`,
    [input.workspaceId],
  );
  const brand = wsRows[0]?.name || 'Support';

  const result = await sendSmtpEmail(smtp, {
    to: cleanEmail,
    subject: `${brand}: Your customer portal sign-in code`,
    text: `Your ${brand} verification code is: ${code}\n\nIt expires in 15 minutes.`,
    html: `<p>Your <strong>${brand}</strong> verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 15 minutes.</p>`,
  });

  if (!result.success) {
    return {
      sent: false,
      deliveryMethod: 'failed',
      message: result.error || 'Could not deliver the sign-in email.',
    };
  }

  return {
    sent: true,
    deliveryMethod: 'smtp',
    message: `We sent a 6-digit verification code to ${cleanEmail}.`,
  };
}

export async function verifyPortalOtpAction(input: {
  workspaceId: string;
  email: string;
  code: string;
}): Promise<{ verified: boolean; error?: string }> {
  if (!UUID_RE.test(input.workspaceId)) {
    return { verified: false, error: 'Workspace not found.' };
  }
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanCode = input.code.trim();
  if (!isValidEmail(cleanEmail) || !/^\d{6}$/.test(cleanCode)) {
    return { verified: false, error: 'Enter your email and the 6-digit code.' };
  }

  const rows = await queryRows<{ id: string; code_hash: string; attempts: number }>(
    `SELECT id, code_hash, attempts
     FROM public.customer_portal_verifications
     WHERE workspace_id = $1
       AND LOWER(email) = $2
       AND verified_at IS NULL
       AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.workspaceId, cleanEmail],
  );

  const row = rows[0];
  if (!row) {
    return { verified: false, error: 'Verification code expired or not requested.' };
  }
  if (row.attempts >= 5) {
    return { verified: false, error: 'Too many invalid attempts. Request a new code.' };
  }

  const expectedHash = hashPortalOtp(cleanEmail, cleanCode);
  const a = Buffer.from(row.code_hash, 'utf8');
  const b = Buffer.from(expectedHash, 'utf8');
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!matches) {
    await query(
      `UPDATE public.customer_portal_verifications SET attempts = attempts + 1 WHERE id = $1`,
      [row.id],
    );
    return { verified: false, error: 'Invalid verification code.' };
  }

  await query(
    `UPDATE public.customer_portal_verifications SET verified_at = now() WHERE id = $1`,
    [row.id],
  );
  await setSignedPortalSessionCookie(input.workspaceId, cleanEmail);
  return { verified: true };
}

async function assertPortalOwnsTicket(workspaceId: string, ticketId: string) {
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(ticketId)) {
    throw userError('Request not found.');
  }
  const session = await readActivePortalSession(workspaceId);
  if (!session || session.visitorIds.length === 0) {
    throw userError('Sign in to your customer portal session first.');
  }
  const rows = await queryRows<{
    id: string;
    conversation_id: string | null;
    requester_id: string | null;
    status: string;
  }>(
    `SELECT id, conversation_id, requester_id, status
     FROM public.tickets
     WHERE id = $1 AND workspace_id = $2 AND requester_id = ANY($3::uuid[])
     LIMIT 1`,
    [ticketId, workspaceId, session.visitorIds],
  );
  if (!rows[0]) {
    throw userError('You do not have access to this support request.');
  }
  return { session, ticket: rows[0] };
}

export async function replyToPortalTicketAction(input: {
  workspaceId: string;
  ticketId: string;
  body: string;
}): Promise<{ ok: true }> {
  const body = input.body.trim();
  if (!body) throw userError('Write a reply before sending.');
  const { ticket } = await assertPortalOwnsTicket(input.workspaceId, input.ticketId);
  if (ticket.status === 'closed') {
    throw userError('This ticket is closed. Open a new request instead.');
  }

  let conversationId = ticket.conversation_id;
  if (!conversationId && ticket.requester_id) {
    const createdConv = await queryRows<{ id: string }>(
      `INSERT INTO public.conversations (workspace_id, visitor_id, channel, status, current_ticket_id)
       VALUES ($1, $2, 'web_form', 'open', $3)
       RETURNING id`,
      [input.workspaceId, ticket.requester_id, ticket.id],
    );
    conversationId = createdConv[0]?.id ?? null;
    if (conversationId) {
      await query(`UPDATE public.tickets SET conversation_id = $1 WHERE id = $2`, [
        conversationId,
        ticket.id,
      ]);
    }
  }

  if (conversationId) {
    await query(
      `INSERT INTO public.messages (conversation_id, ticket_id, sender_type, sender_id, content, is_internal)
       VALUES ($1, $2, 'visitor', $3, $4, false)`,
      [conversationId, ticket.id, ticket.requester_id, body.slice(0, 4000)],
    );
  }

  await query(
    `UPDATE public.tickets
     SET status = CASE WHEN status = 'solved' THEN 'open' ELSE status END,
         last_customer_reply_at = now(),
         updated_at = now()
     WHERE id = $1 AND workspace_id = $2`,
    [ticket.id, input.workspaceId],
  );

  return { ok: true };
}

export async function solvePortalTicketAction(input: {
  workspaceId: string;
  ticketId: string;
}): Promise<{ ok: true }> {
  const { ticket } = await assertPortalOwnsTicket(input.workspaceId, input.ticketId);
  await query(
    `UPDATE public.tickets
     SET status = 'solved',
         solved_at = COALESCE(solved_at, now()),
         status_changed_at = now(),
         updated_at = now()
     WHERE id = $1 AND workspace_id = $2`,
    [ticket.id, input.workspaceId],
  );

  await query(
    `INSERT INTO public.ticket_events (ticket_id, workspace_id, actor_type, actor_id, action, field, old_value, new_value)
     VALUES ($1, $2, 'customer', $3, 'status_changed', 'status', $4, 'solved')`,
    [ticket.id, input.workspaceId, ticket.requester_id, ticket.status],
  );

  return { ok: true };
}

export async function ratePortalTicketCsatAction(input: {
  workspaceId: string;
  ticketId: string;
  rating: PortalCsatChoice;
  comment?: string;
}): Promise<{ ok: true; storedRating: 'good' | 'bad'; score10: number }> {
  const { session, ticket } = await assertPortalOwnsTicket(input.workspaceId, input.ticketId);
  const mapped = mapFourButtonCsatToDb(input.rating);
  const cleanComment = (input.comment || '').trim().slice(0, 1000) || null;

  await query(
    `UPDATE public.tickets
     SET csat_rating = $1,
         csat_comment = COALESCE($2, csat_comment),
         csat_rated_at = now(),
         updated_at = now()
     WHERE id = $3 AND workspace_id = $4`,
    [mapped.ticketRating, cleanComment, ticket.id, input.workspaceId],
  );

  await query(
    `INSERT INTO public.survey_responses
       (workspace_id, kind, conversation_id, ticket_id, visitor_id, customer_name, channel, handler_type, score, comment, theme)
     VALUES
       ($1, 'csat', $2, $3, $4, $5, 'web_form', 'human', $6, $7, $8)`,
    [
      input.workspaceId,
      ticket.conversation_id,
      ticket.id,
      ticket.requester_id,
      session.name || session.email,
      mapped.score10,
      cleanComment,
      mapped.label,
    ],
  );

  return {
    ok: true,
    storedRating: mapped.ticketRating,
    score10: mapped.score10,
  };
}

export async function signOutCustomerPortalAction(): Promise<{ ok: true }> {
  const store = await cookies();
  store.delete(PORTAL_SESSION_COOKIE);
  return { ok: true };
}

/* ── #39 Chat Widget Studio & Interactive Showcase ──────────────────────── */

export interface WidgetStudioBundle {
  workspace: {
    id: string;
    name: string;
    slug: string | null;
    brandColor: string;
    secondaryColor: string;
    logoUrl: string | null;
    showLauncherLogo: boolean;
    widgetIcon: WidgetIconChoice;
    widgetDesign: WidgetDesignId;
    widgetColorMode: WidgetColorMode;
    widgetPosition: 'left' | 'right';
    widgetDisabled: boolean;
    greetingTitle: string;
    greetingMessage: string;
    launcherOffsetBottom: number;
    launcherOffsetSide: number;
    widgetZIndex: number;
    enableProactiveWelcome: boolean;
    proactiveDelaySeconds: number;
    showHelpTab: boolean;
    helpCenterTabLabel: string;
  } | null;
  availableWorkspaces: Array<{ id: string; name: string; slug: string | null }>;
  canEdit: boolean;
  embedSnippet: string;
  teamAgents: Array<{ id: string; name: string; status: string }>;
  helpArticles: Array<{ id: string; title: string; summary: string | null }>;
  launcherIcons: typeof LAUNCHER_ICONS;
  widgetDesigns: typeof WIDGET_DESIGNS;
  widgetColorModes: typeof WIDGET_COLOR_MODES;
}

export async function getWidgetStudioBundleAction(
  workspaceKey?: string | null,
): Promise<WidgetStudioBundle> {
  const [{ workspace, availableWorkspaces }, origin] = await Promise.all([
    resolvePublicWorkspace(workspaceKey),
    getRequestOrigin().catch(() => 'https://orbatai.com'),
  ]);

  if (!workspace) {
    return {
      workspace: null,
      availableWorkspaces,
      canEdit: false,
      embedSnippet: '',
      teamAgents: [],
      helpArticles: [],
      launcherIcons: LAUNCHER_ICONS,
      widgetDesigns: WIDGET_DESIGNS,
      widgetColorModes: WIDGET_COLOR_MODES,
    };
  }

  let canEdit = false;
  try {
    await getWorkspaceAccess(workspace.id, 'manage_settings');
    canEdit = true;
  } catch {
    canEdit = false;
  }

  const [agents, articles] = await Promise.all([
    queryRows<{ id: string; name: string; status: string }>(
      `SELECT id, COALESCE(name, 'Support agent') AS name, COALESCE(status, 'offline') AS status
       FROM public.agents
       WHERE workspace_id = $1 AND COALESCE(is_active, true) = true
       ORDER BY CASE WHEN status = 'online' THEN 0 ELSE 1 END, name ASC
       LIMIT 6`,
      [workspace.id],
    ),
    queryRows<{ id: string; title: string; summary: string | null }>(
      `SELECT id, title, summary
       FROM public.articles
       WHERE workspace_id = $1 AND status = 'published'
       ORDER BY views_count DESC, created_at ASC
       LIMIT 6`,
      [workspace.id],
    ),
  ]);

  const nav =
    workspace.navbar_trigger_config && typeof workspace.navbar_trigger_config === 'object'
      ? workspace.navbar_trigger_config
      : {};
  const rawDesign = nav.widget_design;
  const rawColorMode = nav.widget_color_mode;
  const rawSecondary = nav.widget_secondary_color;
  const rawIcon =
    typeof workspace.widget_icon === 'string' && workspace.widget_icon
      ? workspace.widget_icon
      : typeof nav.widget_icon === 'string'
        ? nav.widget_icon
        : DEFAULT_LAUNCHER_ICON;

  const validIcon: WidgetIconChoice =
    rawIcon === 'custom_logo' || LAUNCHER_ICONS.some((i) => i.id === rawIcon)
      ? (rawIcon as WidgetIconChoice)
      : DEFAULT_LAUNCHER_ICON;

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      brandColor: workspace.brand_color && isHexColor(workspace.brand_color) ? workspace.brand_color : '#224F41',
      secondaryColor:
        typeof rawSecondary === 'string' && isHexColor(rawSecondary) ? rawSecondary : '#183C31',
      logoUrl: workspace.logo_url,
      showLauncherLogo: Boolean(workspace.show_launcher_logo),
      widgetIcon: validIcon,
      widgetDesign: isWidgetDesign(rawDesign) ? rawDesign : DEFAULT_WIDGET_DESIGN,
      widgetColorMode: isWidgetColorMode(rawColorMode) ? rawColorMode : 'auto',
      widgetPosition: workspace.widget_position === 'left' ? 'left' : 'right',
      widgetDisabled: Boolean(workspace.widget_disabled),
      greetingTitle: workspace.greeting_title || `Hi there`,
      greetingMessage:
        workspace.greeting_message || 'Ask a question or track a request — our AI and team are here.',
      launcherOffsetBottom: Number(workspace.launcher_offset_bottom ?? 20),
      launcherOffsetSide: Number(workspace.launcher_offset_side ?? 20),
      widgetZIndex: Number(workspace.widget_z_index ?? 2147483000),
      enableProactiveWelcome: workspace.enable_proactive_welcome !== false,
      proactiveDelaySeconds: Number(workspace.proactive_delay_seconds ?? 8),
      showHelpTab: workspace.show_help_tab !== false,
      helpCenterTabLabel: workspace.help_center_tab_label || 'Help',
    },
    availableWorkspaces,
    canEdit,
    embedSnippet: `<script src="${origin}/widget.js" data-workspace-id="${workspace.id}" async></script>`,
    teamAgents: agents,
    helpArticles: articles,
    launcherIcons: LAUNCHER_ICONS,
    widgetDesigns: WIDGET_DESIGNS,
    widgetColorModes: WIDGET_COLOR_MODES,
  };
}

export async function saveWidgetStudioSettingsAction(
  workspaceId: string,
  patch: {
    brandColor?: string;
    secondaryColor?: string;
    widgetIcon?: WidgetIconChoice;
    widgetDesign?: WidgetDesignId;
    widgetColorMode?: WidgetColorMode;
    widgetPosition?: 'left' | 'right';
    greetingTitle?: string;
    greetingMessage?: string;
    showHelpTab?: boolean;
    helpCenterTabLabel?: string;
  },
): Promise<{ savedAt: string }> {
  await getWorkspaceAccess(workspaceId, 'manage_settings');

  if (patch.brandColor && !isHexColor(patch.brandColor)) {
    throw userError('Primary colour must be a hex colour such as #224F41.');
  }
  if (patch.secondaryColor && !isHexColor(patch.secondaryColor)) {
    throw userError('Secondary colour must be a hex colour.');
  }
  if (patch.widgetDesign && !isWidgetDesign(patch.widgetDesign)) {
    throw userError('Choose one of the supported widget designs.');
  }
  if (patch.widgetColorMode && !isWidgetColorMode(patch.widgetColorMode)) {
    throw userError('Choose match visitor, light, or dark.');
  }

  const currentRows = await queryRows<{ navbar_trigger_config: Record<string, unknown> | null }>(
    `SELECT navbar_trigger_config FROM public.workspaces WHERE id = $1 LIMIT 1`,
    [workspaceId],
  );
  const navConfig = { ...(currentRows[0]?.navbar_trigger_config || {}) };
  if (patch.widgetIcon !== undefined) navConfig.widget_icon = patch.widgetIcon;
  if (patch.widgetDesign !== undefined) navConfig.widget_design = patch.widgetDesign;
  if (patch.widgetColorMode !== undefined) navConfig.widget_color_mode = patch.widgetColorMode;
  if (patch.secondaryColor !== undefined) navConfig.widget_secondary_color = patch.secondaryColor;

  await query(
    `UPDATE public.workspaces
     SET brand_color = COALESCE($2, brand_color),
         widget_icon = COALESCE($3, widget_icon),
         show_launcher_logo = CASE WHEN $3 IS NOT NULL THEN ($3 = 'custom_logo') ELSE show_launcher_logo END,
         widget_position = COALESCE($4, widget_position),
         greeting_title = COALESCE($5, greeting_title),
         greeting_message = COALESCE($6, greeting_message),
         show_help_tab = COALESCE($7, show_help_tab),
         help_center_tab_label = COALESCE($8, help_center_tab_label),
         navbar_trigger_config = $9::jsonb,
         updated_at = now()
     WHERE id = $1`,
    [
      workspaceId,
      patch.brandColor ?? null,
      patch.widgetIcon ?? null,
      patch.widgetPosition ?? null,
      patch.greetingTitle?.trim() || null,
      patch.greetingMessage?.trim() || null,
      patch.showHelpTab ?? null,
      patch.helpCenterTabLabel?.trim() || null,
      JSON.stringify(navConfig),
    ],
  );

  return { savedAt: new Date().toISOString() };
}
