'use server';

import bcrypt from 'bcryptjs';
import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import {
  getPgPasswordHashForUser,
  updatePgAuthUser,
} from '@/lib/auth/postgres-auth';

export type AvailabilityMode = 'online' | 'away' | 'dnd';

export interface MyProfileBundle {
  agentId: string;
  workspaceId: string;
  name: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: 'owner' | 'admin' | 'agent' | 'light_agent';
  availabilityMode: AvailabilityMode;
  onCallPhone: string;
  spokenLanguages: string[];
  maxOpenTickets: number;
  autoAwayOnIdle: boolean;
  ringOnHandoff: boolean;
  urgentPingsOnBreach: boolean;
  totpEnabled: boolean;
  totpEnrolledAt: string | null;
  lastSeenAt: string | null;
  hasPassword: boolean;
}

export async function getMyProfileAction(
  workspaceId: string,
): Promise<{ success: true; data: MyProfileBundle } | { success: false; error: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'reply');

    const [agentRows, prefRows, passHash] = await Promise.all([
      queryRows<{
        id: string;
        name: string;
        display_name: string | null;
        email: string;
        avatar_url: string | null;
        role: 'owner' | 'admin' | 'agent' | 'light_agent';
        status: string | null;
        availability_mode: string | null;
        on_call_phone: string | null;
        spoken_languages: string[] | null;
        max_open_tickets: number | null;
        totp_enabled: boolean | null;
        totp_enrolled_at: string | Date | null;
        last_seen_at: string | Date | null;
      }>(
        `SELECT id, name, display_name, email, avatar_url, role, status,
                availability_mode, on_call_phone, spoken_languages,
                max_open_tickets, COALESCE(totp_enabled, false) AS totp_enabled,
                totp_enrolled_at, last_seen_at
         FROM public.agents
         WHERE id = $1 AND workspace_id = $2
         LIMIT 1`,
        [user.id, workspaceId],
      ),
      queryRows<{
        auto_away_on_idle: boolean | null;
        ring_on_handoff: boolean | null;
        urgent_pings_on_breach: boolean | null;
      }>(
        `SELECT auto_away_on_idle, ring_on_handoff, urgent_pings_on_breach
         FROM public.agent_notification_preferences
         WHERE agent_id = $1 AND workspace_id = $2
         LIMIT 1`,
        [user.id, workspaceId],
      ).catch(() => []),
      getPgPasswordHashForUser(user.id, user.email || undefined),
    ]);

    const a = agentRows[0];
    if (!a) {
      return { success: false, error: 'Profile not found in this workspace.' };
    }

    const rawMode = a.availability_mode || a.status || 'online';
    const availabilityMode: AvailabilityMode =
      rawMode === 'dnd' ? 'dnd' : rawMode === 'away' || rawMode === 'offline' ? 'away' : 'online';

    const pref = prefRows[0];

    return {
      success: true,
      data: {
        agentId: a.id,
        workspaceId,
        name: a.name,
        displayName: a.display_name || a.name,
        email: a.email,
        avatarUrl: a.avatar_url,
        role: a.role,
        availabilityMode,
        onCallPhone: a.on_call_phone || '',
        spokenLanguages:
          Array.isArray(a.spoken_languages) && a.spoken_languages.length > 0
            ? a.spoken_languages
            : ['English'],
        maxOpenTickets: a.max_open_tickets ?? 12,
        autoAwayOnIdle: pref?.auto_away_on_idle ?? true,
        ringOnHandoff: pref?.ring_on_handoff ?? true,
        urgentPingsOnBreach: pref?.urgent_pings_on_breach ?? true,
        totpEnabled: Boolean(a.totp_enabled),
        totpEnrolledAt: a.totp_enrolled_at ? new Date(a.totp_enrolled_at).toISOString() : null,
        lastSeenAt: a.last_seen_at ? new Date(a.last_seen_at).toISOString() : null,
        hasPassword: Boolean(passHash),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not load profile.',
    };
  }
}

export async function updateMyProfileAction(
  workspaceId: string,
  input: {
    name: string;
    displayName: string;
    onCallPhone: string;
    spokenLanguages: string[];
    availabilityMode: AvailabilityMode;
    maxOpenTickets: number;
    autoAwayOnIdle: boolean;
    ringOnHandoff: boolean;
    urgentPingsOnBreach: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'reply');
    const cleanName = input.name.trim() || 'Teammate';
    const cleanDisplay = input.displayName.trim() || cleanName;
    const cleanLangs = Array.from(
      new Set(input.spokenLanguages.map((l) => l.trim()).filter(Boolean)),
    ).slice(0, 12);
    const langs = cleanLangs.length > 0 ? cleanLangs : ['English'];
    const mode: AvailabilityMode =
      input.availabilityMode === 'dnd' ? 'dnd' : input.availabilityMode === 'away' ? 'away' : 'online';
    const agentStatus = mode === 'online' ? 'online' : 'away';
    const maxTickets = Math.max(1, Math.min(200, Math.floor(Number(input.maxOpenTickets) || 12)));

    await query(
      `UPDATE public.agents
       SET name = $1,
           display_name = $2,
           on_call_phone = $3,
           spoken_languages = $4,
           availability_mode = $5,
           status = $6,
           max_open_tickets = $7
       WHERE id = $8 AND workspace_id = $9`,
      [
        cleanName,
        cleanDisplay,
        input.onCallPhone.trim() || null,
        langs,
        mode,
        agentStatus,
        maxTickets,
        user.id,
        workspaceId,
      ],
    );

    await query(
      `INSERT INTO public.agent_status (agent_id, workspace_id, manual_status, last_heartbeat, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT (agent_id)
       DO UPDATE SET workspace_id = $2, manual_status = $3, last_heartbeat = now(), updated_at = now()`,
      [user.id, workspaceId, agentStatus],
    ).catch(() => {});

    await query(
      `INSERT INTO public.agent_notification_preferences (
         agent_id, workspace_id, auto_away_on_idle, ring_on_handoff, urgent_pings_on_breach, updated_at
       ) VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (agent_id, workspace_id)
       DO UPDATE SET
         auto_away_on_idle = EXCLUDED.auto_away_on_idle,
         ring_on_handoff = EXCLUDED.ring_on_handoff,
         urgent_pings_on_breach = EXCLUDED.urgent_pings_on_breach,
         updated_at = now()`,
      [
        user.id,
        workspaceId,
        Boolean(input.autoAwayOnIdle),
        Boolean(input.ringOnHandoff),
        Boolean(input.urgentPingsOnBreach),
      ],
    );

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not update profile.',
    };
  }
}

export async function changeMyPasswordAction(
  workspaceId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await getWorkspaceAccess(workspaceId, 'reply');
    if (input.newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters.' };
    }

    const existingHash = await getPgPasswordHashForUser(user.id, user.email || undefined);
    if (existingHash) {
      const ok = await bcrypt.compare(input.currentPassword, existingHash);
      if (!ok) {
        return { success: false, error: 'Current password is incorrect.' };
      }
    }

    const res = await updatePgAuthUser(user.id, { password: input.newPassword });
    if (res.error) {
      return { success: false, error: res.error.message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to change password.',
    };
  }
}
