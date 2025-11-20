import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, User } from "lucide-react";
import type { WeekCurriculum } from "@shared/schema";
import { format, startOfWeek } from "date-fns";

export default function ThisWeek() {
  const { user } = useAuth();

  const { data: familyData } = useQuery({
    queryKey: ["/api/family"],
    enabled: !!user,
  });

  const { data: curriculumResponse } = useQuery({
    queryKey: ["/api/curriculum"],
    enabled: !!user,
  });

  if (!familyData || !curriculumResponse) {
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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Week {currentWeek.weekNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentWeek.familyTheme}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Family Activities */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle className="font-heading">Family Activities</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentWeek.familyActivities?.map((activity, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm">{activity}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Children's Deep Dives */}
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
                Deep Dives: {child.deepDives?.join(", ")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(child.dailyPlan || {}).map(([day, activities]) => {
                if (day === "Weekend") {
                  return (
                    <div key={day} className="border-t border-border pt-3">
                      <h4 className="font-semibold text-sm mb-2">{day}</h4>
                      <p className="text-sm text-muted-foreground">{activities}</p>
                    </div>
                  );
                }
                return (
                  <div key={day}>
                    <h4 className="font-semibold text-sm mb-2">{day}</h4>
                    <div className="space-y-1">
                      {Array.isArray(activities) ? activities.map((activity, idx) => (
                        <p key={idx} className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/30">
                          {activity}
                        </p>
                      )) : (
                        <p className="text-sm text-muted-foreground">{activities}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
