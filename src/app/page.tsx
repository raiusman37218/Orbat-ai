import type { ComponentType } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Instrument_Serif } from 'next/font/google';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  BrainCircuit,
  Check,
  Code2,
  Globe2,
  Headphones,
  Inbox,
  Languages,
  LineChart,
  MessageSquareText,
  Palette,
  Quote,
  Radio,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import { ProductShowcase } from '@/components/marketing/ProductShowcase';
import { LandingNav } from '@/components/marketing/LandingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { FaqSection } from '@/components/marketing/FaqSection';
import { Reveal } from '@/components/marketing/Reveal';
import { PRODUCTION_APP_ORIGIN } from '@/lib/domain';

/** Display serif for the italic accent words in headlines. */
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-lx-serif',
});

const PLATFORMS = ['WordPress', 'Shopify', 'Webflow', 'Next.js', 'Framer', 'Squarespace', 'Laravel', 'Wix', 'WooCommerce', 'React'];

const STATS = [
  { value: '<1s', label: 'Realtime message delivery' },
  { value: '24/7', label: 'AI answers from your help center' },
  { value: '1 line', label: 'Of code to go live anywhere' },
  { value: '100%', label: 'CSS-isolated via Shadow DOM' },
];

const STEPS = [
  {
    n: '01',
    title: 'Create your workspace',
    body: 'Name your business, add your site and pick a brand colour. Your agent profile is provisioned automatically.',
    Icon: Users,
  },
  {
    n: '02',
    title: 'Teach it your business',
    body: 'Publish help-center articles once. The AI agent reads every one and answers with citations — in your tone.',
    Icon: BrainCircuit,
  },
  {
    n: '03',
    title: 'Paste one line, go live',
    body: 'Drop the script tag anywhere on your site. The messenger appears for every visitor, instantly.',
    Icon: Code2,
  },
];

/*
 * Sample testimonials for layout. Replace with real customer quotes (and
 * their permission) before promoting the page.
 */
const TESTIMONIALS = [
  {
    quote:
      'The AI agent resolves most of our routine questions before a human ever sees them — and when it hands over, the summary is already waiting for us.',
    name: 'Daniel Brooks',
    role: 'Co-founder, Northwind Studio',
    avatar: '/landing/avatar-1.jpg',
  },
  {
    quote:
      'It feels like a luxury product. Our customers comment on how fast and personal the chat feels, and our team finally works from one calm inbox.',
    name: 'Helena Marsh',
    role: 'Head of Customer Experience, Aurelia',
    avatar: '/landing/avatar-2.jpg',
  },
  {
    quote:
      'We pasted one line on our Shopify store and were live in minutes. Seeing visitors in realtime changed how we sell.',
    name: 'Omar Siddiqui',
    role: 'Owner, Crafted Goods Co.',
    avatar: '/landing/avatar-3.jpg',
  },
];

export default function HomePage() {
  return (
    <div className={`${serif.variable} min-h-screen flex flex-col bg-canvas`}>
      <LandingNav />

      <main className="flex-1">
        {/* ═════════════════════════ HERO (cinematic stage) ═════════════════════════ */}
        <section className="lx-stage lx-grain overflow-hidden">
          <Image
            src="/landing/hero-bg.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center -z-20 opacity-90"
          />
          {/* Readability veil: darker at the top behind the copy, fading into the showcase. */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_50%_20%,rgba(5,6,13,0.55),rgba(5,6,13,0.15)_70%),linear-gradient(180deg,rgba(5,6,13,0.35)_0%,rgba(5,6,13,0.1)_45%,#05060d_100%)]" />

          <div className="u-container relative pt-20 pb-24 sm:pt-28 sm:pb-32">
            <div className="max-w-4xl mx-auto text-center sm:px-14 lg:px-0">
              <a
                href="#ai"
                className="animate-rise lx-glass inline-flex items-center gap-2.5 h-9 pl-1.5 pr-4 rounded-full text-xs font-medium text-white/85 hover:text-white transition-colors"
              >
                <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-gradient-to-r from-[#e2c07a] to-[#c9994a] text-[#1a1206] text-2xs font-bold tracking-wide">
                  <Sparkles className="w-3 h-3" />
                  NEW
                </span>
                Fact-checked AI Agent &amp; live visitor radar
                <ArrowRight className="w-3.5 h-3.5" />
              </a>

              <h1 className="animate-rise delay-1 mt-8 text-[clamp(2.4rem,9vw,3.2rem)] sm:text-7xl lg:text-[5.4rem] leading-[1.02] font-semibold tracking-[-0.035em] text-white text-balance">
                Customer service,
                <br />
                <span className="lx-serif lx-aurora-text pr-2">beautifully</span>{' '}
                <span className="lx-serif lx-gold-text">elevated.</span>
              </h1>

              <p className="animate-rise delay-2 mt-7 mx-auto max-w-2xl text-base sm:text-lg leading-relaxed text-white/70">
                An AI agent that answers from your own knowledge, a realtime inbox your team loves,
                and a messenger that feels like your brand — installed on any website with a single line of code.
              </p>

              <div className="animate-rise delay-3 mt-10 mx-auto max-w-lg">
                <form
                  action="/signup"
                  method="GET"
                  className="lx-glass flex items-center gap-1.5 p-1.5 rounded-full focus-within:border-white/30 transition-colors"
                >
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="you@company.com"
                    aria-label="Work email"
                    className="flex-1 min-w-0 h-11 bg-transparent px-4 text-base sm:text-sm text-white placeholder:text-white/45 focus:outline-none"
                  />
                  <button type="submit" className="lx-btn-gold lx-sheen shrink-0 h-11!">
                    Start free
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/60">
                  {['Free trial', 'No credit card', 'Live in 2 minutes'].map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#e2c07a]" />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Product showcase in a gilded glass frame, with floating proof cards */}
            <div className="animate-rise delay-4 relative mt-16 sm:mt-24 max-w-5xl mx-auto">
              <div className="absolute -inset-x-20 -top-16 h-64 lx-glow-blue opacity-70 -z-10" />
              <div className="absolute -right-10 bottom-0 w-72 h-72 lx-glow-gold opacity-60 -z-10" />

              <div className="lx-ring rounded-[1.75rem] p-2 sm:p-3 bg-white/[0.04] shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
                <div className="rounded-[1.25rem] overflow-hidden">
                  <ProductShowcase />
                </div>
              </div>

              <div className="hidden md:flex lx-float lx-glass absolute -left-14 top-24 items-center gap-3 rounded-2xl px-4 py-3 text-left">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6d8bff] to-[#b39dff] flex items-center justify-center">
                  <Bot className="w-4.5 h-4.5 text-white" />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-white">Resolved by AI Agent</span>
                  <span className="block text-2xs text-white/60">Cited “Refund policy” · 4s</span>
                </span>
              </div>

              <div className="hidden md:flex lx-float-slow lx-glass absolute -right-12 top-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-left">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f1d79b] to-[#c9994a] flex items-center justify-center">
                  <Star className="w-4.5 h-4.5 text-[#1a1206]" fill="currentColor" />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-white">CSAT ★★★★★</span>
                  <span className="block text-2xs text-white/60">“Fastest support ever!”</span>
                </span>
              </div>
            </div>
          </div>

          {/* Platform marquee */}
          <div className="relative border-t border-white/10 py-8">
            <p className="text-center lx-eyebrow w-full justify-center text-white/45 mb-6">
              Drops into any stack — no plugin required
            </p>
            <div
              className="relative flex overflow-hidden"
              style={{
                maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
              }}
            >
              <div className="marquee-track flex shrink-0 items-center gap-14 pr-14">
                {[...PLATFORMS, ...PLATFORMS].map((p, i) => (
                  <span key={`${p}-${i}`} className="text-xl font-semibold tracking-tight text-white/35 whitespace-nowrap">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═════════════════════════ STATS ═════════════════════════ */}
        <section className="relative border-b border-line bg-canvas">
          <div className="u-container py-14 sm:py-16 grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80} className="text-center lg:text-left lg:border-l lg:border-line lg:pl-8 first:lg:border-l-0 first:lg:pl-0">
                <div className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-ink">
                  <span className="lx-serif">{s.value}</span>
                </div>
                <div className="mt-2 text-xs sm:text-sm text-ink-3">{s.label}</div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ═════════════════════════ FEATURES (luxury bento) ═════════════════════════ */}
        <section id="product" className="relative overflow-hidden">
          <Image
            src="/landing/dashboard-glow.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover -z-10 opacity-60 dark:opacity-[0.08]"
          />
          <div className="u-container py-24 sm:py-32">
            <Reveal className="max-w-3xl mx-auto text-center">
              <span className="lx-eyebrow text-accent">
                <span className="w-6 h-px bg-current" /> The platform <span className="w-6 h-px bg-current" />
              </span>
              <h2 className="mt-5 text-4xl sm:text-6xl leading-[1.05] font-semibold tracking-[-0.03em] text-ink text-balance">
                Everything your support team needs.{' '}
                <span className="lx-serif text-ink-3">Nothing it doesn&apos;t.</span>
              </h2>
            </Reveal>

            <div className="mt-16 grid grid-cols-1 lg:grid-cols-6 gap-5">
              {/* Live visitors */}
              <Reveal className="lg:col-span-4 lx-card lx-glass-light p-8 flex flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-md">
                    <FeatureIcon Icon={Radio} />
                    <h3 className="mt-5 text-xl font-semibold text-ink">Watch your site breathe</h3>
                    <p className="mt-2 text-ui leading-relaxed text-ink-2">
                      Every visitor, live: the page they&apos;re reading, how long they&apos;ve been there, their
                      device and location. Start the conversation before they bounce.
                    </p>
                  </div>
                  <span className="pill pill-success shrink-0">
                    <span className="live-dot" />
                    Realtime
                  </span>
                </div>
                <div className="mt-7 grid sm:grid-cols-3 gap-3">
                  {[
                    { n: 'Maya C.', url: '/products/summit-30l', t: '4m 12s', c: '#2e5bff' },
                    { n: 'Anonymous', url: '/checkout', t: '47s', c: '#7c5cff' },
                    { n: 'Jonas W.', url: '/pricing', t: '1m 05s', c: '#0f9d76' },
                  ].map((v) => (
                    <div key={v.url} className="rounded-2xl border border-line bg-surface p-3.5 flex items-center gap-3 shadow-xs">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: v.c }}>
                        {v.n.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold truncate text-ink">{v.n}</span>
                          <span className="live-dot" />
                        </div>
                        <div className="text-2xs text-ink-3 truncate font-mono">{v.url}</div>
                      </div>
                      <span className="text-2xs text-ink-3 shrink-0">{v.t}</span>
                    </div>
                  ))}
                </div>
              </Reveal>

              {/* Brand messenger */}
              <Reveal delay={100} className="lg:col-span-2 lx-card lx-glass-light p-8 flex flex-col overflow-hidden">
                <FeatureIcon Icon={Palette} />
                <h3 className="mt-5 text-xl font-semibold text-ink">Yours, not ours</h3>
                <p className="mt-2 text-ui leading-relaxed text-ink-2">
                  Colour, copy, avatar and position — the messenger inherits your brand.
                </p>
                <div className="mt-7 -mb-16 mx-auto w-[240px] rounded-3xl border border-line bg-surface shadow-xl overflow-hidden">
                  <div className="px-5 pt-5 pb-6 bg-gradient-to-br from-[#1b2a6b] via-[#2e5bff] to-[#7c5cff] text-white">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-2xs font-bold mb-3">L</div>
                    <div className="text-md font-semibold">Hi there 👋</div>
                    <div className="text-2xs opacity-80 mt-0.5">How can we help today?</div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="rounded-2xl border border-line bg-surface-2 p-3">
                      <div className="text-xs font-semibold text-ink">Send us a message</div>
                      <div className="text-2xs text-ink-3 mt-0.5">Typically replies in 2m</div>
                    </div>
                    <div className="h-9 rounded-2xl border border-line bg-surface-2 flex items-center px-3 text-2xs text-ink-3">Search for help…</div>
                  </div>
                </div>
              </Reveal>

              {[
                { Icon: Zap, title: 'Sub-second delivery', body: 'Typing indicators, read receipts and messages over WebSockets — instant on every device.' },
                { Icon: ShieldCheck, title: 'Secure by design', body: 'Row-level security scopes every conversation; Shadow DOM keeps your site’s styles untouched.' },
                { Icon: Languages, title: 'Speaks their language', body: 'Visitors write in their own language — agents read it in English, replies go back translated.' },
              ].map(({ Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 90} className="lg:col-span-2 lx-card lx-glass-light p-7">
                  <FeatureIcon Icon={Icon} />
                  <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-ui leading-relaxed text-ink-2">{body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═════════════════════════ AI AGENT (dark stage) ═════════════════════════ */}
        <section id="ai" className="lx-stage lx-grain overflow-hidden">
          <div className="absolute -left-40 top-10 w-[520px] h-[520px] lx-glow-blue opacity-50 -z-10" />
          <div className="absolute right-0 bottom-0 w-[420px] h-[420px] lx-glow-gold opacity-30 -z-10" />

          <div className="u-container py-24 sm:py-32 grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <span className="lx-eyebrow text-[#e2c07a]">
                <Sparkles className="w-3.5 h-3.5" /> AI Agent
              </span>
              <h2 className="mt-5 text-4xl sm:text-6xl leading-[1.04] font-semibold tracking-[-0.03em] text-white text-balance">
                Answers that are <span className="lx-serif lx-gold-text">always true.</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-white/65 max-w-xl">
                Our AI agent reads your entire help center, answers instantly in the customer&apos;s language, and
                checks every reply against your articles before it&apos;s sent. When a person is needed, it hands
                over with a summary — and steps aside.
              </p>

              <ul className="mt-9 space-y-4">
                {[
                  { Icon: BadgeCheck, t: 'Fact-checked replies', d: 'Every figure and claim is verified against your own articles.' },
                  { Icon: BrainCircuit, t: 'Specialist routing', d: 'Pricing, subscriptions, product specs, orders — each question reaches the right expert.' },
                  { Icon: Headphones, t: 'Graceful human handover', d: 'Detects frustration, collects details and alerts your team.' },
                ].map(({ Icon, t, d }) => (
                  <li key={t} className="flex gap-4">
                    <span className="lx-glass w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[#f1d79b]" />
                    </span>
                    <span>
                      <span className="block font-semibold text-white">{t}</span>
                      <span className="block text-sm text-white/55 mt-0.5">{d}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/signup" className="lx-btn-gold">
                  Try the AI agent
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="/demo.html" target="_blank" rel="noreferrer" className="lx-btn-ghost">
                  Watch it live
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
            </Reveal>

            <Reveal delay={150} className="relative">
              <div className="relative aspect-square max-w-[540px] mx-auto">
                <Image
                  src="/landing/ai-orb.jpg"
                  alt="Glowing glass sphere representing the AI agent"
                  fill
                  sizes="(min-width: 1024px) 540px, 90vw"
                  className="object-cover rounded-[2.5rem] opacity-95"
                />
                <div className="absolute inset-0 rounded-[2.5rem] ring-1 ring-white/10 bg-gradient-to-t from-[#05060d]/70 via-transparent to-transparent" />

                {/* Conversation overlay */}
                <div className="absolute left-4 right-4 sm:-left-10 sm:right-auto sm:w-[320px] bottom-6 space-y-3">
                  <div className="lx-glass rounded-2xl rounded-bl-md px-4 py-3 text-sm text-white/90 max-w-[260px]">
                    Can I connect WhatsApp and our custom domain?
                  </div>
                  <div className="lx-glass rounded-2xl rounded-br-md px-4 py-3 text-sm text-white ml-auto sm:ml-10">
                    <div className="flex items-center gap-1.5 text-2xs font-semibold text-[#f1d79b] mb-1">
                      <Bot className="w-3.5 h-3.5" /> AI Agent · verified
                    </div>
                    Yes! WhatsApp Business and custom help center domains are supported with automatic SSL.
                    <div className="mt-2 inline-flex items-center gap-1 text-2xs text-white/55">
                      <MessageSquareText className="w-3 h-3" /> Source: Omnichannel &amp; Domains Guide
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═════════════════════════ HUMAN TOUCH (portrait) ═════════════════════════ */}
        <section className="relative overflow-hidden bg-canvas">
          <div className="u-container py-24 sm:py-32 grid lg:grid-cols-2 gap-16 items-center">
            <Reveal className="relative order-2 lg:order-1">
              <div className="relative max-w-md mx-auto">
                <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-accent/15 via-transparent to-[#e2c07a]/20 blur-2xl" />
                <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden shadow-xl ring-1 ring-line">
                  <Image
                    src="/landing/agent-portrait.jpg"
                    alt="Support specialist wearing a headset, smiling"
                    fill
                    sizes="(min-width: 1024px) 448px, 90vw"
                    className="object-cover"
                  />
                </div>

                <div className="lx-float absolute -right-4 sm:-right-12 top-10 lx-glass-light rounded-2xl p-4 w-60">
                  <div className="flex items-center gap-2 text-2xs font-semibold text-ink-3">
                    <Inbox className="w-3.5 h-3.5 text-accent" /> Shared inbox
                  </div>
                  <div className="mt-2 text-sm font-semibold text-ink">3 conversations assigned</div>
                  <div className="mt-3 flex -space-x-2">
                    {['#2e5bff', '#7c5cff', '#0f9d76', '#d97706'].map((c, i) => (
                      <span key={c} className="w-7 h-7 rounded-full ring-2 ring-surface flex items-center justify-center text-[10px] font-bold text-white" style={{ background: c }}>
                        {'MJAT'[i]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="lx-float-slow absolute -left-4 sm:-left-12 bottom-12 lx-glass-light rounded-2xl p-4 w-56">
                  <div className="flex items-center gap-2 text-2xs font-semibold text-ink-3">
                    <LineChart className="w-3.5 h-3.5 text-success" /> First response
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-ink">
                    <span className="lx-serif">38s</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-accent to-[#7c5cff]" />
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120} className="order-1 lg:order-2">
              <span className="lx-eyebrow text-accent">
                <Headphones className="w-3.5 h-3.5" /> Human when it matters
              </span>
              <h2 className="mt-5 text-4xl sm:text-6xl leading-[1.04] font-semibold tracking-[-0.03em] text-ink text-balance">
                AI speed. <span className="lx-serif">Human warmth.</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-ink-2 max-w-xl">
                Your agents step in with full context — the visitor&apos;s journey, the AI&apos;s summary and their
                account details — so customers never repeat themselves.
              </p>
              <div className="mt-9 grid sm:grid-cols-2 gap-4">
                {[
                  { Icon: Sparkles, t: 'Saved replies', d: 'Behind a / shortcut' },
                  { Icon: MessageSquareText, t: 'Private notes', d: 'The customer never sees them' },
                  { Icon: Users, t: 'Smart assignment', d: 'Round-robin & collision detection' },
                  { Icon: Star, t: 'CSAT ratings', d: 'Collected the moment you resolve' },
                ].map(({ Icon, t, d }) => (
                  <div key={t} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xs">
                    <span className="w-9 h-9 rounded-xl bg-accent-soft border border-accent-line text-accent flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{t}</span>
                      <span className="block text-xs text-ink-3 mt-0.5">{d}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═════════════════════════ TEAM BANNER (full-bleed image) ═════════════════════════ */}
        <section className="lx-stage overflow-hidden">
          <Image
            src="/landing/team-collab.jpg"
            alt="Support team collaborating in a modern office"
            fill
            sizes="100vw"
            className="object-cover -z-20"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#05060d] via-[#05060d]/80 to-[#05060d]/20" />
          <div className="u-container py-28 sm:py-36">
            <Reveal className="max-w-xl">
              <span className="lx-eyebrow text-[#e2c07a]">
                <Globe2 className="w-3.5 h-3.5" /> Built for teams
              </span>
              <h2 className="mt-5 text-4xl sm:text-6xl leading-[1.04] font-semibold tracking-[-0.03em] text-white text-balance">
                One calm inbox for <span className="lx-serif lx-gold-text">every channel.</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-white/70">
                Website chat, email and social messages land in one place. Assign, collaborate and resolve —
                with SLAs, automations and reports that keep everyone on track.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                {['Live chat', 'Email', 'WhatsApp', 'Instagram', 'Help center'].map((c) => (
                  <span key={c} className="lx-glass inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm text-white/85">
                    <Check className="w-3.5 h-3.5 text-[#e2c07a]" /> {c}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═════════════════════════ HOW IT WORKS ═════════════════════════ */}
        <section id="how" className="bg-canvas-alt border-b border-line">
          <div className="u-container py-24 sm:py-32">
            <Reveal className="max-w-3xl mx-auto text-center">
              <span className="lx-eyebrow text-accent">
                <span className="w-6 h-px bg-current" /> Setup <span className="w-6 h-px bg-current" />
              </span>
              <h2 className="mt-5 text-4xl sm:text-6xl leading-[1.05] font-semibold tracking-[-0.03em] text-ink">
                Three steps. <span className="lx-serif text-ink-3">About two minutes.</span>
              </h2>
            </Reveal>

            <div className="relative mt-16 grid md:grid-cols-3 gap-5">
              <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
              {STEPS.map(({ n, title, body, Icon }, i) => (
                <Reveal key={n} delay={i * 120} className="lx-card p-8 relative text-center">
                  <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-[#7c5cff] text-white flex items-center justify-center shadow-lg">
                    <Icon className="w-7 h-7" />
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-surface border border-line text-2xs font-mono font-bold text-ink flex items-center justify-center">
                      {n}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-ui leading-relaxed text-ink-2">{body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═════════════════════════ INSTALL ═════════════════════════ */}
        <section id="install" className="u-container py-24 sm:py-32">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
            <Reveal>
              <span className="lx-eyebrow text-accent">
                <Code2 className="w-3.5 h-3.5" /> Install
              </span>
              <h2 className="mt-5 text-4xl sm:text-6xl leading-[1.04] font-semibold tracking-[-0.03em] text-ink">
                One tag. <span className="lx-serif">Every page.</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-ink-2 max-w-md">
                No build step, no npm install, no framework lock-in. Paste it once before{' '}
                <code className="font-mono text-ui text-ink">&lt;/body&gt;</code> and the messenger is live for
                every visitor.
              </p>
              <div className="mt-9 flex flex-wrap gap-2">
                {['HTML', 'WordPress', 'Shopify', 'Webflow', 'React', 'Next.js'].map((p) => (
                  <span key={p} className="h-10 px-4 rounded-full border border-line bg-surface flex items-center text-xs font-medium text-ink-2 shadow-xs">
                    {p}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={120} className="relative">
              <div className="absolute -inset-8 lx-glow-blue opacity-25 -z-10" />
              <div className="lx-ring rounded-3xl bg-[#0b0c14] shadow-2xl overflow-hidden">
                <div className="h-12 px-5 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="font-mono text-xs text-white/45">index.html</span>
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold text-[#f1d79b]">
                    <Code2 className="w-3 h-3" /> Zero deps
                  </span>
                </div>
                <pre className="p-6 text-[13px] leading-relaxed font-mono overflow-x-auto text-white/80">
                  <span className="text-white/35">{'<!-- Zen-try live chat -->'}</span>
                  {'\n'}
                  <span className="text-[#9fb4ff]">{'<script'}</span>
                  {'\n  '}
                  <span className="text-[#b39dff]">src</span>=<span className="text-[#f1d79b]">&quot;{PRODUCTION_APP_ORIGIN}/widget.js&quot;</span>
                  {'\n  '}
                  <span className="text-[#b39dff]">data-workspace-id</span>=<span className="text-[#f1d79b]">&quot;YOUR_WORKSPACE_ID&quot;</span>
                  {'\n  '}
                  <span className="text-[#b39dff]">defer</span>
                  {'\n'}
                  <span className="text-[#9fb4ff]">{'></script>'}</span>
                </pre>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═════════════════════════ TESTIMONIALS ═════════════════════════ */}
        <section className="bg-canvas-alt border-y border-line">
          <div className="u-container py-24 sm:py-32">
            <Reveal className="max-w-3xl mx-auto text-center">
              <span className="lx-eyebrow text-accent">
                <span className="w-6 h-px bg-current" /> Loved by teams <span className="w-6 h-px bg-current" />
              </span>
              <h2 className="mt-5 text-4xl sm:text-6xl leading-[1.05] font-semibold tracking-[-0.03em] text-ink text-balance">
                Support that feels <span className="lx-serif">first-class.</span>
              </h2>
            </Reveal>

            <div className="mt-16 grid md:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t, i) => (
                <Reveal key={t.name} delay={i * 120} as="article" className="lx-card p-8 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-0.5 text-[#d9b46a]">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className="w-4 h-4" fill="currentColor" />
                      ))}
                    </div>
                    <Quote className="w-7 h-7 text-accent/25" />
                  </div>
                  <p className="mt-5 text-md leading-relaxed text-ink flex-1">“{t.quote}”</p>
                  <div className="mt-7 pt-6 border-t border-line flex items-center gap-3">
                    <Image src={t.avatar} alt={t.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover ring-2 ring-surface shadow-sm" />
                    <div>
                      <div className="text-sm font-semibold text-ink">{t.name}</div>
                      <div className="text-xs text-ink-3">{t.role}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═════════════════════════ FAQ ═════════════════════════ */}
        <FaqSection />

        {/* ═════════════════════════ FINAL CTA (cinematic banner) ═════════════════════════ */}
        <section className="u-container pb-24">
          <Reveal className="lx-stage lx-grain relative overflow-hidden rounded-[2rem] px-8 py-20 sm:px-16 sm:py-28 text-center">
            <Image src="/landing/hero-bg.jpg" alt="" fill sizes="(min-width: 1200px) 1200px, 100vw" className="object-cover -z-20 opacity-80" />
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(5,6,13,0.35),rgba(5,6,13,0.85))]" />
            <div className="lx-ring absolute inset-0 rounded-[2rem] pointer-events-none" />
            <span className="lx-eyebrow text-[#e2c07a] justify-center">
              <Sparkles className="w-3.5 h-3.5" /> Start today
            </span>
            <h2 className="mt-5 text-4xl sm:text-6xl leading-[1.04] font-semibold tracking-[-0.03em] text-white text-balance">
              Your next customer is <span className="lx-serif lx-gold-text">on your site right now.</span>
            </h2>
            <p className="mt-6 mx-auto max-w-lg text-lg leading-relaxed text-white/65">
              Set up a workspace, paste one line, and start the conversation before they close the tab.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup" className="lx-btn-gold lx-sheen w-full sm:w-auto">
                Get started free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="/demo.html" target="_blank" rel="noreferrer" className="lx-btn-ghost w-full sm:w-auto">
                Try the live demo
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function FeatureIcon({ Icon }: { Icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-[#7c5cff] text-white flex items-center justify-center shadow-md">
      <Icon className="w-5 h-5" />
    </div>
  );
}
