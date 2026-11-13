'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Monitor } from 'lucide-react';
import { saveAuthSession } from '@/lib/api/backend-auth';
import { getAuditLogAction, type AuditEntry } from '@/app/actions/settings';
import { describeAuditEntry } from '@/lib/settings/validation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ErrorState } from '@/components/ui/States';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { FormSkeleton, SettingsCard } from './parts';
import { errorMessage } from '@/lib/errors/user-error';

function formatWhen(iso?: string | null) {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Settings → Security → Sessions. */
export function SessionsPanel() {
  const toast = useToast();
  const [info, setInfo] = useState<{ email: string | null; lastSignIn: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    fetch('/api/auth/sessions', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || 'You are not signed in.');
        return json;
      })
      .then((data) => {
        if (!live) return;
        setInfo({ email: data?.email ?? null, lastSignIn: data?.lastSignIn ?? null });
      })
      .catch((err) => {
        if (!live) return;
        setError(errorMessage(err, 'You are not signed in.'));
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  async function signOutOthers() {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'others' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Could not sign out other sessions.');
      if (json?.accessToken) saveAuthSession(json);
      toast.success('Signed out everywhere else.');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not sign out other sessions.'));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load your session"
        message={error}
        onRetry={() => {
          setError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (!info) return <FormSkeleton rows={2} />;

  return (
    <div className="space-y-6">
      <SettingsCard title="This device" description="The session you are using right now.">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-ink-2">
            <Monitor className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-ui font-medium text-ink truncate">{info.email}</div>
            <div className="text-xs text-ink-3">Signed in {formatWhen(info.lastSignIn)}</div>
          </div>
          <Badge tone="success" dot>
            Current
          </Badge>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Other sessions"
        description="Sign out every other browser and device. You will stay signed in here. Use this if you lost a device or used a shared computer."
      >
        <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
          Sign out other sessions
        </Button>
      </SettingsCard>

      {confirm && (
        <Modal
          title="Sign out other sessions?"
          description="Anyone using your account on another device will have to sign in again."
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button variant="danger" loading={busy} onClick={signOutOthers}>
                Sign out others
              </Button>
            </>
          }
        >
          <p className="text-ui text-ink-2">This cannot be undone, but you can sign in again at any time.</p>
        </Modal>
      )}
    </div>
  );
}

interface Enrollment {
  factorId: string;
  qr: string;
  secret: string;
}

/** Settings → Security → Two-factor authentication (an authenticator app, TOTP). */
export function TwoFactorPanel() {
  const toast = useToast();
  const [factors, setFactors] = useState<{ id: string; status: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);
  const reload = () => setAttempt((n) => n + 1);

  useEffect(() => {
    let live = true;
    fetch('/api/auth/mfa', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || 'Could not load two-factor settings');
        return json;
      })
      .then((data) => {
        if (!live) return;
        setFactors((data?.factors ?? []).map((f: { id: string; status: string }) => ({ id: f.id, status: f.status })));
      })
      .catch((err) => {
        if (!live) return;
        setError(errorMessage(err, 'Could not load two-factor settings'));
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  async function start() {
    setBusy(true);
    setCodeError(null);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enroll' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.totp) {
        toast.error(data?.error || 'Could not start two-factor setup.');
        return;
      }
      setEnrolling({ factorId: data.id || 'totp', qr: data.totp.qr_code, secret: data.totp.secret });
      setCode('');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not start two-factor setup.'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    if (!/^\d{6}$/.test(code)) return setCodeError('Enter the 6-digit code from your app.');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCodeError(data?.error || 'That code did not match. Try the next one.');
        return;
      }
      setEnrolling(null);
      toast.success('Two-factor authentication is on.');
      reload();
    } catch (err) {
      setCodeError(errorMessage(err, 'That code did not match. Try the next one.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(_id: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa', { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Could not turn off two-factor. Sign in again and retry.');
        return;
      }
      toast.success('Two-factor authentication is off.');
      reload();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not turn off two-factor. Sign in again and retry.'));
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load two-factor settings"
        message={error}
        onRetry={() => {
          setError(null);
          reload();
        }}
      />
    );
  }
  if (!factors) return <FormSkeleton rows={2} />;

  const active = factors.find((f) => f.status === 'verified');

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Authenticator app"
        description="After your password, you enter a 6-digit code from an app such as Google Authenticator, 1Password or Authy."
      >
        <div className="flex flex-wrap items-center gap-3">
          <ShieldCheck className={active ? 'w-5 h-5 text-success' : 'w-5 h-5 text-ink-3'} aria-hidden="true" />
          <span className="text-ui font-medium text-ink flex-1">{active ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}</span>
          <Badge tone={active ? 'success' : 'neutral'}>{active ? 'On' : 'Off'}</Badge>
          {active ? (
            <Button variant="danger" size="sm" onClick={() => setRemoving(active.id)}>
              Turn off
            </Button>
          ) : (
            <Button variant="primary" size="sm" loading={busy && !enrolling} onClick={start}>
              Set up
            </Button>
          )}
        </div>
      </SettingsCard>

      {enrolling && (
        <Modal title="Set up two-factor authentication" description="Scan the code with your authenticator app, then enter the code it shows." onClose={() => setEnrolling(null)}>
          <form onSubmit={verify} className="space-y-4">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrolling.qr} alt="QR code for your authenticator app" className="w-44 h-44 rounded-lg bg-white p-2 border border-line" />
            </div>
            <p className="text-xs text-ink-3 text-center">
              Can’t scan? Enter this key instead: <code className="font-mono text-ink break-all">{enrolling.secret}</code>
            </p>
            <Field label="6-digit code" error={codeError}>
              <Input inputSize="md" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} data-autofocus />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEnrolling(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={busy}>
                Verify and turn on
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {removing && (
        <Modal
          title="Turn off two-factor authentication?"
          description="Your account will be protected by your password alone."
          onClose={() => setRemoving(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                Keep it on
              </Button>
              <Button variant="danger" loading={busy} onClick={() => remove(removing)}>
                Turn off
              </Button>
            </>
          }
        >
          <p className="text-ui text-ink-2">You can set it up again at any time.</p>
        </Modal>
      )}
    </div>
  );
}

/** Settings → Security → Audit log. Owners and admins. */
export function AuditLogPanel({ workspaceId }: { workspaceId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [attempt, setAttempt] = useState(0);

  const apply = useCallback((res: Awaited<ReturnType<typeof getAuditLogAction>>, append: boolean) => {
    if (!res.success) return setError(res.error);
    setEntries((prev) => (append && prev ? [...prev, ...res.entries] : res.entries));
    setHasMore(res.hasMore);
  }, []);

  useEffect(() => {
    let live = true;
    getAuditLogAction(workspaceId)
      .then((res) => live && apply(res, false))
      .catch((e) => live && setError(errorMessage(e) || 'Could not load the audit log.'));
    return () => {
      live = false;
    };
  }, [workspaceId, attempt, apply]);

  if (error) {
    return (
      <ErrorState title="Could not load the audit log" message={error} onRetry={() => {
          setError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (!entries) return <FormSkeleton rows={4} />;
  if (entries.length === 0) {
    return (
      <EmptyState
        type="custom"
        title="No changes recorded yet"
        description="When someone changes workspace settings or a teammate’s role, it shows up here with who did it and when."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ul className="card divide-y divide-line">
        {entries.map((e) => (
          <li key={e.id} className="px-4 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-ui text-ink flex-1 min-w-[12rem]">{describeAuditEntry(e)}</span>
            <span className="text-xs text-ink-2">{e.actor_name || 'Someone'}</span>
            <time className="text-xs text-ink-3" dateTime={e.created_at}>
              {formatWhen(e.created_at)}
            </time>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button
          size="sm"
          loading={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            try {
              apply(await getAuditLogAction(workspaceId, entries[entries.length - 1].created_at), true);
            } catch (e) {
              setError(errorMessage(e) || 'Could not load older entries.');
            }
            setLoadingMore(false);
          }}
        >
          Load older entries
        </Button>
      )}
    </div>
  );
}
