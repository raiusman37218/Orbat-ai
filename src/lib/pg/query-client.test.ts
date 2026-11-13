import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { clearPgQuerySchemaCache, PgCompatClient } from './query-client';

function createMockPool(handler: (sql: string, params: unknown[]) => { rows?: any[]; rowCount?: number }) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM pg_constraint')) {
      return {
        rows: [
          {
            constraint_name: 'conversations_visitor_id_fkey',
            source_table: 'conversations',
            source_column: 'visitor_id',
            target_table: 'visitors',
            target_column: 'id',
          },
          {
            constraint_name: 'conversations_agent_id_fkey',
            source_table: 'conversations',
            source_column: 'assigned_agent_id',
            target_table: 'agents',
            target_column: 'id',
          },
          {
            constraint_name: 'messages_conversation_id_fkey',
            source_table: 'messages',
            source_column: 'conversation_id',
            target_table: 'conversations',
            target_column: 'id',
          },
        ],
      };
    }
    if (sql.includes('FROM information_schema.columns')) {
      return {
        rows: [
          { table_name: 'conversations', column_name: 'tags', udt_name: '_text' },
          { table_name: 'workspaces', column_name: 'ai_settings', udt_name: 'jsonb' },
          { table_name: 'messages', column_name: 'metadata', udt_name: 'jsonb' },
        ],
      };
    }
    if (sql.includes('FROM pg_proc')) {
      return {
        rows: [
          {
            proname: 'fn_deliver_ai_reply',
            arg_names: ['p_conversation_id', 'p_meta'],
            arg_types: ['uuid', 'jsonb'],
            proretset: false,
            ret_type: 'jsonb',
          },
          {
            proname: 'fn_inbox_summaries',
            arg_names: ['p_conversation_ids'],
            arg_types: ['uuid[]'],
            proretset: true,
            ret_type: 'record',
          },
        ],
      };
    }
    const out = handler(sql, params);
    return { rows: out.rows ?? [], rowCount: out.rowCount ?? (out.rows?.length ?? 0) };
  });

  const pool = {
    query,
    connect: vi.fn(async () => ({ query, release: vi.fn() })),
  } as unknown as Pool;

  return { pool, calls };
}

describe('PgCompatClient pure PostgreSQL adapter', () => {
  beforeEach(() => {
    clearPgQuerySchemaCache();
  });

  it('builds parameterized SELECT with !inner join, relation embeds, .or() JSON arrows, order, range, and exact count', async () => {
    const { pool, calls } = createMockPool((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: 1 }] };
      return { rows: [{ id: 'msg-1', visitor: { name: 'Ali' } }] };
    });

    const db = new PgCompatClient(pool);
    const res = await db
      .from('messages')
      .select('id, conversation:conversations!inner(workspace_id)', { count: 'exact' })
      .eq('conversations.workspace_id', 'ws-1')
      .or('reply_to_message_id.eq.v-1,metadata->>answered_message_id.eq.v-1')
      .order('created_at', { ascending: false })
      .range(0, 9);

    expect(res.error).toBeNull();
    expect(res.count).toBe(1);
    expect(res.data).toEqual([{ id: 'msg-1', visitor: { name: 'Ali' } }]);

    const mainCall = calls.find((c) => c.sql.includes('FROM public."messages"') && c.sql.includes('ORDER BY'));
    expect(mainCall?.sql).toContain('INNER JOIN public."conversations" AS _rel_0');
    expect(mainCall?.sql).toContain('_rel_0."workspace_id" = $1');
    expect(mainCall?.sql).toContain(`_b."metadata"->>'answered_message_id' = $3`);
    expect(mainCall?.sql).toContain('LIMIT $4 OFFSET $5');
    expect(mainCall?.params).toEqual(['ws-1', 'v-1', 'v-1', 10, 0]);
  });

  it('resolves explicit FK hints and preserves SQL injection guards', async () => {
    const { pool, calls } = createMockPool(() => ({
      rows: [{ id: 'conv-1', agent: { id: 'ag-1', name: 'Agent' } }],
    }));
    const db = new PgCompatClient(pool);

    const ok = await db
      .from('conversations')
      .select('id, agent:agents!conversations_agent_id_fkey(id, name)')
      .in('status', ['open', 'pending'])
      .maybeSingle();

    expect(ok.error).toBeNull();
    expect(calls.at(-1)?.sql).toContain('LEFT JOIN public."agents" AS _rel_0 ON _b."assigned_agent_id" = _rel_0."id"');
    expect(calls.at(-1)?.sql).toContain('_b."status" IN ($1, $2)');

    const bad = await db.from('conversations').eq('status; DROP TABLE messages--', 'open');
    expect(bad.error?.message).toContain('Invalid SQL column');
  });

  it('handles empty .in() safely, jsonb serialization, and ON CONFLICT upsert', async () => {
    const { pool, calls } = createMockPool(() => ({ rows: [] }));
    const db = new PgCompatClient(pool);

    await db.from('conversations').select('id').in('id', []);
    expect(calls.at(-1)?.sql).toContain('WHERE 1 = 0');

    await db
      .from('workspaces')
      .upsert(
        { id: 'ws-1', ai_settings: [{ provider: 'openai' }] },
        { onConflict: 'id' },
      )
      .select('id')
      .single();

    const upsertCall = calls.at(-1);
    expect(upsertCall?.sql).toContain('ON CONFLICT ("id") DO UPDATE SET "ai_settings" = EXCLUDED."ai_settings"');
    expect(upsertCall?.params[1]).toBe('[{"provider":"openai"}]');
  });

  it('executes scalar and SETOF PostgreSQL RPCs with authenticated sub context', async () => {
    const { pool, calls } = createMockPool((sql) => {
      if (sql.includes('fn_inbox_summaries')) {
        return { rows: [{ row: { conversation_id: 'c1', unread: 2 } }] };
      }
      return { rows: [{ result: { inserted: true } }] };
    });

    const db = new PgCompatClient(pool, { userId: 'agent-123', role: 'authenticated' });
    const scalar = await db.rpc('fn_deliver_ai_reply', {
      p_conversation_id: 'conv-1',
      p_meta: { cited: 2 },
    });
    expect(scalar.error).toBeNull();
    expect(scalar.data).toEqual({ inserted: true });
    expect(calls.some((c) => c.sql.includes("request.jwt.claim.sub") && c.params[0] === 'agent-123')).toBe(true);

    const setof = await db.rpc('fn_inbox_summaries', { p_conversation_ids: ['conv-1'] });
    expect(setof.error).toBeNull();
    expect(setof.data).toEqual([{ conversation_id: 'c1', unread: 2 }]);
  });

  it('supports .overlaps() array operator and nested relation embeds', async () => {
    const { pool, calls } = createMockPool(() => ({
      rows: [{ id: 'msg-2', conversation: { id: 'conv-1', visitor: { name: 'Sara', email: 'sara@example.com' } } }],
    }));

    const db = new PgCompatClient(pool);
    const res = await db
      .from('messages')
      .select('id, conversation:conversations!inner(id, visitor:visitors(name, email))')
      .overlaps('conversations.tags', ['billing', 'vip']);

    expect(res.error).toBeNull();
    const sqlCall = calls.at(-1);
    expect(sqlCall?.sql).toContain('FROM public."visitors" AS _n0_0 WHERE _n0_0."id" = _rel_0."visitor_id" LIMIT 1');
    expect(sqlCall?.sql).toContain('_rel_0."tags" && $1');
    expect(sqlCall?.params).toEqual([['billing', 'vip']]);
  });
});
