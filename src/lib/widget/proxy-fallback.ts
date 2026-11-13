import { queryRows } from '@/lib/db';
import { serviceClient } from '@/lib/supabase/service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class WidgetFallbackHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'WidgetFallbackHttpError';
  }
}

function assertUuid(value: unknown, field: string): string {
  const str = String(value ?? '').trim();
  if (!UUID_REGEX.test(str)) {
    throw new WidgetFallbackHttpError(400, `Invalid UUID for ${field}.`);
  }
  return str;
}

function assertToken(value: unknown): string {
  const str = String(value ?? '').trim();
  if (!str) {
    throw new WidgetFallbackHttpError(401, 'Missing visitor session token.');
  }
  return str;
}

function pick<T = unknown>(body: Record<string, any>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (body[k] !== undefined) return body[k] as T;
  }
  return undefined;
}

function toOptionalInt(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function mapPgError(error: any): never {
  if (error instanceof WidgetFallbackHttpError) throw error;
  const code = error?.code;
  const message = String(error?.message || 'Widget database operation failed');

  if (code === '28000' || message.includes('visitor_session_invalid')) {
    throw new WidgetFallbackHttpError(401, message);
  }
  if (code === 'P0002' || message.includes('not_found') || message.includes('workspace_unavailable')) {
    throw new WidgetFallbackHttpError(404, message);
  }
  if (code === 'P0001' || message.includes('rate_limited')) {
    throw new WidgetFallbackHttpError(429, 'Rate limit exceeded. Please wait a moment.');
  }
  if (code === '22023' || code === '22001' || code === '22P02') {
    throw new WidgetFallbackHttpError(400, message);
  }
  throw error;
}

export function isSupabaseConfigured(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  return Boolean(url && !url.includes('noop.supabase.co') && key);
}

async function runNeonRpc<T = any>(sql: string, params: any[]): Promise<T> {
  try {
    const rows = await queryRows<{ data: T }>(sql, params);
    return rows[0]?.data as T;
  } catch (error) {
    mapPgError(error);
  }
}

async function runSupabaseRpc<T = any>(fnName: string, params: Record<string, any>): Promise<T> {
  const sb = serviceClient();
  const { data, error } = await sb.rpc(fnName, params);
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new WidgetFallbackHttpError(404, error.message);
    }
    mapPgError(error);
  }
  return data as T;
}

async function neonRecordExists(table: 'workspaces' | 'visitors', id: string): Promise<boolean> {
  try {
    const rows = await queryRows<{ id: string }>(
      `SELECT id FROM public.${table} WHERE id = $1::uuid LIMIT 1`,
      [id]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function withVisitorFallback<T>(
  visitorId: string,
  fnName: string,
  sbParams: Record<string, any>,
  neonExec: () => Promise<T>
): Promise<T> {
  try {
    return await neonExec();
  } catch (err) {
    if (
      err instanceof WidgetFallbackHttpError &&
      (err.status === 401 || err.status === 404) &&
      isSupabaseConfigured() &&
      !(await neonRecordExists('visitors', visitorId))
    ) {
      return runSupabaseRpc<T>(fnName, sbParams);
    }
    throw err;
  }
}

async function getConfig(workspaceId: unknown) {
  const wsId = assertUuid(workspaceId, 'workspaceId');
  let data = await runNeonRpc('SELECT public.fn_get_workspace_config($1::uuid) AS data', [wsId]);
  if (!data && isSupabaseConfigured() && !(await neonRecordExists('workspaces', wsId))) {
    data = await runSupabaseRpc('fn_get_workspace_config', { p_workspace_id: wsId });
  }
  if (!data) {
    throw new WidgetFallbackHttpError(404, 'Workspace not found or unavailable.');
  }
  return data;
}

async function getAgents(workspaceId: unknown) {
  const wsId = assertUuid(workspaceId, 'workspaceId');
  const data = await runNeonRpc('SELECT public.fn_widget_agents($1::uuid) AS data', [wsId]);
  if ((!Array.isArray(data) || data.length === 0) && isSupabaseConfigured() && !(await neonRecordExists('workspaces', wsId))) {
    return runSupabaseRpc('fn_widget_agents', { p_workspace_id: wsId });
  }
  return data;
}

async function getHelp(workspaceId: unknown) {
  const wsId = assertUuid(workspaceId, 'workspaceId');
  const [sections, articles] = await Promise.all([
    queryRows(
      `SELECT id, name, description, icon, order_index
       FROM public.help_sections
       WHERE workspace_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [wsId]
    ),
    queryRows(
      `SELECT a.id, a.title, a.slug, a.summary, a.content, a.category, a.section_id, a.order_index,
              CASE WHEN s.id IS NOT NULL THEN jsonb_build_object('id', s.id, 'name', s.name, 'icon', s.icon) ELSE NULL END AS section
       FROM public.articles a
       LEFT JOIN public.help_sections s ON s.id = a.section_id
       WHERE a.workspace_id = $1 AND a.status = 'published'
       ORDER BY a.order_index ASC, a.created_at ASC`,
      [wsId]
    ),
  ]);

  if (sections.length === 0 && articles.length === 0 && isSupabaseConfigured() && !(await neonRecordExists('workspaces', wsId))) {
    const sb = serviceClient();
    const [secRes, artRes] = await Promise.all([
      sb
        .from('help_sections')
        .select('id, name, description, icon, order_index')
        .eq('workspace_id', wsId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true }),
      sb
        .from('articles')
        .select('id, title, slug, summary, content, category, section_id, order_index, section:help_sections(id, name, icon)')
        .eq('workspace_id', wsId)
        .eq('status', 'published')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);
    return {
      sections: secRes.data || [],
      articles: artRes.data || [],
    };
  }

  return { sections, articles };
}

async function createOrVerifySession(body: Record<string, any>) {
  const wsId = assertUuid(pick(body, 'workspaceId', 'p_workspace_id'), 'workspaceId');
  const visitorId = assertUuid(pick(body, 'visitorId', 'p_visitor_id'), 'visitorId');
  const token = (pick<string | null>(body, 'token', 'p_token') ?? null) as string | null;

  try {
    return await runNeonRpc(
      'SELECT public.fn_widget_session($1::uuid, $2::uuid, $3::text) AS data',
      [wsId, visitorId, token]
    );
  } catch (err) {
    if (
      err instanceof WidgetFallbackHttpError &&
      err.status === 404 &&
      isSupabaseConfigured() &&
      !(await neonRecordExists('workspaces', wsId))
    ) {
      return runSupabaseRpc('fn_widget_session', {
        p_workspace_id: wsId,
        p_visitor_id: visitorId,
        p_token: token,
      });
    }
    throw err;
  }
}

async function sendMessage(
  visitorId: unknown,
  tokenVal: unknown,
  conversationId: unknown,
  content: unknown,
  attachmentUrl?: unknown
) {
  const vId = assertUuid(visitorId, 'visitorId');
  const t = assertToken(tokenVal);
  const convId = assertUuid(conversationId, 'conversationId');
  const cleanedUrl = attachmentUrl ? String(attachmentUrl).trim() : null;
  const textContent = String(content ?? '');

  return withVisitorFallback(
    vId,
    'fn_widget_send_message',
    {
      p_visitor_id: vId,
      p_token: t,
      p_conversation_id: convId,
      p_content: textContent,
      p_attachment_url: cleanedUrl,
    },
    async () => {
      if (cleanedUrl && !/^https:\/\//i.test(cleanedUrl) && (/^\//.test(cleanedUrl) || /^http:\/\//i.test(cleanedUrl))) {
        try {
          await queryRows('SELECT public.fn_widget_auth($1::uuid, $2::text)', [vId, t]);
          const convRows = await queryRows<{ id: string; status: string }>(
            'SELECT * FROM public.fn_widget_conversation($1::uuid, $2::uuid)',
            [vId, convId]
          );
          const conv = convRows[0];
          if (!conv?.id) {
            throw new WidgetFallbackHttpError(404, 'Conversation not found.');
          }
          const trimmedContent = textContent.trim() || 'Sent a picture';
          if (conv.status !== 'open') {
            await queryRows(
              `UPDATE public.conversations
               SET status = 'open', closed_at = NULL, snoozed_until = NULL, updated_at = now()
               WHERE id = $1`,
              [conv.id]
            );
          }
          const inserted = await queryRows(
            `INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, attachment_url, is_internal, created_at)
             VALUES ($1, 'visitor', $2, $3, $4, false, clock_timestamp())
             RETURNING *`,
            [conv.id, vId, trimmedContent, cleanedUrl]
          );
          const jsonRows = await queryRows<{ data: any }>(
            'SELECT public.fn_widget_message_json($1::public.messages) AS data',
            [inserted[0]]
          ).catch(() => [{ data: inserted[0] }]);
          return jsonRows[0]?.data || inserted[0];
        } catch (error) {
          mapPgError(error);
        }
      }

      return runNeonRpc(
        'SELECT public.fn_widget_send_message($1::uuid, $2::text, $3::uuid, $4::text, $5::text) AS data',
        [vId, t, convId, textContent, cleanedUrl]
      );
    }
  );
}

async function submitCsat(body: Record<string, any>) {
  const vId = assertUuid(pick(body, 'visitorId', 'p_visitor_id'), 'visitorId');
  const t = assertToken(pick(body, 'token', 'p_token'));
  const convId = assertUuid(pick(body, 'conversationId', 'p_conversation_id'), 'conversationId');
  const numericRating = Number(body.rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new WidgetFallbackHttpError(400, 'CSAT rating must be an integer between 1 and 5.');
  }

  try {
    await queryRows('SELECT public.fn_widget_auth($1::uuid, $2::text)', [vId, t]);
    const convRows = await queryRows<{ id: string }>(
      'SELECT id FROM public.conversations WHERE id = $1 AND visitor_id = $2 LIMIT 1',
      [convId, vId]
    );
    if (convRows.length === 0) {
      throw new WidgetFallbackHttpError(404, 'Conversation not found.');
    }
    const upd = await queryRows(
      `UPDATE public.conversations
       SET csat_rating = $1,
           csat_feedback = $2,
           updated_at = now()
       WHERE id = $3
       RETURNING id, csat_rating, csat_feedback`,
      [numericRating, body.feedback ? String(body.feedback).trim().slice(0, 1000) : null, convId]
    );
    return upd[0];
  } catch (error) {
    mapPgError(error);
  }
}

type VisitorRpcSpec = {
  sql: string;
  buildParams: (vId: string, t: string, body: Record<string, any>, extraConvId?: string) => {
    neonParams: any[];
    sbParams: Record<string, any>;
  };
  okOnly?: boolean;
};

const VISITOR_RPCS: Record<string, VisitorRpcSpec> = {
  fn_widget_conversations: {
    sql: 'SELECT public.fn_widget_conversations($1::uuid, $2::text) AS data',
    buildParams: (vId, t) => ({
      neonParams: [vId, t],
      sbParams: { p_visitor_id: vId, p_token: t },
    }),
  },
  fn_widget_start_conversation: {
    sql: 'SELECT public.fn_widget_start_conversation($1::uuid, $2::text, $3::boolean) AS data',
    buildParams: (vId, t, body) => {
      const forceNew = Boolean(pick(body, 'forceNew', 'p_force_new'));
      return {
        neonParams: [vId, t, forceNew],
        sbParams: { p_visitor_id: vId, p_token: t, p_force_new: forceNew },
      };
    },
  },
  fn_widget_messages: {
    sql: 'SELECT public.fn_widget_messages($1::uuid, $2::text, $3::uuid) AS data',
    buildParams: (vId, t, body, extraConvId) => {
      const convId = assertUuid(extraConvId ?? pick(body, 'conversationId', 'p_conversation_id'), 'conversationId');
      return {
        neonParams: [vId, t, convId],
        sbParams: { p_visitor_id: vId, p_token: t, p_conversation_id: convId },
      };
    },
  },
  fn_widget_heartbeat: {
    sql: 'SELECT public.fn_widget_heartbeat($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::integer) AS data',
    buildParams: (vId, t, body) => {
      const currentUrl = pick<string | null>(body, 'currentUrl', 'p_current_url') ?? null;
      const pageTitle = pick<string | null>(body, 'pageTitle', 'p_page_title') ?? null;
      const referrer = pick<string | null>(body, 'referrer', 'p_referrer') ?? null;
      const timeOnPage = toOptionalInt(pick(body, 'timeOnPage', 'p_time_on_page'));
      return {
        neonParams: [vId, t, currentUrl, pageTitle, referrer, timeOnPage],
        sbParams: {
          p_visitor_id: vId,
          p_token: t,
          p_current_url: currentUrl,
          p_page_title: pageTitle,
          p_referrer: referrer,
          p_time_on_page: timeOnPage,
        },
      };
    },
    okOnly: true,
  },
  fn_widget_record_page: {
    sql: 'SELECT public.fn_widget_record_page($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::integer) AS data',
    buildParams: (vId, t, body) => {
      const url = String(pick(body, 'url', 'p_url') ?? '');
      const title = pick<string | null>(body, 'title', 'p_title') ?? null;
      const referrer = pick<string | null>(body, 'referrer', 'p_referrer') ?? null;
      const duration = toOptionalInt(pick(body, 'durationSeconds', 'p_duration_seconds')) ?? 0;
      return {
        neonParams: [vId, t, url, title, referrer, duration],
        sbParams: {
          p_visitor_id: vId,
          p_token: t,
          p_url: url,
          p_title: title,
          p_referrer: referrer,
          p_duration_seconds: duration,
        },
      };
    },
    okOnly: true,
  },
  fn_widget_update_meta: {
    sql: 'SELECT public.fn_widget_update_meta($1::uuid, $2::text, $3::text, $4::text) AS data',
    buildParams: (vId, t, body) => {
      const timezone = pick<string | null>(body, 'timezone', 'p_timezone') ?? null;
      const language = pick<string | null>(body, 'language', 'p_language') ?? null;
      return {
        neonParams: [vId, t, timezone, language],
        sbParams: { p_visitor_id: vId, p_token: t, p_timezone: timezone, p_language: language },
      };
    },
    okOnly: true,
  },
  fn_widget_update_visitor: {
    sql: 'SELECT public.fn_widget_update_visitor($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text) AS data',
    buildParams: (vId, t, body) => {
      const name = pick<string | null>(body, 'name', 'p_name') ?? null;
      const email = pick<string | null>(body, 'email', 'p_email') ?? null;
      const currentUrl = pick<string | null>(body, 'currentUrl', 'p_current_url') ?? null;
      const userAgent = pick<string | null>(body, 'userAgent', 'p_user_agent') ?? null;
      const location = pick<string | null>(body, 'location', 'p_location') ?? null;
      return {
        neonParams: [vId, t, name, email, currentUrl, userAgent, location],
        sbParams: {
          p_visitor_id: vId,
          p_token: t,
          p_name: name,
          p_email: email,
          p_current_url: currentUrl,
          p_user_agent: userAgent,
          p_location: location,
        },
      };
    },
    okOnly: true,
  },
  fn_widget_offline: {
    sql: 'SELECT public.fn_widget_offline($1::uuid, $2::text) AS data',
    buildParams: (vId, t) => ({
      neonParams: [vId, t],
      sbParams: { p_visitor_id: vId, p_token: t },
    }),
    okOnly: true,
  },
  fn_widget_mark: {
    sql: 'SELECT public.fn_widget_mark($1::uuid, $2::text, $3::uuid, $4::boolean) AS data',
    buildParams: (vId, t, body) => {
      const convId = assertUuid(pick(body, 'conversationId', 'p_conversation_id'), 'conversationId');
      const read = Boolean(pick(body, 'read', 'p_read') ?? true);
      return {
        neonParams: [vId, t, convId, read],
        sbParams: { p_visitor_id: vId, p_token: t, p_conversation_id: convId, p_read: read },
      };
    },
    okOnly: true,
  },
  fn_widget_request_handoff: {
    sql: 'SELECT public.fn_widget_request_handoff($1::uuid, $2::text, $3::uuid, $4::text) AS data',
    buildParams: (vId, t, body, extraConvId) => {
      const convId = assertUuid(extraConvId ?? pick(body, 'conversationId', 'p_conversation_id'), 'conversationId');
      const reason = pick<string | null>(body, 'reason', 'p_reason') ?? null;
      return {
        neonParams: [vId, t, convId, reason],
        sbParams: { p_visitor_id: vId, p_token: t, p_conversation_id: convId, p_reason: reason },
      };
    },
  },
  fn_widget_set_ai_assist: {
    sql: 'SELECT public.fn_widget_set_ai_assist($1::uuid, $2::text, $3::uuid, $4::boolean) AS data',
    buildParams: (vId, t, body, extraConvId) => {
      const convId = assertUuid(extraConvId ?? pick(body, 'conversationId', 'p_conversation_id'), 'conversationId');
      const enabled = Boolean(pick(body, 'enabled', 'p_enabled') ?? true);
      return {
        neonParams: [vId, t, convId, enabled],
        sbParams: { p_visitor_id: vId, p_token: t, p_conversation_id: convId, p_enabled: enabled },
      };
    },
  },
  fn_widget_set_topic: {
    sql: 'SELECT public.fn_widget_set_topic($1::uuid, $2::text, $3::uuid, $4::text) AS data',
    buildParams: (vId, t, body, extraConvId) => {
      const convId = assertUuid(extraConvId ?? pick(body, 'conversationId', 'p_conversation_id'), 'conversationId');
      const topic = String(pick(body, 'topic', 'p_topic') ?? '');
      return {
        neonParams: [vId, t, convId, topic],
        sbParams: { p_visitor_id: vId, p_token: t, p_conversation_id: convId, p_topic: topic },
      };
    },
  },
  fn_widget_mark_resolved: {
    sql: 'SELECT public.fn_widget_mark_resolved($1::uuid, $2::text, $3::uuid) AS data',
    buildParams: (vId, t, body, extraConvId) => {
      const convId = assertUuid(extraConvId ?? pick(body, 'conversationId', 'p_conversation_id'), 'conversationId');
      return {
        neonParams: [vId, t, convId],
        sbParams: { p_visitor_id: vId, p_token: t, p_conversation_id: convId },
      };
    },
  },
  fn_widget_welcome: {
    sql: 'SELECT public.fn_widget_welcome($1::uuid, $2::text, $3::uuid, $4::text) AS data',
    buildParams: (vId, t, body, extraConvId) => {
      const convId = assertUuid(extraConvId ?? pick(body, 'conversationId', 'p_conversation_id'), 'conversationId');
      const content = String(pick(body, 'content', 'p_content') ?? '');
      return {
        neonParams: [vId, t, convId, content],
        sbParams: { p_visitor_id: vId, p_token: t, p_conversation_id: convId, p_content: content },
      };
    },
  },
};

async function execVisitorRpc(fnName: string, body: Record<string, any>, extraConvId?: string) {
  const spec = VISITOR_RPCS[fnName];
  if (!spec) {
    throw new WidgetFallbackHttpError(400, `Unsupported widget RPC function: ${fnName}`);
  }
  const vId = assertUuid(pick(body, 'visitorId', 'p_visitor_id'), 'visitorId');
  const t = assertToken(pick(body, 'token', 'p_token'));
  const { neonParams, sbParams } = spec.buildParams(vId, t, body, extraConvId);

  const result = await withVisitorFallback(vId, fnName, sbParams, () =>
    runNeonRpc(spec.sql, neonParams)
  );
  return spec.okOnly ? { ok: true } : result;
}

async function invokeWhitelistedRpc(fnName: string, body: Record<string, any>) {
  if (fnName === 'fn_get_workspace_config') {
    return getConfig(pick(body, 'p_workspace_id', 'workspaceId'));
  }
  if (fnName === 'fn_widget_agents') {
    return getAgents(pick(body, 'p_workspace_id', 'workspaceId'));
  }
  if (fnName === 'fn_widget_session') {
    return createOrVerifySession(body);
  }
  if (fnName === 'fn_widget_send_message') {
    return sendMessage(
      pick(body, 'p_visitor_id', 'visitorId'),
      pick(body, 'p_token', 'token'),
      pick(body, 'p_conversation_id', 'conversationId'),
      pick(body, 'p_content', 'content') ?? '',
      pick(body, 'p_attachment_url', 'attachmentUrl') ?? null
    );
  }
  if (fnName === 'fn_submit_article_feedback') {
    const articleId = assertUuid(pick(body, 'p_article_id', 'articleId'), 'articleId');
    const wsId = assertUuid(pick(body, 'p_workspace_id', 'workspaceId'), 'workspaceId');
    const visitorId = String(pick(body, 'p_visitor_id', 'visitorId') ?? '');
    const isHelpful = Boolean(pick(body, 'p_is_helpful', 'isHelpful'));
    const feedbackText = pick<string | null>(body, 'p_feedback_text', 'feedbackText') ?? null;

    if (isSupabaseConfigured() && !(await neonRecordExists('workspaces', wsId))) {
      return runSupabaseRpc('fn_submit_article_feedback', {
        p_article_id: articleId,
        p_workspace_id: wsId,
        p_visitor_id: visitorId,
        p_is_helpful: isHelpful,
        p_feedback_text: feedbackText,
      });
    }
    return runNeonRpc(
      'SELECT public.fn_submit_article_feedback($1::uuid, $2::uuid, $3::text, $4::boolean, $5::text) AS data',
      [articleId, wsId, visitorId, isHelpful, feedbackText]
    );
  }
  if (fnName in VISITOR_RPCS) {
    return execVisitorRpc(fnName, body);
  }
  throw new WidgetFallbackHttpError(400, `Unsupported widget RPC function: ${fnName}`);
}

const POST_SIMPLE_VISITOR_ROUTES: Record<string, string> = {
  'conversations/start': 'fn_widget_start_conversation',
  heartbeat: 'fn_widget_heartbeat',
  pageview: 'fn_widget_record_page',
  meta: 'fn_widget_update_meta',
  visitor: 'fn_widget_update_visitor',
  offline: 'fn_widget_offline',
  mark: 'fn_widget_mark',
};

const CONV_ACTION_RPCS: Record<string, string> = {
  handoff: 'fn_widget_request_handoff',
  'ai-assist': 'fn_widget_set_ai_assist',
  topic: 'fn_widget_set_topic',
  resolve: 'fn_widget_mark_resolved',
  welcome: 'fn_widget_welcome',
};

/**
 * Direct PostgreSQL (Neon, with Supabase fallback for legacy/demo workspaces)
 * execution for `/api/widget/*` when NestJS backend (:4000) is offline or unseeded.
 */
export async function executeWidgetFallback(
  subPath: string,
  method: 'GET' | 'POST',
  searchParams: URLSearchParams,
  body: Record<string, any>
): Promise<unknown> {
  const normalized = subPath.replace(/^\/+|\/+$/g, '');

  if (method === 'GET') {
    if (normalized === 'config') return getConfig(searchParams.get('workspaceId'));
    if (normalized === 'agents') return getAgents(searchParams.get('workspaceId'));
    if (normalized === 'help') return getHelp(searchParams.get('workspaceId'));
    if (normalized === 'conversations') {
      return execVisitorRpc('fn_widget_conversations', {
        visitorId: searchParams.get('visitorId'),
        token: searchParams.get('token'),
      });
    }
    const msgMatch = normalized.match(/^conversations\/([^/]+)\/messages$/);
    if (msgMatch) {
      return execVisitorRpc(
        'fn_widget_messages',
        {
          visitorId: searchParams.get('visitorId'),
          token: searchParams.get('token'),
        },
        decodeURIComponent(msgMatch[1])
      );
    }
    throw new WidgetFallbackHttpError(404, `Unknown widget GET endpoint: ${normalized}`);
  }

  if (normalized === 'session') return createOrVerifySession(body);
  if (normalized === 'csat') return submitCsat(body);

  if (normalized in POST_SIMPLE_VISITOR_ROUTES) {
    return execVisitorRpc(POST_SIMPLE_VISITOR_ROUTES[normalized], body);
  }

  if (normalized.startsWith('rpc/')) {
    const fnName = decodeURIComponent(normalized.slice('rpc/'.length));
    return invokeWhitelistedRpc(fnName, body);
  }

  const convMatch = normalized.match(/^conversations\/([^/]+)\/([^/]+)$/);
  if (convMatch) {
    const convId = decodeURIComponent(convMatch[1]);
    const action = convMatch[2];
    if (action === 'messages') {
      return sendMessage(
        pick(body, 'visitorId', 'p_visitor_id'),
        pick(body, 'token', 'p_token'),
        convId,
        pick(body, 'content', 'p_content') ?? '',
        pick(body, 'attachmentUrl', 'p_attachment_url') ?? null
      );
    }
    if (action in CONV_ACTION_RPCS) {
      return execVisitorRpc(CONV_ACTION_RPCS[action], body, convId);
    }
  }

  throw new WidgetFallbackHttpError(404, `Unknown widget POST endpoint: ${normalized}`);
}

