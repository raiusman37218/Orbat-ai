'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export function CtaSection() {
  return (
    <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="relative rounded-3xl sm:rounded-4xl p-8 sm:p-14 lg:p-16 overflow-hidden bg-gradient-to-br from-[#060c1c] via-[#0b1029] to-[#1e1b4b] border border-white/15 text-white shadow-2xl">
        {/* Glow Spheres */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#4f46e5]/30 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#818cf8]/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-[#a5b4fc] text-xs font-bold uppercase tracking-wider mb-6 border border-white/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Launch In Minutes</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-6">
            Ready to Revolutionize Your Customer Support?
          </h2>

          <p className="text-base sm:text-xl text-slate-300 leading-relaxed mb-8 max-w-2xl">
            Join 10,000+ forward-thinking businesses using Orbat AI to automate responses, slash ticket resolution times, and delight visitors around the clock.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[#4f46e5] hover:bg-[#4338ca] text-white text-base font-semibold shadow-[0_4px_24px_rgba(79,70,229,0.5)] transition-all hover:scale-[1.02]"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="/demo.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white text-base font-semibold transition-colors"
            >
              <span>Interactive Preview</span>
            </a>
          </div>

          {/* Feature checklist perks */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>14-day full feature trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Setup in under 5 minutes</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

