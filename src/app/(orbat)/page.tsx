import type { Metadata } from 'next';
import { LandingPage } from '@/components/orbat/landing/LandingPage';

export const metadata: Metadata = {
  title: 'ORBAT AI — Instant answers. Real people when it matters.',
  description:
    'ORBAT’s AI agent resolves most conversations across chat, WhatsApp, email and calls, then hands the rest to your team with the full story.',
};

export default function HomePage() {
  return <LandingPage />;
}
