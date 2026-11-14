'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Globe,
  KeyRound,
  LogOut,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  Modal,
  Skeleton,
  Toggle,
  useOrbToast,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { timeAgo } from '@/components/orbat/overview/format';
import { ROLE_LABELS } from '@/lib/team/permissions';
import {
  changeMyPasswordAction,
  fetchMyProfile,
  fetchSessionSecurityInfo,
  revokeOtherSessions,
  updateMyProfileAction,
  type AvailabilityMode,
  type MyProfileBundle,
} from '@/lib/data/profile';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

const SPOKEN_LANGUAGE_OPTIONS = [
  'English',
  'Urdu',
  'Arabic',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Hindi',
];

const AVAILABILITY_CHOICES: {
  id: AvailabilityMode;
  label: string;
  desc: string;
}[] = [
  { id: 'online', label: 'Online', desc: 'Available for live chats and handoffs' },
  { id: 'away', label: 'Away', desc: 'Paused from new assignments' },
  { id: 'dnd', label: 'Do not disturb', desc: 'Mute handoff rings and urgent pings' },
];

export function ProfileScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    name: string;
    displayName: string;
    onCallPhone: string;
    spokenLanguages: string[];
    availabilityMode: AvailabilityMode;
    maxOpenTickets: number;
    autoAwayOnIdle: boolean;
    ringOnHandoff: boolean;
    urgentPingsOnBreach: boolean;
  } | null>(null);

  // Password modal
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  // 2FA Enroll modal
  const [mfaEnroll, setMfaEnroll] = useState<{ qrCode: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const { data, error, loading, reload } = useData<MyProfileBundle>(
    () => fetchMyProfile(workspace!.id),
    ['my-profile', workspace?.id],
    { enabled: Boolean(workspace?.id) },
  );

  const { data: sessionInfo, reload: reloadSession } = useData(
    () => fetchSessionSecurityInfo(),
    ['my-sessions', workspace?.id],
    { enabled: Boolean(workspace?.id) },
  );

  if (!workspace) return null;

  const form = draft ?? (data
    ? {
        name: data.name,
        displayName: data.displayName,
        onCallPhone: data.onCallPhone,
        spokenLanguages: data.spokenLanguages,
        availabilityMode: data.availabilityMode,
        maxOpenTickets: data.maxOpenTickets,
        autoAwayOnIdle: data.autoAwayOnIdle,
        ringOnHandoff: data.ringOnHandoff,
        urgentPingsOnBreach: data.urgentPingsOnBreach,
      }
    : null);

  const handleSaveProfile = async () => {
    if (!form) return;
    setBusyKey('save-profile');
    const res = await updateMyProfileAction(workspace.id, form);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Could not save profile', tone: 'bad' });
      return;
    }
    setDraft(null);
    show({ message: 'Profile saved', tone: 'ok' });
    reload();
  };

  const handleChangePassword = async () => {
    if (pwdForm.newPassword.length < 8) {
      show({ message: 'Password must be at least 8 characters', tone: 'bad' });
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirm) {
      show({ message: 'New passwords do not match', tone: 'bad' });
      return;
    }
    setBusyKey('change-pwd');
    const res = await changeMyPasswordAction(workspace.id, {
      currentPassword: pwdForm.currentPassword,
      newPassword: pwdForm.newPassword,
    });
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Failed to update password', tone: 'bad' });
      return;
    }
    setPwdModalOpen(false);
    setPwdForm({ currentPassword: '', newPassword: '', confirm: '' });
    show({ message: 'Password updated', tone: 'ok' });
    reload();
  };

  const handleStartMfa = async () => {
    setBusyKey('mfa-start');
    const res = await fetch('/api/auth/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enroll' }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      totp?: { qr_code?: string; secret?: string };
      error?: string;
    };
    setBusyKey(null);
    if (!res.ok || !payload.totp?.qr_code || !payload.totp?.secret) {
      show({ message: payload.error || 'Could not start 2FA enrollment', tone: 'bad' });
      return;
    }
    setMfaCode('');
    setMfaEnroll({ qrCode: payload.totp.qr_code, secret: payload.totp.secret });
  };

  const handleVerifyMfa = async () => {
    setBusyKey('mfa-verify');
    const res = await fetch('/api/auth/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', code: mfaCode }),
    });
    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusyKey(null);
    if (!res.ok) {
      show({ message: payload.error || 'Invalid authenticator code', tone: 'bad' });
      return;
    }
    setMfaEnroll(null);
    show({ message: 'Two-factor authentication enabled', tone: 'ok' });
    reload();
  };

  const handleDisableMfa = async () => {
    setBusyKey('mfa-disable');
    const res = await fetch('/api/auth/mfa', { method: 'DELETE' });
    setBusyKey(null);
    if (!res.ok) {
      show({ message: 'Could not disable 2FA', tone: 'bad' });
      return;
    }
    show({ message: 'Two-factor authentication disabled', tone: 'ok' });
    reload();
  };

  const handleSignOutOthers = async () => {
    setBusyKey('sign-out-others');
    const res = await revokeOtherSessions();
    setBusyKey(null);
    if (!res.ok) {
      show({ message: res.error || 'Could not sign out other sessions', tone: 'bad' });
      return;
    }
    show({ message: 'Signed out all other sessions cleanly', tone: 'ok' });
    reloadSession();
  };

  const toggleLanguage = (lang: string) => {
    if (!form) return;
    const has = form.spokenLanguages.includes(lang);
    const next = has
      ? form.spokenLanguages.filter((l) => l !== lang)
      : [...form.spokenLanguages, lang];
    setDraft({
      ...form,
      spokenLanguages: next.length > 0 ? next : ['English'],
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="My profile"
        description="Manage your availability, spoken languages, workload limits, and account security."
        actions={
          <Button
            variant="primary"
            size="sm"
            loading={busyKey === 'save-profile'}
            disabled={!form}
            onClick={handleSaveProfile}
          >
            Save profile
          </Button>
        }
      />

      {error ? (
        <ErrorState title="Could not load profile" body={error} onRetry={reload} />
      ) : loading || !data || !form ? (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-[380px] rounded-[24px]" />
          <Skeleton className="h-[460px] rounded-[24px]" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr] lg:items-start">
          {/* Left Identity & Availability Card */}
          <Card>
            <div className="flex items-center gap-3.5">
              <Avatar
                name={form.name}
                src={data.avatarUrl}
                size={56}
                presence={form.availabilityMode === 'online' ? 'online' : 'away'}
              />
              <div className="min-w-0">
                <div className="truncate font-o-display text-[18px] font-extrabold">{form.name}</div>
                <div className="truncate text-[13px] text-o-text-3">{data.email}</div>
                <div className="mt-1">
                  <Badge tone="neutral">{ROLE_LABELS[data.role]}</Badge>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-o-text-3">
                Availability status
              </div>
              <div className="flex flex-col gap-2">
                {AVAILABILITY_CHOICES.map((ch) => {
                  const selected = form.availabilityMode === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft({ ...form, availabilityMode: ch.id })}
                      className={cn(
                        'rounded-2xl border p-3 text-left transition-colors',
                        selected
                          ? 'border-o-forest bg-o-lime/25'
                          : 'border-o-border bg-o-surface-2 hover:bg-o-surface-3',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-semibold">{ch.label}</span>
                        {selected ? <Badge tone="ok">Active</Badge> : null}
                      </div>
                      <div className="mt-0.5 text-[12px] text-o-text-3">{ch.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {sessionInfo?.lastSignIn ? (
              <div className="mt-4 border-t border-o-border pt-3 text-[12.5px] text-o-text-3">
                Last signed in {timeAgo(sessionInfo.lastSignIn)}
              </div>
            ) : null}
          </Card>

          {/* Right settings cards */}
          <div className="flex flex-col gap-5">
            {/* Personal info */}
            <Card>
              <CardHeader title="Personal details" sub="Shown on customer replies and handoff cards." />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input
                    value={form.name}
                    onChange={(e) => setDraft({ ...form, name: e.target.value })}
                  />
                </Field>
                <Field label="Public display name">
                  <Input
                    value={form.displayName}
                    onChange={(e) => setDraft({ ...form, displayName: e.target.value })}
                  />
                </Field>
                <Field label="Work email" hint="Managed via sign-in account">
                  <Input value={data.email} readOnly />
                </Field>
                <Field label="Phone for on-call escalations">
                  <Input
                    value={form.onCallPhone}
                    placeholder="+1 555 234 5678"
                    onChange={(e) => setDraft({ ...form, onCallPhone: e.target.value })}
                  />
                </Field>
              </div>
            </Card>

            {/* Spoken Languages */}
            <Card>
              <CardHeader
                title="Languages I speak"
                sub="Helps team routing match multilingual chats to fluent teammates."
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {SPOKEN_LANGUAGE_OPTIONS.map((lang) => {
                  const active = form.spokenLanguages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleLanguage(lang)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                        active
                          ? 'bg-o-forest text-o-on-forest'
                          : 'bg-o-surface-2 text-o-text-2 hover:bg-o-surface-3',
                      )}
                    >
                      <Globe size={13} aria-hidden="true" />
                      {lang}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Workload */}
            <Card>
              <CardHeader
                title="Workload & notifications"
                sub="Control concurrent capacity and audio handoff alerts."
              />
              <div className="mt-4 flex flex-col gap-4">
                <div className="rounded-2xl bg-o-surface-2 p-4">
                  <div className="flex items-center justify-between text-[14px] font-semibold">
                    <span>Max concurrent open chats</span>
                    <span className="o-num font-extrabold text-o-forest">{form.maxOpenTickets}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    step={1}
                    aria-label="Max concurrent open chats"
                    value={form.maxOpenTickets}
                    onChange={(e) =>
                      setDraft({ ...form, maxOpenTickets: Number(e.target.value) })
                    }
                    className="mt-3 w-full accent-[var(--forest)]"
                  />
                </div>

                <div className="flex flex-col gap-2.5">
                  {[
                    {
                      key: 'autoAwayOnIdle' as const,
                      label: 'Set Away automatically when idle',
                      desc: 'Pause new live chat routing after inactivity.',
                    },
                    {
                      key: 'ringOnHandoff' as const,
                      label: 'Ring on live handoff offers',
                      desc: 'Play sound ping when AI transfers a waiting visitor.',
                    },
                    {
                      key: 'urgentPingsOnBreach' as const,
                      label: 'Urgent SLA breach pings',
                      desc: 'Highlight priority alert when an assigned thread nears SLA breach.',
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-o-surface-2 px-4 py-3"
                    >
                      <div>
                        <div className="text-[14px] font-semibold">{item.label}</div>
                        <div className="text-[12.5px] text-o-text-3">{item.desc}</div>
                      </div>
                      <Toggle
                        label={item.label}
                        checked={form[item.key]}
                        onChange={(checked) => setDraft({ ...form, [item.key]: checked })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Security & Active Devices */}
            <Card>
              <CardHeader
                title="Security & signed-in devices"
                sub="Manage your password, two-factor authenticator, and active session tokens."
              />
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-o-surface-2 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <KeyRound size={18} className="text-o-text-2" aria-hidden="true" />
                    <div>
                      <div className="text-[14px] font-semibold">Password</div>
                      <div className="text-[12.5px] text-o-text-3">
                        {data.hasPassword
                          ? 'Password login is active on this account.'
                          : 'Signed in via Google OAuth (no password set yet).'}
                      </div>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setPwdModalOpen(true)}>
                    {data.hasPassword ? 'Change password' : 'Set password'}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-o-surface-2 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={18} className="text-o-text-2" aria-hidden="true" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold">Two-factor authentication (TOTP)</span>
                        <Badge tone={data.totpEnabled ? 'ok' : 'neutral'}>
                          {data.totpEnabled ? 'Enabled' : 'Off'}
                        </Badge>
                      </div>
                      <div className="text-[12.5px] text-o-text-3">
                        {data.totpEnabled
                          ? `Enrolled ${data.totpEnrolledAt ? timeAgo(data.totpEnrolledAt) : ''}`
                          : 'Use Google Authenticator, 1Password, or Authy.'}
                      </div>
                    </div>
                  </div>
                  {data.totpEnabled ? (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={busyKey === 'mfa-disable'}
                      onClick={handleDisableMfa}
                    >
                      Disable 2FA
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={busyKey === 'mfa-start'}
                      onClick={handleStartMfa}
                    >
                      Enable 2FA
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-o-surface-2 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Smartphone size={18} className="text-o-text-2" aria-hidden="true" />
                    <div>
                      <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                        Current browser session
                        <CheckCircle2 size={14} className="text-[var(--ok)]" aria-hidden="true" />
                      </div>
                      <div className="text-[12.5px] text-o-text-3">
                        Revoke all other devices by bumping your session token version.
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busyKey === 'sign-out-others'}
                    onClick={handleSignOutOthers}
                  >
                    <LogOut size={14} aria-hidden="true" />
                    Sign out other devices
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Password Modal */}
      <Modal
        open={pwdModalOpen}
        onClose={() => setPwdModalOpen(false)}
        title={data?.hasPassword ? 'Change password' : 'Set account password'}
        footer={
          <>
            <Button variant="quiet" onClick={() => setPwdModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'change-pwd'} onClick={handleChangePassword}>
              Save password
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {data?.hasPassword ? (
            <Field label="Current password">
              <Input
                type="password"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
              />
            </Field>
          ) : null}
          <Field label="New password (min 8 chars)">
            <Input
              type="password"
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={pwdForm.confirm}
              onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {/* MFA Setup Modal */}
      <Modal
        open={Boolean(mfaEnroll)}
        onClose={() => setMfaEnroll(null)}
        title="Enable authenticator app (2FA)"
        description="Scan this QR code in your authenticator app, then enter the 6-digit verification code."
        footer={
          <>
            <Button variant="quiet" onClick={() => setMfaEnroll(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'mfa-verify'} onClick={handleVerifyMfa}>
              Verify & enable 2FA
            </Button>
          </>
        }
      >
        {mfaEnroll ? (
          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mfaEnroll.qrCode}
              alt="TOTP setup QR code"
              className="h-44 w-44 rounded-2xl border border-o-border bg-white p-2"
            />
            <Alert tone="ok" className="w-full text-center">
              Manual key: <code className="o-mono font-bold">{mfaEnroll.secret}</code>
            </Alert>
            <Field label="6-digit code" className="w-full">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
            </Field>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
