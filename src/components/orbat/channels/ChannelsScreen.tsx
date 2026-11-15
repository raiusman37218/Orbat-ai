'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Copy,
  Globe,
  Link2,
  Mail,
  MessageSquare,
  Plug,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Unplug,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  TabPanel,
  Tabs,
  Textarea,
  Toggle,
  useOrbToast,
  type BadgeTone,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, timeAgo } from '@/components/orbat/overview/format';
import {
  checkChannelNowAction,
  connectInstagramManualAction,
  connectTikTokAction,
  connectWhatsAppManualAction,
  disconnectChannelAction,
  enableEmailChannelAction,
  fetchChannelsWorkspace,
  saveAppIntegrationAction,
  saveEmailSettingsAction,
  saveWidgetChannelSettingsAction,
  sendChannelTestMessageAction,
  setXDmPollingAction,
  startInstagramConnectAction,
  startSocialConnectAction,
  type ChannelsStudioBundle,
  type IntegrationCategory,
  type MarketplaceAppItem,
} from '@/lib/data/channels';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

type ChannelsTab = 'channels' | 'integrations';
type ChannelKey =
  | 'widget'
  | 'email'
  | 'whatsapp'
  | 'instagram'
  | 'messenger'
  | 'x'
  | 'threads'
  | 'linkedin'
  | 'tiktok';

const CHANNEL_LIST: { key: ChannelKey; label: string; kind: string }[] = [
  { key: 'widget', label: 'Website widget', kind: 'Live chat & AI' },
  { key: 'email', label: 'Support email', kind: 'Inbound & outbound' },
  { key: 'whatsapp', label: 'WhatsApp Business', kind: 'Messaging' },
  { key: 'instagram', label: 'Instagram DM', kind: 'Messaging' },
  { key: 'messenger', label: 'Messenger', kind: 'Messaging' },
  { key: 'x', label: 'X (Twitter)', kind: 'Social' },
  { key: 'threads', label: 'Threads', kind: 'Social' },
  { key: 'linkedin', label: 'LinkedIn', kind: 'Social' },
  { key: 'tiktok', label: 'TikTok', kind: 'Social' },
];

const CATEGORY_PILLS: { id: 'all' | IntegrationCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'payments', label: 'Payments' },
  { id: 'crm', label: 'CRM' },
  { id: 'team_chat', label: 'Team chat' },
  { id: 'developer', label: 'Developer' },
];

function statusTone(status: string): BadgeTone {
  if (status === 'connected' || status === 'live') return 'ok';
  if (status === 'needs_attention' || status === 'pending_oauth') return 'warn';
  return 'neutral';
}

function statusLabel(status: string): string {
  if (status === 'connected' || status === 'live') return 'Connected';
  if (status === 'needs_attention') return 'Needs attention';
  if (status === 'pending_oauth') return 'Pending setup';
  return 'Not connected';
}

export function ChannelsScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();

  const [tab, setTab] = useState<ChannelsTab>(() => {
    if (typeof window === 'undefined') return 'channels';
    return new URLSearchParams(window.location.search).get('tab') === 'integrations'
      ? 'integrations'
      : 'channels';
  });
  const [selectedChannel, setSelectedChannel] = useState<ChannelKey>(() => {
    if (typeof window === 'undefined') return 'widget';
    const ch = new URLSearchParams(window.location.search).get('channel') as ChannelKey | null;
    return ch && CHANNEL_LIST.some((c) => c.key === ch) ? ch : 'widget';
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Widget edit modal/draft
  const [widgetDraft, setWidgetDraft] = useState<{
    websiteUrl: string;
    widgetPosition: 'left' | 'right';
    greetingTitle: string;
    greetingMessage: string;
    widgetDisabled: boolean;
  } | null>(null);

  // Email edit draft
  const [emailDraft, setEmailDraft] = useState<{
    fromName: string;
    customAddress: string;
    signature: string;
  } | null>(null);

  // WhatsApp / Instagram / TikTok connect modal
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waForm, setWaForm] = useState({ phoneNumberId: '', wabaId: '', accessToken: '', appSecret: '' });
  const [igModalOpen, setIgModalOpen] = useState(false);
  const [igForm, setIgForm] = useState({ accessToken: '', appSecret: '' });
  const [tiktokModalOpen, setTiktokModalOpen] = useState(false);
  const [tiktokForm, setTiktokForm] = useState({ businessId: '', accessToken: '' });

  // Test message modal
  const [testModalChannel, setTestModalChannel] = useState<'whatsapp' | 'instagram' | null>(null);
  const [testTo, setTestTo] = useState('');

  // Disconnect confirm
  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null);

  // Integrations filters + manage modal
  const [intSearch, setIntSearch] = useState('');
  const [intCategory, setIntCategory] = useState<'all' | IntegrationCategory>('all');
  const [editingApp, setEditingApp] = useState<MarketplaceAppItem | null>(null);
  const [appAccountLabel, setAppAccountLabel] = useState('');
  const [appWebhookUrl, setAppWebhookUrl] = useState('');

  const { data, error, loading, reload } = useData<ChannelsStudioBundle>(
    () => fetchChannelsWorkspace(workspace!.id),
    ['channels-studio', workspace?.id],
    { enabled: Boolean(workspace?.id) },
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ch = params.get('channel');
    const result = params.get('channel_result');
    const message = params.get('channel_message');
    if (result !== 'connected' && result !== 'error') return;

    params.delete('channel_result');
    params.delete('channel_message');
    params.delete('settings');
    const next = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${next ? `?${next}` : ''}`,
    );

    const timer = window.setTimeout(() => {
      show({
        message:
          message ||
          (result === 'connected'
            ? `${ch || 'Channel'} connected.`
            : `Could not connect ${ch || 'channel'}.`),
        tone: result === 'connected' ? 'ok' : 'bad',
      });
      if (result === 'connected') reload();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [reload, show]);

  if (!workspace) return null;

  const widgetState = widgetDraft ?? (data ? {
    websiteUrl: data.widget.websiteUrl,
    widgetPosition: data.widget.widgetPosition,
    greetingTitle: data.widget.greetingTitle,
    greetingMessage: data.widget.greetingMessage,
    widgetDisabled: data.widget.widgetDisabled,
  } : null);

  const emailConnSettings = (data?.emailChannel?.settings?.custom_address || data?.emailChannel?.settings?.from_name || data?.emailChannel?.settings?.signature)
    ? {
        fromName: data.emailChannel.settings.from_name || '',
        customAddress: data.emailChannel.settings.custom_address || '',
        signature: data.emailChannel.settings.signature || '',
      }
    : { fromName: workspace.name, customAddress: '', signature: '' };
  const effectiveEmailDraft = emailDraft ?? emailConnSettings;

  const copySnippet = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      show({ message: `${label} copied`, tone: 'ok' });
    } catch {
      show({ message: 'Copy failed — select and copy manually', tone: 'info' });
    }
  };

  const statusForChannel = (key: ChannelKey): string => {
    if (!data) return 'disconnected';
    if (key === 'widget') {
      if (data.widget.widgetDisabled) return 'disconnected';
      return data.widget.widgetInstalled ? 'connected' : 'pending_oauth';
    }
    if (key === 'email') {
      return data.emailChannel?.status ?? 'disconnected';
    }
    const card = data.overview.cards.find((c) => c.id === key);
    return card?.connection?.status ?? 'disconnected';
  };

  const trafficFor = (key: string) =>
    data?.trafficByChannel.find((t) => t.channel === key) ?? {
      channel: key,
      conversations30d: 0,
      aiHandled30d: 0,
      aiResolutionPct: 0,
    };

  const selectedCard = data?.overview.cards.find((c) => c.id === selectedChannel) ?? null;

  const handleSaveWidget = async () => {
    if (!widgetState) return;
    setBusyKey('save-widget');
    const res = await saveWidgetChannelSettingsAction(workspace.id, widgetState);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Could not save widget settings', tone: 'bad' });
      return;
    }
    setWidgetDraft(null);
    show({ message: 'Widget channel saved', tone: 'ok' });
    reload();
  };

  const handleEnableEmail = async () => {
    setBusyKey('enable-email');
    const res = await enableEmailChannelAction(workspace.id);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error, tone: 'bad' });
      return;
    }
    show({ message: 'Support email enabled', tone: 'ok' });
    reload();
  };

  const handleSaveEmail = async () => {
    setBusyKey('save-email');
    const res = await saveEmailSettingsAction(workspace.id, {
      from_name: effectiveEmailDraft.fromName,
      custom_address: effectiveEmailDraft.customAddress,
      signature: effectiveEmailDraft.signature,
    });
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error, tone: 'bad' });
      return;
    }
    setEmailDraft(null);
    show({ message: 'Email settings updated', tone: 'ok' });
    reload();
  };

  const handleConnectWhatsApp = async () => {
    setBusyKey('wa-connect');
    const res = await connectWhatsAppManualAction(workspace.id, waForm);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error, tone: 'bad' });
      return;
    }
    setWaModalOpen(false);
    setWaForm({ phoneNumberId: '', wabaId: '', accessToken: '', appSecret: '' });
    show({ message: 'WhatsApp Business connected', tone: 'ok' });
    reload();
  };

  const handleStartInstagramOAuth = async () => {
    setBusyKey('ig-oauth');
    const res = await startInstagramConnectAction(workspace.id);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error, tone: 'info' });
      setIgModalOpen(true);
      return;
    }
    window.location.href = res.url;
  };

  const handleConnectInstagramManual = async () => {
    setBusyKey('ig-manual');
    const res = await connectInstagramManualAction(workspace.id, igForm);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error, tone: 'bad' });
      return;
    }
    setIgModalOpen(false);
    setIgForm({ accessToken: '', appSecret: '' });
    show({ message: 'Instagram DM connected', tone: 'ok' });
    reload();
  };

  const handleStartSocial = async (channel: 'x' | 'threads' | 'linkedin') => {
    setBusyKey(`social-${channel}`);
    const res = await startSocialConnectAction(workspace.id, channel);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error, tone: 'info' });
      return;
    }
    window.location.href = res.url;
  };

  const handleConnectTikTok = async () => {
    setBusyKey('tiktok');
    const res = await connectTikTokAction(workspace.id, tiktokForm);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error, tone: 'bad' });
      return;
    }
    setTiktokModalOpen(false);
    setTiktokForm({ businessId: '', accessToken: '' });
    show({ message: 'TikTok connected', tone: 'ok' });
    reload();
  };

  const handleDisconnectChannel = async () => {
    if (!disconnectTarget) return;
    setBusyKey('disconnect-channel');
    const res = await disconnectChannelAction(workspace.id, disconnectTarget);
    setBusyKey(null);
    setDisconnectTarget(null);
    if (!res.success) {
      show({ message: res.error, tone: 'bad' });
      return;
    }
    show({ message: 'Channel disconnected', tone: 'ok' });
    reload();
  };

  const handleSendTest = async () => {
    if (!testModalChannel) return;
    setBusyKey('send-test');
    const res = await sendChannelTestMessageAction(workspace.id, testModalChannel, {
      to: testTo,
      templateName: 'hello_world',
      language: 'en_US',
    });
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error, tone: 'bad' });
      return;
    }
    setTestModalChannel(null);
    setTestTo('');
    show({ message: 'Test message sent', tone: 'ok' });
    reload();
  };

  const handleSaveIntegration = async (status: 'connected' | 'disconnected' | 'pending_oauth') => {
    if (!editingApp) return;
    setBusyKey(`app-${editingApp.appKey}`);
    const res = await saveAppIntegrationAction(workspace.id, {
      appKey: editingApp.appKey,
      status,
      accountLabel: appAccountLabel || editingApp.name,
      config: appWebhookUrl.trim() ? { webhookUrl: appWebhookUrl.trim() } : {},
    });
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Failed to update integration', tone: 'bad' });
      return;
    }
    setEditingApp(null);
    show({
      message: status === 'disconnected' ? `${editingApp.name} disconnected` : `${editingApp.name} updated`,
      tone: 'ok',
    });
    reload();
  };

  const filteredIntegrations = (data?.integrations ?? []).filter((item) => {
    const matchCat = intCategory === 'all' || item.category === intCategory;
    const q = intSearch.trim().toLowerCase();
    const matchSearch =
      !q || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const activeTraffic = trafficFor(selectedChannel);

  return (
    <PageContainer>
      <PageHeader
        title="Channels & apps"
        description="Connect live chat, support email, messaging apps, and external business tools."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/app/channels/connect" variant="secondary" size="sm">
              <Link2 size={15} aria-hidden="true" />
              Connect website & CRM
            </ButtonLink>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setTab('integrations');
              }}
            >
              <Plug size={15} aria-hidden="true" />
              Browse apps
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorState title="Could not load channels" body={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Skeleton className="h-[440px] rounded-[24px]" />
          <Skeleton className="h-[440px] rounded-[24px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Tabs<ChannelsTab>
            idBase="channels-tabs"
            label="Channels and integrations"
            value={tab}
            onChange={setTab}
            items={[
              { id: 'channels', label: 'Channels', count: CHANNEL_LIST.length },
              {
                id: 'integrations',
                label: 'Integrations',
                count: data.integrations.filter((i) => i.status === 'connected').length,
              },
            ]}
          />

          {tab === 'channels' ? (
            <TabPanel idBase="channels-tabs" id="channels">
              <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
                {/* Left channel list */}
                <Card className="p-3">
                  <div className="mb-2 px-2 text-[12px] font-semibold uppercase tracking-wide text-o-text-3">
                    Customer channels
                  </div>
                  <div className="flex flex-col gap-1" role="listbox" aria-label="Channels">
                    {CHANNEL_LIST.map((ch) => {
                      const st = statusForChannel(ch.key);
                      const stat = trafficFor(ch.key);
                      const active = selectedChannel === ch.key;
                      return (
                        <button
                          key={ch.key}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => setSelectedChannel(ch.key)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors',
                            active
                              ? 'bg-o-lime text-o-on-lime'
                              : 'hover:bg-o-surface-2 text-o-text',
                          )}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold">{ch.label}</div>
                            <div className={cn('text-[12px]', active ? 'text-o-forest/80' : 'text-o-text-3')}>
                              {ch.kind} · {fmtInt(stat.conversations30d)} (30d)
                            </div>
                          </div>
                          <Badge tone={statusTone(st)}>{statusLabel(st)}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </Card>

                {/* Right detail panel */}
                <div className="flex flex-col gap-4">
                  {/* Top KPI strip for selected channel */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card>
                      <div className="text-[12.5px] font-medium text-o-text-3">Conversations (30d)</div>
                      <div className="mt-1 o-num font-o-display text-[24px] font-extrabold">
                        {fmtInt(activeTraffic.conversations30d)}
                      </div>
                    </Card>
                    <Card>
                      <div className="text-[12.5px] font-medium text-o-text-3">AI-assisted share</div>
                      <div className="mt-1 o-num font-o-display text-[24px] font-extrabold text-[var(--ai)]">
                        {activeTraffic.aiResolutionPct}%
                      </div>
                    </Card>
                    <Card>
                      <div className="text-[12.5px] font-medium text-o-text-3">Status</div>
                      <div className="mt-2">
                        <Badge tone={statusTone(statusForChannel(selectedChannel))}>
                          {statusLabel(statusForChannel(selectedChannel))}
                        </Badge>
                      </div>
                    </Card>
                  </div>

                  {/* Website Widget detail */}
                  {selectedChannel === 'widget' && widgetState ? (
                    <Card>
                      <CardHeader
                        title="Website chat widget"
                        sub="Embed ORBAT AI + live handoff launcher on your marketing site or web app."
                        actions={
                          <Link
                            href="/app/channels/connect"
                            className="text-[13.5px] font-semibold text-o-forest underline"
                          >
                            CRM & storefront wizard →
                          </Link>
                        }
                      />

                      <div className="mt-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-o-surface-2 px-4 py-3">
                          <div>
                            <div className="text-[14px] font-semibold">Show widget to visitors</div>
                            <div className="text-[12.5px] text-o-text-3">
                              Pause the launcher across all pages without removing the embed script.
                            </div>
                          </div>
                          <Toggle
                            checked={!widgetState.widgetDisabled}
                            onChange={(checked) =>
                              setWidgetDraft({ ...widgetState, widgetDisabled: !checked })
                            }
                            label="Show widget"
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Primary website URL">
                            <Input
                              value={widgetState.websiteUrl}
                              placeholder="https://acme.com"
                              onChange={(e) =>
                                setWidgetDraft({ ...widgetState, websiteUrl: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="Launcher corner">
                            <Select
                              value={widgetState.widgetPosition}
                              onChange={(e) =>
                                setWidgetDraft({
                                  ...widgetState,
                                  widgetPosition: e.target.value === 'left' ? 'left' : 'right',
                                })
                              }
                              options={[
                                { value: 'right', label: 'Bottom right' },
                                { value: 'left', label: 'Bottom left' },
                              ]}
                            />
                          </Field>
                        </div>

                        <Field label="Greeting headline">
                          <Input
                            value={widgetState.greetingTitle}
                            onChange={(e) =>
                              setWidgetDraft({ ...widgetState, greetingTitle: e.target.value })
                            }
                          />
                        </Field>

                        <Field label="Greeting message">
                          <Textarea
                            rows={2}
                            value={widgetState.greetingMessage}
                            onChange={(e) =>
                              setWidgetDraft({ ...widgetState, greetingMessage: e.target.value })
                            }
                          />
                        </Field>

                        <div className="rounded-2xl border border-o-border bg-o-surface-2 p-3.5">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[12.5px] font-semibold text-o-text-2">
                              Install snippet
                            </span>
                            <Button
                              variant="quiet"
                              size="sm"
                              onClick={() => copySnippet(data.widget.snippet, 'Widget snippet')}
                            >
                              <Copy size={14} aria-hidden="true" />
                              Copy
                            </Button>
                          </div>
                          <pre className="overflow-x-auto o-mono text-[12px] leading-relaxed text-o-text-2">
                            {data.widget.snippet}
                          </pre>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            variant="primary"
                            loading={busyKey === 'save-widget'}
                            onClick={handleSaveWidget}
                          >
                            Save widget settings
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ) : null}

                  {/* Support Email detail */}
                  {selectedChannel === 'email' ? (
                    <Card>
                      <CardHeader
                        title="Support email channel"
                        sub="Forward inbound support emails into the ORBAT Inbox and send branded replies."
                        actions={
                          <ButtonLink href="/app/settings/emails" variant="secondary" size="sm">
                            <Mail size={14} aria-hidden="true" />
                            Email templates
                          </ButtonLink>
                        }
                      />

                      {data.emailChannelError ? (
                        <Alert tone="warn" className="mt-3">
                          {data.emailChannelError}
                        </Alert>
                      ) : null}

                      {data.emailChannel?.problems?.length ? (
                        <Alert tone="warn" className="mt-3">
                          {data.emailChannel.problems.join(' · ')}
                        </Alert>
                      ) : null}

                      {!data.emailChannel || data.emailChannel.status === 'disconnected' ? (
                        <EmptyState
                          className="mt-4"
                          icon={<Mail size={22} />}
                          title="Support email is not enabled yet"
                          body="Generate a dedicated forwarding address for this workspace so inbound mail creates conversations automatically."
                          action={
                            <Button
                              variant="primary"
                              loading={busyKey === 'enable-email'}
                              onClick={handleEnableEmail}
                            >
                              Enable support email
                            </Button>
                          }
                        />
                      ) : (
                        <div className="mt-4 flex flex-col gap-4">
                          {data.emailChannel.forwardingAddress ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-o-surface-2 px-4 py-3">
                              <div>
                                <div className="text-[12px] font-semibold text-o-text-3">
                                  Workspace forwarding address
                                </div>
                                <div className="o-mono text-[13.5px] font-semibold">
                                  {data.emailChannel.forwardingAddress}
                                </div>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  copySnippet(
                                    data.emailChannel!.forwardingAddress!,
                                    'Forwarding address',
                                  )
                                }
                              >
                                <Copy size={14} aria-hidden="true" />
                                Copy
                              </Button>
                            </div>
                          ) : null}

                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Sender display name">
                              <Input
                                value={effectiveEmailDraft.fromName}
                                onChange={(e) =>
                                  setEmailDraft({
                                    ...effectiveEmailDraft,
                                    fromName: e.target.value,
                                  })
                                }
                              />
                            </Field>
                            <Field label="Custom support email">
                              <Input
                                value={effectiveEmailDraft.customAddress}
                                placeholder="support@yourdomain.com"
                                onChange={(e) =>
                                  setEmailDraft({
                                    ...effectiveEmailDraft,
                                    customAddress: e.target.value,
                                  })
                                }
                              />
                            </Field>
                          </div>

                          <Field label="Email signature">
                            <Textarea
                              rows={3}
                              value={effectiveEmailDraft.signature}
                              placeholder="Warm regards,&#10;Support Team"
                              onChange={(e) =>
                                setEmailDraft({
                                  ...effectiveEmailDraft,
                                  signature: e.target.value,
                                })
                              }
                            />
                          </Field>

                          <div className="flex justify-end">
                            <Button
                              variant="primary"
                              loading={busyKey === 'save-email'}
                              onClick={handleSaveEmail}
                            >
                              Save email settings
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ) : null}

                  {/* WhatsApp / Instagram / Messenger / Social detail */}
                  {selectedChannel !== 'widget' && selectedChannel !== 'email' ? (
                    <Card>
                      <CardHeader
                        title={CHANNEL_LIST.find((c) => c.key === selectedChannel)?.label || selectedChannel}
                        sub={
                          selectedCard?.connection?.display_name
                            ? `Connected account: ${selectedCard.connection.display_name}`
                            : 'Connect this channel to answer incoming messages inside Inbox.'
                        }
                        actions={
                          selectedCard?.connection && selectedCard.connection.status !== 'disconnected' ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setDisconnectTarget(selectedChannel)}
                            >
                              <Unplug size={14} aria-hidden="true" />
                              Disconnect
                            </Button>
                          ) : null
                        }
                      />

                      {data.overview.setupProblems.length ? (
                        <Alert tone="warn" className="mt-3">
                          {data.overview.setupProblems.join(' · ')}
                        </Alert>
                      ) : null}

                      {selectedCard?.connection?.last_error ? (
                        <Alert tone="bad" className="mt-3">
                          Last error: {selectedCard.connection.last_error}
                        </Alert>
                      ) : null}

                      {selectedCard?.connection && selectedCard.connection.status !== 'disconnected' ? (
                        <div className="mt-4 flex flex-col gap-4">
                          <div className="grid gap-3 rounded-2xl bg-o-surface-2 p-4 sm:grid-cols-2">
                            <div>
                              <div className="text-[12px] text-o-text-3">Account ID</div>
                              <div className="mt-0.5 o-mono text-[13px] font-semibold">
                                {selectedCard.connection.external_account_id || '—'}
                              </div>
                            </div>
                            <div>
                              <div className="text-[12px] text-o-text-3">Last inbound message</div>
                              <div className="mt-0.5 text-[13px] font-medium">
                                {selectedCard.connection.last_inbound_at
                                  ? timeAgo(selectedCard.connection.last_inbound_at)
                                  : 'No inbound messages yet'}
                              </div>
                            </div>
                          </div>

                          {selectedChannel === 'x' ? (
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-o-border px-4 py-3">
                              <div>
                                <div className="text-[14px] font-semibold">Poll X direct messages</div>
                                <div className="text-[12.5px] text-o-text-3">
                                  X API bills per DM poll event; enable only if needed.
                                </div>
                              </div>
                              <Toggle
                                label="Poll X direct messages"
                                checked={Boolean(selectedCard.connection.settings?.poll_dms)}
                                onChange={async (checked) => {
                                  const res = await setXDmPollingAction(workspace.id, checked);
                                  if (!res.success) {
                                    show({ message: res.error, tone: 'bad' });
                                  } else {
                                    show({ message: 'X DM polling updated', tone: 'ok' });
                                    reload();
                                  }
                                }}
                              />
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            {(selectedChannel === 'whatsapp' || selectedChannel === 'instagram') ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setTestModalChannel(selectedChannel)}
                              >
                                <Send size={14} aria-hidden="true" />
                                Send test message
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={busyKey === `poll-${selectedChannel}`}
                                onClick={async () => {
                                  setBusyKey(`poll-${selectedChannel}`);
                                  const res = await checkChannelNowAction(workspace.id, selectedChannel);
                                  setBusyKey(null);
                                  if (!res.success) {
                                    show({ message: res.error, tone: 'bad' });
                                  } else {
                                    show({ message: res.message, tone: 'ok' });
                                    reload();
                                  }
                                }}
                              >
                                <RefreshCw size={14} aria-hidden="true" />
                                Check for new messages now
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          className="mt-4"
                          icon={<MessageSquare size={22} />}
                          title={`${CHANNEL_LIST.find((c) => c.key === selectedChannel)?.label} is not connected`}
                          body="Connect using official OAuth (when configured on this server) or manual Business API credentials."
                          action={
                            <div className="flex flex-wrap justify-center gap-2">
                              {selectedChannel === 'whatsapp' ? (
                                <Button variant="primary" onClick={() => setWaModalOpen(true)}>
                                  Connect WhatsApp manually
                                </Button>
                              ) : selectedChannel === 'instagram' ? (
                                <>
                                  <Button
                                    variant="primary"
                                    loading={busyKey === 'ig-oauth'}
                                    onClick={handleStartInstagramOAuth}
                                  >
                                    Connect with Instagram
                                  </Button>
                                  <Button variant="secondary" onClick={() => setIgModalOpen(true)}>
                                    Manual credentials
                                  </Button>
                                </>
                              ) : selectedChannel === 'tiktok' ? (
                                <Button variant="primary" onClick={() => setTiktokModalOpen(true)}>
                                  Connect TikTok Business
                                </Button>
                              ) : selectedChannel === 'x' ||
                                selectedChannel === 'threads' ||
                                selectedChannel === 'linkedin' ? (
                                <Button
                                  variant="primary"
                                  loading={busyKey === `social-${selectedChannel}`}
                                  onClick={() => handleStartSocial(selectedChannel)}
                                >
                                  Connect account
                                </Button>
                              ) : (
                                <Alert tone="warn">
                                  Messenger OAuth setup requires META_APP_ID and META_APP_SECRET on the server.
                                </Alert>
                              )}
                            </div>
                          }
                        />
                      )}
                    </Card>
                  ) : null}
                </div>
              </div>
            </TabPanel>
          ) : null}

          {tab === 'integrations' ? (
            <TabPanel idBase="channels-tabs" id="integrations">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative w-full sm:max-w-[300px]">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-o-text-3"
                      aria-hidden="true"
                    />
                    <Input
                      className="pl-9"
                      placeholder="Search integrations…"
                      value={intSearch}
                      onChange={(e) => setIntSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Integration categories">
                    {CATEGORY_PILLS.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setIntCategory(cat.id)}
                        className={cn(
                          'rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                          intCategory === cat.id
                            ? 'bg-o-forest text-o-on-forest'
                            : 'bg-o-surface-2 text-o-text-2 hover:bg-o-surface-3',
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredIntegrations.length === 0 ? (
                  <EmptyState
                    icon={<Globe size={22} />}
                    title="No integrations match that filter"
                    body="Clear your search or choose All categories."
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredIntegrations.map((app) => (
                      <Card key={app.appKey} className="flex flex-col justify-between gap-4">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-o-display text-[16px] font-extrabold">{app.name}</h3>
                              <div className="text-[12px] capitalize text-o-text-3">
                                {app.category.replace('_', ' ')}
                              </div>
                            </div>
                            <Badge tone={statusTone(app.status)}>{statusLabel(app.status)}</Badge>
                          </div>
                          <p className="mt-2.5 text-[13.5px] leading-relaxed text-o-text-2">
                            {app.description}
                          </p>
                          {app.accountLabel ? (
                            <div className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-o-forest">
                              <CheckCircle2 size={14} aria-hidden="true" />
                              {app.accountLabel}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-o-border pt-3">
                          {app.appKey === 'shopify' || app.appKey === 'woocommerce' ? (
                            <ButtonLink href="/app/channels/connect" variant="secondary" size="sm">
                              Storefront wizard
                            </ButtonLink>
                          ) : (
                            <span className="text-[12px] text-o-text-3">
                              {app.requiresExternalOAuth ? 'External OAuth / key' : 'Webhook ready'}
                            </span>
                          )}
                          <Button
                            variant={app.status === 'connected' ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => {
                              setEditingApp(app);
                              setAppAccountLabel(app.accountLabel || '');
                              setAppWebhookUrl(
                                typeof app.config.webhookUrl === 'string' ? app.config.webhookUrl : '',
                              );
                            }}
                          >
                            {app.status === 'connected' ? 'Manage' : 'Configure'}
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabPanel>
          ) : null}
        </div>
      )}

      {/* WhatsApp manual modal */}
      <Modal
        open={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        title="Connect WhatsApp Business"
        description="Paste credentials from Meta for Developers -> WhatsApp -> API Setup."
        footer={
          <>
            <Button variant="quiet" onClick={() => setWaModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'wa-connect'} onClick={handleConnectWhatsApp}>
              Verify & connect
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Phone Number ID">
            <Input
              value={waForm.phoneNumberId}
              onChange={(e) => setWaForm({ ...waForm, phoneNumberId: e.target.value })}
            />
          </Field>
          <Field label="WhatsApp Business Account ID">
            <Input
              value={waForm.wabaId}
              onChange={(e) => setWaForm({ ...waForm, wabaId: e.target.value })}
            />
          </Field>
          <Field label="System User Access Token">
            <Input
              type="password"
              value={waForm.accessToken}
              onChange={(e) => setWaForm({ ...waForm, accessToken: e.target.value })}
            />
          </Field>
          <Field label="Meta App Secret (32 hex chars)">
            <Input
              type="password"
              value={waForm.appSecret}
              onChange={(e) => setWaForm({ ...waForm, appSecret: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {/* Instagram manual modal */}
      <Modal
        open={igModalOpen}
        onClose={() => setIgModalOpen(false)}
        title="Connect Instagram Business manually"
        footer={
          <>
            <Button variant="quiet" onClick={() => setIgModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busyKey === 'ig-manual'}
              onClick={handleConnectInstagramManual}
            >
              Connect Instagram
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Instagram User Access Token">
            <Input
              type="password"
              value={igForm.accessToken}
              onChange={(e) => setIgForm({ ...igForm, accessToken: e.target.value })}
            />
          </Field>
          <Field label="Instagram App Secret">
            <Input
              type="password"
              value={igForm.appSecret}
              onChange={(e) => setIgForm({ ...igForm, appSecret: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {/* TikTok manual modal */}
      <Modal
        open={tiktokModalOpen}
        onClose={() => setTiktokModalOpen(false)}
        title="Connect TikTok Business"
        footer={
          <>
            <Button variant="quiet" onClick={() => setTiktokModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'tiktok'} onClick={handleConnectTikTok}>
              Connect
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Business Account ID">
            <Input
              value={tiktokForm.businessId}
              onChange={(e) => setTiktokForm({ ...tiktokForm, businessId: e.target.value })}
            />
          </Field>
          <Field label="Access Token">
            <Input
              type="password"
              value={tiktokForm.accessToken}
              onChange={(e) => setTiktokForm({ ...tiktokForm, accessToken: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {/* Test message modal */}
      <Modal
        open={Boolean(testModalChannel)}
        onClose={() => setTestModalChannel(null)}
        title="Send test message"
        description={
          testModalChannel === 'whatsapp'
            ? 'Enter a destination phone number with country code (e.g. +16505551234).'
            : 'Enter the Instagram recipient scoped ID from the last 24h.'
        }
        footer={
          <>
            <Button variant="quiet" onClick={() => setTestModalChannel(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'send-test'} onClick={handleSendTest}>
              Send test
            </Button>
          </>
        }
      >
        <Field label="Recipient">
          <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        </Field>
      </Modal>

      {/* Marketplace integration config modal */}
      <Modal
        open={Boolean(editingApp)}
        onClose={() => setEditingApp(null)}
        title={editingApp ? `Configure ${editingApp.name}` : 'Integration'}
        description={editingApp?.description}
        footer={
          editingApp ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              {editingApp.status === 'connected' ? (
                <Button
                  variant="danger"
                  loading={busyKey === `app-${editingApp.appKey}`}
                  onClick={() => handleSaveIntegration('disconnected')}
                >
                  Disconnect
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="quiet" onClick={() => setEditingApp(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={busyKey === `app-${editingApp.appKey}`}
                  onClick={() =>
                    handleSaveIntegration(
                      editingApp.requiresExternalOAuth && !appWebhookUrl.trim()
                        ? 'pending_oauth'
                        : 'connected',
                    )
                  }
                >
                  {editingApp.requiresExternalOAuth && !appWebhookUrl.trim()
                    ? 'Save & mark pending OAuth'
                    : 'Save connection'}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {editingApp ? (
          <div className="flex flex-col gap-3">
            {editingApp.externalOAuthNote ? (
              <Alert tone="ai">
                <Sparkles size={15} className="inline mr-1.5" aria-hidden="true" />
                {editingApp.externalOAuthNote}
              </Alert>
            ) : null}
            <Field label="Connected account or workspace label">
              <Input
                value={appAccountLabel}
                placeholder={`e.g. ${workspace.name} production`}
                onChange={(e) => setAppAccountLabel(e.target.value)}
              />
            </Field>
            {editingApp.appKey === 'slack' ||
            editingApp.appKey === 'zapier' ||
            editingApp.appKey === 'woocommerce' ? (
              <Field label={editingApp.appKey === 'slack' ? 'Slack Incoming Webhook URL' : 'Webhook / Store API Endpoint URL'}>
                <Input
                  type="url"
                  value={appWebhookUrl}
                  placeholder="https://..."
                  onChange={(e) => setAppWebhookUrl(e.target.value)}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(disconnectTarget)}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={handleDisconnectChannel}
        busy={busyKey === 'disconnect-channel'}
        title={`Disconnect ${disconnectTarget ?? 'channel'}?`}
        body="Stored channel credentials are removed immediately and new inbound messages will stop arriving."
        confirmLabel="Disconnect"
      />
    </PageContainer>
  );
}
