import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* Small presentational pieces with no state: Card, Badge, Avatar, Skeleton. */

export function Card({
  size = 'md',
  flush = false,
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { size?: 'md' | 'lg'; flush?: boolean; as?: 'section' | 'div' }) {
  return <section className={cn('o-card', size === 'lg' && 'o-card--lg', flush && 'o-card--flush', className)} {...rest} />;
}

export function CardHeader({
  title,
  sub,
  actions,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start gap-3', className)}>
      <div className="min-w-0 flex-1">
        <h3 className="o-card__title">{title}</h3>
        {sub ? <p className="o-card__sub mt-0.5">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'ai' | 'solid';

export function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span className={cn('o-badge', tone !== 'neutral' && `o-badge--${tone}`, className)} {...rest}>
      {dot ? <span className="o-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/* Stable colour per name, so the same person always gets the same avatar. */
function avatarSlot(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(h) % 6) + 1;
}

export type Presence = 'online' | 'away' | 'offline';

export function Avatar({
  name,
  src,
  size = 36,
  presence,
  ai = false,
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: number;
  presence?: Presence;
  /** AI agents use a rounded square in violet, so it is clear who is speaking. */
  ai?: boolean;
  className?: string;
}) {
  const slot = avatarSlot(name ?? '');
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.36)),
    ...(ai ? {} : { '--av-bg': `var(--av-${slot}-bg)`, '--av-fg': `var(--av-${slot}-fg)` }),
  } as React.CSSProperties;

  return (
    <span className={cn('o-avatar', ai && 'o-avatar--ai', className)} style={style} aria-hidden={name ? undefined : true}>
      {src ? (
        // Avatars come from any upload host (Cloudinary, S3, Google), which
        // next/image would need listed in remotePatterns; they are tiny anyway.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
      {name ? <span className="sr-only">{name}</span> : null}
      {presence ? (
        <span
          className={cn('o-avatar__presence', presence !== 'offline' && `o-avatar__presence--${presence}`)}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}

export function Skeleton({
  width,
  height = 12,
  radius,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}) {
  return <span className={cn('o-sk', className)} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

/* A list-row skeleton used by most list screens while data loads. */
export function SkeletonRows({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton width={36} height={36} radius={9999} />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton width={`${55 - ((i * 7) % 20)}%`} height={12} />
            <Skeleton width={`${88 - ((i * 11) % 25)}%`} height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
