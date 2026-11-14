import type { Metadata } from 'next';
import { CallsScreen } from '@/components/orbat/calls/CallsScreen';

export const metadata: Metadata = {
  title: 'Calls · ORBAT AI',
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const initialCallId = raw?.trim() || null;

  return <CallsScreen key={initialCallId ?? 'calls-root'} initialCallId={initialCallId} />;
}
