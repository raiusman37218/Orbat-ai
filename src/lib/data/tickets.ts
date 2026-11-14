'use client';

import {
  generateCopilotSummaryAction,
  getCopilotPanelStateAction,
  suggestCopilotReplyAction,
  type CopilotPanelState,
} from '@/app/actions/copilot';
import { listTagsAction, type WorkspaceTag } from '@/app/actions/tags';
import { listTicketFieldsAction, setTicketFieldValuesAction } from '@/app/actions/ticket-fields';
import {
  bulkUpdateTicketsAction,
  createTicketAction,
  deleteTicketsAction,
  deleteTicketViewAction,
  getTicketAction,
  getTicketsBootstrapAction,
  getTicketTabCountsAction,
  listTicketRequestersAction,
  listTicketsAction,
  mergeTicketsAction,
  replyToTicketAction,
  saveTicketViewAction,
  searchTicketsAction,
  setTicketPresenceAction,
  updateTicketAction,
  type TicketDetail,
  type TicketListItem,
  type TicketPresence,
  type TicketSlaFilter,
  type TicketsBootstrap,
  type TicketTabCounts,
} from '@/app/actions/tickets';
import type { TicketField } from '@/lib/tickets/fields';
import type {
  TicketFilters,
  TicketSort,
  ViewDefinition,
} from '@/lib/tickets/views';
import {
  useWorkspaceLive,
} from '@/lib/realtime/use-workspace-live';
import type {
  TicketChannel,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@/types/database';
import { downloadCsv } from './csv';

export type {
  CopilotPanelState,
  TicketDetail,
  TicketField,
  TicketFilters,
  TicketListItem,
  TicketPresence,
  TicketSlaFilter,
  TicketSort,
  TicketsBootstrap,
  TicketTabCounts,
  ViewDefinition,
  WorkspaceTag,
};

export type TicketQueueTab =
  | 'all'
  | 'open'
  | 'pending'
  | 'solved'
  | 'closed'
  | 'unassigned'
  | 'mine'
  | 'priority';

export interface TicketsMetaBundle {
  bootstrap: TicketsBootstrap;
  tabCounts: TicketTabCounts;
  fields: TicketField[];
  tags: WorkspaceTag[];
}

export interface TicketFilterState {
  tab: TicketQueueTab;
  savedViewId: string | null;
  search: string;
  groupId: string | null;
  priority: TicketPriority | null;
  slaStatus: TicketSlaFilter | null;
  tag: string | null;
  sort: TicketSort;
  page: number;
}

export async function getTicketsMetaBundle(workspaceId: string): Promise<TicketsMetaBundle> {
  const [bootstrap, tabCounts, fields, tags] = await Promise.all([
    getTicketsBootstrapAction(workspaceId),
    getTicketTabCountsAction(workspaceId),
    listTicketFieldsAction(workspaceId).catch(() => [] as TicketField[]),
    listTagsAction(workspaceId).catch(() => [] as WorkspaceTag[]),
  ]);
  return { bootstrap, tabCounts, fields, tags };
}

export function buildTicketFilters(state: TicketFilterState): TicketFilters {
  const filters: TicketFilters = {};

  if (state.tab === 'open') filters.status = ['new', 'open'];
  else if (state.tab === 'pending') filters.status = ['pending', 'on_hold'];
  else if (state.tab === 'solved') filters.status = ['solved'];
  else if (state.tab === 'closed') filters.status = ['closed'];
  else if (state.tab === 'unassigned') {
    filters.assignee = ['none'];
    filters.status = ['new', 'open', 'pending', 'on_hold'];
  } else if (state.tab === 'mine') {
    filters.assignee = ['me'];
    filters.status = ['new', 'open', 'pending', 'on_hold'];
  } else if (state.tab === 'priority') {
    filters.priority = ['high', 'urgent'];
    filters.status = ['new', 'open', 'pending', 'on_hold'];
  }

  if (state.groupId) filters.group = [state.groupId];
  if (state.priority) filters.priority = [state.priority];
  if (state.tag) filters.tags = [state.tag];

  return filters;
}

export async function loadTicketsList(
  workspaceId: string,
  state: TicketFilterState,
): Promise<{
  tickets: Array<TicketListItem & { matched_on?: string }>;
  total: number;
  view: ViewDefinition | null;
}> {
  const q = state.search.trim();
  if (q) {
    const res = await searchTicketsAction(workspaceId, q);
    return { tickets: res.tickets, total: res.tickets.length, view: null };
  }

  if (state.savedViewId) {
    return listTicketsAction(workspaceId, {
      viewId: state.savedViewId,
      sort: state.sort,
      page: state.page,
      slaStatus: state.slaStatus ?? undefined,
    });
  }

  return listTicketsAction(workspaceId, {
    filters: buildTicketFilters(state),
    sort: state.sort,
    page: state.page,
    slaStatus: state.slaStatus ?? undefined,
  });
}

export async function loadTicketDetail(
  workspaceId: string,
  ticketId: string,
): Promise<TicketDetail> {
  return getTicketAction(workspaceId, ticketId);
}

export async function loadTicketCopilot(
  workspaceId: string,
  conversationId: string | null,
): Promise<CopilotPanelState | null> {
  if (!conversationId) return null;
  try {
    return await getCopilotPanelStateAction(workspaceId, conversationId);
  } catch {
    return null;
  }
}

export async function generateTicketCopilotSummary(
  workspaceId: string,
  conversationId: string,
) {
  return generateCopilotSummaryAction(workspaceId, conversationId);
}

export async function draftTicketCopilotReply(
  workspaceId: string,
  conversationId: string,
  language?: 'auto' | 'en' | 'ur' | 'roman_ur',
) {
  return suggestCopilotReplyAction(workspaceId, conversationId, language);
}

export async function updateTicketProperties(
  workspaceId: string,
  ticketId: string,
  patch: {
    subject?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    type?: TicketType;
    assignee_id?: string | null;
    group_id?: string | null;
    tags?: string[];
  },
) {
  return updateTicketAction(workspaceId, ticketId, patch);
}

export async function saveTicketCustomFieldValues(
  workspaceId: string,
  ticketId: string,
  values: Record<string, string | number | boolean | null>,
) {
  return setTicketFieldValuesAction(workspaceId, ticketId, values);
}

export async function postTicketReply(
  workspaceId: string,
  ticketId: string,
  input: { body: string; internal: boolean; submitAs?: TicketStatus },
) {
  return replyToTicketAction(workspaceId, ticketId, input);
}

export async function createNewTicket(
  workspaceId: string,
  input: {
    requesterName: string;
    requesterEmail: string;
    subject: string;
    body: string;
    channel: TicketChannel;
    priority?: TicketPriority;
    type?: TicketType;
    assigneeId?: string | null;
    groupId?: string | null;
    tags?: string[];
  },
) {
  return createTicketAction(workspaceId, input);
}

export async function searchRequesters(workspaceId: string, queryText?: string) {
  return listTicketRequestersAction(workspaceId, queryText);
}

export async function bulkEditTickets(
  workspaceId: string,
  ticketIds: string[],
  change: { assigneeId?: string | null; status?: TicketStatus; addTag?: string },
) {
  return bulkUpdateTicketsAction(workspaceId, ticketIds, change);
}

export async function mergeSelectedTickets(
  workspaceId: string,
  targetId: string,
  sourceIds: string[],
) {
  return mergeTicketsAction(workspaceId, targetId, sourceIds);
}

export async function deleteSelectedTickets(
  workspaceId: string,
  ticketIds: string[],
) {
  return deleteTicketsAction(workspaceId, ticketIds);
}

export async function saveTicketView(
  workspaceId: string,
  input: { id?: string; name: string; filters: TicketFilters; sort: TicketSort; shared: boolean },
) {
  return saveTicketViewAction(workspaceId, input);
}

export async function removeTicketView(workspaceId: string, viewId: string) {
  return deleteTicketViewAction(workspaceId, viewId);
}

export async function updateTicketPresence(
  workspaceId: string,
  ticketId: string,
  state: 'viewing' | 'replying' | 'noting' | null,
) {
  return setTicketPresenceAction(workspaceId, ticketId, state);
}

export function exportTicketsToCsv(
  tickets: TicketListItem[],
  agents: Array<{ id: string; name: string }>,
  groups: Array<{ id: string; name: string }>,
): void {
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsv(
    `tickets_export_${dateStr}.csv`,
    ['Number', 'Subject', 'Status', 'Priority', 'Type', 'Requester', 'Requester Email', 'Assignee', 'Team', 'Channel', 'Tags', 'SLA State', 'SLA Next Due', 'Updated At', 'Created At'],
    tickets.map((t) => [
      `#${t.number}`,
      t.subject,
      t.status,
      t.priority,
      t.type,
      t.requester?.name || '',
      t.requester?.email || '',
      t.assignee_id ? agentMap.get(t.assignee_id) || '' : 'Unassigned',
      t.group_id ? groupMap.get(t.group_id) || '' : '',
      t.channel,
      (t.tags || []).join('; '),
      t.sla_breached_at ? 'breached' : t.sla_state || '',
      t.sla_next_due_at || '',
      t.updated_at,
      t.created_at,
    ]),
  );
}

export function useTicketsLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
): void {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 8000,
    onRefresh,
  });
}
