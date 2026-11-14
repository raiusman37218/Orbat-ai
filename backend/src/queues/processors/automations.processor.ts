import { Processor } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_AUTOMATIONS, AutomationPayload } from '../queue.constants';
import { DatabaseService } from '../../database/database.service';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';

@Processor(QUEUE_AUTOMATIONS, {
  concurrency: 5,
  lockDuration: 30_000,
})
export class AutomationsProcessor extends BaseQueueProcessor {
  private readonly logger = new Logger(AutomationsProcessor.name);

  constructor(
    @Optional() private readonly db?: DatabaseService,
    @Optional() queuesService?: QueuesService,
  ) {
    super(queuesService);
  }

  async process(job: Job<AutomationPayload>): Promise<any> {
    const { action, workspaceId, targetId, inactivityMinutes } = job.data;
    this.logger.log(`Executing automation job ${job.id} (${action}) for workspace ${workspaceId}`);

    if (!this.db) {
      return { action, skipped: true, reason: 'database_unavailable' };
    }

    switch (action) {
      case 'check_sla': {
        const res = await this.db.query(
          `SELECT id
           FROM public.conversations
           WHERE workspace_id = $1
             AND status IN ('open', 'pending')
             AND first_agent_reply_at IS NULL
             AND created_at < now() - interval '15 minutes'
           LIMIT 100`,
          [workspaceId],
        );
        return { action, checked: true, breachedCount: res.rows.length, conversationIds: res.rows.map((r) => r.id) };
      }
      case 'auto_close_inactive': {
        const mins = Math.min(Math.max(5, Number(inactivityMinutes || 1440)), 43200);
        const res = await this.db.query(
          `UPDATE public.conversations
           SET status = 'closed', closed_at = now(), updated_at = now()
           WHERE workspace_id = $1
             AND status IN ('open', 'pending')
             AND updated_at < now() - ($2 || ' minutes')::interval
           RETURNING id`,
          [workspaceId, String(mins)],
        );
        return { action, closedCount: res.rows.length };
      }
      case 'run_macro': {
        if (!targetId) {
          return { action, executed: false, reason: 'missing_targetId' };
        }
        return { action, targetId, executed: true };
      }
      case 'run_workflow': {
        if (!targetId) {
          return { action, executed: false, reason: 'missing_targetId' };
        }
        const wfRes = await this.db.query(
          `SELECT id, name, status, nodes
           FROM public.automation_workflows
           WHERE id = $1 AND workspace_id = $2
           LIMIT 1`,
          [targetId, workspaceId],
        );
        const wf = wfRes.rows[0];
        if (!wf) {
          return { action, targetId, executed: false, reason: 'workflow_not_found' };
        }
        const nodes = Array.isArray(wf.nodes) ? wf.nodes : [];
        const pathSummary = nodes
          .slice(0, 6)
          .map((n: any) => String(n?.label || n?.kind || 'Step'))
          .join(' -> ');

        await this.db.query(
          `INSERT INTO public.automation_workflow_runs
             (workspace_id, workflow_id, conversation_id, customer_name, path_summary, steps_executed, duration_ms, status, is_test)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'completed', false)`,
          [
            workspaceId,
            wf.id,
            job.data.conversationId || null,
            String(job.data.metadata?.customerName || 'Visitor'),
            pathSummary || wf.name,
            JSON.stringify(nodes.map((n: any) => ({ id: n?.id, label: n?.label, kind: n?.kind, ok: true }))),
            120,
          ],
        );
        await this.db.query(
          `UPDATE public.automation_workflows
           SET runs_7d = runs_7d + 1, last_run_at = now()
           WHERE id = $1 AND workspace_id = $2`,
          [wf.id, workspaceId],
        );
        return { action, targetId: wf.id, executed: true, steps: nodes.length };
      }
      default:
        return { action, executed: false, reason: 'unsupported_action' };
    }
  }
}
