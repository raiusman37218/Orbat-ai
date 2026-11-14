import type { Metadata } from 'next';
import { TicketsScreen } from '@/components/orbat/tickets/TicketsScreen';

export const metadata: Metadata = {
  title: 'Tickets · ORBAT AI',
};

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const initialTicketId = raw?.trim() || null;

  return (
    <TicketsScreen key={initialTicketId ?? 'tickets-all'} initialTicketId={initialTicketId} />
  );
}
