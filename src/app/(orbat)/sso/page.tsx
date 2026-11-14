import type { Metadata } from 'next';
import { AuthLayout } from '@/components/orbat/auth/AuthLayout';
import { SsoForm } from '@/components/orbat/auth/HelpForms';

export const metadata: Metadata = { title: 'Single sign-on · ORBAT AI' };

export default function SsoPage() {
  return (
    <AuthLayout topText="New to ORBAT?" topLink={{ href: '/signup', label: 'Create a workspace' }}>
      <SsoForm />
    </AuthLayout>
  );
}
