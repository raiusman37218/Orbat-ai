'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input } from '@/components/orbat/primitives';
import { requestPasswordReset, startSso } from '@/lib/data/auth';
import { isValidEmail } from '@/lib/data/auth-rules';
import { errorMessage } from '@/lib/errors/user-error';
import { AuthHeading } from './AuthLayout';

function BackToSignIn() {
  return (
    <Link href="/login" className="self-center text-[14px] text-o-text-2 hover:text-o-text">
      ← Back to sign in
    </Link>
  );
}

/* Auth.dc.html "Reset your password". The backend has no reset flow yet, so
   requestPasswordReset() reports that instead of pretending an email went out. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const emailError = tried
    ? !email.trim()
      ? 'Enter your work email.'
      : !isValidEmail(email)
        ? 'Enter a full email address, like name@company.com.'
        : null
    : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (!isValidEmail(email)) return ref.current?.focus();
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'We couldn’t send the reset link. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <AuthHeading
          title="Check your inbox"
          body={
            <>
              If an account exists for <b className="text-o-text">{email}</b>, a reset link is on its way.
            </>
          }
        />
        <BackToSignIn />
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Reset your password" body="We’ll email you a secure link to choose a new password." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="warn">{error}</Alert> : null}
        <Field label="Work email" error={emailError}>
          <Input
            ref={ref}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Send reset link
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
