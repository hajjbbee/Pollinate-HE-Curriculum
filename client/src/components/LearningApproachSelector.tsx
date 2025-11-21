import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Trees, Palette, Heart, Sparkles, GraduationCap, Shuffle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type LearningApproach = 
  | "charlotte-mason"
  | "montessori"
  | "waldorf"
  | "unschooling"
  | "project-based"
  | "classical"
  | "eclectic"
  | "perfect-blend";

interface ApproachInfo {
  id: LearningApproach;
  name: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGradient: string;
  strengths: string[];
}

const approaches: ApproachInfo[] = [
  {
    id: "perfect-blend",
    name: "Perfect Blend",
    tagline: "Best of everything, tailored to your family",
    description: "Let our AI expertly blend Charlotte Mason, Montessori, Waldorf, and project-based learning to create the ideal curriculum for your children's unique interests and learning styles.",
    icon: Sparkles,
    color: "text-primary",
    bgGradient: "from-primary/10 via-primary/5 to-background",
    strengths: ["Personalised fusion", "Adapts to each child", "Depth & breadth", "No dogma"],
  },
  {
    id: "charlotte-mason",
    name: "Charlotte Mason",
    tagline: "Living books, nature, short lessons",
    description: "Emphasises living books, nature study, narration, and short focused lessons. Develops lifelong learning habits through literature-rich education and outdoor exploration.",
    icon: BookOpen,
    color: "text-green-600 dark:text-green-400",
    bgGradient: "from-green-50 dark:from-green-950/20 to-background",
    strengths: ["Rich literature", "Nature focus", "Habit formation", "Short lessons"],
  },
  {
    id: "montessori",
    name: "Montessori",
    tagline: "Child-led, hands-on learning",
    description: "Child-led discovery with hands-on materials. Fosters independence, concentration, and natural curiosity through carefully prepared environments and self-directed activity.",
    icon: GraduationCap,
    color: "text-blue-600 dark:text-blue-400",
    bgGradient: "from-blue-50 dark:from-blue-950/20 to-background",
    strengths: ["Independence", "Hands-on materials", "Self-paced", "Concentration"],
  },
  {
    id: "waldorf",
    name: "Waldorf/Steiner",
    tagline: "Imagination, rhythm, artistic expression",
    description: "Nurtures imagination through arts, storytelling, and rhythmic learning. Emphasises creativity, seasonal celebrations, and holistic development of head, heart, and hands.",
    icon: Palette,
    color: "text-purple-600 dark:text-purple-400",
    bgGradient: "from-purple-50 dark:from-purple-950/20 to-background",
    strengths: ["Artistic", "Imaginative play", "Seasonal rhythm", "Holistic"],
  },
  {
    id: "unschooling",
    name: "Unschooling",
    tagline: "Child-led, interest-driven exploration",
    description: "Follows your child's natural curiosity and interests completely. Learning emerges organically from real-life experiences, questions, and passions without prescribed curriculum.",
    icon: Heart,
    color: "text-rose-600 dark:text-rose-400",
    bgGradient: "from-rose-50 dark:from-rose-950/20 to-background",
    strengths: ["Maximum freedom", "Interest-led", "Intrinsic motivation", "Real-world learning"],
  },
  {
    id: "project-based",
    name: "Project-Based",
    tagline: "Deep dives, hands-on projects",
    description: "Learning through engaging, multi-week projects that integrate multiple subjects. Children develop problem-solving skills and deep understanding through meaningful, hands-on work.",
    icon: Trees,
    color: "text-amber-600 dark:text-amber-400",
    bgGradient: "from-amber-50 dark:from-amber-950/20 to-background",
    strengths: ["Deep focus", "Real-world skills", "Integration", "Engagement"],
  },
  {
    id: "classical",
    name: "Classical",
    tagline: "Trivium, logic, great books",
    description: "Follows the three stages of learning: grammar, logic, and rhetoric. Emphasises foundational knowledge, critical thinking, and engagement with classical literature and ideas.",
    icon: BookOpen,
    color: "text-indigo-600 dark:text-indigo-400",
    bgGradient: "from-indigo-50 dark:from-indigo-950/20 to-background",
    strengths: ["Structured progression", "Logic & rhetoric", "Great books", "Academic rigour"],
  },
  {
    id: "eclectic",
    name: "Eclectic",
    tagline: "Mix and match what works",
    description: "Combines methods and resources from various approaches based on what works best for your family. Flexible and pragmatic, adapting to each child's needs and your values.",
    icon: Shuffle,
    color: "text-cyan-600 dark:text-cyan-400",
    bgGradient: "from-cyan-50 dark:from-cyan-950/20 to-background",
    strengths: ["Flexibility", "Personalised", "Pragmatic", "Adaptable"],
  },
];

interface LearningApproachSelectorProps {
  value?: LearningApproach;
  onChange: (approach: LearningApproach) => void;
  hideTitle?: boolean;
}

export function LearningApproachSelector({ value, onChange, hideTitle }: LearningApproachSelectorProps) {
  const [selected, setSelected] = useState<LearningApproach | undefined>(value);

  const handleSelect = (approach: LearningApproach) => {
    setSelected(approach);
    onChange(approach);
  };

  return (
    <div className="space-y-6">
      {!hideTitle && (
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-heading font-bold">Choose Your Learning Approach</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Select the educational philosophy that resonates with your family. 
            Our AI will adapt the curriculum to match your chosen approach.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {approaches.map((approach) => {
          const Icon = approach.icon;
          const isSelected = selected === approach.id;
          const isPerfectBlend = approach.id === "perfect-blend";

          return (
            <Card
              key={approach.id}
              className={cn(
                "relative cursor-pointer transition-all hover-elevate active-elevate-2",
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                isPerfectBlend && "md:col-span-2 lg:col-span-2"
              )}
              onClick={() => handleSelect(approach.id)}
              data-testid={`card-approach-${approach.id}`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 z-10">
                  <div className="bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}

              <CardHeader className={cn("pb-3", isPerfectBlend && "md:text-center")}>
                <div className={cn("flex items-start gap-3", isPerfectBlend && "md:flex-col md:items-center")}>
                  <div className={cn(
                    "rounded-lg p-3 bg-gradient-to-br",
                    approach.bgGradient
                  )}>
                    <Icon className={cn("w-6 h-6", approach.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-heading flex items-center gap-2">
                      {approach.name}
                      {isPerfectBlend && (
                        <Badge variant="default" className="ml-2">
                          Recommended
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {approach.tagline}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm text-foreground/80">
                  {approach.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {approach.strengths.map((strength) => (
                    <Badge
                      key={strength}
                      variant="secondary"
                      className="text-xs font-normal"
                    >
                      {strength}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
