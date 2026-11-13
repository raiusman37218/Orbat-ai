'use client';

import { Conversation, Message, Workspace, Agent, Visitor } from '@/types/database';
import {
  getAuthToken,
  getBackendBaseUrl,
  isBackendAuthenticated,
  refreshBackendSession,
  clearAuthSession,
} from './backend-auth';

export function getBackendToken(): string | null {
  return getAuthToken();
}

export { isBackendAuthenticated };

async function request<T>(endpoint: string, options: RequestInit = {}, canRetry = true): Promise<T> {
  let token = getAuthToken();
  const buildHeaders = (authToken: string | null) => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    return headers;
  };

  let res = await fetch(`${getBackendBaseUrl()}${endpoint}`, {
    ...options,
    headers: buildHeaders(token),
  });

  if (res.status === 401 && canRetry) {
    const refreshedToken = await refreshBackendSession();
    if (refreshedToken) {
      token = refreshedToken;
      res = await fetch(`${getBackendBaseUrl()}${endpoint}`, {
        ...options,
        headers: buildHeaders(token),
      });
    } else {
      clearAuthSession();
    }
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errorMsg = json?.message || `Request failed with status ${res.status}`;
    throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
  }

  return (json?.data !== undefined ? json.data : json) as T;
}

export function mapBackendWorkspace(data: any): Workspace {
  return {
    id: data.id,
    name: data.name,
    owner_id: data.owner_id,
    brand_color: data.brand_color || '#4f46e5',
    logo_url: data.logo_url || null,
    greeting_title: data.greeting_title || 'Welcome',
    greeting_message: data.greeting_message || 'How can we help you today?',
    widget_position: data.widget_position || 'right',
    widget_icon: data.widget_icon || 'smile_bubble',
    slug: data.slug || null,
    custom_domain: data.custom_domain || null,
    custom_domain_status: data.custom_domain_status || 'pending',
    business_hours: data.business_hours || null,
    ai_settings: data.ai_settings || null,
    auto_assignment: data.auto_assignment || null,
    timezone: data.timezone || 'UTC',
    language: data.language || 'en',
    handoff_settings: data.handoff_settings || null,
    plan: data.plan || 'free',
    plan_limits: data.plan_limits || null,
    is_suspended: Boolean(data.is_suspended),
    widget_installed: Boolean(data.widget_installed),
    widget_disabled: Boolean(data.widget_disabled),
    help_center_enabled: data.help_center_enabled !== false,
    help_center_title: data.help_center_title || null,
    help_center_subtitle: data.help_center_subtitle || null,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
  } as unknown as Workspace;
}

export function mapBackendVisitor(row: any): Visitor {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name || null,
    email: row.email || null,
    current_page_url: row.current_page_url || null,
    current_page_title: row.current_page_title || null,
    location: row.location || null,
    ip_location_city: row.ip_location_city || null,
    ip_location_country: row.ip_location_country || null,
    device: row.device || null,
    browser: row.browser || null,
    os: row.os || null,
    language: row.language || null,
    timezone: row.timezone || null,
    channel: row.channel || 'web',
    visit_count: Number(row.visit_count) || 0,
    is_online: Boolean(row.is_online),
    last_seen_at: row.last_seen_at || null,
    first_seen_at: row.first_seen_at || null,
    created_at: row.first_seen_at || row.last_seen_at,
  } as unknown as Visitor;
}

export function mapBackendMessage(row: any): Message {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_type: row.sender_type,
    sender_id: row.sender_id || null,
    content: row.content || '',
    attachment_url: row.attachment_url || null,
    is_internal: Boolean(row.is_internal),
    reply_to_message_id: row.reply_to_message_id || null,
    delivered_at: row.delivered_at || null,
    read_at: row.read_at || null,
    metadata: row.metadata || null,
    created_at: row.created_at,
    agent: row.sender_agent_name
      ? ({
          id: row.sender_id,
          name: row.sender_agent_name,
          avatar_url: row.sender_agent_avatar || null,
        } as Agent)
      : null,
  } as Message;
}

export function mapBackendConversation(row: any): Conversation {
  const assignedId = row.assigned_agent_id || row.agent_id || null;
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    visitor_id: row.visitor_id,
    assigned_agent_id: assignedId,
    agent_id: assignedId,
    status: row.status || 'open',
    priority: row.priority || 'normal',
    channel: row.channel || 'web',
    channel_metadata: row.channel_metadata || null,
    handoff_status: row.handoff_status || 'bot_active',
    handoff_reason: row.handoff_reason || null,
    handoff_summary: row.handoff_summary || null,
    handoff_requested_at: row.handoff_requested_at || null,
    handoff_offered_at: row.handoff_offered_at || null,
    first_agent_reply_at: row.first_agent_reply_at || null,
    ai_mode: row.ai_mode || 'autopilot',
    ai_enabled: row.ai_enabled,
    ai_assist: row.ai_assist,
    ai_paused_reason: row.ai_paused_reason || null,
    ai_needs_attention_at: row.ai_needs_attention_at || null,
    ai_resumed_at: row.ai_resumed_at || null,
    snoozed_until: row.snoozed_until || null,
    current_ticket_id: row.current_ticket_id || null,
    csat_rating: row.csat_rating ?? null,
    csat_feedback: row.csat_feedback ?? null,
    summary: row.summary || null,
    sentiment: row.sentiment || null,
    tags: row.tags || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    closed_at: row.closed_at || null,
    unread_count: Number(row.unread_count) || 0,
    visitor: row.visitor_id
      ? ({
          id: row.visitor_id,
          name: row.visitor_name || null,
          email: row.visitor_email || null,
          current_page_url: row.visitor_page_url || null,
          location: row.visitor_location || null,
          ip_location_city: row.ip_location_city || null,
          ip_location_country: row.ip_location_country || null,
          device: row.visitor_device || null,
          browser: row.visitor_browser || null,
          language: row.visitor_language || null,
          timezone: row.visitor_timezone || null,
          last_seen_at: row.visitor_last_seen_at || null,
          is_online: Boolean(row.visitor_is_online),
        } as unknown as Visitor)
      : undefined,
    agent: assignedId
      ? ({
          id: assignedId,
          name: row.agent_name,
          avatar_url: row.agent_avatar_url || row.agent_avatar || null,
          role: row.agent_role,
        } as Agent)
      : null,
    last_message: row.last_message
      ? {
          id: row.last_message.id,
          conversation_id: row.id,
          sender_type: row.last_message.sender_type,
          sender_id: row.last_message.sender_id || null,
          content: row.last_message.content || '',
          attachment_url: null,
          is_internal: Boolean(row.last_message.is_internal),
          created_at: row.last_message.created_at,
          read_at: row.last_message.read_at || null,
        }
      : null,
  } as unknown as Conversation;
}

export async function getBackendCurrentWorkspace(): Promise<Workspace> {
  const data = await request<any>('/workspaces/current');
  return mapBackendWorkspace(data);
}

export async function updateBackendWorkspace(payload: Record<string, any>): Promise<Workspace> {
  const data = await request<any>('/workspaces/current', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return mapBackendWorkspace(data);
}

export async function getBackendMembers(): Promise<Agent[]> {
  const data = await request<any[]>('/workspaces/current/members');
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    avatar_url: row.avatar_url || null,
    role: row.role || 'agent',
    status: row.status || 'online',
    is_active: row.is_active !== false,
    max_open_tickets: row.max_open_tickets ?? null,
    created_at: row.created_at,
  })) as Agent[];
}

export async function updateBackendAgentStatus(status: 'online' | 'away' | 'offline'): Promise<void> {
  await request<any>('/users/me/status', {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getBackendContacts(params?: {
  q?: string;
  onlineOnly?: boolean;
  page?: number;
  limit?: number;
}): Promise<Visitor[]> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set('q', params.q);
  if (params?.onlineOnly) searchParams.set('onlineOnly', 'true');
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const queryStr = searchParams.toString();
  const res = await request<any>(`/contacts${queryStr ? `?${queryStr}` : ''}`);
  const items = res?.items || (Array.isArray(res) ? res : []);
  return items.map(mapBackendVisitor);
}

export async function updateBackendContact(
  contactId: string,
  payload: { name?: string; email?: string; currentPageUrl?: string; currentPageTitle?: string }
): Promise<Visitor> {
  const data = await request<any>(`/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return mapBackendVisitor(data);
}

export async function getBackendInboxOverview(): Promise<any> {
  return request<any>('/inboxes/overview');
}

export async function getBackendConversations(params?: {
  status?: string;
  page?: number;
  limit?: number;
  q?: string;
  channel?: string;
  unassigned?: boolean;
  assignedAgentId?: string;
  handoffStatus?: string;
}): Promise<Conversation[]> {
  const searchParams = new URLSearchParams();
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.q) searchParams.set('q', params.q);
  if (params?.channel) searchParams.set('channel', params.channel);
  if (params?.unassigned) searchParams.set('unassigned', 'true');
  if (params?.assignedAgentId) searchParams.set('assignedAgentId', params.assignedAgentId);
  if (params?.handoffStatus) searchParams.set('handoffStatus', params.handoffStatus);

  const queryStr = searchParams.toString();
  const endpoint = `/conversations${queryStr ? `?${queryStr}` : ''}`;
  const res = await request<any>(endpoint);
  const items = res?.items || (Array.isArray(res) ? res : []);

  return items.map(mapBackendConversation);
}

export async function getBackendConversationById(conversationId: string): Promise<Conversation> {
  const row = await request<any>(`/conversations/${conversationId}`);
  return mapBackendConversation(row);
}

export async function createBackendConversation(payload: {
  visitorId: string;
  channel?: string;
  priority?: string;
  initialMessage?: string;
  tags?: string[];
}): Promise<Conversation> {
  const row = await request<any>('/conversations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapBackendConversation(row);
}

export async function getBackendMessages(
  conversationId: string,
  limit: number = 50
): Promise<Message[]> {
  const data = await request<any[]>(`/conversations/${conversationId}/messages?limit=${limit}`);
  return (data || []).map(mapBackendMessage);
}

export async function sendBackendMessage(
  conversationId: string,
  payload: {
    content: string;
    isInternal?: boolean;
    attachmentUrl?: string | null;
    replyToId?: string | null;
    replyToMessageId?: string | null;
    idempotencyKey?: string;
  }
): Promise<Message> {
  const bodyPayload: Record<string, any> = {
    content: payload.content || '',
    isInternal: Boolean(payload.isInternal),
  };
  if (payload.attachmentUrl) {
    bodyPayload.attachmentUrl = payload.attachmentUrl;
  }
  const replyId = payload.replyToMessageId ?? payload.replyToId;
  if (replyId) {
    bodyPayload.replyToMessageId = replyId;
  }
  if (payload.idempotencyKey) {
    bodyPayload.idempotencyKey = payload.idempotencyKey;
  }

  const data = await request<any>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(bodyPayload),
  });

  return mapBackendMessage(data);
}

export async function editBackendMessage(
  conversationId: string,
  messageId: string,
  content: string
): Promise<Message> {
  const data = await request<any>(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
  return mapBackendMessage(data);
}

export async function deleteBackendMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  await request<any>(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export async function updateBackendConversation(
  conversationId: string,
  payload: {
    status?: string;
    priority?: string;
    aiMode?: 'autopilot' | 'copilot' | 'disabled';
    handoffStatus?: string;
    assignedAgentId?: string | null;
    snoozedUntil?: string | null;
    tags?: string[];
  }
): Promise<void> {
  await request<any>(`/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function bulkUpdateBackendConversations(payload: {
  ids: string[];
  action: 'resolve' | 'reopen' | 'assign' | 'spam';
  agentId?: string | null;
}): Promise<{ updatedCount: number }> {
  return request<{ updatedCount: number }>('/conversations/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function assignBackendConversation(
  conversationId: string,
  agentId: string | null
): Promise<void> {
  await request<any>(`/conversations/${conversationId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
}

export async function claimBackendHandoff(
  conversationId: string
): Promise<{ ok: boolean; reason?: string; message?: string }> {
  try {
    const res = await request<any>(`/conversations/${conversationId}/claim`, {
      method: 'POST',
    });
    return { ok: true, ...(res || {}) };
  } catch (err: any) {
    const msg = err?.message || 'Could not claim chat';
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('claimed')) {
      return { ok: false, reason: 'already_claimed', message: msg };
    }
    return { ok: false, message: msg };
  }
}

export async function skipBackendHandoff(conversationId: string): Promise<any> {
  return request<any>(`/conversations/${conversationId}/skip`, {
    method: 'POST',
  });
}

export async function getBackendHandovers(days = 14, limit = 300): Promise<any[]> {
  return request<any[]>(`/conversations/handovers?days=${days}&limit=${limit}`);
}

export async function getBackendLiveVisitorMeta(visitorIds: string[]): Promise<{
  pageHistory: any[];
  openTickets: any[];
}> {
  if (!visitorIds.length) return { pageHistory: [], openTickets: [] };
  const qs = encodeURIComponent(visitorIds.join(','));
  return request<{ pageHistory: any[]; openTickets: any[] }>(`/contacts/live-meta?visitorIds=${qs}`);
}

export async function returnBackendToAi(conversationId: string): Promise<void> {
  await request<any>(`/conversations/${conversationId}/return-to-ai`, {
    method: 'POST',
  });
}

export async function closeBackendConversation(conversationId: string): Promise<void> {
  await request<any>(`/conversations/${conversationId}/close`, {
    method: 'POST',
  });
}

export async function markBackendMessagesRead(conversationId: string): Promise<void> {
  await request<any>(`/conversations/${conversationId}/messages/read`, {
    method: 'POST',
  });
}
