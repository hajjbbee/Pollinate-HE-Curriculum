import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Library, ExternalLink, DollarSign, Recycle, Gift } from "lucide-react";
import type { WeekCurriculum, Resource } from "@shared/schema";
import { startOfWeek } from "date-fns";

export default function Resources() {
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

  const getResourceIcon = (category: Resource["category"]) => {
    switch (category) {
      case "free":
        return <Gift className="w-4 h-4" />;
      case "low-cost":
        return <DollarSign className="w-4 h-4" />;
      case "recycled":
        return <Recycle className="w-4 h-4" />;
    }
  };

  const getResourceBadgeColor = (category: Resource["category"]) => {
    switch (category) {
      case "free":
        return "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20";
      case "low-cost":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
      case "recycled":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Resources
          </h1>
          <p className="text-sm text-muted-foreground">
            Week {currentWeek.weekNumber} • {currentWeek.familyTheme}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Library className="w-5 h-5 text-primary" />
              <CardTitle className="font-heading">Curated Resources</CardTitle>
            </div>
            <CardDescription>
              {currentWeek.resources?.length || 0} resources for this week's theme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentWeek.resources?.map((resource, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg border border-border hover-elevate bg-card"
                data-testid={`resource-${idx}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-base mb-1">{resource.title}</h4>
                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getResourceBadgeColor(resource.category)} gap-1 whitespace-nowrap`}
                  >
                    {getResourceIcon(resource.category)}
                    {resource.category.charAt(0).toUpperCase() + resource.category.slice(1)}
                  </Badge>
                </div>
                {resource.link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    asChild
                  >
                    <a
                      href={resource.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-resource-${idx}`}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View Resource
                    </a>
                  </Button>
                )}
              </div>
            ))}
            {(!currentWeek.resources || currentWeek.resources.length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                No resources available for this week
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
