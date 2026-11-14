import { redirect } from 'next/navigation';

export default function V2SsoRedirect() {
  redirect('/sso');
}
