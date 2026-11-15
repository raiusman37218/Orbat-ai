import { LandingPage } from '@/components/orbat/landing/LandingPage';
import { sessionUser } from '@/lib/auth/session-user';
import { createClient } from '@/lib/pg/server';

export default async function HomePage() {
  let isSignedIn = false;
  let isSuperAdmin = false;

  try {
    const user = await sessionUser().catch(() => null);
    if (user?.id) {
      isSignedIn = true;
      const db = await createClient();
      const [agentRes, accessRes] = await Promise.all([
        db.from('agents').select('is_super_admin').eq('id', user.id).maybeSingle(),
        db.from('platform_access').select('role').eq('user_id', user.id).maybeSingle(),
      ]);
      isSuperAdmin =
        Boolean(agentRes.data?.is_super_admin) ||
        accessRes.data?.role === 'owner' ||
        accessRes.data?.role === 'admin';
    }
  } catch {
    // Render public landing state if session lookup fails
  }

  return <LandingPage isSignedIn={isSignedIn} isSuperAdmin={isSuperAdmin} />;
}
