import { NextRequest, NextResponse } from 'next/server';
import { hasServiceRole, serviceClient } from '@/lib/pg/service';
import { guardConversation } from '@/lib/team/route-guard';

/**
 * POST /api/conversations/snooze
 * Snoozes a conversation until a specified timestamp.
 */
export async function POST(req: NextRequest) {
  try {
    const { conversation_id, snoozed_until } = await req.json();

    if (!conversation_id) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    const guard = await guardConversation(conversation_id, 'edit_ticket');
    if (!guard.ok) return guard.response;
    const supabase = guard.access.supabase;
    const until = snoozed_until ? new Date(snoozed_until).toISOString() : null;

    const { error } = await supabase
      .from('conversations')
      .update({
        status: 'snoozed',
        snoozed_until: until,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      status: 'snoozed',
      snoozed_until: until,
    });
  } catch (error: any) {
    console.error('[Snooze Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to snooze conversation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations/snooze
 * Checks and auto-reopens all conversations whose snoozed_until timestamp has passed.
 */
export async function GET(req: NextRequest) {
  // Reopening runs across every workspace, so only the scheduler may trigger it.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasServiceRole()) return NextResponse.json({ error: 'DATABASE_URL is not set' }, { status: 500 });
  try {
    const supabase = serviceClient();
    const now = new Date().toISOString();

    // Query overdue snoozed conversations
    const { data: overdue, error: qErr } = await supabase
      .from('conversations')
      .select('id, visitor_id, assigned_agent_id, snoozed_until')
      .eq('status', 'snoozed')
      .lte('snoozed_until', now);

    if (qErr) throw qErr;

    if (!overdue || overdue.length === 0) {
      return NextResponse.json({ reopened: 0, items: [] });
    }

    const ids = overdue.map((c) => c.id);
    const BATCH_SIZE = 200;

    // Auto-reopen them in bounded batches to stay safely below URL/query size limits
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);
      const { error: uErr } = await supabase
        .from('conversations')
        .update({
          status: 'open',
          snoozed_until: null,
          updated_at: now,
        })
        .in('id', batchIds);

      if (uErr) throw uErr;
    }

    return NextResponse.json({
      reopened: ids.length,
      items: overdue,
    });
  } catch (error: any) {
    console.error('[Auto-Reopen Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Auto-reopen check failed' },
      { status: 500 }
    );
  }
}
