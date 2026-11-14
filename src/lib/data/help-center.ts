import {
  getPublicHelpCenterBundleAction,
  lookupPublicOrderAction,
  recordHelpArticleViewAction,
  searchHelpCenterAndAskAction,
  submitHelpCenterTicketAction,
  voteHelpArticleHelpfulAction,
  type HelpSearchAiResult,
  type PublicHelpArticleSummary,
  type PublicHelpCenterBundle,
  type PublicHelpSection,
  type PublicOrderLookupResult,
} from '@/app/actions/public-portal';

export type {
  HelpSearchAiResult,
  PublicHelpArticleSummary,
  PublicHelpCenterBundle,
  PublicHelpSection,
  PublicOrderLookupResult,
};

export async function loadHelpCenter(workspaceKey?: string | null): Promise<PublicHelpCenterBundle> {
  return getPublicHelpCenterBundleAction(workspaceKey);
}

export async function recordHelpArticleView(workspaceId: string, articleId: string) {
  return recordHelpArticleViewAction(workspaceId, articleId);
}

export async function voteHelpArticleHelpful(
  workspaceId: string,
  articleId: string,
  helpful: boolean,
) {
  return voteHelpArticleHelpfulAction(workspaceId, articleId, helpful);
}

export async function searchAndAskHelpCenter(
  workspaceId: string,
  queryText: string,
): Promise<HelpSearchAiResult> {
  return searchHelpCenterAndAskAction(workspaceId, queryText);
}

// TODO(backend): Auto-sync Shopify/WooCommerce orders in real time for workspaces connected via OAuth; lookupPublicOrder queries synced customer_orders rows cleanly.
export async function lookupPublicOrder(
  workspaceId: string,
  orderNumber: string,
  verifier: string,
): Promise<PublicOrderLookupResult> {
  return lookupPublicOrderAction(workspaceId, orderNumber, verifier);
}

export async function submitHelpCenterTicket(input: {
  workspaceId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: string;
}) {
  return submitHelpCenterTicketAction(input);
}
