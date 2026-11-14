'use server';

import { query, queryRows } from '@/lib/db';
import { getWorkspaceAccess } from '@/lib/team/access';
import { roleCan } from '@/lib/team/permissions';
import { userError } from '@/lib/errors/user-error';
import { tryWorkspaceChat } from '@/lib/ai/agent-runtime';
import {
  DEFAULT_BUILTIN_POLICIES,
  evaluateComplianceText,
  runPolicyTestCases,
  type EvaluablePolicy,
  type PolicyActionMode,
  type PolicyAppliesTo,
  type PolicyCategory,
  type PolicyEvaluationResult,
  type PolicyPatternType,
  type PolicyTestCase,
} from '@/lib/compliance/policy-evaluator';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CompliancePolicyRow {
  id: string;
  ruleKey: string | null;
  name: string;
  description: string;
  category: PolicyCategory;
  framework: string;
  actionMode: PolicyActionMode;
  appliesTo: PolicyAppliesTo;
  patternType: PolicyPatternType;
  pattern: string;
  sourceDocument: string | null;
  sourceQuote: string | null;
  sourcePage: number | null;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  isEnabled: boolean;
  testCases: PolicyTestCase[];
  hitsCount: number;
  lastTriggeredAt: string | null;
  updatedAt: string;
}

export interface ComplianceFlagRow {
  id: string;
  policyId: string | null;
  conversationId: string | null;
  severity: 'high' | 'medium' | 'low';
  framework: string;
  ruleName: string;
  channel: string;
  actorType: string;
  actionTaken: string;
  redactedExcerpt: string;
  reviewStatus: 'open' | 'confirmed' | 'false_positive';
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ComplianceDataRequestRow {
  id: string;
  requestType: 'export' | 'erasure' | 'rectification' | 'opt_out';
  regulation: string;
  requesterName: string;
  requesterEmail: string;
  status: 'open' | 'in_progress' | 'pending_approval' | 'completed' | 'rejected';
  progressPct: number;
  dueAt: string;
  exportSummary: Record<string, unknown>;
  completedAt: string | null;
  createdAt: string;
}

export interface FrameworkScorecard {
  id: string;
  name: string;
  scope: string;
  coveragePct: number;
  status: 'active' | 'attention' | 'not_attested';
  note: string;
}

export interface ComplianceCenterBootstrap {
  canManage: boolean;
  sentinelEnabled: boolean;
  retentionDays: number | null;
  require2fa: boolean;
  websiteUrl: string | null;
  latestAuditScore: number | null;
  latestAuditAt: string | null;
  stats: {
    checkedReplies30d: number;
    openFlags: number;
    totalFlags30d: number;
    blockedOrHeld30d: number;
    pendingDsr: number;
    enabledPolicies: number;
    totalPolicies: number;
  };
  frameworks: FrameworkScorecard[];
  policies: CompliancePolicyRow[];
  flags: ComplianceFlagRow[];
  dataRequests: ComplianceDataRequestRow[];
  auditLogs: Array<{
    id: string;
    actorName: string | null;
    action: string;
    target: string | null;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
}

async function ensureBuiltinPolicies(workspaceId: string) {
  await query(
    `INSERT INTO public.workspace_compliance_settings (workspace_id)
     VALUES ($1)
     ON CONFLICT (workspace_id) DO NOTHING`,
    [workspaceId],
  );

  for (const def of DEFAULT_BUILTIN_POLICIES) {
    await query(
      `INSERT INTO public.compliance_policies
         (workspace_id, rule_key, name, description, category, framework, action_mode, applies_to, pattern_type, pattern, is_enabled, review_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'approved')
       ON CONFLICT (workspace_id, rule_key) WHERE rule_key IS NOT NULL DO NOTHING`,
      [
        workspaceId,
        def.ruleKey,
        def.name,
        def.description || '',
        def.category,
        def.framework,
        def.actionMode,
        def.appliesTo,
        def.patternType,
        def.pattern,
        def.isEnabled,
      ],
    );
  }
}

function mapPolicyRow(r: Record<string, unknown>): CompliancePolicyRow {
  return {
    id: String(r.id),
    ruleKey: r.rule_key ? String(r.rule_key) : null,
    name: String(r.name),
    description: String(r.description || ''),
    category: (r.category || 'custom') as PolicyCategory,
    framework: String(r.framework || 'General'),
    actionMode: (r.action_mode || 'flag') as PolicyActionMode,
    appliesTo: (r.applies_to || 'both') as PolicyAppliesTo,
    patternType: (r.pattern_type || 'keyword') as PolicyPatternType,
    pattern: String(r.pattern || ''),
    sourceDocument: r.source_document ? String(r.source_document) : null,
    sourceQuote: r.source_quote ? String(r.source_quote) : null,
    sourcePage: typeof r.source_page === 'number' ? r.source_page : null,
    reviewStatus: (r.review_status || 'approved') as 'pending' | 'approved' | 'rejected',
    isEnabled: Boolean(r.is_enabled),
    testCases: Array.isArray(r.test_cases) ? (r.test_cases as PolicyTestCase[]) : [],
    hitsCount: Number(r.hits_count || 0),
    lastTriggeredAt: r.last_triggered_at ? String(r.last_triggered_at) : null,
    updatedAt: String(r.updated_at),
  };
}

export async function getComplianceCenterAction(workspaceId: string): Promise<ComplianceCenterBootstrap> {
  const access = await getWorkspaceAccess(workspaceId, 'view');
  await ensureBuiltinPolicies(workspaceId);

  const [wsRows, settingRows, policyRows, flagRows, dsrRows, auditRows, verifCountRows, siteAuditRows] =
    await Promise.all([
      queryRows<{ data_retention_days: number | null; require_2fa: boolean | null; website_url: string | null }>(
        `SELECT data_retention_days, require_2fa, website_url FROM public.workspaces WHERE id = $1 LIMIT 1`,
        [workspaceId],
      ),
      queryRows<{ sentinel_enabled: boolean; regional_packs: Record<string, boolean>; attestations: Record<string, unknown> }>(
        `SELECT sentinel_enabled, regional_packs, attestations FROM public.workspace_compliance_settings WHERE workspace_id = $1 LIMIT 1`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT id, rule_key, name, description, category, framework, action_mode, applies_to,
                pattern_type, pattern, source_document, source_quote, source_page, review_status,
                is_enabled, test_cases, hits_count, last_triggered_at, updated_at
         FROM public.compliance_policies
         WHERE workspace_id = $1
         ORDER BY (rule_key IS NOT NULL) DESC, updated_at DESC`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT id, policy_id, conversation_id, severity, framework, rule_name, channel, actor_type,
                action_taken, redacted_excerpt, review_status, reviewed_by_name, reviewed_at, created_at
         FROM public.compliance_flags
         WHERE workspace_id = $1
         ORDER BY (review_status = 'open') DESC, created_at DESC
         LIMIT 80`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT id, request_type, regulation, requester_name, requester_email, status, progress_pct,
                due_at, export_summary, completed_at, created_at
         FROM public.compliance_data_requests
         WHERE workspace_id = $1
         ORDER BY (status IN ('open', 'in_progress', 'pending_approval')) DESC, due_at ASC
         LIMIT 50`,
        [workspaceId],
      ),
      queryRows<{ id: string; actor_name: string | null; action: string; target: string | null; details: Record<string, unknown>; created_at: string }>(
        `SELECT id, actor_name, action, target, details, created_at
         FROM public.workspace_audit_logs
         WHERE workspace_id = $1
         ORDER BY created_at DESC
         LIMIT 40`,
        [workspaceId],
      ),
      queryRows<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM public.ai_verification_logs
         WHERE workspace_id = $1 AND created_at >= now() - interval '30 days'`,
        [workspaceId],
      ),
      queryRows<{ overall_score: number; scanned_at: string }>(
        `SELECT overall_score, scanned_at FROM public.website_compliance_audits WHERE workspace_id = $1 ORDER BY scanned_at DESC LIMIT 1`,
        [workspaceId],
      ),
    ]);

  const ws = wsRows[0];
  const cfg = settingRows[0];
  const policies = policyRows.map(mapPolicyRow);
  const flags: ComplianceFlagRow[] = flagRows.map((r) => ({
    id: String(r.id),
    policyId: r.policy_id ? String(r.policy_id) : null,
    conversationId: r.conversation_id ? String(r.conversation_id) : null,
    severity: (r.severity || 'medium') as 'high' | 'medium' | 'low',
    framework: String(r.framework || 'General'),
    ruleName: String(r.rule_name),
    channel: String(r.channel || 'chat'),
    actorType: String(r.actor_type || 'ai'),
    actionTaken: String(r.action_taken || 'flagged'),
    redactedExcerpt: String(r.redacted_excerpt || ''),
    reviewStatus: (r.review_status || 'open') as 'open' | 'confirmed' | 'false_positive',
    reviewedByName: r.reviewed_by_name ? String(r.reviewed_by_name) : null,
    reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
    createdAt: String(r.created_at),
  }));
  const dataRequests: ComplianceDataRequestRow[] = dsrRows.map((r) => ({
    id: String(r.id),
    requestType: r.request_type as ComplianceDataRequestRow['requestType'],
    regulation: String(r.regulation || 'GDPR'),
    requesterName: String(r.requester_name),
    requesterEmail: String(r.requester_email),
    status: r.status as ComplianceDataRequestRow['status'],
    progressPct: Number(r.progress_pct || 0),
    dueAt: String(r.due_at),
    exportSummary: (r.export_summary || {}) as Record<string, unknown>,
    completedAt: r.completed_at ? String(r.completed_at) : null,
    createdAt: String(r.created_at),
  }));

  const isRuleActive = (key: string) => policies.some((p) => p.ruleKey === key && p.isEnabled && p.reviewStatus === 'approved');
  const openFlags = flags.filter((f) => f.reviewStatus === 'open');
  const pendingDsr = dataRequests.filter((d) => ['open', 'in_progress', 'pending_approval'].includes(d.status));
  const retentionSet = Boolean(ws?.data_retention_days && ws.data_retention_days > 0);
  const require2fa = Boolean(ws?.require_2fa);
  const hasHipaaBaa = Boolean(cfg?.attestations?.hipaaBaaSigned);

  const gdprPct =
    (isRuleActive('pii_card') ? 25 : 0) +
    (isRuleActive('pii_ssn') ? 25 : 0) +
    (retentionSet ? 25 : 0) +
    (pendingDsr.length === 0 ? 25 : 10);
  const pciPct = (isRuleActive('pii_card') ? 60 : 0) + (openFlags.filter((f) => f.framework === 'PCI DSS').length === 0 ? 40 : 15);
  const soc2Pct = (require2fa ? 40 : 10) + (isRuleActive('secret_credentials') ? 35 : 0) + (auditRows.length > 0 ? 25 : 0);
  const hipaaPct = (isRuleActive('pii_phi') ? 45 : 0) + (isRuleActive('pii_ssn') ? 25 : 0) + (hasHipaaBaa ? 30 : 0);
  const ccpaPct = (pendingDsr.length === 0 ? 50 : 25) + (siteAuditRows[0]?.overall_score ? Math.round(siteAuditRows[0].overall_score / 2) : 25);
  const euAiPct = (isRuleActive('advice_regulated') ? 40 : 0) + (isRuleActive('promise_guarantee') ? 30 : 0) + 30;

  const frameworks: FrameworkScorecard[] = [
    {
      id: 'gdpr',
      name: 'GDPR',
      scope: 'EU Privacy & DSR',
      coveragePct: gdprPct,
      status: gdprPct >= 80 ? 'active' : 'attention',
      note: pendingDsr.length ? `${pendingDsr.length} open DSR · ${retentionSet ? `${ws?.data_retention_days}d retention` : 'Set retention days'}` : retentionSet ? `Retention ${ws?.data_retention_days}d · DSR workflow active` : 'Configure workspace data retention days',
    },
    {
      id: 'pci',
      name: 'PCI DSS',
      scope: 'Payment card PAN blocking',
      coveragePct: pciPct,
      status: pciPct >= 80 ? 'active' : 'attention',
      note: isRuleActive('pii_card') ? 'Luhn PAN redaction enabled on AI & messages' : 'Enable PAN redaction rule',
    },
    {
      id: 'soc2',
      name: 'SOC 2',
      scope: 'Access, Secrets & Audit trail',
      coveragePct: soc2Pct,
      status: soc2Pct >= 80 ? 'active' : 'attention',
      note: require2fa ? 'Workspace 2FA enforced + immutable audit log' : '2FA optional · enable in security settings',
    },
    {
      id: 'hipaa',
      name: 'HIPAA',
      scope: 'PHI protection & BAA',
      coveragePct: hipaaPct,
      status: hasHipaaBaa ? 'active' : 'not_attested',
      note: hasHipaaBaa ? 'PHI rules active · BAA attested' : 'PHI guardrails tracked · legal BAA e-signature required outside app',
    },
    {
      id: 'ccpa',
      name: 'CCPA / CPRA',
      scope: 'California privacy & opt-out',
      coveragePct: ccpaPct,
      status: ccpaPct >= 80 ? 'active' : 'attention',
      note: siteAuditRows[0] ? `Website readiness score ${siteAuditRows[0].overall_score}/100` : 'Run website audit to verify footer links',
    },
    {
      id: 'eu_ai_act',
      name: 'EU AI Act',
      scope: 'AI guardrails & disclosure',
      coveragePct: euAiPct,
      status: euAiPct >= 80 ? 'active' : 'attention',
      note: isRuleActive('advice_regulated') ? 'Advice & promise blocks active' : 'Enable regulated advice guardrails',
    },
  ];

  const recent30d = flags.filter((f) => Date.now() - Date.parse(f.createdAt) <= 30 * 86_400_000);

  return {
    canManage: roleCan(access.role, 'manage_settings'),
    sentinelEnabled: cfg?.sentinel_enabled ?? true,
    retentionDays: ws?.data_retention_days ?? null,
    require2fa,
    websiteUrl: ws?.website_url ?? null,
    latestAuditScore: siteAuditRows[0]?.overall_score ?? null,
    latestAuditAt: siteAuditRows[0]?.scanned_at ?? null,
    stats: {
      checkedReplies30d: Number(verifCountRows[0]?.total || 0),
      openFlags: openFlags.length,
      totalFlags30d: recent30d.length,
      blockedOrHeld30d: recent30d.filter((f) => f.actionTaken !== 'flagged').length,
      pendingDsr: pendingDsr.length,
      enabledPolicies: policies.filter((p) => p.isEnabled && p.reviewStatus === 'approved').length,
      totalPolicies: policies.length,
    },
    frameworks,
    policies,
    flags,
    dataRequests,
    auditLogs: auditRows.map((a) => ({
      id: a.id,
      actorName: a.actor_name,
      action: a.action,
      target: a.target,
      details: a.details || {},
      createdAt: a.created_at,
    })),
  };
}

export async function toggleSentinelAction(workspaceId: string, enabled: boolean): Promise<{ success: true }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  await query(
    `INSERT INTO public.workspace_compliance_settings (workspace_id, sentinel_enabled, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id) DO UPDATE
     SET sentinel_enabled = EXCLUDED.sentinel_enabled, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [workspaceId, Boolean(enabled), access.user.id],
  );
  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'compliance.sentinel_toggled', 'sentinel', $4::jsonb)`,
    [workspaceId, access.user.id, access.user.email || 'Admin', JSON.stringify({ enabled: Boolean(enabled) })],
  ).catch(() => {});
  return { success: true };
}

export async function updateCompliancePolicyAction(
  workspaceId: string,
  policyId: string,
  patch: { isEnabled?: boolean; actionMode?: PolicyActionMode },
): Promise<{ success: true }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  if (!UUID.test(policyId || '')) throw userError('Invalid policy id.');

  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (typeof patch.isEnabled === 'boolean') {
    updates.push(`is_enabled = $${idx++}`);
    params.push(patch.isEnabled);
  }
  if (patch.actionMode && ['redact', 'block', 'flag', 'escalate', 'approval', 'require'].includes(patch.actionMode)) {
    updates.push(`action_mode = $${idx++}`);
    params.push(patch.actionMode);
  }
  if (!updates.length) return { success: true };

  params.push(policyId, workspaceId);
  const res = await query(
    `UPDATE public.compliance_policies
     SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $${idx++} AND workspace_id = $${idx}
     RETURNING id, name`,
    params,
  );
  if (!res.rows.length) throw userError('Policy not found.');

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'compliance.policy_updated', $4, $5::jsonb)`,
    [workspaceId, access.user.id, access.user.email || 'Admin', String(res.rows[0].name), JSON.stringify(patch)],
  ).catch(() => {});

  return { success: true };
}

export async function createCustomCompliancePolicyAction(
  workspaceId: string,
  input: {
    name: string;
    description?: string;
    category: PolicyCategory;
    framework: string;
    actionMode: PolicyActionMode;
    appliesTo: PolicyAppliesTo;
    patternType: PolicyPatternType;
    pattern: string;
  },
): Promise<{ policy: CompliancePolicyRow }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  const name = (input.name || '').trim().slice(0, 160);
  if (!name) throw userError('Enter a rule name.');
  const pattern = (input.pattern || '').trim().slice(0, 1000);
  if (!pattern) throw userError('Enter match keywords or a pattern.');

  const rows = await queryRows<Record<string, unknown>>(
    `INSERT INTO public.compliance_policies
       (workspace_id, name, description, category, framework, action_mode, applies_to, pattern_type, pattern, is_enabled, review_status, approved_by, approved_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'approved', $10, now(), $10)
     RETURNING *`,
    [
      workspaceId,
      name,
      (input.description || '').trim().slice(0, 1000),
      input.category,
      (input.framework || 'General').trim().slice(0, 60),
      input.actionMode,
      input.appliesTo,
      input.patternType,
      pattern,
      access.user.id,
    ],
  );

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'compliance.policy_created', $4, $5::jsonb)`,
    [workspaceId, access.user.id, access.user.email || 'Admin', name, JSON.stringify({ framework: input.framework, actionMode: input.actionMode })],
  ).catch(() => {});

  return { policy: mapPolicyRow(rows[0]) };
}

export async function deleteCompliancePolicyAction(workspaceId: string, policyId: string): Promise<{ success: true }> {
  await getWorkspaceAccess(workspaceId, 'manage_settings');
  if (!UUID.test(policyId || '')) throw userError('Invalid policy id.');
  await query(
    `DELETE FROM public.compliance_policies WHERE id = $1 AND workspace_id = $2 AND rule_key IS NULL`,
    [policyId, workspaceId],
  );
  return { success: true };
}

export async function testComplianceMessageAction(
  workspaceId: string,
  input: { text: string; channel?: 'ai' | 'human'; recordFlag?: boolean },
): Promise<PolicyEvaluationResult> {
  const access = await getWorkspaceAccess(workspaceId, 'view');
  await ensureBuiltinPolicies(workspaceId);

  const rows = await queryRows<Record<string, unknown>>(
    `SELECT id, rule_key, name, description, category, framework, action_mode, applies_to,
            pattern_type, pattern, is_enabled, review_status
     FROM public.compliance_policies
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  const policies: EvaluablePolicy[] = rows.map(mapPolicyRow);
  const res = evaluateComplianceText(input.text, policies, { channel: input.channel ?? 'ai' });

  if (input.recordFlag && res.hits.length > 0 && roleCan(access.role, 'manage_settings')) {
    const top = res.hits[0];
    await query(
      `INSERT INTO public.compliance_flags
         (workspace_id, policy_id, severity, framework, rule_name, channel, actor_type, action_taken, redacted_excerpt)
       VALUES ($1, $2, $3, $4, $5, $6, 'simulator', $7, $8)`,
      [
        workspaceId,
        top.policyId || null,
        top.severity,
        top.framework,
        top.ruleName,
        input.channel ?? 'ai',
        res.outcome === 'redact' ? 'redacted' : res.outcome === 'block' ? 'blocked' : res.outcome === 'escalate' ? 'escalated' : 'flagged',
        res.redactedText.slice(0, 500),
      ],
    ).catch(() => {});
  }

  return res;
}

export async function reviewComplianceFlagAction(
  workspaceId: string,
  flagId: string,
  decision: 'confirmed' | 'false_positive',
): Promise<{ success: true }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  if (!UUID.test(flagId || '')) throw userError('Invalid flag id.');

  const rows = await queryRows<{ id: string; rule_name: string }>(
    `UPDATE public.compliance_flags
     SET review_status = $1,
         reviewed_by = $2,
         reviewed_by_name = $3,
         reviewed_at = now()
     WHERE id = $4 AND workspace_id = $5
     RETURNING id, rule_name`,
    [decision, access.user.id, access.user.email || 'Compliance Officer', flagId, workspaceId],
  );
  if (!rows[0]) throw userError('Flag not found.');

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'compliance.flag_reviewed', $4, $5::jsonb)`,
    [workspaceId, access.user.id, access.user.email || 'Admin', rows[0].rule_name, JSON.stringify({ flagId, decision })],
  ).catch(() => {});

  return { success: true };
}

export async function createDataRequestAction(
  workspaceId: string,
  input: {
    requestType: 'export' | 'erasure' | 'rectification' | 'opt_out';
    regulation: string;
    requesterName: string;
    requesterEmail: string;
    dueDays?: number;
  },
): Promise<{ request: ComplianceDataRequestRow }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  const email = (input.requesterEmail || '').trim().toLowerCase();
  const name = (input.requesterName || '').trim().slice(0, 160);
  if (!name) throw userError('Enter the requester name.');
  if (!EMAIL.test(email)) throw userError('Enter a valid requester email address.');

  const visitorRows = await queryRows<{ id: string }>(
    `SELECT id FROM public.visitors WHERE workspace_id = $1 AND LOWER(email) = $2 LIMIT 1`,
    [workspaceId, email],
  );
  const dueDays = Math.max(1, Math.min(90, Math.round(Number(input.dueDays || 30))));

  const rows = await queryRows<Record<string, unknown>>(
    `INSERT INTO public.compliance_data_requests
       (workspace_id, request_type, regulation, requester_name, requester_email, visitor_id, status, progress_pct, due_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending_approval', $7, now() + ($8 || ' days')::interval, $9)
     RETURNING *`,
    [
      workspaceId,
      input.requestType,
      (input.regulation || 'GDPR').trim().slice(0, 40),
      name,
      email,
      visitorRows[0]?.id || null,
      visitorRows[0] ? 60 : 25,
      String(dueDays),
      access.user.id,
    ],
  );

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'compliance.dsr_created', $4, $5::jsonb)`,
    [workspaceId, access.user.id, access.user.email || 'Admin', email, JSON.stringify({ requestType: input.requestType, regulation: input.regulation })],
  ).catch(() => {});

  const r = rows[0];
  return {
    request: {
      id: String(r.id),
      requestType: r.request_type as ComplianceDataRequestRow['requestType'],
      regulation: String(r.regulation),
      requesterName: String(r.requester_name),
      requesterEmail: String(r.requester_email),
      status: r.status as ComplianceDataRequestRow['status'],
      progressPct: Number(r.progress_pct || 0),
      dueAt: String(r.due_at),
      exportSummary: (r.export_summary || {}) as Record<string, unknown>,
      completedAt: r.completed_at ? String(r.completed_at) : null,
      createdAt: String(r.created_at),
    },
  };
}

export async function processDataRequestAction(
  workspaceId: string,
  requestId: string,
  decision: 'approve_complete' | 'reject',
): Promise<{ success: true; exportBundle?: Record<string, unknown> }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  if (!UUID.test(requestId || '')) throw userError('Invalid request id.');

  const rows = await queryRows<{
    id: string;
    request_type: string;
    requester_email: string;
    requester_name: string;
    visitor_id: string | null;
  }>(
    `SELECT id, request_type, requester_email, requester_name, visitor_id
     FROM public.compliance_data_requests
     WHERE id = $1 AND workspace_id = $2
     LIMIT 1`,
    [requestId, workspaceId],
  );
  const reqRow = rows[0];
  if (!reqRow) throw userError('Data request not found.');

  if (decision === 'reject') {
    await query(
      `UPDATE public.compliance_data_requests SET status = 'rejected', approved_by = $1, updated_at = now() WHERE id = $2`,
      [access.user.id, requestId],
    );
    await query(
      `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
       VALUES ($1, $2, $3, 'compliance.dsr_rejected', $4, '{}'::jsonb)`,
      [workspaceId, access.user.id, access.user.email || 'Admin', reqRow.requester_email],
    ).catch(() => {});
    return { success: true };
  }

  const visitors = await queryRows<Record<string, unknown>>(
    `SELECT id, name, email, location, timezone, created_at
     FROM public.visitors
     WHERE workspace_id = $1 AND LOWER(email) = $2`,
    [workspaceId, reqRow.requester_email.toLowerCase()],
  );
  const visitorIds = visitors.map((v) => String(v.id));
  const conversations = visitorIds.length
    ? await queryRows<Record<string, unknown>>(
        `SELECT id, status, channel, summary, created_at
         FROM public.conversations
         WHERE workspace_id = $1 AND visitor_id = ANY($2::uuid[])`,
        [workspaceId, visitorIds],
      )
    : [];
  const convIds = conversations.map((c) => String(c.id));
  const messages = convIds.length
    ? await queryRows<Record<string, unknown>>(
        `SELECT conversation_id, sender_type, content, created_at
         FROM public.messages
         WHERE conversation_id = ANY($1::uuid[]) AND COALESCE(is_internal, false) = false
         ORDER BY created_at ASC`,
        [convIds],
      )
    : [];

  let summary: Record<string, unknown> = {
    visitorsMatched: visitors.length,
    conversationsMatched: conversations.length,
    messagesMatched: messages.length,
    processedAt: new Date().toISOString(),
  };
  let exportBundle: Record<string, unknown> | undefined;

  if (reqRow.request_type === 'export') {
    exportBundle = {
      exportedAt: new Date().toISOString(),
      requester: { name: reqRow.requester_name, email: reqRow.requester_email },
      visitors,
      conversations,
      messages,
    };
  } else if (reqRow.request_type === 'erasure' && visitorIds.length > 0) {
    const anonLabel = `Erased User (${requestId.slice(0, 6)})`;
    await query(
      `UPDATE public.visitors
       SET name = $1, email = NULL, phone = NULL, metadata = '{}'::jsonb
       WHERE workspace_id = $2 AND id = ANY($3::uuid[])`,
      [anonLabel, workspaceId, visitorIds],
    );
    await query(
      `UPDATE public.conversations
       SET customer_email = NULL, summary = '[Erased per GDPR Art. 17]'
       WHERE workspace_id = $1 AND visitor_id = ANY($2::uuid[])`,
      [workspaceId, visitorIds],
    );
    summary = { ...summary, anonymizedVisitorCount: visitorIds.length };
  }

  await query(
    `UPDATE public.compliance_data_requests
     SET status = 'completed',
         progress_pct = 100,
         export_summary = $1::jsonb,
         approved_by = $2,
         completed_at = now(),
         updated_at = now()
     WHERE id = $3 AND workspace_id = $4`,
    [JSON.stringify(summary), access.user.id, requestId, workspaceId],
  );

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      workspaceId,
      access.user.id,
      access.user.email || 'Admin',
      reqRow.request_type === 'erasure' ? 'compliance.dsr_erased' : 'compliance.dsr_completed',
      reqRow.requester_email,
      JSON.stringify(summary),
    ],
  ).catch(() => {});

  return { success: true, exportBundle };
}

export async function updateDataRetentionAction(workspaceId: string, days: number | null): Promise<{ success: true }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  const cleanDays = days === null ? null : Math.max(7, Math.min(3650, Math.round(Number(days))));
  await query(
    `UPDATE public.workspaces SET data_retention_days = $1, updated_at = now() WHERE id = $2`,
    [cleanDays, workspaceId],
  );
  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'compliance.retention_updated', 'data_retention_days', $4::jsonb)`,
    [workspaceId, access.user.id, access.user.email || 'Admin', JSON.stringify({ days: cleanDays })],
  ).catch(() => {});
  return { success: true };
}

/* ── Policy to Guardrails Workflow Actions ─────────────────────────────────── */

export interface ExtractedPolicyRule {
  tempId: string;
  name: string;
  kind: 'Block' | 'Approval' | 'Escalate' | 'Require';
  actionMode: PolicyActionMode;
  category: PolicyCategory;
  framework: string;
  page: number;
  quote: string;
  patternType: PolicyPatternType;
  pattern: string;
  tests: PolicyTestCase[];
  decision: 'pending' | 'approved' | 'rejected';
}

function heuristicExtractRules(text: string): ExtractedPolicyRule[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 18);

  const extracted: ExtractedPolicyRule[] = [];
  const seenNames = new Set<string>();

  for (let idx = 0; idx < sentences.length && extracted.length < 8; idx++) {
    const s = sentences[idx];
    const low = s.toLowerCase();
    let kind: ExtractedPolicyRule['kind'] = 'Block';
    let actionMode: PolicyActionMode = 'block';
    let category: PolicyCategory = 'disclosure';
    let framework = 'General';
    let pattern = '';
    let expected: PolicyTestCase['expected'] = 'block';

    if (/(must not|never|prohibit|do not|ban)/i.test(low)) {
      kind = 'Block';
      actionMode = 'block';
    } else if (/(escalat|ombudsman|regulator|lawyer|court|legal)/i.test(low)) {
      kind = 'Escalate';
      actionMode = 'escalate';
      expected = 'escalate';
    } else if (/(approv|supervisor|manager|limit|exceed)/i.test(low)) {
      kind = 'Approval';
      actionMode = 'approval';
      category = 'financial';
      expected = 'hold';
    } else if (/(verif|two-factor|2fa|identity|consent|require)/i.test(low)) {
      kind = 'Require';
      actionMode = 'require';
      framework = 'SOC 2';
      expected = 'hold';
    } else {
      continue;
    }

    if (/invest|fund|stock|advice|financial/i.test(low)) {
      category = 'advice';
      framework = 'EU AI Act';
      pattern = 'recommend|invest|safe bet|fastest growing|buy shares';
    } else if (/refund|\$\d+|usd|credit|payout/i.test(low)) {
      category = 'financial';
      framework = 'SOC 2';
      pattern = 'refund|credit|payout|reimburse';
    } else if (/delivery|carrier|shipping|arrive|guarantee/i.test(low)) {
      category = 'disclosure';
      framework = 'Consumer Law';
      pattern = 'definitely arrive|guaranteed delivery|promise delivery';
    } else if (/ombudsman|regulator|lawyer|court/i.test(low)) {
      category = 'disclosure';
      framework = 'GDPR';
      pattern = 'ombudsman|regulator|lawyer|legal action';
    } else if (/card|address|password|ssn|identity/i.test(low)) {
      category = 'pii';
      framework = 'PCI DSS';
      pattern = 'change my card|change my address|password|ssn';
    } else {
      const words = s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 5)
        .slice(0, 4);
      pattern = words.join('|');
    }

    const title = s.length > 90 ? `${s.slice(0, 87)}...` : s;
    if (!pattern || seenNames.has(title)) continue;
    seenNames.add(title);

    const sampleKeyword = pattern.split('|')[0] || 'policy trigger';
    extracted.push({
      tempId: `ext-${idx + 1}`,
      name: title,
      kind,
      actionMode,
      category,
      framework,
      page: Math.max(1, Math.ceil((idx + 1) / 3)),
      quote: s.slice(0, 320),
      patternType: 'keyword',
      pattern,
      tests: runPolicyTestCases(
        {
          name: title,
          category,
          framework,
          actionMode,
          appliesTo: 'both',
          patternType: 'keyword',
          pattern,
          isEnabled: true,
        },
        [
          { expected, message: `Test message mentioning ${sampleKeyword}`, actor: 'Customer → AI' },
          { expected: 'allow', message: 'What are your standard support hours?', actor: 'Customer → AI' },
        ],
      ),
      decision: 'pending',
    });
  }

  return extracted;
}

export async function extractPolicyGuardrailsAction(
  workspaceId: string,
  input: { documentName: string; rawText: string },
): Promise<{ documentName: string; rules: ExtractedPolicyRule[]; usedAi: boolean }> {
  await getWorkspaceAccess(workspaceId, 'manage_settings');
  const rawText = (input.rawText || '').trim().slice(0, 30_000);
  if (rawText.length < 30) {
    throw userError('Paste or upload at least one paragraph of policy text (30+ characters).');
  }
  const documentName = (input.documentName || 'Uploaded Policy Document').trim().slice(0, 160);

  let rules: ExtractedPolicyRule[] = [];
  let usedAi = false;

  try {
    const systemPrompt =
      'You are a compliance engineer. Extract enforceable customer-support guardrails from the user policy text. ' +
      'Return ONLY a JSON array of up to 6 objects with keys: name, kind ("Block"|"Approval"|"Escalate"|"Require"), ' +
      'category ("pii"|"advice"|"disclosure"|"financial"|"custom"), framework (e.g. "GDPR"|"PCI DSS"|"EU AI Act"|"SOC 2"), ' +
      'quote (verbatim sentence from policy), keywords (pipe-separated lowercase trigger phrases like "safe bet|buy fund"), ' +
      'positiveTest (message that MUST trigger rule), negativeTest (benign message that MUST pass).';

    const reply = await tryWorkspaceChat(
      workspaceId,
      systemPrompt,
      `Policy (${documentName}):\n${rawText.slice(0, 12_000)}`,
      1200,
    );

    if (reply) {
      const jsonMatch = reply.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          usedAi = true;
          rules = parsed.slice(0, 8).map((item, idx) => {
            const rawKind = String(item.kind || 'Block');
            const kind: ExtractedPolicyRule['kind'] =
              rawKind === 'Approval' || rawKind === 'Escalate' || rawKind === 'Require' ? rawKind : 'Block';
            const actionMode: PolicyActionMode =
              kind === 'Approval'
                ? 'approval'
                : kind === 'Escalate'
                  ? 'escalate'
                  : kind === 'Require'
                    ? 'require'
                    : 'block';
            const rawCat = String(item.category || '');
            const category = (['pii', 'advice', 'disclosure', 'financial', 'custom'].includes(rawCat)
              ? rawCat
              : 'custom') as PolicyCategory;
            const pattern = String(item.keywords || item.name || '').slice(0, 300);
            const expected: PolicyTestCase['expected'] =
              kind === 'Escalate' ? 'escalate' : kind === 'Approval' || kind === 'Require' ? 'hold' : 'block';
            const name = String(item.name || `Rule ${idx + 1}`).slice(0, 160);
            const framework = String(item.framework || 'General').slice(0, 60);

            return {
              tempId: `ai-ext-${idx + 1}`,
              name,
              kind,
              actionMode,
              category,
              framework,
              page: idx + 1,
              quote: String(item.quote || name).slice(0, 320),
              patternType: 'keyword',
              pattern,
              tests: runPolicyTestCases(
                {
                  name,
                  category,
                  framework,
                  actionMode,
                  appliesTo: 'both',
                  patternType: 'keyword',
                  pattern,
                  isEnabled: true,
                },
                [
                  {
                    expected,
                    message: String(item.positiveTest || `Message referencing ${pattern.split('|')[0] || 'policy'}`),
                    actor: 'AI draft / Customer',
                  },
                  {
                    expected: 'allow',
                    message: String(item.negativeTest || 'Can I view my invoice from last month?'),
                    actor: 'Customer',
                  },
                ],
              ),
              decision: 'pending',
            };
          });
        }
      }
    }
  } catch {
    // Fall back to deterministic extraction when no workspace LLM key is configured or parsing fails
  }

  if (!rules.length) {
    rules = heuristicExtractRules(rawText);
  }

  if (!rules.length) {
    throw userError('No enforceable obligation clauses (e.g. must/never/approve/escalate) were found in this text. Try adding specific rules or constraints.');
  }

  return { documentName, rules, usedAi };
}

export async function runSinglePolicyTestsAction(
  workspaceId: string,
  rule: {
    name: string;
    category: PolicyCategory;
    framework: string;
    actionMode: PolicyActionMode;
    patternType: PolicyPatternType;
    pattern: string;
    tests: PolicyTestCase[];
  },
): Promise<PolicyTestCase[]> {
  await getWorkspaceAccess(workspaceId, 'manage_settings');
  return runPolicyTestCases(
    {
      name: rule.name,
      category: rule.category,
      framework: rule.framework,
      actionMode: rule.actionMode,
      appliesTo: 'both',
      patternType: rule.patternType,
      pattern: rule.pattern,
      isEnabled: true,
    },
    rule.tests,
  );
}

export async function activateApprovedPoliciesAction(
  workspaceId: string,
  input: {
    documentName: string;
    rules: Array<{
      name: string;
      category: PolicyCategory;
      framework: string;
      actionMode: PolicyActionMode;
      patternType: PolicyPatternType;
      pattern: string;
      quote: string;
      page: number;
      tests: PolicyTestCase[];
    }>;
  },
): Promise<{ savedCount: number }> {
  const access = await getWorkspaceAccess(workspaceId, 'manage_settings');
  if (!input.rules?.length) throw userError('Approve at least one rule before making rules live.');

  let savedCount = 0;
  for (const r of input.rules) {
    const cleanName = (r.name || '').trim().slice(0, 160);
    if (!cleanName) continue;
    await query(
      `INSERT INTO public.compliance_policies
         (workspace_id, name, description, category, framework, action_mode, applies_to, pattern_type, pattern,
          source_document, source_quote, source_page, review_status, is_enabled, test_cases, approved_by, approved_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'both', $7, $8, $9, $10, $11, 'approved', true, $12::jsonb, $13, now(), $13)`,
      [
        workspaceId,
        cleanName,
        `Extracted from ${input.documentName.slice(0, 120)}`,
        r.category,
        r.framework || 'General',
        r.actionMode,
        r.patternType,
        (r.pattern || cleanName).slice(0, 1000),
        input.documentName.slice(0, 160),
        (r.quote || '').slice(0, 600),
        Math.max(1, Math.trunc(r.page || 1)),
        JSON.stringify(r.tests || []),
        access.user.id,
      ],
    );
    savedCount++;
  }

  await query(
    `INSERT INTO public.workspace_audit_logs (workspace_id, actor_id, actor_name, action, target, details)
     VALUES ($1, $2, $3, 'compliance.guardrails_activated', $4, $5::jsonb)`,
    [
      workspaceId,
      access.user.id,
      access.user.email || 'Compliance Officer',
      input.documentName.slice(0, 160),
      JSON.stringify({ savedCount }),
    ],
  ).catch(() => {});

  return { savedCount };
}
