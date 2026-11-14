import type { Metadata } from 'next';
import { CustomersScreen } from '@/components/orbat/customers/CustomersScreen';

export const metadata: Metadata = {
  title: 'Customers · ORBAT AI',
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const initialCustomerId = raw?.trim() || null;

  return (
    <CustomersScreen
      key={initialCustomerId ?? 'customers-dir'}
      initialCustomerId={initialCustomerId}
    />
  );
}
