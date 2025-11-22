import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Sparkles, MapPin, Users, Calendar, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import { LearningApproachSelector, type LearningApproach } from "@/components/LearningApproachSelector";
import { PrivacyBanner } from "@/components/PrivacyBanner";

const step1Schema = z.object({
  familyName: z.string().min(1, "Family name is required"),
  country: z.enum([
    "US", "CA", "GB", "AU", "NZ", "IE", 
    "DE", "FR", "ES", "IT", "NL", "BE", "AT", "CH",
    "DK", "SE", "NO", "FI", "PL", "CZ",
    "ZA", "IN", "SG", "JP", "KR",
    "MX", "BR", "AR", "OTHER"
  ], {
    required_error: "Please select your country",
  }),
});

const step2Schema = z.object({
  address: z.string().min(5, "Please enter a valid address"),
  lat: z.number().optional(),
  lng: z.number().optional(),
  travelRadiusMinutes: z.number().min(15).max(120),
  flexForHighInterest: z.boolean(),
});

const step3Schema = z.object({
  learningApproaches: z.array(z.string()).min(1, "Please select at least one learning approach"),
  usePerChildApproaches: z.boolean(),
});

const childSchema = z.object({
  name: z.string().min(1, "Name is required"),
  birthdate: z.string().min(1, "Birthdate is required"),
  interests: z.string().min(1, "Please add at least one interest"),
  learningStyle: z.string().optional(),
});

const step4Schema = z.object({
  children: z.array(childSchema).min(1, "Please add at least one child"),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Step4Data = z.infer<typeof step4Schema>;

const TRAVEL_RADIUS_OPTIONS = [15, 30, 45, 60, 90, 120];
const LEARNING_STYLES = [
  "Visual Learner",
  "Auditory Learner",
  "Kinesthetic Learner",
  "Reading/Writing Learner",
  "Mixed Learning Style",
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [step3Data, setStep3Data] = useState<Step3Data | null>(null);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      familyName: "",
      country: undefined,
    },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      address: "",
      lat: undefined,
      lng: undefined,
      travelRadiusMinutes: 30,
      flexForHighInterest: true,
    },
  });

  const handlePlaceSelected = (place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      step2Form.setValue("lat", place.geometry.location.lat());
      step2Form.setValue("lng", place.geometry.location.lng());
    }
  };

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      learningApproaches: ["perfect-blend"],
      usePerChildApproaches: false,
    },
  });

  const step4Form = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      children: [
        {
          name: "",
          birthdate: "",
          interests: "",
          learningStyle: "",
        },
      ],
    },
  });

  const { mutate: submitOnboarding, isPending } = useMutation({
    mutationFn: async (data: Step1Data & Step2Data & Step3Data & Step4Data) => {
      const response = await apiRequest("POST", "/api/onboarding", data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.warning) {
        toast({
          title: "Welcome to Pollinate!",
          description: data.warning,
          variant: "default",
        });
      } else {
        toast({
          title: "Welcome to Pollinate!",
          description: "Your family profile has been created. Generating your custom curriculum... (10–20s)",
        });
      }
      navigate("/dashboard");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please sign in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create family profile",
        variant: "destructive",
      });
    },
  });

  const onStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
    setStep(2);
  };

  const onStep2Submit = (data: Step2Data) => {
    // Allow proceeding without coordinates - backend will geocode manually entered addresses
    setStep2Data(data);
    setStep(3);
  };

  const onStep3Submit = (data: Step3Data) => {
    setStep3Data(data);
    setStep(4);
  };

  const onStep4Submit = (data: Step4Data) => {
    if (!step1Data || !step2Data || !step3Data) return;

    const fullData = {
      ...step1Data,
      ...step2Data,
      ...step3Data,
      children: data.children.map((child) => ({
        ...child,
        interests: child.interests.split(",").map((i) => i.trim()),
      })),
    };

    submitOnboarding(fullData);
  };

  const addChild = () => {
    const currentChildren = step4Form.getValues("children");
    step4Form.setValue("children", [
      ...currentChildren,
      {
        name: "",
        birthdate: "",
        interests: "",
        learningStyle: "",
      },
    ]);
  };

  const removeChild = (index: number) => {
    const currentChildren = step4Form.getValues("children");
    if (currentChildren.length > 1) {
      step4Form.setValue(
        "children",
        currentChildren.filter((_, i) => i !== index)
      );
    }
  };

  const stepLabels = [
    { number: 1, label: "Family", icon: Users },
    { number: 2, label: "Location", icon: MapPin },
    { number: 3, label: "Learners", icon: Calendar },
  ];

  const currentStepLabel = stepLabels.find(s => s.number === step);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-heading font-bold">Pollinate</h1>
              <p className="text-xs text-muted-foreground">Home Education Curriculum</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2" data-testid="button-step-navigation">
                {currentStepLabel && (
                  <>
                    <currentStepLabel.icon className="w-4 h-4" />
                    <span className="font-medium">{currentStepLabel.label}</span>
                  </>
                )}
                <span className="text-muted-foreground">({step} of 3)</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" data-testid="dropdown-step-navigation">
              {stepLabels.map((stepItem) => {
                const Icon = stepItem.icon;
                const isCompleted = stepItem.number < step;
                const isCurrent = stepItem.number === step;
                const canNavigate = isCompleted || isCurrent;
                return (
                  <DropdownMenuItem
                    key={stepItem.number}
                    disabled={!canNavigate}
                    className={isCurrent ? "bg-accent" : ""}
                    onClick={() => {
                      if (canNavigate) {
                        setStep(stepItem.number);
                      }
                    }}
                    data-testid={`dropdown-item-step-${stepItem.number}`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    <span className="flex-1">{stepItem.label}</span>
                    {isCompleted && <span className="text-primary">✓</span>}
                    {isCurrent && <span className="text-primary font-medium">Current</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex gap-2 mb-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          
          {/* Privacy Banner */}
          <PrivacyBanner />
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-heading">Family Information</CardTitle>
                  <CardDescription>Tell us about your family</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...step1Form}>
                <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-6">
                  <FormField
                    control={step1Form.control}
                    name="familyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Family Name</FormLabel>
                        <FormControl>
                          <Input placeholder="The Smith Family" {...field} data-testid="input-family-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-country">
                              <SelectValue placeholder="Select your country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="US">🇺🇸 United States</SelectItem>
                            <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                            <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                            <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                            <SelectItem value="NZ">🇳🇿 New Zealand</SelectItem>
                            <SelectItem value="IE">🇮🇪 Ireland</SelectItem>
                            <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                            <SelectItem value="FR">🇫🇷 France</SelectItem>
                            <SelectItem value="ES">🇪🇸 Spain</SelectItem>
                            <SelectItem value="IT">🇮🇹 Italy</SelectItem>
                            <SelectItem value="NL">🇳🇱 Netherlands</SelectItem>
                            <SelectItem value="BE">🇧🇪 Belgium</SelectItem>
                            <SelectItem value="AT">🇦🇹 Austria</SelectItem>
                            <SelectItem value="CH">🇨🇭 Switzerland</SelectItem>
                            <SelectItem value="DK">🇩🇰 Denmark</SelectItem>
                            <SelectItem value="SE">🇸🇪 Sweden</SelectItem>
                            <SelectItem value="NO">🇳🇴 Norway</SelectItem>
                            <SelectItem value="FI">🇫🇮 Finland</SelectItem>
                            <SelectItem value="PL">🇵🇱 Poland</SelectItem>
                            <SelectItem value="CZ">🇨🇿 Czech Republic</SelectItem>
                            <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                            <SelectItem value="IN">🇮🇳 India</SelectItem>
                            <SelectItem value="SG">🇸🇬 Singapore</SelectItem>
                            <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                            <SelectItem value="KR">🇰🇷 South Korea</SelectItem>
                            <SelectItem value="MX">🇲🇽 Mexico</SelectItem>
                            <SelectItem value="BR">🇧🇷 Brazil</SelectItem>
                            <SelectItem value="AR">🇦🇷 Argentina</SelectItem>
                            <SelectItem value="OTHER">🌍 Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" data-testid="button-next-step-1">
                    Continue
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-heading">Location & Preferences</CardTitle>
                  <CardDescription>Where do you live and how far will you travel?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...step2Form}>
                <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-6">
                  <FormField
                    control={step2Form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Home Address or {step1Data?.country === "US" ? "ZIP Code" : "Postcode"}</FormLabel>
                        <FormControl>
                          <PlacesAutocomplete
                            value={field.value}
                            onChange={field.onChange}
                            onPlaceSelected={handlePlaceSelected}
                            placeholder={
                              step1Data?.country === "US"
                                ? "123 Main St, Seattle, WA 98101"
                                : step1Data?.country === "AU"
                                ? "123 King St, Sydney NSW 2000"
                                : "123 Queen St, Auckland 1010"
                            }
                            country={step1Data?.country}
                            dataTestId="input-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step2Form.control}
                    name="travelRadiusMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Travel Radius: {field.value} minutes</FormLabel>
                        <FormControl>
                          <Slider
                            min={15}
                            max={120}
                            step={15}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="py-4"
                            data-testid="slider-travel-radius"
                          />
                        </FormControl>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>15 min</span>
                          <span>120 min</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step2Form.control}
                    name="flexForHighInterest"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Flex for High Interest</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Allow exceeding travel radius for highly relevant opportunities
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-flex-interest"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1" data-testid="button-back">
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" data-testid="button-next-step-2">
                      Continue
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-heading">Choose Your Learning Approach</CardTitle>
                  <CardDescription>Select one or more educational philosophies to blend seamlessly</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...step3Form}>
                <form onSubmit={step3Form.handleSubmit(onStep3Submit)} className="space-y-6">
                  <FormField
                    control={step3Form.control}
                    name="usePerChildApproaches"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="font-medium">
                            Customize per child
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Set different learning approaches for each child (configured later)
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-per-child-approaches"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {!step3Form.watch("usePerChildApproaches") && (
                    <FormField
                      control={step3Form.control}
                      name="learningApproaches"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <LearningApproachSelector
                              value={field.value as LearningApproach[]}
                              onChange={field.onChange}
                              hideTitle={true}
                              multiSelect={true}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {step3Form.watch("usePerChildApproaches") && (
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground text-center">
                        You'll set learning approaches for each child in the next step
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1" data-testid="button-back">
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" data-testid="button-next-step-3">
                      Continue
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-heading">Add Your Children</CardTitle>
                  <CardDescription>Tell us about each child's interests and learning style</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...step4Form}>
                <form onSubmit={step4Form.handleSubmit(onStep4Submit)} className="space-y-6">
                  {step4Form.watch("children").map((_, index) => (
                    <Card key={index} className="border-border">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-heading font-semibold">Child {index + 1}</h3>
                          {step3Form.watch("children").length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeChild(index)}
                              data-testid={`button-remove-child-${index}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>

                        <FormField
                          control={step4Form.control}
                          name={`children.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Child's name" {...field} data-testid={`input-child-name-${index}`} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={step4Form.control}
                          name={`children.${index}.birthdate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Birthdate</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid={`input-child-birthdate-${index}`} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={step4Form.control}
                          name={`children.${index}.interests`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Interests (comma-separated)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="dinosaurs, space, art, music"
                                  {...field}
                                  data-testid={`input-child-interests-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={step4Form.control}
                          name={`children.${index}.learningStyle`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Learning Style (optional)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid={`select-learning-style-${index}`}>
                                    <SelectValue placeholder="Select learning style" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {LEARNING_STYLES.map((style) => (
                                    <SelectItem key={style} value={style}>
                                      {style}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addChild}
                    className="w-full"
                    data-testid="button-add-child"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Another Child
                  </Button>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(3)} className="flex-1" data-testid="button-back">
                      Back
                    </Button>
                    <Button type="submit" disabled={isPending} className="flex-1" data-testid="button-complete-onboarding">
                      {isPending ? "Creating..." : "Complete Setup"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
