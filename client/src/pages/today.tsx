import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Users, User, MapPin, Mic, CheckCircle2, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import type { WeekCurriculum } from "@shared/schema";
import { format, startOfWeek, addDays, isToday } from "date-fns";

export default function Today() {
  const { user } = useAuth();
  const [completedActivities, setCompletedActivities] = useState<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);

  const { data: familyData } = useQuery({
    queryKey: ["/api/family"],
    enabled: !!user,
  });

  const { data: curriculumResponse } = useQuery({
    queryKey: ["/api/curriculum"],
    enabled: !!user,
  });

  // Load completed activities from localStorage
  useEffect(() => {
    const todayDate = format(new Date(), "yyyy-MM-dd");
    const stored = localStorage.getItem(`completed-${todayDate}`);
    if (stored) {
      setCompletedActivities(new Set(JSON.parse(stored)));
    }
  }, []);

  // Save completed activities to localStorage
  const toggleActivity = (activityId: string) => {
    const todayDate = format(new Date(), "yyyy-MM-dd");
    const newSet = new Set(completedActivities);
    if (newSet.has(activityId)) {
      newSet.delete(activityId);
    } else {
      newSet.add(activityId);
    }
    setCompletedActivities(newSet);
    localStorage.setItem(`completed-${todayDate}`, JSON.stringify(Array.from(newSet)));
  };

  const handleVoiceNote = () => {
    setIsRecording(!isRecording);
    // TODO: Implement voice recording
  };

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
  
  // Get current week and today's day
  const currentWeekStartDate = new Date((curriculumResponse as any).curriculum?.generatedAt || new Date());
  const weekStart = startOfWeek(currentWeekStartDate, { weekStartsOn: 1 }); // Monday
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Map day number to day name
  type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Weekend";
  const dayNames: (string | DayName)[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[dayOfWeek] as DayName | "Sunday" | "Saturday";

  // Find current week
  const weekNumber = Math.floor((today.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const currentWeek = curriculumData?.weeks?.find(w => w.weekNumber === Math.min(weekNumber, 12)) || curriculumData?.weeks?.[0];

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
    let activities: string[] | string | null = null;
    if (todayName !== "Sunday" && todayName !== "Saturday") {
      const dayPlan = child.dailyPlan as Record<string, string[] | string>;
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                {format(today, "EEEE, MMMM d")}
              </h1>
              <p className="text-sm text-muted-foreground">
                Week {currentWeek.weekNumber} • {currentWeek.familyTheme}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-2xl font-bold text-primary">
                {completedCount}/{totalActivities}
              </div>
              <div className="text-xs text-muted-foreground">
                completed
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
              <div className="flex items-start gap-4 p-4 rounded-lg bg-card hover-elevate border border-border">
                <Checkbox
                  id="family-activity"
                  checked={completedActivities.has("family-activity")}
                  onCheckedChange={() => toggleActivity("family-activity")}
                  className="mt-1 h-8 w-8 rounded-full data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  data-testid="checkbox-family-activity"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-primary" />
                    <Badge variant="secondary" className="text-xs">
                      Family Time
                    </Badge>
                  </div>
                  <label
                    htmlFor="family-activity"
                    className={`text-base font-medium cursor-pointer ${
                      completedActivities.has("family-activity") ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {familyActivity}
                  </label>
                </div>
              </div>
            )}

            {/* Individual Child Activities */}
            {childrenActivities?.map((child, idx) => (
              <div 
                key={child.childId}
                className="flex items-start gap-4 p-4 rounded-lg bg-card hover-elevate border border-border"
              >
                <Checkbox
                  id={`child-activity-${child.childId}`}
                  checked={completedActivities.has(`child-${child.childId}`)}
                  onCheckedChange={() => toggleActivity(`child-${child.childId}`)}
                  className="mt-1 h-8 w-8 rounded-full data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  data-testid={`checkbox-child-activity-${idx}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-primary" />
                    <Badge variant="outline" className="text-xs">
                      {child.name}
                    </Badge>
                  </div>
                  <label
                    htmlFor={`child-activity-${child.childId}`}
                    className={`text-base font-medium cursor-pointer ${
                      completedActivities.has(`child-${child.childId}`) ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {child.activity}
                  </label>
                </div>
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
                  onCheckedChange={() => toggleActivity(`event-${idx}`)}
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
              Record a 30-second voice note about today's learning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              className="w-full h-16 text-lg"
              onClick={handleVoiceNote}
              data-testid="button-voice-note"
            >
              <Mic className={`w-6 h-6 mr-2 ${isRecording ? "animate-pulse" : ""}`} />
              {isRecording ? "Recording... (Tap to stop)" : "Tap to record voice note"}
            </Button>
            {isRecording && (
              <p className="text-sm text-center text-muted-foreground mt-2">
                Recording will auto-stop at 30 seconds
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
