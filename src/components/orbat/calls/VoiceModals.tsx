'use client';

import { useState } from 'react';
import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  useOrbToast,
} from '@/components/orbat/primitives';
import { errorMessage } from '@/lib/errors/user-error';
import {
  createVoiceCampaign,
  logVoiceCall,
  rotateVoiceWebhookSecret,
  updateVoiceSettings,
  type VoiceCampaignRecord,
  type VoiceSettingsRecord,
} from '@/lib/data/calls';

export function NewCampaignModal({
  open,
  workspaceId,
  onClose,
  onCreated,
}: {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onCreated: (campaign: VoiceCampaignRecord) => void;
}) {
  const toast = useOrbToast();
  const [name, setName] = useState('');
  const [totalContacts, setTotalContacts] = useState('50');
  const [scheduleLabel, setScheduleLabel] = useState('Starts immediately');
  const [scriptPrompt, setScriptPrompt] = useState('');
  const [status, setStatus] = useState<'active' | 'scheduled'>('active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedContacts = Number(totalContacts);
    if (!Number.isFinite(parsedContacts) || parsedContacts < 0) {
      setError('Enter a valid target contact count.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createVoiceCampaign(workspaceId, {
        name: name.trim(),
        totalContacts: Math.round(parsedContacts),
        scheduleLabel: scheduleLabel.trim() || undefined,
        scriptPrompt: scriptPrompt.trim() || undefined,
        status,
      });
      toast.show({ tone: 'ok', message: `Campaign "${created.name}" created` });
      setName('');
      setScriptPrompt('');
      onCreated(created);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="New outbound campaign"
      description="Create an automated voice confirmation or reminder batch."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-campaign-form" loading={busy}>
            Create campaign
          </Button>
        </>
      }
    >
      <form id="new-campaign-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <Field label="Campaign name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="COD order confirmations"
            required
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Target contacts">
            <Input
              type="number"
              min="0"
              value={totalContacts}
              onChange={(e) => setTotalContacts(e.target.value)}
              required
            />
          </Field>
          <Field label="Initial status">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'scheduled')}
            >
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
            </Select>
          </Field>
          <Field label="Schedule window">
            <Input
              value={scheduleLabel}
              onChange={(e) => setScheduleLabel(e.target.value)}
              placeholder="10:00 AM – 7:00 PM"
            />
          </Field>
        </div>

        <Field
          label="AI voice script prompt"
          hint="Instructions for Nova when placing outbound calls."
        >
          <Textarea
            value={scriptPrompt}
            onChange={(e) => setScriptPrompt(e.target.value)}
            rows={4}
            placeholder="Confirm the customer's COD order and preferred delivery window politely..."
          />
        </Field>
      </form>
    </Modal>
  );
}

export function LogCallModal({
  open,
  workspaceId,
  onClose,
  onLogged,
}: {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onLogged: (callId: string) => void;
}) {
  const toast = useOrbToast();
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('inbound');
  const [status, setStatus] = useState<'live' | 'ai_resolved' | 'voicemail' | 'ended'>('live');
  const [language, setLanguage] = useState('English');
  const [orderContext, setOrderContext] = useState('');
  const [initialTranscript, setInitialTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await logVoiceCall(workspaceId, {
        callerName: callerName.trim() || undefined,
        callerPhone: callerPhone.trim(),
        direction,
        status,
        language: language.trim() || undefined,
        orderContext: orderContext.trim() || undefined,
        initialTranscript: initialTranscript.trim() || undefined,
      });
      toast.show({ tone: 'ok', message: 'Call session logged' });
      setCallerName('');
      setCallerPhone('');
      setOrderContext('');
      setInitialTranscript('');
      onLogged(created.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Log / test call"
      description="Create a real call session with Sentinel PII redaction on spoken numbers."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="log-call-form" loading={busy}>
            Start call log
          </Button>
        </>
      }
    >
      <form id="log-call-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Caller name">
            <Input
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              placeholder="Kamran Ali"
            />
          </Field>
          <Field label="Caller phone">
            <Input
              value={callerPhone}
              onChange={(e) => setCallerPhone(e.target.value)}
              placeholder="+92 300 555 0412"
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Direction">
            <Select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'inbound' | 'outbound')}
            >
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </Select>
          </Field>
          <Field label="Initial status">
            <Select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'live' | 'ai_resolved' | 'voicemail' | 'ended')
              }
            >
              <option value="live">Live call</option>
              <option value="ai_resolved">Resolved by AI</option>
              <option value="voicemail">Voicemail</option>
              <option value="ended">Ended</option>
            </Select>
          </Field>
          <Field label="Language">
            <Input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="Urdu + English"
            />
          </Field>
        </div>

        <Field label="Subject / Order context (optional)">
          <Input
            value={orderContext}
            onChange={(e) => setOrderContext(e.target.value)}
            placeholder="Order #ORD-3317 · COD address update"
          />
        </Field>

        <Field
          label="Initial caller speech (optional)"
          hint="Payment card numbers or SSNs are automatically redacted by Sentinel before storage."
        >
          <Textarea
            value={initialTranscript}
            onChange={(e) => setInitialTranscript(e.target.value)}
            rows={3}
            placeholder="Hi, I need to change the delivery address on my order..."
          />
        </Field>
      </form>
    </Modal>
  );
}

export function VoiceSettingsModal({
  open,
  workspaceId,
  settings,
  groups,
  onClose,
  onSaved,
}: {
  open: boolean;
  workspaceId: string;
  settings: VoiceSettingsRecord;
  groups: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useOrbToast();
  const [provider, setProvider] = useState(settings.provider);
  const [businessNumber, setBusinessNumber] = useState(settings.business_number || '');
  const [voiceAiEnabled, setVoiceAiEnabled] = useState(settings.voice_ai_enabled);
  const [aiGreeting, setAiGreeting] = useState(settings.ai_greeting ?? '');
  const [transferGroupId, setTransferGroupId] = useState(settings.transfer_group_id || '');
  const [afterHoursMode, setAfterHoursMode] = useState(settings.after_hours_mode);
  const [forwardNumber, setForwardNumber] = useState(settings.forward_number || '');
  const [piiRedaction, setPiiRedaction] = useState(settings.pii_redaction);
  const [recordingEnabled, setRecordingEnabled] = useState(settings.recording_enabled);
  const [defaultLanguage, setDefaultLanguage] = useState(settings.default_language);
  const [monthlyMinutesCap, setMonthlyMinutesCap] = useState(String(settings.monthly_minutes_cap));
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rotateBusy, setRotateBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/channels/voice/webhook?workspaceId=${workspaceId}`
      : `/api/channels/voice/webhook?workspaceId=${workspaceId}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cap = Number(monthlyMinutesCap);
    setBusy(true);
    setError(null);
    try {
      await updateVoiceSettings(workspaceId, {
        provider,
        businessNumber: businessNumber.trim() || null,
        voiceAiEnabled,
        aiGreeting: aiGreeting.trim(),
        transferGroupId: transferGroupId || null,
        afterHoursMode,
        forwardNumber: forwardNumber.trim() || null,
        piiRedaction,
        recordingEnabled,
        defaultLanguage: defaultLanguage.trim() || 'English',
        monthlyMinutesCap: Number.isFinite(cap) && cap > 0 ? Math.round(cap) : 1000,
      });
      toast.show({ tone: 'ok', message: 'Voice settings updated' });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRotateSecret = async () => {
    setRotateBusy(true);
    try {
      const { secret } = await rotateVoiceWebhookSecret(workspaceId);
      setRevealedSecret(secret);
      toast.show({ tone: 'ok', message: 'Rotated webhook secret' });
      onSaved();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    } finally {
      setRotateBusy(false);
    }
  };

  const handleCopy = (val: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(val).then(
        () => toast.show({ tone: 'ok', message: `${label} copied` }),
        () => toast.show({ tone: 'bad', message: 'Clipboard copy blocked' }),
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Call & telephony settings"
      description="Configure your telephony carrier webhook, Nova voice greeting, warm transfers, and Sentinel PII redaction."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="voice-settings-form" loading={busy}>
            Save settings
          </Button>
        </>
      }
    >
      <form id="voice-settings-form" onSubmit={handleSave} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Telephony provider">
            <Select
              value={provider}
              onChange={(e) => setProvider(e.target.value as VoiceSettingsRecord['provider'])}
            >
              <option value="unconfigured">[TO BE CHOSEN] — Not configured</option>
              <option value="twilio">Twilio Voice</option>
              <option value="telnyx">Telnyx</option>
              <option value="sip">SIP Trunk</option>
              <option value="custom">Custom Webhook</option>
            </Select>
          </Field>
          <Field label="Business phone number">
            <Input
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              placeholder="+1 (512) 555-0100"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Warm transfer queue">
            <Select value={transferGroupId} onChange={(e) => setTransferGroupId(e.target.value)}>
              <option value="">All available agents</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="After hours">
            <Select
              value={afterHoursMode}
              onChange={(e) =>
                setAfterHoursMode(e.target.value as VoiceSettingsRecord['after_hours_mode'])
              }
            >
              <option value="voicemail_callback">Voicemail + callback</option>
              <option value="ai_only">Nova AI voicemail</option>
              <option value="forward">Forward to number</option>
            </Select>
          </Field>
          <Field label="Monthly minutes cap">
            <Input
              type="number"
              min="1"
              value={monthlyMinutesCap}
              onChange={(e) => setMonthlyMinutesCap(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Default call language">
            <Input
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              placeholder="English"
            />
          </Field>
          <Field label="Forward number (if forwarding)">
            <Input
              value={forwardNumber}
              onChange={(e) => setForwardNumber(e.target.value)}
              placeholder="+1 512 555 0199"
            />
          </Field>
        </div>

        <Field label="AI answer greeting">
          <Textarea
            value={aiGreeting}
            onChange={(e) => setAiGreeting(e.target.value)}
            rows={2}
          />
        </Field>

        <div className="flex flex-wrap gap-5 pt-1 text-[13.5px] text-o-text-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={voiceAiEnabled}
              onChange={(e) => setVoiceAiEnabled(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>Answer calls with Nova Voice AI</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={piiRedaction}
              onChange={(e) => setPiiRedaction(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>Sentinel PII card/SSN redaction</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={recordingEnabled}
              onChange={(e) => setRecordingEnabled(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>Record call audio</span>
          </label>
        </div>

        {/* Webhook integration box */}
        <div className="rounded-2xl border border-o-border bg-o-surface-2 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-o-text">
              <KeyRound size={13} aria-hidden="true" />
              Inbound telephony webhook
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={rotateBusy}
              leading={<RefreshCw size={12} aria-hidden="true" />}
              onClick={handleRotateSecret}
            >
              {settings.has_webhook_secret ? 'Rotate secret' : 'Generate secret'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <code className="o-mono flex-1 truncate rounded-lg border border-o-border bg-o-surface px-2.5 py-1.5 text-[11.5px] text-o-text-2">
              {webhookUrl}
            </code>
            <Button
              type="button"
              variant="quiet"
              size="sm"
              leading={<Copy size={12} aria-hidden="true" />}
              onClick={() => handleCopy(webhookUrl, 'Webhook URL')}
            >
              Copy
            </Button>
          </div>
          {revealedSecret ? (
            <div className="rounded-lg border border-o-ok bg-o-ok-soft px-3 py-2 text-[12px] text-o-ok space-y-1">
              <div className="font-semibold">
                New x-orbat-voice-secret (shown once — store in your carrier config):
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="o-mono break-all text-o-text">{revealedSecret}</code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(revealedSecret, 'Webhook secret')}
                >
                  Copy
                </Button>
              </div>
            </div>
          ) : (
            <p className="m-0 text-[12px] text-o-text-3">
              {settings.has_webhook_secret
                ? 'A webhook secret is configured. Pass it via header x-orbat-voice-secret.'
                : 'Generate a secret to authenticate inbound carrier events.'}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
