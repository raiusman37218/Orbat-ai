'use client';

import { Check, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  resendSignupVerificationCodeAction,
  sendSignupVerificationCodeAction,
  verifySignupCodeAction,
} from '@/app/actions/auth-verification';
import { Alert, Button, ButtonLink, Field, Input } from '@/components/orbat/primitives';
import { getAuthProviders, signUp, startGoogleSignIn, type AuthProviders } from '@/lib/data/auth';
import { isValidEmail } from '@/lib/data/auth-rules';
import { errorMessage } from '@/lib/errors/user-error';
import { AuthHeading, OrDivider } from './AuthLayout';
import { GoogleMark, PasswordInput, PasswordStrength, ProviderButton } from './parts';

const MIN_PASSWORD = 10;
const RESEND_COOLDOWN_SECONDS = 60;

export function SignUpForm({
  initialError,
  requireEmailVerification = false,
}: {
  initialError?: string | null;
  requireEmailVerification?: boolean;
}) {
  const router = useRouter();
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

  // Email OTP step state (active when requireEmailVerification is enabled)
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpTried, setOtpTried] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [infoNote, setInfoNote] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    getAuthProviders().then((p) => {
      if (live) setProviders(p);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

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
  const cleanOtp = otpCode.replace(/\D/g, '').slice(0, 6);
  const otpError = otpTried && cleanOtp.length !== 6 ? 'Enter the 6-digit verification code.' : null;

  const finishWorkspaceRegistration = async () => {
    await signUp({
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      password,
    });
    setDone(true);
    router.push('/app');
    router.refresh();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError(null);
    setInfoNote(null);
    if (name.trim().length < 2) return nameRef.current?.focus();
    if (!isValidEmail(email)) return emailRef.current?.focus();
    if (password.length < MIN_PASSWORD) return passwordRef.current?.focus();
    if (!terms) return termsRef.current?.focus();

    setLoading(true);
    try {
      if (requireEmailVerification) {
        const res = await sendSignupVerificationCodeAction({
          email: email.trim(),
          name: name.trim(),
          password,
        });

        if (res.success || res.code) {
          setDevCodeHint(res.code ?? null);
          setInfoNote(
            res.code
              ? 'SMTP email delivery is not configured in local dev mode. Enter the dev verification code below.'
              : `We sent a 6-digit verification code to ${email.trim()}.`,
          );
          setStep('otp');
          setOtpCode('');
          setOtpTried(false);
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
          setLoading(false);
          return;
        }

        setError(res.error || 'Could not send verification email. Please try again.');
        setLoading(false);
        return;
      }

      await finishWorkspaceRegistration();
    } catch (err) {
      setError(errorMessage(err, 'We couldn’t create your workspace. Please try again.'));
      setLoading(false);
    }
  };

  const onVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setOtpTried(true);
    setError(null);
    if (cleanOtp.length !== 6) return otpRef.current?.focus();

    setLoading(true);
    try {
      const verifyRes = await verifySignupCodeAction({
        email: email.trim(),
        code: cleanOtp,
      });
      if (!verifyRes.success) {
        setError(verifyRes.error || 'Invalid or expired verification code.');
        setLoading(false);
        return;
      }
      await finishWorkspaceRegistration();
    } catch (err) {
      setError(errorMessage(err, 'Verification succeeded, but workspace setup failed. Try signing in.'));
      setLoading(false);
    }
  };

  const onResendOtp = async () => {
    if (resendCooldown > 0 || resending || loading) return;
    setResending(true);
    setError(null);
    try {
      const res = await resendSignupVerificationCodeAction({
        email: email.trim(),
        name: name.trim(),
      });
      if (res.success || res.code) {
        setDevCodeHint(res.code ?? null);
        setInfoNote(
          res.code
            ? 'SMTP is unconfigured locally; a fresh dev code was generated below.'
            : `Sent a new 6-digit code to ${email.trim()}.`,
        );
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setError(res.error || 'Could not resend verification code.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not resend verification code.'));
    } finally {
      setResending(false);
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

  if (step === 'otp') {
    return (
      <>
        <div className="flex items-center gap-2.5 text-o-accent-text">
          <MailCheck size={22} aria-hidden="true" />
          <span className="text-[12.5px] font-semibold uppercase tracking-wide">Email verification</span>
        </div>
        <AuthHeading
          title="Verify your email"
          body={
            <>
              Enter the 6-digit verification code sent to <b className="text-o-text">{email.trim()}</b>.
            </>
          }
        />

        <form onSubmit={onVerifyOtp} noValidate className="flex flex-col gap-4">
          {infoNote ? <Alert tone="ok">{infoNote}</Alert> : null}
          {devCodeHint ? (
            <Alert tone="warn">
              Dev verification code: <code className="o-mono font-bold tracking-[0.2em]">{devCodeHint}</code>
            </Alert>
          ) : null}
          {error ? <Alert tone="bad">{error}</Alert> : null}

          <Field label="6-digit verification code" error={otpError}>
            <Input
              ref={otpRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="o-mono text-center text-[18px] tracking-[0.32em]"
            />
          </Field>

          <Button type="submit" size="lg" loading={loading} className="w-full">
            {loading ? 'Verifying & creating workspace…' : 'Verify & create workspace'}
          </Button>

          <div className="flex items-center justify-between gap-3 pt-1 text-[13.5px]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={resending}
              disabled={resendCooldown > 0 || loading}
              onClick={() => void onResendOtp()}
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep('form');
                setError(null);
                setInfoNote(null);
                setDevCodeHint(null);
              }}
              className="font-medium text-o-text-2 hover:text-o-text"
            >
              ← Edit details
            </button>
          </div>
        </form>
      </>
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
          {loading
            ? requireEmailVerification
              ? 'Sending code…'
              : 'Creating workspace…'
            : requireEmailVerification
              ? 'Continue with email'
              : 'Create workspace'}
        </Button>
      </form>
    </>
  );
}
