import {
  getTrialLifecycleBundleAction,
  requestTrialExtensionAction,
  snoozeTrialReminderAction,
  type TrialLifecycleBundle,
} from '@/app/actions/lifecycle-studio';

export type { TrialLifecycleBundle };

export async function loadTrialLifecycle(workspaceId: string): Promise<TrialLifecycleBundle> {
  const res = await getTrialLifecycleBundleAction(workspaceId);
  if (!res.success) throw new Error(res.error);
  return res.data;
}

// TODO(backend): Add scheduled trial expiry email reminders (day -7, -3, -1, 0) via worker cron + workspace/platform SMTP and automatic Stripe Billing trial_end webhook sync.
export async function snoozeTrialReminder(workspaceId: string) {
  const res = await snoozeTrialReminderAction(workspaceId);
  if (!res.success) throw new Error(res.error || 'Could not snooze reminder.');
  return res;
}

export async function submitTrialExtensionRequest(
  workspaceId: string,
  requestedDays = 7,
  reason?: string,
) {
  const res = await requestTrialExtensionAction(workspaceId, requestedDays, reason);
  if (!res.success) throw new Error(res.error || 'Could not submit trial extension request.');
  return res;
}
