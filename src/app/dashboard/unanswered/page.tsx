import { redirect } from 'next/navigation';

export default function LegacyUnansweredRedirectPage() {
  redirect('/app/ai-quality');
}
