'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Shield, Sparkles, Star } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Logo } from '@/components/ui/Logo';

/**
 * Split-screen frame shared by sign-in and sign-up: the form on the left,
 * an editorial preview showcase on the right that disappears below `lg`.
 */
export function AuthShell({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] bg-canvas">
      {/* Form column */}
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-14 xl:px-16 min-h-screen">
        {/* Top bar with Logo & Theme Toggle */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center min-h-11 group transition-transform hover:scale-[1.02]"
            aria-label="Orbat AI home"
          >
            <Logo size={34} />
          </Link>
          <ThemeToggle />
        </div>

        {/* Center Auth Form */}
        <div className="flex items-center justify-center py-10 sm:py-12 my-auto">
          <div className="w-full max-w-[420px] animate-rise">{children}</div>
        </div>

        {/* Bottom Navigation & Trust Footprint */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-line text-2xs text-ink-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to home</span>
          </Link>

          <div className="inline-flex items-center gap-2 text-ink-3">
            <Shield className="w-3.5 h-3.5 text-accent shrink-0" />
            <span>256-bit SSL • SOC-2 Type II Certified</span>
          </div>
        </div>
      </div>

      {/* Editorial column on desktop */}
      <div className="hidden lg:flex relative overflow-hidden bg-[#060c1c] text-white">
        {/* Background Gradient & Mesh Glow */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #4f46e5 0%, transparent 50%), radial-gradient(circle at 80% 80%, #7c3aed 0%, transparent 50%)',
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="relative flex flex-col justify-between p-12 xl:p-16 w-full z-10">
          {aside || <DefaultAuthAside />}

          {/* Social Proof Footer in Editorial Panel */}
          <div className="pt-8 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1 text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current" />
              ))}
              <span className="ml-1.5 text-white font-semibold">4.9 / 5</span>
              <span className="text-slate-400 font-normal">(1,200+ reviews)</span>
            </div>
            <span>Used by 10,000+ businesses</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Default Showcase panel used when custom aside is omitted */
export function DefaultAuthAside() {
  return (
    <AuthAside
      eyebrow="Autonomous Customer Intelligence"
      headline={
        <>
          Turn website visitors into
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#818cf8] via-[#a5b4fc] to-white">
            lifelong customers 24/7.
          </span>
        </>
      }
      points={[
        {
          title: 'Instant AI Website Training',
          body: 'Connect your URL, docs, or PDFs. Orbat AI learns your product catalog in minutes with zero coding.',
        },
        {
          title: 'Sub-second WebSocket Live Chat',
          body: 'Live typing indicators, visitor radar, read receipts, and seamless human agent handover.',
        },
        {
          title: 'Omnichannel Support Inbox',
          body: 'Manage website chats, WhatsApp, email, and social messages in a unified collaborative inbox.',
        },
      ]}
    />
  );
}

/** Rich editorial showcase panel with simulated live chat preview */
export function AuthAside({
  eyebrow,
  headline,
  points,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  points: { title: string; body: string }[];
}) {
  return (
    <div className="max-w-lg space-y-8 my-auto">
      {/* Pill Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-[#a5b4fc] text-xs font-semibold tracking-wide border border-white/15 backdrop-blur-md">
        <Sparkles className="w-3.5 h-3.5 text-[#818cf8]" />
        <span>{eyebrow}</span>
      </div>

      {/* Main Headline */}
      <h2 className="text-3xl xl:text-4xl leading-[1.15] font-extrabold tracking-tight text-white">
        {headline}
      </h2>

      {/* Simulated Live Support AI Preview Card */}
      <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-5 shadow-2xl space-y-3.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-[#4f46e5] to-[#818cf8] flex items-center justify-center text-xs font-bold text-white shadow-xs">
              AI
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#060c1c]" />
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-tight">Orbat AI Copilot</div>
              <div className="text-2xs text-slate-400">Autonomous Support Agent</div>
            </div>
          </div>
          <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Resolved in 1.2s
          </span>
        </div>

        {/* User Question */}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-[#4f46e5] px-3.5 py-2 text-xs text-white leading-relaxed">
            Can Orbat AI auto-answer questions from our help center and Shopify products?
          </div>
        </div>

        {/* AI Answer */}
        <div className="flex justify-start">
          <div className="max-w-[90%] rounded-2xl rounded-tl-xs bg-white/10 border border-white/10 px-3.5 py-2 text-xs text-slate-200 leading-relaxed space-y-1.5">
            <p>
              Yes! Orbat AI synchronizes your help center, PDFs, and Shopify catalog in real-time to answer pre-sales and support inquiries with 99.4% accuracy.
            </p>
            <div className="flex items-center gap-2 pt-1 text-2xs text-slate-400 border-t border-white/10 font-mono">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Cited 2 articles from Knowledge Base</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Points */}
      <ul className="space-y-4 pt-2">
        {points.map((p, idx) => (
          <li key={p.title} className="flex items-start gap-3.5">
            <div className="w-6 h-6 rounded-lg bg-[#4f46e5]/30 border border-[#4f46e5]/50 text-[#a5b4fc] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono">
              0{idx + 1}
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">{p.title}</div>
              <p className="mt-0.5 text-xs text-slate-300 leading-relaxed">{p.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
