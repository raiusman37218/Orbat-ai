import type { NextConfig } from "next";

function extractHostEntry(raw: string | undefined): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

const DYNAMIC_ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
]
  .map(extractHostEntry)
  .filter((host): host is string => Boolean(host));

const SERVER_ACTION_ALLOWED_ORIGINS = Array.from(
  new Set([
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
    ...DYNAMIC_ALLOWED_ORIGINS,
  ]),
);

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: SERVER_ACTION_ALLOWED_ORIGINS,
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
