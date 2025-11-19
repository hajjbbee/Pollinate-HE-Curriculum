import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Sparkles, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const STRIPE_PRICE_IDS = {
  basic: "price_1SV7cU7CoNMLNNsVdph4m8zi",
  pro: "price_1SV7cW7CoNMLNNsVvN4BWC47",
} as const;

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro" | null>(null);

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

  const handleSelectPlan = (plan: "basic" | "pro") => {
    setSelectedPlan(plan);
    const priceId = STRIPE_PRICE_IDS[plan];
    createCheckoutSession(priceId);
  };

  const currentPlan = subscription?.plan || "none";
  const isActive = subscription?.status === "active";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unlock AI-powered personalized homeschool curriculum for your family
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className={currentPlan === "basic" && isActive ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-2xl">Basic</CardTitle>
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="mb-2">
                <span className="text-4xl font-bold">$49</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription>Perfect for getting started with AI-powered curriculum</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-basic-1" />
                  <span>Up to 3 children</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-basic-2" />
                  <span>12-week rolling AI curriculum</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-basic-3" />
                  <span>Charlotte Mason & Montessori methods</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-basic-4" />
                  <span>Local opportunity discovery</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-basic-5" />
                  <span>Daily journal with photo uploads</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-basic-6" />
                  <span>Weekly curriculum regeneration</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              {currentPlan === "basic" && isActive ? (
                <Button variant="outline" className="w-full" disabled data-testid="button-current-basic">
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleSelectPlan("basic")}
                  disabled={isPending}
                  data-testid="button-select-basic"
                >
                  {isPending && selectedPlan === "basic" ? "Loading..." : "Get Started"}
                </Button>
              )}
            </CardFooter>
          </Card>

          <Card className={currentPlan === "pro" && isActive ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-2xl">Pro</CardTitle>
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div className="mb-2">
                <span className="text-4xl font-bold">$99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription>Everything in Basic, plus advanced features</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-pro-1" />
                  <span className="font-semibold">Unlimited children</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-pro-2" />
                  <span>Everything in Basic</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-pro-3" />
                  <span className="font-semibold">Advanced analytics dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-pro-4" />
                  <span>Real-time collaboration (coming soon)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-pro-5" />
                  <span className="font-semibold">Priority support</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" data-testid="icon-check-pro-6" />
                  <span>Exclusive educational resources</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              {currentPlan === "pro" && isActive ? (
                <Button variant="outline" className="w-full" disabled data-testid="button-current-pro">
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="default"
                  onClick={() => handleSelectPlan("pro")}
                  disabled={isPending}
                  data-testid="button-select-pro"
                >
                  {isPending && selectedPlan === "pro" ? "Loading..." : "Upgrade to Pro"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            All plans include a 7-day free trial. Cancel anytime.
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
