import type { Metadata } from 'next';
import { LandingPage } from '@/components/orbat/landing/LandingPage';

export const metadata: Metadata = {
  title: 'ORBAT AI — Instant answers. Real people when it matters.',
};

export default function OrbatLandingAliasRoute() {
  return <LandingPage />;
}
