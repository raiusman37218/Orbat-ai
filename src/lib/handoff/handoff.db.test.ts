/**
 * The AI -> human handoff rules that live in the database (migrations
 * 20261124090000_handoff_foundation and 20261125090000_handoff_fixes):
 * queueing, ringing, claiming, the first-reply stamp, switching the bot back
 * on, and what the widget is allowed to see.
 *
 * Run with `npm run test:db`.
 */
import { describe, expect, it } from 'vitest';
import {
  agentSays,
  createWorkspace,
  hasDatabase,
  startChat,
  useTestDatabase,
  type Db,
  type WorkspaceFixture,
} from '@/test/db';

describe.skipIf(!hasDatabase)('AI to human handoff (database)', () => {
  const { db } = useTestDatabase();

  interface Chat {
    ws: WorkspaceFixture;
    conversationId: string;
  }

  async function chat(first = 'I need help with my payout'): Promise<Chat> {
    const ws = await createWorkspace(db(), 'Acme');
    const { conversationId } = await startChat(db(), ws, first);
    return { ws, conversationId };
  }

  /** Online, heartbeat and input just now: available for handoff. */
  async function available(d: Db, ws: WorkspaceFixture, agentId: string) {
    await d.q(
      `INSERT INTO agent_status (agent_id, workspace_id, manual_status, last_heartbeat, last_activity_at)
       VALUES ($1, $2, 'online', now(), now())
       ON CONFLICT (agent_id) DO UPDATE SET manual_status = 'online', last_heartbeat = now(), last_activity_at = now()`,
      [agentId, ws.id]
    );
  }

  async function conv(c: Chat) {
    return db().one<{
      handoff_status: string;
      assigned_agent_id: string | null;
      previous_agent_id: string | null;
      ringing_agent_id: string | null;
      ring_broadcast: boolean;
      handoff_requested_at: Date | null;
      first_agent_reply_at: Date | null;
      ai_mode: string;
      ai_enabled: boolean;
    }>(
      `SELECT handoff_status, assigned_agent_id, previous_agent_id, ringing_agent_id, ring_broadcast,
              handoff_requested_at, first_agent_reply_at, ai_mode, ai_enabled
         FROM conversations WHERE id = $1`,
      [c.conversationId]
    );
  }

  const requestHandoff = async (c: Chat) => {
    const [{ r }] = await db().as<{ r: Record<string, unknown> }>(
      { kind: 'service' },
      'SELECT request_handoff($1) AS r',
      [c.conversationId]
    );
    return r;
  };

  it('starts bot first, unassigned, with the bot on', async () => {
    const c = await chat();
    expect(await conv(c)).toMatchObject({ handoff_status: 'bot_active', assigned_agent_id: null, ai_enabled: true });
  });

  it('rings an available agent when the visitor asks for a person', async () => {
    const c = await chat();
    await available(db(), c.ws, c.ws.agentId);
    const r = await requestHandoff(c);
    expect(r).toMatchObject({ ok: true, status: 'waiting_for_agent', ringing_agent_id: c.ws.agentId });
    const row = await conv(c);
    expect(row).toMatchObject({ handoff_status: 'waiting_for_agent', ringing_agent_id: c.ws.agentId, ai_enabled: false });
    expect(row.handoff_requested_at).not.toBeNull();
  });

  it('queues offline when nobody is available', async () => {
    const c = await chat();
    expect(await requestHandoff(c)).toMatchObject({ ok: true, status: 'offline_queued', offline_reason: 'no_agents_available' });
  });

  it('rings everyone at once with broadcast routing', async () => {
    const c = await chat();
    await db().q(`UPDATE workspaces SET handoff_settings = handoff_settings || '{"routing_mode": "broadcast"}' WHERE id = $1`, [c.ws.id]);
    await available(db(), c.ws, c.ws.agentId);
    await available(db(), c.ws, c.ws.adminId);
    await requestHandoff(c);
    expect(await conv(c)).toMatchObject({ handoff_status: 'waiting_for_agent', ringing_agent_id: null, ring_broadcast: true });
  });

  it('lets one agent claim a queued chat even if it was assigned before the bot took it', async () => {
    const c = await chat();
    await db().q('UPDATE conversations SET assigned_agent_id = $2 WHERE id = $1', [c.conversationId, c.ws.adminId]);
    await requestHandoff(c);
    const queued = await conv(c);
    expect(queued).toMatchObject({ handoff_status: 'offline_queued', assigned_agent_id: null, previous_agent_id: c.ws.adminId });

    const [{ r: first }] = await db().as<{ r: Record<string, unknown> }>(
      { kind: 'user', id: c.ws.agentId },
      'SELECT claim_conversation($1) AS r',
      [c.conversationId]
    );
    expect(first).toMatchObject({ ok: true, status: 'agent_active', assigned_agent_id: c.ws.agentId });

    const [{ r: second }] = await db().as<{ r: Record<string, unknown> }>(
      { kind: 'user', id: c.ws.ownerId },
      'SELECT claim_conversation($1) AS r',
      [c.conversationId]
    );
    expect(second).toMatchObject({ ok: false, reason: 'already_claimed' });
  });

  it('stamps the first reply on any conversation a person answers, so it is not re-queued', async () => {
    const c = await chat();
    await agentSays(db(), c.conversationId, c.ws.agentId, 'Hi, let me check that for you.');
    const row = await conv(c);
    expect(row.handoff_status).toBe('agent_active');
    expect(row.first_agent_reply_at).not.toBeNull();
  });

  it('starts a fresh handoff clock on a second request', async () => {
    const c = await chat();
    await db().q(
      `UPDATE conversations SET handoff_requested_at = now() - interval '2 days', first_agent_reply_at = now() - interval '2 days' WHERE id = $1`,
      [c.conversationId]
    );
    await requestHandoff(c);
    const row = await conv(c);
    const [{ now }] = await db().q<{ now: Date }>('SELECT now() AS now');
    expect(row.handoff_requested_at?.getTime()).toBe(now.getTime());
    expect(row.first_agent_reply_at).toBeNull();
  });

  it('hands the conversation back to the bot when a person switches it on', async () => {
    const c = await chat();
    await agentSays(db(), c.conversationId, c.ws.agentId, 'Done, anything else?');
    expect((await conv(c)).handoff_status).toBe('agent_active');
    await db().as({ kind: 'user', id: c.ws.agentId }, `UPDATE conversations SET ai_mode = 'autopilot' WHERE id = $1`, [
      c.conversationId,
    ]);
    expect(await conv(c)).toMatchObject({ handoff_status: 'bot_active', ai_mode: 'autopilot', ai_enabled: true });
  });

  it('keeps the offline queue when the visitor turns on AI assist', async () => {
    const c = await chat();
    await requestHandoff(c);
    await db().q(`UPDATE conversations SET ai_assist = true, ai_mode = 'autopilot' WHERE id = $1`, [c.conversationId]);
    expect(await conv(c)).toMatchObject({ handoff_status: 'offline_queued', ai_enabled: true });
  });

  it('counts holidays entered in Settings as closed', async () => {
    const c = await chat();
    await db().q(
      `UPDATE workspaces
          SET handoff_settings = handoff_settings || jsonb_build_object(
                'office_hours', jsonb_build_object('holidays', jsonb_build_array(to_char(now() AT TIME ZONE public.fn_sla_timezone(id), 'YYYY-MM-DD'))))
        WHERE id = $1`,
      [c.ws.id]
    );
    const [{ open }] = await db().q<{ open: boolean }>('SELECT fn_is_within_office_hours($1) AS open', [c.ws.id]);
    expect(open).toBe(false);
  });

  it("shows the widget the bot's offer, but never the agents-only summary", async () => {
    const c = await chat();
    await db().q(`UPDATE conversations SET handoff_summary = 'internal notes about the customer' WHERE id = $1`, [
      c.conversationId,
    ]);
    const { id } = await db().one<{ id: string }>(
      `INSERT INTO messages (conversation_id, sender_type, content, is_internal, metadata)
       VALUES ($1, 'ai', 'Would you like me to connect you with our team?', false, '{"handoff_offered": true}') RETURNING id`,
      [c.conversationId]
    );
    const { j: msg } = await db().one<{ j: { metadata: Record<string, unknown> } }>(
      'SELECT fn_widget_message_json(m) AS j FROM messages m WHERE m.id = $1',
      [id]
    );
    expect(msg.metadata.handoff_offered).toBe(true);
    const { j: convJson } = await db().one<{ j: Record<string, unknown> }>(
      'SELECT fn_widget_conversation_json(c) AS j FROM conversations c WHERE c.id = $1',
      [c.conversationId]
    );
    expect(convJson.handoff_status).toBe('bot_active');
    expect(convJson).not.toHaveProperty('handoff_summary');
    expect(JSON.stringify(convJson)).not.toContain('internal notes');
  });
});
