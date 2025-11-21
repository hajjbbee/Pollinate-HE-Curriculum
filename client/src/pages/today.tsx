import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Users, User, MapPin, Mic, Check, X, Flame, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import type { WeekCurriculum, DailyActivity } from "@shared/schema";
import { format, startOfWeek } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { triggerSubtleConfetti, triggerStreakConfetti } from "@/lib/confetti";
import { ExpandableActivityCard } from "@/components/ExpandableActivityCard";

export default function Today() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [completedActivities, setCompletedActivities] = useState<Set<string>>(new Set());
  const { isRecording, audioBlob, audioUrl, duration, error: recordingError, startRecording, stopRecording, resetRecording } = useVoiceRecording();
  const [summary, setSummary] = useState("");
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<string[]>([]);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const { data: familyData } = useQuery({
    queryKey: ["/api/family"],
    enabled: !!user,
  });

  const { data: curriculumResponse } = useQuery({
    queryKey: ["/api/curriculum"],
    enabled: !!user,
  });

  const { data: streakData } = useQuery<{ streak: number }>({
    queryKey: ["/api/streak"],
    enabled: !!user,
  });

  const currentStreak = streakData?.streak || 0;

  const todayDate = format(new Date(), "yyyy-MM-dd");

  const { data: dailyCompletionData } = useQuery<{ completed: number; total: number; completedIds: string[] }>({
    queryKey: ["/api/daily-completion", todayDate],
    enabled: !!user,
  });

  // Load completed activities from backend, with localStorage as fallback
  useEffect(() => {
    if (dailyCompletionData && dailyCompletionData.completedIds && dailyCompletionData.completedIds.length > 0) {
      // Hydrate from backend - this is the source of truth
      setCompletedActivities(new Set(dailyCompletionData.completedIds));
      // Also sync to localStorage for offline support
      localStorage.setItem(`completed-${todayDate}`, JSON.stringify(dailyCompletionData.completedIds));
    } else {
      // Fallback to localStorage only if backend has no data
      const stored = localStorage.getItem(`completed-${todayDate}`);
      if (stored) {
        setCompletedActivities(new Set(JSON.parse(stored)));
      }
    }
  }, [dailyCompletionData, todayDate]);

  const trackCompletionMutation = useMutation({
    mutationFn: async (data: { date: string; completed: number; total: number; completedIds: string[] }) => {
      return await apiRequest('/api/daily-completion', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/streak'] });
      queryClient.invalidateQueries({ queryKey: ['/api/daily-completion'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save progress",
        description: error.message || "Your progress couldn't be saved. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Save completed activities to localStorage and track in backend
  const toggleActivity = (activityId: string, totalActivities: number) => {
    const todayDate = format(new Date(), "yyyy-MM-dd");
    const newSet = new Set(completedActivities);
    const wasChecked = newSet.has(activityId);
    
    if (wasChecked) {
      newSet.delete(activityId);
    } else {
      newSet.add(activityId);
      // Trigger confetti when checking an activity
      triggerSubtleConfetti();
      
      // If this completes the day (all activities done), trigger bigger confetti
      if (newSet.size === totalActivities) {
        setTimeout(() => {
          triggerStreakConfetti();
        }, 300);
      }
    }
    
    setCompletedActivities(newSet);
    const completedIdsArray = Array.from(newSet);
    localStorage.setItem(`completed-${todayDate}`, JSON.stringify(completedIdsArray));
    
    // Track completion in backend with specific activity IDs
    trackCompletionMutation.mutate({
      date: todayDate,
      completed: newSet.size,
      total: totalActivities,
      completedIds: completedIdsArray,
    });
  };

  const saveJournalMutation = useMutation({
    mutationFn: async (data: { summary: string; audioUrl?: string }) => {
      // If we have an audio blob, upload it first
      let uploadedAudioUrl = data.audioUrl;
      if (audioBlob && !uploadedAudioUrl) {
        // Get upload URL
        const uploadResponse = await apiRequest('/api/objects/upload', {
          method: 'POST',
        });
        const { uploadURL } = uploadResponse;
        
        // Upload the audio blob
        await fetch(uploadURL, {
          method: 'PUT',
          body: audioBlob,
          headers: {
            'Content-Type': audioBlob.type,
          },
        });
        
        // Extract the object path from the upload URL (before the query string)
        const urlObj = new URL(uploadURL);
        uploadedAudioUrl = urlObj.pathname;
      }
      
      return await apiRequest('/api/journal-voice', {
        method: 'POST',
        body: JSON.stringify({ 
          transcript: data.summary,
          duration: duration,
          audioUrl: uploadedAudioUrl,
        }),
      });
    },
    onSuccess: (data: any) => {
      setSavedEntryId(data.entry?.id);
      if (data.followUpQuestions && data.followUpQuestions.length > 0) {
        setFollowUpQuestions(data.followUpQuestions);
        setFollowUpAnswers(new Array(data.followUpQuestions.length).fill(""));
        toast({
          title: "Voice note saved!",
          description: "We've generated some follow-up questions to help you reflect.",
        });
      } else {
        toast({
          title: "Voice note saved!",
          description: "Your journal entry has been saved successfully.",
        });
        resetRecording();
        setSummary("");
      }
      queryClient.invalidateQueries({ queryKey: ['/api/journal'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving voice note",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSaveVoiceNote = () => {
    if (summary.trim()) {
      saveJournalMutation.mutate({ summary: summary.trim() });
    } else {
      toast({
        title: "Summary required",
        description: "Please add a brief summary of today's learning.",
        variant: "destructive",
      });
    }
  };

  const handleDiscardVoiceNote = () => {
    resetRecording();
    setSummary("");
    setFollowUpQuestions([]);
    setFollowUpAnswers([]);
    setSavedEntryId(null);
  };

  const saveAnswersMutation = useMutation({
    mutationFn: async (data: { entryId: string; answers: string[] }) => {
      return await apiRequest(`/api/journal/${data.entryId}/follow-up-answers`, {
        method: 'PATCH',
        body: JSON.stringify({ answers: data.answers }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Answers saved!",
        description: "Thank you for the additional reflection.",
      });
      setFollowUpQuestions([]);
      setFollowUpAnswers([]);
      setSavedEntryId(null);
      resetRecording();
      setSummary("");
      queryClient.invalidateQueries({ queryKey: ['/api/journal'] });
    },
    onError: () => {
      toast({
        title: "Error saving answers",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (recordingError) {
      toast({
        title: "Recording Error",
        description: recordingError,
        variant: "destructive",
      });
    }
  }, [recordingError]);

  if (!familyData || !curriculumResponse) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const curriculumData = (curriculumResponse as any).curriculum?.curriculumData as { weeks: WeekCurriculum[] } | undefined;
  if (!curriculumData) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="font-heading">No curriculum yet</CardTitle>
            <CardDescription>Complete onboarding to get started</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  // Calculate current week properly with clamping
  const curriculumGeneratedAt = new Date((curriculumResponse as any).curriculum?.generatedAt || new Date());
  const weekStart = startOfWeek(curriculumGeneratedAt, { weekStartsOn: 1 }); // Monday
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate week number with proper clamping (1-12)
  const daysSinceStart = Math.floor((today.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
  const rawWeekNumber = Math.floor(daysSinceStart / 7) + 1;
  const weekNumber = Math.max(1, Math.min(rawWeekNumber, 12));
  
  // Map day number to day name (handle weekends as "Weekend")
  type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Weekend";
  const getDayName = (day: number): DayName => {
    const dayMap: DayName[] = ["Weekend", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Weekend"];
    return dayMap[day];
  };
  const todayName = getDayName(dayOfWeek);

  // Find current week with fallback to week 1
  const currentWeek = curriculumData?.weeks?.find(w => w.weekNumber === weekNumber) || curriculumData?.weeks?.[0];

  if (!currentWeek) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="font-heading">No curriculum yet</CardTitle>
            <CardDescription>Complete onboarding to get started</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Get today's activities
  const familyActivity = currentWeek.familyActivities?.[0];
  const childrenActivities = currentWeek.children?.map(child => {
    let activities: DailyActivity[] | string | null = null;
    if (todayName !== "Sunday" && todayName !== "Saturday") {
      const dayPlan = child.dailyPlan as Record<string, DailyActivity[] | string>;
      activities = dayPlan?.[todayName];
    }
    return {
      childId: child.childId,
      name: child.name,
      activity: Array.isArray(activities) ? activities[0] : activities,
    };
  }).filter(c => c.activity);

  // Get today's events (mock for now - will be connected later)
  const todayEvents: any[] = [];

  const totalActivities = 1 + (childrenActivities?.length || 0) + todayEvents.length;
  const completedCount = completedActivities.size;
  const progressPercent = totalActivities > 0 ? (completedCount / totalActivities) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-heading font-bold text-foreground">
                {format(today, "EEEE, MMMM d")}
              </h1>
              <p className="text-sm text-muted-foreground">
                Week {currentWeek.weekNumber} • {currentWeek.familyTheme}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Streak Counter */}
              {currentStreak > 0 && (
                <div className="flex flex-col items-center gap-1" data-testid="streak-counter">
                  <div className="flex items-center gap-1">
                    {currentStreak >= 7 && <Flame className="w-5 h-5 text-orange-500" data-testid="streak-fire-icon" />}
                    <span className="text-2xl font-bold text-primary" data-testid="streak-count">
                      {currentStreak}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    day streak
                  </div>
                </div>
              )}
              {/* Progress */}
              <div className="flex flex-col items-end gap-1">
                <div className="text-2xl font-bold text-primary" data-testid="progress-count">
                  {completedCount}/{totalActivities}
                </div>
                <div className="text-xs text-muted-foreground">
                  completed
                </div>
              </div>
            </div>
          </div>
          {totalActivities > 0 && (
            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Today's Plan Card */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <CardTitle className="text-xl font-heading">Today's Plan</CardTitle>
            </div>
            <CardDescription>
              Your personalized learning activities for today
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Family Activity */}
            {familyActivity && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <Users className="w-4 h-4 text-primary" />
                  <Badge variant="secondary" className="text-xs">
                    Family Time
                  </Badge>
                </div>
                <ExpandableActivityCard
                  activity={familyActivity}
                  completed={completedActivities.has("family-activity")}
                  onToggleComplete={() => toggleActivity("family-activity", totalActivities)}
                />
              </div>
            )}

            {/* Individual Child Activities */}
            {childrenActivities?.map((child, idx) => (
              <div key={child.childId} className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <User className="w-4 h-4 text-primary" />
                  <Badge variant="outline" className="text-xs">
                    {child.name}
                  </Badge>
                </div>
                <ExpandableActivityCard
                  activity={child.activity}
                  completed={completedActivities.has(`child-${child.childId}`)}
                  onToggleComplete={() => toggleActivity(`child-${child.childId}`, totalActivities)}
                />
              </div>
            ))}

            {/* Today's Events */}
            {todayEvents.length > 0 && todayEvents.map((event, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-4 p-4 rounded-lg bg-card hover-elevate border border-border"
              >
                <Checkbox
                  id={`event-${idx}`}
                  checked={completedActivities.has(`event-${idx}`)}
                  onCheckedChange={() => toggleActivity(`event-${idx}`, totalActivities)}
                  className="mt-1 h-8 w-8 rounded-full data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  data-testid={`checkbox-event-${idx}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-primary" />
                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-700 dark:text-green-300">
                      Local Event
                    </Badge>
                  </div>
                  <label
                    htmlFor={`event-${idx}`}
                    className={`text-base font-medium cursor-pointer ${
                      completedActivities.has(`event-${idx}`) ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {event.name}
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Voice Note Journal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Quick Journal</CardTitle>
            <CardDescription>
              Record a voice note about today's learning (up to 2 minutes)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              className="w-full h-16 text-lg"
              onClick={handleToggleRecording}
              data-testid="button-voice-note"
              disabled={saveJournalMutation.isPending}
            >
              <Mic className={`w-6 h-6 mr-2 ${isRecording ? "animate-pulse" : ""}`} />
              {isRecording 
                ? `Recording... ${duration}s / 120s` 
                : "Tap to start recording"}
            </Button>

            {audioUrl && !isRecording && followUpQuestions.length === 0 && (
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Your recording ({duration}s):</p>
                  <audio 
                    controls 
                    src={audioUrl} 
                    className="w-full mb-3"
                    data-testid="audio-player"
                  />
                  <Textarea
                    placeholder="Add a brief summary of today's learning..."
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-summary"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={handleSaveVoiceNote}
                    disabled={saveJournalMutation.isPending}
                    data-testid="button-save-voice-note"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {saveJournalMutation.isPending ? "Saving..." : "Save & Get AI Questions"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDiscardVoiceNote}
                    disabled={saveJournalMutation.isPending}
                    data-testid="button-discard-voice-note"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {followUpQuestions.length > 0 && (
              <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-5 h-5 text-primary mt-1" />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm mb-2">AI Follow-up Questions</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      These questions can help you reflect more deeply on today's learning:
                    </p>
                    <div className="space-y-3">
                      {followUpQuestions.map((question, idx) => (
                        <div key={idx} className="space-y-2">
                          <p className="text-sm font-medium">{question}</p>
                          <Textarea
                            placeholder="Your thoughts..."
                            value={followUpAnswers[idx] || ""}
                            onChange={(e) => {
                              const newAnswers = [...followUpAnswers];
                              newAnswers[idx] = e.target.value;
                              setFollowUpAnswers(newAnswers);
                            }}
                            className="min-h-[60px] text-sm"
                            data-testid={`input-follow-up-${idx}`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          if (savedEntryId) {
                            saveAnswersMutation.mutate({
                              entryId: savedEntryId,
                              answers: followUpAnswers,
                            });
                          }
                        }}
                        disabled={saveAnswersMutation.isPending || !savedEntryId}
                        data-testid="button-save-answers"
                      >
                        {saveAnswersMutation.isPending ? "Saving..." : "Save Answers"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setFollowUpQuestions([]);
                          setFollowUpAnswers([]);
                          setSavedEntryId(null);
                          resetRecording();
                          setSummary("");
                        }}
                        data-testid="button-skip-questions"
                      >
                        Skip for now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isRecording && (
              <p className="text-xs text-center text-muted-foreground">
                Speak naturally about what you learned today
              </p>
            )}
          </CardContent>
        </Card>

        {/* Completion Message */}
        {completedCount === totalActivities && totalActivities > 0 && (
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-heading font-bold mb-1">Amazing work today!</h3>
              <p className="text-sm text-muted-foreground">
                All activities completed. Keep up the great learning!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
