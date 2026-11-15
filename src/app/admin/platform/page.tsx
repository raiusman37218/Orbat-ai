import { redirect } from 'next/navigation';

export default function AdminPlatformRedirectPage() {
  redirect('/admin?tab=settings');
}
