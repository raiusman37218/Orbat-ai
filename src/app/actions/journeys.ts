'use server';

import { query, queryRows } from '@/lib/db';
import { tryWorkspaceChat } from '@/lib/ai/agent-runtime';
import { userError, errorMessage } from '@/lib/errors/user-error';
import { getWorkspaceAccess } from '@/lib/team/access';
import { roleCan } from '@/lib/team/permissions';

export type JourneyStatus = 'live' | 'paused' | 'draft';
export type JourneyStepKind =
  | 'Trigger'
  | 'Wait'
  | 'Email'
  | 'In-app'
  | 'WhatsApp'
  | 'Condition'
  | 'Goal';

export interface JourneyStep {
  id: string;
  title: string;
  kind: JourneyStepKind;
  subtitle: string;
  copy?: string;
  delayLabel?: string;
  splitYes?: number;
  splitNo?: number;
  targetRate?: number;
}

export interface JourneyStage {
  id: string;
  name: string;
  steps: JourneyStep[];
}

export interface JourneyRecord {
  id: string;
  workspaceId: string;
  name: string;
  goal: string;
  entryTrigger: string;
  exitCriteria: string;
  status: JourneyStatus;
  stages: JourneyStage[];
  updatedAt: string;
  createdAt: string;
}

export type EnrollmentStatus =
  | 'active'
  | 'goal_reached'
  | 'needs_attention'
  | 'opted_out'
  | 'exited';

export interface JourneyEnrollmentRecord {
  id: string;
  journeyId: string;
  visitorId: string | null;
  customerName: string;
  customerEmail: string | null;
  currentStageId: string;
  currentStageName: string;
  currentStepId: string;
  currentStepTitle: string;
  status: EnrollmentStatus;
  revenueCents: number;
  lastActivity: string;
  enteredAt: string;
  lastActivityAt: string;
}

export interface StageFunnelRow {
  stageId: string;
  stageName: string;
  activeCount: number;
  reachedCount: number;
  dropOffPct: number | null;
}

export interface AvailableVisitorSummary {
  id: string;
  name: string;
  email: string | null;
}

export interface JourneysBootstrap {
  canManage: boolean;
  journeys: JourneyRecord[];
  selectedJourneyId: string | null;
  enrollments: JourneyEnrollmentRecord[];
  funnel: StageFunnelRow[];
  metrics: {
    entered: number;
    inProgress: number;
    reachedGoal: number;
    conversionRate: number | null;
    revenueCents: number;
  };
  availableVisitors: AvailableVisitorSummary[];
}

const STARTER_JOURNEYS: Record<
  'onboarding' | 'trial_conversion' | 'winback',
  {
    name: string;
    goal: string;
    entryTrigger: string;
    exitCriteria: string;
    stages: JourneyStage[];
  }
> = {
  onboarding: {
    name: 'New workspace onboarding',
    goal: 'Guide new signups to install the chat widget and connect Help Center articles',
    entryTrigger: 'Account created without widget install',
    exitCriteria: 'Widget live or 14 days elapsed',
    stages: [
      {
        id: 'stg_entry',
        name: 'Entry',
        steps: [
          {
            id: 'stp_trig',
            title: 'Signup completed',
            kind: 'Trigger',
            subtitle: 'Account created with zero live widget pings',
          },
          {
            id: 'stp_welcome',
            title: 'Welcome checklist email',
            kind: 'Email',
            subtitle: 'Send 3-step setup guide with embed snippet',
            copy: 'Welcome to the workspace! Paste your widget snippet in under 2 minutes to start answering live visitors.',
          },
        ],
      },
      {
        id: 'stg_engage',
        name: 'Engage',
        steps: [
          {
            id: 'stp_wait1',
            title: 'Wait 48 hours',
            kind: 'Wait',
            subtitle: 'Give team time to deploy snippet',
            delayLabel: '48 hours',
          },
          {
            id: 'stp_cond1',
            title: 'Widget installed?',
            kind: 'Condition',
            subtitle: 'Check first heartbeat from customer domain',
          },
          {
            id: 'stp_nudge',
            title: 'In-app setup reminder',
            kind: 'In-app',
            subtitle: 'Show guided banner on Overview',
            copy: 'Ready to go live? Copy your snippet or invite a developer in one click.',
          },
        ],
      },
      {
        id: 'stg_convert',
        name: 'Convert',
        steps: [
          {
            id: 'stp_ai_tip',
            title: 'AI knowledge walkthrough',
            kind: 'Email',
            subtitle: 'Highlight Help Center import & instant answers',
            copy: 'Import your docs so our AI assistant resolves repeat questions automatically.',
          },
        ],
      },
      {
        id: 'stg_goal',
        name: 'Goal',
        steps: [
          {
            id: 'stp_goal',
            title: 'First conversation resolved',
            kind: 'Goal',
            subtitle: 'Customer handles first live thread',
          },
        ],
      },
    ],
  },
  trial_conversion: {
    name: 'Trial to paid conversion',
    goal: 'Convert active 14-day trials into paid workspace subscriptions',
    entryTrigger: 'Trial started',
    exitCriteria: 'Upgraded to Pro/Business or trial expired',
    stages: [
      {
        id: 'stg_entry',
        name: 'Entry',
        steps: [
          {
            id: 'stp_trig',
            title: 'Trial started',
            kind: 'Trigger',
            subtitle: 'Workspace enters 14-day Pro trial',
          },
        ],
      },
      {
        id: 'stg_engage',
        name: 'Engage',
        steps: [
          {
            id: 'stp_usage',
            title: 'AI deflection summary',
            kind: 'Email',
            subtitle: 'Share hours saved on day 5',
            copy: 'Your workspace already saved support hours this week — review your deflection breakdown.',
          },
          {
            id: 'stp_check',
            title: 'High weekly volume?',
            kind: 'Condition',
            subtitle: '20+ conversations in last 7 days',
          },
        ],
      },
      {
        id: 'stg_convert',
        name: 'Convert',
        steps: [
          {
            id: 'stp_offer',
            title: 'Annual plan upgrade prompt',
            kind: 'In-app',
            subtitle: 'Display billing banner 3 days before trial ends',
            copy: 'Lock in your setup before trial ends on Friday.',
          },
        ],
      },
      {
        id: 'stg_goal',
        name: 'Goal',
        steps: [
          {
            id: 'stp_goal',
            title: 'Subscription activated',
            kind: 'Goal',
            subtitle: 'Paid invoice settled',
          },
        ],
      },
    ],
  },
  winback: {
    name: 'Silent customer win-back',
    goal: 'Re-engage previously active customers who have gone quiet for 30 days',
    entryTrigger: 'No conversations or logins in 30 days',
    exitCriteria: 'Replied to outreach or unsubscribed',
    stages: [
      {
        id: 'stg_entry',
        name: 'Entry',
        steps: [
          {
            id: 'stp_trig',
            title: '30 days inactive',
            kind: 'Trigger',
            subtitle: 'Zero visitor activity or agent logins',
          },
        ],
      },
      {
        id: 'stg_engage',
        name: 'Engage',
        steps: [
          {
            id: 'stp_email',
            title: 'Personal check-in email',
            kind: 'Email',
            subtitle: 'Share newest product improvements',
            copy: 'We shipped faster AI verification and voice routing — want a quick walkthrough?',
          },
          {
            id: 'stp_wait',
            title: 'Wait 5 days',
            kind: 'Wait',
            subtitle: 'Check open or reply',
            delayLabel: '5 days',
          },
        ],
      },
      {
        id: 'stg_convert',
        name: 'Convert',
        steps: [
          {
            id: 'stp_wa',
            title: 'WhatsApp concise nudge',
            kind: 'WhatsApp',
            subtitle: 'Fallback outreach for opted-in contacts',
            copy: 'Quick check-in from our team — happy to help configure anything you need.',
          },
        ],
      },
      {
        id: 'stg_goal',
        name: 'Goal',
        steps: [
          {
            id: 'stp_goal',
            title: 'Customer re-engaged',
            kind: 'Goal',
            subtitle: 'Starts new support conversation or logs in',
          },
        ],
      },
    ],
  },
};

function parseStages(raw: unknown): JourneyStage[] {
  if (Array.isArray(raw)) return raw as JourneyStage[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as JourneyStage[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeJourney(row: Record<string, unknown>): JourneyRecord {
  const s = String(row.status || 'draft');
  const status: JourneyStatus = s === 'live' || s === 'paused' ? s : 'draft';
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name || 'Untitled journey'),
    goal: String(row.goal || ''),
    entryTrigger: String(row.entry_trigger || ''),
    exitCriteria: String(row.exit_criteria || ''),
    status,
    stages: parseStages(row.stages),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export async function getJourneysBootstrapAction(
  workspaceId: string,
  requestedJourneyId?: string | null,
): Promise<JourneysBootstrap> {
  try {
    const { role } = await getWorkspaceAccess(workspaceId, 'view');
    const canManage = roleCan(role, 'manage_settings');

    const [journeyRows, visitorRows] = await Promise.all([
      queryRows<Record<string, unknown>>(
        `SELECT * FROM public.customer_journeys WHERE workspace_id = $1 ORDER BY updated_at DESC`,
        [workspaceId],
      ),
      queryRows<Record<string, unknown>>(
        `SELECT id, COALESCE(name, email, 'Visitor') AS name, email
         FROM public.visitors
         WHERE workspace_id = $1
         ORDER BY COALESCE(last_seen_at, created_at) DESC
         LIMIT 30`,
        [workspaceId],
      ).catch(() => []),
    ]);

    const journeys = journeyRows.map(normalizeJourney);
    const activeJourney =
      journeys.find((j) => j.id === requestedJourneyId) ?? journeys[0] ?? null;

    if (!activeJourney) {
      return {
        canManage,
        journeys: [],
        selectedJourneyId: null,
        enrollments: [],
        funnel: [],
        metrics: {
          entered: 0,
          inProgress: 0,
          reachedGoal: 0,
          conversionRate: null,
          revenueCents: 0,
        },
        availableVisitors: visitorRows.map((v) => ({
          id: String(v.id),
          name: String(v.name || 'Visitor'),
          email: v.email ? String(v.email) : null,
        })),
      };
    }

    const enrollmentRows = await queryRows<Record<string, unknown>>(
      `SELECT *
       FROM public.customer_journey_enrollments
       WHERE workspace_id = $1 AND journey_id = $2
       ORDER BY last_activity_at DESC
       LIMIT 200`,
      [workspaceId, activeJourney.id],
    );

    const stageNameMap = new Map<string, string>();
    const stepTitleMap = new Map<string, string>();
    const stageOrder: string[] = [];
    for (const stg of activeJourney.stages) {
      stageNameMap.set(stg.id, stg.name);
      stageOrder.push(stg.id);
      for (const stp of stg.steps) {
        stepTitleMap.set(stp.id, stp.title);
      }
    }

    const enrollments: JourneyEnrollmentRecord[] = enrollmentRows.map((e) => ({
      id: String(e.id),
      journeyId: String(e.journey_id),
      visitorId: e.visitor_id ? String(e.visitor_id) : null,
      customerName: String(e.customer_name || 'Customer'),
      customerEmail: e.customer_email ? String(e.customer_email) : null,
      currentStageId: String(e.current_stage_id),
      currentStageName:
        stageNameMap.get(String(e.current_stage_id)) ?? String(e.current_stage_id),
      currentStepId: String(e.current_step_id),
      currentStepTitle:
        stepTitleMap.get(String(e.current_step_id)) ?? String(e.current_step_id),
      status: String(e.status || 'active') as EnrollmentStatus,
      revenueCents: Number(e.revenue_cents ?? 0),
      lastActivity: String(e.last_activity || 'Enrolled'),
      enteredAt: String(e.entered_at || new Date().toISOString()),
      lastActivityAt: String(e.last_activity_at || new Date().toISOString()),
    }));

    const stageIdxMap = new Map<string, number>();
    stageOrder.forEach((id, idx) => stageIdxMap.set(id, idx));

    const funnel: StageFunnelRow[] = activeJourney.stages.map((stg, idx) => {
      const activeCount = enrollments.filter(
        (e) => e.currentStageId === stg.id && e.status !== 'exited' && e.status !== 'opted_out',
      ).length;
      const reachedCount = enrollments.filter((e) => {
        if (e.status === 'goal_reached') return true;
        const pos = stageIdxMap.get(e.currentStageId) ?? 0;
        return pos >= idx;
      }).length;
      return {
        stageId: stg.id,
        stageName: stg.name,
        activeCount,
        reachedCount,
        dropOffPct: null,
      };
    });

    for (let i = 0; i < funnel.length; i++) {
      if (i > 0 && funnel[i - 1].reachedCount > 0) {
        funnel[i].dropOffPct = Math.max(
          0,
          Math.round(
            ((funnel[i - 1].reachedCount - funnel[i].reachedCount) /
              funnel[i - 1].reachedCount) *
              100,
          ),
        );
      }
    }

    const entered = enrollments.length;
    const reachedGoal = enrollments.filter((e) => e.status === 'goal_reached').length;
    const inProgress = enrollments.filter(
      (e) => e.status === 'active' || e.status === 'needs_attention',
    ).length;
    const revenueCents = enrollments.reduce((sum, e) => sum + e.revenueCents, 0);
    const conversionRate = entered > 0 ? Math.round((reachedGoal / entered) * 100) : null;

    return {
      canManage,
      journeys,
      selectedJourneyId: activeJourney.id,
      enrollments,
      funnel,
      metrics: {
        entered,
        inProgress,
        reachedGoal,
        conversionRate,
        revenueCents,
      },
      availableVisitors: visitorRows.map((v) => ({
        id: String(v.id),
        name: String(v.name || 'Visitor'),
        email: v.email ? String(v.email) : null,
      })),
    };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not load customer journeys.'));
  }
}

export async function createJourneyAction(
  workspaceId: string,
  input: {
    templateKey?: 'onboarding' | 'trial_conversion' | 'winback' | 'blank';
    name?: string;
    goal?: string;
  },
): Promise<JourneyRecord> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const tpl =
      input.templateKey && input.templateKey !== 'blank'
        ? STARTER_JOURNEYS[input.templateKey]
        : {
            name: input.name?.trim() || 'Custom lifecycle journey',
            goal: input.goal?.trim() || 'Activate customers across multi-step touchpoints',
            entryTrigger: 'Visitor identified or tag added',
            exitCriteria: 'Goal reached or unsubscribed',
            stages: [
              {
                id: 'stg_entry',
                name: 'Entry',
                steps: [
                  {
                    id: 'stp_trig',
                    title: 'Customer enters journey',
                    kind: 'Trigger' as const,
                    subtitle: 'Trigger when segment matches',
                  },
                ],
              },
              {
                id: 'stg_engage',
                name: 'Engage',
                steps: [
                  {
                    id: 'stp_msg',
                    title: 'Welcome touchpoint',
                    kind: 'Email' as const,
                    subtitle: 'First educational touchpoint',
                    copy: 'Thanks for getting started — let us know if you need help.',
                  },
                ],
              },
              {
                id: 'stg_goal',
                name: 'Goal',
                steps: [
                  {
                    id: 'stp_goal',
                    title: 'Conversion goal reached',
                    kind: 'Goal' as const,
                    subtitle: 'Target milestone completed',
                  },
                ],
              },
            ],
          };

    const name = (input.name?.trim() || tpl.name).slice(0, 120);
    const goal = (input.goal?.trim() || tpl.goal).slice(0, 300);

    const rows = await queryRows<Record<string, unknown>>(
      `INSERT INTO public.customer_journeys
         (workspace_id, name, goal, entry_trigger, exit_criteria, status, stages, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6::jsonb, $7, $7)
       RETURNING *`,
      [
        workspaceId,
        name,
        goal,
        tpl.entryTrigger,
        tpl.exitCriteria,
        JSON.stringify(tpl.stages),
        agent.id,
      ],
    );
    if (!rows[0]) throw new Error('Journey creation failed');
    return normalizeJourney(rows[0]);
  } catch (err) {
    throw userError(errorMessage(err, 'Could not create journey.'));
  }
}

export async function saveJourneyStagesAction(
  workspaceId: string,
  input: {
    id: string;
    name: string;
    goal: string;
    entryTrigger: string;
    exitCriteria: string;
    stages: JourneyStage[];
  },
): Promise<JourneyRecord> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const cleanName = input.name.trim().slice(0, 120);
    if (!cleanName) throw new Error('Journey name is required.');

    const rows = await queryRows<Record<string, unknown>>(
      `UPDATE public.customer_journeys
       SET name = $3,
           goal = $4,
           entry_trigger = $5,
           exit_criteria = $6,
           stages = $7::jsonb,
           updated_by = $8,
           updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [
        input.id,
        workspaceId,
        cleanName,
        input.goal.trim().slice(0, 300),
        input.entryTrigger.trim().slice(0, 200),
        input.exitCriteria.trim().slice(0, 200),
        JSON.stringify(input.stages),
        agent.id,
      ],
    );
    if (!rows[0]) throw new Error('Journey not found.');
    return normalizeJourney(rows[0]);
  } catch (err) {
    throw userError(errorMessage(err, 'Could not save journey.'));
  }
}

export async function toggleJourneyStatusAction(
  workspaceId: string,
  journeyId: string,
  status: JourneyStatus,
): Promise<JourneyRecord> {
  try {
    const { agent } = await getWorkspaceAccess(workspaceId, 'manage_settings');
    const rows = await queryRows<Record<string, unknown>>(
      `UPDATE public.customer_journeys
       SET status = $3, updated_by = $4, updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [journeyId, workspaceId, status, agent.id],
    );
    if (!rows[0]) throw new Error('Journey not found.');
    return normalizeJourney(rows[0]);
  } catch (err) {
    throw userError(errorMessage(err, 'Could not update journey status.'));
  }
}

export async function deleteJourneyAction(
  workspaceId: string,
  journeyId: string,
): Promise<{ deleted: true }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    await query(
      `DELETE FROM public.customer_journeys WHERE id = $1 AND workspace_id = $2`,
      [journeyId, workspaceId],
    );
    return { deleted: true };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not delete journey.'));
  }
}

export async function enrollInJourneyAction(
  workspaceId: string,
  input: {
    journeyId: string;
    visitorId?: string | null;
    customerName: string;
    customerEmail?: string | null;
  },
): Promise<{ id: string }> {
  try {
    await getWorkspaceAccess(workspaceId, 'edit_content');
    const jRows = await queryRows<Record<string, unknown>>(
      `SELECT stages FROM public.customer_journeys WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [input.journeyId, workspaceId],
    );
    if (!jRows[0]) throw new Error('Journey not found.');
    const stages = parseStages(jRows[0].stages);
    const firstStage = stages[0];
    const firstStep = firstStage?.steps[0];
    if (!firstStage || !firstStep) {
      throw new Error('Journey needs at least one stage and step before enrolling customers.');
    }

    const cleanName = input.customerName.trim().slice(0, 120);
    if (!cleanName) throw new Error('Customer name is required.');

    const rows = await queryRows<{ id: string }>(
      `INSERT INTO public.customer_journey_enrollments
         (workspace_id, journey_id, visitor_id, customer_name, customer_email, current_stage_id, current_step_id, status, last_activity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
       RETURNING id`,
      [
        workspaceId,
        input.journeyId,
        input.visitorId || null,
        cleanName,
        input.customerEmail?.trim() || null,
        firstStage.id,
        firstStep.id,
        `Entered "${firstStep.title}"`,
      ],
    );
    return { id: String(rows[0]?.id ?? '') };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not enroll customer into journey.'));
  }
}

export async function advanceJourneyEnrollmentAction(
  workspaceId: string,
  input: {
    enrollmentId: string;
    nextStageId: string;
    nextStepId: string;
    status: EnrollmentStatus;
    revenueCents?: number;
    note?: string;
  },
): Promise<{ ok: true }> {
  try {
    await getWorkspaceAccess(workspaceId, 'edit_content');
    await query(
      `UPDATE public.customer_journey_enrollments
       SET current_stage_id = $3,
           current_step_id = $4,
           status = $5,
           revenue_cents = COALESCE($6, revenue_cents),
           last_activity = COALESCE($7, last_activity),
           last_activity_at = now()
       WHERE id = $1 AND workspace_id = $2`,
      [
        input.enrollmentId,
        workspaceId,
        input.nextStageId,
        input.nextStepId,
        input.status,
        typeof input.revenueCents === 'number' ? Math.max(0, Math.round(input.revenueCents)) : null,
        input.note?.trim() || null,
      ],
    );
    return { ok: true };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not update enrollment stage.'));
  }
}

export async function suggestJourneyStepCopyAction(
  workspaceId: string,
  input: { journeyName: string; goal: string; stepTitle: string; kind: JourneyStepKind },
): Promise<{ copy: string; configured: boolean }> {
  try {
    await getWorkspaceAccess(workspaceId, 'manage_settings');
    const suggested = await tryWorkspaceChat(
      workspaceId,
      'Write concise, helpful customer lifecycle messaging (1-2 sentences, friendly and clear, no emojis or hype).',
      `Journey: ${input.journeyName}\nGoal: ${input.goal}\nStep: ${input.stepTitle} (${input.kind})\nWrite the message copy:`,
      140,
    );
    if (suggested) {
      return { copy: suggested, configured: true };
    }
    return {
      copy: `Hi there — quick note on ${input.stepTitle.toLowerCase()} so you can ${input.goal.toLowerCase() || 'get set up faster'}. Reply here anytime if you have questions.`,
      configured: false,
    };
  } catch (err) {
    throw userError(errorMessage(err, 'Could not suggest copy.'));
  }
}
