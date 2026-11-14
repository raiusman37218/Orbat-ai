import { redirect } from 'next/navigation';

export default function LegacyCheckoutRedirect() {
  redirect('/checkout');
}
