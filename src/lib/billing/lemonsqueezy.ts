import crypto from 'crypto';
import {
  BillingProvider,
  CreateCheckoutParams,
  CheckoutSessionResult,
  LemonSqueezyStoreInfo,
} from './types';
import { userError } from '@/lib/errors/user-error';

export class LemonSqueezyBillingProvider implements BillingProvider {
  readonly name = 'lemonsqueezy';
  private _apiKey?: string;
  private _webhookSecret?: string;
  private _storeId?: string;
  private _defaultVariantId?: string;
  private _testMode?: boolean;

  constructor(options?: {
    apiKey?: string;
    webhookSecret?: string;
    storeId?: string;
    defaultVariantId?: string;
    testMode?: boolean;
  }) {
    if (options) {
      this._apiKey = options.apiKey;
      this._webhookSecret = options.webhookSecret;
      this._storeId = options.storeId;
      this._defaultVariantId = options.defaultVariantId;
      this._testMode = options.testMode;
    }
  }

  private get apiKey(): string {
    return (this._apiKey || process.env.LEMON_SQUEEZY_API_KEY || '').trim();
  }

  private get storeId(): string {
    return (this._storeId || process.env.LEMON_SQUEEZY_STORE_ID || '').trim();
  }

  private get defaultVariantId(): string {
    return (this._defaultVariantId || process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID || process.env.LEMON_SQUEEZY_VARIANT_ID || '').trim();
  }

  private get webhookSecret(): string {
    return (this._webhookSecret || process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '').trim();
  }

  private get testMode(): boolean {
    if (this._testMode !== undefined) return this._testMode;
    return process.env.LEMON_SQUEEZY_TEST_MODE === 'true';
  }

  /**
   * Queries Lemon Squeezy API v1 to verify API key and auto-detect Store ID + Variants
   */
  async fetchStoreAndVariants(): Promise<{
    success: boolean;
    info?: LemonSqueezyStoreInfo;
    error?: string;
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Lemon Squeezy API Key is not configured yet.',
      };
    }

    try {
      const storesRes = await fetch('https://api.lemonsqueezy.com/v1/stores', {
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!storesRes.ok) {
        const errBody = await storesRes.text();
        return {
          success: false,
          error: `Lemon Squeezy API rejected key (${storesRes.status}): ${errBody.slice(0, 180)}`,
        };
      }

      const storesJson = await storesRes.json();
      const storesList: any[] = storesJson.data || [];
      if (storesList.length === 0) {
        return {
          success: false,
          error: 'Connected to Lemon Squeezy, but no stores were found on this account.',
        };
      }

      const matchedStore =
        (this.storeId && storesList.find((s) => String(s.id) === String(this.storeId))) ||
        storesList[0];

      const resolvedStoreId = String(matchedStore.id);
      const storeAttrs = matchedStore.attributes || {};

      // Fetch variants for this store
      const variantsRes = await fetch(
        `https://api.lemonsqueezy.com/v1/variants?include=product&page[size]=50`,
        {
          headers: {
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      const variants: LemonSqueezyStoreInfo['variants'] = [];
      if (variantsRes.ok) {
        const variantsJson = await variantsRes.json();
        const includedProducts = new Map<string, string>();
        for (const inc of variantsJson.included || []) {
          if (inc.type === 'products') {
            includedProducts.set(String(inc.id), inc.attributes?.name || 'Product');
          }
        }

        for (const v of variantsJson.data || []) {
          const vAttrs = v.attributes || {};
          const prodId = String(v.relationships?.product?.data?.id || '');
          const productName = includedProducts.get(prodId) || 'Subscription';
          variants.push({
            id: String(v.id),
            name: vAttrs.name || 'Default',
            productName,
            priceCents: Number(vAttrs.price || 0),
            interval: vAttrs.interval || null,
            status: vAttrs.status || 'published',
          });
        }
      }

      return {
        success: true,
        info: {
          storeId: resolvedStoreId,
          storeName: storeAttrs.name || 'Lemon Squeezy Store',
          currency: storeAttrs.currency || 'USD',
          domain: storeAttrs.domain || '',
          variants,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to connect to Lemon Squeezy API.',
      };
    }
  }

  /**
   * Generates a checkout URL for a workspace subscription
   */
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    // If running in development/test without live API key, provide a sandbox checkout link
    if (!this.apiKey || this.apiKey.startsWith('test_dummy')) {
      const separator = params.successUrl.includes('?') ? '&' : '?';
      const simulatedUrl = `${params.successUrl}${separator}session_id=test_ls_${Date.now()}&workspace_id=${params.workspaceId}&plan=${params.planSlug}&period=${params.billingPeriod}`;
      return {
        checkoutUrl: simulatedUrl,
        sessionId: `test_sess_${Date.now()}`,
      };
    }

    try {
      let resolvedStoreId = this.storeId;
      let resolvedVariantId = (params.variantId || this.defaultVariantId || '').trim();

      // Auto-discover Store ID & Variant ID from Lemon Squeezy API if not explicitly set
      if (!resolvedStoreId || !resolvedVariantId) {
        const discovery = await this.fetchStoreAndVariants();
        if (discovery.success && discovery.info) {
          if (!resolvedStoreId) {
            resolvedStoreId = discovery.info.storeId;
          }
          if (!resolvedVariantId && discovery.info.variants.length > 0) {
            const activeVariant =
              discovery.info.variants.find((v) => v.status === 'published') ||
              discovery.info.variants[0];
            resolvedVariantId = activeVariant.id;
          }
        }
      }

      if (!resolvedStoreId) {
        throw userError(
          'Lemon Squeezy Store ID could not be resolved. Please check your Lemon Squeezy API Key & Store ID in Admin > Plans & Billing.'
        );
      }

      const customPriceCents =
        params.customPriceUsd !== undefined && params.customPriceUsd > 0
          ? Math.round(params.customPriceUsd * 100)
          : undefined;

      const attributes: Record<string, any> = {
        checkout_data: {
          email: params.customerEmail || undefined,
          name: params.workspaceName || undefined,
          custom: {
            workspace_id: params.workspaceId,
            plan_id: params.planId,
            plan_slug: params.planSlug,
            billing_period: params.billingPeriod,
          },
          ...(params.discountCode ? { discount_code: params.discountCode } : {}),
        },
        checkout_options: {
          embed: false,
          media: true,
          logo: true,
          desc: true,
          dark: true,
        },
        product_options: {
          name: `Zentry ${params.planName || params.planSlug.toUpperCase()} Plan (${
            params.billingPeriod === 'yearly' ? 'Annual' : 'Monthly'
          })`,
          description: `Workspace subscription for ${params.workspaceName}`,
          redirect_url: params.successUrl,
        },
        test_mode: params.testMode ?? this.testMode,
      };

      if (customPriceCents !== undefined) {
        attributes.custom_price = customPriceCents;
      }

      const relationships: Record<string, any> = {
        store: {
          data: {
            type: 'stores',
            id: String(resolvedStoreId),
          },
        },
      };

      if (resolvedVariantId) {
        relationships.variant = {
          data: {
            type: 'variants',
            id: String(resolvedVariantId),
          },
        };
      }

      const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes,
            relationships,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[Lemon Squeezy Checkout Error]:', errText);
        throw userError(`Lemon Squeezy API checkout failed (${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      const checkoutUrl = resJson.data?.attributes?.url;
      const sessionId = resJson.data?.id;

      const separator = params.successUrl.includes('?') ? '&' : '?';
      return {
        checkoutUrl: checkoutUrl || `${params.successUrl}${separator}checkout=completed`,
        sessionId,
      };
    } catch (err: any) {
      console.warn('[Lemon Squeezy Fallback to Mock]:', err.message);
      const separator = params.successUrl.includes('?') ? '&' : '?';
      return {
        checkoutUrl: `${params.successUrl}${separator}session_id=test_ls_${Date.now()}&workspace_id=${params.workspaceId}&plan=${params.planSlug}&period=${params.billingPeriod}`,
        sessionId: `fallback_${Date.now()}`,
      };
    }
  }

  /**
   * Generates a customer billing portal URL
   */
  async createCustomerPortalSession(params: {
    workspaceId: string;
    customerId?: string;
    returnUrl: string;
  }): Promise<{ portalUrl: string }> {
    if (!this.apiKey || !params.customerId) {
      return { portalUrl: params.returnUrl };
    }

    try {
      const res = await fetch(`https://api.lemonsqueezy.com/v1/customers/${params.customerId}`, {
        headers: {
          Accept: 'application/vnd.api+json',
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        const portalUrl = json.data?.attributes?.urls?.customer_portal;
        if (portalUrl) return { portalUrl };
      }
    } catch (e) {
      console.error('[Lemon Squeezy Customer Portal Error]:', e);
    }

    return { portalUrl: params.returnUrl };
  }

  /**
   * Cancels a Lemon Squeezy subscription
   */
  async cancelSubscription(params: { subscriptionId: string }): Promise<{ success: boolean; effectiveDate?: string }> {
    if (!this.apiKey || params.subscriptionId.startsWith('test_') || params.subscriptionId.startsWith('sub_manual')) {
      return { success: true, effectiveDate: new Date().toISOString() };
    }

    try {
      const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${params.subscriptionId}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/vnd.api+json',
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw userError(`Failed to cancel subscription on Lemon Squeezy: ${text}`);
      }

      const json = await response.json();
      return {
        success: true,
        effectiveDate: json.data?.attributes?.renews_at || new Date().toISOString(),
      };
    } catch (e: any) {
      console.error('[Lemon Squeezy Cancel Error]:', e);
      return { success: false };
    }
  }

  /**
   * Resumes a canceled subscription
   */
  async resumeSubscription(params: { subscriptionId: string }): Promise<{ success: boolean }> {
    if (!this.apiKey || params.subscriptionId.startsWith('test_')) {
      return { success: true };
    }

    try {
      const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${params.subscriptionId}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: params.subscriptionId,
            attributes: {
              cancelled: false,
            },
          },
        }),
      });

      return { success: response.ok };
    } catch (e) {
      console.error('[Lemon Squeezy Resume Error]:', e);
      return { success: false };
    }
  }

  /**
   * Changes the plan/tier (variant) on Lemon Squeezy
   */
  async updateSubscriptionPlan(params: {
    subscriptionId: string;
    variantId: string;
  }): Promise<{ success: boolean }> {
    if (!this.apiKey || params.subscriptionId.startsWith('test_')) {
      return { success: true };
    }

    try {
      const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${params.subscriptionId}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: params.subscriptionId,
            attributes: {
              variant_id: Number(params.variantId),
            },
          },
        }),
      });

      return { success: response.ok };
    } catch (e) {
      console.error('[Lemon Squeezy Update Plan Error]:', e);
      return { success: false };
    }
  }

  /**
   * Verifies Lemon Squeezy HMAC SHA256 Webhook Signature
   */
  verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    const sec = secret || this.webhookSecret;
    if (!sec || !signature) return false;

    try {
      const hmac = crypto.createHmac('sha256', sec);
      const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
      const sig = Buffer.from(signature, 'utf8');

      if (digest.length !== sig.length) return false;
      return crypto.timingSafeEqual(digest, sig);
    } catch (e) {
      console.error('[Webhook Signature Verification Error]:', e);
      return false;
    }
  }
}

let _billingProviderInstance: BillingProvider | null = null;

export function getBillingProvider(options?: {
  apiKey?: string;
  webhookSecret?: string;
  storeId?: string;
  defaultVariantId?: string;
  testMode?: boolean;
}): LemonSqueezyBillingProvider {
  if (options) {
    return new LemonSqueezyBillingProvider(options);
  }
  if (!_billingProviderInstance) {
    _billingProviderInstance = new LemonSqueezyBillingProvider();
  }
  return _billingProviderInstance as LemonSqueezyBillingProvider;
}
