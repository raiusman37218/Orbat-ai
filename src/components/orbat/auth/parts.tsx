'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/orbat/primitives';
import { passwordScore } from '@/lib/data/auth-rules';

/* Password field with a Show / Hide toggle (Auth.dc.html). */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>>(
  function PasswordInput({ className, ...rest }, ref) {
    const [show, setShow] = useState(false);
    return (
      <span className="relative block">
        <Input ref={ref} type={show ? 'text' : 'password'} className={cn('pr-[72px]', className)} {...rest} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute right-1.5 top-1.5 h-8 rounded-full px-3 text-[13px] font-medium text-o-text-2 hover:bg-o-surface-2 hover:text-o-text"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </span>
    );
  },
);

const LABELS = ['Use 10+ characters with letters, numbers and a symbol', 'Weak', 'Fair', 'Good', 'Strong'];
const BAR = ['', 'bg-o-bad', 'bg-o-warn', 'bg-o-accent-text', 'bg-o-ok'];
const TEXT = ['text-o-text-3', 'text-o-bad', 'text-o-warn', 'text-o-accent-text', 'text-o-ok'];

export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  const score = passwordScore(password);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full', i <= score ? BAR[score] : 'bg-o-border')} />
        ))}
      </span>
      <span id={id} className={cn('text-[12.5px]', password ? TEXT[score] : 'text-o-text-3')} aria-live="polite">
        {password ? `Strength: ${LABELS[score]}` : LABELS[0]}
      </span>
    </div>
  );
}

/* "Continue with Google" style button (secondary, full width). */
export function ProviderButton({
  children,
  onClick,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className="o-btn o-btn--secondary h-11 w-full font-medium disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <span className="o-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
