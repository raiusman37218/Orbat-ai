'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Right-align numbers. */
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /** Hide below this breakpoint so tables stay usable at 390px. */
  hideBelow?: 'sm' | 'md' | 'lg';
}

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'max-sm:hidden',
  md: 'max-md:hidden',
  lg: 'max-lg:hidden',
};

/* A plain data table. Loading, empty and error states are the caller's job
   (render SkeletonRows / EmptyState / ErrorState instead of the table), so the
   table never has to guess what "no rows" means. */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
  selectedKey,
  className,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Visually hidden caption that names the table for screen readers. */
  caption: string;
  onRowClick?: (row: Row) => void;
  selectedKey?: string | null;
  className?: string;
}) {
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (!onRowClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className={cn('o-table-wrap', className)}>
      <table className="o-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{ width: c.width, textAlign: c.align }}
                className={c.hideBelow ? HIDE[c.hideBelow] : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                data-clickable={onRowClick ? 'true' : undefined}
                aria-selected={selectedKey != null ? selectedKey === key : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={(e) => onKey(e, row)}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{ textAlign: c.align }}
                    className={cn(c.align === 'right' && 'o-num', c.hideBelow && HIDE[c.hideBelow])}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
