'use client';

import {
  createWorkflowAction,
  deleteWorkflowAction,
  getAutomationStudioBootstrapAction,
  runWorkflowTestAction,
  saveWorkflowGraphAction,
  setWorkflowStatusAction,
  type AutomationRuleRunSummary,
  type AutomationRuleSummary,
  type AutomationStudioBootstrap,
  type AutomationWorkflowRecord,
  type WorkflowRunRecord,
} from '@/app/actions/automation-studio';
import {
  deleteRuleAction,
  setRuleActiveAction,
} from '@/app/actions/automation';
import {
  BLOCK_PALETTE,
  WORKFLOW_TEMPLATES,
  edgeBezierPath,
  edgeLabelPoint,
  getWorkflowTemplate,
  nextNodePosition,
  type PaletteBlockSpec,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowNodeKind,
  type WorkflowSimStep,
  type WorkflowStatus,
  type WorkflowTemplateSpec,
} from '@/lib/automation/workflow-templates';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';

export type {
  AutomationRuleRunSummary,
  AutomationRuleSummary,
  AutomationStudioBootstrap,
  AutomationWorkflowRecord,
  PaletteBlockSpec,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowRunRecord,
  WorkflowSimStep,
  WorkflowStatus,
  WorkflowTemplateSpec,
};

export {
  BLOCK_PALETTE,
  WORKFLOW_TEMPLATES,
  edgeBezierPath,
  edgeLabelPoint,
  getWorkflowTemplate,
  nextNodePosition,
};

// TODO(backend): Visual workflows are stored in `public.automation_workflows`
// with full test simulation (calling workspace AI when configured) and queue
// recording via NestJS `QUEUE_AUTOMATIONS` (`run_workflow`). Connecting live
// inbound conversation webhooks directly to multi-branch Delay/Action graph
// nodes beyond existing `automation_rules` evaluation awaits unified runtime
// event triggers.

export function getAutomationStudioBootstrap(workspaceId: string) {
  return getAutomationStudioBootstrapAction(workspaceId);
}

export function createWorkflow(
  workspaceId: string,
  input: Parameters<typeof createWorkflowAction>[1],
) {
  return createWorkflowAction(workspaceId, input);
}

export function saveWorkflowGraph(
  workspaceId: string,
  input: Parameters<typeof saveWorkflowGraphAction>[1],
) {
  return saveWorkflowGraphAction(workspaceId, input);
}

export function setWorkflowStatus(
  workspaceId: string,
  workflowId: string,
  status: WorkflowStatus,
) {
  return setWorkflowStatusAction(workspaceId, workflowId, status);
}

export function deleteWorkflow(workspaceId: string, workflowId: string) {
  return deleteWorkflowAction(workspaceId, workflowId);
}

export function runWorkflowTest(
  workspaceId: string,
  workflowId: string,
  input: Parameters<typeof runWorkflowTestAction>[2],
) {
  return runWorkflowTestAction(workspaceId, workflowId, input);
}

export function toggleAutomationRuleActive(
  workspaceId: string,
  ruleId: string,
  isActive: boolean,
) {
  return setRuleActiveAction(workspaceId, ruleId, isActive);
}

export function deleteAutomationRule(workspaceId: string, ruleId: string) {
  return deleteRuleAction(workspaceId, ruleId);
}

export function useAutomationLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
) {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 20_000,
    onRefresh,
  });
}
