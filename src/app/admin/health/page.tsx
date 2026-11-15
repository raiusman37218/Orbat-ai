import { redirect } from 'next/navigation';

export default function AdminHealthRedirectPage() {
  redirect('/admin?tab=overview');
}
