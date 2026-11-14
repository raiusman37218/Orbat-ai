import type { Metadata } from 'next';
import { AuthLayout } from '@/components/orbat/auth/AuthLayout';
import { ForgotPasswordForm } from '@/components/orbat/auth/HelpForms';

export const metadata: Metadata = { title: 'Reset your password · ORBAT AI' };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout topText="Remembered it?" topLink={{ href: '/login', label: 'Sign in' }}>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
