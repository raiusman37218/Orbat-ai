import {
  getBillingDashboardAction,
  getCheckoutInitialDataAction,
  submitCheckoutAction,
  updateBillingProfileAction,
  validateCheckoutCouponAction,
  type BillingDashboardBundle,
  type BillingProfileRecord,
  type ModelTierBreakdown,
  type UsageSliceRow,
  type WorkspaceInvoiceRecord,
} from '@/app/actions/billing-studio';
import { createWorkspaceCustomerPortalAction } from '@/app/actions/platform-management';

export type {
  BillingDashboardBundle,
  BillingProfileRecord,
  ModelTierBreakdown,
  UsageSliceRow,
  WorkspaceInvoiceRecord,
};

export async function fetchBillingDashboard(workspaceId: string): Promise<BillingDashboardBundle> {
  const res = await getBillingDashboardAction(workspaceId);
  if (!res.success) {
    throw new Error(res.error);
  }
  return res.data;
}

export async function fetchCheckoutInitialData(workspaceId: string) {
  // TODO(backend): PayPal, JazzCash, Easypaisa gateways and automatic PAYG wallet card reloads are
  // unconfigured; Card routes through Lemon Squeezy and Bank Wire writes open workspace_invoices rows.
  const res = await getCheckoutInitialDataAction(workspaceId);
  if (!res.success) {
    throw new Error(res.error);
  }
  return res;
}

export {
  createWorkspaceCustomerPortalAction,
  submitCheckoutAction,
  updateBillingProfileAction,
  validateCheckoutCouponAction,
};
