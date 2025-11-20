import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCollaboration } from "@/hooks/use-collaboration";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles, RefreshCw, Calendar, TrendingUp, MapPin, BookOpen, ExternalLink, Users, Zap, CalendarDays, Clock, DollarSign, Leaf, Gift, Copy, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CurriculumData, WeekCurriculum, UpcomingEvent } from "@shared/schema";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [copiedResources, setCopiedResources] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, user, toast]);

  const {
    data: familyData,
    isLoading: familyLoading,
  } = useQuery({
    queryKey: ["/api/family"],
    retry: false,
    enabled: !!user,
  });

  const {
    data: curriculumResponse,
    isLoading: curriculumLoading,
  } = useQuery({
    queryKey: ["/api/curriculum"],
    retry: false,
    enabled: !!user,
  });

  const {
    data: weeklyEvents = [],
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery<UpcomingEvent[]>({
    queryKey: ["/api/events/week", currentWeekIndex + 1],
    enabled: !!user && !!familyData && !!curriculumResponse,
    retry: 1,
  });

  const { data: subscription } = useQuery<{
    plan: string;
    status: string;
  }>({
    queryKey: ["/api/billing/subscription"],
    enabled: !!user,
  });

  // Setup real-time collaboration
  const { isConnected, activeUsers, sendPresence } = useCollaboration({
    user,
    familyId: familyData?.id || null,
    enabled: !!user && !!familyData,
  });

  // Send presence update when viewing a week (only when connected)
  useEffect(() => {
    if (isConnected && familyData && currentWeekIndex >= 0) {
      sendPresence(currentWeekIndex + 1);
    }
  }, [isConnected, currentWeekIndex, familyData, sendPresence]);

  // Listen for curriculum updates from other users
  useEffect(() => {
    const handleCurriculumUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum"] });
      toast({
        title: "Curriculum Updated",
        description: "Another user updated the curriculum",
      });
    };

    window.addEventListener("curriculum_updated", handleCurriculumUpdate);
    return () => window.removeEventListener("curriculum_updated", handleCurriculumUpdate);
  }, [toast]);

  const { mutate: regenerateWeek, isPending: isRegenerating } = useMutation({
    mutationFn: async (weekNumber: number) => {
      const response = await apiRequest("POST", "/api/curriculum/regenerate", { weekNumber });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum"] });
      toast({
        title: "Week Regenerated",
        description: "Your curriculum has been updated with fresh content!",
      });
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
        description: error.message || "Failed to regenerate week",
        variant: "destructive",
      });
    },
  });

  if (authLoading || familyLoading || curriculumLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="grid gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!familyData || !curriculumResponse) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-heading font-bold mb-2">No Curriculum Yet</h2>
        <p className="text-muted-foreground mb-6">
          Complete onboarding to generate your personalized curriculum
        </p>
        <Link href="/onboarding">
          <Button size="lg" data-testid="button-start-onboarding">
            Start Onboarding
          </Button>
        </Link>
      </div>
    );
  }

  const curriculum: CurriculumData = curriculumResponse.curriculumData;
  
  if (!curriculum || !curriculum.weeks || curriculum.weeks.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-heading font-bold mb-2">Generating Curriculum...</h2>
        <p className="text-muted-foreground mb-6">
          Your personalized curriculum is being created. Please refresh in a moment.
        </p>
      </div>
    );
  }
  
  const currentWeek: WeekCurriculum = curriculum.weeks[currentWeekIndex];

  const getMasteryColor = (level: string) => {
    const colorMap: Record<string, string> = {
      Exposure: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
      Developing: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
      Strong: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
      Mastery: "bg-green-500/10 text-green-700 dark:text-green-300",
      Mentor: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    };
    return colorMap[level] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
                {familyData.familyName}
              </h1>
              <p className="text-muted-foreground">
                {familyData.city}, {familyData.state} • {familyData.country}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {subscription?.status === "active" && (
                <Link href="/pricing">
                  <Badge variant={subscription.plan === "pro" ? "default" : "secondary"} className="gap-1" data-testid="badge-subscription">
                    <Zap className="w-3 h-3" />
                    {subscription.plan === "pro" ? "Pro" : "Basic"}
                  </Badge>
                </Link>
              )}
              {subscription?.plan === "basic" && subscription?.status === "active" && (
                <Link href="/pricing">
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-upgrade">
                    <Zap className="w-4 h-4" />
                    Upgrade to Pro
                  </Button>
                </Link>
              )}
              {activeUsers.length > 0 && (
                <div className="flex items-center gap-2" data-testid="presence-indicator">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-card-border">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div className="flex -space-x-2">
                          {activeUsers.slice(0, 3).map((activeUser, idx) => {
                            const initials = activeUser.userName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase();
                            return (
                              <Avatar key={`${activeUser.userId}-${idx}`} className="w-7 h-7 border-2 border-background">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                            );
                          })}
                          {activeUsers.length > 3 && (
                            <Avatar className="w-7 h-7 border-2 border-background">
                              <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                                +{activeUsers.length - 3}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                        {isConnected && (
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" data-testid="connection-indicator" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">Active Users</p>
                        {activeUsers.map((activeUser) => (
                          <p key={activeUser.userId} className="text-sm">
                            {activeUser.userName}
                            {activeUser.weekNumber !== undefined && ` - Week ${activeUser.weekNumber}`}
                          </p>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Current Week</p>
                <p className="text-2xl font-heading font-bold text-primary">{currentWeek.weekNumber}</p>
              </div>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur rounded-lg p-6 border border-card-border">
            <h2 className="text-2xl font-heading font-bold text-card-foreground mb-3">
              {currentWeek.familyTheme}
            </h2>
            <div className="flex flex-wrap gap-2">
              {currentWeek.familyActivities.map((activity, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm">
                  {activity}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex items-center gap-4 mb-6 overflow-x-auto pb-2">
          {curriculum.weeks.map((week, idx) => (
            <button
              key={week.weekNumber}
              onClick={() => setCurrentWeekIndex(idx)}
              className={`px-4 py-2 rounded-lg font-heading font-semibold text-sm whitespace-nowrap transition-colors hover-elevate ${
                idx === currentWeekIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-card-foreground border border-card-border"
              }`}
              data-testid={`button-week-${week.weekNumber}`}
            >
              Week {week.weekNumber}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-heading font-semibold">Children's Learning Plans</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerateWeek(currentWeek.weekNumber)}
            disabled={isRegenerating}
            data-testid="button-regenerate-week"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
            Regenerate Week
          </Button>
        </div>

        <div className="grid gap-6 mb-8">
          {currentWeek.children.map((child, childIdx) => (
            <Card key={child.childId} className="hover-elevate">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-heading">{child.name}</CardTitle>
                    <CardDescription>Age {child.age}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {child.deepDives.map((dive, idx) => (
                      <Badge key={idx} variant="default" className="text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        {dive}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="daily-plan" className="border-0">
                    <AccordionTrigger className="text-base font-heading hover:no-underline" data-testid={`accordion-daily-plan-${childIdx}`}>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        Daily Plan
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                          <div key={day}>
                            <h4 className="font-semibold text-sm mb-2">{day}</h4>
                            <ul className="space-y-1">
                              {child.dailyPlan[day as keyof typeof child.dailyPlan]?.map(
                                (activity: string, idx: number) => (
                                  <li key={idx} className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/20">
                                    {activity}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        ))}
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Weekend</h4>
                          <p className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/20">
                            {child.dailyPlan.Weekend}
                          </p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="mastery" className="border-0">
                    <AccordionTrigger className="text-base font-heading hover:no-underline" data-testid={`accordion-mastery-${childIdx}`}>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        Mastery Progress
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-3 pt-2">
                        {Object.entries(child.masteryUpdates).map(([topic, level]) => (
                          <div key={topic} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{topic}</span>
                            <Badge className={getMasteryColor(level)}>{level}</Badge>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <CardTitle className="font-heading">Local Opportunities This Week</CardTitle>
            </div>
            <CardDescription>
              Hyper-local educational experiences within your travel radius
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {currentWeek.localOpportunities.map((opp, idx) => (
                <Card key={idx} className="hover-elevate active-elevate-2">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-heading font-semibold">{opp.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {opp.driveMinutes} min
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{opp.address}</p>
                    <p className="text-sm mb-2">{opp.why}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-primary">{opp.cost}</span>
                      {opp.link && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={opp.link} target="_blank" rel="noopener noreferrer" data-testid={`link-opportunity-${idx}`}>
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Visit
                          </a>
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {opp.dates}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              <CardTitle className="font-heading">Upcoming Events</CardTitle>
            </div>
            <CardDescription>
              Real-time local events matching this week's theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : eventsError ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Unable to load events. Please try again later.</p>
              </div>
            ) : weeklyEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No events found for this week</p>
                <p className="text-sm mt-1">Check back later as we continuously discover new opportunities!</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {weeklyEvents.slice(0, 8).map((event, idx) => (
                  <Card key={event.id} className="hover-elevate active-elevate-2">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-heading font-semibold text-sm pr-2">{event.eventName}</h4>
                        {event.cost === "FREE" && (
                          <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-300 shrink-0">
                            FREE
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>{format(new Date(event.eventDate), "EEE, MMM d 'at' h:mm a")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{event.location}</span>
                          {event.driveMinutes && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {event.driveMinutes} min
                            </Badge>
                          )}
                        </div>
                        {event.cost !== "FREE" && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            <span className="font-semibold text-primary">{event.cost}</span>
                          </div>
                        )}
                        {event.ageRange && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              Ages {event.ageRange}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {event.whyItFits && (
                        <p className="text-xs text-muted-foreground mb-3 italic border-l-2 border-primary/20 pl-2">
                          {event.whyItFits}
                        </p>
                      )}

                      {event.ticketUrl && (
                        <Button variant="default" size="sm" className="w-full" asChild>
                          <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-event-${idx}`}>
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            {event.source === "eventbrite" ? "Get Tickets" : "Learn More"}
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <CardTitle className="font-heading">Resource List</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentWeek = curriculum?.weeks[currentWeekIndex];
                  if (!currentWeek?.resources) return;

                  const resourceText = currentWeek.resources
                    .map((r) => `${r.title}${r.link ? ` - ${r.link}` : ""}\n${r.description}`)
                    .join("\n\n");

                  navigator.clipboard.writeText(resourceText);
                  setCopiedResources(true);
                  setTimeout(() => setCopiedResources(false), 2000);

                  toast({
                    title: "Copied to clipboard!",
                    description: "Resource list is ready to paste into your shopping list",
                  });
                }}
                data-testid="button-copy-resources"
              >
                {copiedResources ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy to Shopping List
                  </>
                )}
              </Button>
            </div>
            <CardDescription>
              {curriculum?.weeks[currentWeekIndex]?.resources?.length || 0} curated resources for this week's theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const currentWeek = curriculum?.weeks[currentWeekIndex];
              if (!currentWeek?.resources || currentWeek.resources.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No resources available</p>
                    <p className="text-sm mt-1">Resources will appear here after curriculum generation</p>
                  </div>
                );
              }

              const freeResources = currentWeek.resources.filter(r => r.category === "free");
              const lowCostResources = currentWeek.resources.filter(r => r.category === "low-cost");
              const recycledResources = currentWeek.resources.filter(r => r.category === "recycled");

              return (
                <Accordion type="multiple" defaultValue={["free", "low-cost", "recycled"]} className="w-full">
                  {freeResources.length > 0 && (
                    <AccordionItem value="free">
                      <AccordionTrigger className="hover:no-underline" data-testid="accordion-free-resources">
                        <div className="flex items-center gap-2">
                          <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <span className="font-heading font-semibold">FREE Resources</span>
                          <Badge variant="secondary" className="ml-2">{freeResources.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {freeResources.map((resource, idx) => (
                            <Card key={idx} className="hover-elevate" data-testid={`card-free-resource-${idx}`}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-sm mb-1">{resource.title}</h4>
                                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                                  </div>
                                  {resource.link && (
                                    <Button variant="ghost" size="sm" asChild className="shrink-0">
                                      <a href={resource.link} target="_blank" rel="noopener noreferrer" data-testid={`link-free-resource-${idx}`}>
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {lowCostResources.length > 0 && (
                    <AccordionItem value="low-cost">
                      <AccordionTrigger className="hover:no-underline" data-testid="accordion-lowcost-resources">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-primary" />
                          <span className="font-heading font-semibold">Low-Cost Resources (under $15)</span>
                          <Badge variant="secondary" className="ml-2">{lowCostResources.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {lowCostResources.map((resource, idx) => (
                            <Card key={idx} className="hover-elevate" data-testid={`card-lowcost-resource-${idx}`}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-sm mb-1">{resource.title}</h4>
                                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                                  </div>
                                  {resource.link && (
                                    <Button variant="ghost" size="sm" asChild className="shrink-0">
                                      <a href={resource.link} target="_blank" rel="noopener noreferrer" data-testid={`link-lowcost-resource-${idx}`}>
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {recycledResources.length > 0 && (
                    <AccordionItem value="recycled">
                      <AccordionTrigger className="hover:no-underline" data-testid="accordion-recycled-resources">
                        <div className="flex items-center gap-2">
                          <Leaf className="w-5 h-5 text-green-700 dark:text-green-500" />
                          <span className="font-heading font-semibold">Recycled & Household Items</span>
                          <Badge variant="secondary" className="ml-2">{recycledResources.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {recycledResources.map((resource, idx) => (
                            <Card key={idx} className="hover-elevate" data-testid={`card-recycled-resource-${idx}`}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-sm mb-1">{resource.title}</h4>
                                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                                  </div>
                                  {resource.link && (
                                    <Button variant="ghost" size="sm" asChild className="shrink-0">
                                      <a href={resource.link} target="_blank" rel="noopener noreferrer" data-testid={`link-recycled-resource-${idx}`}>
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
