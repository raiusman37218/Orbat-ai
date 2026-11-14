import { describe, expect, it } from 'vitest';
import {
  calculatePerSeatComparison,
  calculateTrialHoursSaved,
  computeChecklistProgress,
  computeRecommendedFrameworks,
  computeRecommendedPlanSlug,
  slugifyCompanyName,
} from './onboarding-catalog';

describe('onboarding-catalog helpers', () => {
  it('slugifies workspace company names predictably', () => {
    expect(slugifyCompanyName('Northwind Health Care')).toBe('northwind-health-care');
    expect(slugifyCompanyName('  ***  ')).toBe('your-company');
  });

  it('recommends compliance frameworks by industry and country', () => {
    expect(computeRecommendedFrameworks('health', 'United States')).toEqual(['HIPAA', 'GDPR', 'CCPA']);
    expect(computeRecommendedFrameworks('fin', 'Germany')).toEqual(['GDPR', 'PCI', 'SOC2', 'KYC']);
  });

  it('computes checklist completion percentage cleanly', () => {
    expect(computeChecklistProgress([])).toEqual({ doneCount: 0, totalCount: 0, percentage: 0 });
    expect(
      computeChecklistProgress([
        { completed: true },
        { completed: true },
        { completed: false },
        { completed: false },
      ]),
    ).toEqual({ doneCount: 2, totalCount: 4, percentage: 50 });
  });

  it('selects the cheapest paid plan that fits workspace usage', () => {
    const plans = [
      { slug: 'starter', monthlyPrice: 29, maxAiRepliesPerMonth: 500, maxAgents: 3, maxChannelsConnected: 2 },
      { slug: 'pro', isPopular: true, monthlyPrice: 79, maxAiRepliesPerMonth: 5000, maxAgents: 10, maxChannelsConnected: 5 },
      { slug: 'enterprise', monthlyPrice: 199, maxAiRepliesPerMonth: null, maxAgents: null, maxChannelsConnected: null },
    ];
    expect(
      computeRecommendedPlanSlug({ aiConversations30d: 1800, agentsCount: 4, channelsCount: 3 }, plans),
    ).toBe('pro');
    expect(
      computeRecommendedPlanSlug({ aiConversations30d: 12000, agentsCount: 2, channelsCount: 1 }, plans),
    ).toBe('enterprise');
  });

  it('estimates trial hours saved and flat vs per-seat savings accurately', () => {
    expect(calculateTrialHoursSaved(0)).toBe(0);
    expect(calculateTrialHoursSaved(120)).toBe(14);
    expect(
      calculatePerSeatComparison({ agentsCount: 12, competitorPerSeatUsd: 65, fixedMonthlyPlanUsd: 79 }),
    ).toEqual({
      agentsCount: 12,
      competitorMonthlyUsd: 780,
      orbatMonthlyUsd: 79,
      monthlySavingsUsd: 701,
    });
  });
});
