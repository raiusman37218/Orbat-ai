import {
  getSystemStatesLiveAction,
  submitAccessRequestAction,
  type SystemHealthProbeItem,
  type SystemStatesBundle,
} from '@/app/actions/lifecycle-studio';

export type { SystemHealthProbeItem, SystemStatesBundle };

// TODO(backend): Add external uptime telemetry probes (worker queue depth, AI gateway latency, Redis/Postgres pool saturation) to drive automatic maintenance/rate-limited banners.
export async function loadSystemStatesLive(workspaceId: string): Promise<SystemStatesBundle> {
  const res = await getSystemStatesLiveAction(workspaceId);
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function requestWorkspaceAccess(
  workspaceId: string,
  requestedArea: string,
  note?: string,
) {
  const res = await submitAccessRequestAction(workspaceId, requestedArea, note);
  if (!res.success) throw new Error(res.error || 'Could not submit access request.');
  return res;
}
