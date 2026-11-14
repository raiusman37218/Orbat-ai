import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/orbat/auth/AuthLayout';
import { SignUpForm } from '@/components/orbat/auth/SignUpForm';
import { sessionUser } from '@/lib/auth/session-user';

export const metadata: Metadata = { title: 'Create your workspace · ORBAT AI' };

/* TEMPORARY /v2 prefix: the old /signup keeps working until the cut-over. */
export default async function SignUpPage() {
  if (await sessionUser().catch(() => null)) redirect('/app');
  return (
    <AuthLayout topText="Already have an account?" topLink={{ href: '/v2/login', label: 'Sign in' }}>
      <SignUpForm />
    </AuthLayout>
  );
}
