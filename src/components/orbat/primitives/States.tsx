import { CircleAlert, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

/* Empty and error states (docs/design/design/States.dc.html). Loading uses
   Skeleton / SkeletonRows from Display.tsx. */

export function EmptyState({
  title,
  body,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('o-state', className)}>
      <span className="o-state__icon" aria-hidden="true">
        {icon ?? <Inbox size={22} />}
      </span>
      <p className="o-state__title">{title}</p>
      {body ? <p className="o-state__body">{body}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  body,
  onRetry,
  retrying = false,
  className,
}: {
  title?: ReactNode;
  body?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('o-state', className)} role="alert">
      <span className="o-state__icon o-state__icon--bad" aria-hidden="true">
        <CircleAlert size={22} />
      </span>
      <p className="o-state__title">{title}</p>
      {body ? <p className="o-state__body">{body}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying} className="mt-2">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Alert({
  tone = 'ok',
  children,
  className,
}: {
  tone?: 'ok' | 'warn' | 'bad' | 'ai';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('o-alert', `o-alert--${tone}`, className)} role={tone === 'bad' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
