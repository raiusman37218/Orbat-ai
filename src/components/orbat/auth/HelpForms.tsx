'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { Alert, Button, ButtonLink, Field, Input } from '@/components/orbat/primitives';
import { completePasswordReset, requestPasswordReset, startSso } from '@/lib/data/auth';
import { isValidEmail } from '@/lib/data/auth-rules';
import { errorMessage } from '@/lib/errors/user-error';
import { AuthHeading } from './AuthLayout';
import { PasswordInput, PasswordStrength } from './parts';

const MIN_RESET_PASSWORD = 8;

function BackToSignIn() {
  return (
    <Link href="/login" className="self-center text-[14px] text-o-text-2 hover:text-o-text">
      ← Back to sign in
    </Link>
  );
}

/* Auth.dc.html "Reset your password": step 1 requests a 30-minute single-use link,
   and step 2 (via ?token=...) sets a new bcrypt-hashed password. */
export function ForgotPasswordForm({ initialToken = null }: { initialToken?: string | null }) {
  const [activeToken, setActiveToken] = useState<string | null>(initialToken?.trim() || null);
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetTried, setResetTried] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const emailError = tried
    ? !email.trim()
      ? 'Enter your work email.'
      : !isValidEmail(email)
        ? 'Enter a full email address, like name@company.com.'
        : null
    : null;

  const passwordError =
    resetTried && newPassword.length < MIN_RESET_PASSWORD
      ? `Use at least ${MIN_RESET_PASSWORD} characters.`
      : null;

  const confirmError =
    resetTried && confirmPassword !== newPassword ? 'Passwords do not match.' : null;

  const onRequestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (!isValidEmail(email)) return emailRef.current?.focus();
    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim());
      setSentMessage(res.message);
      setDevResetUrl(res.devResetUrl ?? null);
    } catch (err) {
      setError(errorMessage(err, 'We couldn’t send the reset link. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const onCompleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResetTried(true);
    setError(null);
    if (newPassword.length < MIN_RESET_PASSWORD) return passwordRef.current?.focus();
    if (confirmPassword !== newPassword) return confirmRef.current?.focus();
    if (!activeToken) {
      setError('Password reset link is missing a valid token.');
      return;
    }

    setLoading(true);
    try {
      await completePasswordReset(activeToken, newPassword);
      setResetDone(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not reset password. The link may have expired.'));
    } finally {
      setLoading(false);
    }
  };

  if (resetDone) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-o-ok-soft text-o-ok" aria-hidden="true">
          <Check size={24} strokeWidth={2.2} />
        </span>
        <AuthHeading
          title="Password updated"
          body="Your password has been changed and previous sessions were signed out. Sign in with your new password."
        />
        <ButtonLink href="/login" size="lg" className="w-full">
          Sign in →
        </ButtonLink>
      </div>
    );
  }

  if (activeToken) {
    return (
      <>
        <AuthHeading
          title="Choose a new password"
          body="Enter a strong new password for your ORBAT account. This single-use link expires after 30 minutes."
        />
        <form onSubmit={onCompleteSubmit} noValidate className="flex flex-col gap-4">
          {error ? <Alert tone="bad">{error}</Alert> : null}

          <div className="o-field">
            <label htmlFor="reset-new-password" className="o-label">
              New password
            </label>
            <PasswordInput
              ref={passwordRef}
              id="reset-new-password"
              autoComplete="new-password"
              placeholder={`At least ${MIN_RESET_PASSWORD} characters`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? 'reset-password-error' : 'reset-password-strength'}
            />
            {passwordError ? (
              <span id="reset-password-error" className="o-error" role="alert">
                {passwordError}
              </span>
            ) : null}
            <PasswordStrength password={newPassword} id="reset-password-strength" />
          </div>

          <div className="o-field">
            <label htmlFor="reset-confirm-password" className="o-label">
              Confirm new password
            </label>
            <PasswordInput
              ref={confirmRef}
              id="reset-confirm-password"
              autoComplete="new-password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={confirmError ? true : undefined}
              aria-describedby={confirmError ? 'reset-confirm-error' : undefined}
            />
            {confirmError ? (
              <span id="reset-confirm-error" className="o-error" role="alert">
                {confirmError}
              </span>
            ) : null}
          </div>

          <Button type="submit" size="lg" loading={loading} className="w-full">
            {loading ? 'Updating password…' : 'Update password'}
          </Button>

          <button
            type="button"
            onClick={() => {
              setActiveToken(null);
              setError(null);
              setResetTried(false);
              setNewPassword('');
              setConfirmPassword('');
            }}
            className="self-center text-[13.5px] font-medium text-o-text-2 hover:text-o-text"
          >
            Request a new reset link
          </button>
          <BackToSignIn />
        </form>
      </>
    );
  }

  if (sentMessage) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <AuthHeading
          title={devResetUrl ? 'Development reset link ready' : 'Check your inbox'}
          body={
            devResetUrl ? (
              sentMessage
            ) : (
              <>
                If an account exists for <b className="text-o-text">{email}</b>, a single-use reset link is on its way
                (expires in 30 minutes).
              </>
            )
          }
        />
        {devResetUrl ? (
          <Alert tone="warn">
            Local dev preview (SMTP disabled): use this one-time link to verify your reset flow:
            <div className="mt-2 break-all text-[12.5px]">
              <ButtonLink href={devResetUrl} size="sm" variant="primary" className="mt-1 w-full">
                Open reset password page →
              </ButtonLink>
            </div>
          </Alert>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setSentMessage(null);
            setDevResetUrl(null);
            setTried(false);
          }}
          className="self-center text-[13.5px] font-medium text-o-text-2 hover:text-o-text"
        >
          Try another email address
        </button>
        <BackToSignIn />
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Reset your password" body="We’ll email you a secure single-use link valid for 30 minutes." />
      <form onSubmit={onRequestSubmit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="warn">{error}</Alert> : null}
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
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? 'Sending reset link…' : 'Send reset link'}
        </Button>
        <BackToSignIn />
      </form>
    </>
  );
}

/* Auth.dc.html "Single sign-on". No SAML backend yet; startSso() says so. */
export function SsoForm() {
  const [workspace, setWorkspace] = useState('');
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (!workspace.trim()) return;
    setLoading(true);
    try {
      await startSso(workspace.trim());
    } catch (err) {
      setError(errorMessage(err, 'Single sign-on failed. Try again.'));
      setLoading(false);
    }
  };

  return (
    <>
      <AuthHeading title="Single sign-on" body="Enter your company’s workspace address." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="warn">{error}</Alert> : null}
        <Field label="Workspace" error={tried && !workspace.trim() ? 'Enter your workspace address.' : null}>
          <Input
            autoComplete="organization"
            placeholder="acme"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value.replace(/\s+/g, '').toLowerCase())}
          />
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Continue
        </Button>
        <BackToSignIn />
      </form>
    </>
  );
}
