import { redirect } from 'next/navigation';

export default async function V2LoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.redirect) query.set('redirect', params.redirect);
  if (params.error) query.set('error', params.error);
  const qs = query.toString();
  redirect(qs ? `/login?${qs}` : '/login');
}
