import { NextRequest, NextResponse } from 'next/server';
import { guardConversation } from '@/lib/team/route-guard';
import { getDbPool as pool } from '@/lib/db';

/**
 * POST /api/conversations/merge
 * Merges source_conversation_id into target_conversation_id.
 */
export async function POST(req: NextRequest) {
  try {
    const { source_conversation_id, target_conversation_id, agent_name } = await req.json();

    if (!source_conversation_id || !target_conversation_id) {
      return NextResponse.json(
        { error: 'Both source_conversation_id and target_conversation_id are required' },
        { status: 400 }
      );
    }

    if (source_conversation_id === target_conversation_id) {
      return NextResponse.json(
        { error: 'Cannot merge a conversation into itself' },
        { status: 400 }
      );
    }

    const guard = await guardConversation(source_conversation_id, 'edit_ticket');
    if (!guard.ok) return guard.response;
    const supabase = guard.access.supabase;
    const shortSourceId = source_conversation_id.slice(0, 8);
    const systemText = `📎 Thread merged: Conversation #${shortSourceId} was consolidated into this thread by ${
      agent_name || 'an agent'
    }.`;

    // Atomic transactional merge when direct PostgreSQL pool is configured
    if (process.env.DATABASE_URL) {
      const client = await pool().connect();
      try {
        await client.query('BEGIN');
        const rowsRes = await client.query<{ id: string; workspace_id: string; tags: string[] | null }>(
          `SELECT id, workspace_id, tags
           FROM public.conversations
           WHERE id = ANY($1::uuid[]) AND workspace_id = $2
           FOR UPDATE`,
          [[source_conversation_id, target_conversation_id], guard.workspaceId]
        );
        const sourceRow = rowsRes.rows.find((r) => r.id === source_conversation_id);
        const targetRow = rowsRes.rows.find((r) => r.id === target_conversation_id);
        if (!sourceRow) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: 'Source conversation not found' }, { status: 404 });
        }
        if (!targetRow) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: 'Target conversation not found' }, { status: 404 });
        }

        const combinedTags = Array.from(
          new Set([...(targetRow.tags || []), ...(sourceRow.tags || [])])
        );

        await client.query(
          'UPDATE public.messages SET conversation_id = $1 WHERE conversation_id = $2',
          [target_conversation_id, source_conversation_id]
        );
        await client.query(
          'UPDATE public.internal_notes SET conversation_id = $1 WHERE conversation_id = $2',
          [target_conversation_id, source_conversation_id]
        );
        await client.query(
          'UPDATE public.conversations SET tags = $1, updated_at = now() WHERE id = $2 AND workspace_id = $3',
          [combinedTags, target_conversation_id, guard.workspaceId]
        );
        await client.query(
          `UPDATE public.conversations
           SET status = 'closed', merged_into = $1, closed_at = now(), updated_at = now()
           WHERE id = $2 AND workspace_id = $3`,
          [target_conversation_id, source_conversation_id, guard.workspaceId]
        );
        await client.query(
          `INSERT INTO public.messages (conversation_id, sender_type, content, is_internal)
           VALUES ($1, 'system', $2, false)`,
          [target_conversation_id, systemText]
        );
        await client.query('COMMIT');

        return NextResponse.json({
          success: true,
          target_id: target_conversation_id,
          source_id: source_conversation_id,
          merged_tags: combinedTags,
        });
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }
    }

    // Fallback path when only Supabase REST client is configured
    const { data: sourceConv, error: sErr } = await supabase
      .from('conversations')
      .select('id, tags')
      .eq('id', source_conversation_id)
      .single();

    const { data: targetConv, error: tErr } = await supabase
      .from('conversations')
      .select('id, tags')
      .eq('id', target_conversation_id)
      .single();

    if (sErr || !sourceConv) {
      return NextResponse.json({ error: 'Source conversation not found' }, { status: 404 });
    }
    if (tErr || !targetConv) {
      return NextResponse.json({ error: 'Target conversation not found' }, { status: 404 });
    }

    // Both threads must be in the caller's workspace.
    const { data: targetWs } = await supabase.from('conversations').select('workspace_id').eq('id', target_conversation_id).maybeSingle();
    if (targetWs?.workspace_id !== guard.workspaceId) {
      return NextResponse.json({ error: 'Target conversation not found' }, { status: 404 });
    }

    // 2. Re-point messages from source to target
    const { error: msgErr } = await supabase
      .from('messages')
      .update({ conversation_id: target_conversation_id })
      .eq('conversation_id', source_conversation_id);

    if (msgErr) throw msgErr;

    // 3. Re-point internal notes from source to target
    const { error: noteErr } = await supabase
      .from('internal_notes')
      .update({ conversation_id: target_conversation_id })
      .eq('conversation_id', source_conversation_id);

    if (noteErr) throw noteErr;

    // 4. Combine tags
    const combinedTags = Array.from(
      new Set([...(targetConv.tags || []), ...(sourceConv.tags || [])])
    );

    // 5. Update target conversation
    await supabase
      .from('conversations')
      .update({
        tags: combinedTags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', target_conversation_id);

    // 6. Close source conversation and mark as merged
    await supabase
      .from('conversations')
      .update({
        status: 'closed',
        merged_into: target_conversation_id,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', source_conversation_id);

    // 7. Insert an informative system event message in target thread
    await supabase.from('messages').insert({
      conversation_id: target_conversation_id,
      sender_type: 'system',
      content: systemText,
      is_internal: false,
    });

    return NextResponse.json({
      success: true,
      target_id: target_conversation_id,
      source_id: source_conversation_id,
      merged_tags: combinedTags,
    });
  } catch (error: any) {
    console.error('[Merge Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Conversation merge failed' },
      { status: 500 }
    );
  }
}
