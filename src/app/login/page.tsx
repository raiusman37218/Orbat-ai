'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { AuthAside, AuthShell } from '@/components/marketing/AuthShell';
import { GoogleButton } from '@/components/marketing/GoogleButton';
import { backendLogin, backendGetGoogleUrl } from '@/lib/api/backend-auth';
import { errorMessage } from '@/lib/errors/user-error';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Where to land after signing in. Only same-site paths are honoured.
  const redirectParam = searchParams.get('redirect');
  const redirectTo =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : '/dashboard';

  // Check for error parameters in URL (e.g. from OAuth redirect)
  useEffect(() => {
    const err = searchParams.get('error');
    const desc = searchParams.get('error_description');
    if (err || desc) {
      setErrorMsg(desc || err);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both your work email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const authResult = await backendLogin(email, password);
      if (authResult?.accessToken) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
    } catch (err: any) {
      setErrorMsg(errorMessage(err, 'Invalid email or password.'));
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);

    try {
      const googleUrlRes = await backendGetGoogleUrl();
      if (googleUrlRes.configured && googleUrlRes.url) {
        window.location.href = googleUrlRes.url;
        return;
      }
      setErrorMsg(
        googleUrlRes.message ||
          'Google OAuth is not configured on the backend. Please check GOOGLE_CLIENT_ID in backend/.env.'
      );
      setGoogleLoading(false);
    } catch (err: any) {
      console.error('Google login error:', err);
      setErrorMsg(errorMessage(err, 'Failed to connect to authentication server.'));
      setGoogleLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl leading-tight font-extrabold tracking-tight text-ink">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Sign in to access your Orbat AI support workspace.
        </p>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-xs text-danger animate-pop leading-relaxed"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. Google One-Click Login */}
      <div className="space-y-4">
        <GoogleButton
          onClick={handleGoogleLogin}
          loading={googleLoading}
          disabled={loading}
          text="Continue with Google"
        />

        {/* Divider */}
        <div className="relative my-6 text-center text-xs">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line-2" />
          </div>
          <span className="relative bg-canvas px-3 text-ink-3 font-medium select-none">
            or sign in with email
          </span>
        </div>
      </div>

      {/* 2. Email / Password Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="field-label">
            Work email
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-10"
            />
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="field-label mb-0">
              Password
            </label>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-10 pr-11"
            />
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-surface-3 transition-colors cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="btn btn-lg btn-primary w-full !mt-6 shadow-xs hover:shadow-md cursor-pointer"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin-slow" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Signup */}
      <div className="mt-8 pt-5 border-t border-line text-center text-xs text-ink-3">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-semibold text-accent hover:underline underline-offset-4"
        >
          Create free workspace &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      aside={
        <AuthAside
          eyebrow="Agent Workspace & Radar"
          headline={
            <>
              One unified inbox for every
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#818cf8] via-[#a5b4fc] to-white">
                conversation on your site.
              </span>
            </>
          }
          points={[
            {
              title: 'Live Visitor Radar',
              body: 'See who is browsing, which page they are reading, and how long they have been there in real-time.',
            },
            {
              title: 'Sub-second WebSocket Delivery',
              body: 'Messages, typing indicators, and read receipts stream with ultra-low latency.',
            },
            {
              title: 'Autonomous AI Handover',
              body: 'Let AI resolve 80% of repetitive questions while seamlessly looping in human agents for complex queries.',
            },
          ]}
        />
      }
    >
      <Suspense
        fallback={
          <div className="space-y-4 animate-pulse">
            <div className="h-8 w-2/3 rounded-lg bg-surface-3" />
            <div className="h-11 w-full rounded-xl bg-surface-3" />
            <div className="h-11 w-full rounded-xl bg-surface-3" />
            <div className="h-11 w-full rounded-xl bg-surface-3" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
