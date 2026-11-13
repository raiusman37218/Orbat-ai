'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: 'Free Starter',
      description: 'Perfect for testing Orbat AI on your personal website or side project.',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [
        '1 Autonomous AI Chatbot',
        '50 AI conversations / month',
        'Train on 1 website knowledge source',
        'Standard response speed',
        'Basic conversation analytics',
        'Community & docs support',
      ],
      cta: 'Get Started Free',
      popular: false,
    },
    {
      name: 'Pro Growth',
      description: 'For growing businesses requiring higher capacity, custom branding & integrations.',
      monthlyPrice: 29,
      yearlyPrice: 24,
      features: [
        '3 Autonomous AI Chatbots',
        '1,000 AI conversations / month',
        'Train on unlimited websites, docs & PDFs',
        'Remove Orbat AI branding badge',
        'Omnichannel (WhatsApp, Instagram, Slack)',
        'Live visitor radar & tracking',
        'Priority email & live chat support',
      ],
      cta: 'Start 14-Day Free Trial',
      popular: true,
      includesPrevious: 'All Starter features, plus:',
    },
    {
      name: 'Enterprise Scale',
      description: 'For scaling teams requiring dedicated SLAs, full API access, and governance.',
      monthlyPrice: 99,
      yearlyPrice: 79,
      features: [
        '10 Autonomous AI Chatbots',
        '5,000 AI conversations / month',
        'Custom brand domains (SSL included)',
        'Full REST & Webhook API access',
        'Smart human escalation & SLA routing',
        'Custom LLM model temperature & fine-tuning',
        '24/7 dedicated support & SLA guarantees',
      ],
      cta: 'Upgrade to Enterprise',
      popular: false,
      includesPrevious: 'All Pro features, plus:',
    },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ededfc] dark:bg-[#4f46e5]/15 text-[#4f46e5] dark:text-[#a5b4fc] text-xs font-bold uppercase tracking-wider mb-4 border border-[#4f46e5]/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Simple, Transparent Pricing</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#060c1c] dark:text-white">
          Pick the Perfect Plan for Your Team
        </h2>
        <p className="mt-4 text-base sm:text-xl text-[#596171] dark:text-slate-300 leading-relaxed">
          Start for free to test on your site, or upgrade to Pro for unlimited training sources, custom branding, and WhatsApp integration.
        </p>

        {/* Monthly / Yearly Toggle */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="inline-flex items-center p-1 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200/80 dark:border-white/10 select-none">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                !isYearly
                  ? 'bg-white dark:bg-[#060c1c] text-[#060c1c] dark:text-white shadow-xs'
                  : 'text-[#596171] dark:text-slate-400 hover:text-[#060c1c] dark:hover:text-white'
              }`}
            >
              Monthly billing
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isYearly
                  ? 'bg-[#4f46e5] text-white shadow-xs'
                  : 'text-[#596171] dark:text-slate-400 hover:text-[#060c1c] dark:hover:text-white'
              }`}
            >
              Annual billing
            </button>
          </div>

          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
            <Sparkles className="w-3 h-3" />
            <span>Save 20%</span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan) => {
          const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.name}
              className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                plan.popular
                  ? 'bg-white dark:bg-[#0b0f19] border-2 border-[#4f46e5] shadow-[0_20px_50px_rgba(79,70,229,0.2)] lg:-translate-y-2'
                  : 'bg-white dark:bg-[#0b0f19] border border-slate-200/80 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-[#4f46e5] text-white text-2xs font-extrabold tracking-wider uppercase shadow-md flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-[#060c1c] dark:text-white">{plan.name}</h3>
                </div>

                <p className="text-xs sm:text-sm text-[#596171] dark:text-slate-300 min-h-10 mb-6">
                  {plan.description}
                </p>

                {/* Price Display */}
                <div className="flex items-baseline gap-1.5 mb-6 pb-6 border-b border-slate-100 dark:border-white/10">
                  <span className="text-4xl sm:text-5xl font-black text-[#060c1c] dark:text-white">
                    ${price}
                  </span>
                  <span className="text-xs sm:text-sm text-[#596171] dark:text-slate-400">
                    /month {isYearly && price > 0 ? '(billed annually)' : ''}
                  </span>
                </div>

                {/* Subheading */}
                {plan.includesPrevious && (
                  <p className="text-2xs font-bold uppercase tracking-wider text-[#4f46e5] dark:text-[#a5b4fc] mb-3">
                    {plan.includesPrevious}
                  </p>
                )}

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-xs sm:text-sm text-[#060c1c] dark:text-slate-200">
                      <div className="w-5 h-5 rounded-full bg-[#ededfc] dark:bg-[#4f46e5]/20 text-[#4f46e5] dark:text-[#a5b4fc] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span className="leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Button */}
              <Link
                href="/signup"
                className={`w-full py-3.5 px-6 rounded-2xl text-center text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  plan.popular
                    ? 'bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-[0_4px_16px_rgba(79,70,229,0.35)] hover:scale-[1.01]'
                    : 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-[#060c1c] dark:text-white'
                }`}
              >
                <span>{plan.cta}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center text-xs text-[#596171] dark:text-slate-400 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>All plans include 256-bit SSL encryption, GDPR compliance, and automated knowledge base sync.</span>
      </div>
    </section>
  );
}
