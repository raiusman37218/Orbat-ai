'use client';

import React from 'react';
import { LandingNav } from '@/components/marketing/LandingNav';
import { Hero } from '@/components/chatdeck/Hero';
import { LogoCarousel } from '@/components/chatdeck/LogoCarousel';
import { FeatureSection } from '@/components/chatdeck/FeatureSection';
import { TeamSection } from '@/components/chatdeck/TeamSection';
import { TestimonialSection } from '@/components/chatdeck/TestimonialSection';
import { PricingSection } from '@/components/chatdeck/PricingSection';
import { FaqSection } from '@/components/chatdeck/FaqSection';
import { CtaSection } from '@/components/chatdeck/CtaSection';
import { Footer } from '@/components/chatdeck/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fbfbf9] dark:bg-[#060c1c] text-[#060c1c] dark:text-white transition-colors antialiased selection:bg-[#4f46e5]/20 selection:text-[#4f46e5]">
      {/* 1. Chatdeck Floating Pill Navigation */}
      <LandingNav />

      {/* Main Content with top padding to clear fixed nav */}
      <main className="pt-20 sm:pt-24">
        {/* 2. Hero Section */}
        <Hero />

        {/* 3. Logo Marquee */}
        <LogoCarousel />

        {/* 4. Features Bento Grid */}
        <FeatureSection />

        {/* 5. Team Section */}
        <TeamSection />

        {/* 6. Testimonial Dual Marquee */}
        <TestimonialSection />

        {/* 7. Pricing Section */}
        <PricingSection />

        {/* 8. FAQ Section */}
        <FaqSection />

        {/* 9. High-converting CTA Banner */}
        <CtaSection />
      </main>

      {/* 10. Modern 4-Column Footer */}
      <Footer />
    </div>
  );
}
