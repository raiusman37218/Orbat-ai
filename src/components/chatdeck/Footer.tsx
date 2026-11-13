'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 dark:border-white/10 bg-[#fbfbf9] dark:bg-[#060c1c] text-[#060c1c] dark:text-white transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-12">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <Logo size={32} />
            </Link>
            <p className="text-sm text-[#596171] dark:text-slate-400 max-w-sm leading-relaxed">
              Orbat AI is the modern customer intelligence and live support engine. Trained on your knowledge base to automate up to 80% of customer inquiries accurately.
            </p>
            <div className="pt-2 text-2xs text-[#596171] dark:text-slate-500 font-mono">
              Designed for performance, privacy, and scale.
            </div>
          </div>

          {/* Product Col */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#060c1c] dark:text-white mb-4">
              Product
            </h4>
            <ul className="space-y-2.5 text-sm text-[#596171] dark:text-slate-400">
              <li>
                <Link href="#features" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="#testimonials" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  Testimonials
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  Knowledge Base
                </Link>
              </li>
              <li>
                <a href="/demo.html" target="_blank" rel="noreferrer" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  Interactive Demo
                </a>
              </li>
            </ul>
          </div>

          {/* Company Col */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#060c1c] dark:text-white mb-4">
              Company
            </h4>
            <ul className="space-y-2.5 text-sm text-[#596171] dark:text-slate-400">
              <li>
                <Link href="#team" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  Team
                </Link>
              </li>
              <li>
                <Link href="#faq" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  Start Free Trial
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Col */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#060c1c] dark:text-white mb-4">
              Legal &amp; Privacy
            </h4>
            <ul className="space-y-2.5 text-sm text-[#596171] dark:text-slate-400">
              <li>
                <Link href="/privacy" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#4f46e5] dark:hover:text-[#a5b4fc] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <span className="text-slate-400 dark:text-slate-500 cursor-default">
                  SOC-2 Type II Compliant
                </span>
              </li>
              <li>
                <span className="text-slate-400 dark:text-slate-500 cursor-default">
                  GDPR Ready
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#596171] dark:text-slate-500">
          <p>© {new Date().getFullYear()} Orbat AI Inc. All rights reserved.</p>
          <p className="flex items-center gap-1.5 font-mono">
            <span>Powered by Orbat AI Engine</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Systems Normal</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

