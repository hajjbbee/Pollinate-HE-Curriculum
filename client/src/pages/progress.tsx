import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Award, Target, User } from "lucide-react";
import type { WeekCurriculum } from "@shared/schema";
import { startOfWeek } from "date-fns";

export default function ProgressPage() {
  const { user } = useAuth();

  const { data: curriculumResponse } = useQuery({
    queryKey: ["/api/curriculum"],
    enabled: !!user,
  });

  if (!curriculumResponse) {
    return (
      <div className="p-4 space-y-4 pb-24">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const curriculumData = (curriculumResponse as any).curriculum?.curriculumData as { weeks: WeekCurriculum[] } | undefined;
  if (!curriculumData) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 pb-24">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="font-heading">No curriculum yet</CardTitle>
            <CardDescription>Complete onboarding to get started</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  const currentWeekStartDate = new Date((curriculumResponse as any).curriculum?.generatedAt || new Date());
  const weekStart = startOfWeek(currentWeekStartDate, { weekStartsOn: 1 });
  const today = new Date();
  const weekNumber = Math.floor((today.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const currentWeek = curriculumData?.weeks?.find(w => w.weekNumber === Math.min(weekNumber, 12)) || curriculumData?.weeks?.[0];

  if (!currentWeek) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 pb-24">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="font-heading">No curriculum yet</CardTitle>
            <CardDescription>Complete onboarding to get started</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const getMasteryColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "mastery":
      case "mentor":
        return "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20";
      case "strong":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
      case "developing":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
      case "exposure":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getMasteryPercent = (level: string) => {
    switch (level.toLowerCase()) {
      case "mentor":
        return 100;
      case "mastery":
        return 90;
      case "strong":
        return 70;
      case "developing":
        return 50;
      case "exposure":
        return 25;
      default:
        return 0;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Progress
          </h1>
          <p className="text-sm text-muted-foreground">
            Mastery tracking for your children
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-6 text-center">
              <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">Week {currentWeek.weekNumber}</div>
              <p className="text-xs text-muted-foreground">Current week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Award className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">{currentWeek.children?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Learners</p>
            </CardContent>
          </Card>
        </div>

        {/* Children's Mastery Progress */}
        {currentWeek.children?.map((child) => (
          <Card key={child.childId}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <CardTitle className="font-heading">{child.name}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  Age {child.age}
                </Badge>
              </div>
              <CardDescription>
                Currently exploring: {child.deepDives?.join(", ")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(child.masteryUpdates || {}).map(([topic, level]) => (
                <div key={topic} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{topic}</h4>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ml-2 ${getMasteryColor(level)}`}
                    >
                      {level}
                    </Badge>
                  </div>
                  <Progress value={getMasteryPercent(level)} className="h-2" />
                </div>
              ))}
              {(!child.masteryUpdates || Object.keys(child.masteryUpdates).length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No mastery updates yet for this week
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Deep Dives Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <CardTitle className="font-heading">This Week's Focus</CardTitle>
            </div>
            <CardDescription>
              {currentWeek.familyTheme}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentWeek.children?.map((child) => (
                <div key={child.childId} className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="font-semibold text-sm mb-1">{child.name}</div>
                  <div className="flex flex-wrap gap-1">
                    {child.deepDives?.map((dive, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {dive}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
