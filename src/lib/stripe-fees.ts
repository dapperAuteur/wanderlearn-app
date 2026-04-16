// Stripe card fees (domestic US). Rates as of 2026-04 from stripe.com/pricing.
// International + non-USD cards run higher; this is the most common case for
// a creator pricing in USD. The UI labels this as an estimate.
export const STRIPE_FEE_PERCENT = 0.029;
export const STRIPE_FEE_FIXED_CENTS = 30;

export type FeeBreakdown = {
  gross: number;
  feeCents: number;
  netCents: number;
  feePercent: number;
  fixedCents: number;
};

export function estimateStripeFee(priceCents: number): FeeBreakdown {
  const gross = Math.max(0, Math.round(priceCents));
  if (gross === 0) {
    return {
      gross: 0,
      feeCents: 0,
      netCents: 0,
      feePercent: STRIPE_FEE_PERCENT,
      fixedCents: STRIPE_FEE_FIXED_CENTS,
    };
  }
  const feeCents = Math.round(gross * STRIPE_FEE_PERCENT) + STRIPE_FEE_FIXED_CENTS;
  return {
    gross,
    feeCents,
    netCents: Math.max(0, gross - feeCents),
    feePercent: STRIPE_FEE_PERCENT,
    fixedCents: STRIPE_FEE_FIXED_CENTS,
  };
}
