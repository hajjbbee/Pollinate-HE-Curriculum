import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

// Stripe Price IDs (created in test mode)
// NOTE: To enable High School pricing tier, create a $199/month recurring price in Stripe Dashboard
// and replace price_PLACEHOLDER_HIGHSCHOOL with the actual price ID (e.g., price_1XYZ...)
export const STRIPE_PRICE_IDS = {
  basic: "price_1SV7cU7CoNMLNNsVdph4m8zi",
  pro: "price_1SV7cW7CoNMLNNsVvN4BWC47",
  highschool: "price_PLACEHOLDER_HIGHSCHOOL", // REQUIRED: Create in Stripe Dashboard ($199/month recurring)
} as const;

export { stripe };
