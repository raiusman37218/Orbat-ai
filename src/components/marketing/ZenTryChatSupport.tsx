'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { WidgetLoader } from './WidgetLoader';

/**
 * Orbat AI official live support workspace ID.
 * Workspace: "Zen-try" (owner: zentry385@gmail.com)
 */
export const ZENTRY_WORKSPACE_ID = 'b2d91676-2e98-46b7-8543-6e0711c78c44';

type WidgetApi = { close?: () => void; isOpen?: () => boolean };

/**
 * Embeds Orbat AI Live Chat Support widget on public visitor pages.
 *
 * Route exclusions:
 * - /widget, /portal, /onboarding: Standalone flows & custom portal screens.
 * - /dashboard, /app, /v2/: Avoid overlaying agent workspace controls.
 * - /admin: Avoid overlaying super admin panel.
 * - /help: Customer help centers render their own workspace-specific HelpWidget.
 * - /csat: Customer satisfaction feedback page.
 */
export function ZenTryChatSupport() {
  const pathname = usePathname() || '';

  const isExcluded =
    pathname.startsWith('/portal') ||
    pathname.startsWith('/widget') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/v2/') ||
    pathname.startsWith('/dashboard') ||
    pathname === '/app' ||
    pathname.startsWith('/app/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/help') ||
    pathname.startsWith('/csat');

  useEffect(() => {
    const root = document.getElementById('zentry-widget-root');
    if (!root) return;

    if (isExcluded) {
      root.style.display = 'none';
      try {
        const w = window as unknown as Record<string, WidgetApi | undefined>;
        const api = w.Zentry || w['Zen-try'] || w.Chatify;
        if (api && typeof api.close === 'function' && typeof api.isOpen === 'function' && api.isOpen()) {
          api.close();
        }
      } catch {
        /* ignore non-critical widget cleanup errors */
      }
    } else {
      root.style.display = '';
    }
  }, [isExcluded, pathname]);

  if (isExcluded) {
    return null;
  }

  return (
    <WidgetLoader
      workspaceId={ZENTRY_WORKSPACE_ID}
      src="/widget.js"
    />
  );
}
