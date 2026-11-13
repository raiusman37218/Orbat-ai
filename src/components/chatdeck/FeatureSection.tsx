'use client';

import React from 'react';
import { BookOpen, Clock, MessageCircle, Puzzle, Users, Zap, Sparkles } from 'lucide-react';

export function FeatureSection() {
  const features = [
    {
      title: 'Trained On Your Own Content',
      description:
        'Orbat AI absorbs knowledge from your website, help docs, product guides, blog posts, PDFs, and FAQs — ensuring context-rich, accurate responses your customers can trust.',
      icon: BookOpen,
      badge: 'Knowledge Engine',
      stat: '100% On-Brand',
    },
    {
      title: '24/7 Real-Time Autonomous Support',
      description:
        'Never miss a customer again. From midnight technical inquiries to weekend pre-sales questions, Orbat AI resolves conversations in seconds with zero downtime.',
      icon: Clock,
      badge: 'Zero Downtime',
      stat: '< 15s Latency',
    },
    {
      title: 'Natural, Empathetic Interactions',
      description:
        'Engineered to converse like your top support specialist — friendly, helpful, and natural. No robotic canned answers; strictly aligned with your brand guidelines.',
      icon: MessageCircle,
      badge: 'Natural Tone',
      stat: '99.4% CSAT',
    },
    {
      title: 'No-Code 5-Minute Setup',
      description:
        'Connect → Train → Publish. Literally minutes, not weeks. No developers required. Simply add your URL, paste a single script tag into your website, and go live.',
      icon: Zap,
      badge: '< 5 Mins',
      stat: '1-Line Embed',
    },
    {
      title: 'Omnichannel Integration',
      description:
        'Unify customer communications across website live chat, WhatsApp Business, Instagram, Slack, Messenger, and email into one streamlined inbox.',
      icon: Puzzle,
      badge: 'Omnichannel',
      stat: '6+ Channels',
    },
    {
      title: 'Smart Human Handoff',
      description:
        'Complex or sensitive query? Orbat AI smoothly transfers conversations to your team with full chat history, visitor context, and customer sentiment included.',
      icon: Users,
      badge: 'Human-in-the-Loop',
      stat: 'Seamless Handover',
    },
  ];

  return (
    <section id="features" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ededfc] dark:bg-[#4f46e5]/15 text-[#4f46e5] dark:text-[#a5b4fc] text-xs font-bold uppercase tracking-wider mb-4 border border-[#4f46e5]/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Supercharged AI Capabilities</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#060c1c] dark:text-white">
          Why Modern Teams Choose Orbat AI
        </h2>
        <p className="mt-4 text-base sm:text-xl text-[#596171] dark:text-slate-300 leading-relaxed">
          Experience customer support where AI deeply understands your business, your voice, and your customers.
        </p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="group relative p-8 rounded-3xl bg-white dark:bg-[#0b0f19] border border-slate-200/80 dark:border-white/10 hover:border-[#4f46e5]/50 dark:hover:border-[#4f46e5]/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgba(79,70,229,0.12)] transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Icon & Badge Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#ededfc] dark:bg-[#4f46e5]/20 text-[#4f46e5] dark:text-[#a5b4fc] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#4f46e5] group-hover:text-white transition-all duration-300 shadow-xs">
                    <Icon className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <span className="text-2xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-[#596171] dark:text-slate-300 font-mono">
                    {feature.badge}
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-[#060c1c] dark:text-white mb-3 group-hover:text-[#4f46e5] dark:group-hover:text-[#a5b4fc] transition-colors leading-snug">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-[#596171] dark:text-slate-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>

              {/* Bottom decorative subtle indicator & stat */}
              <div className="mt-8 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-2xs text-[#596171] dark:text-slate-400 font-medium">
                <span className="font-mono">0{index + 1} / CAPABILITY</span>
                <span className="px-2 py-0.5 rounded-md bg-[#4f46e5]/10 dark:bg-[#4f46e5]/20 text-[#4f46e5] dark:text-[#a5b4fc] font-bold font-mono">
                  {feature.stat}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
