'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
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
  Segmented,
  Select,
  Skeleton,
  Textarea,
  useOrbToast,
} from '@/components/orbat/primitives';
import {
  completeOnboardingWizard,
  loadOnboardingDraft,
  type OnboardingDraftBundle,
} from '@/lib/data/onboarding';
import { useData } from '@/lib/data/use-data';
import {
  COMPLIANCE_FRAMEWORKS,
  INDUSTRY_CATALOG,
  ONBOARDING_CHANNELS,
  ONBOARDING_CONNECTORS,
  computeRecommendedFrameworks,
  slugifyCompanyName,
} from '@/lib/lifecycle/onboarding-catalog';
import type { AgentRole } from '@/types/database';
import { cn } from '@/lib/utils';

const STEP_LABELS = [
  'About you',
  'Your company',
  'Industry & region',
  'Privacy & compliance',
  'Open channels',
  'Connect tools',
  'AI agent persona',
  'Invite teammates',
  'Launch workspace',
];

export function OnboardingWizardScreen({
  initialPlanSlug,
}: {
  initialPlanSlug?: string | null;
}) {
  const { data, error, loading, reload } = useData(
    () => loadOnboardingDraft(),
    ['onboarding-draft'],
  );

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-o-bg p-6 sm:p-10">
        <div className="mx-auto max-w-[1160px] grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-[540px] rounded-[24px]" />
          <Skeleton className="h-[420px] rounded-[24px]" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-o-bg p-6">
        <div className="w-full max-w-[540px]">
          <ErrorState
            title="Could not initialize workspace onboarding"
            body={error}
            onRetry={reload}
          />
        </div>
      </div>
    );
  }

  if (!data?.authenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-o-bg p-6">
        <Card size="lg" className="w-full max-w-[540px] text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-o-forest text-o-lime">
            <Lock size={22} />
          </div>
          <h1 className="mt-4 text-[24px] font-semibold text-o-text">
            Create an account to launch your workspace
          </h1>
          <p className="mt-2 text-[15px] text-o-text-2">
            Sign up or sign in first so your company details, AI agent, and compliance controls save directly to your account.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/signup" variant="primary">
              Create free account
            </ButtonLink>
            <ButtonLink href="/login?redirect=/v2/onboarding" variant="secondary">
              Sign in
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <OnboardingWizardLoaded
      key={data.user?.id || 'anon'}
      draft={data}
      initialPlanSlug={initialPlanSlug}
    />
  );
}

function OnboardingWizardLoaded({
  draft,
  initialPlanSlug,
}: {
  draft: OnboardingDraftBundle;
  initialPlanSlug?: string | null;
}) {
  const router = useRouter();
  const { show } = useOrbToast();
  const saved = draft.savedState || {};

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(
    (typeof saved.fullName === 'string' && saved.fullName) || draft.user?.name || '',
  );
  const [displayName, setDisplayName] = useState(
    (typeof saved.displayName === 'string' && saved.displayName) ||
      draft.user?.name.split(' ')[0] ||
      '',
  );
  const [jobTitle, setJobTitle] = useState(
    (typeof saved.jobTitle === 'string' && saved.jobTitle) || 'Head of Support',
  );
  const [phone, setPhone] = useState(
    (typeof saved.phone === 'string' && saved.phone) || '',
  );
  const [userRoleTitle, setUserRoleTitle] = useState(
    (typeof saved.userRoleTitle === 'string' && saved.userRoleTitle) || 'Founder / Owner',
  );

  const [companyName, setCompanyName] = useState(
    (typeof saved.company === 'string' && saved.company) || '',
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    (typeof saved.site === 'string' && saved.site) || '',
  );
  const [country, setCountry] = useState(
    (typeof saved.country === 'string' && saved.country) || 'United States',
  );
  const [timezone, setTimezone] = useState(
    (typeof saved.timezone === 'string' && saved.timezone) || 'UTC',
  );
  const [language, setLanguage] = useState(
    (typeof saved.language === 'string' && saved.language) || 'en',
  );
  const [companySize, setCompanySize] = useState(
    (typeof saved.companySize === 'string' && saved.companySize) || '11-50',
  );
  const [monthlyVolume, setMonthlyVolume] = useState(
    (typeof saved.monthlyVolume === 'string' && saved.monthlyVolume) || '1,000 - 5,000',
  );

  const [industryId, setIndustryId] = useState(
    (typeof saved.industry === 'string' && saved.industry) || 'ecom',
  );
  const selectedIndustry =
    INDUSTRY_CATALOG.find((i) => i.id === industryId) || INDUSTRY_CATALOG[0];

  const [contactTopics, setContactTopics] = useState(
    (typeof saved.contactTopics === 'string' && saved.contactTopics) ||
      selectedIndustry.defaultTopics,
  );

  const recommendedFws = computeRecommendedFrameworks(industryId, country);
  const [frameworks, setFrameworks] = useState<string[]>(
    Array.isArray(saved.frameworks) ? (saved.frameworks as string[]) : recommendedFws,
  );
  const [dataResidency, setDataResidency] = useState(
    (typeof saved.dataResidency === 'string' && saved.dataResidency) || 'US',
  );
  const [retentionLabel, setRetentionLabel] = useState(
    (typeof saved.retentionLabel === 'string' && saved.retentionLabel) || '24 months',
  );

  const [channels, setChannels] = useState<string[]>(
    Array.isArray(saved.channels) ? (saved.channels as string[]) : ['web', 'email'],
  );
  const [connectors, setConnectors] = useState<string[]>(
    Array.isArray(saved.connectors) ? (saved.connectors as string[]) : ['shopify'],
  );
  const [agentName, setAgentName] = useState(
    (typeof saved.agentName === 'string' && saved.agentName) || 'Nova',
  );
  const [invites, setInvites] = useState<Array<{ email: string; role: AgentRole }>>([
    { email: '', role: 'agent' },
  ]);
  const [startOption, setStartOption] = useState<'trial' | 'paid'>(
    initialPlanSlug ? 'paid' : 'trial',
  );
  const [selectedPlanSlug, setSelectedPlanSlug] = useState(
    initialPlanSlug ||
      draft.publicPlans.find((p) => p.is_popular)?.slug ||
      draft.publicPlans[0]?.slug ||
      'growth',
  );
  const [submitting, setSubmitting] = useState(false);

  const liveSlug = slugifyCompanyName(companyName || 'your-company');

  function toggleString(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function handleFinish() {
    if (!companyName.trim()) {
      show({ message: 'Enter your company name in Step 2 before launching.', tone: 'bad' });
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const res = await completeOnboardingWizard({
        fullName,
        displayName,
        jobTitle,
        phone,
        userRoleTitle,
        companyName,
        websiteUrl,
        country,
        timezone,
        language,
        companySize,
        monthlyVolume,
        industryId,
        contactTopics,
        frameworks,
        dataResidency,
        retentionLabel,
        channels,
        connectors,
        agentName,
        invites: invites.filter((i) => i.email.trim().length > 0),
        startOption,
        selectedPlanSlug,
      });
      show({
        message: `${companyName} is configured! Taking you to your launch checklist.`,
        tone: 'ok',
      });
      router.push(res.redirectTo || '/app/getting-started');
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not complete setup.',
        tone: 'bad',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-o-bg text-o-text">
      <header className="border-b border-o-border bg-o-surface">
        <div className="mx-auto flex max-w-[1220px] items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-o-forest font-bold text-o-lime">
              O
            </span>
            <span className="text-[16px] font-semibold">ORBAT Workspace Setup</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="o-num text-[13px] font-medium text-o-text-2">
              Step {step + 1} of {STEP_LABELS.length}
            </span>
            {draft.hasWorkspace && (
              <ButtonLink href="/app/getting-started" variant="quiet" size="sm">
                Exit to workspace
              </ButtonLink>
            )}
          </div>
        </div>
        <div className="h-1.5 w-full bg-o-surface-2">
          <div
            className="h-full bg-o-forest transition-all duration-300"
            style={{ width: `${Math.round(((step + 1) / STEP_LABELS.length) * 100)}%` }}
          />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1220px] gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
        <Card size="lg">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <div>
              <Badge tone="accent">{STEP_LABELS[step]}</Badge>
              <h1 className="mt-2 text-[24px] font-semibold text-o-text">
                {STEP_LABELS[step]}
              </h1>
            </div>
            <div className="flex gap-1">
              {STEP_LABELS.map((lbl, idx) => (
                <button
                  key={lbl}
                  type="button"
                  title={lbl}
                  aria-label={`Jump to step ${idx + 1}: ${lbl}`}
                  onClick={() => setStep(idx)}
                  className={cn(
                    'h-2.5 rounded-full transition-all',
                    idx === step
                      ? 'w-7 bg-o-forest'
                      : idx < step
                        ? 'w-2.5 bg-o-lime'
                        : 'w-2.5 bg-o-border',
                  )}
                />
              ))}
            </div>
          </div>

          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your full name">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="First name seen by customers">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </Field>
              <Field label="Role or title">
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </Field>
              <Field label="Team responsibility">
                <Select
                  value={userRoleTitle}
                  onChange={(e) => setUserRoleTitle(e.target.value)}
                  options={[
                    { value: 'Founder / Owner', label: 'Founder / Owner' },
                    { value: 'Support Lead', label: 'Support Lead' },
                    { value: 'Operations / CX', label: 'Operations / CX' },
                    { value: 'Engineering', label: 'Engineering' },
                  ]}
                />
              </Field>
              <Field label="Phone number (optional)">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 415 555 0140"
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <Field label="Company or brand name">
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Retail Co."
                />
              </Field>
              <Field label="Company website URL" hint="Used to auto-configure help links and brand context">
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="acmeretail.com"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company size">
                  <Select
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    options={[
                      { value: '1-10', label: '1 – 10 people' },
                      { value: '11-50', label: '11 – 50 people' },
                      { value: '51-200', label: '51 – 200 people' },
                      { value: '200+', label: '200+ people' },
                    ]}
                  />
                </Field>
                <Field label="Monthly support volume">
                  <Select
                    value={monthlyVolume}
                    onChange={(e) => setMonthlyVolume(e.target.value)}
                    options={[
                      { value: 'Under 500', label: 'Under 500 conversations' },
                      { value: '500 - 1,000', label: '500 – 1,000 conversations' },
                      { value: '1,000 - 5,000', label: '1,000 – 5,000 conversations' },
                      { value: '5,000+', label: '5,000+ conversations' },
                    ]}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {INDUSTRY_CATALOG.map((ind) => {
                  const active = industryId === ind.id;
                  return (
                    <button
                      key={ind.id}
                      type="button"
                      onClick={() => {
                        setIndustryId(ind.id);
                        setContactTopics(ind.defaultTopics);
                        setFrameworks(computeRecommendedFrameworks(ind.id, country));
                      }}
                      className={cn(
                        'rounded-2xl border p-3.5 text-left transition',
                        active
                          ? 'border-o-forest bg-o-surface-2'
                          : 'border-o-border bg-o-surface hover:border-o-border-2',
                      )}
                    >
                      <p className="font-semibold text-o-text">{ind.label}</p>
                      <p className="text-[12.5px] text-o-text-2">{ind.subtitle}</p>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Operating country">
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                </Field>
                <Field label="Default timezone">
                  <Select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    options={[
                      { value: 'UTC', label: 'UTC' },
                      { value: 'America/New_York', label: 'America / New York' },
                      { value: 'America/Los_Angeles', label: 'America / Los Angeles' },
                      { value: 'Europe/London', label: 'Europe / London' },
                      { value: 'Asia/Karachi', label: 'Asia / Karachi' },
                    ]}
                  />
                </Field>
                <Field label="Primary language">
                  <Select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'es', label: 'Spanish' },
                      { value: 'ur', label: 'Urdu' },
                      { value: 'fr', label: 'French' },
                    ]}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {COMPLIANCE_FRAMEWORKS.map((fw) => {
                  const checked = frameworks.includes(fw.id);
                  const recommended = recommendedFws.includes(fw.id);
                  return (
                    <button
                      key={fw.id}
                      type="button"
                      onClick={() => setFrameworks((prev) => toggleString(prev, fw.id))}
                      className={cn(
                        'flex flex-col gap-1 rounded-2xl border p-4 text-left transition',
                        checked
                          ? 'border-o-forest bg-o-surface-2'
                          : 'border-o-border bg-o-surface hover:border-o-border-2',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-o-text">{fw.label}</span>
                        {recommended && <Badge tone="accent">Recommended</Badge>}
                      </div>
                      <p className="text-[12.5px] text-o-text-2">{fw.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Preferred data residency">
                  <Select
                    value={dataResidency}
                    onChange={(e) => setDataResidency(e.target.value)}
                    options={[
                      { value: 'US', label: 'United States' },
                      { value: 'EU', label: 'European Union' },
                      { value: 'Global', label: 'Standard multi-region' },
                    ]}
                  />
                </Field>
                <Field label="Transcript retention period">
                  <Select
                    value={retentionLabel}
                    onChange={(e) => setRetentionLabel(e.target.value)}
                    options={[
                      { value: '12 months', label: '12 months' },
                      { value: '24 months', label: '24 months' },
                      { value: '6 years', label: '6 years' },
                      { value: '7 years', label: '7 years' },
                    ]}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {ONBOARDING_CHANNELS.map((ch) => {
                const active = channels.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setChannels((prev) => toggleString(prev, ch.id))}
                    className={cn(
                      'flex items-start justify-between gap-3 rounded-2xl border p-4 text-left transition',
                      active
                        ? 'border-o-forest bg-o-surface-2'
                        : 'border-o-border bg-o-surface hover:border-o-border-2',
                    )}
                  >
                    <div>
                      <p className="font-semibold text-o-text">{ch.label}</p>
                      <p className="mt-0.5 text-[13px] text-o-text-2">{ch.description}</p>
                    </div>
                    {active && <Check size={17} className="text-o-forest shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {step === 5 && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {ONBOARDING_CONNECTORS.map((app) => {
                  const active = connectors.includes(app.id);
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setConnectors((prev) => toggleString(prev, app.id))}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition',
                        active
                          ? 'border-o-forest bg-o-surface-2'
                          : 'border-o-border bg-o-surface hover:border-o-border-2',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-o-forest text-[12px] font-bold text-o-lime">
                          {app.initials}
                        </span>
                        <div>
                          <p className="font-semibold text-o-text">{app.label}</p>
                          <p className="text-[12.5px] text-o-text-2">{app.description}</p>
                        </div>
                      </div>
                      {active && <Check size={17} className="text-o-forest shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <Alert tone="ai">
                Selected integrations are queued in Connect CRM inside your workspace so you can finish OAuth authorization immediately after setup.
              </Alert>
            </div>
          )}

          {step === 6 && (
            <div className="flex flex-col gap-4">
              <Field label="Name your AI support agent">
                <Input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Nova"
                />
              </Field>
              <Field label="Primary topics your agent handles" hint="Pre-filled from your selected industry template">
                <Textarea
                  rows={3}
                  value={contactTopics}
                  onChange={(e) => setContactTopics(e.target.value)}
                />
              </Field>
              <div className="rounded-2xl border border-o-border bg-o-surface-2/60 p-4">
                <p className="text-[13px] font-semibold text-o-text">
                  Template preset: {selectedIndustry.agentTemplate}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedIndustry.skills.map((sk) => (
                    <Badge key={sk} tone="neutral">
                      {sk}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] text-o-text-2">
                Invite support teammates now, or leave blank and invite them later from Settings -&gt; Team.
              </p>
              {invites.map((inv, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <Input
                    className="flex-1 min-w-[200px]"
                    type="email"
                    placeholder="teammate@company.com"
                    value={inv.email}
                    onChange={(e) =>
                      setInvites((prev) =>
                        prev.map((row, rIdx) =>
                          rIdx === idx ? { ...row, email: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <Select
                    value={inv.role}
                    onChange={(e) =>
                      setInvites((prev) =>
                        prev.map((row, rIdx) =>
                          rIdx === idx ? { ...row, role: e.target.value as AgentRole } : row,
                        ),
                      )
                    }
                    options={[
                      { value: 'agent', label: 'Agent' },
                      { value: 'admin', label: 'Admin' },
                      { value: 'light_agent', label: 'Light agent' },
                    ]}
                  />
                  {invites.length > 1 && (
                    <Button
                      size="sm"
                      variant="quiet"
                      icon
                      aria-label="Remove invite row"
                      onClick={() =>
                        setInvites((prev) => prev.filter((_, rIdx) => rIdx !== idx))
                      }
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              ))}
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  leading={<Plus size={14} />}
                  onClick={() =>
                    setInvites((prev) => [...prev, { email: '', role: 'agent' }])
                  }
                >
                  Add another teammate
                </Button>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="flex flex-col gap-5">
              <Segmented
                label="Workspace start option"
                value={startOption}
                onChange={setStartOption}
                items={[
                  { id: 'trial', label: 'Start 14-day free trial' },
                  { id: 'paid', label: 'Pick a paid plan now' },
                ]}
              />

              {startOption === 'paid' && draft.publicPlans.length > 0 && (
                <Field label="Choose plan">
                  <Select
                    value={selectedPlanSlug}
                    onChange={(e) => setSelectedPlanSlug(e.target.value)}
                    options={draft.publicPlans.map((p) => ({
                      value: p.slug,
                      label: `${p.name} — $${p.monthly_price}/mo`,
                    }))}
                  />
                </Field>
              )}

              <div className="rounded-2xl border border-o-border bg-o-surface-2/60 p-4 text-[14px]">
                <p className="font-semibold text-o-text">Ready to provision:</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-o-text-2">
                  <li>Workspace: <strong>{companyName || 'My Workspace'}</strong> (/v2/help/{liveSlug})</li>
                  <li>AI agent draft: <strong>{agentName || 'Nova'}</strong> ({selectedIndustry.agentTemplate})</li>
                  <li>Compliance baselines: <strong>{frameworks.join(', ') || 'Default GDPR'}</strong></li>
                  <li>Channels selected: <strong>{channels.join(', ')}</strong></li>
                </ul>
              </div>
            </div>
          )}

          {/* Wizard Navigation Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-o-border pt-5">
            <Button
              variant="secondary"
              disabled={step === 0 || submitting}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              leading={<ArrowLeft size={15} />}
            >
              Back
            </Button>

            {step < STEP_LABELS.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => setStep((s) => Math.min(STEP_LABELS.length - 1, s + 1))}
                trailing={<ArrowRight size={15} />}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={submitting}
                onClick={() => void handleFinish()}
                leading={<Sparkles size={15} />}
              >
                Launch workspace
              </Button>
            )}
          </div>
        </Card>

        {/* Sticky Live Workspace Preview Card */}
        <div className="lg:sticky lg:top-6">
          <Card className="bg-o-forest text-o-on-forest" size="lg">
            <CardHeader
              title={companyName || 'Your Workspace'}
              sub={`orbatai.com/v2/help/${liveSlug}`}
              actions={<Badge tone="solid">Live preview</Badge>}
            />

            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-o-on-forest-track/70 p-4 text-[13.5px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-o-mint">
                  <Bot size={15} /> AI Agent
                </span>
                <span className="font-semibold">{agentName || 'Nova'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-o-mint">Template</span>
                <span>{selectedIndustry.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-o-mint">
                  <ShieldCheck size={15} /> Compliance
                </span>
                <span>{frameworks.length} frameworks</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-o-mint">Channels</span>
                <span>{channels.length} enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-o-mint">Data residency</span>
                <span>{dataResidency}</span>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
