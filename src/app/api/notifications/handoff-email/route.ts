import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/pg/service';
import { loadTeamAlertSmtp } from '@/lib/email/workspace-smtp';
import { sendSmtpEmail } from '@/lib/email/smtp';
import {
  missedChatEmail,
  unansweredQueueAlertEmail,
  queueSummaryEmail,
} from '@/lib/email/team-emails';
import { getRequestOrigin } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

async function sendTelegramAlert(text: string, chatId?: string | null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const targetId = chatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !targetId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.warn('[Telegram Alert Failed]:', err);
  }
}


interface HandoffEmailPayload {
  type: 'missed_chat' | 'unanswered_alert' | 'queue_summary' | 'offline_customer_reply';
  workspace_id: string;
  conversation_id?: string;
  agent_id?: string;
  alert_to?: 'owner' | 'supervisors';
  handoff_reason?: string | null;
  handoff_summary?: string | null;
  offline_reason?: string | null;
  message_preview?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    // Called only by the database (fn_dispatch_handoff_email_alert, through
    // pg_net) with the cron secret. It sends mail through the workspace's SMTP
    // to addresses it looks up, so it must never run for anyone else, in any
    // environment: it used to accept any "Bearer ..." header.
    const authHeader = req.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET;
    const internalSecret = process.env.INTERNAL_API_SECRET || process.env.AI_INTERNAL_SECRET;

    const isAuthorized =
      Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      Boolean(internalSecret && authHeader === `Bearer ${internalSecret}`);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: HandoffEmailPayload = await req.json();
    const { type, workspace_id, conversation_id, agent_id, alert_to, handoff_reason, handoff_summary, message_preview } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    const supabase = serviceClient();
    const appBaseUrl = await getRequestOrigin(req);

    // Fetch workspace
    const { data: ws } = await supabase
      .from('workspaces')
      .select('id, name, owner_id, brand_color, logo_url')
      .eq('id', workspace_id)
      .maybeSingle();

    if (!ws) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspaceName = ws.name || 'Support Desk';
    const brandColor = ws.brand_color || null;

    // Check SMTP
    const mailer = await loadTeamAlertSmtp(workspace_id);
    if (!mailer) {
      return NextResponse.json({ skipped: 'no_smtp_configured' });
    }
    const smtp = mailer.smtp;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. MISSED CHAT ALERT (Conversation timed out or unassigned -> offline_queued)
    // ──────────────────────────────────────────────────────────────────────────
    if (type === 'missed_chat') {
      if (!conversation_id) {
        return NextResponse.json({ error: 'Missing conversation_id for missed_chat' }, { status: 400 });
      }

      const { data: conv } = await supabase
        .from('conversations')
        .select('id, visitor:visitors(name, email)')
        .eq('id', conversation_id)
        .maybeSingle();

      const visitor = (Array.isArray(conv?.visitor) ? conv.visitor[0] : conv?.visitor) as { name?: string | null; email?: string | null } | null;
      const visitorName = visitor?.name?.trim() || visitor?.email?.trim() || 'A customer';
      const conversationUrl = `${appBaseUrl}/dashboard?conversation=${conversation_id}`;

      // Find agents with email_missed enabled in preferences
      const [{ data: agents }, { data: prefs }] = await Promise.all([
        supabase.from('agents').select('id, email, is_active').eq('workspace_id', workspace_id),
        supabase.from('agent_notification_preferences').select('agent_id, email_missed').eq('workspace_id', workspace_id),
      ]);

      const prefsByAgent = new Map((prefs || []).map((p) => [p.agent_id, p.email_missed]));
      const recipients = (agents || [])
        .filter((a) => a.is_active !== false && a.email && (prefsByAgent.get(a.id) !== false))
        .map((a) => ({ id: a.id, email: a.email as string }));

      if (!recipients.length) {
        return NextResponse.json({ sent: 0, reason: 'no_subscribed_agents' });
      }

      const email = missedChatEmail({
        workspaceName,
        brandColor,
        visitorName,
        preview: handoff_summary || message_preview || undefined,
        reason: handoff_reason,
        conversationUrl,
      });

      let sentCount = 0;
      for (const recipient of recipients) {
        const res = await sendSmtpEmail(smtp, {
          to: recipient.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: { 'Auto-Submitted': 'auto-generated' },
        });

        await supabase.from('team_email_log').insert({
          workspace_id,
          conversation_id,
          agent_id: recipient.id,
          email: recipient.email,
          event: 'missed_chat',
          status: res.success ? 'sent' : 'failed',
          error: res.success ? null : (res.error || 'Failed').slice(0, 500),
        });

        if (res.success) sentCount++;
      }

      return NextResponse.json({ ok: true, type, sent: sentCount });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. UNANSWERED QUEUE ALERT (Waited in queue for > 5 min -> notify owner/supervisors)
    // ──────────────────────────────────────────────────────────────────────────
    if (type === 'unanswered_alert') {
      if (!conversation_id) {
        return NextResponse.json({ error: 'Missing conversation_id for unanswered_alert' }, { status: 400 });
      }

      const { data: conv } = await supabase
        .from('conversations')
        .select('id, visitor:visitors(name, email)')
        .eq('id', conversation_id)
        .maybeSingle();

      const visitor = (Array.isArray(conv?.visitor) ? conv?.visitor[0] : conv?.visitor) as { name?: string | null; email?: string | null } | null;
      const visitorName = visitor?.name?.trim() || visitor?.email?.trim() || 'A customer';
      const conversationUrl = `${appBaseUrl}/dashboard?conversation=${conversation_id}`;
      const targetRole = alert_to || 'owner';

      const roles = targetRole === 'supervisors' ? ['owner', 'admin'] : ['owner'];
      const { data: supervisoryAgents } = await supabase
        .from('agents')
        .select('id, email, name, role, is_active')
        .eq('workspace_id', workspace_id)
        .in('role', roles);

      const recipients = (supervisoryAgents || [])
        .filter((a) => a.is_active !== false && a.email)
        .map((a) => ({ id: a.id, email: a.email as string }));

      if (!recipients.length) {
        return NextResponse.json({ sent: 0, reason: 'no_supervisors_found' });
      }

      const email = unansweredQueueAlertEmail({
        workspaceName,
        brandColor,
        visitorName,
        waitMinutes: 5,
        reason: handoff_reason,
        conversationUrl,
        alertToRole: targetRole,
      });

      let sentCount = 0;
      for (const recipient of recipients) {
        const res = await sendSmtpEmail(smtp, {
          to: recipient.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: { 'Auto-Submitted': 'auto-generated' },
        });

        await supabase.from('team_email_log').insert({
          workspace_id,
          conversation_id,
          agent_id: recipient.id,
          email: recipient.email,
          event: 'unanswered_alert',
          status: res.success ? 'sent' : 'failed',
          error: res.success ? null : (res.error || 'Failed').slice(0, 500),
        });

        if (res.success) sentCount++;
      }

      return NextResponse.json({ ok: true, type, sent: sentCount });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. QUEUE SUMMARY EMAIL (Agent came online or requested digest)
    // ──────────────────────────────────────────────────────────────────────────
    if (type === 'queue_summary') {
      const [{ count: waitingCount }, { count: queuedCount }] = await Promise.all([
        supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace_id)
          .eq('handoff_status', 'waiting_for_agent'),
        supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace_id)
          .eq('handoff_status', 'offline_queued'),
      ]);

      const totalPending = (waitingCount || 0) + (queuedCount || 0);
      if (totalPending === 0) {
        return NextResponse.json({ sent: 0, reason: 'queue_empty' });
      }

      // If specific agent_id is provided, check their preference
      let targetAgents: { id: string; email: string; name: string }[] = [];
      if (agent_id) {
        const { data: ag } = await supabase
          .from('agents')
          .select('id, email, name, is_active')
          .eq('id', agent_id)
          .eq('workspace_id', workspace_id)
          .maybeSingle();

        const { data: pref } = await supabase
          .from('agent_notification_preferences')
          .select('email_queue_summary')
          .eq('agent_id', agent_id)
          .eq('workspace_id', workspace_id)
          .maybeSingle();

        if (ag && ag.is_active !== false && ag.email && pref?.email_queue_summary !== false) {
          targetAgents.push({ id: ag.id, email: ag.email, name: ag.name || 'Agent' });
        }
      } else {
        const [{ data: agents }, { data: prefs }] = await Promise.all([
          supabase.from('agents').select('id, email, name, is_active').eq('workspace_id', workspace_id),
          supabase.from('agent_notification_preferences').select('agent_id, email_queue_summary').eq('workspace_id', workspace_id),
        ]);

        const prefsByAgent = new Map((prefs || []).map((p) => [p.agent_id, p.email_queue_summary]));
        targetAgents = (agents || [])
          .filter((a) => a.is_active !== false && a.email && (prefsByAgent.get(a.id) === true))
          .map((a) => ({ id: a.id, email: a.email as string, name: a.name || 'Agent' }));
      }

      if (!targetAgents.length) {
        return NextResponse.json({ sent: 0, reason: 'no_agents_with_summary_enabled' });
      }

      const dashboardUrl = `${appBaseUrl}/dashboard`;
      let sentCount = 0;

      for (const target of targetAgents) {
        const email = queueSummaryEmail({
          workspaceName,
          brandColor,
          agentName: target.name,
          queuedCount: queuedCount || 0,
          waitingCount: waitingCount || 0,
          dashboardUrl,
        });

        const res = await sendSmtpEmail(smtp, {
          to: target.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: { 'Auto-Submitted': 'auto-generated' },
        });

        await supabase.from('team_email_log').insert({
          workspace_id,
          agent_id: target.id,
          email: target.email,
          event: 'queue_summary',
          status: res.success ? 'sent' : 'failed',
          error: res.success ? null : (res.error || 'Failed').slice(0, 500),
        });

        if (res.success) sentCount++;
      }

      return NextResponse.json({ ok: true, type, sent: sentCount });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. OFFLINE CUSTOMER REPLY (Customer sent message in offline_queued chat)
    // ──────────────────────────────────────────────────────────────────────────
    if (type === 'offline_customer_reply') {
      // Agent replies a customer has not read are emailed to the customer by
      // /api/cron/unread-notifications (claimed per message, so never twice).
      // This branch used to email the agents instead, about their own reply.
      return NextResponse.json({ ok: true, type, sent: 0, handled_by: 'unread-notifications' });
    }

    return NextResponse.json({ error: `Unknown event type: ${type}` }, { status: 400 });
  } catch (error: any) {
    console.error('[Handoff Email Route Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to dispatch handoff email' },
      { status: 500 }
    );
  }
}
