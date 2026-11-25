import type { Metadata } from 'next';
import { AuthLayout } from '@/components/orbat/auth/AuthLayout';
import { ForgotPasswordForm } from '@/components/orbat/auth/HelpForms';

export const metadata: Metadata = { title: 'Reset your password · ORBAT AI' };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const initialToken = typeof params?.token === 'string' && params.token.trim() ? params.token.trim() : null;

  return (
    <AuthLayout topText="Remembered it?" topLink={{ href: '/login', label: 'Sign in' }}>
      <ForgotPasswordForm initialToken={initialToken} />
    </AuthLayout>
  );
}
