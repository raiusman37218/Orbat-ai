import { NextRequest, NextResponse } from 'next/server';
import { queryRows } from '@/lib/db';
import { getWorkspaceCurrentUsage, getWorkspaceEffectivePlan } from '@/lib/plans/enforce';
import { AccessError, getWorkspaceAccess } from '@/lib/team/access';
import { roleCan } from '@/lib/team/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace_id')?.trim() || '';
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id is required.' }, { status: 400 });
  }

  try {
    const { agent, role } = await getWorkspaceAccess(workspaceId, 'view');

    const countsPromise = queryRows<{ unassigned: number; my_open: number }>(
      `SELECT
        COUNT(*) FILTER (WHERE assignee_id IS NULL AND status IN ('new', 'open', 'pending', 'on_hold'))::int AS unassigned,
        COUNT(*) FILTER (WHERE assignee_id = $2 AND status IN ('new', 'open'))::int AS my_open
       FROM public.tickets
       WHERE workspace_id = $1`,
      [workspaceId, agent.id],
    )
      .then((rows) => ({
        inbox: Number(rows[0]?.unassigned ?? 0),
        tickets: Number(rows[0]?.my_open ?? 0),
      }))
      .catch(() => ({ inbox: 0, tickets: 0 }));

    const usagePromise = roleCan(role, 'manage_settings')
      ? (async () => {
          try {
            const effective = await getWorkspaceEffectivePlan(workspaceId);
            if (effective.trialDaysRemaining !== null) {
              return {
                kind: 'trial' as const,
                daysLeft: Math.max(0, effective.trialDaysRemaining),
                trialDays: Math.max(1, effective.plan.trial_days || 14),
                expired: effective.isTrialExpired,
              };
            }
            const limitVal = effective.effectiveLimits.max_ai_bot_replies_per_month;
            if (limitVal === null || limitVal === undefined || !limitVal) {
              return null;
            }
            const currentUsage = await getWorkspaceCurrentUsage(workspaceId, 'max_ai_bot_replies_per_month');
            const percentage = Math.min(100, Math.round((currentUsage / limitVal) * 100));
            return {
              kind: 'usage' as const,
              label: 'AI replies',
              used: currentUsage,
              limit: limitVal,
              percentage,
              planName: effective.plan.name,
              resets: effective.subscription?.current_period_end ?? null,
            };
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null);

    const [counts, usage] = await Promise.all([countsPromise, usagePromise]);

    return NextResponse.json(
      { counts, usage },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    if (err instanceof AccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[GET /api/workspace/shell-bootstrap]:', err);
    return NextResponse.json({ error: 'Failed to load workspace shell.' }, { status: 500 });
  }
}
