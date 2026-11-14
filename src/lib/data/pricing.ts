import {
  getPublicPricingBundleAction,
  type PublicPricingBundle,
} from '@/app/actions/public-portal';

export type { PublicPricingBundle };

// TODO(backend): Connect public plan selection CTAs directly to Stripe Checkout Session URLs once Stripe Price IDs and webhook secrets are configured across all platform plans.
export async function loadPublicPricing(): Promise<PublicPricingBundle> {
  return getPublicPricingBundleAction();
}
