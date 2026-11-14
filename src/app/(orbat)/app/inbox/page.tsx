import type { Metadata } from 'next';
import { InboxScreen } from '@/components/orbat/inbox/InboxScreen';

export const metadata: Metadata = {
  title: 'Inbox · ORBAT AI',
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.c) ? params.c[0] : params.c;
  const initialConversationId = raw?.trim() || null;

  return <InboxScreen initialConversationId={initialConversationId} />;
}
