import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/orbat/shell/AppShell';
import { requireShellSession } from '@/lib/data/session';

export const metadata: Metadata = {
  title: 'ORBAT AI',
};

/* The signed-in app. The guard lives here rather than in src/proxy.ts so the
   new UI needs no backend change: requireShellSession() redirects to /login
   (or /onboarding) before anything renders. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const path = (await headers()).get('x-next-pathname') || '/app';
  const session = await requireShellSession(path);
  return <AppShell session={session}>{children}</AppShell>;
}
