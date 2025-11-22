import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

// Stripe Price IDs (created in test mode)
export const STRIPE_PRICE_IDS = {
  basic: "price_1SV7cU7CoNMLNNsVdph4m8zi",
  pro: "price_1SV7cW7CoNMLNNsVvN4BWC47",
  highschool: "price_PLACEHOLDER_HIGHSCHOOL", // TODO: Replace with actual Stripe price ID for $199/month
} as const;

export { stripe };
