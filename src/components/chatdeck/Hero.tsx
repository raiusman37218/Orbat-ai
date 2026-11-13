'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, X, ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export function Hero() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <div className="relative pt-6 sm:pt-12 pb-16 sm:pb-24 overflow-hidden">
      {/* Background ambient radial glow using our primary indigo and violet palette */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[900px] h-[350px] sm:h-[450px] bg-gradient-to-r from-[#4f46e5]/15 via-[#6366f1]/20 to-[#818cf8]/15 dark:from-[#4f46e5]/25 dark:via-[#6366f1]/20 dark:to-[#818cf8]/20 blur-[130px] rounded-full pointer-events-none -z-10" />

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none -z-10" />

      {/* 1. Pill Badge */}
      <div className="flex items-center justify-center mb-6 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#4f46e5]/25 bg-white/80 dark:bg-[#4f46e5]/15 text-[#4f46e5] dark:text-[#a5b4fc] text-xs sm:text-sm font-semibold tracking-wide shadow-xs backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-[#4f46e5] dark:text-[#818cf8]" />
          <span>Next-Gen Autonomous AI Support • 10,000+ Active Sites</span>
        </div>
      </div>

      {/* 2. Hero Headline */}
      <div className="text-center max-w-4xl mx-auto px-4">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#060c1c] dark:text-white leading-[1.08]">
          AI Chatbot for{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4f46e5] via-[#6366f1] to-[#818cf8]">
            Customer Support.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-xl text-[#596171] dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          It&apos;s like ChatGPT, but trained specifically on <strong className="font-semibold text-[#060c1c] dark:text-white">YOUR</strong> website and docs.
          Automate 80% of customer inquiries &amp; delight visitors 24/7. No coding required.
        </p>
      </div>

      {/* 3. Hero Actions (Shimmer Button + Live Demo) */}
      <div className="mt-8 mb-6 flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
        {/* Shimmer Button in Indigo */}
        <Link
          href="/signup"
          className="group relative inline-flex items-center justify-center overflow-hidden rounded-full px-8 py-4 text-sm sm:text-base font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0_4px_28px_rgba(79,70,229,0.38)] transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {/* Shimmer overlay effect */}
          <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-shimmer pointer-events-none" />
          <span className="relative z-10 flex items-center gap-2">
            <span>Start Free 14-Day Trial</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>

        {/* Live Demo Trigger */}
        <a
          href="/demo.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2.5 px-7 py-4 rounded-full border border-slate-200 dark:border-white/15 bg-white/90 dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-[#060c1c] dark:text-white text-sm sm:text-base font-medium shadow-xs transition-colors backdrop-blur-sm"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Interactive Preview</span>
        </a>
      </div>

      {/* Quick Perks / Trust Badges */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-12 sm:mb-16 text-2xs sm:text-xs text-[#596171] dark:text-slate-400 font-medium">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          No credit card required
        </span>
        <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          Setup in under 5 minutes
        </span>
        <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
          Google 1-click authentication
        </span>
      </div>

      {/* 4. Hero Video / Mockup Showcase with Play Button */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 bg-slate-900 shadow-[0_24px_70px_-15px_rgba(79,70,229,0.25)] overflow-hidden group">
          {/* Top Browser Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="text-2xs sm:text-xs font-mono text-slate-300 bg-slate-800/80 px-3.5 py-1 rounded-md border border-slate-700/60 truncate max-w-[220px] sm:max-w-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>app.orbatai.com/inbox</span>
            </div>
            <div className="w-14 text-right">
              <span className="text-2xs text-emerald-400 font-bold font-mono tracking-wide">LIVE RADAR</span>
            </div>
          </div>

          {/* Dashboard Preview Image */}
          <div
            className="relative aspect-[16/9] w-full bg-slate-950 overflow-hidden cursor-pointer"
            onClick={() => setVideoOpen(true)}
          >
            <Image
              src="/landing/resolvo/dashboard.webp"
              alt="Orbat AI Dashboard Showcase"
              fill
              className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
              priority
            />

            {/* Subtle Gradient Veil */}
            <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/30 transition-colors" />

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                aria-label="Play Product Video"
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoOpen(true);
                }}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#4f46e5] text-white flex items-center justify-center shadow-[0_8px_32px_rgba(79,70,229,0.5)] group-hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer"
              >
                <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white translate-x-0.5" />
              </button>
            </div>

            {/* Floating Live Badges */}
            <div className="hidden sm:flex absolute bottom-5 left-5 items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs font-semibold backdrop-blur-md shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>99.4% AI Accuracy Rate</span>
            </div>

            <div className="hidden sm:flex absolute top-5 right-5 items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs font-semibold backdrop-blur-md shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-[#818cf8]" />
              <span>&lt; 15s Avg Customer Resolution</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Video Dialog Modal */}
      {videoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              aria-label="Close video"
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              src="https://www.youtube.com/embed/qh3NGpYRG3I?autoplay=1"
              title="Orbat AI Product Walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
