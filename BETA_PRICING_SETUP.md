# Beta Pricing Setup Guide

## Current Status
✅ Pricing page UI updated with 4 tiers (Starter, Family Pro, High School, Co-op)  
✅ Beta pricing display ($29/$59/$99/$199 vs normal $49/$99/$179/$399)  
✅ Limited spots banner and urgency counter (illustrative)  
✅ Backend webhook handlers configured for all 4 plans  
✅ Checkout route validation in place  

⚠️ **REQUIRED:** Create actual Stripe products and update price IDs

---

## Step 1: Create Stripe Products (Test Mode)

1. **Go to Stripe Dashboard** → Switch to **Test Mode** (toggle in top-right)

2. **Navigate to:** Products → Click "**Add Product**"

3. **Create 4 products** with these details:

### Product 1: Starter
- **Name:** Pollinate - Starter (Beta)
- **Pricing Model:** Recurring
- **Price:** $29.00 USD / month
- **Copy the Price ID** (format: `price_xxxxxxxxxxxxx`)

### Product 2: Family Pro
- **Name:** Pollinate - Family Pro (Beta)
- **Pricing Model:** Recurring
- **Price:** $59.00 USD / month
- **Copy the Price ID**

### Product 3: High School
- **Name:** Pollinate - High School (Beta)
- **Pricing Model:** Recurring
- **Price:** $99.00 USD / month
- **Copy the Price ID**

### Product 4: Co-op
- **Name:** Pollinate - Co-op (Beta)
- **Pricing Model:** Recurring
- **Price:** $199.00 USD / month
- **Copy the Price ID**

---

## Step 2: Update Price IDs in Code

Replace the placeholder IDs in **TWO files**:

### File 1: `server/stripe.ts`
```typescript
export const STRIPE_PRICE_IDS = {
  starter: "price_YOUR_ACTUAL_STARTER_ID",      // Replace with real ID
  familypro: "price_YOUR_ACTUAL_FAMILYPRO_ID",  // Replace with real ID
  highschool: "price_YOUR_ACTUAL_HS_ID",        // Replace with real ID
  coop: "price_YOUR_ACTUAL_COOP_ID",            // Replace with real ID
} as const;
```

### File 2: `client/src/pages/pricing.tsx`
```typescript
const STRIPE_PRICE_IDS = {
  starter: "price_YOUR_ACTUAL_STARTER_ID",      // Must match server
  familypro: "price_YOUR_ACTUAL_FAMILYPRO_ID",  // Must match server
  highschool: "price_YOUR_ACTUAL_HS_ID",        // Must match server
  coop: "price_YOUR_ACTUAL_COOP_ID",            // Must match server
} as const;
```

**IMPORTANT:** Both files must have identical price IDs!

---

## Step 3: (Optional) Implement Real Spot Tracking

Currently, spot counts are **illustrative only**. To track real subscriptions:

### Option A: Simple Count (No Limit Enforcement)
1. Create API endpoint `/api/billing/subscription-counts`
2. Query database for count by plan
3. Update `BETA_SPOTS` in pricing page to fetch from API

### Option B: Enforce Limits
1. Add `beta_subscribers_count` column to database
2. Check count before allowing checkout
3. Return error if limit reached

### Example Query:
```typescript
// Count active subscriptions by plan
const counts = await storage.getSubscriptionCountsByPlan();
// Returns: { starter: 17, familypro: 12, highschool: 8, coop: 3 }
```

---

## Step 4: Test the Flow

1. **Visit** `/pricing` page
2. **Click** "Choose Beta Plan" on any tier
3. **Verify** redirect to Stripe Checkout
4. **Use Stripe test card:** `4242 4242 4242 4242`
5. **Complete checkout**
6. **Verify** webhook creates subscription with correct plan name

---

## Important Notes

### Webhook Validation
- The webhook handler now **rejects unknown price IDs**
- Errors are logged to console
- This prevents silent misclassification

### Plan Name Mapping
The system maps price IDs to these plan names:
- `starter` → Starter plan (3 children max)
- `familypro` → Family Pro (unlimited children)
- `highschool` → High School (includes transcripts)
- `coop` → Co-op (up to 5 families)

### Test Mode Safety
- All integrations use `STRIPE_SECRET_KEY` environment variable
- Set `TESTING_STRIPE_SECRET_KEY` for test mode
- Frontend uses `TESTING_VITE_STRIPE_PUBLIC_KEY`

---

## Troubleshooting

### "Invalid price ID" error
- Price IDs don't match between client/server
- Price ID doesn't exist in Stripe
- Not in test mode

### Checkout doesn't redirect
- Check browser console for errors
- Verify price ID is valid
- Check Stripe API logs

### Webhook fails
- Verify `STRIPE_WEBHOOK_SECRET` is set
- Check webhook endpoint is accessible
- Review Stripe webhook logs

---

## Next Steps After Beta

When moving to production pricing:
1. Create new products at full price ($49/$99/$179/$399)
2. Update `STRIPE_PRICE_IDS` with production price IDs
3. Deploy to production
4. Archive beta price IDs (keep for existing subscribers)
