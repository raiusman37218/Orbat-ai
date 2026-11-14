'use client';

import {
  addCustomerNoteAction,
  addCustomerOrderAction,
  createCustomerAction,
  createCustomerSegmentAction,
  deleteCustomerNoteAction,
  deleteCustomerSegmentAction,
  getCustomerProfileAction,
  getCustomersBootstrapAction,
  importCustomersCsvAction,
  listCustomersAction,
  refreshCustomerAiSummaryAction,
  startCustomerConversationAction,
  updateCustomerAction,
  type BuiltInSegmentSlug,
  type CustomerConversationItem,
  type CustomerNoteRecord,
  type CustomerOrderRecord,
  type CustomerPageVisitItem,
  type CustomerProfileData,
  type CustomerRecord,
  type CustomerSegmentFilters,
  type CustomerSegmentRecord,
  type CustomerSortField,
  type CustomerTicketItem,
  type CustomersBootstrap,
} from '@/app/actions/customers';
import { createTicketAction } from '@/app/actions/tickets';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';
import type { TicketChannel, TicketPriority, TicketType } from '@/types/database';
import { downloadCsv, parseCsvRecords } from './csv';

export type {
  BuiltInSegmentSlug,
  CustomerConversationItem,
  CustomerNoteRecord,
  CustomerOrderRecord,
  CustomerPageVisitItem,
  CustomerProfileData,
  CustomerRecord,
  CustomerSegmentFilters,
  CustomerSegmentRecord,
  CustomerSortField,
  CustomerTicketItem,
  CustomersBootstrap,
};

export interface CustomersQueryParams {
  segmentSlug?: string;
  customSegmentId?: string;
  q?: string;
  country?: string;
  minLtvCents?: number;
  maxLtvCents?: number;
  sortBy?: CustomerSortField;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export function formatMoneyCents(cents: number, currency = 'USD'): string {
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export async function getCustomersBootstrap(workspaceId: string): Promise<CustomersBootstrap> {
  return getCustomersBootstrapAction(workspaceId);
}

export async function listCustomers(
  workspaceId: string,
  params: CustomersQueryParams = {},
) {
  return listCustomersAction(workspaceId, params);
}

export async function getCustomerProfile(workspaceId: string, visitorId: string) {
  return getCustomerProfileAction(workspaceId, visitorId);
}

export async function createCustomer(
  workspaceId: string,
  input: Parameters<typeof createCustomerAction>[1],
) {
  return createCustomerAction(workspaceId, input);
}

export async function updateCustomer(
  workspaceId: string,
  visitorId: string,
  patch: Parameters<typeof updateCustomerAction>[2],
) {
  return updateCustomerAction(workspaceId, visitorId, patch);
}

export async function addCustomerNote(workspaceId: string, visitorId: string, body: string) {
  return addCustomerNoteAction(workspaceId, visitorId, body);
}

export async function deleteCustomerNote(workspaceId: string, noteId: string) {
  return deleteCustomerNoteAction(workspaceId, noteId);
}

// TODO(backend): Add automated Shopify / WooCommerce webhook sync to populate customer_orders in addition to manual order entry.
export async function addCustomerOrder(
  workspaceId: string,
  visitorId: string,
  input: Parameters<typeof addCustomerOrderAction>[2],
) {
  return addCustomerOrderAction(workspaceId, visitorId, input);
}

export async function createCustomerSegment(
  workspaceId: string,
  input: { name: string; description?: string; filters: CustomerSegmentFilters },
) {
  return createCustomerSegmentAction(workspaceId, input);
}

export async function deleteCustomerSegment(workspaceId: string, segmentId: string) {
  return deleteCustomerSegmentAction(workspaceId, segmentId);
}

export async function refreshCustomerSummary(workspaceId: string, visitorId: string) {
  return refreshCustomerAiSummaryAction(workspaceId, visitorId);
}

export async function startCustomerConversation(workspaceId: string, visitorId: string) {
  return startCustomerConversationAction(workspaceId, visitorId);
}

export async function createTicketForCustomer(
  workspaceId: string,
  input: {
    requesterName: string;
    requesterEmail: string;
    subject: string;
    body: string;
    channel: TicketChannel;
    priority?: TicketPriority;
    type?: TicketType;
  },
) {
  return createTicketAction(workspaceId, input);
}

export async function importCustomersFromCsv(workspaceId: string, csvText: string) {
  const parsed = parseCsvRecords(csvText);
  const mapped = parsed.map((row) => ({
    name: row.name || row.full_name || row.customer || '',
    email: row.email || row.email_address || '',
    phone: row.phone || row.phone_number || '',
    company: row.company || row.organization || row.account || '',
    segment: row.segment || 'standard',
    country: row.country || row.location_country || '',
    city: row.city || row.location_city || '',
    plan: row.plan || row.tier || '',
    tags: (row.tags || '')
      .split(/[;|,]/)
      .map((t) => t.trim())
      .filter(Boolean),
  }));
  return importCustomersCsvAction(workspaceId, mapped);
}

export function exportCustomersToCsv(customers: CustomerRecord[]): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsv(
    `customers_export_${dateStr}.csv`,
    ['ID', 'Name', 'Email', 'Phone', 'Company', 'Segment', 'Plan', 'City', 'Country', 'Orders', 'Lifetime Value ($)', 'Sentiment', 'Tags', 'First Seen', 'Last Seen'],
    customers.map((c) => [
      c.id,
      c.name || '',
      c.email || '',
      c.phone || '',
      c.company || '',
      c.segment,
      c.plan || '',
      c.ip_location_city || '',
      c.ip_location_country || '',
      c.orders_count,
      (c.lifetime_value_cents / 100).toFixed(2),
      c.latest_sentiment || '',
      (c.tags || []).join('; '),
      c.first_seen_at,
      c.last_seen_at,
    ]),
  );
}

export function useCustomersLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
): void {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 12_000,
    onRefresh,
  });
}
