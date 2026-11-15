'use client';

import {
  ArrowRight,
  LogOut,
  MessageSquare,
  Moon,
  Search,
  Sun,
  Ticket,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchCommandPalette, type PaletteSearchResults } from '@/lib/data/shell';
import { cn } from '@/lib/utils';
import type { NavGroup } from './nav';

/* docs/design/design/Topbar.dc.html, the ⌘K palette. Searches pages, actions,
   and live workspace entities (conversations, tickets, customers). */

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
}

const EMPTY_RESULTS: PaletteSearchResults = {
  conversations: [],
  tickets: [],
  customers: [],
};

export function CommandPalette({
  open,
  onClose,
  workspaceId,
  groups,
  theme,
  onToggleTheme,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
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
  const [entityResults, setEntityResults] = useState<PaletteSearchResults>(EMPTY_RESULTS);
  const [searching, setSearching] = useState(false);
  const listId = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      inputRef.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchCommandPalette(workspaceId, trimmed)
        .then((res) => {
          if (!cancelled) {
            setEntityResults(res);
            setSearching(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setEntityResults(EMPTY_RESULTS);
            setSearching(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, q, workspaceId]);

  const effectiveResults = q.trim().length >= 2 ? entityResults : EMPTY_RESULTS;

  const sections = useMemo(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };

    const needle = q.trim().toLowerCase();
    const filter = (list: Command[]) =>
      needle ? list.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(needle)) : list;

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

    const convItems: Command[] = effectiveResults.conversations.map((c) => ({
      id: `conv:${c.id}`,
      label: c.label,
      hint: c.hint,
      icon: MessageSquare,
      run: go(c.href),
    }));
    const ticketItems: Command[] = effectiveResults.tickets.map((t) => ({
      id: `ticket:${t.id}`,
      label: t.label,
      hint: t.hint,
      icon: Ticket,
      run: go(t.href),
    }));
    const customerItems: Command[] = effectiveResults.customers.map((c) => ({
      id: `customer:${c.id}`,
      label: c.label,
      hint: c.hint,
      icon: Users,
      run: go(c.href),
    }));

    return [
      { label: 'Conversations', items: convItems },
      { label: 'Tickets', items: ticketItems },
      { label: 'Customers', items: customerItems },
      { label: 'Go to', items: filter(pages) },
      { label: 'Actions', items: filter(actions) },
    ].filter((s) => s.items.length > 0);
  }, [groups, theme, q, effectiveResults, onClose, onToggleTheme, onSignOut, router]);

  const flat = sections.flatMap((s) => s.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  const handleClose = () => {
    setQ('');
    setActive(0);
    setEntityResults(EMPTY_RESULTS);
    setSearching(false);
    onClose();
  };

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
      onClose={handleClose}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="flex items-center gap-2.5 border-b border-o-border px-4">
        <Search size={18} className="flex-none text-o-text-3" aria-hidden="true" />
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search pages, conversations, tickets, and customers
        </label>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          value={q}
          onChange={(e) => {
            const next = e.target.value;
            setQ(next);
            setActive(0);
            if (next.trim().length >= 2) {
              setSearching(true);
            } else {
              setEntityResults(EMPTY_RESULTS);
              setSearching(false);
            }
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={flat.length ? `${listId}-${current}` : undefined}
          autoComplete="off"
          placeholder="Search conversations, tickets, customers, or pages…"
          className="h-[52px] min-w-0 flex-1 border-0 bg-transparent text-[15px] text-o-text outline-none placeholder:text-o-text-3 focus-visible:shadow-none focus-visible:outline-none"
        />
        {searching ? (
          <span className="text-[11.5px] text-o-text-3">Searching…</span>
        ) : null}
        <button
          type="button"
          onClick={handleClose}
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
                    <span className="truncate text-[14.5px] font-medium text-o-text">{c.label}</span>
                    <span className="truncate text-[12.5px] text-o-text-3">{c.hint}</span>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {flat.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13.5px] text-o-text-3">
            {searching
              ? `Searching workspace for “${q}”…`
              : `No matches for “${q}”. Try a customer name, ticket # or page.`}
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
