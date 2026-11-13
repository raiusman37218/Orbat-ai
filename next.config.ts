import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'orbatai.com',
        '*.orbatai.com',
        'orbat.ai',
        '*.orbat.ai',
        'orbathelp.com',
        '*.orbathelp.com',
        'zen-try.site',
        '*.zen-try.site',
        'zen-try.com',
        '*.zen-try.com',
        'zentryhelp.com',
        '*.zentryhelp.com',
        'chatifyhelp.com',
        '*.chatifyhelp.com',
        'localhost:3000',
        '127.0.0.1:3000',
      ],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "notion-avatars.netlify.app",
      },
      {
        protocol: "https",
        hostname: "assets.aceternity.com",
      },
      {
        protocol: "https",
        hostname: "startup-template-sage.vercel.app",
      },
    ],
  },
};

export default nextConfig;
