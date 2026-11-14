'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonVariant } from './Button';

/* Built on the native <dialog> element: showModal() gives the top layer, a
   focus trap, Escape to close and inert background for free, and focus goes
   back to the opener when it closes. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cn('o-dialog', wide && 'o-dialog--wide', className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? (
        <>
          <div className="o-dialog__head">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="o-dialog__title" style={{ fontFamily: 'inherit' }}>
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-[14px] text-o-text-2">
                  {description}
                </p>
              ) : null}
            </div>
            <Button variant="quiet" size="sm" icon aria-label="Close" onClick={onClose}>
              <X size={18} aria-hidden="true" />
            </Button>
          </div>
          {children ? <div className="o-dialog__body">{children}</div> : null}
          {footer ? <div className="o-dialog__foot">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}

/* The destructive confirmation from the design system ("Delete 3 tickets?"). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'danger',
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={body}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
