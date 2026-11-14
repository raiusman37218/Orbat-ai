'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ShellSession } from '@/lib/data/types';

/* The signed-in agent and workspace, loaded once by the /app layout and
   shared with every screen, so screens never refetch who is signed in. */
const SessionContext = createContext<ShellSession | null>(null);

export function ShellSessionProvider({ session, children }: { session: ShellSession; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useShellSession(): ShellSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useShellSession must be used inside the /app layout');
  return session;
}
