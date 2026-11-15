import { redirect } from 'next/navigation';
import { createClient } from '@/lib/pg/server';
import { sessionUser } from '@/lib/auth/session-user';
import { assertSuperAdmin } from '@/app/actions/platform';
import { WorkspaceDetailView } from '@/components/admin/WorkspaceDetailView';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await sessionUser(supabase);

  if (!user) {
    redirect('/login');
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('id, is_super_admin')
    .eq('id', user.id)
    .maybeSingle();

  let isAuthorized = Boolean(agent?.is_super_admin);
  if (!isAuthorized) {
    try {
      await assertSuperAdmin();
      isAuthorized = true;
    } catch {
      isAuthorized = false;
    }
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-line rounded-xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-semibold text-ink mb-2">403 - Forbidden</h1>
          <p className="text-xs text-ink-2 mb-6">
            Platform super administrator privileges are required to view workspace details.
          </p>
          <a
            href="/app"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Workspace
          </a>
        </div>
      </div>
    );
  }

  return <WorkspaceDetailView workspaceId={id} />;
}
