'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  Bot,
  BookOpen,
  Building2,
  Copy,
  Database,
  Globe,
  Inbox,
  KeyRound,
  Mail,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  Sun,
  Trash2,
  Webhook,
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
  Segmented,
  Select,
  Skeleton,
  Table,
  Textarea,
  Toggle,
  useOrbToast,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { useTheme } from '@/components/orbat/shell/theme';
import { timeAgo } from '@/components/orbat/overview/format';
import type { ApiKeyRow } from '@/app/actions/api-keys';
import type { WorkspaceWebhook } from '@/app/actions/webhooks';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS, type WebhookEvent } from '@/lib/webhooks';
import {
  cancelWorkspaceDeletionAction,
  createStudioApiKeyAction,
  createStudioWebhookAction,
  deleteStudioWebhookAction,
  fetchWorkspaceSettingsBundle,
  revokeStudioApiKeyAction,
  rotateStudioWebhookSecretAction,
  saveWorkspaceAiBehaviorStudioAction,
  saveWorkspaceBrandingStudioAction,
  saveWorkspaceGeneralStudioAction,
  saveWorkspaceNotificationMatrixAction,
  saveWorkspaceSecurityStudioAction,
  scheduleWorkspaceDeletionAction,
  testStudioWebhookAction,
  updateStudioWebhookAction,
  type NotificationMatrixPrefs,
  type WorkspaceSettingsBundle,
} from '@/lib/data/settings';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

type SettingsSection =
  | 'general'
  | 'company'
  | 'branding'
  | 'inbox'
  | 'ai'
  | 'knowledge'
  | 'notifications'
  | 'security'
  | 'api_keys'
  | 'webhooks'
  | 'data';

const SETTINGS_NAV: {
  group: string;
  items: { id: SettingsSection; label: string; icon: typeof Settings }[];
}[] = [
  {
    group: 'Workspace',
    items: [
      { id: 'general', label: 'General', icon: Settings },
      { id: 'company', label: 'Company profile', icon: Building2 },
      { id: 'branding', label: 'Branding & widget', icon: Palette },
      { id: 'inbox', label: 'Inbox & SLAs', icon: Inbox },
    ],
  },
  {
    group: 'AI & Knowledge',
    items: [
      { id: 'ai', label: 'AI controls', icon: Bot },
      { id: 'knowledge', label: 'Knowledge sources', icon: BookOpen },
    ],
  },
  {
    group: 'Operations & Dev',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'security', label: 'Security & access', icon: Shield },
      { id: 'api_keys', label: 'API keys', icon: KeyRound },
      { id: 'webhooks', label: 'Webhooks', icon: Webhook },
      { id: 'data', label: 'Data & retention', icon: Database },
    ],
  },
];

const BRAND_SWATCHES = ['#163300', '#111827', '#2563eb', '#7c3aed', '#0f766e', '#be123c'];

export function SettingsScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();
  const { theme, toggle } = useTheme();

  const [section, setSection] = useState<SettingsSection>('general');
  const [navSearch, setNavSearch] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Draft overrides
  const [generalDraft, setGeneralDraft] = useState<{
    name: string;
    websiteUrl: string;
    timezone: string;
    language: string;
    industry: string;
    autoCloseDays: number;
    supportEmail: string;
    replyLanguage: string;
    legalName: string;
  } | null>(null);

  const [brandingDraft, setBrandingDraft] = useState<{
    brandColor: string;
    logoUrl: string;
    widgetPosition: 'left' | 'right';
    greetingTitle: string;
    greetingMessage: string;
  } | null>(null);

  const [aiDraft, setAiDraft] = useState<{
    copilotSuggestions: boolean;
    autoSummarizeHandoff: boolean;
    sentimentScoring: boolean;
    autoTranslate: boolean;
    draftOnly: boolean;
    knowledgeSourceMode: 'site_and_docs' | 'uploads_only';
    tone: string;
    aiMonthlyCostCapUsd: string;
  } | null>(null);

  const [notifDraft, setNotifDraft] = useState<NotificationMatrixPrefs | null>(null);

  const [securityDraft, setSecurityDraft] = useState<{
    require2fa: boolean;
    dataRetentionDays: number;
    sessionTimeoutHours: number;
    ipAllowlistRaw: string;
  } | null>(null);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState('');

  // API keys create/reveal/revoke
  const [createKeyModal, setCreateKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKeyToken, setRevealedKeyToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);

  // Webhooks create/reveal/delete
  const [createHookModal, setCreateHookModal] = useState(false);
  const [hookForm, setHookForm] = useState<{ name: string; url: string; events: WebhookEvent[] }>({
    name: '',
    url: '',
    events: ['ticket.created', 'message.created'],
  });
  const [revealedHookSecret, setRevealedHookSecret] = useState<string | null>(null);
  const [deleteHookTarget, setDeleteHookTarget] = useState<WorkspaceWebhook | null>(null);

  const { data, error, loading, reload } = useData<WorkspaceSettingsBundle>(
    () => fetchWorkspaceSettingsBundle(workspace!.id),
    ['settings-studio', workspace?.id],
    { enabled: Boolean(workspace?.id) },
  );

  if (!workspace) return null;

  const gState = generalDraft ?? (data
    ? {
        name: data.workspace.name,
        websiteUrl: data.workspace.websiteUrl,
        timezone: data.workspace.timezone,
        language: data.workspace.language,
        industry: data.workspace.industry,
        autoCloseDays: data.workspace.autoCloseDays,
        supportEmail: data.companyProfile.supportEmail,
        replyLanguage: data.companyProfile.replyLanguage,
        legalName: data.companyProfile.legalName,
      }
    : null);

  const bState = brandingDraft ?? (data
    ? {
        brandColor: data.workspace.brandColor,
        logoUrl: data.workspace.logoUrl,
        widgetPosition: data.workspace.widgetPosition,
        greetingTitle: data.workspace.greetingTitle,
        greetingMessage: data.workspace.greetingMessage,
      }
    : null);

  const aState = aiDraft ?? (data
    ? {
        copilotSuggestions: data.aiBehavior.copilotSuggestions,
        autoSummarizeHandoff: data.aiBehavior.autoSummarizeHandoff,
        sentimentScoring: data.aiBehavior.sentimentScoring,
        autoTranslate: data.aiBehavior.autoTranslate,
        draftOnly: data.aiBehavior.draftOnly,
        knowledgeSourceMode: data.aiBehavior.knowledgeSourceMode,
        tone: data.aiBehavior.tone,
        aiMonthlyCostCapUsd:
          data.workspace.aiMonthlyCostCapUsd !== null
            ? String(data.workspace.aiMonthlyCostCapUsd)
            : '',
      }
    : null);

  const nState = notifDraft ?? data?.notifications ?? null;

  const sState = securityDraft ?? (data
    ? {
        require2fa: data.workspace.require2fa,
        dataRetentionDays: data.workspace.dataRetentionDays,
        sessionTimeoutHours: data.securityPolicies.sessionTimeoutHours,
        ipAllowlistRaw: data.securityPolicies.ipAllowlist.join('\n'),
      }
    : null);

  const copyText = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val);
      show({ message: `${label} copied`, tone: 'ok' });
    } catch {
      show({ message: 'Copy failed', tone: 'info' });
    }
  };

  const handleSaveGeneral = async () => {
    if (!gState) return;
    setBusyKey('save-general');
    const res = await saveWorkspaceGeneralStudioAction(workspace.id, gState);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Could not save general settings', tone: 'bad' });
      return;
    }
    setGeneralDraft(null);
    show({ message: 'Workspace details saved', tone: 'ok' });
    reload();
  };

  const handleSaveBranding = async () => {
    if (!bState) return;
    setBusyKey('save-branding');
    const res = await saveWorkspaceBrandingStudioAction(workspace.id, bState);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Could not save branding', tone: 'bad' });
      return;
    }
    setBrandingDraft(null);
    show({ message: 'Branding & widget saved', tone: 'ok' });
    reload();
  };

  const handleSaveAi = async () => {
    if (!aState) return;
    setBusyKey('save-ai');
    const capNum = Number(aState.aiMonthlyCostCapUsd);
    const res = await saveWorkspaceAiBehaviorStudioAction(workspace.id, {
      copilotSuggestions: aState.copilotSuggestions,
      autoSummarizeHandoff: aState.autoSummarizeHandoff,
      sentimentScoring: aState.sentimentScoring,
      autoTranslate: aState.autoTranslate,
      draftOnly: aState.draftOnly,
      knowledgeSourceMode: aState.knowledgeSourceMode,
      tone: aState.tone,
      aiMonthlyCostCapUsd:
        aState.aiMonthlyCostCapUsd.trim() && Number.isFinite(capNum) ? capNum : null,
    });
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Could not save AI behavior', tone: 'bad' });
      return;
    }
    setAiDraft(null);
    show({ message: 'AI controls updated', tone: 'ok' });
    reload();
  };

  const handleSaveNotifications = async () => {
    if (!nState) return;
    setBusyKey('save-notif');
    const res = await saveWorkspaceNotificationMatrixAction(workspace.id, nState);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Could not save notifications', tone: 'bad' });
      return;
    }
    setNotifDraft(null);
    show({ message: 'Notification matrix saved', tone: 'ok' });
    reload();
  };

  const handleSaveSecurity = async () => {
    if (!sState) return;
    setBusyKey('save-sec');
    const res = await saveWorkspaceSecurityStudioAction(workspace.id, sState);
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Could not save security settings', tone: 'bad' });
      return;
    }
    setSecurityDraft(null);
    show({ message: 'Security policies updated', tone: 'ok' });
    reload();
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      show({ message: 'Enter a name for this API key', tone: 'bad' });
      return;
    }
    setBusyKey('create-key');
    const res = await createStudioApiKeyAction(workspace.id, newKeyName.trim());
    setBusyKey(null);
    if (!res.success) {
      show({ message: res.error || 'Could not create API key', tone: 'bad' });
      return;
    }
    setCreateKeyModal(false);
    setNewKeyName('');
    setRevealedKeyToken(res.key);
    show({ message: 'API key created — copy it now', tone: 'ok' });
    reload();
  };

  const handleRevokeApiKey = async () => {
    if (!revokeTarget) return;
    setBusyKey('revoke-key');
    const res = await revokeStudioApiKeyAction(workspace.id, revokeTarget.id);
    setBusyKey(null);
    setRevokeTarget(null);
    if (!res.success) {
      show({ message: res.error || 'Could not revoke API key', tone: 'bad' });
      return;
    }
    show({ message: 'API key revoked', tone: 'ok' });
    reload();
  };

  const handleCreateWebhook = async () => {
    setBusyKey('create-hook');
    try {
      const res = await createStudioWebhookAction(workspace.id, hookForm);
      setBusyKey(null);
      setCreateHookModal(false);
      setHookForm({ name: '', url: '', events: ['ticket.created', 'message.created'] });
      setRevealedHookSecret(res.secret);
      show({ message: 'Webhook endpoint created', tone: 'ok' });
      reload();
    } catch (err) {
      setBusyKey(null);
      show({ message: err instanceof Error ? err.message : 'Could not create webhook', tone: 'bad' });
    }
  };

  const filteredNav = SETTINGS_NAV.map((grp) => ({
    ...grp,
    items: grp.items.filter((it) =>
      !navSearch.trim() || it.label.toLowerCase().includes(navSearch.trim().toLowerCase()),
    ),
  })).filter((grp) => grp.items.length > 0);

  const apiKeyColumns: Column<ApiKeyRow>[] = [
    {
      key: 'name',
      header: 'Key name',
      cell: (row) => (
        <div>
          <div className="font-semibold">{row.name}</div>
          <div className="o-mono text-[12px] text-o-text-3">{row.key_prefix}••••••••</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge tone={row.revoked_at ? 'bad' : 'ok'}>{row.revoked_at ? 'Revoked' : 'Active'}</Badge>
      ),
    },
    {
      key: 'lastUsed',
      header: 'Last used',
      cell: (row) => (
        <span className="text-[13px] text-o-text-2">
          {row.last_used_at ? timeAgo(row.last_used_at) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (row) =>
        row.revoked_at ? null : (
          <Button variant="danger" size="sm" onClick={() => setRevokeTarget(row)}>
            Revoke
          </Button>
        ),
    },
  ];

  const webhookColumns: Column<WorkspaceWebhook>[] = [
    {
      key: 'endpoint',
      header: 'Endpoint',
      cell: (row) => (
        <div className="min-w-0 max-w-[260px]">
          <div className="truncate font-semibold">{row.name || 'Webhook'}</div>
          <div className="truncate o-mono text-[12px] text-o-text-3">{row.url}</div>
        </div>
      ),
    },
    {
      key: 'events',
      header: 'Events',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.events.map((ev) => (
            <Badge key={ev} tone="neutral">
              {ev}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      cell: (row) => (
        <Toggle
          label={`Toggle ${row.name || 'webhook'}`}
          checked={row.is_active}
          onChange={async (checked) => {
            try {
              await updateStudioWebhookAction(workspace.id, row.id, { is_active: checked });
              show({ message: checked ? 'Webhook activated' : 'Webhook paused', tone: 'ok' });
              reload();
            } catch (err) {
              show({ message: err instanceof Error ? err.message : 'Update failed', tone: 'bad' });
            }
          }}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                const res = await testStudioWebhookAction(workspace.id, row.id);
                show({
                  message: res.message,
                  tone: res.ok ? 'ok' : 'bad',
                });
                reload();
              } catch (err) {
                show({ message: err instanceof Error ? err.message : 'Test failed', tone: 'bad' });
              }
            }}
          >
            <Send size={13} aria-hidden="true" />
            Test
          </Button>
          <Button
            variant="quiet"
            size="sm"
            title="Rotate signing secret"
            aria-label="Rotate signing secret"
            onClick={async () => {
              try {
                const res = await rotateStudioWebhookSecretAction(workspace.id, row.id);
                setRevealedHookSecret(res.secret);
                show({ message: 'Signing secret rotated', tone: 'ok' });
                reload();
              } catch (err) {
                show({ message: err instanceof Error ? err.message : 'Rotate failed', tone: 'bad' });
              }
            }}
          >
            <RefreshCw size={13} aria-hidden="true" />
          </Button>
          <Button
            variant="quiet"
            size="sm"
            aria-label="Delete webhook"
            onClick={() => setDeleteHookTarget(row)}
          >
            <Trash2 size={13} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Configure your workspace identity, branding, AI guardrails, developer APIs, and security."
        actions={
          <ButtonLink href="/app/settings/emails" variant="secondary" size="sm">
            <Mail size={14} aria-hidden="true" />
            Email templates
          </ButtonLink>
        }
      />

      {error ? (
        <ErrorState title="Could not load settings" body={error} onRetry={reload} />
      ) : loading || !data || !gState || !bState || !aState || !nState || !sState ? (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <Skeleton className="h-[460px] rounded-[24px]" />
          <Skeleton className="h-[460px] rounded-[24px]" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr] lg:items-start">
          {/* Left grouped settings rail */}
          <Card className="p-3">
            <div className="relative mb-3">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-o-text-3"
                aria-hidden="true"
              />
              <Input
                size="sm"
                className="pl-8"
                placeholder="Jump to setting…"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-3">
              {filteredNav.map((grp) => (
                <div key={grp.group}>
                  <div className="px-2.5 pb-1 text-[11.5px] font-semibold uppercase tracking-wide text-o-text-3">
                    {grp.group}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {grp.items.map((item) => {
                      const Icon = item.icon;
                      const active = section === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSection(item.id)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-full px-3 py-2 text-[13.5px] font-semibold transition-colors text-left',
                            active
                              ? 'bg-o-lime text-o-on-lime'
                              : 'text-o-text-2 hover:bg-o-surface-2 hover:text-o-text',
                          )}
                        >
                          <Icon size={15} aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="border-t border-o-border pt-2 flex flex-col gap-1">
                <Link
                  href="/app/settings/emails"
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-o-text-2 no-underline hover:bg-o-surface-2 hover:text-o-text"
                >
                  <Mail size={14} aria-hidden="true" />
                  Transactional emails
                </Link>
                <Link
                  href="/app/billing"
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-o-text-2 no-underline hover:bg-o-surface-2 hover:text-o-text"
                >
                  <Globe size={14} aria-hidden="true" />
                  Billing & plan
                </Link>
              </div>
            </div>
          </Card>

          {/* Right active panel */}
          <div className="flex flex-col gap-5">
            {section === 'general' ? (
              <>
                <Card>
                  <CardHeader
                    title="Workspace identity"
                    sub="Public workspace name, slug identifier, and appearance."
                  />
                  <div className="mt-4 flex flex-col gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Workspace name">
                        <Input
                          value={gState.name}
                          onChange={(e) => setGeneralDraft({ ...gState, name: e.target.value })}
                        />
                      </Field>
                      <Field label="Workspace slug">
                        <Input value={data.workspace.slug} readOnly />
                      </Field>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-o-surface-2 px-4 py-3">
                      <div>
                        <div className="text-[14px] font-semibold">Appearance theme</div>
                        <div className="text-[12.5px] text-o-text-3">
                          Switches ORBAT between crisp day light and low-glare dark mode.
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={toggle}>
                        {theme === 'dark' ? (
                          <>
                            <Sun size={14} aria-hidden="true" />
                            Light mode
                          </>
                        ) : (
                          <>
                            <Moon size={14} aria-hidden="true" />
                            Dark mode
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="primary"
                        loading={busyKey === 'save-general'}
                        onClick={handleSaveGeneral}
                      >
                        Save workspace identity
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="border-[var(--bad)]/30">
                  <CardHeader
                    title="Danger zone"
                    sub="Schedule workspace deletion (14-day grace period; owner permission required)."
                  />
                  {data.workspace.scheduledDeletionAt ? (
                    <Alert tone="bad" className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span>
                        Deletion scheduled for{' '}
                        {new Date(data.workspace.scheduledDeletionAt).toLocaleDateString()}.
                      </span>
                      {data.role === 'owner' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={busyKey === 'cancel-del'}
                          onClick={async () => {
                            setBusyKey('cancel-del');
                            const res = await cancelWorkspaceDeletionAction(workspace.id);
                            setBusyKey(null);
                            if (!res.success) {
                              show({ message: res.error || 'Could not cancel deletion', tone: 'bad' });
                            } else {
                              show({ message: 'Workspace deletion canceled', tone: 'ok' });
                              reload();
                            }
                          }}
                        >
                          Cancel deletion
                        </Button>
                      ) : null}
                    </Alert>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[13.5px] text-o-text-2">
                        <AlertTriangle size={16} className="text-[var(--bad)]" aria-hidden="true" />
                        Deleting removes all conversations, knowledge documents, and channels.
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={data.role !== 'owner'}
                        onClick={() => {
                          setConfirmSlug('');
                          setDeleteModalOpen(true);
                        }}
                      >
                        {data.role === 'owner' ? 'Schedule deletion' : 'Owner only'}
                      </Button>
                    </div>
                  )}
                </Card>
              </>
            ) : null}

            {section === 'company' ? (
              <Card>
                <CardHeader
                  title="Company profile & localization"
                  sub="Support email, industry preset, timezone, and default customer reply language."
                />
                <div className="mt-4 flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Legal entity name">
                      <Input
                        value={gState.legalName}
                        onChange={(e) => setGeneralDraft({ ...gState, legalName: e.target.value })}
                      />
                    </Field>
                    <Field label="Primary support email">
                      <Input
                        type="email"
                        value={gState.supportEmail}
                        placeholder="support@acme.com"
                        onChange={(e) => setGeneralDraft({ ...gState, supportEmail: e.target.value })}
                      />
                    </Field>
                    <Field label="Company website">
                      <Input
                        value={gState.websiteUrl}
                        placeholder="https://acme.com"
                        onChange={(e) => setGeneralDraft({ ...gState, websiteUrl: e.target.value })}
                      />
                    </Field>
                    <Field label="Industry">
                      <Select
                        value={gState.industry}
                        onChange={(e) => setGeneralDraft({ ...gState, industry: e.target.value })}
                        options={[
                          { value: 'saas', label: 'SaaS & Software' },
                          { value: 'ecommerce', label: 'E-commerce & Retail' },
                          { value: 'fintech', label: 'Fintech & Payments' },
                          { value: 'healthcare', label: 'Healthcare' },
                          { value: 'education', label: 'Education' },
                          { value: 'other', label: 'Other' },
                        ]}
                      />
                    </Field>
                    <Field label="Workspace timezone">
                      <Input
                        value={gState.timezone}
                        onChange={(e) => setGeneralDraft({ ...gState, timezone: e.target.value })}
                      />
                    </Field>
                    <Field label="Default reply language">
                      <Select
                        value={gState.replyLanguage}
                        onChange={(e) => setGeneralDraft({ ...gState, replyLanguage: e.target.value })}
                        options={[
                          { value: 'en', label: 'English (en)' },
                          { value: 'es', label: 'Spanish (es)' },
                          { value: 'fr', label: 'French (fr)' },
                          { value: 'de', label: 'German (de)' },
                          { value: 'ar', label: 'Arabic (ar)' },
                          { value: 'ur', label: 'Urdu (ur)' },
                        ]}
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      loading={busyKey === 'save-general'}
                      onClick={handleSaveGeneral}
                    >
                      Save company profile
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {section === 'branding' ? (
              <Card>
                <CardHeader
                  title="Branding & chat widget appearance"
                  sub="Brand color, logo URL, launcher position, and default greeting."
                />
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-o-surface-2 p-4">
                    <div>
                      <div className="text-[14px] font-semibold">Accent color</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {BRAND_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            aria-label={`Color ${hex}`}
                            onClick={() => setBrandingDraft({ ...bState, brandColor: hex })}
                            className={cn(
                              'h-8 w-8 rounded-full border-2 transition-transform',
                              bState.brandColor.toLowerCase() === hex
                                ? 'scale-110 border-o-text'
                                : 'border-transparent',
                            )}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                        <Input
                          className="w-28 o-mono text-[13px]"
                          value={bState.brandColor}
                          onChange={(e) =>
                            setBrandingDraft({ ...bState, brandColor: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div
                      className="flex h-12 items-center gap-2 rounded-full px-5 font-semibold text-white shadow-sm"
                      style={{ backgroundColor: bState.brandColor }}
                    >
                      Preview launcher
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Workspace logo URL">
                      <Input
                        value={bState.logoUrl}
                        placeholder="https://cdn.example.com/logo.png"
                        onChange={(e) => setBrandingDraft({ ...bState, logoUrl: e.target.value })}
                      />
                    </Field>
                    <Field label="Launcher position">
                      <Select
                        value={bState.widgetPosition}
                        onChange={(e) =>
                          setBrandingDraft({
                            ...bState,
                            widgetPosition: e.target.value === 'left' ? 'left' : 'right',
                          })
                        }
                        options={[
                          { value: 'right', label: 'Bottom right' },
                          { value: 'left', label: 'Bottom left' },
                        ]}
                      />
                    </Field>
                    <Field label="Greeting title">
                      <Input
                        value={bState.greetingTitle}
                        onChange={(e) =>
                          setBrandingDraft({ ...bState, greetingTitle: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Help Center domain">
                      <Input
                        value={data.customDomainSummary.domain || 'Default hosted subdomain'}
                        readOnly
                      />
                    </Field>
                  </div>

                  <Field label="Greeting subtitle">
                    <Textarea
                      rows={2}
                      value={bState.greetingMessage}
                      onChange={(e) =>
                        setBrandingDraft({ ...bState, greetingMessage: e.target.value })
                      }
                    />
                  </Field>

                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      loading={busyKey === 'save-branding'}
                      onClick={handleSaveBranding}
                    >
                      Save branding
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {section === 'inbox' ? (
              <Card>
                <CardHeader
                  title="Inbox behavior & auto-close"
                  sub="Configure automatic resolution windows and operational team workflows."
                />
                <div className="mt-4 flex flex-col gap-4">
                  <Field
                    label="Auto-close inactive conversations after (days)"
                    hint="Resolved or snoozed conversations automatically close after this many idle days."
                  >
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={gState.autoCloseDays}
                      onChange={(e) =>
                        setGeneralDraft({
                          ...gState,
                          autoCloseDays: Math.max(1, Number(e.target.value) || 14),
                        })
                      }
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/app/team/schedule"
                      className="rounded-2xl bg-o-surface-2 p-4 no-underline hover:bg-o-surface-3"
                    >
                      <div className="font-semibold text-o-text">Team business hours & SLA schedules →</div>
                      <div className="mt-1 text-[12.5px] text-o-text-3">
                        Configure shift rosters, holidays, and on-call rotations.
                      </div>
                    </Link>
                    <Link
                      href="/app/settings/emails"
                      className="rounded-2xl bg-o-surface-2 p-4 no-underline hover:bg-o-surface-3"
                    >
                      <div className="font-semibold text-o-text">Transactional email templates →</div>
                      <div className="mt-1 text-[12.5px] text-o-text-3">
                        Edit ticket replies, missed chat alerts, and rating requests.
                      </div>
                    </Link>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      loading={busyKey === 'save-general'}
                      onClick={handleSaveGeneral}
                    >
                      Save inbox settings
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {section === 'ai' || section === 'knowledge' ? (
              <Card>
                <CardHeader
                  title={section === 'knowledge' ? 'Knowledge & grounding source' : 'AI assistant controls'}
                  sub="Control workspace-wide AI copilots, draft-only guardrails, and spend limits."
                  actions={<Badge tone="ai">Workspace AI</Badge>}
                />
                <div className="mt-4 flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Default assistant tone">
                      <Select
                        value={aState.tone}
                        onChange={(e) => setAiDraft({ ...aState, tone: e.target.value })}
                        options={[
                          { value: 'friendly', label: 'Warm & conversational' },
                          { value: 'professional', label: 'Formal & executive' },
                          { value: 'concise', label: 'Short & direct' },
                        ]}
                      />
                    </Field>
                    <Field label="Monthly AI spend cap (USD)" hint="Leave blank for no soft cap">
                      <Input
                        type="number"
                        min={5}
                        placeholder="e.g. 300"
                        value={aState.aiMonthlyCostCapUsd}
                        onChange={(e) =>
                          setAiDraft({ ...aState, aiMonthlyCostCapUsd: e.target.value })
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Allowed AI grounding corpus">
                    <Segmented<'site_and_docs' | 'uploads_only'>
                      label="Knowledge source mode"
                      value={aState.knowledgeSourceMode}
                      onChange={(mode) => setAiDraft({ ...aState, knowledgeSourceMode: mode })}
                      items={[
                        { id: 'site_and_docs', label: 'Synced site + docs + articles' },
                        { id: 'uploads_only', label: 'Verified docs & notes only' },
                      ]}
                    />
                  </Field>

                  <div className="flex flex-col gap-2.5">
                    {[
                      {
                        key: 'copilotSuggestions' as const,
                        label: 'Copilot suggested replies',
                        desc: 'Show suggested AI drafts directly in agent composer.',
                      },
                      {
                        key: 'autoSummarizeHandoff' as const,
                        label: 'Auto-summarize on handoff',
                        desc: 'Attach a crisp context bullet summary when escalating to humans.',
                      },
                      {
                        key: 'sentimentScoring' as const,
                        label: 'Customer sentiment scoring',
                        desc: 'Classify urgent, frustrated, or positive tone inside Inbox.',
                      },
                      {
                        key: 'autoTranslate' as const,
                        label: 'Auto-translate multi-lingual chats',
                        desc: 'Translate foreign incoming threads cleanly for agents.',
                      },
                      {
                        key: 'draftOnly' as const,
                        label: 'Draft-only safeguard',
                        desc: 'Require a human click before sending any AI reply to customers.',
                      },
                    ].map((row) => (
                      <div
                        key={row.key}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-o-surface-2 px-4 py-3"
                      >
                        <div>
                          <div className="text-[14px] font-semibold">{row.label}</div>
                          <div className="text-[12.5px] text-o-text-3">{row.desc}</div>
                        </div>
                        <Toggle
                          label={row.label}
                          checked={aState[row.key]}
                          onChange={(checked) => setAiDraft({ ...aState, [row.key]: checked })}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ButtonLink href="/app/knowledge" variant="secondary" size="sm">
                      Manage Knowledge base →
                    </ButtonLink>
                    <Button variant="primary" loading={busyKey === 'save-ai'} onClick={handleSaveAi}>
                      Save AI controls
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {section === 'notifications' ? (
              <Card>
                <CardHeader
                  title="Notification matrix"
                  sub="Choose which operational triggers ping Desktop, Email, and Mobile alerts."
                />
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr className="border-b border-o-border text-[12.5px] text-o-text-3">
                        <th className="py-2 pr-4 font-semibold">Event</th>
                        <th className="py-2 px-3 text-center font-semibold">Desktop</th>
                        <th className="py-2 px-3 text-center font-semibold">Email</th>
                        <th className="py-2 px-3 text-center font-semibold">Mobile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-o-border">
                      {[
                        {
                          label: 'New inbound conversation',
                          d: 'newConversationDesktop' as const,
                          e: 'newConversationEmail' as const,
                          m: 'newConversationMobile' as const,
                        },
                        {
                          label: 'Conversation assigned to me',
                          d: 'assignedDesktop' as const,
                          e: 'assignedEmail' as const,
                          m: 'assignedMobile' as const,
                        },
                        {
                          label: 'SLA breach warning',
                          d: 'slaWarningDesktop' as const,
                          e: 'slaWarningEmail' as const,
                          m: 'slaWarningMobile' as const,
                        },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className="py-3 pr-4 font-medium">{row.label}</td>
                          {([row.d, row.e, row.m] as const).map((fieldKey) => (
                            <td key={fieldKey} className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[var(--forest)]"
                                checked={nState[fieldKey]}
                                onChange={(ev) =>
                                  setNotifDraft({ ...nState, [fieldKey]: ev.target.checked })
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <td className="py-3 pr-4 font-medium">Weekly executive digest</td>
                        <td className="py-3 px-3 text-center text-o-text-3">—</td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--forest)]"
                            checked={nState.weeklyDigestEmail}
                            onChange={(ev) =>
                              setNotifDraft({ ...nState, weeklyDigestEmail: ev.target.checked })
                            }
                          />
                        </td>
                        <td className="py-3 px-3 text-center text-o-text-3">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="primary"
                    loading={busyKey === 'save-notif'}
                    onClick={handleSaveNotifications}
                  >
                    Save notification preferences
                  </Button>
                </div>
              </Card>
            ) : null}

            {section === 'security' || section === 'data' ? (
              <Card>
                <CardHeader
                  title={section === 'data' ? 'Data retention & compliance' : 'Security & access controls'}
                  sub="Enforce two-factor authentication, session idle windows, IP rules, and retention."
                />
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-o-surface-2 px-4 py-3">
                    <div>
                      <div className="text-[14px] font-semibold">Require 2FA for all teammates</div>
                      <div className="text-[12.5px] text-o-text-3">
                        Teammates manage authenticator codes directly in My profile.
                      </div>
                    </div>
                    <Toggle
                      label="Require 2FA"
                      checked={sState.require2fa}
                      onChange={(checked) => setSecurityDraft({ ...sState, require2fa: checked })}
                    />
                  </div>

                  <Alert tone="ok">
                    SSO status: {data.securityPolicies.ssoConfigured ? data.securityPolicies.ssoProvider : 'Workspace uses Google OAuth & passwordless/email authentication'}.{' '}
                    <Link href="/app/compliance" className="font-semibold underline">
                      View audit log ({data.auditLogsCount} recent events) →
                    </Link>
                  </Alert>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Session timeout (hours)">
                      <Input
                        type="number"
                        min={1}
                        max={720}
                        value={sState.sessionTimeoutHours}
                        onChange={(e) =>
                          setSecurityDraft({
                            ...sState,
                            sessionTimeoutHours: Number(e.target.value) || 168,
                          })
                        }
                      />
                    </Field>
                    <Field label="Conversation & log retention (days)">
                      <Input
                        type="number"
                        min={30}
                        max={3650}
                        value={sState.dataRetentionDays}
                        onChange={(e) =>
                          setSecurityDraft({
                            ...sState,
                            dataRetentionDays: Number(e.target.value) || 365,
                          })
                        }
                      />
                    </Field>
                  </div>

                  <Field label="IP allowlist (optional, one CIDR or IP per line)">
                    <Textarea
                      rows={3}
                      value={sState.ipAllowlistRaw}
                      placeholder="203.0.113.0/24&#10;198.51.100.14"
                      onChange={(e) =>
                        setSecurityDraft({ ...sState, ipAllowlistRaw: e.target.value })
                      }
                    />
                  </Field>

                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      loading={busyKey === 'save-sec'}
                      onClick={handleSaveSecurity}
                    >
                      Save security & retention
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {section === 'api_keys' ? (
              <Card>
                <CardHeader
                  title="Workspace API keys"
                  sub="Authenticate requests against /api/v1. Plaintext tokens are shown only once when generated."
                  actions={
                    <Button variant="primary" size="sm" onClick={() => setCreateKeyModal(true)}>
                      <Plus size={14} aria-hidden="true" />
                      Create key
                    </Button>
                  }
                />

                {revealedKeyToken ? (
                  <Alert tone="ok" className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">Copy your new API key now — it will not be shown again:</div>
                      <code className="o-mono text-[12.5px] break-all">{revealedKeyToken}</code>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => copyText(revealedKeyToken, 'API key')}
                    >
                      <Copy size={14} aria-hidden="true" />
                      Copy key
                    </Button>
                  </Alert>
                ) : null}

                {data.apiKeys.length === 0 ? (
                  <EmptyState
                    className="mt-4"
                    icon={<KeyRound size={22} />}
                    title="No API keys generated"
                    body="Create a server API key to sync CRM contacts or create tickets programmatically."
                    action={
                      <Button variant="primary" size="sm" onClick={() => setCreateKeyModal(true)}>
                        Generate first key
                      </Button>
                    }
                  />
                ) : (
                  <div className="mt-4">
                    <Table
                      caption="Workspace API keys"
                      rows={data.apiKeys}
                      rowKey={(r) => r.id}
                      columns={apiKeyColumns}
                    />
                  </div>
                )}
              </Card>
            ) : null}

            {section === 'webhooks' ? (
              <Card>
                <CardHeader
                  title="Signed webhooks"
                  sub="Receive real-time HMAC-signed JSON deliveries on ticket and message events."
                  actions={
                    <Button variant="primary" size="sm" onClick={() => setCreateHookModal(true)}>
                      <Plus size={14} aria-hidden="true" />
                      Add webhook
                    </Button>
                  }
                />

                {revealedHookSecret ? (
                  <Alert tone="ok" className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">Signing secret ready:</div>
                      <code className="o-mono text-[12.5px] break-all">{revealedHookSecret}</code>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => copyText(revealedHookSecret, 'Webhook secret')}
                    >
                      <Copy size={14} aria-hidden="true" />
                      Copy
                    </Button>
                  </Alert>
                ) : null}

                {data.webhooks.length === 0 ? (
                  <EmptyState
                    className="mt-4"
                    icon={<Webhook size={22} />}
                    title="No webhook endpoints configured"
                    body="Subscribe your backend or Zapier workflow to live ticket and message triggers."
                    action={
                      <Button variant="primary" size="sm" onClick={() => setCreateHookModal(true)}>
                        Add webhook endpoint
                      </Button>
                    }
                  />
                ) : (
                  <div className="mt-4">
                    <Table
                      caption="Workspace webhooks"
                      rows={data.webhooks}
                      rowKey={(r) => r.id}
                      columns={webhookColumns}
                    />
                  </div>
                )}
              </Card>
            ) : null}
          </div>
        </div>
      )}

      {/* Delete Workspace Confirm Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Schedule workspace deletion"
        description={`Type "${data?.workspace.slug || ''}" exactly to confirm a 14-day scheduled deletion.`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busyKey === 'delete-ws'}
              onClick={async () => {
                setBusyKey('delete-ws');
                const res = await scheduleWorkspaceDeletionAction(workspace.id, confirmSlug);
                setBusyKey(null);
                if (!res.success) {
                  show({ message: res.error || 'Confirmation failed', tone: 'bad' });
                  return;
                }
                setDeleteModalOpen(false);
                show({ message: 'Workspace deletion scheduled (+14 days)', tone: 'info' });
                reload();
              }}
            >
              Confirm schedule deletion
            </Button>
          </>
        }
      >
        <Field label="Workspace slug confirmation">
          <Input
            value={confirmSlug}
            placeholder={data?.workspace.slug}
            onChange={(e) => setConfirmSlug(e.target.value)}
          />
        </Field>
      </Modal>

      {/* Create API key Modal */}
      <Modal
        open={createKeyModal}
        onClose={() => setCreateKeyModal(false)}
        title="Generate API key"
        footer={
          <>
            <Button variant="quiet" onClick={() => setCreateKeyModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'create-key'} onClick={handleCreateApiKey}>
              Create key
            </Button>
          </>
        }
      >
        <Field label="Key label">
          <Input
            placeholder="e.g. CRM backend sync"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
        </Field>
      </Modal>

      {/* Revoke API key Confirm */}
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevokeApiKey}
        busy={busyKey === 'revoke-key'}
        title={`Revoke API key "${revokeTarget?.name ?? ''}"?`}
        body="Requests using this key will fail immediately with 401 Unauthorized."
        confirmLabel="Revoke key"
      />

      {/* Add Webhook Modal */}
      <Modal
        open={createHookModal}
        onClose={() => setCreateHookModal(false)}
        title="Add signed webhook endpoint"
        footer={
          <>
            <Button variant="quiet" onClick={() => setCreateHookModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'create-hook'} onClick={handleCreateWebhook}>
              Create webhook
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <Input
              placeholder="e.g. Data warehouse ingest"
              value={hookForm.name}
              onChange={(e) => setHookForm({ ...hookForm, name: e.target.value })}
            />
          </Field>
          <Field label="Public HTTPS URL">
            <Input
              type="url"
              placeholder="https://api.example.com/webhooks/orbat"
              value={hookForm.url}
              onChange={(e) => setHookForm({ ...hookForm, url: e.target.value })}
            />
          </Field>
          <div>
            <div className="mb-1.5 text-[13px] font-semibold">Events to deliver</div>
            <div className="flex flex-col gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-start gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--forest)]"
                    checked={hookForm.events.includes(ev)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...hookForm.events, ev]
                        : hookForm.events.filter((x) => x !== ev);
                      setHookForm({ ...hookForm, events: next });
                    }}
                  />
                  <span>
                    <span className="o-mono font-semibold">{ev}</span>
                    <span className="block text-[12px] text-o-text-3">
                      {WEBHOOK_EVENT_LABELS[ev]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Webhook Confirm */}
      <ConfirmDialog
        open={Boolean(deleteHookTarget)}
        onClose={() => setDeleteHookTarget(null)}
        onConfirm={async () => {
          if (!deleteHookTarget) return;
          setBusyKey('del-hook');
          try {
            await deleteStudioWebhookAction(workspace.id, deleteHookTarget.id);
            show({ message: 'Webhook deleted', tone: 'ok' });
          } catch (err) {
            show({ message: err instanceof Error ? err.message : 'Delete failed', tone: 'bad' });
          } finally {
            setBusyKey(null);
            setDeleteHookTarget(null);
            reload();
          }
        }}
        busy={busyKey === 'del-hook'}
        title={`Delete webhook "${deleteHookTarget?.name || 'endpoint'}"?`}
        body="No future events will be delivered to this URL."
        confirmLabel="Delete webhook"
      />
    </PageContainer>
  );
}
