import type { Metadata } from 'next';
import { InboxScreen } from '@/components/orbat/inbox/InboxScreen';

export const metadata: Metadata = {
  title: 'Inbox · ORBAT AI',
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[]; conv?: string | string[]; conversation?: string | string[] }>;
}) {
  const params = await searchParams;
  const pick = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  const initialConversationId = (pick(params.c) ?? pick(params.conv) ?? pick(params.conversation))?.trim() || null;

  return <InboxScreen initialConversationId={initialConversationId} />;
}
