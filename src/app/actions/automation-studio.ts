'use server';

import { query, queryRows } from '@/lib/db';
import { tryWorkspaceChat } from '@/lib/ai/agent-runtime';
import {
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
  simulateWorkflowPath,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowSimStep,
  type WorkflowStatus,
} from '@/lib/automation/workflow-templates';
import { userError, errorMessage } from '@/lib/errors/user-error';
import { getWorkspaceAccess } from '@/lib/team/access';
import { roleCan } from '@/lib/team/permissions';

export interface AutomationWorkflowRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  templateKey: string | null;
  status: WorkflowStatus;
  triggerKind: string;
  linkedRuleId: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  runs7d: number;
  errors7d: number;
  lastRunAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  conversationId: string | null;
  customerName: string;
  pathSummary: string;
  stepsExecuted: WorkflowSimStep[];
  durationMs: number;
  status: 'resolved' | 'handed_off' | 'completed' | 'failed' | 'simulated';
  errorMessage: string | null;
  isTest: boolean;
  createdAt: string;
}

export interface AutomationRuleSummary {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  isActive: boolean;
  executionOrder: number;
  runCount: number;
  lastRunAt: string | null;
}

export interface AutomationRuleRunSummary {
  id: string;
  ruleId: string;
  ruleName: string;
  ticketId: string | null;
  matched: boolean;
  error: string | null;
  ranAt: string;
}

export interface AutomationStudioBootstrap {
  canManage: boolean;
  workflows: AutomationWorkflowRecord[];
  workflowRuns: WorkflowRunRecord[];
  rules: AutomationRuleSummary[];
  ruleRuns: AutomationRuleRunSummary[];
}

function parseStatus(value: unknown): WorkflowStatus {
  const s = String(value || 'draft');
  if (s === 'live' || s === 'paused' || s === 'error') return s;
  return 'draft';
}

function parseJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeWorkflow(row: Record<string, unknown>): AutomationWorkflowRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name || 'Untitled workflow'),
    description: String(row.description || ''),
    templateKey: row.template_key ? String(row.template_key) : null,
    status: parseStatus(row.status),
    triggerKind: String(row.trigger_kind || 'conversation_created'),
    linkedRuleId: row.linked_rule_id ? String(row.linked_rule_id) : null,
    nodes: parseJsonArray<WorkflowNode>(row.nodes),
    edges: parseJsonArray<WorkflowEdge>(row.edges),
    runs7d: Number(row.runs_7d ?? 0),
    errors7d: Number(row.errors_7d ?? 0),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
    updatedAt: String(row.updated_at || new Date().toISOString()),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export async function getAutomationStudioBootstrapAction(
  workspaceId: string,
): Promise<AutomationStudioBootstrap> {
  try {
    const { role } = await getWorkspaceAccess(workspaceId, 'view');
    const canManage = roleCan(role, 'manage_settings');

    const [wfRows, runRows, ruleRows, ruleRunRows] = await Promise.all([
      queryRows<Record<string, unknown>>(
        `SELECT *
         FROM public.automation_workflows
         WHERE workspace_id = $1
         ORDER BY updated_at DESC`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT r.*, w.name AS workflow_name
         FROM public.automation_workflow_runs r
         JOIN public.automation_workflows w ON w.id = r.workflow_id
         WHERE r.workspace_id = $1
         ORDER BY r.created_at DESC
         LIMIT 80`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT id, name, description, kind, is_active, execution_order, run_count, last_run_at
         FROM public.automation_rules
         WHERE workspace_id = $1
         ORDER BY execution_order ASC, created_at ASC`,
        [workspaceId],
      ).catch(() => []),
      queryRows<Record<string, unknown>>(
        `SELECT rr.id, rr.rule_id, ar.name AS rule_name, rr.ticket_id, rr.matched, rr.error, rr.ran_at
         FROM public.automation_rule_runs rr
         JOIN public.automation_rules ar ON ar.id = rr.rule_id
         WHERE rr.workspace_id = $1
         ORDER BY rr.ran_at DESC
         LIMIT 40`,
        [workspaceId],
      ).catch(() => []),
    ]);

    return {
      canManage,
      workflows: wfRows.map(normalizeWorkflow),
      workflowRuns: runRows.map((r) => ({
        id: String(r.id),
        workflowId: String(r.workflow_id),
        workflowName: String(r.workflow_name || 'Workflow'),
        conversationId: r.conversation_id ? String(r.conversation_id) : null,
        customerName: String(r.customer_name || 'Visitor'),
        pathSummary: String(r.path_summary || ''),
        stepsExecuted: parseJsonArray<WorkflowSimStep>(r.steps_executed),
        durationMs: Number(r.duration_ms ?? 0),
        status: (String(r.status || 'completed') as WorkflowRunRecord['status']),
        errorMessage: r.error_message ? String(r.error_message) : null,
        isTest: Boolean(r.is_test),
        createdAt: String(r.created_at || new Date().toISOString()),
      })),
      rules: ruleRows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        description: r.description ? String(r.description) : null,
        kind: String(r.kind || 'trigger'),
        isActive: Boolean(r.is_active),
        executionOrder: Number(r.execution_order ?? 0),
        runCount: Number(r.run_count ?? 0),
        lastRunAt: r.last_run_at ? String(r.last_run_at) : null,
      })),
      ruleRuns: ruleRunRows.map((rr) => ({
        id: String(rr.id),
        ruleId: String(rr.rule_id),
        ruleName: String(rr.rule_name || 'Rule'),
        ticketId: rr.ticket_id ? String(rr.ticket_id) : null,
        matched: Boolean(rr.matched),
        error: rr.error ? String(rr.error) : null,
        ranAt: String(rr.ran_at || new Date().toISOString()),
      })),
    };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not load automation workflows.'));
  }
}

export async function createWorkflowAction(
  workspaceId: string,
  input: {
    templateKey?: string | null;
    name?: string;
    description?: string;
  },
): Promise<AutomationWorkflowRecord> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const tpl = input.templateKey
      ? getWorkflowTemplate(input.templateKey)
      : {
          key: 'custom',
          name: input.name?.trim() || 'Custom workflow',
          description: input.description?.trim() || 'Trigger, evaluate, and automate customer follow-ups.',
          triggerKind: 'conversation_created',
          nodes: [
            {
              id: 'n1',
              kind: 'Trigger' as const,
              label: 'New conversation',
              subtitle: 'When a visitor sends the first message',
              x: 220,
              y: 28,
              tone: 'accent' as const,
              config: { event: 'conversation_created', channel: 'all' },
            },
            {
              id: 'n2',
              kind: 'AI' as const,
              label: 'AI response & triage',
              subtitle: 'Classify intent using Help Center',
              x: 220,
              y: 146,
              tone: 'ai' as const,
              config: { prompt: 'Summarize intent and draft a concise reply.', minConfidence: 0.72 },
            },
            {
              id: 'n3',
              kind: 'Handoff' as const,
              label: 'Fallback handoff',
              subtitle: 'Assign to online agent if confidence is low',
              x: 220,
              y: 266,
              tone: 'bad' as const,
              config: { team: 'Support queue', priority: 'normal' },
            },
          ],
          edges: [
            { id: 'e1', from: 'n1', to: 'n2', condition: 'always' as const },
            { id: 'e2', from: 'n2', to: 'n3', condition: 'always' as const },
          ],
        };

    const name = (input.name?.trim() || tpl.name).slice(0, 120);
    const description = (input.description?.trim() || tpl.description).slice(0, 500);
    const templateKey = input.templateKey && WORKFLOW_TEMPLATES.some((t) => t.key === input.templateKey)
      ? input.templateKey
      : null;

    const rows = await queryRows<Record<string, unknown>>(
      `INSERT INTO public.automation_workflows
         (workspace_id, name, description, template_key, status, trigger_kind, nodes, edges, created_by, updated_by)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6::jsonb, $7::jsonb, $8, $8)
       RETURNING *`,
      [
        workspaceId,
        name,
        description,
        templateKey,
        tpl.triggerKind,
        JSON.stringify(tpl.nodes),
        JSON.stringify(tpl.edges),
        agent.id,
      ],
    );
    if (!rows[0]) throw new Error('Workflow creation returned no row');
    return normalizeWorkflow(rows[0]);
  } catch (err) {
    throw userError(errorMessage(err, 'Could not create workflow.'));
  }
}

export async function saveWorkflowGraphAction(
  workspaceId: string,
  input: {
    id: string;
    name: string;
    description: string;
    triggerKind?: string;
    status?: WorkflowStatus;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  },
): Promise<AutomationWorkflowRecord> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const cleanName = input.name.trim().slice(0, 120);
    if (!cleanName) throw new Error('Workflow name is required.');

    const triggerNode = input.nodes.find((n) => n.kind === 'Trigger');
    const triggerKind =
      input.triggerKind ||
      String(triggerNode?.config?.event || 'conversation_created');

    const rows = await queryRows<Record<string, unknown>>(
      `UPDATE public.automation_workflows
       SET name = $3,
           description = $4,
           trigger_kind = $5,
           status = COALESCE($6, status),
           nodes = $7::jsonb,
           edges = $8::jsonb,
           updated_by = $9,
           updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [
        input.id,
        workspaceId,
        cleanName,
        input.description.trim().slice(0, 500),
        triggerKind,
        input.status ? parseStatus(input.status) : null,
        JSON.stringify(input.nodes),
        JSON.stringify(input.edges),
        agent.id,
      ],
    );
    if (!rows[0]) throw new Error('Workflow not found.');
    return normalizeWorkflow(rows[0]);
  } catch (err) {
    throw userError(errorMessage(err, 'Could not save workflow changes.'));
  }
}

export async function setWorkflowStatusAction(
  workspaceId: string,
  workflowId: string,
  status: WorkflowStatus,
): Promise<AutomationWorkflowRecord> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const rows = await queryRows<Record<string, unknown>>(
      `UPDATE public.automation_workflows
       SET status = $3, updated_by = $4, updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [workflowId, workspaceId, parseStatus(status), agent.id],
    );
    if (!rows[0]) throw new Error('Workflow not found.');
    return normalizeWorkflow(rows[0]);
  } catch (err) {
    throw userError(errorMessage(err, 'Could not update workflow status.'));
  }
}

export async function deleteWorkflowAction(
  workspaceId: string,
  workflowId: string,
): Promise<{ deleted: true }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    await query(
      `DELETE FROM public.automation_workflows WHERE id = $1 AND workspace_id = $2`,
      [workflowId, workspaceId],
    );
    return { deleted: true };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not delete workflow.'));
  }
}

export async function runWorkflowTestAction(
  workspaceId: string,
  workflowId: string,
  testInput: {
    customerName?: string;
    message: string;
    hasOrderNumber?: boolean;
  },
): Promise<{
  run: WorkflowRunRecord;
  visitedIds: string[];
  aiReplyPreview: string | null;
}> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const startedAt = Date.now();
    const wfRows = await queryRows<Record<string, unknown>>(
      `SELECT * FROM public.automation_workflows WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [workflowId, workspaceId],
    );
    const wfRow = wfRows[0];
    if (!wfRow) throw new Error('Workflow not found.');

    const wf = normalizeWorkflow(wfRow);
    const message = testInput.message.trim() || 'Where is my order #1042?';
    const sim = simulateWorkflowPath(wf.nodes, wf.edges, {
      message,
      hasOrderNumber: testInput.hasOrderNumber,
    });

    let aiReplyPreview: string | null = null;
    const aiStep = sim.stepsExecuted.find((s) => s.kind === 'AI');
    if (aiStep) {
      const node = wf.nodes.find((n) => n.id === aiStep.nodeId);
      const prompt = String(
        node?.config?.prompt ||
          'Draft a concise, helpful support reply based on the customer message.',
      );
      aiReplyPreview = await tryWorkspaceChat(workspaceId, prompt, message, 260);
      if (aiReplyPreview) {
        aiStep.detail = `AI drafted: "${aiReplyPreview.slice(0, 140)}${aiReplyPreview.length > 140 ? '…' : ''}"`;
      } else {
        aiStep.detail = `${aiStep.detail} (Workspace AI key not connected — deterministic trace)`;
      }
    }

    const durationMs = Math.max(18, Date.now() - startedAt);
    const customerName = (testInput.customerName?.trim() || 'Test Visitor').slice(0, 80);

    const runRows = await queryRows<Record<string, unknown>>(
      `INSERT INTO public.automation_workflow_runs
         (workspace_id, workflow_id, customer_name, path_summary, steps_executed, duration_ms, status, is_test)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'simulated', true)
       RETURNING *`,
      [
        workspaceId,
        wf.id,
        customerName,
        sim.pathSummary,
        JSON.stringify(sim.stepsExecuted),
        durationMs,
      ],
    );

    await query(
      `UPDATE public.automation_workflows
       SET runs_7d = runs_7d + 1, last_run_at = now()
       WHERE id = $1 AND workspace_id = $2`,
      [wf.id, workspaceId],
    );

    const r = runRows[0];
    return {
      run: {
        id: String(r?.id ?? crypto.randomUUID()),
        workflowId: wf.id,
        workflowName: wf.name,
        conversationId: null,
        customerName,
        pathSummary: sim.pathSummary,
        stepsExecuted: sim.stepsExecuted,
        durationMs,
        status: 'simulated',
        errorMessage: null,
        isTest: true,
        createdAt: String(r?.created_at ?? new Date().toISOString()),
      },
      visitedIds: sim.visitedIds,
      aiReplyPreview,
    };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not run workflow test.'));
  }
}
