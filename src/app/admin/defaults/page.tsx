import { redirect } from 'next/navigation';

export default function AdminDefaultsRedirectPage() {
  redirect('/admin?tab=settings');
}
