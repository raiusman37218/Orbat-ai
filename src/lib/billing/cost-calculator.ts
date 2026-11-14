export type BillingPeriod = 'monthly' | 'yearly';

export interface PlanPricingInput {
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  billingPeriod: BillingPeriod;
  seatCount: number;
  includedSeats?: number;
  extraSeatMonthlyUsd?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
}

export interface CheckoutBreakdown {
  basePlanUsd: number;
  extraSeats: number;
  extraSeatsUsd: number;
  subtotalUsd: number;
  discountUsd: number;
  totalDueUsd: number;
  yearlySavingsPercent: number;
}

export function calculateCheckoutBreakdown(input: PlanPricingInput): CheckoutBreakdown {
  const seatCount = Math.max(1, Math.min(500, Math.floor(input.seatCount || 1)));
  const includedSeats = Math.max(1, Math.floor(input.includedSeats ?? 3));
  const extraSeats = Math.max(0, seatCount - includedSeats);
  const perSeatMonthly = Math.max(0, Number(input.extraSeatMonthlyUsd ?? 0));

  const baseMonthly = Math.max(0, Number(input.monthlyPriceUsd || 0));
  const baseYearly = Math.max(0, Number(input.yearlyPriceUsd || baseMonthly * 10));

  const basePlanUsd = input.billingPeriod === 'yearly' ? baseYearly : baseMonthly;
  const multiplier = input.billingPeriod === 'yearly' ? 12 : 1;
  const extraSeatsUsd = roundUsd(extraSeats * perSeatMonthly * multiplier);
  const subtotalUsd = roundUsd(basePlanUsd + extraSeatsUsd);

  let discountUsd = 0;
  if (input.discountType === 'percentage' && Number(input.discountValue) > 0) {
    discountUsd = roundUsd(subtotalUsd * Math.min(100, Number(input.discountValue)) / 100);
  } else if (input.discountType === 'fixed' && Number(input.discountValue) > 0) {
    discountUsd = roundUsd(Math.min(subtotalUsd, Number(input.discountValue)));
  }

  const totalDueUsd = roundUsd(Math.max(0, subtotalUsd - discountUsd));

  const fullYearAtMonthly = baseMonthly * 12;
  const yearlySavingsPercent =
    fullYearAtMonthly > 0 && baseYearly < fullYearAtMonthly
      ? Math.round(((fullYearAtMonthly - baseYearly) / fullYearAtMonthly) * 100)
      : 0;

  return {
    basePlanUsd: roundUsd(basePlanUsd),
    extraSeats,
    extraSeatsUsd,
    subtotalUsd,
    discountUsd,
    totalDueUsd,
    yearlySavingsPercent,
  };
}

export type ModelTier = 'light' | 'standard' | 'advanced';

export function classifyModelTier(modelName: string | null | undefined): ModelTier {
  const m = (modelName || '').toLowerCase().trim();
  if (!m) return 'standard';
  if (/(^|[-_./\s])(haiku|flash|mini|nano|lite|8b)($|[-_./\s])/.test(m) || m.includes('3.5-haiku')) {
    return 'light';
  }
  if (
    /(^|[-_./\s])(opus|o1|o3|pro|reasoning)($|[-_./\s])/.test(m) ||
    m.includes('4.1') ||
    m.includes('4.5')
  ) {
    return 'advanced';
  }
  return 'standard';
}

export function projectMonthlySpend(input: {
  spendToDateUsd: number;
  dayOfMonth: number;
  daysInMonth: number;
}): number {
  const spend = Math.max(0, Number(input.spendToDateUsd || 0));
  const day = Math.max(1, Math.min(31, Math.floor(input.dayOfMonth || 1)));
  const totalDays = Math.max(day, Math.min(31, Math.floor(input.daysInMonth || 30)));
  return roundUsd((spend / day) * totalDays);
}

export function roundUsd(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}
