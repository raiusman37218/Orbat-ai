import { NextResponse } from 'next/server';
import { queryRows } from '@/lib/db';
import { sessionUser } from '@/lib/auth/session-user';
import { resendSignupVerificationCodeAction } from '@/app/actions/auth-verification';

export async function GET() {
  try {
    const user = await sessionUser();
    if (!user) {
      return NextResponse.json(
        { authenticated: false, user: null, emailConfirmed: false, agent: null, workspace: null },
        { status: 401 },
      );
    }

    const agentRows = await queryRows<Record<string, any>>(
      `SELECT a.id, a.name, a.email, a.role, a.status, a.workspace_id,
              a.avatar_url, a.is_active, a.is_super_admin,
              a.is_platform_owner, a.platform_staff_role,
              a.max_open_tickets, a.created_at, a.last_seen_at
       FROM public.agents a
       WHERE a.id = $1
       LIMIT 1`,
      [user.id],
    ).catch(() => []);

    const agentRow = agentRows[0] ?? null;
    let emailVerified = true;
    let totpEnabled = false;
    try {
      const secRows = await queryRows<{
        email_verified: boolean | null;
        email_confirmed_at: string | null;
        totp_enabled: boolean | null;
      }>(
        `SELECT COALESCE(email_verified, true) AS email_verified,
                email_confirmed_at,
                COALESCE(totp_enabled, false) AS totp_enabled
         FROM public.agents WHERE id = $1 LIMIT 1`,
        [user.id],
      );
      if (secRows.length > 0) {
        emailVerified = secRows[0].email_verified !== false;
        totpEnabled = Boolean(secRows[0].totp_enabled);
      } else {
        const accts = await queryRows<{ email_confirmed_at: string | null }>(
          'SELECT email_confirmed_at FROM public.auth_accounts WHERE id = $1 LIMIT 1',
          [user.id],
        ).catch(() => []);
        if (accts.length > 0) {
          emailVerified = Boolean(accts[0].email_confirmed_at);
        }
      }
    } catch {
      // Security columns optional before migration
    }

    let workspace: Record<string, any> | null = null;
    if (agentRow?.workspace_id) {
      const wsRows = await queryRows<Record<string, any>>(
        'SELECT * FROM public.workspaces WHERE id = $1 LIMIT 1',
        [agentRow.workspace_id],
      ).catch(() => []);
      workspace = wsRows[0] ?? null;
    }

    const safeAgent = agentRow
      ? {
          ...agentRow,
          email_verified: emailVerified,
          totp_enabled: totpEnabled,
          workspace,
        }
      : null;

    return NextResponse.json({
      authenticated: true,
      user: {
        ...user,
        email: agentRow?.email || user.email,
        name: agentRow?.name || user.name,
        workspaceId: agentRow?.workspace_id ?? user.workspaceId ?? null,
        isSuperAdmin: Boolean(agentRow?.is_super_admin ?? user.isSuperAdmin),
      },
      emailConfirmed: emailVerified,
      agent: safeAgent,
      workspace,
    });
  } catch (err: any) {
    console.error('[GET /api/auth/session] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to inspect session.' },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const user = await sessionUser();
    if (!user?.email) {
      return NextResponse.json(
        { error: 'Please sign in before requesting a verification code.' },
        { status: 401 },
      );
    }

    const res = await resendSignupVerificationCodeAction({
      email: user.email,
      name: user.name || 'Business Owner',
    });

    if (!res.success) {
      return NextResponse.json(
        { error: res.error || 'Could not resend verification email.' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      email: res.email || user.email,
      warning: res.warning,
    });
  } catch (err: any) {
    console.error('[POST /api/auth/session] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Could not resend verification email.' },
      { status: 500 },
    );
  }
}

