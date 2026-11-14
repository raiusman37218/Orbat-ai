'use server';

import { query, queryRows } from '@/lib/db';
import { userError, errorMessage } from '@/lib/errors/user-error';
import { getWorkspaceAccess } from '@/lib/team/access';
import { roleCan } from '@/lib/team/permissions';

export type CampaignChannel =
  | 'email'
  | 'in_app_banner'
  | 'announcement'
  | 'chat_message'
  | 'whatsapp';
export type CampaignStatus = 'draft' | 'scheduled' | 'live' | 'sent' | 'paused';

export interface CampaignRecord {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  audienceLabel: string;
  scheduleLabel: string;
  scheduledAt: string | null;
  subject: string;
  body: string;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  convertedCount: number;
  unsubscribedCount: number;
  revenueCents: number;
  updatedAt: string;
  createdAt: string;
}

export interface ProactiveMessageRecord {
  id: string;
  name: string;
  triggerWhen: string;
  pagePattern: string;
  delaySeconds: number;
  message: string;
  isActive: boolean;
  shownCount: number;
  replyCount: number;
  convertedCount: number;
  updatedAt: string;
}

export interface SurveyResponseRecord {
  id: string;
  kind: 'csat' | 'nps';
  customerName: string;
  channel: string;
  handlerType: 'ai' | 'human' | 'unknown';
  score: number;
  comment: string | null;
  theme: string | null;
  createdAt: string;
}

export interface EngagementBootstrap {
  canManage: boolean;
  workspaceContactsCount: number;
  campaigns: CampaignRecord[];
  proactiveMessages: ProactiveMessageRecord[];
  surveys: {
    responses: SurveyResponseRecord[];
    csatCount: number;
    csatPositivePct: number | null;
    csatAvgStars: number | null;
    csatAiAvg: number | null;
    csatHumanAvg: number | null;
    csatStarsBreakdown: { stars: number; count: number; pct: number }[];
    npsCount: number;
    npsScore: number | null;
    npsPromoters: number;
    npsPassives: number;
    npsDetractors: number;
    npsHistogram: { score: number; count: number; bucket: 'detractor' | 'passive' | 'promoter' }[];
    themes: { theme: string; count: number }[];
  };
}

function normalizeCampaign(row: Record<string, unknown>): CampaignRecord {
  return {
    id: String(row.id),
    name: String(row.name || 'Untitled campaign'),
    channel: (String(row.channel || 'email') as CampaignChannel),
    status: (String(row.status || 'draft') as CampaignStatus),
    audienceLabel: String(row.audience_label || 'All workspace contacts'),
    scheduleLabel: String(row.schedule_label || 'Not scheduled'),
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
    subject: String(row.subject || ''),
    body: String(row.body || ''),
    sentCount: Number(row.sent_count ?? 0),
    deliveredCount: Number(row.delivered_count ?? 0),
    openedCount: Number(row.opened_count ?? 0),
    clickedCount: Number(row.clicked_count ?? 0),
    convertedCount: Number(row.converted_count ?? 0),
    unsubscribedCount: Number(row.unsubscribed_count ?? 0),
    revenueCents: Number(row.revenue_cents ?? 0),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function normalizeProactive(row: Record<string, unknown>): ProactiveMessageRecord {
  return {
    id: String(row.id),
    name: String(row.name || 'Proactive prompt'),
    triggerWhen: String(row.trigger_when || 'After 10s on any page'),
    pagePattern: String(row.page_pattern || '*'),
    delaySeconds: Number(row.delay_seconds ?? 10),
    message: String(row.message || ''),
    isActive: Boolean(row.is_active),
    shownCount: Number(row.shown_count ?? 0),
    replyCount: Number(row.reply_count ?? 0),
    convertedCount: Number(row.converted_count ?? 0),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export async function getEngagementBootstrapAction(
  workspaceId: string,
): Promise<EngagementBootstrap> {
  try {
    const { role } = await getWorkspaceAccess(workspaceId, 'view');
    const canManage = roleCan(role, 'manage_settings');

    const [campRows, pmRows, surveyRows, convCsatRows, visitorCountRows] = await Promise.all([
      queryRows<Record<string, unknown>>(
        `SELECT * FROM public.engagement_campaigns WHERE workspace_id = $1 ORDER BY updated_at DESC`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT * FROM public.proactive_messages WHERE workspace_id = $1 ORDER BY updated_at DESC`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT * FROM public.survey_responses WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 300`,
        [workspaceId],
      ),
      // Pull pre-existing conversation CSAT ratings not yet mirrored into survey_responses
      queryRows<Record<string, unknown>>(
        `SELECT c.id, c.csat_rating, c.csat_feedback, c.channel, c.ai_enabled, c.assigned_agent_id,
                c.updated_at, c.created_at,
                COALESCE(v.name, v.email, 'Visitor') AS customer_name
         FROM public.conversations c
         LEFT JOIN public.visitors v ON v.id = c.visitor_id
         WHERE c.workspace_id = $1
           AND c.csat_rating IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM public.survey_responses sr
             WHERE sr.workspace_id = $1 AND sr.conversation_id = c.id AND sr.kind = 'csat'
           )
         ORDER BY c.updated_at DESC
         LIMIT 200`,
        [workspaceId],
      ).catch(() => []),
      queryRows<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM public.visitors WHERE workspace_id = $1`,
        [workspaceId],
      ).catch(() => [{ cnt: '0' }]),
    ]);

    const unifiedSurveys: SurveyResponseRecord[] = [
      ...surveyRows.map((r) => ({
        id: String(r.id),
        kind: (r.kind === 'nps' ? 'nps' : 'csat') as 'csat' | 'nps',
        customerName: String(r.customer_name || 'Customer'),
        channel: String(r.channel || 'web'),
        handlerType: (['ai', 'human', 'unknown'].includes(String(r.handler_type))
          ? String(r.handler_type)
          : 'unknown') as 'ai' | 'human' | 'unknown',
        score: Number(r.score ?? 0),
        comment: r.comment ? String(r.comment) : null,
        theme: r.theme ? String(r.theme) : null,
        createdAt: String(r.created_at || new Date().toISOString()),
      })),
      ...convCsatRows.map((c) => ({
        id: `conv-${String(c.id)}`,
        kind: 'csat' as const,
        customerName: String(c.customer_name || 'Visitor'),
        channel: String(c.channel || 'web'),
        handlerType: (c.assigned_agent_id ? 'human' : c.ai_enabled ? 'ai' : 'unknown') as
          | 'ai'
          | 'human'
          | 'unknown',
        score: Math.min(5, Math.max(1, Number(c.csat_rating ?? 5))),
        comment: c.csat_feedback ? String(c.csat_feedback) : null,
        theme: null,
        createdAt: String(c.updated_at || c.created_at || new Date().toISOString()),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const csatItems = unifiedSurveys.filter((s) => s.kind === 'csat');
    const csatCount = csatItems.length;
    const csatAvgStars =
      csatCount > 0
        ? Math.round((csatItems.reduce((acc, s) => acc + s.score, 0) / csatCount) * 100) / 100
        : null;
    const csatPositivePct =
      csatCount > 0
        ? Math.round((csatItems.filter((s) => s.score >= 4).length / csatCount) * 100)
        : null;

    const aiCsat = csatItems.filter((s) => s.handlerType === 'ai');
    const humanCsat = csatItems.filter((s) => s.handlerType === 'human');
    const csatAiAvg =
      aiCsat.length > 0
        ? Math.round((aiCsat.reduce((a, b) => a + b.score, 0) / aiCsat.length) * 100) / 100
        : null;
    const csatHumanAvg =
      humanCsat.length > 0
        ? Math.round((humanCsat.reduce((a, b) => a + b.score, 0) / humanCsat.length) * 100) / 100
        : null;

    const csatStarsBreakdown = [5, 4, 3, 2, 1].map((stars) => {
      const count = csatItems.filter((s) => Math.round(s.score) === stars).length;
      return {
        stars,
        count,
        pct: csatCount > 0 ? Math.round((count / csatCount) * 100) : 0,
      };
    });

    const npsItems = unifiedSurveys.filter((s) => s.kind === 'nps');
    const npsCount = npsItems.length;
    const npsPromoters = npsItems.filter((s) => s.score >= 9).length;
    const npsPassives = npsItems.filter((s) => s.score >= 7 && s.score <= 8).length;
    const npsDetractors = npsItems.filter((s) => s.score <= 6).length;
    const npsScore =
      npsCount > 0
        ? Math.round(((npsPromoters - npsDetractors) / npsCount) * 100)
        : null;

    const npsHistogram = Array.from({ length: 11 }, (_, score) => ({
      score,
      count: npsItems.filter((s) => Math.round(s.score) === score).length,
      bucket: (score <= 6 ? 'detractor' : score <= 8 ? 'passive' : 'promoter') as
        | 'detractor'
        | 'passive'
        | 'promoter',
    }));

    const themeCounts = new Map<string, number>();
    for (const r of unifiedSurveys) {
      if (r.theme?.trim()) {
        const key = r.theme.trim();
        themeCounts.set(key, (themeCounts.get(key) ?? 0) + 1);
      }
    }
    const themes = Array.from(themeCounts.entries())
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      canManage,
      workspaceContactsCount: Number(visitorCountRows[0]?.cnt ?? 0),
      campaigns: campRows.map(normalizeCampaign),
      proactiveMessages: pmRows.map(normalizeProactive),
      surveys: {
        responses: unifiedSurveys.slice(0, 80),
        csatCount,
        csatPositivePct,
        csatAvgStars,
        csatAiAvg,
        csatHumanAvg,
        csatStarsBreakdown,
        npsCount,
        npsScore,
        npsPromoters,
        npsPassives,
        npsDetractors,
        npsHistogram,
        themes,
      },
    };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not load engagement workspace data.'));
  }
}

export async function createCampaignAction(
  workspaceId: string,
  input: {
    name: string;
    channel: CampaignChannel;
    audienceLabel?: string;
    scheduleLabel?: string;
    subject?: string;
    body?: string;
    status?: CampaignStatus;
  },
): Promise<CampaignRecord> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const cleanName = input.name.trim().slice(0, 120);
    if (!cleanName) throw new Error('Campaign name is required.');

    const rows = await queryRows<Record<string, unknown>>(
      `INSERT INTO public.engagement_campaigns
         (workspace_id, name, channel, status, audience_label, schedule_label, subject, body, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        workspaceId,
        cleanName,
        input.channel,
        input.status ?? 'draft',
        (input.audienceLabel?.trim() || 'All workspace contacts').slice(0, 200),
        (input.scheduleLabel?.trim() || 'Draft — not scheduled').slice(0, 120),
        (input.subject?.trim() || '').slice(0, 300),
        (input.body?.trim() || '').slice(0, 4000),
        agent.id,
      ],
    );
    if (!rows[0]) throw new Error('Could not create campaign');
    return normalizeCampaign(rows[0]);
  } catch (err) {
    throw userError(errorMessage(err, 'Could not create campaign.'));
  }
}

export async function updateCampaignAction(
  workspaceId: string,
  input: {
    id: string;
    name: string;
    channel: CampaignChannel;
    status: CampaignStatus;
    audienceLabel: string;
    scheduleLabel: string;
    subject: string;
    body: string;
  },
): Promise<CampaignRecord> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const cleanName = input.name.trim().slice(0, 120);
    if (!cleanName) throw new Error('Campaign name is required.');

    const rows = await queryRows<Record<string, unknown>>(
      `UPDATE public.engagement_campaigns
       SET name = $3,
           channel = $4,
           status = $5,
           audience_label = $6,
           schedule_label = $7,
           subject = $8,
           body = $9,
           updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [
        input.id,
        workspaceId,
        cleanName,
        input.channel,
        input.status,
        input.audienceLabel.trim().slice(0, 200),
        input.scheduleLabel.trim().slice(0, 120),
        input.subject.trim().slice(0, 300),
        input.body.trim().slice(0, 4000),
      ],
    );
    if (!rows[0]) throw new Error('Campaign not found.');
    return normalizeCampaign(rows[0]);
  } catch (err) {
    throw userError(errorMessage(err, 'Could not save campaign.'));
  }
}

export async function deleteCampaignAction(
  workspaceId: string,
  campaignId: string,
): Promise<{ deleted: true }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    await query(
      `DELETE FROM public.engagement_campaigns WHERE id = $1 AND workspace_id = $2`,
      [campaignId, workspaceId],
    );
    return { deleted: true };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not delete campaign.'));
  }
}

export async function createProactiveMessageAction(
  workspaceId: string,
  input: {
    name: string;
    triggerWhen: string;
    pagePattern?: string;
    delaySeconds?: number;
    message: string;
    isActive?: boolean;
  },
): Promise<ProactiveMessageRecord> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const cleanName = input.name.trim().slice(0, 120);
    const cleanMsg = input.message.trim().slice(0, 1000);
    if (!cleanName || !cleanMsg) {
      throw new Error('Proactive message title and copy are required.');
    }

    const rows = await queryRows<Record<string, unknown>>(
      `INSERT INTO public.proactive_messages
         (workspace_id, name, trigger_when, page_pattern, delay_seconds, message, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        workspaceId,
        cleanName,
        (input.triggerWhen?.trim() || 'After 10s on any page').slice(0, 200),
        (input.pagePattern?.trim() || '*').slice(0, 200),
        Math.min(3600, Math.max(0, Number(input.delaySeconds ?? 10))),
        cleanMsg,
        Boolean(input.isActive ?? true),
        agent.id,
      ],
    );
    if (!rows[0]) throw new Error('Could not create proactive message');
    return normalizeProactive(rows[0]);
  } catch (err) {
    throw userError(errorMessage(err, 'Could not create proactive message.'));
  }
}

export async function updateProactiveMessageAction(
  workspaceId: string,
  input: {
    id: string;
    name?: string;
    triggerWhen?: string;
    pagePattern?: string;
    delaySeconds?: number;
    message?: string;
    isActive?: boolean;
  },
): Promise<ProactiveMessageRecord> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const rows = await queryRows<Record<string, unknown>>(
      `UPDATE public.proactive_messages
       SET name = COALESCE($3, name),
           trigger_when = COALESCE($4, trigger_when),
           page_pattern = COALESCE($5, page_pattern),
           delay_seconds = COALESCE($6, delay_seconds),
           message = COALESCE($7, message),
           is_active = COALESCE($8, is_active),
           updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [
        input.id,
        workspaceId,
        input.name ? input.name.trim().slice(0, 120) : null,
        input.triggerWhen ? input.triggerWhen.trim().slice(0, 200) : null,
        input.pagePattern ? input.pagePattern.trim().slice(0, 200) : null,
        typeof input.delaySeconds === 'number'
          ? Math.min(3600, Math.max(0, input.delaySeconds))
          : null,
        input.message ? input.message.trim().slice(0, 1000) : null,
        typeof input.isActive === 'boolean' ? input.isActive : null,
      ],
    );
    if (!rows[0]) throw new Error('Proactive message not found.');
    return normalizeProactive(rows[0]);
  } catch (err) {
    throw userError(errorMessage(err, 'Could not update proactive message.'));
  }
}

export async function deleteProactiveMessageAction(
  workspaceId: string,
  messageId: string,
): Promise<{ deleted: true }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    await query(
      `DELETE FROM public.proactive_messages WHERE id = $1 AND workspace_id = $2`,
      [messageId, workspaceId],
    );
    return { deleted: true };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not delete proactive message.'));
  }
}

export async function recordSurveyResponseAction(
  workspaceId: string,
  input: {
    kind: 'csat' | 'nps';
    customerName: string;
    channel?: string;
    handlerType?: 'ai' | 'human' | 'unknown';
    score: number;
    comment?: string;
    theme?: string;
  },
): Promise<{ id: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'edit_content');
    const score =
      input.kind === 'csat'
        ? Math.min(5, Math.max(1, Math.round(input.score)))
        : Math.min(10, Math.max(0, Math.round(input.score)));

    const rows = await queryRows<{ id: string }>(
      `INSERT INTO public.survey_responses
         (workspace_id, kind, customer_name, channel, handler_type, score, comment, theme)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        workspaceId,
        input.kind,
        (input.customerName.trim() || 'Customer').slice(0, 120),
        (input.channel?.trim() || 'web').slice(0, 40),
        input.handlerType ?? 'unknown',
        score,
        input.comment?.trim().slice(0, 1000) || null,
        input.theme?.trim().slice(0, 80) || null,
      ],
    );
    return { id: String(rows[0]?.id ?? '') };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not save survey response.'));
  }
}
