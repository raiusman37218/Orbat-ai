import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/orbat/auth/AuthLayout';
import { SignInForm } from '@/components/orbat/auth/SignInForm';
import { sessionUser } from '@/lib/auth/session-user';
import { safeRedirect } from '@/lib/data/auth-rules';

export const metadata: Metadata = { title: 'Sign in · ORBAT AI' };

/* TEMPORARY /v2 prefix: the old /login keeps working until the cut-over. */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = safeRedirect(params.redirect);
  // Already signed in: skip the form, like the old /login does in proxy.ts.
  if (await sessionUser().catch(() => null)) redirect(redirectTo);

  return (
    <AuthLayout topText="New to ORBAT?" topLink={{ href: '/v2/signup', label: 'Create a workspace' }}>
      <SignInForm redirectTo={redirectTo} initialError={params.error ?? null} />
    </AuthLayout>
  );
}
