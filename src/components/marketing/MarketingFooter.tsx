'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ArrowUpRight, Mail } from 'lucide-react';

const FOOTER_COLUMNS = [
  {
    heading: 'Product',
    links: [
      ['Features', '/#features'],
      ['Journey', '/#journey'],
      ['Multi-Channel Inbox', '/#inbox'],
      ['Pricing', '/pricing'],
      ['Live interactive demo', '/demo.html'],
    ],
  },
  {
    heading: 'Channels',
    links: [
      ['Live Chat Widget', '/widget'],
      ['Email Support Forwarding', '/#inbox'],
      ['WhatsApp Business', '/#inbox'],
      ['Instagram & Messenger', '/#inbox'],
      ['Custom Webhooks', '/#features'],
    ],
  },
  {
    heading: 'Resources',
    links: [
      ['Knowledge Base', '/help'],
      ['Frequently Asked Questions', '/#faq'],
      ['Create Workspace', '/signup'],
      ['Agent Sign In', '/login'],
      ['Super Admin Panel', '/admin'],
    ],
  },
  {
    heading: 'Legal',
    links: [
      ['Privacy Policy', '/privacy'],
      ['Terms of Service', '/terms'],
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="w-full border-t border-[#e5e3fb] dark:border-line bg-[#f8f7fe] dark:bg-canvas text-ink">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10">
          {/* Brand Column */}
          <div className="col-span-2 space-y-4">
            <Link href="/" aria-label="Orbat AI home" className="inline-flex">
              <Logo size={32} />
            </Link>
            <p className="text-sm leading-relaxed text-[#596171] dark:text-white/70 max-w-sm">
              Customer support that moves as fast as your business. Unified multi-channel inbox, intelligent ticket routing, AI knowledge retrieval, and real-time collaboration.
            </p>
            <div className="pt-2">
              <a
                href="mailto:support@orbatai.com"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#060c1c] border border-[#e5e3fb] dark:border-white/10 text-xs font-medium text-[#4f46e5] hover:border-[#4f46e5] transition-all shadow-xs"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>support@orbatai.com</span>
              </a>
            </div>
          </div>

          {/* Navigation Links Columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#060c1c] dark:text-white">
                {col.heading}
              </h3>
              <ul className="space-y-2 text-xs">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[#596171] dark:text-white/70 hover:text-[#4f46e5] dark:hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 pt-8 border-t border-[#e5e3fb] dark:border-white/10 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 text-xs text-[#596171] dark:text-white/60">
          <span>© {new Date().getFullYear()} Orbat AI. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#596171] dark:text-white/60">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              All systems operational
            </span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
