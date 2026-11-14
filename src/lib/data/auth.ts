'use client';

import { clearAuthSession } from '@/lib/api/backend-auth';

/* Same sign-out as the old dashboard: end the server session (clears the
   httpOnly cookies), then drop the tokens the browser keeps for the NestJS
   backend and its realtime socket. */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'local' }),
    });
  } catch (err) {
    console.error('[Sign Out]:', err);
  }
  clearAuthSession();
}
