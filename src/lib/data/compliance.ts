'use client';

import {
  activateApprovedPoliciesAction,
  createCustomCompliancePolicyAction,
  createDataRequestAction,
  deleteCompliancePolicyAction,
  extractPolicyGuardrailsAction,
  getComplianceCenterAction,
  processDataRequestAction,
  reviewComplianceFlagAction,
  runSinglePolicyTestsAction,
  testComplianceMessageAction,
  toggleSentinelAction,
  updateCompliancePolicyAction,
  updateDataRetentionAction,
  type ComplianceCenterBootstrap,
  type ComplianceDataRequestRow,
  type ComplianceFlagRow,
  type CompliancePolicyRow,
  type ExtractedPolicyRule,
  type FrameworkScorecard,
} from '@/app/actions/compliance';
import {
  getWebsiteAuditAction,
  resolveWebsiteAuditFindingAction,
  runWebsiteAuditAction,
  toggleRegionalPackAction,
  type RegionalPackKey,
  type WebsiteAuditBootstrap,
  type WebsiteAuditFinding,
  type WebsiteAuditRun,
} from '@/app/actions/website-audit';
import { downloadCsv } from './csv';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

// TODO(backend): Add scheduled multi-page headless browser crawl (Playwright) for cookie consent execution checks, plus legal HIPAA BAA e-signature storage in workspace compliance attestations.

export type {
  ComplianceCenterBootstrap,
  ComplianceDataRequestRow,
  ComplianceFlagRow,
  CompliancePolicyRow,
  ExtractedPolicyRule,
  FrameworkScorecard,
  RegionalPackKey,
  WebsiteAuditBootstrap,
  WebsiteAuditFinding,
  WebsiteAuditRun,
};

export function getComplianceCenter(workspaceId: string) {
  return getComplianceCenterAction(workspaceId);
}

export function toggleSentinel(workspaceId: string, enabled: boolean) {
  return toggleSentinelAction(workspaceId, enabled);
}

export function updateCompliancePolicy(
  workspaceId: string,
  policyId: string,
  patch: Parameters<typeof updateCompliancePolicyAction>[2],
) {
  return updateCompliancePolicyAction(workspaceId, policyId, patch);
}

export function createCustomCompliancePolicy(
  workspaceId: string,
  input: Parameters<typeof createCustomCompliancePolicyAction>[1],
) {
  return createCustomCompliancePolicyAction(workspaceId, input);
}

export function deleteCompliancePolicy(workspaceId: string, policyId: string) {
  return deleteCompliancePolicyAction(workspaceId, policyId);
}

export function testComplianceMessage(
  workspaceId: string,
  input: { text: string; channel?: 'ai' | 'human'; recordFlag?: boolean },
) {
  return testComplianceMessageAction(workspaceId, input);
}

export function reviewComplianceFlag(
  workspaceId: string,
  flagId: string,
  decision: 'confirmed' | 'false_positive',
) {
  return reviewComplianceFlagAction(workspaceId, flagId, decision);
}

export function createDataRequest(
  workspaceId: string,
  input: Parameters<typeof createDataRequestAction>[1],
) {
  return createDataRequestAction(workspaceId, input);
}

export function processDataRequest(
  workspaceId: string,
  requestId: string,
  decision: 'approve_complete' | 'reject',
) {
  return processDataRequestAction(workspaceId, requestId, decision);
}

export function updateDataRetention(workspaceId: string, days: number | null) {
  return updateDataRetentionAction(workspaceId, days);
}

export function extractPolicyGuardrails(
  workspaceId: string,
  input: { documentName: string; rawText: string },
) {
  return extractPolicyGuardrailsAction(workspaceId, input);
}

export function runSinglePolicyTests(
  workspaceId: string,
  rule: Parameters<typeof runSinglePolicyTestsAction>[1],
) {
  return runSinglePolicyTestsAction(workspaceId, rule);
}

export function activateApprovedPolicies(
  workspaceId: string,
  input: Parameters<typeof activateApprovedPoliciesAction>[1],
) {
  return activateApprovedPoliciesAction(workspaceId, input);
}

export function getWebsiteAudit(workspaceId: string) {
  return getWebsiteAuditAction(workspaceId);
}

export function runWebsiteAudit(workspaceId: string, targetUrl: string) {
  return runWebsiteAuditAction(workspaceId, targetUrl);
}

export function resolveWebsiteAuditFinding(workspaceId: string, auditId: string, findingId: string) {
  return resolveWebsiteAuditFindingAction(workspaceId, auditId, findingId);
}

export function toggleRegionalPack(workspaceId: string, pack: RegionalPackKey, enabled: boolean) {
  return toggleRegionalPackAction(workspaceId, pack, enabled);
}

export function exportComplianceEvidenceCsv(bundle: ComplianceCenterBootstrap): void {
  const rows: unknown[][] = [];
  for (const fw of bundle.frameworks) {
    rows.push(['Framework', fw.name, fw.status, `${fw.coveragePct}%`, fw.note]);
  }
  for (const pol of bundle.policies) {
    rows.push([
      'Policy',
      pol.name,
      pol.isEnabled ? 'enabled' : 'disabled',
      pol.actionMode,
      `${pol.framework} · ${pol.hitsCount} hits`,
    ]);
  }
  for (const fl of bundle.flags) {
    rows.push(['Flag', fl.ruleName, fl.reviewStatus, fl.actionTaken, `${fl.framework} · ${fl.createdAt}`]);
  }
  for (const d of bundle.dataRequests) {
    rows.push(['DSR', `${d.requestType} (${d.regulation})`, d.status, `${d.progressPct}%`, d.requesterEmail]);
  }
  downloadCsv('orbat-compliance-evidence.csv', ['Section', 'Control / Item', 'Status', 'Value / Action', 'Detail'], rows);
}

export function downloadDsrBundleJson(filename: string, payload: Record<string, unknown>): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function useComplianceLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
) {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 30_000,
    onRefresh,
  });
}
