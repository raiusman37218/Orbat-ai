'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const RESOLVO_FAQS = [
  {
    num: '01',
    q: 'How does Orbat AI handle ticket routing?',
    a: 'AI automatically routes incoming tickets to the right team member based on agent expertise, language, and current workload to guarantee lightning-fast resolutions.',
  },
  {
    num: '02',
    q: 'How quickly can my team get started?',
    a: 'Get started in under 2 minutes. Simply create your workspace, add your team members, and paste a single embed script onto your website or connect your support email.',
  },
  {
    num: '03',
    q: 'Can I automate repetitive support tasks?',
    a: 'Yes. Automate routine questions, canned responses, triage tags, priority scoring, and SLA warning escalations with customizable trigger-based workflows.',
  },
  {
    num: '04',
    q: 'Which channels can I connect to Orbat AI?',
    a: 'Connect your website Live Chat, Email forwarding, WhatsApp Business, Instagram DMs, Messenger, X/Twitter, and custom Webhooks into one unified multi-channel inbox.',
  },
  {
    num: '05',
    q: 'How does the AI Assistant cite Knowledge Base articles?',
    a: 'Orbat AI uses hybrid semantic retrieval (RAG + pgvector) to query your published help documentation, answering customer questions with direct clickable citations.',
  },
  {
    num: '06',
    q: 'Is customer data isolated and secure?',
    a: 'Yes. Every organization is protected by strict workspace isolation, encrypted data transmission, and Role-Based Access Control (RBAC).',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="w-full py-20 sm:py-28 bg-[#f8f7fe]/60 dark:bg-canvas border-t border-[#e5e3fb] dark:border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Heading & Contact Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ededfc] border border-[#e0e7ff] text-[#4f46e5] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#4f46e5]" />
              FAQ
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#060c1c] dark:text-white leading-[1.15]">
              Frequently{' '}
              <span className="font-serif italic text-[#4f46e5] block sm:inline">asked questions</span>
            </h2>

            <p className="text-base text-[#596171] dark:text-white/70 leading-relaxed">
              Find answers to the most common questions about Orbat AI and our customer support platform.
            </p>

            {/* Resolvo Support Contact Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#060c1c] border border-[#e5e3fb] dark:border-white/10 shadow-[0_8px_30px_rgba(21,93,252,0.06)] space-y-4">
              <div className="w-10 h-10 rounded-xl bg-[#ededfc] flex items-center justify-center text-[#4f46e5]">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#060c1c] dark:text-white">Still have questions?</h3>
                <p className="text-sm text-[#596171] dark:text-white/70 mt-1">
                  Our customer support team is available 24/7 to assist you with onboarding or custom setups.
                </p>
              </div>
              <Link
                href="/help"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-semibold shadow-sm transition-all"
              >
                <span>Contact our support team</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Right Column: Numbered Accordion List */}
          <div className="lg:col-span-7 space-y-3.5">
            {RESOLVO_FAQS.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={faq.num}
                  className={cn(
                    'rounded-2xl border transition-all duration-200 overflow-hidden',
                    isOpen
                      ? 'bg-white dark:bg-[#060c1c] border-[#4f46e5]/40 shadow-[0_6px_24px_rgba(79,70,229,0.08)]'
                      : 'bg-white/80 dark:bg-[#060c1c]/80 border-[#e5e3fb] dark:border-white/10 hover:border-[#4f46e5]/30'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-semibold text-[#060c1c] dark:text-white cursor-pointer select-none"
                  >
                    <span className="flex items-center gap-3.5">
                      <span className="text-xs font-bold text-[#4f46e5] font-mono tracking-wider">
                        {faq.num}
                      </span>
                      <span className="text-sm sm:text-base">{faq.q}</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-[#596171] transition-transform duration-200 shrink-0',
                        isOpen && 'rotate-180 text-[#4f46e5]'
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 pt-1 text-sm leading-relaxed text-[#596171] dark:text-white/70 border-t border-[#ededfc] dark:border-white/10 animate-in fade-in duration-150">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
