import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/orbat/auth/AuthLayout';
import { SignInForm } from '@/components/orbat/auth/SignInForm';
import { sessionUser } from '@/lib/auth/session-user';
import { safeRedirect } from '@/lib/data/auth-rules';

export const metadata: Metadata = { title: 'Sign in · ORBAT AI' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = safeRedirect(params.redirect);
  if (await sessionUser().catch(() => null)) redirect(redirectTo);

  return (
    <AuthLayout topText="New to ORBAT?" topLink={{ href: '/signup', label: 'Create a workspace' }}>
      <SignInForm redirectTo={redirectTo} initialError={params.error ?? null} />
    </AuthLayout>
  );
}
