import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Compass, HelpCircle, Home, LogIn } from 'lucide-react';

export const metadata: Metadata = {
  title: '404 · Page Not Found · ORBAT AI',
  description: 'The requested page could not be found.',
};

export default function NotFound() {
  return (
    <div className="orb min-h-screen bg-o-bg text-o-text flex flex-col justify-between">
      <header className="sticky top-0 z-40 border-b border-o-border bg-o-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-o-text no-underline">
            <span className="grid size-8 place-items-center rounded-[10px] bg-o-forest text-[15px] font-bold text-o-lime">
              O
            </span>
            <span className="text-[16px] font-semibold tracking-tight">ORBAT</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="rounded-full px-3.5 py-1.5 text-[14px] font-medium text-o-text-2 no-underline hover:text-o-text"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-full border border-o-border-strong bg-o-surface px-4 text-[13.5px] font-medium text-o-text no-underline hover:bg-o-surface-2"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-o-border-strong bg-o-surface-2 px-3.5 py-1 text-[12px] font-semibold uppercase tracking-wider text-o-forest">
          <Compass size={14} aria-hidden="true" />
          Error 404
        </span>

        <h1 className="mt-5 text-[34px] font-semibold tracking-tight text-o-text sm:text-[44px]">
          Page not found
        </h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-o-text-2">
          The page you are looking for doesn&apos;t exist, has moved during the ORBAT cut-over, or is temporarily unavailable.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-o-forest px-6 text-[14.5px] font-semibold text-o-on-forest no-underline hover:opacity-95"
          >
            <Home size={16} aria-hidden="true" />
            <span>Back to Home</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>

          <Link
            href="/app"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-o-border-strong bg-o-surface px-5 text-[14.5px] font-medium text-o-text no-underline hover:bg-o-surface-2"
          >
            <LogIn size={16} aria-hidden="true" />
            <span>Open Workspace</span>
          </Link>

          <Link
            href="/help"
            className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14.5px] font-medium text-o-text-2 no-underline hover:bg-o-surface-2 hover:text-o-text"
          >
            <HelpCircle size={16} aria-hidden="true" />
            <span>Help Center</span>
          </Link>
        </div>

        <div className="mt-10 w-full rounded-[20px] border border-o-border bg-o-surface p-5 text-left">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-o-text-3">
            Popular destinations
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 text-[14px]">
            <Link href="/app/inbox" className="text-o-text-2 no-underline hover:text-o-forest">
              • Inbox &amp; Live Chat
            </Link>
            <Link href="/pricing" className="text-o-text-2 no-underline hover:text-o-forest">
              • Plans &amp; Pricing
            </Link>
            <Link href="/onboarding" className="text-o-text-2 no-underline hover:text-o-forest">
              • Setup Wizard
            </Link>
            <Link href="/portal" className="text-o-text-2 no-underline hover:text-o-forest">
              • Customer Portal
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-o-border py-5 text-center text-[12.5px] text-o-text-3">
        ORBAT AI · Autonomous Customer Support
      </footer>
    </div>
  );
}
