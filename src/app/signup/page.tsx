'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { AuthAside, AuthShell } from '@/components/marketing/AuthShell';
import { GoogleButton } from '@/components/marketing/GoogleButton';
import { backendSignup, backendGetGoogleUrl } from '@/lib/api/backend-auth';
import { errorMessage } from '@/lib/errors/user-error';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<'form' | 'verified'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(() => {
    return searchParams.get('error_description') || searchParams.get('error') || null;
  });

  // Password rules validation
  const ruleLength = password.length >= 8;
  const ruleNumberOrSpecial = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const ruleCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const allPasswordRulesMet = ruleLength && ruleNumberOrSpecial && ruleCase;

  // Google OAuth Signup
  const handleGoogleSignup = async () => {
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
      console.error('Google signup error:', err);
      setErrorMsg(errorMessage(err, 'Failed to connect to authentication server.'));
      setGoogleLoading(false);
    }
  };

  // Submit Account Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setTermsError(false);

    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (!allPasswordRulesMet) {
      setErrorMsg('Please ensure your password meets all the security requirements below.');
      return;
    }

    if (!agreedToTerms) {
      setTermsError(true);
      setErrorMsg('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);

    try {
      const authResult = await backendSignup(name.trim(), email.trim(), password);
      if (authResult?.accessToken) {
        setPhase('verified');
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 1000);
        return;
      }
    } catch (err: any) {
      setErrorMsg(errorMessage(err, 'Failed to create your account. Please try again.'));
      setLoading(false);
    }
  };

  if (phase === 'verified') {
    return (
      <div className="text-center py-8 animate-rise">
        <div className="w-16 h-16 rounded-3xl bg-success/15 border border-success/20 text-success flex items-center justify-center mx-auto mb-6 shadow-sm">
          <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          Workspace created!
        </h1>
        <p className="mt-2 text-sm text-ink-2 max-w-sm mx-auto">
          Welcome to Orbat AI, <strong>{name}</strong>. Redirecting you to your inbox…
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl leading-tight font-extrabold tracking-tight text-ink">
          Create your workspace
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Start your 14-day free trial. No credit card required.
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

      {/* 1. Google OAuth Signup */}
      <div className="space-y-4">
        <GoogleButton
          onClick={handleGoogleSignup}
          loading={googleLoading}
          disabled={loading}
          text="Sign up with Google"
        />

        {/* Divider */}
        <div className="relative my-6 text-center text-xs">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line-2" />
          </div>
          <span className="relative bg-canvas px-3 text-ink-3 font-medium select-none">
            or sign up with work email
          </span>
        </div>
      </div>

      {/* 2. Registration Form */}
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="name" className="field-label">
            Full name
          </label>
          <div className="relative">
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input pl-10"
            />
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
          </div>
        </div>

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
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
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

          {/* Password Validation Checklist */}
          <div className="mt-3 p-3 rounded-xl bg-surface-2/60 border border-line text-xs space-y-1.5">
            <div
              className={`flex items-center gap-2 transition-colors ${
                ruleLength ? 'text-success font-medium' : 'text-ink-3'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                  ruleLength ? 'bg-success text-ink-inv' : 'border border-line-2 bg-surface'
                }`}
              >
                {ruleLength && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
              </div>
              <span>At least 8 characters</span>
            </div>

            <div
              className={`flex items-center gap-2 transition-colors ${
                ruleCase ? 'text-success font-medium' : 'text-ink-3'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                  ruleCase ? 'bg-success text-ink-inv' : 'border border-line-2 bg-surface'
                }`}
              >
                {ruleCase && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
              </div>
              <span>Upper and lowercase letters</span>
            </div>

            <div
              className={`flex items-center gap-2 transition-colors ${
                ruleNumberOrSpecial ? 'text-success font-medium' : 'text-ink-3'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                  ruleNumberOrSpecial
                    ? 'bg-success text-ink-inv'
                    : 'border border-line-2 bg-surface'
                }`}
              >
                {ruleNumberOrSpecial && (
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                )}
              </div>
              <span>At least 1 number or special character</span>
            </div>
          </div>
        </div>

        {/* Checkbox with links to Terms and Privacy Policy */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => {
                setAgreedToTerms(e.target.checked);
                if (e.target.checked) setTermsError(false);
              }}
              className={`mt-0.5 w-4 h-4 rounded border ${
                termsError ? 'border-danger ring-1 ring-danger' : 'border-line-2'
              } text-accent focus:ring-accent bg-surface transition-all cursor-pointer`}
            />
            <span className="text-xs text-ink-2 leading-relaxed">
              I agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                className="font-medium text-ink underline underline-offset-4 hover:text-accent transition-colors"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                target="_blank"
                className="font-medium text-ink underline underline-offset-4 hover:text-accent transition-colors"
              >
                Privacy Policy
              </Link>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="btn btn-lg btn-primary w-full !mt-5 shadow-xs hover:shadow-md cursor-pointer"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin-slow" />
              <span>Creating account…</span>
            </>
          ) : (
            <>
              <span>Create account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-5 border-t border-line text-center text-xs text-ink-3">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-accent hover:underline underline-offset-4"
        >
          Sign in &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <AuthShell
      aside={
        <AuthAside
          eyebrow="Instant Deployment"
          headline={
            <>
              Two minutes from
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#818cf8] via-[#a5b4fc] to-white">
                sign-up to live chat.
              </span>
            </>
          }
          points={[
            {
              title: 'Instant Workspace Provisioning',
              body: 'Your brand colors, greetings, and agent seats configured in under 2 minutes.',
            },
            {
              title: 'Single-line Embed Script',
              body: 'Works seamlessly on WordPress, Shopify, Webflow, React, Next.js, and static HTML.',
            },
            {
              title: 'Autonomous AI Copilot',
              body: 'Your assistant starts handling inquiries immediately, learning directly from your content.',
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
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
