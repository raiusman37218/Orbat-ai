import { redirect } from 'next/navigation';

export default function AdminAccessRedirectPage() {
  redirect('/admin?tab=staff');
}
