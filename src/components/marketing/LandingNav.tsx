'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const menuItems = [
  { name: 'Features', href: '#features' },
  { name: 'Team', href: '#team' },
  { name: 'Testimonials', href: '#testimonials' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'FAQ', href: '#faq' },
];

export function LandingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 pt-3 pb-2 transition-all duration-300" data-orbat-no-nav="" data-zentry-no-nav="">
      <div
        className={`mx-auto transition-all duration-300 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 ${
          isScrolled
            ? 'max-w-4xl rounded-full bg-white/85 dark:bg-[#060c1c]/85 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.08)]'
            : 'max-w-6xl rounded-2xl bg-white/70 dark:bg-[#060c1c]/70 backdrop-blur-md border border-slate-200/60 dark:border-white/10 shadow-xs'
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 select-none shrink-0">
          <Logo size={32} />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2 text-sm font-medium">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="px-3.5 py-1.5 rounded-full text-[#596171] hover:text-[#4f46e5] dark:text-slate-300 dark:hover:text-white hover:bg-[#ededfc] dark:hover:bg-white/10 transition-colors"
            >
              {item.name}
            </Link>
          ))}
          <a
            href="/demo.html"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 rounded-full text-[#596171] hover:text-[#4f46e5] dark:text-slate-300 dark:hover:text-white hover:bg-[#ededfc] dark:hover:bg-white/10 transition-colors inline-flex items-center gap-1.5"
          >
            <span>Live Demo</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </a>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ThemeToggle className="inline-flex shrink-0" />

          <Link
            href="/login"
            className="hidden sm:inline-flex px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-[#596171] hover:text-[#060c1c] dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            Sign In
          </Link>

          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs sm:text-sm font-semibold shadow-[0_2px_12px_rgba(79,70,229,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {/* Mobile hamburger trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-[#060c1c] dark:text-white hover:bg-[#ededfc] dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 max-w-4xl mx-auto rounded-3xl bg-white/95 dark:bg-[#060c1c]/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 p-5 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col space-y-1 text-sm font-medium">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl text-[#060c1c] dark:text-white hover:bg-[#ededfc] dark:hover:bg-white/10"
              >
                {item.name}
              </Link>
            ))}
            <a
              href="/demo.html"
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-[#060c1c] dark:text-white hover:bg-[#ededfc] dark:hover:bg-white/10 flex items-center justify-between"
            >
              <span>Live Demo</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </a>
            <div className="pt-3 mt-2 border-t border-slate-100 dark:border-white/10 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 text-center rounded-xl text-sm font-semibold border border-slate-200 dark:border-white/10 text-[#060c1c] dark:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 text-center rounded-xl text-sm font-semibold bg-[#4f46e5] text-white shadow-md"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
