import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* Standard page padding and max width for app screens (Main.dc.html:
   32px 40px, max 1480px), tighter on phones. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto flex w-full max-w-[1480px] flex-col gap-7 px-4 py-6 sm:px-10 sm:py-8', className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1">
        <h2 className="o-page-title">{title}</h2>
        {description ? <p className="mt-1 max-w-[680px] text-[15px] text-o-text-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
