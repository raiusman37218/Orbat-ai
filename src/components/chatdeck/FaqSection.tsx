'use client';

import React, { useState } from 'react';
import { Plus, Sparkles, Link as LinkIcon, Settings, ShieldCheck, Headset } from 'lucide-react';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const items = [
    {
      icon: Sparkles,
      title: 'What is Orbat AI?',
      content:
        'Orbat AI is an enterprise customer support platform powered by specialized LLM agents trained directly on YOUR website content, documentation, product guides, and FAQs. It delivers instant, context-aware answers 24/7 without requiring any code.',
    },
    {
      icon: LinkIcon,
      title: 'How does Orbat AI train on my content?',
      content:
        'Simply provide your public website URL, upload PDF product manuals, or link your help desk. Orbat AI’s crawler parses and indexes your content into vector embeddings, keeping knowledge automatically synchronized as your site updates.',
    },
    {
      icon: Settings,
      title: 'How long does it take to set up Orbat AI?',
      content:
        'Less than 5 minutes! The setup is a 3-step workflow: Connect → Train → Embed. We provide a single-line script tag you paste into your HTML or Webflow/Shopify/WordPress template, and your live chat widget appears instantly.',
    },
    {
      icon: ShieldCheck,
      title: "What happens when the chatbot can't answer a question?",
      content:
        'Orbat AI features intelligent Human-in-the-Loop escalation. When confidence falls below your configured threshold or a user asks for a human, the session seamlessly transfers to your agent inbox with the full conversation summary and context preserved.',
    },
    {
      icon: Headset,
      title: 'Are there limits on the number of conversations?',
      content:
        'The Free tier includes 50 conversations/month for testing. The Pro tier includes 1,000 conversations/month, and the Business tier supports 5,000 conversations/month. Custom enterprise packages with unlimited scale and dedicated SLAs are also available.',
    },
  ];

  return (
    <section id="faq" className="py-20 sm:py-28 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center mb-14 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ededfc] dark:bg-[#4f46e5]/15 text-[#4f46e5] dark:text-[#a5b4fc] text-xs font-bold uppercase tracking-wider mb-4 border border-[#4f46e5]/20">
          Got Questions?
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#060c1c] dark:text-white">
          Frequently Asked Questions
        </h2>
        <p className="mt-4 text-base sm:text-xl text-[#596171] dark:text-slate-300 leading-relaxed">
          Everything you need to know about Orbat AI and how it transforms customer operations.
        </p>
      </div>

      {/* Accordion List */}
      <div className="space-y-4">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'bg-white dark:bg-[#0b0f19] border-[#4f46e5]/40 dark:border-[#4f46e5]/50 shadow-[0_4px_20px_rgba(79,70,229,0.08)]'
                  : 'bg-white dark:bg-[#0b0f19] border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 select-none cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isOpen
                        ? 'bg-[#4f46e5] text-white'
                        : 'bg-[#ededfc] dark:bg-white/10 text-[#4f46e5] dark:text-[#a5b4fc]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-base sm:text-lg font-bold text-[#060c1c] dark:text-white">
                    {item.title}
                  </span>
                </div>

                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 ${
                    isOpen
                      ? 'rotate-45 bg-[#4f46e5] text-white'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 sm:px-6 pb-6 pt-1 text-sm sm:text-base text-[#596171] dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-white/5 animate-in fade-in duration-200">
                  {item.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

