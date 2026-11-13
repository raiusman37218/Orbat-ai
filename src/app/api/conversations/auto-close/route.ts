import { NextRequest, NextResponse } from 'next/server';
import { guardWorkspace } from '@/lib/team/route-guard';

/**
 * POST /api/conversations/auto-close
 * Auto-closes conversations that have had no activity for X days (default 7).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = typeof body.days === 'number' && body.days > 0 ? body.days : 7;
    const workspaceId = body.workspace_id;

    const guard = await guardWorkspace(workspaceId, 'edit_ticket');
    if (!guard.ok) return guard.response;
    const supabase = guard.access.supabase;

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('conversations')
      .select('id, workspace_id')
      .eq('status', 'open')
      .lt('updated_at', cutoffDate);

    query = query.eq('workspace_id', workspaceId);

    const { data: staleConvs, error: fetchErr } = await query;
    if (fetchErr) {
      console.error('[Auto-Close Fetch Error]:', fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!staleConvs || staleConvs.length === 0) {
      return NextResponse.json({
        success: true,
        closed_count: 0,
        days,
        message: 'No inactive conversations found past cutoff',
      });
    }

    const convIds = staleConvs.map((c) => c.id);
    const nowIso = new Date().toISOString();
    const BATCH_SIZE = 200;

    // Batch update stale conversations in bounded slices to stay under PostgREST URL limits
    for (let i = 0; i < convIds.length; i += BATCH_SIZE) {
      const batchIds = convIds.slice(i, i + BATCH_SIZE);
      const { error: updateErr } = await supabase
        .from('conversations')
        .update({
          status: 'closed',
          closed_at: nowIso,
          updated_at: nowIso,
        })
        .in('id', batchIds);

      if (updateErr) {
        console.error('[Auto-Close Update Error]:', updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    // Insert system messages in batches
    const systemMessages = convIds.map((id) => ({
      conversation_id: id,
      sender_type: 'system',
      content: `Conversation automatically resolved after ${days} days of inactivity.`,
      is_internal: false,
      created_at: nowIso,
    }));

    try {
      for (let i = 0; i < systemMessages.length; i += BATCH_SIZE) {
        await supabase.from('messages').insert(systemMessages.slice(i, i + BATCH_SIZE));
      }
    } catch (err) {
      console.warn('[Auto-Close Messages Insert Warning]:', err);
    }

    return NextResponse.json({
      success: true,
      closed_count: convIds.length,
      days,
    });
  } catch (err: any) {
    console.error('[Auto-Close Handler Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Auto-close failed' },
      { status: 500 }
    );
  }
}
