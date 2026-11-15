'use client';

import { useEffect } from 'react';

/**
 * Loads `/widget.js` standalone embed frame for `/widget?workspaceId=<id>`.
 * Keeps existing external iframe / direct chat links working identically.
 */
export function StandaloneWidgetFrame({ workspaceId }: { workspaceId: string }) {
  useEffect(() => {
    if (!workspaceId || document.querySelector('script[data-zentry-standalone]')) return;
    const w = window as unknown as { Zentry?: unknown };
    if (!w.Zentry) w.Zentry = { q: [['open', []]] };
    const script = document.createElement('script');
    script.src = '/widget.js';
    script.async = true;
    script.setAttribute('data-zentry-standalone', '');
    script.setAttribute('data-workspace-id', workspaceId);
    document.body.appendChild(script);
  }, [workspaceId]);

  if (!workspaceId) {
    return (
      <main className="grid min-h-screen place-items-center bg-o-bg px-4">
        <p className="text-[14.5px] text-o-text-2">
          Add <code className="o-mono">?workspaceId=…</code> to open a standalone workspace chat.
        </p>
      </main>
    );
  }

  return <main className="min-h-screen bg-transparent" aria-label="Chat" />;
}
