import type { Metadata } from 'next';
import { LanguagesScreen } from '@/components/orbat/languages/LanguagesScreen';

export const metadata: Metadata = {
  title: 'Languages · ORBAT AI',
};

export default function LanguagesPage() {
  return <LanguagesScreen />;
}
