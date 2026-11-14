import { describe, expect, it } from 'vitest';
import {
  calculateCheckoutBreakdown,
  classifyModelTier,
  projectMonthlySpend,
} from './cost-calculator';

describe('calculateCheckoutBreakdown', () => {
  it('computes monthly pricing, yearly savings, and discounts without negative totals', () => {
    const res = calculateCheckoutBreakdown({
      monthlyPriceUsd: 79,
      yearlyPriceUsd: 790,
      billingPeriod: 'yearly',
      seatCount: 5,
      includedSeats: 3,
      extraSeatMonthlyUsd: 10,
      discountType: 'percentage',
      discountValue: 20,
    });

    expect(res.basePlanUsd).toBe(790);
    expect(res.extraSeats).toBe(2);
    expect(res.extraSeatsUsd).toBe(240);
    expect(res.subtotalUsd).toBe(1030);
    expect(res.discountUsd).toBe(206);
    expect(res.totalDueUsd).toBe(824);
    expect(res.yearlySavingsPercent).toBe(17);
  });

  it('caps fixed discount at subtotal', () => {
    const res = calculateCheckoutBreakdown({
      monthlyPriceUsd: 29,
      yearlyPriceUsd: 290,
      billingPeriod: 'monthly',
      seatCount: 1,
      discountType: 'fixed',
      discountValue: 100,
    });

    expect(res.discountUsd).toBe(29);
    expect(res.totalDueUsd).toBe(0);
  });
});

describe('classifyModelTier', () => {
  it('groups light, standard, and advanced model names cleanly', () => {
    expect(classifyModelTier('gemini-2.5-flash')).toBe('light');
    expect(classifyModelTier('claude-3-5-haiku-latest')).toBe('light');
    expect(classifyModelTier('gpt-4o-mini')).toBe('light');
    expect(classifyModelTier('claude-3-7-sonnet')).toBe('standard');
    expect(classifyModelTier('claude-opus-4')).toBe('advanced');
    expect(classifyModelTier('gemini-2.5-pro')).toBe('advanced');
  });
});

describe('projectMonthlySpend', () => {
  it('projects month-end total from spend-to-date and day of month', () => {
    expect(projectMonthlySpend({ spendToDateUsd: 60, dayOfMonth: 15, daysInMonth: 30 })).toBe(120);
  });
});
