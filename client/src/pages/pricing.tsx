import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Sparkles, Zap, GraduationCap, Users, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// IMPORTANT: Create these prices in Stripe Dashboard (Test Mode) and update IDs below
// Beta Launch Price IDs (TEST MODE) - must match server/stripe.ts
// Format: Create recurring prices at $29 AUD, $59 AUD, $99 AUD, $199 AUD/month in Stripe Dashboard
const STRIPE_PRICE_IDS = {
  starter: "price_BETA_STARTER_29",        // TODO: Replace with actual Stripe test mode price ID
  familypro: "price_BETA_FAMILYPRO_59",    // TODO: Replace with actual Stripe test mode price ID
  highschool: "price_BETA_HIGHSCHOOL_99",  // TODO: Replace with actual Stripe test mode price ID
  coop: "price_BETA_COOP_199",             // TODO: Replace with actual Stripe test mode price ID
} as const;

// Beta spot limits - ILLUSTRATIVE ONLY (not connected to real subscription counts)
// In production, fetch actual subscription counts from backend API
const BETA_SPOTS = {
  starter: { limit: 200, taken: 17 },
  familypro: { limit: 150, taken: 12 },
  highschool: { limit: 50, taken: 8 },
  coop: { limit: 10, taken: 3 },
} as const;

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "familypro" | "highschool" | "coop" | null>(null);
  
  const totalSpotsLeft = Object.values(BETA_SPOTS).reduce((acc, spot) => acc + (spot.limit - spot.taken), 0);

  const { data: subscription } = useQuery<{
    plan: string;
    status: string;
    currentPeriodEnd?: string;
  }>({
    queryKey: ["/api/billing/subscription"],
  });

  const { mutate: createCheckoutSession, isPending } = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest("POST", "/api/billing/create-checkout-session", { priceId });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
      setSelectedPlan(null);
    },
  });

  const handleSelectPlan = (plan: "starter" | "familypro" | "highschool" | "coop") => {
    setSelectedPlan(plan);
    const priceId = STRIPE_PRICE_IDS[plan];
    createCheckoutSession(priceId);
  };

  const currentPlan = subscription?.plan || "none";
  const isActive = subscription?.status === "active";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <Alert className="max-w-4xl mx-auto mb-8 border-primary bg-primary/5" data-testid="alert-beta-banner">
          <AlertCircle className="h-5 w-5 text-primary" />
          <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-semibold text-base">
              Limited Beta Launch - Prices Increase Next Week!
            </span>
            <Badge variant="secondary" className="text-sm" data-testid="badge-spots-remaining">
              {totalSpotsLeft} illustrative spots remaining
            </Badge>
          </AlertDescription>
        </Alert>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Beta Plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Lock in lifetime beta pricing before rates increase. AI-powered personalized home education curriculum for your family.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          <Card className={currentPlan === "starter" && isActive ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xl">Starter</CardTitle>
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">$29 <span className="text-base">AUD</span></span>
                  <span className="text-sm text-muted-foreground line-through">$49 AUD</span>
                </div>
                <span className="text-xs text-muted-foreground">/month</span>
              </div>
              <Badge variant="secondary" className="mb-2" data-testid="badge-spots-starter">
                {BETA_SPOTS.starter.limit - BETA_SPOTS.starter.taken} of {BETA_SPOTS.starter.limit} spots left
              </Badge>
              <CardDescription className="text-xs">Perfect for getting started</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Up to 3 children</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>12-week AI curriculum</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>8 learning approaches</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Local opportunities</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Daily journal</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              {currentPlan === "starter" && isActive ? (
                <Button variant="outline" className="w-full" disabled data-testid="button-current-starter">
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleSelectPlan("starter")}
                  disabled={isPending}
                  data-testid="button-select-starter"
                >
                  {isPending && selectedPlan === "starter" ? "Loading..." : "Choose Beta Plan"}
                </Button>
              )}
            </CardFooter>
          </Card>

          <Card className={currentPlan === "familypro" && isActive ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xl">Family Pro</CardTitle>
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">$59 <span className="text-base">AUD</span></span>
                  <span className="text-sm text-muted-foreground line-through">$99 AUD</span>
                </div>
                <span className="text-xs text-muted-foreground">/month</span>
              </div>
              <Badge variant="secondary" className="mb-2" data-testid="badge-spots-familypro">
                {BETA_SPOTS.familypro.limit - BETA_SPOTS.familypro.taken} of {BETA_SPOTS.familypro.limit} spots left
              </Badge>
              <CardDescription className="text-xs">Most popular for families</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="font-semibold">Unlimited children</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Everything in Starter</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Weekly PDF downloads</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Voice journaling</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              {currentPlan === "familypro" && isActive ? (
                <Button variant="outline" className="w-full" disabled data-testid="button-current-familypro">
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleSelectPlan("familypro")}
                  disabled={isPending}
                  data-testid="button-select-familypro"
                >
                  {isPending && selectedPlan === "familypro" ? "Loading..." : "Choose Beta Plan"}
                </Button>
              )}
            </CardFooter>
          </Card>

          <Card className={currentPlan === "highschool" && isActive ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xl">High School</CardTitle>
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">$99 <span className="text-base">AUD</span></span>
                  <span className="text-sm text-muted-foreground line-through">$179 AUD</span>
                </div>
                <span className="text-xs text-muted-foreground">/month</span>
              </div>
              <Badge variant="secondary" className="mb-2" data-testid="badge-spots-highschool">
                {BETA_SPOTS.highschool.limit - BETA_SPOTS.highschool.taken} of {BETA_SPOTS.highschool.limit} spots left
              </Badge>
              <CardDescription className="text-xs">College-ready transcripts</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="font-semibold">Official transcripts</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>8 education standards</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Auto credit tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Notary-ready PDFs</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              {currentPlan === "highschool" && isActive ? (
                <Button variant="outline" className="w-full" disabled data-testid="button-current-highschool">
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleSelectPlan("highschool")}
                  disabled={isPending}
                  data-testid="button-select-highschool"
                >
                  {isPending && selectedPlan === "highschool" ? "Loading..." : "Choose Beta Plan"}
                </Button>
              )}
            </CardFooter>
          </Card>

          <Card className={currentPlan === "coop" && isActive ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xl">Co-op</CardTitle>
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">$199 <span className="text-base">AUD</span></span>
                  <span className="text-sm text-muted-foreground line-through">$399 AUD</span>
                </div>
                <span className="text-xs text-muted-foreground">/month</span>
              </div>
              <Badge variant="secondary" className="mb-2" data-testid="badge-spots-coop">
                {BETA_SPOTS.coop.limit - BETA_SPOTS.coop.taken} of {BETA_SPOTS.coop.limit} spots left
              </Badge>
              <CardDescription className="text-xs">For home education groups</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="font-semibold">Up to 5 families</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Everything in High School</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Group planning tools</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Shared events calendar</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>White-label option</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              {currentPlan === "coop" && isActive ? (
                <Button variant="outline" className="w-full" disabled data-testid="button-current-coop">
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleSelectPlan("coop")}
                  disabled={isPending}
                  data-testid="button-select-coop"
                >
                  {isPending && selectedPlan === "coop" ? "Loading..." : "Choose Beta Plan"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Lock in lifetime beta pricing today. Rates increase next week!
          </p>
          <p className="text-xs text-muted-foreground">
            Stripe Test Mode. 7-day free trial. Cancel anytime. Spot counts are illustrative.
          </p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-back-dashboard"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
