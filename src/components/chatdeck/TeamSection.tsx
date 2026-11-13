'use client';

import React from 'react';
import Image from 'next/image';

export function TeamSection() {
  const teamMembers = [
    {
      name: 'Phillip Bothman',
      role: 'Founder & CEO',
      description: 'A visionary leader driving innovation and customer-first AI collaboration.',
      image: '/team/phillip.png',
      initials: 'PB',
    },
    {
      name: 'James Kenter',
      role: 'Engineering Manager',
      description: 'Leading our core systems team to build resilient, distributed AI infrastructure.',
      image: '/team/james.png',
      initials: 'JK',
    },
    {
      name: 'Cristofer Kenter',
      role: 'Product Designer',
      description: 'Crafting intuitive, engaging, and beautiful end-user support experiences.',
      image: '/team/cristofer.png',
      initials: 'CK',
    },
    {
      name: 'Alena Lubin',
      role: 'Frontend Developer',
      description: 'Bringing real-time interfaces and high-performance widgets to life.',
      image: '/team/alena.png',
      initials: 'AL',
    },
  ];

  return (
    <section id="team" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ededfc] dark:bg-[#4f46e5]/15 text-[#4f46e5] dark:text-[#a5b4fc] text-xs font-bold uppercase tracking-wider mb-4 border border-[#4f46e5]/20">
          The People Behind The Tech
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#060c1c] dark:text-white">
          Meet Our Amazing Team
        </h2>
        <p className="mt-4 text-base sm:text-xl text-[#596171] dark:text-slate-300 leading-relaxed">
          Meet the passionate experts behind our success and discover how we make world-class customer support effortless.
        </p>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {teamMembers.map((member) => (
          <div
            key={member.name}
            className="group p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0b0f19] border border-slate-200/80 dark:border-white/10 hover:border-[#4f46e5]/50 dark:hover:border-[#4f46e5]/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_36px_rgba(79,70,229,0.12)] transition-all duration-300 text-center flex flex-col items-center"
          >
            {/* Avatar */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-5 border-2 border-[#4f46e5]/30 group-hover:border-[#4f46e5] group-hover:scale-105 transition-all duration-300 shadow-md">
              <Image
                src={member.image}
                alt={member.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 112px, 128px"
              />
            </div>

            {/* Name & Role */}
            <h3 className="text-lg sm:text-xl font-bold text-[#060c1c] dark:text-white group-hover:text-[#4f46e5] dark:group-hover:text-[#a5b4fc] transition-colors">
              {member.name}
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-[#4f46e5] dark:text-[#a5b4fc] mt-1 mb-3">
              {member.role}
            </p>

            {/* Description */}
            <p className="text-xs sm:text-sm text-[#596171] dark:text-slate-300 leading-relaxed mb-6 flex-1">
              {member.description}
            </p>

            {/* Social SVGs */}
            <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
              {/* Twitter / X */}
              <a
                href="#"
                aria-label={`${member.name} on Twitter`}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-[#4f46e5] hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href="#"
                aria-label={`${member.name} on LinkedIn`}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-[#4f46e5] hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 0 0 1.64-1.64c0-.9-.74-1.64-1.64-1.64a1.64 1.64 0 0 0-1.64 1.64c0 .9.74 1.64 1.64 1.64m1.39 9.74v-8.37H5.07v8.37h2.78z" />
                </svg>
              </a>

              {/* GitHub */}
              <a
                href="#"
                aria-label={`${member.name} on GitHub`}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-[#4f46e5] hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>

              {/* Facebook */}
              <a
                href="#"
                aria-label={`${member.name} on Facebook`}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-[#4f46e5] hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
