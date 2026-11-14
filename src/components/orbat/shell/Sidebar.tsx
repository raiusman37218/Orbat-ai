'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/orbat/primitives';
import { ROLE_LABELS, STATUS_LABELS } from '@/lib/team/permissions';
import type { ShellCounts, ShellUsage } from '@/lib/data/shell';
import type { ShellSession } from '@/lib/data/types';
import type { NavGroup } from './nav';

/* docs/design/design/Sidebar.dc.html: 272px, grouped nav, lime active pill,
   profile row last. `compact` is the 64px icon rail the inbox uses. */

export function OrbatMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="flex-none">
      <rect width="28" height="28" rx="9" fill="var(--forest)" />
      <ellipse
        cx="14"
        cy="14"
        rx="9.5"
        ry="4.2"
        fill="none"
        stroke="var(--lime)"
        strokeWidth="1.7"
        transform="rotate(-28 14 14)"
      />
      <circle cx="14" cy="14" r="3.2" fill="var(--lime)" />
    </svg>
  );
}

export function Sidebar({
  groups,
  activeId,
  session,
  compact = false,
  live,
  onNavigate,
}: {
  groups: NavGroup[];
  activeId: string | null;
  session: ShellSession;
  compact?: boolean;
  /** Badge counts and the usage / trial card; null while loading or not allowed. */
  live?: { counts: ShellCounts | null; usage: ShellUsage | null };
  /** Called after a link is followed (closes the mobile drawer). */
  onNavigate?: () => void;
}) {
  const { agent, workspace } = session;
  const badgeFor = (id: string): number => {
    if (!live?.counts) return 0;
    if (id === 'inbox') return live.counts.inbox;
    if (id === 'tickets') return live.counts.tickets;
    return 0;
  };
  const usage = live?.usage ?? null;

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'flex h-full min-h-0 flex-col gap-[22px] overflow-y-auto bg-o-side text-o-side-text',
        compact ? 'px-2.5 pb-5 pt-[18px]' : 'px-4 pb-6 pt-5',
      )}
      style={{ scrollbarWidth: 'none' }}
    >
      <Link
        href="/app"
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 rounded-2xl p-2 text-o-text no-underline hover:bg-[var(--hover)]',
          compact && 'justify-center p-0.5',
        )}
        aria-label={compact ? `ORBAT, ${workspace.name}` : undefined}
      >
        <OrbatMark size={compact ? 40 : 40} />
        {!compact ? (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-o-display text-[18px] font-black tracking-[-0.01em] text-o-text">ORBAT</span>
            <span className="truncate text-[13.5px] text-o-text-3">{workspace.name}</span>
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-[18px]">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5" role="group" aria-label={g.label}>
            {compact ? (
              <div className="mx-2 mb-1.5 h-px bg-o-border" aria-hidden="true" />
            ) : (
              <div className="px-4 pb-1.5 text-[12.5px] font-semibold text-o-text-3" aria-hidden="true">
                {g.label}
              </div>
            )}
            {g.items.map((item) => {
              const on = item.id === activeId;
              const Icon = item.icon;
              const badge = badgeFor(item.id);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={on ? 'page' : undefined}
                  aria-label={compact ? (badge ? `${item.label}, ${badge}` : item.label) : undefined}
                  title={compact ? item.label : undefined}
                  className={cn(
                    'relative flex h-11 items-center gap-3.5 rounded-full text-[15.5px] no-underline',
                    compact ? 'w-11 justify-center self-center' : 'px-4',
                    on
                      ? 'bg-o-lime font-[650] text-o-on-lime hover:bg-o-lime-hover'
                      : 'font-medium text-o-side-text hover:bg-[var(--hover)] hover:text-o-text',
                  )}
                >
                  <Icon size={22} strokeWidth={1.8} aria-hidden="true" className="flex-none" />
                  {!compact ? <span className="flex-1 truncate">{item.label}</span> : null}
                  {badge > 0 && !compact ? (
                    <span
                      className={cn(
                        'o-num min-w-[26px] rounded-full px-2 py-0.5 text-center text-[12.5px] font-bold text-o-forest',
                        on ? 'bg-o-surface' : 'bg-o-mint',
                      )}
                    >
                      <span className="sr-only">, </span>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : null}
                  {badge > 0 && compact ? (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-o-forest" aria-hidden="true" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {!compact && usage ? <UsageCard usage={usage} onNavigate={onNavigate} /> : null}
        <Link
          href="/app/profile"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-full p-2 text-o-text no-underline hover:bg-[var(--hover)]',
            compact && 'justify-center p-0.5',
          )}
          aria-label={compact ? `${agent.name}, ${STATUS_LABELS[agent.status]}. My profile` : undefined}
        >
          <Avatar name={agent.name} src={agent.avatarUrl} size={40} presence={agent.status} />
          {!compact ? (
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-semibold">{agent.name}</span>
              <span className="truncate text-[13px] text-o-text-3">
                {ROLE_LABELS[agent.role]} · {STATUS_LABELS[agent.status]}
              </span>
            </span>
          ) : null}
        </Link>
      </div>
    </nav>
  );
}

/* Sidebar.dc.html: a forest trial card while trialing, otherwise the AI
   usage meter. Admins and owners only (see getShellUsage). */
function UsageCard({ usage, onNavigate }: { usage: ShellUsage; onNavigate?: () => void }) {
  if (usage.kind === 'trial') {
    const pct = Math.min(100, Math.round(((usage.trialDays - usage.daysLeft) / usage.trialDays) * 100));
    return (
      <Link
        href={usage.expired ? '/app/trial-ended' : '/app/trial'}
        onClick={onNavigate}
        className="flex flex-col gap-2.5 rounded-[24px] bg-o-forest p-[18px] no-underline"
      >
        <span className="flex justify-between text-[14px]">
          <span className="font-semibold text-o-on-forest">{usage.expired ? 'Trial ended' : 'Free trial'}</span>
          <span className="o-num text-o-mint">{usage.expired ? 'Choose a plan' : `${usage.daysLeft} days left`}</span>
        </span>
        <span className="h-1.5 rounded-full bg-o-on-forest-track" aria-hidden="true">
          <span className="block h-1.5 rounded-full bg-o-lime" style={{ width: `${pct}%` }} />
        </span>
        <span className="grid h-10 place-items-center rounded-full bg-o-lime text-[14.5px] font-semibold text-o-forest">
          Choose a plan
        </span>
      </Link>
    );
  }
  const resets = usage.resets
    ? new Date(usage.resets).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;
  return (
    <Link
      href="/app/billing"
      onClick={onNavigate}
      className="flex flex-col gap-2.5 rounded-[24px] bg-o-side-2 p-[18px] text-o-text no-underline hover:bg-o-surface-3"
    >
      <span className="flex justify-between gap-2 text-[14px]">
        <span className="font-semibold">{usage.label}</span>
        <span className="o-num text-o-text-2">
          {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}
        </span>
      </span>
      <span
        className="h-1.5 rounded-full bg-o-surface-3"
        role="progressbar"
        aria-label={`${usage.label} used this period`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usage.percentage}
      >
        <span
          className={cn('block h-1.5 rounded-full', usage.percentage >= 80 ? 'bg-o-warn' : 'bg-o-forest')}
          style={{ width: `${usage.percentage}%` }}
        />
      </span>
      <span className="text-[13px] text-o-text-3">
        {resets ? `Resets ${resets} · ` : ''}
        {usage.planName} plan
      </span>
    </Link>
  );
}
