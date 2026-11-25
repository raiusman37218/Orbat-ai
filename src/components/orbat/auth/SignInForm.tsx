'use client';

import { MailCheck, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  resendSignupVerificationCodeAction,
  verifySignupCodeAction,
} from '@/app/actions/auth-verification';
import { Alert, Button, Field, Input } from '@/components/orbat/primitives';
import {
  EmailVerificationRequiredError,
  getAuthProviders,
  MfaRequiredError,
  signIn,
  startGoogleSignIn,
  type AuthProviders,
} from '@/lib/data/auth';
import { isValidEmail } from '@/lib/data/auth-rules';
import { errorMessage } from '@/lib/errors/user-error';
import { AuthHeading, OrDivider } from './AuthLayout';
import { GoogleMark, PasswordInput, ProviderButton } from './parts';

const RESEND_COOLDOWN_SECONDS = 60;

export function SignInForm({ redirectTo, initialError }: { redirectTo: string; initialError?: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);

  // Unified 2FA TOTP step when user has MFA enabled on Profile
  const [step, setStep] = useState<'credentials' | 'mfa' | 'verify_email'>('credentials');
  const [totpCode, setTotpCode] = useState('');
  const [mfaTried, setMfaTried] = useState(false);

  // Email OTP verification step if account is unconfirmed
  const [otpCode, setOtpCode] = useState('');
  const [otpTried, setOtpTried] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpNote, setOtpNote] = useState<string | null>(null);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const totpRef = useRef<HTMLInputElement>(null);
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

  const emailError = tried
    ? !email.trim()
      ? 'Enter your work email.'
      : !isValidEmail(email)
        ? 'Enter a full email address, like name@company.com.'
        : null
    : null;
  const passwordError = tried && !password ? 'Enter your password.' : null;
  const cleanTotp = totpCode.replace(/\D/g, '').slice(0, 6);
  const totpError = mfaTried && cleanTotp.length !== 6 ? 'Enter the 6-digit code from your authenticator app.' : null;
  const cleanOtp = otpCode.replace(/\D/g, '').slice(0, 6);
  const otpError = otpTried && cleanOtp.length !== 6 ? 'Enter the 6-digit email verification code.' : null;

  const attemptCredentialSignIn = async (mfaToken?: string) => {
    await signIn(email.trim(), password, mfaToken);
    window.location.assign(redirectTo);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (!email.trim() || !isValidEmail(email)) return emailRef.current?.focus();
    if (!password) return passwordRef.current?.focus();
    setLoading(true);
    try {
      await attemptCredentialSignIn();
    } catch (err) {
      if (err instanceof MfaRequiredError) {
        setStep('mfa');
        setTotpCode('');
        setMfaTried(false);
        setLoading(false);
        return;
      }
      if (err instanceof EmailVerificationRequiredError) {
        setStep('verify_email');
        setOtpCode('');
        setOtpTried(false);
        setOtpNote('Your email address is not verified yet. Enter the 6-digit code from your inbox or request a fresh one.');
        setLoading(false);
        return;
      }
      setError(errorMessage(err, 'Invalid email or password.'));
      setLoading(false);
    }
  };

  const onSubmitMfa = async (e: FormEvent) => {
    e.preventDefault();
    setMfaTried(true);
    setError(null);
    if (cleanTotp.length !== 6) return totpRef.current?.focus();

    setLoading(true);
    try {
      await attemptCredentialSignIn(cleanTotp);
    } catch (err) {
      setError(errorMessage(err, 'Invalid authenticator code.'));
      setLoading(false);
    }
  };

  const onSubmitVerifyEmail = async (e: FormEvent) => {
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
      await attemptCredentialSignIn();
    } catch (err) {
      if (err instanceof MfaRequiredError) {
        setStep('mfa');
        setTotpCode('');
        setMfaTried(false);
        setLoading(false);
        return;
      }
      setError(errorMessage(err, 'Could not complete sign in.'));
      setLoading(false);
    }
  };

  const onResendVerificationCode = async () => {
    if (resendCooldown > 0 || resending || loading) return;
    setResending(true);
    setError(null);
    try {
      const res = await resendSignupVerificationCodeAction({ email: email.trim() });
      if (res.success || res.code) {
        setDevCodeHint(res.code ?? null);
        setOtpNote(
          res.code
            ? 'SMTP is unconfigured locally; enter the dev code below.'
            : `Sent a new 6-digit verification code to ${email.trim()}.`,
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
      await startGoogleSignIn({ mode: 'login', next: redirectTo });
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t reach Google. Try again.'));
      setGoogleLoading(false);
    }
  };

  if (step === 'mfa') {
    return (
      <>
        <div className="flex items-center gap-2 text-o-accent-text">
          <ShieldCheck size={20} aria-hidden="true" />
          <span className="text-[12.5px] font-semibold uppercase tracking-wide">Two-factor authentication</span>
        </div>
        <AuthHeading
          title="Enter authenticator code"
          body={
            <>
              Open your authenticator app for <b className="text-o-text">{email.trim()}</b> and enter the 6-digit code.
            </>
          }
        />

        <form onSubmit={onSubmitMfa} noValidate className="flex flex-col gap-4">
          {error ? <Alert tone="bad">{error}</Alert> : null}

          <Field label="6-digit authenticator code" error={totpError}>
            <Input
              ref={totpRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="o-mono text-center text-[18px] tracking-[0.32em]"
            />
          </Field>

          <Button type="submit" size="lg" loading={loading} className="w-full">
            {loading ? 'Verifying…' : 'Verify & sign in'}
          </Button>

          <button
            type="button"
            onClick={() => {
              setStep('credentials');
              setTotpCode('');
              setError(null);
              setMfaTried(false);
            }}
            className="self-center text-[13.5px] font-medium text-o-text-2 hover:text-o-text"
          >
            ← Use a different account
          </button>
        </form>
      </>
    );
  }

  if (step === 'verify_email') {
    return (
      <>
        <div className="flex items-center gap-2 text-o-accent-text">
          <MailCheck size={20} aria-hidden="true" />
          <span className="text-[12.5px] font-semibold uppercase tracking-wide">Email verification required</span>
        </div>
        <AuthHeading
          title="Confirm your email"
          body={
            <>
              Enter the 6-digit verification code for <b className="text-o-text">{email.trim()}</b> to finish signing in.
            </>
          }
        />

        <form onSubmit={onSubmitVerifyEmail} noValidate className="flex flex-col gap-4">
          {otpNote ? <Alert tone="ok">{otpNote}</Alert> : null}
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
            {loading ? 'Verifying…' : 'Verify & sign in'}
          </Button>

          <div className="flex items-center justify-between gap-3 pt-1 text-[13.5px]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={resending}
              disabled={resendCooldown > 0 || loading}
              onClick={() => void onResendVerificationCode()}
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep('credentials');
                setError(null);
              }}
              className="font-medium text-o-text-2 hover:text-o-text"
            >
              ← Back
            </button>
          </div>
        </form>
      </>
    );
  }

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
            <Link href="/forgot" className="text-[13.5px] font-medium text-o-accent-text hover:underline">
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

        <Link href="/sso" className="self-center text-[13.5px] font-medium text-o-text-2 hover:text-o-text">
          Use single sign-on (SAML)
        </Link>
      </form>
    </>
  );
}
