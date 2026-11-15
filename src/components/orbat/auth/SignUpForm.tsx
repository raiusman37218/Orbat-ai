'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, ButtonLink, Field, Input } from '@/components/orbat/primitives';
import { getAuthProviders, signUp, startGoogleSignIn, type AuthProviders } from '@/lib/data/auth';
import { isValidEmail } from '@/lib/data/auth-rules';
import { errorMessage } from '@/lib/errors/user-error';
import { AuthHeading, OrDivider } from './AuthLayout';
import { GoogleMark, PasswordInput, PasswordStrength, ProviderButton } from './parts';

const MIN_PASSWORD = 10;

export function SignUpForm({ initialError }: { initialError?: string | null }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [done, setDone] = useState(false);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    getAuthProviders().then((p) => {
      if (live) setProviders(p);
    });
    return () => {
      live = false;
    };
  }, []);

  const nameError = tried && name.trim().length < 2 ? 'Enter your full name.' : null;
  const emailError = tried
    ? !email.trim()
      ? 'Enter your work email.'
      : !isValidEmail(email)
        ? 'Enter a full email address, like name@company.com.'
        : null
    : null;
  const passwordError =
    tried && password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : null;
  const termsError = tried && !terms;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (name.trim().length < 2) return nameRef.current?.focus();
    if (!isValidEmail(email)) return emailRef.current?.focus();
    if (password.length < MIN_PASSWORD) return passwordRef.current?.focus();
    if (!terms) return termsRef.current?.focus();
    setLoading(true);
    try {
      await signUp({ name: name.trim(), company: company.trim(), email: email.trim(), password });
      setDone(true);
      window.location.assign('/app');
    } catch (err) {
      setError(errorMessage(err, 'We couldn’t create your workspace. Please try again.'));
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await startGoogleSignIn({ mode: 'signup', next: '/app' });
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t reach Google. Try again.'));
      setGoogleLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-o-ok-soft text-o-ok" aria-hidden="true">
          <Check size={24} strokeWidth={2.2} />
        </span>
        <AuthHeading
          title="Your workspace is ready"
          body={`Welcome to ORBAT${name ? `, ${name.split(' ')[0]}` : ''}. Next, set up your business profile and your first AI agent.`}
        />
        <ButtonLink href="/app" size="lg" className="w-full">
          Go to your workspace →
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Create your workspace" body="Start your free trial. No credit card needed." />

      {providers?.google ? (
        <>
          <ProviderButton onClick={onGoogle} loading={googleLoading} disabled={loading}>
            <GoogleMark />
            Sign up with Google
          </ProviderButton>
          <OrDivider label="or with email" />
        </>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="bad">{error}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" error={nameError}>
            <Input
              ref={nameRef}
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Company">
            <Input
              autoComplete="organization"
              placeholder="Company name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Work email" error={emailError}>
          <Input
            ref={emailRef}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <div className="o-field">
          <label htmlFor="signup-password" className="o-label">
            Password
          </label>
          <PasswordInput
            ref={passwordRef}
            id="signup-password"
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? 'signup-password-error' : 'signup-password-strength'}
          />
          {passwordError ? (
            <span id="signup-password-error" className="o-error" role="alert">
              {passwordError}
            </span>
          ) : null}
          <PasswordStrength password={password} id="signup-password-strength" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-2.5 text-[14px] text-o-text-2">
            <input
              ref={termsRef}
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              aria-invalid={termsError || undefined}
              aria-describedby={termsError ? 'signup-terms-error' : undefined}
              className="mt-0.5 h-4 w-4 flex-none accent-[var(--forest)]"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="font-medium text-o-accent-text hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-medium text-o-accent-text hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {termsError ? (
            <span id="signup-terms-error" className="o-error" role="alert">
              Please accept the terms to continue.
            </span>
          ) : null}
        </div>

        <Button type="submit" size="lg" loading={loading} disabled={googleLoading} className="mt-1 w-full">
          {loading ? 'Creating workspace…' : 'Create workspace'}
        </Button>
      </form>
    </>
  );
}
