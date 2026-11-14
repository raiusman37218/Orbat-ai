import { redirect } from 'next/navigation';

export default function EmailsRedirectPage() {
  redirect('/app/settings/emails');
}
