import { useState } from "react";
import { ChevronDown, Lightbulb, Sprout, Sun, TreeDeciduous } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export interface ConfidenceExample {
  title: string;
  description: string;
  ageRange?: string;
}

export interface ActivityWithExamples {
  activity: string;
  examples?: {
    quickEasy: ConfidenceExample;
    mediumAdventure: ConfidenceExample;
    deepDive: ConfidenceExample;
  };
}

interface ExpandableActivityCardProps {
  activity: string | ActivityWithExamples;
  completed?: boolean;
  onToggleComplete?: () => void;
}

export function ExpandableActivityCard({
  activity,
  completed,
  onToggleComplete,
}: ExpandableActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activityData: ActivityWithExamples =
    typeof activity === "string" ? { activity } : activity;

  const hasExamples = activityData.examples !== undefined;

  return (
    <Card
      className={`transition-all ${completed ? "opacity-60" : ""}`}
      data-testid="card-activity"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {onToggleComplete && (
            <Checkbox
              checked={completed}
              onCheckedChange={onToggleComplete}
              className="mt-1"
              data-testid="checkbox-activity-complete"
              aria-label={completed ? "Mark as incomplete" : "Mark as complete"}
            />
          )}

          <div className="flex-1">
            <button
              onClick={() => hasExamples && setIsExpanded(!isExpanded)}
              className={`w-full text-left flex items-center justify-between gap-2 group ${
                hasExamples ? "hover-elevate cursor-pointer" : ""
              }`}
              disabled={!hasExamples}
              data-testid="button-expand-activity"
            >
              <span
                className={`${
                  completed ? "line-through text-muted-foreground" : ""
                }`}
              >
                {activityData.activity}
              </span>
              {hasExamples && (
                <ChevronDown
                  className={`w-5 h-5 transition-transform flex-shrink-0 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  style={{ color: "hsl(150, 25%, 50%)" }}
                  data-testid="icon-chevron"
                />
              )}
            </button>

            {isExpanded && hasExamples && activityData.examples && (
              <div className="mt-4 space-y-4" data-testid="section-examples">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Lightbulb className="w-4 h-4" />
                  <span>3 Confidence-Boosting Examples</span>
                </div>

                <div className="space-y-3">
                  <ExampleCard
                    icon={<Sprout className="w-4 h-4" />}
                    number={1}
                    title={activityData.examples.quickEasy.title}
                    description={activityData.examples.quickEasy.description}
                    ageRange={activityData.examples.quickEasy.ageRange}
                    pedagogy={activityData.examples.quickEasy.pedagogy}
                    testId="example-quick-easy"
                  />

                  <ExampleCard
                    icon={<Sun className="w-4 h-4" />}
                    number={2}
                    title={activityData.examples.mediumAdventure.title}
                    description={
                      activityData.examples.mediumAdventure.description
                    }
                    ageRange={activityData.examples.mediumAdventure.ageRange}
                    pedagogy={activityData.examples.mediumAdventure.pedagogy}
                    testId="example-medium-adventure"
                  />

                  <ExampleCard
                    icon={<TreeDeciduous className="w-4 h-4" />}
                    number={3}
                    title={activityData.examples.deepDive.title}
                    description={activityData.examples.deepDive.description}
                    ageRange={activityData.examples.deepDive.ageRange}
                    pedagogy={activityData.examples.deepDive.pedagogy}
                    testId="example-deep-dive"
                  />
                </div>

                <p className="text-xs text-muted-foreground italic mt-4">
                  You've got this — even 5 minutes counts as real learning ✨
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ExampleCardProps {
  icon: React.ReactNode;
  number: number;
  title: string;
  description: string;
  ageRange?: string;
  pedagogy?: string;
  testId: string;
}

function ExampleCard({
  icon,
  number,
  title,
  description,
  ageRange,
  pedagogy,
  testId,
}: ExampleCardProps) {
  return (
    <div
      className="bg-muted/30 rounded-md p-3 space-y-1"
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="font-medium text-sm">{title}</span>
        {pedagogy && (
          <span className="text-xs text-muted-foreground">{pedagogy}</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground pl-8">{description}</p>
      {ageRange && (
        <p className="text-xs text-muted-foreground italic pl-8">{ageRange}</p>
      )}
    </div>
  );
}
