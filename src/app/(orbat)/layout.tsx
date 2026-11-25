import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { OrbToastProvider } from '@/components/orbat/primitives/Toast';

/* Every page of the new UI renders inside `.orb`, which is where the ORBAT
   tokens live (src/components/orbat/orbat.css). Old pages never get the class,
   so both designs can run side by side until the cut-over. */

const inter = localFont({
  src: '../../../public/fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-inter',
  display: 'swap',
});

const interTight = localFont({
  src: '../../../public/fonts/inter-tight-latin-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
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
