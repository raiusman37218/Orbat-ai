'use client';

import { Check, CircleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'ok' | 'bad' | 'info';

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  /** e.g. { label: 'Undo', onClick } */
  action?: { label: string; onClick: () => void };
  /** ms; errors stay until dismissed. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastApi {
  show: (t: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/* Separate from the old app's ToastProvider (root layout) on purpose: this one
   renders inside `.orb`, so it picks up the new tokens. */
export function OrbToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((all) => [...all.slice(-2), { ...t, id }]);
      const duration = t.duration ?? (t.tone === 'bad' ? 0 : 5000);
      if (duration > 0) window.setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="o-toasts" role="region" aria-label="Status messages">
        {items.map((t) => (
          <div key={t.id} className="o-toast" role={t.tone === 'bad' ? 'alert' : 'status'}>
            {t.tone === 'ok' ? (
              <Check size={16} className="o-toast__icon--ok" aria-hidden="true" />
            ) : t.tone === 'bad' ? (
              <CircleAlert size={16} className="o-toast__icon--bad" aria-hidden="true" />
            ) : null}
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="o-toast__action"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button type="button" className="o-toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useOrbToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useOrbToast must be used inside OrbToastProvider');
  return ctx;
}
