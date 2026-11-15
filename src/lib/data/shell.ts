'use client';

import { listDashboardConversationsAction } from '@/app/actions/inbox';
import { listCustomersAction } from '@/app/actions/customers';
import { getWorkspaceBillingAndUsageAction } from '@/app/actions/plans';
import { getViewCountsAction, searchTicketsAction } from '@/app/actions/tickets';
import { roleCan, type Role } from '@/lib/team/permissions';

/* Live bits of the app shell: sidebar badges, usage card, and ⌘K entity search. */

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

export interface PaletteEntityHit {
  id: string;
  label: string;
  hint: string;
  href: string;
}

export interface PaletteSearchResults {
  conversations: PaletteEntityHit[];
  tickets: PaletteEntityHit[];
  customers: PaletteEntityHit[];
}

export async function searchCommandPalette(
  workspaceId: string,
  rawQuery: string,
): Promise<PaletteSearchResults> {
  const q = rawQuery.trim();
  if (q.length < 2) {
    return { conversations: [], tickets: [], customers: [] };
  }
  const needle = q.toLowerCase();

  const [convRes, ticketRes, customerRes] = await Promise.allSettled([
    listDashboardConversationsAction(workspaceId, 0, 25),
    searchTicketsAction(workspaceId, q),
    listCustomersAction(workspaceId, { q, pageSize: 10 }),
  ]);

  const conversations: PaletteEntityHit[] =
    convRes.status === 'fulfilled'
      ? convRes.value.conversations
          .filter((c) => {
            const hay = `${c.visitor?.name ?? ''} ${c.visitor?.email ?? ''} ${c.last_message?.content ?? ''} ${c.status ?? ''} ${c.id}`.toLowerCase();
            return hay.includes(needle);
          })
          .slice(0, 5)
          .map((c) => ({
            id: c.id,
            label: c.visitor?.name || c.visitor?.email || `Conversation ${c.id.slice(0, 8)}`,
            hint: c.last_message?.content
              ? `${c.status} · ${c.last_message.content.slice(0, 60)}`
              : `${c.status} · ${c.channel || 'web'}`,
            href: `/app/inbox?conversation=${encodeURIComponent(c.id)}`,
          }))
      : [];

  const tickets: PaletteEntityHit[] =
    ticketRes.status === 'fulfilled'
      ? ticketRes.value.tickets.slice(0, 5).map((t) => ({
          id: t.id,
          label: `#TCK-${t.number} · ${t.subject}`,
          hint: `${t.status}${t.requester?.name || t.requester?.email ? ` · ${t.requester.name || t.requester.email}` : ''}`,
          href: `/app/tickets?id=${encodeURIComponent(t.id)}`,
        }))
      : [];

  const customers: PaletteEntityHit[] =
    customerRes.status === 'fulfilled'
      ? customerRes.value.customers.slice(0, 5).map((c) => ({
          id: c.id,
          label: c.name || c.email || `Visitor ${c.id.slice(0, 8)}`,
          hint: [c.email, c.company].filter(Boolean).join(' · ') || 'Customer profile',
          href: `/app/customers?id=${encodeURIComponent(c.id)}`,
        }))
      : [];

  return { conversations, tickets, customers };
}
