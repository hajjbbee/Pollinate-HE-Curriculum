import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

// Stripe Price IDs (TEST MODE for beta launch)
// IMPORTANT: Create these prices in Stripe Dashboard (Test Mode) and replace placeholder IDs
// Steps to create:
//   1. Go to Stripe Dashboard > Products > Add Product
//   2. Create recurring prices: $29, $59, $99, $199/month
//   3. Copy the price IDs (format: price_xxxxxxxxxxxxx)
//   4. Replace the placeholder values below
// Beta Launch Pricing - Limited Spots
export const STRIPE_PRICE_IDS = {
  starter: "price_BETA_STARTER_29",        // TODO: Replace - $29/mo beta (normal $49) - 200 spots
  familypro: "price_BETA_FAMILYPRO_59",    // TODO: Replace - $59/mo beta (normal $99) - 150 spots
  highschool: "price_BETA_HIGHSCHOOL_99",  // TODO: Replace - $99/mo beta (normal $179) - 50 spots
  coop: "price_BETA_COOP_199",             // TODO: Replace - $199/mo beta (normal $399) - 10 spots
} as const;

// Spot limits for beta launch
export const BETA_SPOT_LIMITS = {
  starter: 200,
  familypro: 150,
  highschool: 50,
  coop: 10,
} as const;

export { stripe };
