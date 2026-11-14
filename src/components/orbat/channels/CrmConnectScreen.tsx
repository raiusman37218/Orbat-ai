'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Copy,
  Globe,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  Skeleton,
  Toggle,
  useOrbToast,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, timeAgo } from '@/components/orbat/overview/format';
import {
  fetchCommerceConnection,
  saveCommerceConnectionAction,
  type CommerceActionsState,
  type CommerceConnectionBundle,
} from '@/lib/data/channels';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

type PlatformKind = 'shopify' | 'woocommerce' | 'custom';

const PLATFORM_CARDS: {
  id: PlatformKind;
  title: string;
  subtitle: string;
  icon: typeof Store;
}[] = [
  {
    id: 'shopify',
    title: 'Shopify',
    subtitle: 'Sync storefront orders, customer tags & return checks',
    icon: ShoppingBag,
  },
  {
    id: 'woocommerce',
    title: 'WordPress / WooCommerce',
    subtitle: 'Connect plugin & REST order context',
    icon: Store,
  },
  {
    id: 'custom',
    title: 'Custom website',
    subtitle: 'Install lightweight JS tag on React, Next.js or HTML',
    icon: Globe,
  },
];

const AI_ACTION_ITEMS: {
  key: keyof CommerceActionsState;
  label: string;
  description: string;
}[] = [
  { key: 'track', label: 'Track order status', description: 'Look up carrier tracking & fulfillment stage in replies.' },
  { key: 'return', label: 'Start return / RMA', description: 'Guide eligible buyers through return verification.' },
  { key: 'cod', label: 'Verify cash-on-delivery orders', description: 'Confirm phone & address on unshipped COD orders.' },
  { key: 'wallet', label: 'Check store credit & gift balance', description: 'Read verified account wallet balance cleanly.' },
  { key: 'book', label: 'Book consultations / demos', description: 'Capture requested appointment slots for handoff.' },
  { key: 'lead', label: 'Qualify & capture leads', description: 'Enrich visitor profile fields into Customers CRM.' },
];

export function CrmConnectScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();

  const [draft, setDraft] = useState<{
    platform: PlatformKind;
    storeUrl: string;
    storeName: string;
    aiActions: CommerceActionsState;
    industryFields: string[];
  } | null>(null);
  const [newFieldTag, setNewFieldTag] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, error, loading, reload } = useData<CommerceConnectionBundle>(
    () => fetchCommerceConnection(workspace!.id),
    ['crm-connect', workspace?.id],
    { enabled: Boolean(workspace?.id) },
  );

  if (!workspace) return null;

  const state = draft ?? (data
    ? {
        platform: data.platform,
        storeUrl: data.storeUrl,
        storeName: data.storeName,
        aiActions: data.aiActions,
        industryFields: data.industryFields,
      }
    : null);

  const handleSave = async (verifyReachable: boolean) => {
    if (!state) return;
    setSaving(true);
    const res = await saveCommerceConnectionAction(workspace.id, {
      ...state,
      verifyReachable,
    });
    setSaving(false);
    if (!res.success) {
      show({ message: res.error || 'Could not save store configuration', tone: 'bad' });
      return;
    }
    setDraft(null);
    if (verifyReachable && res.verified) {
      show({ message: 'Storefront URL reachable & connection saved', tone: 'ok' });
    } else if (verifyReachable) {
      show({ message: 'Saved configuration, but storefront URL could not be reached right now', tone: 'info' });
    } else {
      show({ message: 'Website & CRM preferences saved', tone: 'ok' });
    }
    reload();
  };

  const addFieldTag = () => {
    if (!state) return;
    const cleaned = newFieldTag.trim().replace(/\s+/g, '_').toLowerCase();
    if (!cleaned) return;
    if (!state.industryFields.includes(cleaned)) {
      setDraft({ ...state, industryFields: [...state.industryFields, cleaned] });
    }
    setNewFieldTag('');
  };

  const copySnippet = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      show({ message: 'Embed snippet copied', tone: 'ok' });
    } catch {
      show({ message: 'Copy failed', tone: 'info' });
    }
  };

  const steps = data && state
    ? [
        { label: 'Choose storefront platform', done: Boolean(state.platform) },
        { label: 'Set storefront URL & install tag', done: Boolean(state.storeUrl.trim()) },
        { label: 'Verify domain handshake', done: Boolean(data.lastVerifiedAt) },
        { label: 'Receive live customer / order records', done: data.syncedMetrics.customersCount > 0 || data.syncedMetrics.ordersCount > 0 },
        { label: 'Enable autonomous AI actions', done: Object.values(state.aiActions).some(Boolean) },
      ]
    : [];

  return (
    <PageContainer>
      <PageHeader
        title="Connect your website & CRM"
        description="Connect your store so AI and human teammates see order status, LTV, and customer fields live."
        actions={
          <ButtonLink href="/app/channels" variant="secondary" size="sm">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to Channels
          </ButtonLink>
        }
      />

      {error ? (
        <ErrorState title="Could not load storefront setup" body={error} onRetry={reload} />
      ) : loading || !data || !state ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[360px] rounded-[24px]" />
          <Skeleton className="h-[360px] rounded-[24px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Platform selector cards */}
          <div className="grid gap-3 md:grid-cols-3">
            {PLATFORM_CARDS.map((card) => {
              const Icon = card.icon;
              const selected = state.platform === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDraft({ ...state, platform: card.id })}
                  className={cn(
                    'flex items-start gap-3 rounded-[20px] border p-4 text-left transition-colors',
                    selected
                      ? 'border-o-forest bg-o-lime/25'
                      : 'border-o-border bg-o-surface hover:bg-o-surface-2',
                  )}
                >
                  <div className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-o-surface-2 text-o-forest">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-o-display text-[15px] font-extrabold">{card.title}</span>
                      {selected ? <Badge tone="ok">Selected</Badge> : null}
                    </div>
                    <p className="mt-1 text-[13px] text-o-text-3">{card.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Left setup + checklist */}
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader
                  title="Storefront connection & embed script"
                  sub={
                    data.lastVerifiedAt
                      ? `Last reachable check: ${timeAgo(data.lastVerifiedAt)}`
                      : 'Save your store URL and install the script tag on your storefront.'
                  }
                  actions={
                    <Badge tone={data.status === 'connected' ? 'ok' : data.status === 'syncing' ? 'warn' : 'neutral'}>
                      {data.status === 'connected' ? 'Connected' : data.status === 'syncing' ? 'Syncing' : 'Not verified'}
                    </Badge>
                  }
                />

                <div className="mt-4 flex flex-col gap-4">
                  {state.platform === 'shopify' ? (
                    <Alert tone="ai">
                      <Sparkles size={14} className="inline mr-1.5" aria-hidden="true" />
                      Live Shopify Admin API OAuth sync requires Shopify App credentials on the server. Save your storefront URL below to install the live widget & identify customers immediately.
                    </Alert>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Storefront / website URL">
                      <Input
                        value={state.storeUrl}
                        placeholder="https://store.example.com"
                        onChange={(e) => setDraft({ ...state, storeUrl: e.target.value })}
                      />
                    </Field>
                    <Field label="Store / site label">
                      <Input
                        value={state.storeName}
                        placeholder={workspace.name}
                        onChange={(e) => setDraft({ ...state, storeName: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="rounded-2xl border border-o-border bg-o-surface-2 p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-o-text-2">
                        Widget + CRM identification tag
                      </span>
                      <Button variant="quiet" size="sm" onClick={() => copySnippet(data.snippet)}>
                        <Copy size={14} aria-hidden="true" />
                        Copy
                      </Button>
                    </div>
                    <pre className="overflow-x-auto o-mono text-[12px] leading-relaxed text-o-text-2">
                      {data.snippet}
                    </pre>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" loading={saving} onClick={() => handleSave(false)}>
                      Save draft
                    </Button>
                    <Button variant="primary" loading={saving} onClick={() => handleSave(true)}>
                      Save & test reachability
                    </Button>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Connection checklist"
                  sub={`Synced records in Postgres: ${fmtInt(data.syncedMetrics.customersCount)} customers · ${fmtInt(data.syncedMetrics.ordersCount)} orders`}
                />
                <ul className="mt-4 flex flex-col gap-2.5">
                  {steps.map((s) => (
                    <li key={s.label} className="flex items-center gap-2.5 text-[14px]">
                      {s.done ? (
                        <CheckCircle2 size={18} className="flex-none text-[var(--ok)]" aria-hidden="true" />
                      ) : (
                        <Circle size={18} className="flex-none text-o-text-3" aria-hidden="true" />
                      )}
                      <span className={s.done ? 'font-semibold text-o-text' : 'text-o-text-2'}>
                        {s.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* Right AI Actions + CRM Fields */}
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader
                  title="Actions the AI can take"
                  sub="Control what autonomous tools ORBAT AI may perform against synced customer data."
                />
                <div className="mt-4 flex flex-col gap-3">
                  {AI_ACTION_ITEMS.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-start justify-between gap-3 rounded-2xl bg-o-surface-2 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold">{item.label}</div>
                        <div className="text-[12px] text-o-text-3">{item.description}</div>
                      </div>
                      <Toggle
                        label={item.label}
                        checked={state.aiActions[item.key]}
                        onChange={(checked) =>
                          setDraft({
                            ...state,
                            aiActions: { ...state.aiActions, [item.key]: checked },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Customer context fields"
                  sub="Fields exposed in Inbox sidebar cards and AI prompt variables."
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {state.industryFields.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-o-surface-2 px-3 py-1 o-mono text-[12px] font-medium text-o-text"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove ${tag}`}
                        onClick={() =>
                          setDraft({
                            ...state,
                            industryFields: state.industryFields.filter((t) => t !== tag),
                          })
                        }
                        className="rounded-full p-0.5 hover:bg-o-surface-3"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={newFieldTag}
                    placeholder="Add field key (e.g. account_tier)"
                    onChange={(e) => setNewFieldTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFieldTag();
                      }
                    }}
                  />
                  <Button variant="secondary" size="sm" onClick={addFieldTag}>
                    <Plus size={14} aria-hidden="true" />
                    Add
                  </Button>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="primary" size="sm" loading={saving} onClick={() => handleSave(false)}>
                    Save actions & fields
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
