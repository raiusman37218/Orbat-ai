import {
  getCustomerPortalBundleAction,
  ratePortalTicketCsatAction,
  replyToPortalTicketAction,
  requestPortalVerificationCodeAction,
  signOutCustomerPortalAction,
  solvePortalTicketAction,
  verifyPortalByTicketAction,
  verifyPortalOtpAction,
  type CustomerPortalBundle,
  type PortalTicketItem,
  type PortalTicketMessage,
} from '@/app/actions/public-portal';
import type { PortalCsatChoice } from '@/lib/portal/portal-helpers';

export type { CustomerPortalBundle, PortalCsatChoice, PortalTicketItem, PortalTicketMessage };

export async function loadCustomerPortal(workspaceKey?: string | null): Promise<CustomerPortalBundle> {
  return getCustomerPortalBundleAction(workspaceKey);
}

export async function verifyPortalByTicket(
  workspaceId: string,
  email: string,
  ticketReference: string,
) {
  return verifyPortalByTicketAction({ workspaceId, email, ticketReference });
}

// TODO(backend): Email OTP verification links/codes require outbound workspace or platform SMTP; when unconfigured, visitors can still verify via Email + Ticket # or opening a request.
export async function requestPortalVerificationCode(workspaceId: string, email: string) {
  return requestPortalVerificationCodeAction({ workspaceId, email });
}

export async function verifyPortalOtp(workspaceId: string, email: string, code: string) {
  return verifyPortalOtpAction({ workspaceId, email, code });
}

export async function replyToPortalTicket(workspaceId: string, ticketId: string, body: string) {
  return replyToPortalTicketAction({ workspaceId, ticketId, body });
}

export async function markPortalTicketSolved(workspaceId: string, ticketId: string) {
  return solvePortalTicketAction({ workspaceId, ticketId });
}

export async function submitPortalCsatRating(
  workspaceId: string,
  ticketId: string,
  rating: PortalCsatChoice,
  comment?: string,
) {
  return ratePortalTicketCsatAction({ workspaceId, ticketId, rating, comment });
}

export async function signOutCustomerPortal() {
  return signOutCustomerPortalAction();
}
