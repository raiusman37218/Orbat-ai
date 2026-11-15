'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Modal, OrbToastProvider } from '@/components/orbat/primitives';
import { signOut } from '@/lib/data/auth';
import { getShellCounts, getShellUsage } from '@/lib/data/shell';
import type { ShellSession } from '@/lib/data/types';
import { useData } from '@/lib/data/use-data';
import { CommandPalette } from './CommandPalette';
import { activeNavId, breadcrumbFor, usesCompactSidebar, visibleNav } from './nav';
import { ShellSessionProvider } from './session-context';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useTheme } from './theme';

const isDev = process.env.NODE_ENV !== 'production';

const subscribeNothing = () => () => {};
const detectMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/* The app frame: sidebar (272px, or the 64px rail on the inbox; a drawer below
   1024px), topbar, ⌘K palette and the shortcuts dialog. */
export function AppShell({ session, children }: { session: ShellSession; children: ReactNode }) {
  const pathname = usePathname() ?? '/app';
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const isMac = useSyncExternalStore(subscribeNothing, detectMac, () => true);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  const groups = useMemo(() => visibleNav(session.agent.role, isDev), [session.agent.role]);
  const activeId = activeNavId(pathname);
  const crumb = breadcrumbFor(pathname);
  const compact = usesCompactSidebar(pathname);

  // Badges refresh on every navigation; the usage card only once.
  const wsId = session.workspace.id;
  const counts = useData(() => getShellCounts(wsId), ['counts', wsId, pathname]);
  const usage = useData(() => getShellUsage(wsId, session.agent.role), ['usage', wsId, session.agent.role]);
  const live = { counts: counts.data ?? null, usage: usage.data ?? null };

  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/login');
  }, [router]);

  // ⌘K / Ctrl+K anywhere; "?" opens shortcuts when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === '?' && !isTyping(e.target) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mobile drawer: a modal <dialog>, so focus is trapped and Escape closes it.
  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    if (drawerOpen && !el.open) el.showModal();
    if (!drawerOpen && el.open) el.close();
  }, [drawerOpen]);

  // Close the drawer when the route changes (e.g. browser back), adjusting
  // state during render as React recommends instead of in an effect.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  return (
    <ShellSessionProvider session={session}>
    <OrbToastProvider>
      <div className="flex min-h-dvh">
        <aside
          className={cn(
            'sticky top-0 hidden h-dvh flex-none border-r border-o-border lg:block',
            compact ? 'w-16' : 'w-[272px]',
          )}
        >
          <Sidebar groups={groups} activeId={activeId} session={session} compact={compact} live={live} />
        </aside>

        <dialog
          ref={drawerRef}
          aria-label="Navigation"
          className="o-drawer lg:hidden"
          onClose={() => setDrawerOpen(false)}
          onCancel={(e) => {
            e.preventDefault();
            setDrawerOpen(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          {drawerOpen ? (
            <Sidebar groups={groups} activeId={activeId} session={session} live={live} onNavigate={() => setDrawerOpen(false)} />
          ) : null}
        </dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            section={crumb.section}
            page={crumb.page}
            workspaceId={session.workspace.id}
            theme={theme}
            onToggleTheme={toggle}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
            onOpenMenu={() => setDrawerOpen(true)}
            isMac={isMac}
          />
          <main id="main" className="flex min-w-0 flex-1 flex-col">
            {children}
          </main>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        workspaceId={wsId}
        groups={groups}
        theme={theme}
        onToggleTheme={toggle}
        onSignOut={handleSignOut}
        isSuperAdmin={session.agent.isSuperAdmin}
      />

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-[14.5px]">
          {[
            ['Search or jump to a page', isMac ? '⌘ K' : 'Ctrl K'],
            ['Show keyboard shortcuts', '?'],
            ['Close a dialog or menu', 'Esc'],
          ].map(([label, keys]) => (
            <div key={label} className="contents">
              <dt className="text-o-text">{label}</dt>
              <dd className="m-0">
                <kbd className="o-mono rounded-md border border-o-border-strong bg-o-surface-2 px-2 py-0.5 text-[12px] text-o-text-2">
                  {keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </Modal>
    </OrbToastProvider>
    </ShellSessionProvider>
  );
}
