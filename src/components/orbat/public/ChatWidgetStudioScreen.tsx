'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Check,
  Copy,
  HelpCircle,
  Home,
  MessageSquare,
  PackageCheck,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Segmented,
  Select,
  Skeleton,
  Textarea,
  Toggle,
  useOrbToast,
} from '@/components/orbat/primitives';
import {
  loadWidgetStudio,
  saveWidgetStudioSettings,
  type WidgetStudioBundle,
} from '@/lib/data/chat-widget';
import { useData } from '@/lib/data/use-data';
import type {
  WidgetColorMode,
  WidgetDesignId,
  WidgetIconChoice,
} from '@/lib/widget/launcher-icons';
import { cn } from '@/lib/utils';

type PreviewState =
  | 'home'
  | 'messages'
  | 'help'
  | 'conversation'
  | 'otp'
  | 'csat';

const PREVIEW_STATES: Array<{ id: PreviewState; label: string }> = [
  { id: 'home', label: 'Home screen' },
  { id: 'messages', label: 'Messages' },
  { id: 'help', label: 'Help tab' },
  { id: 'conversation', label: 'Live chat + order' },
  { id: 'otp', label: 'Identity OTP' },
  { id: 'csat', label: 'CSAT survey' },
];

function LauncherPresetGlyph({ id }: { id: WidgetIconChoice }) {
  switch (id) {
    case 'dots_bubble':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
          <path d="M12 3c4.97 0 9 3.58 9 8s-4.03 8-9 8c-.97 0-1.9-.14-2.78-.39l-3.9 1.73a.8.8 0 0 1-1.09-.94l.85-3.17A7.6 7.6 0 0 1 3 11c0-4.42 4.03-8 9-8ZM8 12.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm4 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm5.3-1.3a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0Z" />
        </svg>
      );
    case 'double_bubble':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
          <path opacity="0.5" d="M10 2.5h9A2.5 2.5 0 0 1 21.5 5v5.5A2.5 2.5 0 0 1 19 13h-.6v1.9a.5.5 0 0 1-.83.37L15.6 13H10a2.5 2.5 0 0 1-2.5-2.5V5A2.5 2.5 0 0 1 10 2.5Z" />
          <path d="M5 8.5h9a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5H9.4l-2.97 2.27a.5.5 0 0 1-.83-.4V18.5H5A2.5 2.5 0 0 1 2.5 16v-5A2.5 2.5 0 0 1 5 8.5Z" />
        </svg>
      );
    case 'smile_line':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
          <path d="M6 3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-6.2l-4.13 3.1A1.05 1.05 0 0 1 6 20.26V18a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm1.75 5a1 1 0 0 0 0 2h8.5a1 1 0 1 0 0-2h-8.5Zm0 4a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5Z" />
        </svg>
      );
    case 'headset':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" strokeLinecap="round" />
          <rect x="3" y="12.5" width="5" height="6.5" rx="2.2" fill="currentColor" stroke="none" />
          <rect x="16" y="12.5" width="5" height="6.5" rx="2.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'help':
      return <HelpCircle size={22} aria-hidden="true" />;
    default:
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
          <path d="M6 3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-6.2l-4.13 3.1A1.05 1.05 0 0 1 6 20.26V18a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm2.3 7.7a.95.95 0 0 0-.43 1.27A4.7 4.7 0 0 0 12 14.6a4.7 4.7 0 0 0 4.13-2.63.95.95 0 1 0-1.7-.84A2.8 2.8 0 0 1 12 12.7a2.8 2.8 0 0 1-2.43-1.57.95.95 0 0 0-1.27-.43Z" />
        </svg>
      );
  }
}

export function ChatWidgetStudioScreen({
  initialWorkspaceKey,
}: {
  initialWorkspaceKey?: string | null;
}) {
  const [wsKey, setWsKey] = useState(initialWorkspaceKey || '');
  const { data, error, loading, reload } = useData(
    () => loadWidgetStudio(wsKey || undefined),
    ['widget-studio', wsKey],
  );

  return (
    <div className="min-h-screen bg-o-bg text-o-text">
      <header className="border-b border-o-border bg-o-surface">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <span className="grid size-8 place-items-center rounded-xl bg-o-forest font-bold text-o-lime">
                O
              </span>
              <span className="text-[16px] font-semibold text-o-text">
                ORBAT Widget Studio
              </span>
            </Link>
            <Badge tone="accent">Live embeddable runtime</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data && data.availableWorkspaces.length > 1 && (
              <Select
                size="sm"
                aria-label="Preview workspace widget"
                value={data.workspace?.id || ''}
                onChange={(e) => setWsKey(e.target.value)}
                options={data.availableWorkspaces.map((w) => ({
                  value: w.id,
                  label: w.name,
                }))}
              />
            )}
            <ButtonLink href="/app/channels" size="sm" variant="secondary">
              Channels & deploy
            </ButtonLink>
            <ButtonLink href="/app" size="sm" variant="primary">
              Workspace app
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-4 py-8 sm:px-8">
        {loading && !data ? (
          <div className="grid gap-6 lg:grid-cols-[440px_minmax(0,1fr)]">
            <Skeleton className="h-[620px] rounded-[24px]" />
            <Skeleton className="h-[620px] rounded-[24px]" />
          </div>
        ) : error && !data ? (
          <ErrorState title="Could not load widget studio" body={error} onRetry={reload} />
        ) : !data?.workspace ? (
          <EmptyState
            title="No workspace found for widget preview"
            body="Create your workspace first to customize its live messenger widget and script tag."
            action={<ButtonLink href="/v2/onboarding">Start workspace setup</ButtonLink>}
          />
        ) : (
          <WidgetStudioEditor
            key={data.workspace.id}
            bundle={data}
            onSaved={reload}
          />
        )}
      </main>
    </div>
  );
}

function WidgetStudioEditor({
  bundle,
  onSaved,
}: {
  bundle: WidgetStudioBundle;
  onSaved: () => void;
}) {
  const ws = bundle.workspace!;
  const { show } = useOrbToast();

  const [brandColor, setBrandColor] = useState(ws.brandColor);
  const [secondaryColor, setSecondaryColor] = useState(ws.secondaryColor);
  const [widgetIcon, setWidgetIcon] = useState<WidgetIconChoice>(ws.widgetIcon);
  const [widgetDesign, setWidgetDesign] = useState<WidgetDesignId>(ws.widgetDesign);
  const [widgetColorMode, setWidgetColorMode] = useState<WidgetColorMode>(ws.widgetColorMode);
  const [widgetPosition, setWidgetPosition] = useState<'left' | 'right'>(ws.widgetPosition);
  const [greetingTitle, setGreetingTitle] = useState(ws.greetingTitle);
  const [greetingMessage, setGreetingMessage] = useState(ws.greetingMessage);
  const [showHelpTab, setShowHelpTab] = useState(ws.showHelpTab);
  const [helpCenterTabLabel, setHelpCenterTabLabel] = useState(ws.helpCenterTabLabel);

  const [previewState, setPreviewState] = useState<PreviewState>('home');
  const [widgetOpen, setWidgetOpen] = useState(true);
  const [draftMsg, setDraftMsg] = useState('');
  const [testMessages, setTestMessages] = useState<
    Array<{ from: 'visitor' | 'ai'; text: string }>
  >([
    { from: 'ai', text: `Hi! Ask about orders, policies, or account help for ${ws.name}.` },
  ]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewIsDark =
    widgetColorMode === 'dark' || widgetDesign === 'midnight';

  async function handleSave() {
    setSaving(true);
    try {
      await saveWidgetStudioSettings(ws.id, {
        brandColor,
        secondaryColor,
        widgetIcon,
        widgetDesign,
        widgetColorMode,
        widgetPosition,
        greetingTitle,
        greetingMessage,
        showHelpTab,
        helpCenterTabLabel,
      });
      show({ message: `Saved widget appearance for ${ws.name}.`, tone: 'ok' });
      onSaved();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not save widget configuration.',
        tone: 'bad',
      });
    } finally {
      setSaving(false);
    }
  }

  function handleSendSampleMessage() {
    const clean = draftMsg.trim();
    if (!clean) return;
    const matched = bundle.helpArticles.find((a) =>
      a.title.toLowerCase().includes(clean.toLowerCase().split(' ')[0] || ''),
    );
    const reply = matched
      ? `Based on "${matched.title}": ${matched.summary || 'Open the Help tab for full step-by-step instructions.'}`
      : 'Preview reply: live visitors receive grounded answers from your workspace Knowledge Hub and real agent handoffs.';
    setTestMessages((prev) => [
      ...prev,
      { from: 'visitor', text: clean },
      { from: 'ai', text: reply },
    ]);
    setDraftMsg('');
    setPreviewState('conversation');
  }

  async function handleCopyEmbed() {
    try {
      await navigator.clipboard.writeText(bundle.embedSnippet);
      setCopied(true);
      show({ message: 'Embed script copied to clipboard.', tone: 'ok' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show({ message: 'Copy failed — select snippet manually.', tone: 'bad' });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start">
      {/* Left Gallery & Customization Controls */}
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader
            title={`Customize ${ws.name} messenger`}
            sub="Changes persist directly to workspaces and update /api/widget/bundle.js live."
            actions={
              bundle.canEdit ? (
                <Button size="sm" variant="primary" loading={saving} onClick={() => void handleSave()}>
                  Save widget
                </Button>
              ) : (
                <Badge tone="neutral">Read-only showcase</Badge>
              )
            }
          />

          {!bundle.canEdit && (
            <Alert tone="ai" className="mt-4">
              Viewing live preview controls. Sign in as a workspace admin to save permanent widget changes.
            </Alert>
          )}

          <div className="mt-5 flex flex-col gap-4">
            <Field label="Window design style">
              <div className="grid grid-cols-2 gap-2">
                {bundle.widgetDesigns.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setWidgetDesign(d.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left transition',
                      widgetDesign === d.id
                        ? 'border-o-forest bg-o-surface-2 font-semibold text-o-text'
                        : 'border-o-border bg-o-surface text-o-text-2 hover:border-o-border-2',
                    )}
                  >
                    <p className="text-[13.5px]">{d.label}</p>
                    <p className="line-clamp-1 text-[11.5px] font-normal text-o-text-3">
                      {d.chatFirst ? 'Opens in chat' : 'Home card'}
                    </p>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Launcher icon gallery">
              <div className="flex flex-wrap gap-2">
                {bundle.launcherIcons.map((ic) => (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setWidgetIcon(ic.id)}
                    aria-label={ic.label}
                    title={ic.label}
                    className={cn(
                      'grid size-11 place-items-center rounded-2xl border transition',
                      widgetIcon === ic.id
                        ? 'border-o-forest bg-o-forest text-white'
                        : 'border-o-border bg-o-surface text-o-text-2 hover:border-o-border-2',
                    )}
                  >
                    <LauncherPresetGlyph id={ic.id} />
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Brand colour">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-xl border border-o-border bg-transparent p-0.5"
                    aria-label="Brand colour picker"
                  />
                  <Input
                    size="sm"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Gradient accent">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-xl border border-o-border bg-transparent p-0.5"
                    aria-label="Secondary colour picker"
                  />
                  <Input
                    size="sm"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                  />
                </div>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Window color mode">
                <Select
                  value={widgetColorMode}
                  onChange={(e) => setWidgetColorMode(e.target.value as WidgetColorMode)}
                  options={bundle.widgetColorModes.map((m) => ({
                    value: m.id,
                    label: m.label,
                  }))}
                />
              </Field>
              <Field label="Launcher position">
                <Segmented
                  label="Launcher corner"
                  value={widgetPosition}
                  onChange={setWidgetPosition}
                  items={[
                    { id: 'right', label: 'Bottom right' },
                    { id: 'left', label: 'Bottom left' },
                  ]}
                />
              </Field>
            </div>

            <Field label="Greeting title">
              <Input
                value={greetingTitle}
                onChange={(e) => setGreetingTitle(e.target.value)}
              />
            </Field>
            <Field label="Greeting subtitle">
              <Textarea
                rows={2}
                value={greetingMessage}
                onChange={(e) => setGreetingMessage(e.target.value)}
              />
            </Field>

            <Toggle
              checked={showHelpTab}
              onChange={setShowHelpTab}
              label="Show Knowledge Help tab"
              description="Allows visitors to search your public Help Center inside the messenger."
            />
            {showHelpTab && (
              <Field label="Help tab label">
                <Input
                  size="sm"
                  value={helpCenterTabLabel}
                  onChange={(e) => setHelpCenterTabLabel(e.target.value)}
                />
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Website embed snippet"
            sub="Paste before </body> on your storefront or marketing site."
          />
          <pre className="mt-3 overflow-x-auto rounded-xl border border-o-border bg-o-surface-2 p-3 text-[12px] text-o-text">
            {bundle.embedSnippet}
          </pre>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leading={copied ? <Check size={14} /> : <Copy size={14} />}
              onClick={() => void handleCopyEmbed()}
            >
              {copied ? 'Copied!' : 'Copy script tag'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Right Interactive Storefront + Live Messenger Preview */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PREVIEW_STATES.map((st) => (
              <Button
                key={st.id}
                size="sm"
                variant={previewState === st.id ? 'primary' : 'secondary'}
                onClick={() => {
                  setPreviewState(st.id);
                  setWidgetOpen(true);
                }}
              >
                {st.label}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setWidgetOpen((o) => !o)}
          >
            {widgetOpen ? 'Minimize launcher' : 'Open widget window'}
          </Button>
        </div>

        {/* Simulated customer webpage stage */}
        <div className="relative min-h-[640px] overflow-hidden rounded-[28px] border border-o-border bg-o-surface-2 p-5 sm:p-8">
          {/* Mock storefront chrome */}
          <div className="mx-auto max-w-[720px] opacity-60 pointer-events-none select-none">
            <div className="flex items-center justify-between border-b border-o-border pb-4">
              <span className="h-5 w-28 rounded-full bg-o-border" />
              <div className="flex gap-3">
                <span className="h-3.5 w-14 rounded-full bg-o-border" />
                <span className="h-3.5 w-14 rounded-full bg-o-border" />
                <span className="h-3.5 w-14 rounded-full bg-o-border" />
              </div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="h-44 rounded-3xl bg-o-surface border border-o-border p-5">
                <div className="h-4 w-24 rounded-full bg-o-border" />
                <div className="mt-3 h-7 w-44 rounded-lg bg-o-border" />
                <div className="mt-6 h-9 w-28 rounded-full bg-o-border" />
              </div>
              <div className="h-44 rounded-3xl bg-o-surface border border-o-border p-5" />
            </div>
          </div>

          {/* Floating Messenger Container */}
          <div
            className={cn(
              'mt-6 flex flex-col gap-3 sm:absolute sm:bottom-6',
              widgetPosition === 'left' ? 'sm:left-6 items-start' : 'sm:right-6 items-end',
            )}
          >
            {widgetOpen && (
              <div
                className={cn(
                  'flex w-full max-w-[368px] flex-col overflow-hidden rounded-[24px] border shadow-2xl transition',
                  previewIsDark
                    ? 'border-[#2b3732] bg-[#141d19] text-[#f3f6f4]'
                    : 'border-o-border bg-white text-[#17211d]',
                )}
              >
                {/* Header */}
                <div
                  className="px-5 py-4 text-white"
                  style={
                    widgetDesign === 'minimal'
                      ? { backgroundColor: '#ffffff', color: '#17211d', borderBottom: '1px solid #e4eae6' }
                      : {
                          background: `linear-gradient(135deg, ${brandColor}, ${secondaryColor})`,
                        }
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {(bundle.teamAgents.length > 0
                          ? bundle.teamAgents.slice(0, 3)
                          : [{ id: 'ai', name: ws.name, status: 'online' }]
                        ).map((ag) => (
                          <span
                            key={ag.id}
                            className="grid size-7 place-items-center rounded-full border-2 border-white/80 bg-[#224f41] text-[11px] font-semibold text-white"
                            title={ag.name}
                          >
                            {ag.name.slice(0, 1).toUpperCase()}
                          </span>
                        ))}
                      </div>
                      <span className="text-[13.5px] font-semibold">{ws.name}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Minimize preview widget"
                      onClick={() => setWidgetOpen(false)}
                      className="rounded-lg p-1 opacity-80 hover:opacity-100"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {previewState === 'home' && (
                    <div className="mt-4">
                      <p className="text-[20px] font-semibold leading-snug">{greetingTitle}</p>
                      <p className="mt-1 text-[13px] opacity-90">{greetingMessage}</p>
                    </div>
                  )}
                </div>

                {/* Body by Preview State */}
                <div className="flex min-h-[290px] max-h-[340px] flex-col gap-3 overflow-y-auto p-4 text-[13.5px]">
                  {previewState === 'home' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewState('conversation')}
                        className={cn(
                          'flex items-center justify-between rounded-2xl border p-3.5 text-left transition',
                          previewIsDark ? 'border-[#2c3a34] bg-[#1b2722]' : 'border-[#e4eae6] bg-[#f7faf8]',
                        )}
                      >
                        <div>
                          <p className="font-semibold">Send us a message</p>
                          <p className="text-[12px] opacity-75">AI replies immediately</p>
                        </div>
                        <Send size={16} style={{ color: brandColor }} />
                      </button>

                      {bundle.helpArticles.slice(0, 2).map((art) => (
                        <div
                          key={art.id}
                          className={cn(
                            'rounded-2xl border p-3',
                            previewIsDark ? 'border-[#2c3a34]' : 'border-[#e4eae6]',
                          )}
                        >
                          <p className="font-medium">{art.title}</p>
                          {art.summary && (
                            <p className="mt-0.5 line-clamp-1 text-[12px] opacity-70">{art.summary}</p>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {previewState === 'messages' && (
                    <button
                      type="button"
                      onClick={() => setPreviewState('conversation')}
                      className={cn(
                        'rounded-2xl border p-3.5 text-left',
                        previewIsDark ? 'border-[#2c3a34] bg-[#1b2722]' : 'border-[#e4eae6] bg-[#f7faf8]',
                      )}
                    >
                      <div className="flex items-center justify-between text-[12px] opacity-75">
                        <span>{ws.name} Support</span>
                        <span>Just now</span>
                      </div>
                      <p className="mt-1 font-medium">
                        {testMessages[testMessages.length - 1]?.text}
                      </p>
                    </button>
                  )}

                  {previewState === 'help' && (
                    bundle.helpArticles.length === 0 ? (
                      <p className="py-8 text-center opacity-70">
                        No published Help Center articles yet.
                      </p>
                    ) : (
                      bundle.helpArticles.map((a) => (
                        <div
                          key={a.id}
                          className={cn(
                            'rounded-xl border p-3',
                            previewIsDark ? 'border-[#2c3a34]' : 'border-[#e4eae6]',
                          )}
                        >
                          <p className="font-semibold">{a.title}</p>
                          {a.summary && <p className="mt-0.5 text-[12px] opacity-75">{a.summary}</p>}
                        </div>
                      ))
                    )
                  )}

                  {previewState === 'conversation' && (
                    <div className="flex flex-col gap-2.5">
                      <div
                        className={cn(
                          'flex items-center justify-between rounded-xl border px-3 py-2 text-[12px]',
                          previewIsDark ? 'border-[#2c3a34] bg-[#1b2722]' : 'border-[#e4eae6] bg-[#f7faf8]',
                        )}
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <PackageCheck size={14} style={{ color: brandColor }} />
                          Order status card
                        </span>
                        <Badge tone="ok">Connected</Badge>
                      </div>
                      {testMessages.map((m, i) => (
                        <div
                          key={i}
                          className={cn(
                            'max-w-[85%] rounded-2xl px-3.5 py-2',
                            m.from === 'visitor'
                              ? 'self-end text-white'
                              : previewIsDark
                                ? 'self-start bg-[#1e2b25]'
                                : 'self-start bg-[#eef3ef]',
                          )}
                          style={m.from === 'visitor' ? { backgroundColor: brandColor } : undefined}
                        >
                          {m.text}
                        </div>
                      ))}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendSampleMessage();
                        }}
                        className="mt-2 flex gap-1.5"
                      >
                        <input
                          value={draftMsg}
                          onChange={(e) => setDraftMsg(e.target.value)}
                          placeholder="Try asking a test question..."
                          className={cn(
                            'h-9 flex-1 rounded-full border px-3 text-[13px] outline-none',
                            previewIsDark
                              ? 'border-[#2c3a34] bg-[#101714] text-white'
                              : 'border-[#d8e1dc] bg-white text-[#17211d]',
                          )}
                        />
                        <button
                          type="submit"
                          aria-label="Send sample message"
                          className="grid size-9 place-items-center rounded-full text-white"
                          style={{ backgroundColor: brandColor }}
                        >
                          <Send size={14} />
                        </button>
                      </form>
                    </div>
                  )}

                  {previewState === 'otp' && (
                    <div className="flex flex-col gap-3 py-2">
                      <div className="flex items-center gap-2 font-semibold">
                        <ShieldCheck size={17} style={{ color: brandColor }} />
                        <span>Verify your email</span>
                      </div>
                      <p className="text-[12.5px] opacity-80">
                        To view private order details, enter the 6-digit verification code sent to customer@example.com.
                      </p>
                      <div className="grid grid-cols-6 gap-1.5 text-center font-mono text-[15px] font-semibold">
                        {['4', '8', '2', '9', '1', '5'].map((d, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              'rounded-lg border py-2',
                              previewIsDark ? 'border-[#2c3a34]' : 'border-[#d8e1dc]',
                            )}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewState === 'csat' && (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <Sparkles size={20} style={{ color: brandColor }} />
                      <p className="font-semibold">How did {ws.name} do today?</p>
                      <div className="grid w-full grid-cols-4 gap-1.5">
                        {['Bad', 'Okay', 'Good', 'Great'].map((lbl) => (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() =>
                              show({ message: `Simulated "${lbl}" rating preview.`, tone: 'ok' })
                            }
                            className={cn(
                              'rounded-xl border py-2 text-[12.5px] font-medium transition',
                              previewIsDark
                                ? 'border-[#2c3a34] hover:bg-[#1e2b25]'
                                : 'border-[#d8e1dc] hover:bg-[#f2f6f3]',
                            )}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Tabs */}
                <div
                  className={cn(
                    'grid border-t text-[12px] font-medium',
                    showHelpTab ? 'grid-cols-3' : 'grid-cols-2',
                    previewIsDark ? 'border-[#2c3a34]' : 'border-[#e4eae6]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewState('home')}
                    className="flex items-center justify-center gap-1 py-2.5"
                  >
                    <Home size={14} /> Home
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewState('messages')}
                    className="flex items-center justify-center gap-1 py-2.5"
                  >
                    <MessageSquare size={14} /> Messages
                  </button>
                  {showHelpTab && (
                    <button
                      type="button"
                      onClick={() => setPreviewState('help')}
                      className="flex items-center justify-center gap-1 py-2.5"
                    >
                      <HelpCircle size={14} /> {helpCenterTabLabel}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Floating Launcher Button */}
            <button
              type="button"
              onClick={() => setWidgetOpen((o) => !o)}
              aria-label="Toggle widget preview launcher"
              className="grid size-14 place-items-center rounded-full text-white shadow-xl transition hover:scale-105"
              style={{
                backgroundColor: widgetDesign === 'midnight' ? '#162721' : brandColor,
              }}
            >
              {widgetOpen ? <X size={22} /> : <LauncherPresetGlyph id={widgetIcon} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
