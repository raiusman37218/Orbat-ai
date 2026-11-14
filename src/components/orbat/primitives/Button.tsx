'use client';

import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'ai' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square, icon-only button. Pass `aria-label`. */
  icon?: boolean;
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function buttonClass({
  variant = 'primary',
  size = 'md',
  icon = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
  className?: string;
}) {
  return cn(
    'o-btn',
    `o-btn--${variant}`,
    size !== 'md' && `o-btn--${size}`,
    icon && 'o-btn--icon',
    className,
  );
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, loading, leading, trailing, className, children, disabled, type, onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={buttonClass({ variant, size, icon, className })}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      {...rest}
    >
      {loading ? <span className="o-spinner" aria-hidden="true" /> : leading}
      {children}
      {!loading && trailing}
    </button>
  );
});

export type ButtonLinkProps = Omit<CommonProps, 'loading'> & ComponentProps<typeof Link>;

/** A link that looks like a button (navigation, not an action). */
export function ButtonLink({ variant, size, icon, leading, trailing, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, icon, className })} {...rest}>
      {leading}
      {children}
      {trailing}
    </Link>
  );
}
