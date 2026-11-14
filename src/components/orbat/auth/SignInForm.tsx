'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input } from '@/components/orbat/primitives';
import { getAuthProviders, signIn, startGoogleSignIn, type AuthProviders } from '@/lib/data/auth';
import { isValidEmail } from '@/lib/data/auth-rules';
import { errorMessage } from '@/lib/errors/user-error';
import { AuthHeading, OrDivider } from './AuthLayout';
import { GoogleMark, PasswordInput, ProviderButton } from './parts';

export function SignInForm({ redirectTo, initialError }: { redirectTo: string; initialError?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    getAuthProviders().then((p) => {
      if (live) setProviders(p);
    });
    return () => {
      live = false;
    };
  }, []);

  const emailError = tried
    ? !email.trim()
      ? 'Enter your work email.'
      : !isValidEmail(email)
        ? 'Enter a full email address, like name@company.com.'
        : null
    : null;
  const passwordError = tried && !password ? 'Enter your password.' : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (!email.trim() || !isValidEmail(email)) return emailRef.current?.focus();
    if (!password) return passwordRef.current?.focus();
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, 'Invalid email or password.'));
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await startGoogleSignIn();
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t reach Google. Try again.'));
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <AuthHeading title="Sign in to ORBAT" body="Welcome back. Use your work account." />

      {providers?.google ? (
        <>
          <ProviderButton onClick={onGoogle} loading={googleLoading} disabled={loading}>
            <GoogleMark />
            Continue with Google
          </ProviderButton>
          <OrDivider />
        </>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="bad">{error}</Alert> : null}

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
          <div className="flex items-center justify-between">
            <label htmlFor="signin-password" className="o-label">
              Password
            </label>
            <Link href="/v2/forgot" className="text-[13.5px] font-medium text-o-accent-text hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            ref={passwordRef}
            id="signin-password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? 'signin-password-error' : undefined}
          />
          {passwordError ? (
            <span id="signin-password-error" className="o-error" role="alert">
              {passwordError}
            </span>
          ) : null}
        </div>

        <Button type="submit" size="lg" loading={loading} disabled={googleLoading} className="mt-1 w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>

        <Link href="/v2/sso" className="self-center text-[13.5px] font-medium text-o-text-2 hover:text-o-text">
          Use single sign-on (SAML)
        </Link>
      </form>
    </>
  );
}
