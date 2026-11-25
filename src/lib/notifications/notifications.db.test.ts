/**
 * Database-level RLS & constraint guarantees for `public.workspace_notifications`.
 * Run with `npm run test:db`.
 */
import { describe, expect, it } from 'vitest';
import { addMember, createWorkspace, hasDatabase, useTestDatabase } from '@/test/db';

describe.skipIf(!hasDatabase)('workspace_notifications (database)', () => {
  const { db } = useTestDatabase();

  it('enforces workspace isolation, per-recipient visibility, and kind constraints via RLS', async () => {
    const wsA = await createWorkspace(db());
    const wsB = await createWorkspace(db());
    const mateA = await addMember(db(), wsA.id, 'agent');

    // Service role creates: 1 workspace-wide alert + 1 targeted to wsA.agentId + 1 in wsB
    await db().as(
      { kind: 'service' },
      `INSERT INTO public.workspace_notifications (workspace_id, recipient_agent_id, kind, title, body, href)
       VALUES
         ($1, NULL, 'handoff', 'Workspace handoff', 'Needs human', '/app/inbox?c=1'),
         ($1, $2, 'mention', 'Direct mention', '@agent check this', '/app/tickets?id=1'),
         ($3, NULL, 'sla_breach', 'Other workspace breach', 'Secret', '/app/tickets?id=2')`,
      [wsA.id, wsA.agentId, wsB.id],
    );

    // Target agent sees both workspace-wide and personal alerts, never wsB's
    const seenByTarget = await db().as<{ title: string }>(
      { kind: 'user', id: wsA.agentId },
      'SELECT title FROM public.workspace_notifications ORDER BY created_at ASC',
    );
    expect(seenByTarget.map((r) => r.title)).toEqual(['Workspace handoff', 'Direct mention']);

    // Teammate sees workspace-wide alert, NOT wsA.agentId's private mention
    const seenByMate = await db().as<{ title: string }>(
      { kind: 'user', id: mateA },
      'SELECT title FROM public.workspace_notifications ORDER BY created_at ASC',
    );
    expect(seenByMate.map((r) => r.title)).toEqual(['Workspace handoff']);

    // Cross-workspace user sees nothing from wsA
    const seenByOtherWs = await db().as<{ title: string }>(
      { kind: 'user', id: wsB.agentId },
      'SELECT title FROM public.workspace_notifications WHERE workspace_id = $1',
      [wsA.id],
    );
    expect(seenByOtherWs).toEqual([]);

    // Invalid kind fails CHECK constraint
    await expect(
      db().rejects(
        { kind: 'service' },
        `INSERT INTO public.workspace_notifications (workspace_id, kind, title) VALUES ($1, 'invalid_kind', 'Bad')`,
        [wsA.id],
      ),
    ).resolves.toMatch(/check/i);
  });
});
