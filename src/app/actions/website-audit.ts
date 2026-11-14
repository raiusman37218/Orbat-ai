'use server';

import * as dns from 'node:dns';
import * as net from 'node:net';
import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import { roleCan } from '@/lib/team/permissions';
import { userError } from '@/lib/errors/user-error';

export type RegionalPackKey = 'eu' | 'us' | 'pk' | 'gcc';

export interface WebsiteAuditFinding {
  id: string;
  severity: 'High' | 'Medium' | 'Low';
  title: string;
  where: string;
  framework: string;
  fix: string;
  points: number;
  resolved: boolean;
}

export interface WebsiteAuditRun {
  id: string;
  targetUrl: string;
  overallScore: number;
  httpStatus: number | null;
  frameworkScores: Array<{ name: string; score: number; note: string }>;
  findings: WebsiteAuditFinding[];
  discoveredSummary: {
    headersPresent: string[];
    headersMissing: string[];
    trackersDetected: string[];
    linksDetected: string[];
    hasCookieBannerHint: boolean;
    hasWidgetSnippet: boolean;
    imagesWithoutAlt: number;
    totalImages: number;
    pageTitle: string | null;
  };
  scannedAt: string;
}

export interface WebsiteAuditBootstrap {
  canManage: boolean;
  workspaceWebsiteUrl: string | null;
  latestRun: WebsiteAuditRun | null;
  history: Array<{ id: string; targetUrl: string; overallScore: number; scannedAt: string }>;
  regionalPacks: Record<RegionalPackKey, boolean>;
}

function isPrivateIp(ip: string): boolean {
  const n = ip.toLowerCase();
  if (net.isIPv4(n)) {
    const [a, b] = n.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (net.isIPv6(n)) {
    if (n === '::1' || n === '::') return true;
    if (n.startsWith('::ffff:')) return isPrivateIp(n.slice(7));
    return /^(fc|fd)/i.test(n) || /^fe[89ab]/i.test(n);
  }
  return true;
}

async function assertPublicHttpsTarget(rawUrl: string): Promise<URL> {
  const trimmed = (rawUrl || '').trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw userError('Enter a valid public domain or URL (for example https://example.com).');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw userError('Only HTTP/HTTPS website URLs can be scanned.');
  }
  if (parsed.username || parsed.password) {
    throw userError('URLs with embedded credentials are not allowed.');
  }
  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw userError('Internal or localhost addresses cannot be scanned.');
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw userError('Private IP addresses cannot be scanned.');
    return parsed;
  }
  let records: Array<{ address: string }> = [];
  try {
    records = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch {
    throw userError(`Could not resolve DNS for ${host}. Check the domain name.`);
  }
  if (!records.length || records.some((r) => isPrivateIp(r.address))) {
    throw userError('Target host resolved to an unreachable or private address.');
  }
  return parsed;
}

function mapAuditRow(r: Record<string, unknown>): WebsiteAuditRun {
  return {
    id: String(r.id),
    targetUrl: String(r.target_url),
    overallScore: Number(r.overall_score || 0),
    httpStatus: typeof r.http_status === 'number' ? r.http_status : null,
    frameworkScores: Array.isArray(r.framework_scores)
      ? (r.framework_scores as WebsiteAuditRun['frameworkScores'])
      : [],
    findings: Array.isArray(r.findings)
      ? (r.findings as WebsiteAuditFinding[])
      : [],
    discoveredSummary: (r.discovered_summary || {}) as WebsiteAuditRun['discoveredSummary'],
    scannedAt: String(r.scanned_at),
  };
}

export async function getWebsiteAuditAction(workspaceId: string): Promise<WebsiteAuditBootstrap> {
  const access = await getWorkspaceAccess(workspaceId, 'view');

  const [wsRows, settingsRows, auditRows] = await Promise.all([
    queryRows<{ website_url: string | null }>(`SELECT website_url FROM public.workspaces WHERE id = $1 LIMIT 1`, [workspaceId]),
    queryRows<{ regional_packs: Record<string, boolean> }>(
      `SELECT regional_packs FROM public.workspace_compliance_settings WHERE workspace_id = $1 LIMIT 1`,
      [workspaceId],
    ),
    queryRows<Record<string, unknown>>(
      `SELECT id, target_url, overall_score, framework_scores, findings, discovered_summary, http_status, scanned_at
       FROM public.website_compliance_audits
       WHERE workspace_id = $1
       ORDER BY scanned_at DESC
       LIMIT 6`,
      [workspaceId],
    ),
  ]);

  const rawPacks = settingsRows[0]?.regional_packs || {};

  return {
    canManage: roleCan(access.role, 'manage_settings'),
    workspaceWebsiteUrl: wsRows[0]?.website_url || null,
    latestRun: auditRows[0] ? mapAuditRow(auditRows[0]) : null,
    history: auditRows.map((a) => ({
      id: String(a.id),
      targetUrl: String(a.target_url),
      overallScore: Number(a.overall_score || 0),
      scannedAt: String(a.scanned_at),
    })),
    regionalPacks: {
      eu: Boolean(rawPacks.eu),
      us: Boolean(rawPacks.us),
      pk: Boolean(rawPacks.pk),
      gcc: Boolean(rawPacks.gcc),
    },
  };
}

export async function runWebsiteAuditAction(
  workspaceId: string,
  targetUrlInput: string,
): Promise<{ audit: WebsiteAuditRun }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  const targetUrl = await assertPublicHttpsTarget(targetUrlInput);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'ORBAT-Compliance-Auditor/1.0 (+https://orbat.ai)' },
    });
  } catch (err) {
    clearTimeout(timeout);
    throw userError(
      `Failed to fetch ${targetUrl.hostname}: ${err instanceof Error ? err.message : 'network error'}`,
    );
  }
  clearTimeout(timeout);

  const html = (await res.text()).slice(0, 1_500_000);
  const lowHtml = html.toLowerCase();

  const headerChecks = [
    'strict-transport-security',
    'content-security-policy',
    'x-content-type-options',
    'x-frame-options',
    'referrer-policy',
  ];
  const headersPresent = headerChecks.filter((h) => Boolean(res.headers.get(h)));
  const headersMissing = headerChecks.filter((h) => !res.headers.get(h));

  const trackersDetected: string[] = [];
  if (/googletagmanager\.com|gtag\(/i.test(html)) trackersDetected.push('Google Tag Manager / GA');
  if (/connect\.facebook\.net|fbq\(/i.test(html)) trackersDetected.push('Meta Pixel');
  if (/analytics\.tiktok\.com|ttq\./i.test(html)) trackersDetected.push('TikTok Pixel');
  if (/hotjar\.com/i.test(html)) trackersDetected.push('Hotjar');
  if (/cdn\.segment\.com/i.test(html)) trackersDetected.push('Segment');

  const linksDetected: string[] = [];
  const hasPrivacyLink = /privacy[\s_-]*policy|href=["'][^"']*privacy/i.test(html);
  if (hasPrivacyLink) linksDetected.push('Privacy policy link');
  const hasRefundLink = /refund|return[\s_-]*policy/i.test(html);
  if (hasRefundLink) linksDetected.push('Refund / Return policy reference');
  const hasDoNotSell = /do[\s-]+not[\s-]+sell|your[\s-]+privacy[\s-]+choices/i.test(html);
  if (hasDoNotSell) linksDetected.push('CCPA opt-out link');
  const hasTerms = /terms[\s_-]*(?:of|&amp;|&)?\s*(?:service|use)/i.test(html);
  if (hasTerms) linksDetected.push('Terms of service');

  const hasCookieBannerHint = /cookie(?:bot|yes|consent)|onetrust|trustarc|accept\s+cookies|cookie\s+preferences/i.test(lowHtml);
  const hasWidgetSnippet = /orbat|zentry|chat-widget/i.test(lowHtml);
  const titleMatch = html.match(/<title[^>]*>([^<]{1,140})<\/title>/i);
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const imagesWithoutAlt = imgTags.filter((tag) => !/\balt\s*=\s*["'][^"']+["']/i.test(tag)).length;

  const findings: WebsiteAuditFinding[] = [];
  if (targetUrl.protocol !== 'https:' || !res.headers.get('strict-transport-security')) {
    findings.push({
      id: 'f-hsts',
      severity: 'High',
      title: 'Strict-Transport-Security (HSTS) header missing',
      where: `HTTP response headers · ${targetUrl.hostname}`,
      framework: 'SOC 2 / PCI DSS',
      fix: 'Send Strict-Transport-Security: max-age=31536000; includeSubDomains over HTTPS.',
      points: 10,
      resolved: false,
    });
  }
  if (!res.headers.get('content-security-policy')) {
    findings.push({
      id: 'f-csp',
      severity: 'Medium',
      title: 'Content-Security-Policy (CSP) header not detected',
      where: `HTTP response headers · ${targetUrl.hostname}`,
      framework: 'SOC 2',
      fix: 'Add a Content-Security-Policy header limiting script-src and frame-ancestors.',
      points: 6,
      resolved: false,
    });
  }
  if (!hasPrivacyLink) {
    findings.push({
      id: 'f-privacy',
      severity: 'High',
      title: 'Privacy Policy link not detected in page markup',
      where: `DOM scan · ${targetUrl.pathname || '/'}`,
      framework: 'GDPR / CCPA',
      fix: 'Expose a clear link to your privacy policy in the global site footer.',
      points: 10,
      resolved: false,
    });
  }
  if (trackersDetected.length > 0 && !hasCookieBannerHint) {
    findings.push({
      id: 'f-cookie-consent',
      severity: 'High',
      title: `${trackersDetected.length} analytics tracker(s) loaded without visible consent banner markup`,
      where: `Trackers: ${trackersDetected.join(', ')}`,
      framework: 'GDPR / ePrivacy',
      fix: 'Gate marketing & analytics pixels behind an explicit cookie consent manager.',
      points: 10,
      resolved: false,
    });
  }
  if (!hasDoNotSell) {
    findings.push({
      id: 'f-ccpa',
      severity: 'Medium',
      title: '“Do not sell or share my info” link not found',
      where: `Footer DOM scan · ${targetUrl.pathname || '/'}`,
      framework: 'CCPA / CPRA',
      fix: 'Add a privacy choices footer link pointing to your opt-out or ORBAT DSR flow.',
      points: 5,
      resolved: false,
    });
  }
  if (imagesWithoutAlt > 0) {
    findings.push({
      id: 'f-alt',
      severity: imagesWithoutAlt >= 5 ? 'Medium' : 'Low',
      title: `${imagesWithoutAlt} of ${imgTags.length} images are missing descriptive alt attributes`,
      where: `DOM accessibility check · ${targetUrl.pathname || '/'}`,
      framework: 'WCAG 2.2',
      fix: 'Add concise alt="..." descriptions to informative images.',
      points: imagesWithoutAlt >= 5 ? 5 : 2,
      resolved: false,
    });
  }
  if (!hasRefundLink) {
    findings.push({
      id: 'f-refund',
      severity: 'Low',
      title: 'Refund or return policy link not visible on landing page',
      where: `Footer DOM scan · ${targetUrl.pathname || '/'}`,
      framework: 'Consumer law',
      fix: 'Link your refund and processing window terms from checkout and footer navigation.',
      points: 4,
      resolved: false,
    });
  }

  const penalty = findings.reduce((acc, f) => acc + f.points, 0);
  const overallScore = Math.max(20, Math.min(100, 100 - penalty));

  const gdprScore = Math.max(30, 100 - (hasPrivacyLink ? 0 : 25) - (trackersDetected.length > 0 && !hasCookieBannerHint ? 25 : 0));
  const ccpaScore = hasDoNotSell && hasPrivacyLink ? 95 : hasPrivacyLink ? 75 : 50;
  const soc2Score = Math.max(40, 100 - headersMissing.length * 10);
  const wcagScore = imgTags.length === 0 ? 90 : Math.max(45, 100 - Math.round((imagesWithoutAlt / imgTags.length) * 40));
  const frameworkScores = [
    { name: 'GDPR', score: gdprScore, note: hasCookieBannerHint ? 'Consent marker present' : 'Check cookie consent gating' },
    { name: 'CCPA / CPRA', score: ccpaScore, note: hasDoNotSell ? 'Opt-out link found' : 'Opt-out link missing' },
    { name: 'Security Headers', score: soc2Score, note: `${headersPresent.length}/5 hardened headers present` },
    { name: 'WCAG 2.2', score: wcagScore, note: `${imagesWithoutAlt} image(s) missing alt text` },
  ];

  const discoveredSummary = {
    headersPresent,
    headersMissing,
    trackersDetected,
    linksDetected,
    hasCookieBannerHint,
    hasWidgetSnippet,
    imagesWithoutAlt,
    totalImages: imgTags.length,
    pageTitle: titleMatch?.[1]?.trim() || null,
  };

  const rows = await queryRows<Record<string, unknown>>(
    `INSERT INTO public.website_compliance_audits
       (workspace_id, target_url, overall_score, framework_scores, findings, discovered_summary, http_status, scanned_by)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
     RETURNING *`,
    [
      workspaceId,
      targetUrl.toString(),
      overallScore,
      JSON.stringify(frameworkScores),
      JSON.stringify(findings),
      JSON.stringify(discoveredSummary),
      res.status,
      access.user.id,
    ],
  );

  await query(
    `UPDATE public.workspaces SET website_url = COALESCE(NULLIF(website_url, ''), $1), updated_at = now() WHERE id = $2`,
    [targetUrl.toString(), workspaceId],
  ).catch(() => {});

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'compliance.website_audit_run', $4, $5::jsonb)`,
    [workspaceId, access.user.id, access.user.email || 'Admin', targetUrl.hostname, JSON.stringify({ score: overallScore, findings: findings.length })],
  ).catch(() => {});

  return { audit: mapAuditRow(rows[0]) };
}

export async function resolveWebsiteAuditFindingAction(
  workspaceId: string,
  auditId: string,
  findingId: string,
): Promise<{ audit: WebsiteAuditRun }> {
  await getWorkspaceAccess(workspaceId, 'manage_settings');
  const rows = await queryRows<Record<string, unknown>>(
    `SELECT * FROM public.website_compliance_audits WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
    [auditId, workspaceId],
  );
  if (!rows[0]) throw userError('Audit snapshot not found.');

  const currentFindings = (Array.isArray(rows[0].findings) ? rows[0].findings : []) as WebsiteAuditFinding[];
  const nextFindings = currentFindings.map((f) => (f.id === findingId ? { ...f, resolved: true } : f));
  const penalty = nextFindings.filter((f) => !f.resolved).reduce((acc, f) => acc + Number(f.points || 0), 0);
  const nextScore = Math.max(20, Math.min(100, 100 - penalty));

  const updated = await queryRows<Record<string, unknown>>(
    `UPDATE public.website_compliance_audits
     SET findings = $1::jsonb, overall_score = $2
     WHERE id = $3 AND workspace_id = $4
     RETURNING *`,
    [JSON.stringify(nextFindings), nextScore, auditId, workspaceId],
  );

  return { audit: mapAuditRow(updated[0]) };
}

export async function toggleRegionalPackAction(
  workspaceId: string,
  pack: RegionalPackKey,
  enabled: boolean,
): Promise<{ success: true }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  const rows = await queryRows<{ regional_packs: Record<string, boolean> }>(
    `SELECT regional_packs FROM public.workspace_compliance_settings WHERE workspace_id = $1 LIMIT 1`,
    [workspaceId],
  );
  const prev = rows[0]?.regional_packs || {};
  const next = { ...prev, [pack]: Boolean(enabled) };

  await query(
    `INSERT INTO public.workspace_compliance_settings (workspace_id, regional_packs, updated_by)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (workspace_id) DO UPDATE
     SET regional_packs = EXCLUDED.regional_packs, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [workspaceId, JSON.stringify(next), access.user.id],
  );

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'compliance.regional_pack_updated', $4, $5::jsonb)`,
    [workspaceId, access.user.id, access.user.email || 'Admin', pack.toUpperCase(), JSON.stringify({ enabled: Boolean(enabled) })],
  ).catch(() => {});

  return { success: true };
}
