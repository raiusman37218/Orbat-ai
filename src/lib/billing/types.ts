export interface CreateCheckoutParams {
  workspaceId: string;
  workspaceName: string;
  planId: string;
  planSlug: string;
  planName?: string;
  billingPeriod: 'monthly' | 'yearly';
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  customPriceUsd?: number;
  variantId?: string | null;
  discountCode?: string;
  testMode?: boolean;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionId?: string;
}

export interface LemonSqueezyStoreInfo {
  storeId: string;
  storeName: string;
  currency: string;
  domain: string;
  variants: Array<{
    id: string;
    name: string;
    productName: string;
    priceCents: number;
    interval: string | null;
    status: string;
  }>;
}

export interface BillingProvider {
  readonly name: string;
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>;
  createCustomerPortalSession(params: {
    workspaceId: string;
    customerId?: string;
    returnUrl: string;
  }): Promise<{ portalUrl: string }>;
  cancelSubscription(params: { subscriptionId: string }): Promise<{ success: boolean; effectiveDate?: string }>;
  resumeSubscription(params: { subscriptionId: string }): Promise<{ success: boolean }>;
  updateSubscriptionPlan(params: {
    subscriptionId: string;
    variantId: string;
  }): Promise<{ success: boolean }>;
  verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean;
  fetchStoreAndVariants?(): Promise<{ success: boolean; info?: LemonSqueezyStoreInfo; error?: string }>;
}
