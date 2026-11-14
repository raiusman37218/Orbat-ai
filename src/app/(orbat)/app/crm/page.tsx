import { redirect } from 'next/navigation';

export default function CrmRedirectPage() {
  redirect('/app/channels/connect');
}
