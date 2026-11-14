'use client';

import {
  Globe,
  Hash,
  Mail,
  MessageCircle,
  MessageSquare,
  Share2,
} from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/orbat/primitives';
import type { TicketChannel, TicketPriority, TicketStatus } from '@/types/database';

const STATUS_META: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  new: { label: 'New', tone: 'accent' },
  open: { label: 'Open', tone: 'warn' },
  pending: { label: 'Pending', tone: 'neutral' },
  on_hold: { label: 'On hold', tone: 'ai' },
  solved: { label: 'Solved', tone: 'ok' },
  closed: { label: 'Closed', tone: 'neutral' },
};

const PRIORITY_META: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'var(--text-3)' },
  normal: { label: 'Normal', color: 'var(--accent-text)' },
  high: { label: 'High', color: 'var(--warn)' },
  urgent: { label: 'Urgent', color: 'var(--bad)' },
};

const CHANNEL_LABEL: Record<TicketChannel, string> = {
  chat: 'Web chat',
  email: 'Email',
  web_form: 'Web form',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  threads: 'Threads',
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'neutral' as BadgeTone };
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function TicketPriorityCell({ priority }: { priority: TicketPriority }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.normal;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-o-text">
      <span className="o-priority-dot" style={{ background: meta.color }} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

export function TicketChannelPill({ channel }: { channel: TicketChannel }) {
  const icon =
    channel === 'email' ? (
      <Mail size={12} aria-hidden="true" />
    ) : channel === 'whatsapp' ? (
      <MessageCircle size={12} aria-hidden="true" />
    ) : channel === 'web_form' ? (
      <Globe size={12} aria-hidden="true" />
    ) : channel === 'x' || channel === 'threads' || channel === 'tiktok' ? (
      <Hash size={12} aria-hidden="true" />
    ) : channel === 'instagram' || channel === 'linkedin' ? (
      <Share2 size={12} aria-hidden="true" />
    ) : (
      <MessageSquare size={12} aria-hidden="true" />
    );

  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-o-text-3">
      {icon}
      <span>{CHANNEL_LABEL[channel] ?? channel}</span>
    </span>
  );
}

export function formatSlaCountdown(
  slaState: string | null | undefined,
  breachedAt: string | null | undefined,
  warnAt: string | null | undefined,
  dueAt: string | null | undefined,
): { label: string; tone: BadgeTone } | null {
  if (breachedAt) {
    const mins = Math.max(1, Math.round((Date.now() - new Date(breachedAt).getTime()) / 60_000));
    const txt = mins >= 60 ? `${Math.round(mins / 60)}h overdue` : `${mins}m overdue`;
    return { label: txt, tone: 'bad' };
  }
  if (slaState === 'met') return { label: 'Met', tone: 'ok' };
  if (slaState === 'paused') return { label: 'Paused', tone: 'neutral' };
  if (slaState === 'running' && dueAt) {
    const msLeft = new Date(dueAt).getTime() - Date.now();
    if (msLeft <= 0) return { label: 'Due now', tone: 'bad' };
    const minsLeft = Math.max(1, Math.round(msLeft / 60_000));
    const dueLabel =
      minsLeft >= 1440
        ? `${Math.round(minsLeft / 1440)}d left`
        : minsLeft >= 60
          ? `${Math.round(minsLeft / 60)}h left`
          : `${minsLeft}m left`;
    const isWarn = Boolean(warnAt && new Date(warnAt).getTime() <= Date.now());
    return { label: dueLabel, tone: isWarn ? 'warn' : 'ok' };
  }
  return null;
}

export function SlaStatusBadge({
  slaState,
  breachedAt,
  warnAt,
  dueAt,
}: {
  slaState: string | null | undefined;
  breachedAt: string | null | undefined;
  warnAt: string | null | undefined;
  dueAt: string | null | undefined;
}) {
  const formatted = formatSlaCountdown(slaState, breachedAt, warnAt, dueAt);
  if (!formatted) return <span className="text-[13px] text-o-text-3">—</span>;
  return <Badge tone={formatted.tone}>{formatted.label}</Badge>;
}
