'use client';

import { ArrowRight, LogOut, Moon, Search, Sun, User, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { NavGroup } from './nav';

/* docs/design/design/Topbar.dc.html, the ⌘K palette. For now it searches
   pages and actions. Conversations, customers and tickets join once their
   data functions exist (src/lib/data/*). */

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  groups,
  theme,
  onToggleTheme,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      setQ('');
      setActive(0);
      el.showModal();
      inputRef.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const sections = useMemo(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const pages: Command[] = [
      ...groups.flatMap((g) =>
        g.items.map((i) => ({ id: `go:${i.id}`, label: i.label, hint: g.label, icon: ArrowRight, run: go(i.href) })),
      ),
      { id: 'go:profile', label: 'My profile', hint: 'Status, languages, notifications', icon: User, run: go('/app/profile') },
    ];
    const actions: Command[] = [
      {
        id: 'theme',
        label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        hint: 'Appearance',
        icon: theme === 'dark' ? Sun : Moon,
        run: () => {
          onToggleTheme();
          onClose();
        },
      },
      {
        id: 'signout',
        label: 'Sign out',
        hint: 'End this session on this device',
        icon: LogOut,
        run: () => {
          onClose();
          onSignOut();
        },
      },
    ];
    const needle = q.trim().toLowerCase();
    const filter = (list: Command[]) =>
      needle ? list.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(needle)) : list;
    return [
      { label: 'Go to', items: filter(pages) },
      { label: 'Actions', items: filter(actions) },
    ].filter((s) => s.items.length > 0);
  }, [groups, theme, q, onClose, onToggleTheme, onSignOut, router]);

  const flat = sections.flatMap((s) => s.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((current + 1) % Math.max(1, flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((current - 1 + flat.length) % Math.max(1, flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flat[current]?.run();
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: 'nearest' });
  }, [current, listId]);

  let index = -1;
  return (
    <dialog
      ref={dialogRef}
      aria-label="Command palette"
      className="o-dialog o-dialog--wide o-dialog--top"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-center gap-2.5 border-b border-o-border px-4">
        <Search size={18} className="flex-none text-o-text-3" aria-hidden="true" />
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search pages and actions
        </label>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={flat.length ? `${listId}-${current}` : undefined}
          autoComplete="off"
          placeholder="Search pages, or type a command"
          className="h-[52px] min-w-0 flex-1 border-0 bg-transparent text-[15px] text-o-text outline-none placeholder:text-o-text-3 focus-visible:shadow-none focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          className="o-mono rounded-md border border-o-border-strong bg-o-surface-2 px-2 py-0.5 text-[11px] text-o-text-2"
        >
          esc
        </button>
      </div>
      <div id={listId} role="listbox" aria-label="Results" className="max-h-[400px] overflow-auto p-2">
        {sections.map((s) => (
          <div key={s.label} role="group" aria-label={s.label}>
            <div className="o-cap px-2.5 pb-1 pt-2" aria-hidden="true">
              {s.label}
            </div>
            {s.items.map((c) => {
              index += 1;
              const i = index;
              const Icon = c.icon;
              return (
                <div
                  key={c.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === current}
                  onMouseMove={() => setActive(i)}
                  onClick={c.run}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2',
                    i === current && 'bg-o-surface-2',
                  )}
                >
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-o-surface-2 text-o-text-2">
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[14.5px] font-medium text-o-text">{c.label}</span>
                    <span className="text-[12.5px] text-o-text-3">{c.hint}</span>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {flat.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13.5px] text-o-text-3">
            No matches for “{q}”. Try a page name like “tickets” or “settings”.
          </p>
        ) : null}
      </div>
      <div className="flex gap-4 border-t border-o-border bg-o-surface-2 px-4 py-2.5 text-[12px] text-o-text-3 max-sm:hidden">
        <span>↑↓ to move</span>
        <span>↵ to open</span>
        <span>esc to close</span>
      </div>
    </dialog>
  );
}
