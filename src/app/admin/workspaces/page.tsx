import { redirect } from 'next/navigation';

export default function AdminWorkspacesRedirectPage() {
  redirect('/admin?tab=workspaces');
}
