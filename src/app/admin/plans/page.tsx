import { redirect } from 'next/navigation';

export default function AdminPlansRedirectPage() {
  redirect('/admin?tab=plans');
}
