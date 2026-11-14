'use client';

import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

type ControlSize = 'sm' | 'md' | 'lg';

/* The label, hint and error are wired to the control here (id, aria-describedby,
   aria-invalid) so no screen has to remember to do it. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })
    : children;

  return (
    <div className={cn('o-field', className)}>
      <label className="o-label" htmlFor={children.props.id ?? id}>
        {label}
      </label>
      {control}
      {error ? (
        <span id={errorId} className="o-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="o-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: ControlSize }
>(function Input({ size = 'md', className, ...rest }, ref) {
  return <input ref={ref} className={cn('o-input', size !== 'md' && `o-input--${size}`, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn('o-textarea', className)} {...rest} />;
  },
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export const Select = forwardRef<
  HTMLSelectElement,
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
    size?: ControlSize;
    options?: SelectOption[];
    placeholder?: string;
  }
>(function Select({ size = 'md', options, placeholder, className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn('o-select', size !== 'md' && `o-select--${size}`, className)} {...rest}>
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options?.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );
});
