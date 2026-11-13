'use client';

import React from 'react';
import Image from 'next/image';
import { Star } from 'lucide-react';

const reviews = [
  {
    name: 'Sarah Chen',
    username: '@sarahchen',
    body: 'Orbat AI reduced our support ticket response time by 60%. The AI understands context incredibly well and our customers love the instant responses.',
    img: 'https://notion-avatars.netlify.app/api/avatar?preset=female-1',
    rating: 5,
  },
  {
    name: 'Marcus Johnson',
    username: '@marcusj',
    body: "We've seen a 40% reduction in support costs since implementing Orbat AI. It handles routine queries flawlessly, letting our team focus on complex issues.",
    img: 'https://notion-avatars.netlify.app/api/avatar/?face=1&nose=10&mouth=8&eyes=11&eyebrows=1&glasses=14&hair=40&accessories=0&details=0&beard=0&halloween=0&christmas=0',
    rating: 5,
  },
  {
    name: 'Emily Rodriguez',
    username: '@emilyrodriguez',
    body: 'The setup was surprisingly simple. Within hours, Orbat AI was answering customer questions with accuracy that rivals our best human agents.',
    img: 'https://notion-avatars.netlify.app/api/avatar/?face=13&nose=7&mouth=11&eyes=3&eyebrows=12&glasses=3&hair=40&accessories=0&details=0&beard=0&halloween=0&christmas=0',
    rating: 5,
  },
  {
    name: 'David Kim',
    username: '@davidkim',
    body: "Our customer satisfaction scores jumped 25% after deploying Orbat AI. It's like having a 24/7 support team that never sleeps.",
    img: 'https://notion-avatars.netlify.app/api/avatar/?face=9&nose=3&mouth=7&eyes=10&eyebrows=12&glasses=1&hair=35&accessories=0&details=0&beard=0&halloween=0&christmas=0',
    rating: 5,
  },
  {
    name: 'Priya Patel',
    username: '@priyapatel',
    body: "Orbat AI's multilingual support opened up global markets for us. We now serve customers in 12 languages without hiring additional staff.",
    img: 'https://notion-avatars.netlify.app/api/avatar/?face=8&nose=7&mouth=4&eyes=0&eyebrows=6&glasses=11&hair=19&accessories=0&details=0&beard=0&halloween=0&christmas=0',
    rating: 5,
  },
  {
    name: 'Alex Thompson',
    username: '@alexthompson',
    body: 'The analytics dashboard is a game-changer. We now understand our customers’ pain points better than ever and can proactively improve our product.',
    img: 'https://notion-avatars.netlify.app/api/avatar/?face=1&nose=1&mouth=1&eyes=1&eyebrows=1&glasses=1&hair=1&accessories=1&details=1&beard=1&halloween=1&christmas=1',
    rating: 5,
  },
];

const firstRow = reviews.slice(0, 3);
const secondRow = reviews.slice(3);

function ReviewCard({ review }: { review: (typeof reviews)[number] }) {
  return (
    <figure className="relative w-80 sm:w-96 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0b0f19] border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(79,70,229,0.12)] hover:border-[#4f46e5]/40 transition-all shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-white/10 shrink-0">
            <Image
              src={review.img}
              alt={review.name}
              fill
              className="object-cover"
              sizes="40px"
              unoptimized
            />
          </div>
          <div>
            <figcaption className="text-sm font-bold text-[#060c1c] dark:text-white leading-tight">
              {review.name}
            </figcaption>
            <p className="text-2xs text-[#596171] dark:text-slate-400 font-mono">{review.username}</p>
          </div>
        </div>

        {/* 5-Star Rating */}
        <div className="flex items-center gap-0.5 text-amber-400">
          {[...Array(review.rating)].map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 fill-current" />
          ))}
        </div>
      </div>

      <blockquote className="text-xs sm:text-sm text-[#596171] dark:text-slate-300 leading-relaxed">
        &ldquo;{review.body}&rdquo;
      </blockquote>
    </figure>
  );
}

export function TestimonialSection() {
  return (
    <section id="testimonials" className="py-20 sm:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 text-center mb-16 sm:mb-20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ededfc] dark:bg-[#4f46e5]/15 text-[#4f46e5] dark:text-[#a5b4fc] text-xs font-bold uppercase tracking-wider mb-4 border border-[#4f46e5]/20">
          Real Stories, Real Results
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#060c1c] dark:text-white">
          Loved by Teams Around the Globe
        </h2>
        <p className="mt-4 text-base sm:text-xl text-[#596171] dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          See how innovative brands scale their support operations and elevate CSAT scores with Orbat AI.
        </p>
      </div>

      {/* Marquee Wrapper with fade gradients */}
      <div className="relative w-full overflow-hidden space-y-6">
        {/* Left & Right Fade Mask */}
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-[#fbfbf9] dark:from-[#060c1c] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-[#fbfbf9] dark:from-[#060c1c] to-transparent z-10 pointer-events-none" />

        {/* Row 1 (LTR) */}
        <div className="animate-marquee flex gap-6">
          {[...firstRow, ...firstRow, ...firstRow, ...firstRow].map((review, i) => (
            <ReviewCard key={`row1-${i}`} review={review} />
          ))}
        </div>

        {/* Row 2 (RTL) */}
        <div className="animate-marquee-reverse flex gap-6">
          {[...secondRow, ...secondRow, ...secondRow, ...secondRow].map((review, i) => (
            <ReviewCard key={`row2-${i}`} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}

