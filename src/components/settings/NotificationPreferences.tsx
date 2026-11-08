'use client';

import React, { useEffect, useState } from 'react';
import { getNotificationPrefsAction, saveNotificationPrefsAction } from '@/app/actions/settings';
import {
  NOTIFICATION_EVENTS,
  sameNotificationPrefs,
  type NotificationChannel,
  type NotificationEventId,
  type NotificationPrefs,
} from '@/lib/settings/validation';
import { ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { FormSkeleton, SaveBar, SettingsCard, useReportDirty } from './parts';
import { errorMessage } from '@/lib/errors/user-error';
import { sound } from '@/lib/sound';
import { Volume2, Bell, Mail, Send, Check } from 'lucide-react';

/** Settings → Notifications. Per user: everyone with a seat, any role. */
export function NotificationPreferences({ workspaceId }: { workspaceId: string }) {
  const toast = useToast();
  const [saved, setSaved] = useState<NotificationPrefs | null>(null);
  const [draft, setDraft] = useState<NotificationPrefs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getNotificationPrefsAction(workspaceId)
      .then((res) => {
        if (!live) return;
        if (!res.success) return setLoadError(res.error);
        setSaved(res.prefs);
        setDraft(res.prefs);
      })
      .catch((e) => live && setLoadError(errorMessage(e) || 'Could not load your preferences.'));
    return () => {
      live = false;
    };
  }, [workspaceId, attempt]);

  const dirty = Boolean(saved && draft && !sameNotificationPrefs(saved, draft));
  useReportDirty(dirty);

  if (loadError) {
    return (
      <ErrorState
        title="Could not load your preferences"
        message={loadError}
        onRetry={() => {
          setLoadError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (!saved || !draft) return <FormSkeleton rows={4} />;

  const toggle = (channel: NotificationChannel, id: NotificationEventId) => {
    setJustSaved(false);
    setSaveError(null);
    setDraft({ ...draft, [channel]: { ...draft[channel], [id]: !draft[channel][id] } });
  };

  async function save() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await saveNotificationPrefsAction(workspaceId, draft);
      if (!res.success) return setSaveError(res.error);
      setSaved(res.prefs);
      setDraft(res.prefs);
      setJustSaved(true);
      toast.success('Notification preferences saved.');
    } catch (e) {
      setSaveError(errorMessage(e) || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Tell me when…"
        description="These choices are yours alone. Teammates keep their own. They are saved to your account now; delivery of agent email alerts is still being rolled out."
      >
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-ui min-w-[28rem]">
            <thead>
              <tr className="text-2xs uppercase tracking-wider text-ink-3 text-left">
                <th className="py-2 pr-4 font-medium">Event</th>
                <th className="py-2 px-3 font-medium text-center w-20">Email</th>
                <th className="py-2 pl-3 font-medium text-center w-20">In-app</th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_EVENTS.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">
                    <div className="font-medium text-ink">{e.label}</div>
                    <div className="text-xs text-ink-3">{e.description}</div>
                  </th>
                  {(['email', 'in_app'] as const).map((channel) => (
                    <td key={channel} className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-[var(--ds-accent)] align-middle"
                        checked={draft[channel][e.id]}
                        onChange={() => toggle(channel, e.id)}
                        aria-label={`${e.label}: ${channel === 'email' ? 'email' : 'in-app'}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      {/* Sound & Ringing */}
      <SettingsCard
        title="Sound & Ringing"
        description="Choose how your browser alerts you when a customer requests an agent or sends a message."
      >
        <div className="space-y-4 max-w-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.sound_enabled}
              onChange={(e) => {
                setJustSaved(false);
                setDraft({ ...draft, sound_enabled: e.target.checked });
              }}
              className="w-5 h-5 accent-[var(--ds-accent)]"
            />
            <div>
              <div className="text-ui font-medium text-ink">Enable ringing sound</div>
              <div className="text-xs text-ink-3">Play audio chimes for incoming handoffs and customer messages</div>
            </div>
          </label>

          {draft.sound_enabled && (
            <div className="pl-8 space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-ink w-24">Ringtone</label>
                <select
                  value={draft.sound_name}
                  onChange={(e) => {
                    setJustSaved(false);
                    setDraft({ ...draft, sound_name: e.target.value });
                  }}
                  className="input max-w-xs text-xs"
                >
                  <option value="chime">Gentle Chime (Default)</option>
                  <option value="bell">Classic Bell</option>
                  <option value="alert">High Visibility Alert</option>
                </select>
                <button
                  type="button"
                  onClick={() => sound.playIncomingMessage()}
                  className="btn btn-xs btn-secondary gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Test sound</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsCard>

      {/* Browser Web Push */}
      <SettingsCard
        title="Web Push Notifications"
        description="Receive desktop push alerts even when the dashboard tab is in the background or minimized."
      >
        <div className="space-y-4 max-w-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.push_enabled}
              onChange={(e) => {
                setJustSaved(false);
                setDraft({ ...draft, push_enabled: e.target.checked });
              }}
              className="w-5 h-5 accent-[var(--ds-accent)]"
            />
            <div>
              <div className="text-ui font-medium text-ink">Browser push alerts</div>
              <div className="text-xs text-ink-3">Show desktop notifications for new chat handoffs</div>
            </div>
          </label>

          {draft.push_enabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
              <span className="text-ink">Browser permission required for push alerts.</span>
              <button
                type="button"
                onClick={async () => {
                  const perm = await Notification.requestPermission();
                  if (perm === 'granted') {
                    toast.success('Push notification permission granted!');
                  }
                }}
                className="btn btn-xs btn-primary cursor-pointer"
              >
                Grant Permission
              </button>
            </div>
          )}
        </div>
      </SettingsCard>

      {/* Missed Chats & External Alerts */}
      <SettingsCard
        title="Missed Chats & External Alerts"
        description="Configure backup delivery when you are away from the dashboard."
      >
        <div className="space-y-4 max-w-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.email_missed}
              onChange={(e) => {
                setJustSaved(false);
                setDraft({ ...draft, email_missed: e.target.checked });
              }}
              className="w-5 h-5 accent-[var(--ds-accent)]"
            />
            <div>
              <div className="text-ui font-medium text-ink">Email missed chats</div>
              <div className="text-xs text-ink-3">Send an email alert if an assigned chat goes unanswered</div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.email_queue_summary}
              onChange={(e) => {
                setJustSaved(false);
                setDraft({ ...draft, email_queue_summary: e.target.checked });
              }}
              className="w-5 h-5 accent-[var(--ds-accent)]"
            />
            <div>
              <div className="text-ui font-medium text-ink">Shift queue summary</div>
              <div className="text-xs text-ink-3">Email a digest of queued chats when office hours open</div>
            </div>
          </label>

          <div className="border-t border-line pt-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.telegram_enabled}
                onChange={(e) => {
                  setJustSaved(false);
                  setDraft({ ...draft, telegram_enabled: e.target.checked });
                }}
                className="w-5 h-5 accent-[var(--ds-accent)]"
              />
              <div>
                <div className="text-ui font-medium text-ink">Telegram alerts</div>
                <div className="text-xs text-ink-3">Receive instant alerts on your connected Telegram account</div>
              </div>
            </label>

            {draft.telegram_enabled && (
              <div className="pl-8 space-y-1.5">
                <label className="field-label mb-0">Telegram Chat ID</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789"
                  value={draft.telegram_chat_id || ''}
                  onChange={(e) => {
                    setJustSaved(false);
                    setDraft({ ...draft, telegram_chat_id: e.target.value.trim() || null });
                  }}
                  className="input max-w-xs text-xs font-mono"
                />
                <p className="text-2xs text-ink-3">Message our bot to get your personal chat ID.</p>
              </div>
            )}
          </div>
        </div>
      </SettingsCard>

      <SaveBar
        dirty={dirty}
        saving={saving}
        saved={justSaved}
        error={saveError}
        onSave={save}
        onDiscard={() => {
          setDraft(saved);
          setSaveError(null);
        }}
      />
    </div>
  );
}
