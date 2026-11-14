import {
  changeMyPasswordAction,
  getMyProfileAction,
  updateMyProfileAction,
  type AvailabilityMode,
  type MyProfileBundle,
} from '@/app/actions/profile';

export type { AvailabilityMode, MyProfileBundle };

export interface SessionInfoResponse {
  email: string | null;
  lastSignIn: string | null;
}

export async function fetchMyProfile(workspaceId: string): Promise<MyProfileBundle> {
  const res = await getMyProfileAction(workspaceId);
  if (!res.success) {
    throw new Error(res.error);
  }
  return res.data;
}

export async function fetchSessionSecurityInfo(): Promise<SessionInfoResponse> {
  const res = await fetch('/api/auth/sessions', { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    return { email: null, lastSignIn: null };
  }
  const data = (await res.json()) as { email?: string | null; lastSignIn?: string | null };
  return {
    email: data.email ?? null,
    lastSignIn: data.lastSignIn ?? null,
  };
}

export async function revokeOtherSessions(): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/auth/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sign_out_others' }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error || 'Could not sign out other sessions.' };
  }
  return { ok: true };
}

export { changeMyPasswordAction, updateMyProfileAction };
