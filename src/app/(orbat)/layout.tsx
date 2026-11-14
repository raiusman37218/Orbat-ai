import { Inter, Inter_Tight } from 'next/font/google';
import type { ReactNode } from 'react';
import { OrbToastProvider } from '@/components/orbat/primitives/Toast';

/* Every page of the new UI renders inside `.orb`, which is where the ORBAT
   tokens live (src/components/orbat/orbat.css). Old pages never get the class,
   so both designs can run side by side until the cut-over. */

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-inter-tight',
  display: 'swap',
});

export default function OrbatLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`orb ${inter.variable} ${interTight.variable} min-h-dvh`}>
      <OrbToastProvider>{children}</OrbToastProvider>
    </div>
  );
}
