import { Globe, ReceiptText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { OrbatMark } from '@/components/orbat/shell/Sidebar';

/* docs/design/design/Auth.dc.html: form column on the left, product story on
   the right (hidden below 1024px so phones get just the form). */

const VALUES = [
  { icon: Globe, title: 'Answers in any language and script', body: 'Native, romanized and mixed: text and voice notes.' },
  { icon: ShieldCheck, title: 'Compliance built in', body: 'Every AI and human reply is checked against your rules.' },
  { icon: ReceiptText, title: 'No per-seat pricing', body: 'Fixed plan or pay as you go. Grow your team freely.' },
];

const LANGS = ['English', 'اردو', 'Roman Urdu', 'Hinglish', 'العربية', 'Arabizi', 'हिन्दी', 'Taglish', 'Español'];

export function AuthLayout({
  topText,
  topLink,
  children,
}: {
  topText: string;
  topLink: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-o-bg">
      <section className="flex min-w-0 flex-1 flex-col px-5 py-6 sm:px-12 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 text-o-text no-underline">
            <OrbatMark size={30} />
            <span className="font-o-display text-[17px] font-black tracking-[-0.01em]">ORBAT</span>
          </Link>
          <span className="text-[14px] text-o-text-2">
            {topText}{' '}
            <Link href={topLink.href} className="font-semibold text-o-accent-text hover:underline">
              {topLink.label}
            </Link>
          </span>
        </div>

        <main id="main" className="flex flex-1 items-center justify-center py-10 sm:py-12">
          <div className="o-auth-fade flex w-full max-w-[400px] flex-col gap-6">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center gap-4 text-[13px] text-o-text-3">
          <Link href="/privacy" className="text-o-text-3 hover:text-o-text">
            Privacy
          </Link>
          <Link href="/terms" className="text-o-text-3 hover:text-o-text">
            Terms
          </Link>
        </footer>
      </section>

      <aside
        aria-label="About ORBAT"
        className="hidden min-w-0 flex-1 items-center justify-center border-l border-o-border bg-o-surface-2 px-12 py-14 lg:flex"
      >
        <div className="flex w-full max-w-[460px] flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 className="text-[30px] font-extrabold leading-[1.2] tracking-[-0.025em] text-o-text">
              Customer support that speaks your customer’s language, and follows your rules.
            </h2>
            <p className="text-[15.5px] text-o-text-2">AI agents and your team in one inbox, for any industry.</p>
          </div>
          <ul className="flex flex-col gap-[18px]">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span
                  className="grid h-9 w-9 flex-none place-items-center rounded-[12px] border border-o-border bg-o-surface text-o-accent-text"
                  aria-hidden="true"
                >
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <div>
                  <div className="text-[15px] font-semibold text-o-text">{title}</div>
                  <div className="text-[14px] text-o-text-2">{body}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 rounded-[24px] border border-o-border bg-o-surface px-[18px] py-4">
            <div className="o-cap">Understands every way customers write</div>
            <div className="flex flex-wrap gap-1.5">
              {LANGS.map((l) => (
                <span key={l} dir="auto" className="rounded-full bg-o-surface-2 px-2.5 py-1 text-[13px] text-o-text">
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function AuthHeading({ title, body }: { title: ReactNode; body?: ReactNode }) {
  return (
    <div>
      <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-o-text">{title}</h1>
      {body ? <p className="mt-1.5 text-[15px] text-o-text-2">{body}</p> : null}
    </div>
  );
}

export function OrDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-[13px] text-o-text-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-o-border" aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
      <span className="h-px flex-1 bg-o-border" aria-hidden="true" />
    </div>
  );
}
