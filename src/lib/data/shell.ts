'use client';

import { getWorkspaceBillingAndUsageAction } from '@/app/actions/plans';
import { getViewCountsAction } from '@/app/actions/tickets';
import { roleCan, type Role } from '@/lib/team/permissions';

/* Live bits of the app shell: sidebar badges and the usage / trial card. */

export interface ShellCounts {
  /** Shown on "Inbox": every unsolved ticket nobody owns yet. */
  inbox: number;
  /** Shown on "Tickets": new and open tickets assigned to me. */
  tickets: number;
}

export async function getShellCounts(workspaceId: string): Promise<ShellCounts> {
  const counts = await getViewCountsAction(workspaceId);
  return {
    inbox: counts['system:unassigned'] ?? 0,
    tickets: counts['system:my_open'] ?? 0,
  };
}

export type ShellUsage =
  | { kind: 'trial'; daysLeft: number; trialDays: number; expired: boolean }
  | { kind: 'usage'; label: string; used: number; limit: number; percentage: number; planName: string; resets: string | null };

/* Admins and owners only: the billing overview behind it is admin-guarded,
   so everyone else simply gets no card. */
export async function getShellUsage(workspaceId: string, role: Role): Promise<ShellUsage | null> {
  if (!roleCan(role, 'manage_settings')) return null;
  const billing = await getWorkspaceBillingAndUsageAction(workspaceId);

  if (billing.trialDaysRemaining !== null) {
    return {
      kind: 'trial',
      daysLeft: Math.max(0, billing.trialDaysRemaining),
      trialDays: Math.max(1, billing.plan.trial_days || 14),
      expired: billing.isTrialExpired,
    };
  }

  const ai = billing.limits.find((l) => l.key === 'max_ai_bot_replies_per_month');
  if (!ai || ai.isUnlimited || !ai.limit) return null;
  return {
    kind: 'usage',
    label: 'AI replies',
    used: ai.currentUsage,
    limit: ai.limit,
    percentage: ai.percentage,
    planName: billing.plan.name,
    resets: billing.subscription.current_period_end ?? null,
  };
}
