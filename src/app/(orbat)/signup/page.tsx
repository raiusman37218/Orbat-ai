import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/orbat/auth/AuthLayout';
import { SignUpForm } from '@/components/orbat/auth/SignUpForm';
import { sessionUser } from '@/lib/auth/session-user';

export const metadata: Metadata = { title: 'Create your workspace · ORBAT AI' };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await sessionUser().catch(() => null)) redirect('/app');
  const params = await searchParams;

  return (
    <AuthLayout topText="Already have an account?" topLink={{ href: '/login', label: 'Sign in' }}>
      <SignUpForm initialError={params.error ?? null} />
    </AuthLayout>
  );
}
