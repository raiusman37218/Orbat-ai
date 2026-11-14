import { redirect } from 'next/navigation';

export default function LegacyJourneysRedirectPage() {
  redirect('/app/automation/journeys');
}
