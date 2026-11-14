'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Globe,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  TabPanel,
  Tabs,
  Toggle,
  useOrbToast,
  type BadgeTone,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { timeAgo } from '@/components/orbat/overview/format';
import {
  getWebsiteAudit,
  resolveWebsiteAuditFinding,
  runWebsiteAudit,
  toggleRegionalPack,
  type RegionalPackKey,
  type WebsiteAuditBootstrap,
  type WebsiteAuditFinding,
} from '@/lib/data/compliance';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

type AuditTab = 'audit' | 'packs';

interface RegionalPackMeta {
  key: RegionalPackKey;
  region: string;
  laws: string[];
  commerceTags: string[];
  summary: string;
}

const REGIONAL_PACKS: RegionalPackMeta[] = [
  {
    key: 'eu',
    region: 'EU / EEA',
    laws: ['GDPR Art. 6 / 13 / 17', 'ePrivacy Cookie Consent', 'EU AI Act Art. 50'],
    commerceTags: ['SEPA', '14-day withdrawal', 'EUR VAT display'],
    summary: 'Disclose automated AI chat upfront, gate non-essential trackers before consent, and enable 30-day export/erasure.',
  },
  {
    key: 'us',
    region: 'United States',
    laws: ['CCPA / CPRA', 'Colorado / Virginia CPA', 'FTC Endorsement Rules'],
    commerceTags: ['ACH / Card', 'Opt-out link', 'Accessible checkout'],
    summary: 'Expose "Do Not Sell or Share" links cleanly, suppress unverified claims, and maintain accessible support widgets.',
  },
  {
    key: 'pk',
    region: 'Pakistan',
    laws: ['PECA Consumer Provisions', 'SBP Digital Banking Fair-Use', 'PTA Messaging Guidelines'],
    commerceTags: ['COD verification', 'JazzCash / Easypaisa', 'Urdu / Roman Urdu'],
    summary: 'Include clear return/refund windows for COD orders, bilingual policy links, and OTP/CNIC masking in AI replies.',
  },
  {
    key: 'gcc',
    region: 'GCC (UAE / KSA)',
    laws: ['Saudi PDPL', 'UAE Federal PDPL', 'MOCI E-Commerce Rules'],
    commerceTags: ['Arabic RTL readiness', 'Mada / Tamara', 'VAT invoice disclosures'],
    summary: 'Disclose cross-border AI processing clearly, support right-to-left Arabic notices, and avoid binding SLA/delivery promises.',
  },
];

function severityTone(sev: WebsiteAuditFinding['severity']): BadgeTone {
  if (sev === 'High') return 'bad';
  if (sev === 'Medium') return 'warn';
  return 'neutral';
}

function scoreColorClass(score: number): string {
  if (score >= 80) return 'text-o-ok';
  if (score >= 60) return 'text-o-warn';
  return 'text-o-bad';
}

function barBgClass(score: number): string {
  if (score >= 80) return 'bg-o-ok';
  if (score >= 60) return 'bg-o-warn';
  return 'bg-o-bad';
}

export function WebsiteAuditScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();

  const [tab, setTab] = useState<AuditTab>('audit');
  const [urlDraft, setUrlDraft] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, error, reload } = useData<WebsiteAuditBootstrap>(
    () => getWebsiteAudit(workspace!.id),
    ['orbat', 'website-audit', workspace?.id],
    { enabled: Boolean(workspace?.id) },
  );

  if (!workspace?.id) return null;

  const effectiveUrl = urlDraft ?? data?.latestRun?.targetUrl ?? data?.workspaceWebsiteUrl ?? '';

  async function handleRunAudit(e?: FormEvent) {
    e?.preventDefault();
    if (!workspace?.id) return;
    const candidate = effectiveUrl.trim();
    if (!candidate) {
      show({ message: 'Enter a public website URL to scan (e.g. https://example.com).', tone: 'bad' });
      return;
    }
    setScanning(true);
    try {
      const res = await runWebsiteAudit(workspace.id, candidate);
      setUrlDraft(res.audit.targetUrl);
      show({ message: `Website scan finished — score ${res.audit.overallScore}/100`, tone: 'ok' });
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Website audit failed', tone: 'bad' });
    } finally {
      setScanning(false);
    }
  }

  async function handleResolveFinding(auditId: string, findingId: string) {
    if (!workspace?.id) return;
    setBusyId(`resolve-${findingId}`);
    try {
      await resolveWebsiteAuditFinding(workspace.id, auditId, findingId);
      show({ message: 'Finding marked resolved', tone: 'ok' });
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Could not update finding', tone: 'bad' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePack(pack: RegionalPackKey, enabled: boolean) {
    if (!workspace?.id) return;
    setBusyId(`pack-${pack}`);
    try {
      await toggleRegionalPack(workspace.id, pack, enabled);
      show({ message: `${pack.toUpperCase()} regional pack ${enabled ? 'enabled' : 'disabled'}`, tone: 'ok' });
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Could not update regional pack', tone: 'bad' });
    } finally {
      setBusyId(null);
    }
  }

  const latest = data?.latestRun ?? null;
  const openFindingsCount = latest?.findings.filter((f) => !f.resolved).length ?? 0;
  const resolvedFindingsCount = latest?.findings.filter((f) => f.resolved).length ?? 0;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const scorePct = latest ? Math.max(0, Math.min(100, latest.overallScore)) : 0;
  const dashOffset = circumference - (scorePct / 100) * circumference;

  const sortedFindings = latest
    ? [...latest.findings].sort((a, b) => Number(a.resolved) - Number(b.resolved))
    : [];

  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <Link
          href="/app/compliance"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-o-accent-text hover:underline"
        >
          <ArrowLeft size={14} /> Compliance center
        </Link>
        <PageHeader
          title="Website compliance audit"
          description="Live HTTP security header, legal disclosure, tracker, and accessibility check for your public storefront or docs site."
          actions={
            <Button
              size="sm"
              variant="secondary"
              leading={<RefreshCw size={14} />}
              onClick={reload}
              disabled={loading || scanning}
            >
              Refresh
            </Button>
          }
        />
      </div>

      {/* Target URL bar */}
      <Card>
        <form onSubmit={handleRunAudit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="audit-url-input" className="mb-1.5 block text-[12.5px] font-medium text-o-text-2">
              Target public website URL
            </label>
            <Input
              id="audit-url-input"
              type="url"
              value={effectiveUrl}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://yourstore.com"
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            leading={<SearchCheck size={15} />}
            loading={scanning}
            disabled={loading || (data ? !data.canManage : false)}
            className="shrink-0"
          >
            Run audit
          </Button>
        </form>
        {data && !data.canManage ? (
          <p className="mt-2 text-[12px] text-o-text-3">
            Read-only access: only workspace admins or owners can trigger live website scans or toggle regional packs.
          </p>
        ) : null}
      </Card>

      <Tabs<AuditTab>
        idBase="website-audit-tabs"
        label="Website audit sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'audit', label: 'Website audit', count: latest ? openFindingsCount : undefined },
          {
            id: 'packs',
            label: 'Regional packs',
            count: data
              ? Object.values(data.regionalPacks).filter(Boolean).length
              : undefined,
          },
        ]}
      />

      {loading && !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : error && !data ? (
        <ErrorState
          title="Could not load website audit"
          body={error}
          onRetry={reload}
        />
      ) : data && tab === 'audit' ? (
        <TabPanel idBase="website-audit-tabs" id="audit">
          <div className="flex flex-col gap-4">
            {!latest ? (
              <Card className="flex flex-col items-center gap-3">
                <EmptyState
                  icon={<Globe size={24} />}
                  title="No website scan recorded yet"
                  body="Enter your public storefront or help-center URL above and click Run audit to inspect security headers, cookie banners, legal links, and widget tags."
                />
                {data.canManage && effectiveUrl ? (
                  <Button variant="primary" loading={scanning} onClick={() => handleRunAudit()}>
                    Scan {effectiveUrl}
                  </Button>
                ) : null}
              </Card>
            ) : (
                <>
                  {/* Score Gauge + 4 Framework Progress Bars */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[270px_1fr]">
                    <Card className="flex flex-col items-center justify-center text-center">
                      <div className="relative grid h-32 w-32 place-items-center">
                        <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90" aria-hidden="true">
                          <circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="10"
                            className="text-o-surface-3"
                          />
                          <circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            className={scoreColorClass(latest.overallScore)}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={cn('o-num text-[32px] font-bold leading-none', scoreColorClass(latest.overallScore))}>
                            {latest.overallScore}
                          </span>
                          <span className="mt-0.5 text-[11.5px] font-medium text-o-text-3">out of 100</span>
                        </div>
                      </div>

                      <div className="mt-3 min-w-0 max-w-full">
                        <a
                          href={latest.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 truncate text-[13px] font-semibold text-o-accent-text hover:underline"
                        >
                          <span className="truncate">{latest.targetUrl}</span>
                          <ExternalLink size={12} className="shrink-0" />
                        </a>
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                          <Badge tone={latest.httpStatus && latest.httpStatus < 400 ? 'ok' : 'bad'}>
                            HTTP {latest.httpStatus ?? 'Err'}
                          </Badge>
                          <Badge tone={openFindingsCount === 0 ? 'ok' : 'warn'}>
                            {openFindingsCount} open · {resolvedFindingsCount} resolved
                          </Badge>
                        </div>
                        <div className="mt-2 text-[11.5px] text-o-text-3">
                          Scanned {timeAgo(latest.scannedAt)}
                        </div>
                      </div>
                    </Card>

                    <Card>
                      <CardHeader
                        title="Framework readiness checks"
                        sub="Automated readiness heuristic across privacy disclosures, transport headers, and widget accessibility."
                      />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {latest.frameworkScores.map((fw) => (
                          <div
                            key={fw.name}
                            className="flex flex-col gap-1.5 rounded-xl border border-o-border bg-o-surface-2/40 p-3.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13.5px] font-semibold text-o-text">{fw.name}</span>
                              <span className={cn('o-num text-[13.5px] font-bold', scoreColorClass(fw.score))}>
                                {fw.score}%
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-o-surface-3">
                              <div
                                className={cn('h-full rounded-full transition-all', barBgClass(fw.score))}
                                style={{ width: `${Math.max(4, Math.min(100, fw.score))}%` }}
                              />
                            </div>
                            <p className="text-[12px] text-o-text-2">{fw.note}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* Issues to fix */}
                  <Card>
                    <CardHeader
                      title="Issues to fix"
                      sub="Resolve findings after updating your website headers, privacy footer, or cookie manager."
                      actions={
                        <Badge tone={openFindingsCount === 0 ? 'ok' : 'warn'}>
                          {openFindingsCount === 0 ? 'No open findings' : `${openFindingsCount} remaining`}
                        </Badge>
                      }
                    />
                    {sortedFindings.length === 0 ? (
                      <div className="flex items-center gap-3 rounded-xl border border-o-border bg-o-surface-2/40 p-4 text-[13.5px] text-o-text-2">
                        <ShieldCheck size={18} className="shrink-0 text-o-ok" />
                        <span>All baseline HTTP security header, link disclosure, and accessibility checks passed on this page.</span>
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {sortedFindings.map((f) => (
                          <li
                            key={f.id}
                            className={cn(
                              'flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-start',
                              f.resolved
                                ? 'border-o-border bg-o-surface-2/30 opacity-75'
                                : 'border-o-border bg-o-surface',
                            )}
                          >
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={f.resolved ? 'ok' : severityTone(f.severity)}>
                                  {f.resolved ? 'Resolved' : f.severity}
                                </Badge>
                                <Badge tone="neutral">{f.framework}</Badge>
                                <span className="o-num text-[11.5px] font-medium text-o-text-3">
                                  +{f.points} pts
                                </span>
                              </div>
                              <h3 className="text-[14px] font-semibold text-o-text">{f.title}</h3>
                              <p className="text-[12.5px] text-o-text-2">
                                <span className="font-medium text-o-text">Where:</span> {f.where}
                              </p>
                              <p className="text-[12.5px] text-o-text-2">
                                <span className="font-medium text-o-text">Recommended fix:</span> {f.fix}
                              </p>
                            </div>
                            <div className="shrink-0">
                              {f.resolved ? (
                                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-o-ok">
                                  <CheckCircle2 size={15} /> Marked resolved
                                </span>
                              ) : data.canManage ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={busyId === `resolve-${f.id}`}
                                  onClick={() => handleResolveFinding(latest.id, f.id)}
                                >
                                  Mark resolved
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  {/* Discovered Summary + Scan History */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card>
                      <CardHeader
                        title="Discovered page telemetry"
                        sub={latest.discoveredSummary.pageTitle || 'Public HTML head & response headers snapshot'}
                      />
                      <div className="flex flex-col gap-3 text-[13px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={latest.discoveredSummary.hasCookieBannerHint ? 'ok' : 'warn'}>
                            Cookie consent: {latest.discoveredSummary.hasCookieBannerHint ? 'Detected' : 'Not detected'}
                          </Badge>
                          <Badge tone={latest.discoveredSummary.hasWidgetSnippet ? 'ok' : 'neutral'}>
                            ORBAT widget: {latest.discoveredSummary.hasWidgetSnippet ? 'Detected' : 'Not detected'}
                          </Badge>
                          <Badge
                            tone={
                              latest.discoveredSummary.totalImages === 0 ||
                              latest.discoveredSummary.imagesWithoutAlt === 0
                                ? 'ok'
                                : 'warn'
                            }
                          >
                            Image alt tags:{' '}
                            {latest.discoveredSummary.totalImages === 0
                              ? 'No <img> elements'
                              : `${latest.discoveredSummary.totalImages - latest.discoveredSummary.imagesWithoutAlt}/${latest.discoveredSummary.totalImages} labeled`}
                          </Badge>
                        </div>

                        <div>
                          <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-o-text-3">
                            Headers present ({latest.discoveredSummary.headersPresent.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {latest.discoveredSummary.headersPresent.length === 0 ? (
                              <span className="text-[12.5px] text-o-text-3">None of the audited security headers were returned.</span>
                            ) : (
                              latest.discoveredSummary.headersPresent.map((h) => (
                                <Badge key={h} tone="ok">
                                  {h}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-o-text-3">
                            Missing security headers ({latest.discoveredSummary.headersMissing.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {latest.discoveredSummary.headersMissing.length === 0 ? (
                              <span className="text-[12.5px] text-o-text-3">All checked transport headers present.</span>
                            ) : (
                              latest.discoveredSummary.headersMissing.map((h) => (
                                <Badge key={h} tone="warn">
                                  {h}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-o-text-3">
                              Trackers & scripts
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {latest.discoveredSummary.trackersDetected.length === 0 ? (
                                <span className="text-[12.5px] text-o-text-3">None matched in initial HTML</span>
                              ) : (
                                latest.discoveredSummary.trackersDetected.map((t) => (
                                  <Badge key={t} tone="neutral">
                                    {t}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-o-text-3">
                              Disclosure links
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {latest.discoveredSummary.linksDetected.length === 0 ? (
                                <span className="text-[12.5px] text-o-text-3">No policy links matched</span>
                              ) : (
                                latest.discoveredSummary.linksDetected.map((l) => (
                                  <Badge key={l} tone="accent">
                                    {l}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="flex flex-col justify-between gap-4">
                      <div>
                        <CardHeader
                          title="Recent scan history"
                          sub="Stored workspace audits sorted most recent first."
                        />
                        {data.history.length === 0 ? (
                          <p className="text-[13px] text-o-text-3">No previous audit runs stored yet.</p>
                        ) : (
                          <ul className="divide-y divide-o-border">
                            {data.history.map((item) => (
                              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium text-o-text">{item.targetUrl}</div>
                                  <div className="text-[11.5px] text-o-text-3">{timeAgo(item.scannedAt)}</div>
                                </div>
                                <Badge tone={item.overallScore >= 80 ? 'ok' : item.overallScore >= 60 ? 'warn' : 'bad'}>
                                  <span className="o-num">{item.overallScore}/100</span>
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <Alert tone="warn">
                        <strong>Readiness check, not legal certification:</strong> This audit fetches the public URL HTML
                        and HTTP headers once from our server (with private IP / SSRF blocking). Multi-page headless
                        cookie execution and legal DPO sign-off require formal review.
                      </Alert>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </TabPanel>
      ) : data && tab === 'packs' ? (
          <TabPanel idBase="website-audit-tabs" id="packs">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {REGIONAL_PACKS.map((pack) => {
                  const enabled = Boolean(data.regionalPacks[pack.key]);
                  return (
                    <Card key={pack.key} className="flex flex-col justify-between gap-4">
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-[15px] font-semibold text-o-text">{pack.region}</h3>
                              <Badge tone={enabled ? 'ok' : 'neutral'}>{enabled ? 'Enabled' : 'Inactive'}</Badge>
                            </div>
                            <p className="mt-1 text-[13px] text-o-text-2">{pack.summary}</p>
                          </div>
                          <Toggle
                            checked={enabled}
                            label={`Enable ${pack.region} regional pack`}
                            hideLabel
                            disabled={!data.canManage || busyId === `pack-${pack.key}`}
                            onChange={(next) => handleTogglePack(pack.key, next)}
                          />
                        </div>

                        <div>
                          <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-o-text-3">
                            Frameworks & statutory rules
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {pack.laws.map((law) => (
                              <Badge key={law} tone={enabled ? 'accent' : 'neutral'}>
                                {law}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-o-text-3">
                            Commerce & support signals
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {pack.commerceTags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md border border-o-border bg-o-surface-2 px-2 py-0.5 text-[11.5px] text-o-text-2"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <Alert tone="warn">
                <div className="flex items-start gap-2">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Confirm each market&apos;s rules with a legal source — regional packs tune your workspace checklists
                    and disclosures, not formal legal counsel.
                  </span>
                </div>
              </Alert>
            </div>
          </TabPanel>
      ) : null}
    </PageContainer>
  );
}
