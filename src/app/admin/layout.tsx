import React from 'react';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { sessionUser } from '@/lib/supabase/session-user';
import { queryRows } from '@/lib/db';
import { Agent } from '@/types/database';
import { SuperAdminShell } from '@/components/admin/SuperAdminShell';
import { ToastProvider } from '@/components/ui/Toast';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const currentPath = headerList.get('x-next-pathname') || '';
  if (currentPath === '/admin/invite' || currentPath.startsWith('/admin/invite/')) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  const supabase = await createClient();
  const user = await sessionUser(supabase);

  if (!user) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-canvas text-ink p-6">
        <div className="max-w-md w-full p-8 rounded-2xl border border-danger/30 bg-surface text-center space-y-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-danger/10 text-danger flex items-center justify-center mx-auto text-xl font-bold">
            403
          </div>
          <h1 className="text-xl font-bold text-ink tracking-tight">403 - Forbidden</h1>
          <p className="text-sm text-ink-3">
            Authentication required. Platform super administrator privileges are required to access this system.
          </p>
          <a
            href="/login?redirect=/admin"
            className="inline-block px-4 py-2 rounded-xl bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Sign in to Orbat AI
          </a>
        </div>
      </div>
    );
  }

  // Server-side database verification of platform super admin privilege from platform_access table
  let access: { role?: string } | null = null;
  let agent: Agent | null = null;
  try {
    const [accessRows, agentRows] = await Promise.all([
      queryRows<{ role: string }>('SELECT role FROM public.platform_access WHERE user_id = $1 LIMIT 1', [user.id]),
      queryRows<Agent>('SELECT * FROM public.agents WHERE id = $1 LIMIT 1', [user.id]),
    ]);
    access = accessRows[0] || null;
    agent = agentRows[0] || null;
  } catch {
    access = null;
    agent = null;
  }

  if (!access || !agent) {
    const [{ data: sbAccess }, { data: sbAgent }] = await Promise.all([
      access ? Promise.resolve({ data: access }) : supabase.from('platform_access').select('role').eq('user_id', user.id).maybeSingle(),
      agent ? Promise.resolve({ data: agent }) : supabase.from('agents').select('*').eq('id', user.id).maybeSingle(),
    ]);
    if (!access) access = sbAccess || null;
    if (!agent) agent = (sbAgent as Agent) || null;
  }

  if (!access || !access.role || !['owner', 'admin'].includes(access.role)) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-canvas text-ink p-6">
        <div className="max-w-md w-full p-8 rounded-2xl border border-danger/30 bg-surface text-center space-y-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-danger/10 text-danger flex items-center justify-center mx-auto text-xl font-bold">
            403
          </div>
          <h1 className="text-xl font-bold text-ink tracking-tight">403 - Forbidden</h1>
          <p className="text-sm text-ink-3">
            Access denied. Platform super administrator privileges are required to access this system.
          </p>
          <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle text-xs text-ink-3 space-y-1">
            <p>Signed in as: <strong className="text-ink">{user.email}</strong></p>
            <p className="text-ink-4">Platform owner access is assigned to designated Orbat AI platform administrators.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <a
              href="/dashboard"
              className="inline-block px-4 py-2 rounded-xl bg-surface-2 border border-border text-ink text-xs font-semibold hover:bg-surface-3 transition-colors"
            >
              Return to Workspace
            </a>
            <a
              href="/login?redirect=/admin"
              className="inline-block px-4 py-2 rounded-xl bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Sign in with Owner Account
            </a>
          </div>
        </div>
      </div>
    );
  }

  const currentAgent: Agent = agent || ({
    id: user.id,
    name: (user as { user_metadata?: { name?: string } }).user_metadata?.name || user.email?.split('@')[0] || 'Admin',
    email: user.email || '',
    role: 'owner',
    status: 'online',
    is_active: true,
  } as Agent);

  currentAgent.is_super_admin = true;
  currentAgent.is_platform_owner = access.role === 'owner';

  return (
    <ToastProvider>
      <SuperAdminShell currentAgent={currentAgent}>
        {children}
      </SuperAdminShell>
    </ToastProvider>
  );
}
