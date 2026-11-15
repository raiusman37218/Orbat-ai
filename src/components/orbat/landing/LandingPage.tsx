'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import './landing.css';

type ProductTabKey = 'ai' | 'inbox' | 'analytics' | 'comp';
type LangKey = 'Roman Urdu' | 'Hinglish' | 'العربية' | 'Español';

const LANGS: Record<
  LangKey,
  { customer: string; reply: string; english: string; dir: 'ltr' | 'rtl' }
> = {
  'Roman Urdu': {
    customer: 'Mera order abhi tak nahi aaya, kab tak aayega?',
    reply: 'Aap ka order Lahore pohanch gaya hai, aaj shaam tak deliver ho jayega.',
    english: 'My order hasn’t come yet — when will it arrive?',
    dir: 'ltr',
  },
  Hinglish: {
    customer: 'Refund kab milega? 5 din ho gaye',
    reply: 'Aapka refund approve ho gaya hai, 2 din mein account mein aa jayega.',
    english: 'When will I get my refund? It’s been 5 days',
    dir: 'ltr',
  },
  العربية: {
    customer: 'متى يصل طلبي؟',
    reply: 'طلبك في الطريق وسيصل غدًا قبل الساعة ١٢.',
    english: 'When will my order arrive?',
    dir: 'rtl',
  },
  Español: {
    customer: '¿Puedo cambiar la talla de mi pedido?',
    reply: 'Claro, te envié una etiqueta de cambio gratis por email.',
    english: 'Can I change the size of my order?',
    dir: 'ltr',
  },
};

const LANG_KEYS: LangKey[] = ['Roman Urdu', 'Hinglish', 'العربية', 'Español'];

const TABS: Record<
  ProductTabKey,
  {
    label: string;
    heading: string;
    description: string;
    points: string[];
    href: string;
  }
> = {
  ai: {
    label: 'AI agents',
    heading: 'Agents that earn their autonomy.',
    description:
      'Start in suggest mode. As answers prove accurate, Nova unlocks more on its own, within limits you set.',
    points: [
      'Answers only from your verified knowledge',
      'Action limits, like refunds up to $75',
      'Hands off when confidence drops',
    ],
    href: '/app/agents',
  },
  inbox: {
    label: 'Inbox',
    heading: 'Every channel in one calm inbox.',
    description:
      'Chat, WhatsApp, Instagram, email and calls side by side, with customer history beside every conversation.',
    points: [
      'Smart routing by skill and language',
      'Saved replies and AI drafts',
      'SLA timers your team can see',
    ],
    href: '/app/inbox',
  },
  analytics: {
    label: 'Analytics',
    heading: 'Know what AI solved, and what it cost.',
    description:
      'See resolution rates, costs per conversation and the questions your knowledge base is missing.',
    points: [
      'Cost per conversation by model tier',
      'Knowledge gaps ranked by demand',
      'CSAT for AI and humans',
    ],
    href: '/app/analytics',
  },
  comp: {
    label: 'Compliance',
    heading: 'A compliance officer that never sleeps.',
    description:
      'Sentinel checks 100% of conversations against GDPR, HIPAA, PCI DSS and your own policies.',
    points: [
      'Redacts card and health data before storage',
      'Blocks risky replies before they’re sent',
      'Exportable audit log and evidence pack',
    ],
    href: '/app/compliance',
  },
};

const TAB_KEYS: ProductTabKey[] = ['ai', 'inbox', 'analytics', 'comp'];

const HERO_CONVOS = [
  {
    ini: 'SJ',
    n: 'Sarah Johnson',
    t: '2m',
    p: 'Where is my order #2048?',
    tag: 'Handed to Alex',
    avBg: '#FAD4E4',
    avColor: '#6B1238',
    tagBg: '#FDF2E3',
    tagColor: '#A4510B',
    active: true,
  },
  {
    ini: 'BA',
    n: 'Bilal Ahmed',
    t: '5m',
    p: 'Order kab tak aayega?',
    tag: 'Nova · Roman Urdu',
    avBg: '#CFF1F4',
    avColor: '#0B4A50',
    tagBg: '#F1ECFD',
    tagColor: '#6D3FD6',
    active: false,
  },
  {
    ini: 'MR',
    n: 'Marco Rossi',
    t: '21m',
    p: 'Discount code not applying',
    tag: 'Resolved by AI',
    avBg: '#FFE1C7',
    avColor: '#6B3410',
    tagBg: '#E2F6D5',
    tagColor: '#163300',
    active: false,
  },
  {
    ini: 'AR',
    n: 'Aisha Rahman',
    t: '38m',
    p: 'Charged twice for one order',
    tag: 'Billing',
    avBg: '#D2F2E2',
    avColor: '#0F4D2F',
    tagBg: '#F4F5F1',
    tagColor: '#454745',
    active: false,
  },
  {
    ini: 'PN',
    n: 'Priya N.',
    t: '44m',
    p: 'Is the throw machine washable?',
    tag: 'Resolved by AI',
    avBg: '#E9D8FD',
    avColor: '#3B1F73',
    tagBg: '#E2F6D5',
    tagColor: '#163300',
    active: false,
  },
];

const HERO_SUMMARY = [
  { k: 'Intent', v: 'Delivery by Saturday (gift)' },
  { k: 'Already tried', v: 'Tracking link, carrier status' },
  { k: 'Customer', v: 'VIP · 9 orders · $1,284' },
  { k: 'Why handed off', v: 'Asked for a guarantee' },
];

const LOGOS: Array<{ n: string; w: number; ls: string; f: string }> = [
  { n: 'Lumen Goods', w: 700, ls: '-.02em', f: 'var(--font-sans)' },
  { n: 'NORTHWIND', w: 700, ls: '.18em', f: 'var(--font-sans)' },
  { n: 'atlas bank', w: 800, ls: '-.04em', f: 'var(--font-sans)' },
  { n: 'Kestrel Air', w: 500, ls: '0', f: 'Georgia, serif' },
  { n: 'brightpath', w: 800, ls: '-.03em', f: 'var(--font-sans)' },
  { n: 'Meridian Health', w: 600, ls: '-.01em', f: 'var(--font-sans)' },
  { n: 'OAK & IRIS', w: 600, ls: '.12em', f: 'Georgia, serif' },
  { n: 'Volta Mobile', w: 700, ls: '-.02em', f: 'var(--font-sans)' },
];

const STATS = [
  { v: '63%', l: 'of conversations resolved by AI' },
  { v: '38s', l: 'median first response, day or night' },
  { v: '40+', l: 'languages, including Roman Urdu' },
  { v: '10m', l: 'from sign-up to going live' },
];

const LADDER = [
  { t: 'Suggest drafts to agents', s: 'Graduated', c: 'var(--ok)', bg: 'var(--ok-soft)' },
  { t: 'Answer FAQs on its own', s: 'Graduated', c: 'var(--ok)', bg: 'var(--ok-soft)' },
  { t: 'Process refunds up to $75', s: 'Learning · 92% accurate', c: 'var(--warn)', bg: 'var(--warn-soft)' },
  { t: 'Change subscription plans', s: 'Locked', c: 'var(--text-3)', bg: 'var(--surface-2)' },
];

const CHANNELS = [
  { i: 'WC', n: 'Website chat', d: 'Widget on every page', v: '6,111' },
  { i: 'WA', n: 'WhatsApp', d: 'Business API', v: '2,832' },
  { i: 'IG', n: 'Instagram', d: 'DMs and story replies', v: '1,640' },
  { i: '@', n: 'Email', d: 'support@yourcompany.com', v: '3,279' },
  { i: '☎', n: 'Voice', d: 'AI answers, humans join', v: '2,184' },
];

const BARS = [48, 56, 52, 61, 66, 58, 63].map((h, i) => ({
  h: h + 30,
  isLast: i === 6,
  d: `${i * 0.08}s`,
}));

const FLAGS = [
  { t: 'Card number shared', d: '4111 •••• •••• 1234', a: 'Redacted' },
  { t: 'Investment advice drafted', d: 'Nova · WhatsApp', a: 'Blocked' },
  { t: 'Regulator mentioned', d: 'Customer · Email', a: 'Escalated' },
];

const FLOW = [
  {
    n: '01',
    t: 'Customer asks',
    d: 'On any channel, in any language. Nova answers from your knowledge.',
  },
  {
    n: '02',
    t: 'AI checks itself',
    d: 'Low confidence, an angry customer or a sensitive topic triggers an offer.',
  },
  {
    n: '03',
    t: 'Team is rung',
    d: 'Everyone free gets an alert. First to accept owns the chat.',
  },
  {
    n: '04',
    t: 'Full context',
    d: 'Intent, steps tried, order and suggested next step, all in one card.',
  },
];

const INDUSTRIES = [
  {
    n: 'E-commerce',
    d: 'Orders, returns and cart recovery.',
    icon: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
    fw: ['PCI DSS', 'GDPR'],
    bg: 'var(--surface-2)',
  },
  {
    n: 'Healthcare',
    d: 'Appointments and intake, never medical advice.',
    icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
    fw: ['HIPAA'],
    bg: 'var(--mint)',
  },
  {
    n: 'Banking',
    d: 'Identity checks, card freezes and disputes.',
    icon: 'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11',
    fw: ['KYC', 'SOC 2'],
    bg: 'var(--ai-soft)',
  },
  {
    n: 'Education',
    d: 'Admissions, fees and application status.',
    icon: 'M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5',
    fw: ['FERPA'],
    bg: 'var(--warn-soft)',
  },
];

const COMPARE = [
  {
    k: 'Answers on its own',
    a: 'Scripted bots and FAQs',
    b: 'Resolves with actions, within limits',
  },
  {
    k: 'Handoff to a person',
    a: 'Customer repeats everything',
    b: 'Summary, history and next step',
  },
  {
    k: 'Languages',
    a: 'Formal languages only',
    b: 'Roman Urdu, Hinglish, voice notes',
  },
  {
    k: 'Compliance',
    a: 'Add-on or manual reviews',
    b: 'Every reply checked by Sentinel',
  },
  {
    k: 'Pricing',
    a: 'Per seat, plus AI fees',
    b: 'Per result, unlimited teammates',
  },
];

const BADGES = [
  { n: 'SOC 2', d: 'Controls' },
  { n: 'GDPR', d: 'EU data' },
  { n: 'HIPAA', d: 'Health data' },
  { n: 'PCI DSS', d: 'Card data' },
  { n: 'ISO 27001', d: 'In progress' },
  { n: 'WCAG 2.2', d: 'Accessible' },
];

const APPS = [
  { i: 'SH', n: 'Shopify' },
  { i: 'WC', n: 'WooCommerce' },
  { i: 'WA', n: 'WhatsApp' },
  { i: 'ST', n: 'Stripe' },
  { i: 'HS', n: 'HubSpot' },
  { i: 'SF', n: 'Salesforce' },
  { i: 'SL', n: 'Slack' },
  { i: 'JI', n: 'Jira' },
  { i: 'GC', n: 'Google Calendar' },
  { i: 'ZP', n: 'Zapier' },
  { i: 'IG', n: 'Instagram' },
  { i: 'TW', n: 'Twilio' },
];

const FAQS = [
  {
    q: 'How long does setup take?',
    a: 'Most teams are live in under 10 minutes: add the widget, connect a channel, and Nova learns from your website.',
  },
  {
    q: 'Will the AI make things up?',
    a: 'No. Nova only answers from your verified knowledge. If it isn’t sure, it says so and offers a person.',
  },
  {
    q: 'Can customers always reach a human?',
    a: 'Yes. “Talk to a person” is always one tap away, and the AI goes silent once an agent joins.',
  },
  {
    q: 'Does it work with WhatsApp and calls?',
    a: 'Yes — WhatsApp Business, Instagram, Messenger, email, SMS and voice calls all land in one inbox.',
  },
  {
    q: 'Is my data safe?',
    a: 'Sensitive data is redacted before storage, data can stay in your region, and every action is logged.',
  },
];

const FOOTER_COLS = [
  {
    h: 'Product',
    links: [
      { t: 'Inbox', href: '/app/inbox' },
      { t: 'AI agents', href: '/app/agents' },
      { t: 'Voice', href: '/app/calls' },
      { t: 'Pricing', href: '/pricing' },
    ],
  },
  {
    h: 'Solutions',
    links: [
      { t: 'E-commerce', href: '/app/agents/templates' },
      { t: 'Healthcare', href: '/app/agents/templates' },
      { t: 'Banking', href: '/app/agents/templates' },
      { t: 'Education', href: '/app/agents/templates' },
    ],
  },
  {
    h: 'Resources',
    links: [
      { t: 'Help center', href: '/help' },
      { t: 'Trust center', href: '/app/compliance' },
      { t: 'Status', href: '/app/states' },
    ],
  },
  {
    h: 'Company',
    links: [
      { t: 'About', href: '#product' },
      { t: 'Careers', href: '#industries' },
      { t: 'Contact', href: '#demo' },
    ],
  },
];

export function LandingPage() {
  const [activeTab, setActiveTab] = useState<ProductTabKey>('ai');
  const [activeLang, setActiveLang] = useState<LangKey>('Roman Urdu');
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentTab = TABS[activeTab];
  const currentLang = LANGS[activeLang];
  const marqueeLogos = [...LOGOS, ...LOGOS];

  function toggleTheme() {
    if (typeof document === 'undefined') return;
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('orbat-theme', next);
    } catch {
      /* ignore storage errors */
    }
  }

  return (
    <div className="o-lp">
      {/* STICKY HEADER */}
      <header className="o-lp-header">
        <div className="o-lp-wrap o-lp-header-inner">
          <Link href="/" aria-label="ORBAT home" className="o-lp-brand">
            <svg width="32" height="32" viewBox="0 0 28 28" aria-hidden="true">
              <rect width="28" height="28" rx="9" fill="#163300" />
              <ellipse
                cx="14"
                cy="14"
                rx="9.5"
                ry="4.2"
                fill="none"
                stroke="#9FE870"
                strokeWidth="1.7"
                transform="rotate(-28 14 14)"
              />
              <circle cx="14" cy="14" r="3.2" fill="#9FE870" />
            </svg>
            ORBAT
          </Link>

          <nav aria-label="Main" className="o-lp-nav">
            <a className="o-lp-navl" href="#product">
              Product
            </a>
            <a className="o-lp-navl" href="#industries">
              Industries
            </a>
            <Link className="o-lp-navl" href="/pricing">
              Pricing
            </Link>
            <a className="o-lp-navl" href="#security">
              Security
            </a>
            <Link className="o-lp-navl" href="/help">
              Resources
            </Link>
          </nav>

          <div className="o-lp-header-actions">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              title="Switch light / dark theme"
              style={{
                width: 40,
                height: 40,
                borderRadius: 99,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                display: 'inline-grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            </button>
            <Link className="o-lp-navl o-lp-hide-mobile" href="/login">
              Log in
            </Link>
            <a className="o-lp-pill o-lp-pill-sm o-lp-p-soft o-lp-hide-mobile" href="#demo">
              Book a demo
            </a>
            <Link className="o-lp-pill o-lp-pill-sm o-lp-p-lime" href="/signup">
              Start free trial
            </Link>
            <button
              type="button"
              className="o-lp-mobile-toggle"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="o-lp-mobile-drawer">
            <a className="o-lp-navl" href="#product" onClick={() => setMobileMenuOpen(false)}>
              Product
            </a>
            <a className="o-lp-navl" href="#industries" onClick={() => setMobileMenuOpen(false)}>
              Industries
            </a>
            <Link className="o-lp-navl" href="/pricing" onClick={() => setMobileMenuOpen(false)}>
              Pricing
            </Link>
            <a className="o-lp-navl" href="#security" onClick={() => setMobileMenuOpen(false)}>
              Security
            </a>
            <Link className="o-lp-navl" href="/help" onClick={() => setMobileMenuOpen(false)}>
              Resources
            </Link>
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, flexWrap: 'wrap' }}>
              <Link className="o-lp-pill o-lp-pill-sm o-lp-p-soft" href="/login">
                Log in
              </Link>
              <a
                className="o-lp-pill o-lp-pill-sm o-lp-p-soft"
                href="#demo"
                onClick={() => setMobileMenuOpen(false)}
              >
                Book a demo
              </a>
            </div>
          </div>
        ) : null}
      </header>

      {/* HERO */}
      <section style={{ padding: '64px 0 0', textAlign: 'center' }}>
        <div
          className="o-lp-wrap"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}
        >
          <a
            href="#languages"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 16px 6px 6px',
              borderRadius: 99,
              background: 'var(--mint)',
              fontSize: 14.5,
              fontWeight: 500,
              color: 'var(--forest)',
              textDecoration: 'none',
              maxWidth: '100%',
            }}
          >
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 99,
                background: '#163300',
                color: '#9FE870',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '.04em',
                flexShrink: 0,
              }}
            >
              NEW
            </span>
            <span style={{ textAlign: 'left' }}>
              Now fluent in Roman Urdu, Hinglish and voice notes →
            </span>
          </a>

          <h1 className="o-lp-disp o-lp-d1">
            <span
              style={{
                display: 'inline-block',
                background: '#9FE870',
                color: '#163300',
                padding: '.05em .12em 0',
                borderRadius: '.1em',
                transform: 'rotate(-1.5deg)',
              }}
            >
              Instant
            </span>{' '}
            answers.
            <br />
            Real people
            <br />
            when it matters.
          </h1>

          <p className="o-lp-lead" style={{ maxWidth: 640 }}>
            ORBAT’s AI agent resolves most conversations across chat, WhatsApp, email and calls,
            then hands the rest to your team with the full story.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Link className="o-lp-pill o-lp-p-lime" href="/signup">
              Start free — 14 days
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <a className="o-lp-pill o-lp-p-soft" href="#demo">
              See it in action
            </a>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 22px',
              justifyContent: 'center',
              fontSize: 14.5,
              color: 'var(--text-3)',
            }}
          >
            <span>✓ No credit card</span>
            <span>✓ Live in 10 minutes</span>
            <span>✓ Unlimited teammates</span>
          </div>
        </div>

        {/* PRODUCT SHOT */}
        <div className="o-lp-wrap o-lp-shot-outer">
          <div aria-hidden="true" className="o-lp-shot-backdrop" />
          <div className="o-lp-ui o-lp-shot-ui">
            {/* List pane */}
            <div className="o-lp-shot-list">
              <div
                style={{
                  padding: '16px 18px',
                  fontWeight: 700,
                  fontSize: 15,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Inbox</span>
                <span
                  className="o-lp-num"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: 'var(--mint)',
                    color: 'var(--forest)',
                  }}
                >
                  24 open
                </span>
              </div>
              {HERO_CONVOS.map((c) => (
                <div
                  key={c.n}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '12px 18px',
                    borderTop: '1px solid var(--border)',
                    background: c.active ? 'var(--ok-soft)' : 'var(--surface)',
                    boxShadow: c.active ? 'inset 3px 0 0 #9FE870' : 'none',
                  }}
                >
                  <span
                    style={{
                      flex: 'none',
                      width: 32,
                      height: 32,
                      borderRadius: 99,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      background: c.avBg,
                      color: c.avColor,
                    }}
                  >
                    {c.ini}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13.5,
                        fontWeight: 600,
                      }}
                    >
                      <span>{c.n}</span>
                      <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 12 }}>
                        {c.t}
                      </span>
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12.5,
                        color: 'var(--text-3)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {c.p}
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '1px 7px',
                        borderRadius: 99,
                        background: c.tagBg,
                        color: c.tagColor,
                      }}
                    >
                      {c.tag}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            {/* Chat pane */}
            <div className="o-lp-shot-chat">
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 99,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    background: '#FAD4E4',
                    color: '#6B1238',
                  }}
                >
                  SJ
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>Sarah Johnson</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Website chat · VIP</div>
                </div>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 12.5,
                    color: 'var(--ok)',
                    fontWeight: 600,
                  }}
                >
                  <span
                    className="o-lp-ping"
                    style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--ok)' }}
                  />
                  Live
                </span>
              </div>

              <div
                style={{
                  flex: 1,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div
                  className="o-lp-bub o-lp-seq o-lp-s1"
                  style={{
                    background: 'var(--surface)',
                    boxShadow: '0 0 0 1px var(--border)',
                    borderRadius: '4px 16px 16px 16px',
                  }}
                >
                  Hi, where’s order #2048? I need it by Saturday — it’s a gift.
                </div>

                <div
                  className="o-lp-bub o-lp-seq o-lp-s2"
                  style={{
                    alignSelf: 'flex-end',
                    background: 'var(--ai-soft)',
                    color: 'var(--text)',
                    borderRadius: '16px 4px 16px 16px',
                  }}
                >
                  <b
                    style={{
                      fontSize: 12,
                      color: 'var(--ai-text)',
                      display: 'block',
                      marginBottom: 2,
                    }}
                  >
                    Nova · AI
                  </b>
                  It shipped Nov 5, but tracking hasn’t moved. I can’t promise Saturday, so I’m
                  bringing in Alex.
                </div>

                <div
                  className="o-lp-seq o-lp-s3"
                  style={{
                    alignSelf: 'center',
                    fontSize: 12,
                    color: 'var(--text-3)',
                    padding: '4px 12px',
                    borderRadius: 99,
                    background: 'var(--surface)',
                    boxShadow: '0 0 0 1px var(--border)',
                  }}
                >
                  Alex joined · summary attached
                </div>

                <div
                  className="o-lp-bub o-lp-seq o-lp-s4"
                  style={{
                    alignSelf: 'flex-end',
                    background: '#163300',
                    color: '#FFFFFF',
                    borderRadius: '16px 4px 16px 16px',
                  }}
                >
                  <b
                    style={{
                      fontSize: 12,
                      color: '#9FE870',
                      display: 'block',
                      marginBottom: 2,
                    }}
                  >
                    Alex · Support
                  </b>
                  Free express re-ship is on its way, arriving Friday. Sorry for the wait!
                </div>

                <div
                  className="o-lp-bub o-lp-seq o-lp-s5"
                  style={{
                    background: 'var(--surface)',
                    boxShadow: '0 0 0 1px var(--border)',
                    borderRadius: '4px 16px 16px 16px',
                  }}
                >
                  You’re the best, thank you!
                </div>

                <div
                  className="o-lp-seq o-lp-s6"
                  style={{
                    alignSelf: 'center',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#163300',
                    padding: '5px 12px',
                    borderRadius: 99,
                    background: '#9FE870',
                  }}
                >
                  Resolved in 3m 12s · CSAT 5/5
                </div>
              </div>

              <div
                style={{
                  margin: '0 20px 18px',
                  height: 46,
                  borderRadius: 12,
                  background: 'var(--surface)',
                  boxShadow: '0 0 0 1px var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 8px 0 14px',
                  fontSize: 13.5,
                  color: 'var(--text-3)',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Reply, or type / for saved replies
                </span>
                <span
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    background: 'var(--ai-soft)',
                    color: 'var(--ai-text)',
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  AI draft
                </span>
                <span
                  style={{
                    padding: '7px 12px',
                    borderRadius: 99,
                    background: '#9FE870',
                    color: '#163300',
                    fontSize: 12.5,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  Send
                </span>
              </div>
            </div>

            {/* Context pane */}
            <div className="o-lp-shot-ctx">
              <div style={{ fontWeight: 700, fontSize: 14 }}>Handoff summary</div>
              {HERO_SUMMARY.map((r) => (
                <div key={r.k}>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '.05em',
                      color: 'var(--text-3)',
                    }}
                  >
                    {r.k}
                  </div>
                  <div style={{ fontSize: 13.5, marginTop: 2 }}>{r.v}</div>
                </div>
              ))}
              <div
                style={{
                  marginTop: 'auto',
                  padding: 12,
                  borderRadius: 14,
                  background: 'var(--mint)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>
                  Suggested next step
                </div>
                <div style={{ fontSize: 13, color: 'var(--forest)', marginTop: 3 }}>
                  Offer free express re-ship. Within your refund limit.
                </div>
              </div>
            </div>
          </div>

          {/* Floating Characters */}
          <svg
            aria-hidden="true"
            className="o-lp-floaty o-lp-char-nova"
            width="132"
            height="132"
            viewBox="0 0 120 120"
          >
            <g className="o-lp-spin">
              <ellipse
                cx="60"
                cy="60"
                rx="56"
                ry="21"
                fill="none"
                stroke="#6D3FD6"
                strokeWidth="2.5"
                strokeDasharray="3 7"
                transform="rotate(-22 60 60)"
              />
            </g>
            <circle cx="60" cy="60" r="36" fill="#6D3FD6" />
            <path
              d="M36 46a30 30 0 0 1 22-14"
              stroke="#8E66F0"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            <g className="o-lp-blink">
              <ellipse cx="48" cy="58" rx="5" ry="7" fill="#FFFFFF" />
              <ellipse cx="72" cy="58" rx="5" ry="7" fill="#FFFFFF" />
            </g>
            <path
              d="M49 73q11 8 22 0"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>

          <svg
            aria-hidden="true"
            className="o-lp-char-agent"
            width="160"
            height="196"
            viewBox="0 0 150 190"
          >
            <g className="o-lp-nod">
              <path d="M26 190c0-40 21-62 49-62s49 22 49 62z" fill="#9FE870" />
              <path d="M62 128h26l-13 17z" fill="#FFFFFF" />
              <circle cx="75" cy="86" r="32" fill="#E8B48F" />
              <path
                d="M43 84c0-22 14-36 33-36s32 13 32 33c-8-8-20-12-34-12-12 0-22 5-31 15z"
                fill="#22160F"
              />
              <g className="o-lp-blink">
                <circle cx="64" cy="90" r="3.4" fill="#22160F" />
                <circle cx="86" cy="90" r="3.4" fill="#22160F" />
              </g>
              <path
                d="M66 103q9 7 18 0"
                fill="none"
                stroke="#22160F"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M41 88a34 34 0 0 1 68 0"
                fill="none"
                stroke="#163300"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <rect x="35" y="82" width="11" height="20" rx="5" fill="#163300" />
              <rect x="104" y="82" width="11" height="20" rx="5" fill="#163300" />
              <path
                d="M40 101q4 16 22 17"
                fill="none"
                stroke="#163300"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="63" cy="118" r="3.5" fill="#163300" />
            </g>
            <g className="o-lp-wave">
              <path
                d="M118 160c10-12 14-28 12-42"
                fill="none"
                stroke="#9FE870"
                strokeWidth="16"
                strokeLinecap="round"
              />
              <circle cx="130" cy="114" r="9" fill="#E8B48F" />
            </g>
          </svg>
        </div>
      </section>

      {/* LOGOS MARQUEE */}
      <section aria-label="Teams using ORBAT" style={{ padding: '120px 0 64px', overflow: 'hidden' }}>
        <div
          className="o-lp-wrap"
          style={{
            textAlign: 'center',
            fontSize: 15,
            color: 'var(--text-3)',
            marginBottom: 26,
          }}
        >
          Trusted by support teams across retail, health, finance and education
        </div>
        <div
          style={{
            overflow: 'hidden',
            maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
          }}
        >
          <div className="o-lp-marq">
            {marqueeLogos.map((l, idx) => (
              <span
                key={`${l.n}-${idx}`}
                style={{
                  fontSize: 26,
                  fontWeight: l.w,
                  letterSpacing: l.ls,
                  color: 'var(--text-3)',
                  whiteSpace: 'nowrap',
                  fontFamily: l.f,
                }}
              >
                {l.n}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* METRICS BANNER */}
      <section style={{ padding: '0 0 120px' }}>
        <div className="o-lp-wrap">
          <div
            style={{
              borderRadius: 40,
              background: '#163300',
              color: '#FFFFFF',
              padding: 'clamp(36px, 5vw, 64px) clamp(24px, 4.5vw, 56px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
              gap: 36,
            }}
          >
            {STATS.map((s) => (
              <div key={s.v} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  className="o-lp-disp o-lp-num"
                  style={{
                    fontSize: 'clamp(56px, 7vw, 84px)',
                    color: '#9FE870',
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.v}
                </div>
                <div style={{ fontSize: 17, color: '#CFE0C2', maxWidth: 220 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 13,
              color: 'var(--text-3)',
              textAlign: 'center',
            }}
          >
            Target outcomes from pilot workspaces. Results vary by industry and setup.
          </div>
        </div>
      </section>

      {/* PRODUCT TOUR */}
      <section id="product" style={{ padding: '0 0 120px' }}>
        <div className="o-lp-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 24,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
              <span className="o-lp-kick">The platform</span>
              <h2 className="o-lp-disp o-lp-d2">One workspace. Every conversation.</h2>
            </div>
            <p className="o-lp-lead" style={{ maxWidth: 380 }}>
              Replace your help desk, chatbot and call tool with one system your team actually
              enjoys.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Product areas"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: 6,
              borderRadius: 99,
              background: 'var(--surface-2)',
              alignSelf: 'flex-start',
            }}
          >
            {TAB_KEYS.map((k, idx) => {
              const selected = k === activeTab;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(k)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      setActiveTab(TAB_KEYS[(idx + 1) % TAB_KEYS.length]);
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      setActiveTab(TAB_KEYS[(idx - 1 + TAB_KEYS.length) % TAB_KEYS.length]);
                    }
                  }}
                  className="o-lp-tabb"
                  style={{
                    background: selected ? '#163300' : 'transparent',
                    color: selected ? '#FFFFFF' : 'var(--text-2)',
                  }}
                >
                  {TABS[k].label}
                </button>
              );
            })}
          </div>

          <div
            className="o-lp-box"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 48,
              alignItems: 'center',
              padding: 'clamp(24px, 4.5vw, 56px)',
            }}
          >
            <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 className="o-lp-disp o-lp-d3">{currentTab.heading}</h3>
              <p className="o-lp-lead">{currentTab.description}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {currentTab.points.map((p) => (
                  <div
                    key={p}
                    style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 17 }}
                  >
                    <span
                      style={{
                        flex: 'none',
                        width: 24,
                        height: 24,
                        borderRadius: 99,
                        background: '#9FE870',
                        color: '#163300',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 13,
                        fontWeight: 800,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
              <Link
                href={currentTab.href}
                className="o-lp-pill o-lp-p-dark"
                style={{ alignSelf: 'flex-start', height: 50, marginTop: 6 }}
              >
                Explore {currentTab.label}
              </Link>
            </div>

            <div
              className="o-lp-ui"
              style={{
                flex: '1 1 460px',
                minWidth: 0,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {activeTab === 'ai' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        background: '#6D3FD6',
                        color: '#FFFFFF',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                      }}
                    >
                      N
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>Nova</div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                        Frontline agent · all channels
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 99,
                        background: '#9FE870',
                        color: '#163300',
                      }}
                    >
                      Live
                    </span>
                  </div>
                  {LADDER.map((l) => (
                    <div
                      key={l.t}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: l.bg,
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{l.t}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: l.c }}>{l.s}</span>
                    </div>
                  ))}
                </>
              ) : null}

              {activeTab === 'inbox' ? (
                <>
                  {CHANNELS.map((c) => (
                    <div
                      key={c.n}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: 14,
                        boxShadow: '0 0 0 1px var(--border)',
                      }}
                    >
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: 'var(--surface-2)',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          fontSize: 12,
                          color: 'var(--forest)',
                        }}
                      >
                        {c.i}
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 600, fontSize: 15 }}>
                          {c.n}
                        </span>
                        <span style={{ display: 'block', fontSize: 13, color: 'var(--text-3)' }}>
                          {c.d}
                        </span>
                      </span>
                      <span className="o-lp-num" style={{ fontSize: 13, fontWeight: 600 }}>
                        {c.v}
                      </span>
                    </div>
                  ))}
                </>
              ) : null}

              {activeTab === 'analytics' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700 }}>AI resolution rate</span>
                    <span
                      className="o-lp-disp o-lp-num"
                      style={{ fontSize: 40, textTransform: 'none' }}
                    >
                      63%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 200,
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 10,
                      paddingTop: 10,
                    }}
                  >
                    {BARS.map((b, i) => (
                      <span
                        key={i}
                        className="o-lp-barA"
                        style={{
                          flex: 1,
                          height: `${b.h}%`,
                          borderRadius: '8px 8px 3px 3px',
                          background: b.isLast ? '#9FE870' : '#163300',
                          animationDelay: b.d,
                        }}
                      />
                    ))}
                  </div>
                  <div
                    className="o-lp-mono"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: 'var(--text-3)',
                    }}
                  >
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>
                </>
              ) : null}

              {activeTab === 'comp' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <svg
                      aria-hidden="true"
                      className="o-lp-floaty"
                      width="62"
                      height="70"
                      viewBox="0 0 84 96"
                    >
                      <path
                        d="M42 4l34 12v28c0 24-16 40-34 48C24 84 8 68 8 44V16z"
                        fill="#163300"
                      />
                      <path
                        d="M42 12l26 9v23c0 19-12 32-26 39-14-7-26-20-26-39V21z"
                        fill="#2F5A14"
                      />
                      <g className="o-lp-blink">
                        <ellipse cx="32" cy="44" rx="4" ry="5.5" fill="#9FE870" />
                        <ellipse cx="52" cy="44" rx="4" ry="5.5" fill="#9FE870" />
                      </g>
                      <path
                        d="M33 58q9 6 18 0"
                        fill="none"
                        stroke="#9FE870"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div>
                      <div style={{ fontWeight: 700 }}>Sentinel</div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                        Checked 14,906 conversations this month
                      </div>
                    </div>
                  </div>
                  {FLAGS.map((f) => (
                    <div
                      key={f.t}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: 14,
                        boxShadow: '0 0 0 1px var(--border)',
                      }}
                    >
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 600, fontSize: 15 }}>
                          {f.t}
                        </span>
                        <span
                          className="o-lp-mono"
                          style={{ display: 'block', fontSize: 12.5, color: 'var(--text-3)' }}
                        >
                          {f.d}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 99,
                          background: 'var(--mint)',
                          color: 'var(--forest)',
                        }}
                      >
                        {f.a}
                      </span>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* HANDOFF (DARK FOREST) */}
      <section style={{ padding: '120px 0', background: '#163300', color: '#FFFFFF' }}>
        <div className="o-lp-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 24,
            }}
          >
            <h2 className="o-lp-disp o-lp-d2" style={{ maxWidth: 760 }}>
              AI first.
              <br />
              <span style={{ color: '#9FE870' }}>Humans</span> one tap away.
            </h2>
            <p className="o-lp-lead" style={{ maxWidth: 400, color: '#CFE0C2' }}>
              The handoff is offered, never forced. Your whole team is rung at once, and the first
              to accept gets the full story.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
              gap: 16,
            }}
          >
            {FLOW.map((f) => (
              <div
                key={f.n}
                className="o-lp-lift"
                style={{
                  padding: 28,
                  borderRadius: 30,
                  background: '#21420C',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  minHeight: 230,
                }}
              >
                <span className="o-lp-mono" style={{ fontSize: 13, color: '#9FE870' }}>
                  {f.n}
                </span>
                <span className="o-lp-t-card">{f.t}</span>
                <span style={{ fontSize: 16, color: '#CFE0C2' }}>{f.d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LANGUAGES */}
      <section id="languages" style={{ padding: '120px 0' }}>
        <div
          className="o-lp-wrap"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 64, alignItems: 'center' }}
        >
          <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <span className="o-lp-kick">Multilingual</span>
            <h2 className="o-lp-disp o-lp-d2">Speaks like your customers.</h2>
            <p className="o-lp-lead">
              Roman Urdu, Hinglish, Arabizi and voice notes. Customers write naturally. Your team
              reads and replies in English.
            </p>
          </div>

          <div
            className="o-lp-box"
            style={{
              flex: '1 1 520px',
              minWidth: 0,
              padding: 'clamp(20px, 4vw, 32px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div
              role="tablist"
              aria-label="Language"
              style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
            >
              {LANG_KEYS.map((langName, idx) => {
                const selected = langName === activeLang;
                return (
                  <button
                    key={langName}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveLang(langName)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        setActiveLang(LANG_KEYS[(idx + 1) % LANG_KEYS.length]);
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        setActiveLang(LANG_KEYS[(idx - 1 + LANG_KEYS.length) % LANG_KEYS.length]);
                      }
                    }}
                    className="o-lp-tabb"
                    style={{
                      background: selected ? '#163300' : 'transparent',
                      color: selected ? '#FFFFFF' : 'var(--text-2)',
                    }}
                  >
                    {langName}
                  </button>
                );
              })}
            </div>

            <div
              className="o-lp-ui"
              style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div
                className="o-lp-bub"
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: '4px 16px 16px 16px',
                  direction: currentLang.dir,
                  fontSize: 17,
                }}
              >
                {currentLang.customer}
              </div>
              <div
                className="o-lp-bub"
                style={{
                  alignSelf: 'flex-end',
                  background: 'var(--ai-soft)',
                  borderRadius: '16px 4px 16px 16px',
                  direction: currentLang.dir,
                  fontSize: 17,
                }}
              >
                {currentLang.reply}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  paddingTop: 10,
                  borderTop: '1px dashed var(--border-2)',
                  fontSize: 14,
                  color: 'var(--text-3)',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--forest)' }}>Agent view</span>
                <span>“{currentLang.english}”</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section id="industries" style={{ padding: '0 0 120px' }}>
        <div className="o-lp-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
              <span className="o-lp-kick">Industries</span>
              <h2 className="o-lp-disp o-lp-d2">Ready for your industry.</h2>
            </div>
            <Link
              href="/app/agents/templates"
              className="o-lp-pill o-lp-p-soft"
              style={{ height: 48 }}
            >
              All 12 templates
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(270px, 100%), 1fr))',
              gap: 16,
            }}
          >
            {INDUSTRIES.map((i) => (
              <Link
                key={i.n}
                href="/app/agents/templates"
                className="o-lp-lift o-lp-box"
                style={{
                  padding: 28,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  minHeight: 260,
                  background: i.bg,
                }}
              >
                <span
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'var(--surface)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--forest)',
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={i.icon} />
                  </svg>
                </span>
                <span className="o-lp-t-card">{i.n}</span>
                <span style={{ fontSize: 16, color: 'var(--text-2)' }}>{i.d}</span>
                <span
                  style={{
                    marginTop: 'auto',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  {i.fw.map((f) => (
                    <span
                      key={f}
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 99,
                        background: 'var(--surface)',
                        color: 'var(--forest)',
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section style={{ padding: '0 0 120px' }}>
        <div className="o-lp-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
            <span className="o-lp-kick">Why teams switch</span>
            <h2 className="o-lp-disp o-lp-d2">Built differently.</h2>
          </div>

          <div className="o-lp-ring" style={{ borderRadius: 30, overflow: 'hidden' }}>
            <div
              className="o-lp-compare-row"
              style={{
                background: 'var(--surface-2)',
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              <span className="o-lp-compare-cell" />
              <span className="o-lp-compare-cell" style={{ color: 'var(--text-3)' }}>
                Typical help desk
              </span>
              <span
                className="o-lp-compare-cell"
                style={{ background: '#9FE870', color: '#163300' }}
              >
                ORBAT
              </span>
            </div>
            {COMPARE.map((r) => (
              <div
                key={r.k}
                className="o-lp-compare-row"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <span className="o-lp-compare-cell" style={{ fontWeight: 600 }}>
                  {r.k}
                </span>
                <span className="o-lp-compare-cell" style={{ color: 'var(--text-3)' }}>
                  {r.a}
                </span>
                <span
                  className="o-lp-compare-cell"
                  style={{
                    background: 'var(--ok-soft)',
                    fontWeight: 600,
                    color: 'var(--forest)',
                  }}
                >
                  {r.b}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" style={{ padding: '0 0 120px' }}>
        <div className="o-lp-wrap">
          <div
            className="o-lp-box"
            style={{
              padding: 'clamp(28px, 4.5vw, 56px)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 48,
              alignItems: 'center',
              background: 'var(--mint)',
            }}
          >
            <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <span className="o-lp-kick">Security & compliance</span>
              <h2
                className="o-lp-disp o-lp-d3"
                style={{ fontSize: 'clamp(34px, 4.5vw, 56px)', color: 'var(--forest)' }}
              >
                Compliance in every reply.
              </h2>
              <p className="o-lp-lead" style={{ color: 'var(--forest)' }}>
                Sentinel redacts sensitive data, blocks risky replies and logs every action, for AI
                and humans alike.
              </p>
              <Link
                href="/app/compliance"
                className="o-lp-pill o-lp-p-dark"
                style={{ alignSelf: 'flex-start', height: 50 }}
              >
                Visit Trust Center
              </Link>
            </div>

            <div className="o-lp-badges-grid">
              {BADGES.map((b) => (
                <div
                  key={b.n}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 24,
                    background: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    textAlign: 'center',
                    padding: 10,
                  }}
                >
                  <span
                    className="o-lp-disp"
                    style={{ fontSize: 24, color: 'var(--forest)', textTransform: 'none' }}
                  >
                    {b.n}
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{b.d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section style={{ padding: '0 0 120px' }}>
        <div
          className="o-lp-wrap"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span className="o-lp-kick" style={{ alignSelf: 'center' }}>
            Integrations
          </span>
          <h2 className="o-lp-disp o-lp-d2" style={{ maxWidth: 900 }}>
            Plugs into the tools you already use.
          </h2>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
              maxWidth: 980,
            }}
          >
            {APPS.map((a) => (
              <span
                key={a.n}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 52,
                  padding: '0 20px 0 8px',
                  borderRadius: 99,
                  boxShadow: '0 0 0 1px var(--border)',
                  background: 'var(--surface)',
                  fontWeight: 600,
                  fontSize: 15.5,
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 99,
                    background: 'var(--surface-2)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'var(--forest)',
                  }}
                >
                  {a.i}
                </span>
                {a.n}
              </span>
            ))}
          </div>
          <Link
            href="/app/channels"
            style={{
              fontWeight: 600,
              color: 'var(--forest)',
              textDecoration: 'underline',
              textUnderlineOffset: 4,
            }}
          >
            See 60+ integrations
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '0 0 120px' }}>
        <div className="o-lp-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: 64 }}>
          <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <span className="o-lp-kick">FAQ</span>
            <h2 className="o-lp-disp o-lp-d2">Good questions.</h2>
            <p className="o-lp-lead">
              Still curious?{' '}
              <a
                href="#demo"
                style={{
                  color: 'var(--forest)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  textUnderlineOffset: 4,
                }}
              >
                Talk to our team
              </a>
              .
            </p>
          </div>

          <div style={{ flex: '2 1 560px', display: 'flex', flexDirection: 'column' }}>
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} style={{ borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 20,
                      padding: '24px 0',
                      textAlign: 'left',
                      fontSize: 20,
                      fontWeight: 600,
                      letterSpacing: '-.01em',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{item.q}</span>
                    <span
                      style={{
                        flex: 'none',
                        width: 36,
                        height: 36,
                        borderRadius: 99,
                        background: isOpen ? '#9FE870' : 'var(--surface-2)',
                        color: isOpen ? '#163300' : 'var(--forest)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 20,
                        fontWeight: 500,
                      }}
                    >
                      {isOpen ? '–' : '+'}
                    </span>
                  </button>
                  {isOpen ? (
                    <div
                      style={{
                        padding: '0 56px 24px 0',
                        fontSize: 17,
                        color: 'var(--text-2)',
                      }}
                    >
                      {item.a}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section id="demo" style={{ padding: '0 0 120px' }}>
        <div className="o-lp-wrap">
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 40,
              background: '#9FE870',
              color: '#163300',
              padding: 'clamp(40px, 6vw, 80px) clamp(24px, 5vw, 64px)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 40,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                flex: '1 1 520px',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <h2 className="o-lp-disp" style={{ fontSize: 'clamp(44px, 6.5vw, 80px)' }}>
                Hand Nova
                <br />
                the night shift.
              </h2>
              <p className="o-lp-lead" style={{ color: '#163300', maxWidth: 520 }}>
                Set up in ten minutes. Wake up to a clean inbox and happier customers.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link
                  href="/signup"
                  className="o-lp-pill"
                  style={{ background: '#163300', color: '#FFFFFF' }}
                >
                  Start free trial
                </Link>
                <Link
                  href="/login"
                  className="o-lp-pill"
                  style={{ background: 'rgba(22, 51, 0, 0.1)', color: '#163300' }}
                >
                  Book a demo
                </Link>
              </div>
            </div>

            <div
              style={{
                flex: '1 1 280px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end',
                gap: 4,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <svg
                aria-hidden="true"
                className="o-lp-floaty"
                width="160"
                height="160"
                viewBox="0 0 120 120"
              >
                <g className="o-lp-spin">
                  <ellipse
                    cx="60"
                    cy="60"
                    rx="57"
                    ry="20"
                    fill="none"
                    stroke="#163300"
                    strokeWidth="2.5"
                    strokeDasharray="3 7"
                    transform="rotate(-20 60 60)"
                  />
                </g>
                <circle cx="60" cy="60" r="40" fill="#6D3FD6" />
                <g className="o-lp-blink">
                  <ellipse cx="47" cy="56" rx="6" ry="8" fill="#FFFFFF" />
                  <ellipse cx="73" cy="56" rx="6" ry="8" fill="#FFFFFF" />
                </g>
                <path
                  d="M46 74q14 11 28 0"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
              <svg aria-hidden="true" width="130" height="160" viewBox="0 0 120 150">
                <g className="o-lp-nod">
                  <path d="M18 150c0-34 18-52 42-52s42 18 42 52z" fill="#163300" />
                  <circle cx="60" cy="66" r="27" fill="#B97C58" />
                  <path
                    d="M33 64c0-19 12-30 28-30s27 11 27 28c-10-5-22-8-34-7-8 1-15 4-21 9z"
                    fill="#2B1C14"
                  />
                  <g className="o-lp-blink">
                    <circle cx="51" cy="69" r="3" fill="#2B1C14" />
                    <circle cx="69" cy="69" r="3" fill="#2B1C14" />
                  </g>
                  <path
                    d="M52 80q8 6 16 0"
                    fill="none"
                    stroke="#2B1C14"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </g>
                <g className="o-lp-wave">
                  <path
                    d="M96 128c8-10 12-24 10-36"
                    fill="none"
                    stroke="#163300"
                    strokeWidth="14"
                    strokeLinecap="round"
                  />
                  <circle cx="106" cy="88" r="8" fill="#B97C58" />
                </g>
              </svg>
            </div>

            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: -120,
                top: -120,
                width: 420,
                height: 420,
                borderRadius: '50%',
                border: '2px solid rgba(22, 51, 0, 0.12)',
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: -40,
                top: -40,
                width: 260,
                height: 260,
                borderRadius: '50%',
                border: '2px solid rgba(22, 51, 0, 0.12)',
              }}
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#163300', color: '#CFE0C2', padding: '72px 0 40px' }}>
        <div
          className="o-lp-wrap"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 48,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 28,
                color: '#9FE870',
              }}
            >
              ORBAT
            </span>
            <span style={{ fontSize: 15.5 }}>
              AI and human customer support for every industry.
            </span>
          </div>

          {FOOTER_COLS.map((col) => (
            <div
              key={col.h}
              style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 15 }}
            >
              <b style={{ fontWeight: 700, color: '#FFFFFF' }}>{col.h}</b>
              {col.links.map((x) => (
                <Link
                  key={x.t}
                  href={x.href}
                  style={{ color: '#CFE0C2', textDecoration: 'none' }}
                >
                  {x.t}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div
          className="o-lp-wrap"
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            fontSize: 14,
          }}
        >
          <span>© 2026 ORBAT AI</span>
          <span style={{ display: 'flex', gap: 20 }}>
            <a href="#security" style={{ color: '#CFE0C2', textDecoration: 'none' }}>
              Privacy
            </a>
            <a href="#security" style={{ color: '#CFE0C2', textDecoration: 'none' }}>
              Terms
            </a>
            <a href="#security" style={{ color: '#CFE0C2', textDecoration: 'none' }}>
              Cookies
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
