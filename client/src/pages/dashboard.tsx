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
import { Sparkles, RefreshCw, Calendar, TrendingUp, MapPin, BookOpen, ExternalLink, Users, Zap, CalendarDays, Clock, DollarSign, Leaf, Gift, Copy, CheckCircle2, ShoppingBasket, Tag, ChevronRight, Settings } from "lucide-react";
import { SiFacebook } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CurriculumData, WeekCurriculum, UpcomingEvent, JournalEntry } from "@shared/schema";
import { Link } from "wouter";
import { format, addDays, startOfWeek, eachWeekOfInterval, isSameWeek, parseISO } from "date-fns";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [copiedResources, setCopiedResources] = useState<Record<number, boolean>>({});
  const [currentWeekNumber, setCurrentWeekNumber] = useState<number | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

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

  const { data: journalEntries = [] } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    enabled: !!user && !!familyData,
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

  // Send presence update when viewing a week
  useEffect(() => {
    if (isConnected && familyData && currentWeekNumber !== null && currentWeekNumber >= 1) {
      sendPresence(currentWeekNumber);
    }
  }, [isConnected, currentWeekNumber, familyData, sendPresence]);

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

  // Calculate the actual current week based on today's date
  useEffect(() => {
    if (curriculumResponse?.curriculumData?.generatedAt) {
      const startDate = parseISO(curriculumResponse.curriculumData.generatedAt);
      const today = new Date();
      
      // If curriculum starts in the future, default to week 1
      if (today < startDate) {
        setCurrentWeekNumber(1);
        setExpandedWeeks(new Set([1]));
        return;
      }
      
      let calculatedWeek = 1;
      for (let i = 0; i < 12; i++) {
        const weekStart = addDays(startDate, i * 7);
        const weekEnd = addDays(startDate, i * 7 + 6);
        
        if (today >= weekStart && today <= weekEnd) {
          calculatedWeek = i + 1;
          break;
        }
      }
      
      // If today is after all 12 weeks, default to week 12
      const lastWeekEnd = addDays(startDate, 11 * 7 + 6);
      if (today > lastWeekEnd) {
        calculatedWeek = 12;
      }
      
      setCurrentWeekNumber(calculatedWeek);
      setExpandedWeeks(new Set([calculatedWeek]));
    }
  }, [curriculumResponse?.curriculumData?.generatedAt]);

  // Calculate journal progress for each week using actual date ranges
  const getWeekProgress = (weekNumber: number): { completed: number; total: number } => {
    if (!curriculumResponse?.curriculumData?.generatedAt) return { completed: 0, total: 5 };
    
    const startDate = parseISO(curriculumResponse.curriculumData.generatedAt);
    const weekStart = addDays(startDate, (weekNumber - 1) * 7);
    const weekEnd = addDays(startDate, (weekNumber - 1) * 7 + 6);
    
    const entriesThisWeek = journalEntries.filter(entry => {
      const entryDate = parseISO(entry.entryDate);
      return entryDate >= weekStart && entryDate <= weekEnd;
    });
    
    return { completed: entriesThisWeek.length, total: 5 };
  };

  // Copy resources to clipboard
  const copyResourcesToClipboard = (weekNumber: number, resources: any[]) => {
    if (!resources || resources.length === 0) return;

    const text = resources
      .map(r => `${r.title} - ${r.description}${r.link ? ` (${r.link})` : ''}`)
      .join('\n\n');

    navigator.clipboard.writeText(text);
    setCopiedResources(prev => ({ ...prev, [weekNumber]: true }));
    toast({
      title: "Copied!",
      description: "Resource list copied to clipboard",
    });

    setTimeout(() => {
      setCopiedResources(prev => ({ ...prev, [weekNumber]: false }));
    }, 2000);
  };

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

  if (!familyData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-heading font-bold mb-2">Welcome to Pollinate</h2>
        <p className="text-muted-foreground mb-6">
          Complete onboarding to get started
        </p>
        <Link href="/onboarding">
          <Button size="lg" data-testid="button-start-onboarding">
            Start Onboarding
          </Button>
        </Link>
      </div>
    );
  }

  if (!curriculumResponse) {
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

  // Calculate week dates for the calendar
  const startDate = parseISO(curriculum.generatedAt || new Date().toISOString());
  const weekDates = curriculum.weeks.map((week, idx) => ({
    weekNumber: week.weekNumber,
    startDate: addDays(startDate, idx * 7),
    endDate: addDays(startDate, idx * 7 + 6),
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border sticky top-0 z-10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-1">
                {familyData.familyName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {familyData.city}, {familyData.state} • {familyData.country}
              </p>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              {subscription?.status === "active" && (
                <Link href="/pricing">
                  <Badge variant={subscription.plan === "pro" ? "default" : "secondary"} className="gap-1" data-testid="badge-subscription">
                    <Zap className="w-3 h-3" />
                    {subscription.plan === "pro" ? "Pro" : "Basic"}
                  </Badge>
                </Link>
              )}
              {activeUsers.length > 0 && (
                <div className="flex items-center gap-2" data-testid="presence-indicator">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-2 md:px-3 py-2 bg-card rounded-lg border border-card-border">
                        <div className="flex -space-x-2">
                          {activeUsers.slice(0, 2).map((activeUser, idx) => {
                            const initials = activeUser.userName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase();
                            return (
                              <Avatar key={`${activeUser.userId}-${idx}`} className="w-6 h-6 md:w-7 md:h-7 border-2 border-background">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                            );
                          })}
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
              <Link href="/family-settings">
                <Button variant="default" size="sm" data-testid="button-edit-family">
                  <Settings className="w-4 h-4 mr-2" />
                  <span className="hidden md:inline">Edit Family</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Calendar Sidebar */}
          <div className="hidden lg:block">
            <Card className="sticky top-24">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <CardTitle className="text-lg font-heading">12-Week Plan</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {weekDates.map(({ weekNumber, startDate, endDate }) => {
                  const isCurrentWeek = weekNumber === currentWeekNumber;
                  const progress = getWeekProgress(weekNumber);
                  const theme = curriculum.weeks[weekNumber - 1]?.familyTheme || '';
                  
                  return (
                    <button
                      key={weekNumber}
                      onClick={() => setCurrentWeekNumber(weekNumber)}
                      className={`w-full text-left p-3 rounded-lg transition-colors hover-elevate ${
                        isCurrentWeek
                          ? "bg-green-500/10 border border-green-500/30"
                          : "hover:bg-accent"
                      }`}
                      data-testid={`calendar-week-${weekNumber}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-heading font-semibold ${
                          isCurrentWeek ? "text-green-700 dark:text-green-300" : "text-foreground"
                        }`}>
                          Week {weekNumber}
                        </span>
                        {progress.completed > 0 && (
                          <Badge variant="secondary" className="h-5 text-xs">
                            {progress.completed}/{progress.total}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(startDate, 'MMM d')} – {format(endDate, 'd')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {theme}
                      </p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="space-y-6">
            {/* Mobile Week Selector */}
            <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-2">
              {curriculum.weeks.map((week) => {
                const isCurrentWeek = week.weekNumber === currentWeekNumber;
                const progress = getWeekProgress(week.weekNumber);
                
                return (
                  <button
                    key={week.weekNumber}
                    onClick={() => setCurrentWeekNumber(week.weekNumber)}
                    className={`px-4 py-2 rounded-lg font-heading font-semibold text-sm whitespace-nowrap transition-colors hover-elevate ${
                      isCurrentWeek
                        ? "bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/30"
                        : "bg-card text-card-foreground border border-card-border"
                    }`}
                    data-testid={`mobile-week-${week.weekNumber}`}
                  >
                    Week {week.weekNumber}
                    {progress.completed > 0 && ` (${progress.completed}/${progress.total})`}
                  </button>
                );
              })}
            </div>

            {/* All Weeks Accordion */}
            <Accordion
              type="single"
              collapsible
              defaultValue={currentWeekNumber ? `week-${currentWeekNumber}` : undefined}
              value={currentWeekNumber ? `week-${currentWeekNumber}` : undefined}
              onValueChange={(value) => {
                if (value) {
                  const weekNum = parseInt(value.replace('week-', ''));
                  setCurrentWeekNumber(weekNum);
                  setExpandedWeeks(prev => new Set([...prev, weekNum]));
                }
              }}
              className="space-y-4"
            >
              {curriculum.weeks.map((week, idx) => {
                const weekDatesInfo = weekDates[idx];
                const progress = getWeekProgress(week.weekNumber);
                const progressPercent = (progress.completed / progress.total) * 100;
                const isCurrentWeek = week.weekNumber === currentWeekNumber;

                return (
                  <AccordionItem
                    key={week.weekNumber}
                    value={`week-${week.weekNumber}`}
                    className={`border rounded-lg overflow-hidden ${
                      isCurrentWeek ? "border-green-500/30 bg-green-500/5" : "border-border"
                    }`}
                  >
                    <AccordionTrigger
                      className="hover:no-underline px-4 md:px-6 py-4"
                      data-testid={`accordion-week-${week.weekNumber}`}
                    >
                      <div className="flex items-start justify-between w-full pr-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Sparkles className={`w-5 h-5 ${isCurrentWeek ? "text-green-600" : "text-primary"}`} />
                            <div>
                              <h3 className="text-lg font-heading font-bold text-left">
                                Week {week.weekNumber}: {week.familyTheme}
                              </h3>
                              <p className="text-sm text-muted-foreground text-left">
                                {format(weekDatesInfo.startDate, 'MMM d')} – {format(weekDatesInfo.endDate, 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          
                          {/* Preview (when collapsed) */}
                          <div className="mt-3 space-y-2 text-left">
                            {/* Progress Ring */}
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12">
                                <svg className="w-12 h-12 transform -rotate-90">
                                  <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                    className="text-muted/20"
                                  />
                                  <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                    strokeDasharray={`${2 * Math.PI * 20}`}
                                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPercent / 100)}`}
                                    className={isCurrentWeek ? "text-green-600" : "text-primary"}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-semibold">
                                    {progress.completed}/{progress.total}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Journal Progress</p>
                                <p className="text-xs text-muted-foreground">
                                  {progress.completed} of {progress.total} days logged
                                </p>
                              </div>
                            </div>

                            {/* Preview Activities */}
                            <div className="flex flex-wrap gap-2">
                              {week.familyActivities.slice(0, 3).map((activity, actIdx) => (
                                <Badge key={actIdx} variant="secondary" className="text-xs">
                                  {activity}
                                </Badge>
                              ))}
                              {week.familyActivities.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{week.familyActivities.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Regenerate Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            regenerateWeek(week.weekNumber);
                          }}
                          disabled={isRegenerating}
                          className="ml-2 shrink-0"
                          data-testid={`button-regenerate-${week.weekNumber}`}
                        >
                          <RefreshCw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
                          <span className="hidden md:inline ml-2">Regenerate</span>
                        </Button>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 md:px-6 pb-6">
                      {/* Lazy-load full content only for expanded weeks */}
                      {expandedWeeks.has(week.weekNumber) ? (
                      <div className="space-y-6 pt-4">
                        {/* Children's Learning Plans */}
                        <div>
                          <h4 className="text-lg font-heading font-semibold mb-4">Children's Learning Plans</h4>
                          <div className="grid gap-4">
                            {week.children.map((child) => (
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
                                  {/* Daily Plan */}
                                  <Accordion type="single" collapsible className="w-full mb-4">
                                    {Object.entries(child.dailyPlan).map(([day, activities]) => (
                                      <AccordionItem key={day} value={day} className="border-primary/10">
                                        <AccordionTrigger className="hover:no-underline text-sm font-semibold">
                                          {day}
                                        </AccordionTrigger>
                                        <AccordionContent>
                                          {Array.isArray(activities) ? (
                                            <ul className="space-y-2 pl-4">
                                              {activities.map((activity, idx) => (
                                                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                                  <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                                                  <span>{activity}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <p className="text-sm text-muted-foreground pl-4">{activities}</p>
                                          )}
                                        </AccordionContent>
                                      </AccordionItem>
                                    ))}
                                  </Accordion>

                                  {/* Mastery Updates */}
                                  {Object.keys(child.masteryUpdates).length > 0 && (
                                    <div>
                                      <h5 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-primary" />
                                        Mastery Progress
                                      </h5>
                                      <div className="grid gap-3">
                                        {Object.entries(child.masteryUpdates).map(([topic, level]) => (
                                          <div key={topic} className="flex items-center justify-between">
                                            <span className="text-sm font-medium">{topic}</span>
                                            <Badge className={getMasteryColor(level)}>{level}</Badge>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>

                        {/* Local Opportunities */}
                        {week.localOpportunities && week.localOpportunities.length > 0 && (
                          <Card>
                            <CardHeader>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-primary" />
                                <CardTitle className="font-heading">Local Opportunities</CardTitle>
                              </div>
                              <CardDescription>
                                {week.localOpportunities.length} activities near you
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="grid md:grid-cols-2 gap-4">
                                {week.localOpportunities.map((opp, idx) => (
                                  <Card key={idx} className="hover-elevate">
                                    <CardContent className="p-4">
                                      <h5 className="font-heading font-semibold mb-2">{opp.name}</h5>
                                      <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                                        <div className="flex items-center gap-2">
                                          <MapPin className="w-3 h-3 shrink-0" />
                                          <span className="truncate">{opp.address}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Clock className="w-3 h-3 shrink-0" />
                                          <span>{opp.driveMinutes} min drive • {opp.dates}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <DollarSign className="w-3 h-3 shrink-0" />
                                          <span className="font-semibold text-primary">{opp.cost}</span>
                                        </div>
                                      </div>
                                      <p className="text-xs text-muted-foreground mb-3">{opp.why}</p>
                                      {opp.link && (
                                        <Button variant="outline" size="sm" className="w-full hover-elevate" asChild>
                                          <a href={opp.link} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                            Learn More
                                          </a>
                                        </Button>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Resources */}
                        {(week as any).resources && (week as any).resources.length > 0 && (
                          <Card>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-5 h-5 text-primary" />
                                  <CardTitle className="font-heading">Week {week.weekNumber} Resources</CardTitle>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyResourcesToClipboard(week.weekNumber, (week as any).resources)}
                                  disabled={copiedResources[week.weekNumber]}
                                  className="hover-elevate"
                                >
                                  {copiedResources[week.weekNumber] ? (
                                    <>
                                      <CheckCircle2 className="w-4 h-4 mr-2" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copy List
                                    </>
                                  )}
                                </Button>
                              </div>
                              <CardDescription>
                                {(week as any).resources.length} curated resources
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <Accordion type="multiple" defaultValue={["free", "low-cost", "recycled"]} className="w-full">
                                {["free", "low-cost", "recycled"].map((category) => {
                                  const categoryResources = (week as any).resources.filter((r: any) => r.category === category);
                                  if (categoryResources.length === 0) return null;

                                  const iconMap = {
                                    "free": <Gift className="w-4 h-4 text-green-600 dark:text-green-400" />,
                                    "low-cost": <Tag className="w-4 h-4 text-primary" />,
                                    "recycled": <ShoppingBasket className="w-4 h-4 text-green-700 dark:text-green-500" />,
                                  };

                                  const titleMap = {
                                    "free": "FREE Resources",
                                    "low-cost": "Budget-Friendly (under $15)",
                                    "recycled": "Recycled & Household Items",
                                  };

                                  return (
                                    <AccordionItem key={category} value={category} className="border-primary/10">
                                      <AccordionTrigger className="hover:no-underline">
                                        <div className="flex items-center gap-3">
                                          <div className="shrink-0 w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                            {iconMap[category as keyof typeof iconMap]}
                                          </div>
                                          <span className="font-heading font-semibold text-sm">{titleMap[category as keyof typeof titleMap]}</span>
                                          <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20">
                                            {categoryResources.length}
                                          </Badge>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        <div className="space-y-2 pt-2 pl-11">
                                          {categoryResources.map((resource: any, idx: number) => (
                                            <div key={idx} className="group p-3 rounded-lg border border-primary/10 hover-elevate bg-card">
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                  <h4 className="font-semibold text-sm mb-0.5">{resource.title}</h4>
                                                  <p className="text-xs text-muted-foreground">{resource.description}</p>
                                                </div>
                                                {resource.link && (
                                                  <Button variant="ghost" size="sm" asChild className="shrink-0 h-8 w-8 p-0">
                                                    <a href={resource.link} target="_blank" rel="noopener noreferrer">
                                                      <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  );
                                })}
                              </Accordion>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="text-sm">Loading week content...</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
}
