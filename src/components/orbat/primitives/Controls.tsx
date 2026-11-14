'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* Tabs (underline), Segmented (pill group) and Toggle (switch).
   Tabs and Segmented use roving focus: Tab enters the group, arrow keys move. */

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
}

function rovingKeys<T>(e: KeyboardEvent, items: T[], index: number, pick: (item: T, i: number) => void) {
  const last = items.length - 1;
  let next = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index >= last ? 0 : index + 1;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index <= 0 ? last : index - 1;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = last;
  if (next >= 0) {
    e.preventDefault();
    pick(items[next], next);
  }
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
  idBase,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
  /** Pass the same value to TabPanel's `idBase` to link tab and panel. */
  idBase?: string;
}) {
  const autoId = useId();
  const base = idBase ?? autoId;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, items.findIndex((t) => t.id === value));

  return (
    <div role="tablist" aria-label={label} className={cn('o-tabs', className)}>
      {items.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-controls={`${base}-panel-${t.id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="o-tab"
            onClick={() => onChange(t.id)}
            onKeyDown={(e) =>
              rovingKeys(e, items, index, (item, n) => {
                onChange(item.id);
                refs.current[n]?.focus();
              })
            }
          >
            {t.label}
            {typeof t.count === 'number' ? <span className="ml-1.5 o-num text-o-text-3">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idBase,
  id,
  children,
  className,
}: {
  idBase: string;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} className={className}>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, items.findIndex((t) => t.id === value));
  return (
    <div role="radiogroup" aria-label={label} className={cn('o-seg', className)}>
      {items.map((t, i) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className="o-seg__item"
            onClick={() => onChange(t.id)}
            onKeyDown={(e) =>
              rovingKeys(e, items, index, (item, n) => {
                onChange(item.id);
                refs.current[n]?.focus();
              })
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  hideLabel = false,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
  /** Keep the label for screen readers only (e.g. inside a table row). */
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  const sw = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      aria-describedby={description && !hideLabel ? `${id}-desc` : undefined}
      disabled={disabled}
      className="o-switch"
      onClick={() => onChange(!checked)}
    />
  );
  if (hideLabel) return <span className={className}>{sw}</span>;
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[15px] font-semibold text-o-text">
          {label}
        </label>
        {description ? (
          <p id={`${id}-desc`} className="mt-0.5 text-[13px] text-o-text-3">
            {description}
          </p>
        ) : null}
      </div>
      {sw}
    </div>
  );
}
