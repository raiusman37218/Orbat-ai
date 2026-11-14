'use client';

import { ChevronRight, HelpCircle, Menu, Moon, Search, Sun } from 'lucide-react';
import { Button } from '@/components/orbat/primitives';
import { NotificationsMenu } from './NotificationsMenu';

/* docs/design/design/Topbar.dc.html: 64px, breadcrumb (section › page), pill
   search that opens the ⌘K palette, theme toggle, notifications, help. */
export function Topbar({
  section,
  page,
  workspaceId,
  theme,
  onToggleTheme,
  onOpenPalette,
  onOpenHelp,
  onOpenMenu,
  isMac,
}: {
  section: string;
  page: string;
  workspaceId: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  onOpenHelp: () => void;
  onOpenMenu: () => void;
  isMac: boolean;
}) {
  const themeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <header
      className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-o-border px-4 py-2.5 backdrop-blur-[10px] backdrop-saturate-[1.4] sm:px-8"
      style={{ background: 'color-mix(in srgb, var(--surface) 92%, transparent)' }}
    >
      <Button variant="quiet" icon aria-label="Open navigation" onClick={onOpenMenu} className="lg:hidden">
        <Menu size={20} aria-hidden="true" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-[14.5px] text-o-text-3 max-sm:hidden">{section}</span>
        <ChevronRight size={14} strokeWidth={2} className="flex-none text-o-text-3 max-sm:hidden" aria-hidden="true" />
        <h1 className="truncate font-o-display text-[18px] font-extrabold tracking-[-0.015em]">{page}</h1>
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        aria-label="Search or jump to"
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        className="flex h-[42px] w-[380px] max-w-full items-center gap-2 rounded-full border-0 bg-o-surface-2 pl-4 pr-2.5 text-left text-[14.5px] text-o-text-3 hover:bg-o-surface-3 max-md:w-[42px] max-md:justify-center max-md:p-0"
      >
        <Search size={15} strokeWidth={1.9} aria-hidden="true" className="flex-none" />
        <span className="flex-1 max-md:hidden">Search or jump to…</span>
        <span className="o-mono rounded-[5px] border border-o-border-strong bg-o-surface px-1.5 py-0.5 text-[11px] text-o-text-2 max-md:hidden">
          {isMac ? '⌘K' : 'Ctrl K'}
        </span>
      </button>

      <div className="flex items-center gap-1">
        <Button variant="quiet" icon aria-label={themeLabel} title={themeLabel} onClick={onToggleTheme}>
          {theme === 'dark' ? (
            <Sun size={20} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Moon size={20} strokeWidth={1.8} aria-hidden="true" />
          )}
        </Button>
        <NotificationsMenu workspaceId={workspaceId} />
        <Button
          variant="quiet"
          icon
          aria-label="Help and keyboard shortcuts"
          title="Help · press ? for shortcuts"
          onClick={onOpenHelp}
          className="max-sm:hidden"
        >
          <HelpCircle size={20} strokeWidth={1.8} aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
