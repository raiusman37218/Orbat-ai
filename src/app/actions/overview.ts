'use server';

import { queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';

export type ActivityKind =
  | 'handoff'
  | 'ticket_solved'
  | 'sla'
  | 'kb_published'
  | 'low_csat'
  | 'ai_flagged';

export interface ActivityFeedItem {
  id: string;
  kind: ActivityKind;
  text: string;
  at: string;
  tone: 'ai' | 'ok' | 'bad' | 'accent' | 'warn';
  href: string;
}

function excerpt(raw: string | null | undefined, max = 64): string {
  const clean = (raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function metricLabel(metric: string | null | undefined): string {
  if (metric === 'first_reply') return 'first reply';
  if (metric === 'next_reply') return 'next reply';
  if (metric === 'resolution') return 'resolution';
  return 'response';
}

function handoffDescription(row: {
  type: string;
  visitor_name: string | null;
  handoff_reason: string | null;
  meta: Record<string, unknown> | null;
}): { text: string; tone: ActivityFeedItem['tone'] } {
  const who = row.visitor_name?.trim() || 'Visitor';
  const rawMetaReason = typeof row.meta?.reason === 'string' ? row.meta.reason : null;
  const reason = excerpt(rawMetaReason || row.handoff_reason, 48);
  const suffix = reason ? ` (${reason})` : '';

  switch (row.type) {
    case 'request_handoff':
      return { text: `Handoff requested for ${who}${suffix}`, tone: 'warn' };
    case 'offline_queue':
      return { text: `${who} queued for human follow-up${suffix}`, tone: 'warn' };
    case 'offer_handoff':
      return { text: `AI offered human handoff to ${who}${suffix}`, tone: 'ai' };
    case 'agent_claim':
      return { text: `Agent claimed ${who}'s conversation`, tone: 'ok' };
    case 'return_to_ai':
      return { text: `${who}'s conversation returned to AI`, tone: 'ai' };
    default:
      return { text: `Conversation update for ${who}`, tone: 'accent' };
  }
}

export async function listRecentActivityAction(
  workspaceId: string,
  limit = 15,
): Promise<ActivityFeedItem[]> {
  await getWorkspaceAccess(workspaceId, 'view');

  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const perSourceLimit = Math.min(12, Math.max(6, safeLimit));

  const [
    handoffRows,
    solvedTicketRows,
    slaEventRows,
    liveSlaTicketRows,
    articleRows,
    ticketCsatRows,
    surveyCsatRows,
    verifRows,
  ] = await Promise.all([
    queryRows<{
      id: string;
      conversation_id: string;
      type: string;
      meta: Record<string, unknown> | null;
      created_at: string;
      visitor_name: string | null;
      handoff_reason: string | null;
    }>(
      `SELECT ce.id::text AS id,
              ce.conversation_id::text AS conversation_id,
              ce.type,
              ce.meta,
              ce.created_at,
              v.name AS visitor_name,
              c.handoff_reason
       FROM public.conversation_events ce
       LEFT JOIN public.conversations c ON c.id = ce.conversation_id AND c.workspace_id = $1
       LEFT JOIN public.visitors v ON v.id = c.visitor_id AND v.workspace_id = $1
       WHERE ce.workspace_id = $1
         AND ce.type IN ('offer_handoff', 'request_handoff', 'offline_queue', 'agent_claim', 'return_to_ai')
       ORDER BY ce.created_at DESC
       LIMIT $2`,
      [workspaceId, perSourceLimit],
    ).catch(() => []),

    queryRows<{
      id: string;
      number: number;
      subject: string | null;
      solved_at: string;
      first_agent_reply_at: string | null;
    }>(
      `SELECT id::text AS id, number, subject, solved_at, first_agent_reply_at
       FROM public.tickets
       WHERE workspace_id = $1
         AND status IN ('solved', 'closed')
         AND solved_at IS NOT NULL
       ORDER BY solved_at DESC
       LIMIT $2`,
      [workspaceId, perSourceLimit],
    ).catch(() => []),

    queryRows<{
      id: string;
      ticket_id: string | null;
      metric: string | null;
      event: string;
      occurred_at: string;
      ticket_number: number | null;
      ticket_subject: string | null;
    }>(
      `SELECT se.id::text AS id,
              se.ticket_id::text AS ticket_id,
              se.metric,
              se.event,
              se.occurred_at,
              t.number AS ticket_number,
              t.subject AS ticket_subject
       FROM public.sla_events se
       LEFT JOIN public.tickets t ON t.id = se.ticket_id AND t.workspace_id = $1
       WHERE se.workspace_id = $1
         AND se.event IN ('warning', 'breached')
       ORDER BY se.occurred_at DESC
       LIMIT $2`,
      [workspaceId, perSourceLimit],
    ).catch(() => []),

    queryRows<{
      id: string;
      number: number;
      subject: string | null;
      sla_next_metric: string | null;
      sla_breached_at: string | null;
      sla_next_warn_at: string | null;
    }>(
      `SELECT id::text AS id, number, subject, sla_next_metric, sla_breached_at, sla_next_warn_at
       FROM public.tickets
       WHERE workspace_id = $1
         AND status IN ('new', 'open', 'pending', 'on_hold')
         AND (
           sla_breached_at IS NOT NULL
           OR (sla_state = 'running' AND sla_next_warn_at IS NOT NULL AND sla_next_warn_at <= now())
         )
       ORDER BY COALESCE(sla_breached_at, sla_next_warn_at) DESC
       LIMIT $2`,
      [workspaceId, perSourceLimit],
    ).catch(() => []),

    queryRows<{
      id: string;
      title: string;
      updated_at: string | null;
      created_at: string;
    }>(
      `SELECT id::text AS id, title, updated_at, created_at
       FROM public.articles
       WHERE workspace_id = $1
         AND status = 'published'
       ORDER BY COALESCE(updated_at, created_at) DESC
       LIMIT $2`,
      [workspaceId, perSourceLimit],
    ).catch(() => []),

    queryRows<{
      id: string;
      number: number;
      subject: string | null;
      csat_comment: string | null;
      csat_rated_at: string;
    }>(
      `SELECT id::text AS id, number, subject, csat_comment, csat_rated_at
       FROM public.tickets
       WHERE workspace_id = $1
         AND csat_rating = 'bad'
         AND csat_rated_at IS NOT NULL
       ORDER BY csat_rated_at DESC
       LIMIT $2`,
      [workspaceId, perSourceLimit],
    ).catch(() => []),

    queryRows<{
      id: string;
      ticket_id: string | null;
      conversation_id: string | null;
      score: number;
      comment: string | null;
      customer_name: string | null;
      created_at: string;
    }>(
      `SELECT id::text AS id, ticket_id::text AS ticket_id, conversation_id::text AS conversation_id,
              score, comment, customer_name, created_at
       FROM public.survey_responses
       WHERE workspace_id = $1
         AND score IS NOT NULL
         AND score <= 2
       ORDER BY created_at DESC
       LIMIT $2`,
      [workspaceId, perSourceLimit],
    ).catch(() => []),

    queryRows<{
      id: string;
      agent_name: string | null;
      topic: string | null;
      customer_question: string | null;
      verdict: string;
      human_review: string | null;
      created_at: string;
    }>(
      `SELECT id::text AS id, agent_name, topic, customer_question, verdict, human_review, created_at
       FROM public.ai_verification_logs
       WHERE workspace_id = $1
         AND (
           verdict IN ('needs_review', 'blocked_fixed', 'blocked_human')
           OR human_review = 'wrong'
         )
       ORDER BY created_at DESC
       LIMIT $2`,
      [workspaceId, perSourceLimit],
    ).catch(() => []),
  ]);

  const items: ActivityFeedItem[] = [];
  const seenSlaTicketState = new Set<string>();
  const seenCsatTickets = new Set<string>();

  for (const r of handoffRows) {
    const desc = handoffDescription(r);
    items.push({
      id: `handoff-${r.id}`,
      kind: 'handoff',
      text: desc.text,
      at: new Date(r.created_at).toISOString(),
      tone: desc.tone,
      href: r.conversation_id ? `/app/inbox?c=${encodeURIComponent(r.conversation_id)}` : '/app/inbox',
    });
  }

  for (const r of solvedTicketRows) {
    const aiSolved = !r.first_agent_reply_at;
    const subj = excerpt(r.subject, 52);
    items.push({
      id: `ticket-solved-${r.id}`,
      kind: 'ticket_solved',
      text: `Ticket #${r.number} solved${aiSolved ? ' by AI' : ''}${subj ? `: ${subj}` : ''}`,
      at: new Date(r.solved_at).toISOString(),
      tone: aiSolved ? 'ai' : 'ok',
      href: `/app/tickets?id=${encodeURIComponent(r.id)}`,
    });
  }

  for (const r of slaEventRows) {
    const isBreach = r.event === 'breached';
    if (r.ticket_id) {
      seenSlaTicketState.add(`${r.ticket_id}:${isBreach ? 'breached' : 'warning'}`);
    }
    const numLabel = r.ticket_number ? `Ticket #${r.ticket_number}` : 'ticket';
    const subj = excerpt(r.ticket_subject, 44);
    items.push({
      id: `sla-ev-${r.id}`,
      kind: 'sla',
      text: `SLA ${isBreach ? 'breached' : 'warning'} (${metricLabel(r.metric)}) on ${numLabel}${subj ? `: ${subj}` : ''}`,
      at: new Date(r.occurred_at).toISOString(),
      tone: isBreach ? 'bad' : 'warn',
      href: r.ticket_id ? `/app/tickets?id=${encodeURIComponent(r.ticket_id)}` : '/app/tickets',
    });
  }

  for (const r of liveSlaTicketRows) {
    const isBreach = Boolean(r.sla_breached_at);
    const dedupKey = `${r.id}:${isBreach ? 'breached' : 'warning'}`;
    if (seenSlaTicketState.has(dedupKey)) continue;
    const at = r.sla_breached_at || r.sla_next_warn_at;
    if (!at) continue;
    const subj = excerpt(r.subject, 44);
    items.push({
      id: `sla-live-${dedupKey}`,
      kind: 'sla',
      text: `SLA ${isBreach ? 'breached' : 'at risk'} (${metricLabel(r.sla_next_metric)}) on Ticket #${r.number}${subj ? `: ${subj}` : ''}`,
      at: new Date(at).toISOString(),
      tone: isBreach ? 'bad' : 'warn',
      href: `/app/tickets?id=${encodeURIComponent(r.id)}`,
    });
  }

  for (const r of articleRows) {
    const at = r.updated_at || r.created_at;
    items.push({
      id: `kb-${r.id}`,
      kind: 'kb_published',
      text: `Published help article “${excerpt(r.title, 54) || 'Untitled'}”`,
      at: new Date(at).toISOString(),
      tone: 'accent',
      href: '/app/knowledge',
    });
  }

  for (const r of ticketCsatRows) {
    seenCsatTickets.add(r.id);
    const note = excerpt(r.csat_comment || r.subject, 44);
    items.push({
      id: `csat-t-${r.id}`,
      kind: 'low_csat',
      text: `Low CSAT on Ticket #${r.number}${note ? `: “${note}”` : ''}`,
      at: new Date(r.csat_rated_at).toISOString(),
      tone: 'bad',
      href: `/app/tickets?id=${encodeURIComponent(r.id)}`,
    });
  }

  for (const r of surveyCsatRows) {
    if (r.ticket_id && seenCsatTickets.has(r.ticket_id)) continue;
    const who = r.customer_name?.trim() || 'Customer';
    const note = excerpt(r.comment, 44);
    items.push({
      id: `csat-s-${r.id}`,
      kind: 'low_csat',
      text: `Low rating (${r.score}/5) from ${who}${note ? `: “${note}”` : ''}`,
      at: new Date(r.created_at).toISOString(),
      tone: 'bad',
      href: r.conversation_id
        ? `/app/inbox?c=${encodeURIComponent(r.conversation_id)}`
        : r.ticket_id
          ? `/app/tickets?id=${encodeURIComponent(r.ticket_id)}`
          : '/app/engagement',
    });
  }

  for (const r of verifRows) {
    const actor = r.agent_name?.trim() || 'AI assistant';
    const topicOrQ = excerpt(r.topic || r.customer_question, 46);
    const verdictLabel =
      r.human_review === 'wrong'
        ? 'marked incorrect'
        : r.verdict === 'blocked_fixed'
          ? 'blocked unsafe draft'
          : r.verdict === 'blocked_human'
            ? 'escalated to human'
            : 'flagged for review';
    const tone: ActivityFeedItem['tone'] =
      r.human_review === 'wrong' || r.verdict === 'blocked_fixed'
        ? 'bad'
        : r.verdict === 'needs_review'
          ? 'warn'
          : 'ai';

    items.push({
      id: `ai-verif-${r.id}`,
      kind: 'ai_flagged',
      text: `${actor} ${verdictLabel}${topicOrQ ? ` · ${topicOrQ}` : ''}`,
      at: new Date(r.created_at).toISOString(),
      tone,
      href: '/app/ai-quality',
    });
  }

  return items
    .filter((item) => !Number.isNaN(new Date(item.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, safeLimit);
}
