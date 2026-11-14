'use client';

import { useState } from 'react';
import { ArrowLeft, Monitor, Send, Smartphone } from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Textarea,
  Toggle,
  useOrbToast,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import {
  DEFAULT_EMAIL_TEMPLATES,
  renderTemplateVariables,
  type EmailTemplateCategory,
} from '@/lib/settings/email-templates';
import {
  fetchWorkspaceEmailTemplates,
  saveWorkspaceEmailTemplateAction,
  sendTestWorkspaceEmailAction,
  type EmailTemplateRecord,
} from '@/lib/data/settings';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

const CATEGORIES: EmailTemplateCategory[] = ['Conversations', 'Tickets', 'Security', 'Compliance'];

export function EmailsScreen() {
  const { workspace, agent } = useShellSession();
  const { show } = useOrbToast();

  const [language, setLanguage] = useState('en');
  const [selectedKey, setSelectedKey] = useState<string>('missed_chat');
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [draft, setDraft] = useState<{
    key: string;
    language: string;
    subject: string;
    body: string;
    ctaLabel: string;
    isActive: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState(agent.email);
  const [sendingTest, setSendingTest] = useState(false);

  const { data: templates, error, loading, reload } = useData<EmailTemplateRecord[]>(
    () => fetchWorkspaceEmailTemplates(workspace!.id, language),
    ['email-templates', workspace?.id, language],
    { enabled: Boolean(workspace?.id) },
  );

  if (!workspace) return null;

  const list = templates ?? [];
  const activeTemplate = list.find((t) => t.templateKey === selectedKey) ?? list[0] ?? null;

  const editorState =
    draft && activeTemplate && draft.key === activeTemplate.templateKey && draft.language === language
      ? draft
      : activeTemplate
        ? {
            key: activeTemplate.templateKey,
            language,
            subject: activeTemplate.subject,
            body: activeTemplate.body,
            ctaLabel: activeTemplate.ctaLabel,
            isActive: activeTemplate.isActive,
          }
        : null;

  const sampleContext =
    DEFAULT_EMAIL_TEMPLATES.find((s) => s.templateKey === activeTemplate?.templateKey)
      ?.sampleContext ?? {};

  const renderedSubject = editorState
    ? renderTemplateVariables(editorState.subject, {
        ...sampleContext,
        workspace_name: workspace.name,
      })
    : '';

  const renderedBody = editorState
    ? renderTemplateVariables(editorState.body, {
        ...sampleContext,
        workspace_name: workspace.name,
      })
    : '';

  const handleSave = async () => {
    if (!activeTemplate || !editorState) return;
    setSaving(true);
    const res = await saveWorkspaceEmailTemplateAction(workspace.id, {
      templateKey: activeTemplate.templateKey,
      language,
      subject: editorState.subject,
      body: editorState.body,
      ctaLabel: editorState.ctaLabel,
      isActive: editorState.isActive,
    });
    setSaving(false);
    if (!res.success) {
      show({ message: res.error || 'Could not save template', tone: 'bad' });
      return;
    }
    setDraft(null);
    show({ message: 'Email template saved', tone: 'ok' });
    reload();
  };

  const handleSendTest = async () => {
    if (!activeTemplate || !editorState) return;
    setSendingTest(true);
    const res = await sendTestWorkspaceEmailAction(workspace.id, {
      templateKey: activeTemplate.templateKey,
      subject: editorState.subject,
      body: editorState.body,
      ctaLabel: editorState.ctaLabel,
      recipientEmail: testRecipient,
    });
    setSendingTest(false);
    setTestModalOpen(false);
    if (!res.success) {
      show({ message: res.message, tone: res.smtpConfigured ? 'bad' : 'info' });
      return;
    }
    show({ message: res.message, tone: 'ok' });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Transactional email templates"
        description="Customize customer notifications, ticket replies, and privacy confirmations."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Template language"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                setDraft(null);
              }}
              options={[
                { value: 'en', label: 'English (en)' },
                { value: 'es', label: 'Spanish (es)' },
                { value: 'fr', label: 'French (fr)' },
                { value: 'de', label: 'German (de)' },
              ]}
            />
            <ButtonLink href="/app/settings" variant="secondary" size="sm">
              <ArrowLeft size={14} aria-hidden="true" />
              Settings
            </ButtonLink>
          </div>
        }
      />

      {error ? (
        <ErrorState title="Could not load email templates" body={error} onRetry={reload} />
      ) : loading || !templates ? (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <Skeleton className="h-[460px] rounded-[24px]" />
          <Skeleton className="h-[460px] rounded-[24px]" />
        </div>
      ) : !activeTemplate || !editorState ? (
        <EmptyState title="No email templates found" body="Switch language or reload to seed defaults." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[260px_1fr_360px] lg:grid-cols-[260px_1fr] lg:items-start">
          {/* Grouped template picker */}
          <Card className="p-3">
            <div className="flex flex-col gap-3">
              {CATEGORIES.map((cat) => {
                const items = list.filter((t) => t.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="px-2.5 pb-1 text-[11.5px] font-semibold uppercase tracking-wide text-o-text-3">
                      {cat}
                    </div>
                    <div className="flex flex-col gap-1">
                      {items.map((tpl) => {
                        const selected = tpl.templateKey === activeTemplate.templateKey;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              setSelectedKey(tpl.templateKey);
                              setDraft(null);
                            }}
                            className={cn(
                              'flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-[13.5px] font-semibold transition-colors',
                              selected
                                ? 'bg-o-lime text-o-on-lime'
                                : 'text-o-text-2 hover:bg-o-surface-2 hover:text-o-text',
                            )}
                          >
                            <span className="truncate">{tpl.name}</span>
                            <Badge tone={tpl.isActive ? 'ok' : 'neutral'}>
                              {tpl.isActive ? 'On' : 'Off'}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Center editor */}
          <Card>
            <CardHeader
              title={activeTemplate.name}
              sub={activeTemplate.triggerDescription}
              actions={
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium text-o-text-2">Active</span>
                  <Toggle
                    label="Template enabled"
                    checked={editorState.isActive}
                    onChange={(checked) => setDraft({ ...editorState, isActive: checked })}
                  />
                </div>
              }
            />

            <div className="mt-4 flex flex-col gap-4">
              <Field label="Subject line">
                <Input
                  value={editorState.subject}
                  onChange={(e) => setDraft({ ...editorState, subject: e.target.value })}
                />
              </Field>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-[13px] font-semibold">
                  <span>Insert variable</span>
                  <span className="text-[12px] font-normal text-o-text-3">Click chip to append</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeTemplate.availableVariables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...editorState,
                          body: `${editorState.body}${editorState.body.endsWith(' ') || !editorState.body ? '' : ' '}{{${v}}}`,
                        })
                      }
                      className="rounded-full bg-o-surface-2 px-2.5 py-1 o-mono text-[12px] font-medium text-o-text-2 hover:bg-o-surface-3 hover:text-o-text"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Message body">
                <Textarea
                  rows={8}
                  value={editorState.body}
                  onChange={(e) => setDraft({ ...editorState, body: e.target.value })}
                />
              </Field>

              <Field label="Primary button label (optional)" hint="Leave empty to hide the CTA button">
                <Input
                  value={editorState.ctaLabel}
                  placeholder="e.g. Open conversation"
                  onChange={(e) => setDraft({ ...editorState, ctaLabel: e.target.value })}
                />
              </Field>

              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setTestModalOpen(true)}>
                  <Send size={14} aria-hidden="true" />
                  Send test email
                </Button>
                <Button variant="primary" loading={saving} onClick={handleSave}>
                  Save template
                </Button>
              </div>
            </div>
          </Card>

          {/* Right Live Preview */}
          <Card className="lg:col-span-2 xl:col-span-1">
            <CardHeader
              title="Live preview"
              actions={
                <Segmented<'desktop' | 'mobile'>
                  label="Preview width"
                  value={previewWidth}
                  onChange={setPreviewWidth}
                  items={[
                    { id: 'desktop', label: <Monitor size={14} aria-label="Desktop" /> },
                    { id: 'mobile', label: <Smartphone size={14} aria-label="Mobile" /> },
                  ]}
                />
              }
            />

            <div className="mt-4 flex justify-center rounded-2xl bg-o-surface-2 p-4">
              <div
                className={cn(
                  'w-full rounded-2xl border border-o-border bg-o-surface p-5 shadow-sm transition-all',
                  previewWidth === 'mobile' ? 'max-w-[290px]' : 'max-w-full',
                )}
              >
                <div className="border-b border-o-border pb-3">
                  <div className="text-[11.5px] uppercase tracking-wide text-o-text-3">Subject</div>
                  <div className="mt-0.5 text-[14.5px] font-bold">{renderedSubject || '—'}</div>
                </div>
                <div className="mt-4 whitespace-pre-line text-[13.5px] leading-relaxed text-o-text-2">
                  {renderedBody}
                </div>
                {editorState.ctaLabel.trim() ? (
                  <div className="mt-5">
                    <span className="inline-flex rounded-full bg-o-lime px-4 py-2 text-[13px] font-bold text-o-forest">
                      {editorState.ctaLabel}
                    </span>
                  </div>
                ) : null}
                <div className="mt-6 border-t border-o-border pt-3 text-[11.5px] text-o-text-3">
                  Sent by {workspace.name}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="Send live test email"
        description="Uses the workspace or platform SMTP settings to deliver a sample render."
        footer={
          <>
            <Button variant="quiet" onClick={() => setTestModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={sendingTest} onClick={handleSendTest}>
              Send test
            </Button>
          </>
        }
      >
        <Field label="Recipient email">
          <Input
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
          />
        </Field>
      </Modal>
    </PageContainer>
  );
}
