import { redirect } from 'next/navigation';

export default async function V2SignupRedirect({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.error) query.set('error', params.error);
  const qs = query.toString();
  redirect(qs ? `/signup?${qs}` : '/signup');
}
