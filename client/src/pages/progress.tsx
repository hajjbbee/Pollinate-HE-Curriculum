import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, Award, BookOpen, Calendar } from "lucide-react";
import type { WeekCurriculum, CurriculumData } from "@shared/schema";
import { format } from "date-fns";
import jsPDF from "jspdf";

interface MasteryRingProps {
  subject: string;
  percentage: number;
  color: string;
}

function MasteryRing({ subject, percentage, color }: MasteryRingProps) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="48"
            cy="48"
            r="45"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx="48"
            cy="48"
            r="45"
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{percentage}%</span>
        </div>
      </div>
      <span className="text-sm font-medium text-center">{subject}</span>
    </div>
  );
}

export default function ProgressPage() {
  const { user } = useAuth();

  const { data: curriculumResponse } = useQuery({
    queryKey: ["/api/curriculum"],
    enabled: !!user,
  });

  const { data: childrenData } = useQuery<any[]>({
    queryKey: ["/api/children"],
    enabled: !!user,
  });

  const { data: journalData } = useQuery<any[]>({
    queryKey: ["/api/journal"],
    enabled: !!user,
  });

  const isLoading = !curriculumResponse || !childrenData || !journalData;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 pb-24">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const curriculumData = (curriculumResponse as any).curriculum?.curriculumData as CurriculumData | undefined;
  const children = childrenData || [];
  const journalEntries = journalData || [];

  if (!curriculumData || children.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 pb-24">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="font-heading">No progress data yet</CardTitle>
            <CardDescription>Complete onboarding to get started</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Calculate mastery percentages across all weeks for each child
  const calculateMastery = (childId: string) => {
    const subjectMastery: Record<string, number[]> = {};
    
    curriculumData.weeks.forEach(week => {
      const childPlan = week.children?.find(c => c.childId === childId);
      if (childPlan?.masteryUpdates) {
        Object.entries(childPlan.masteryUpdates).forEach(([subject, level]) => {
          if (!subjectMastery[subject]) {
            subjectMastery[subject] = [];
          }
          const percentage = getMasteryPercent(level);
          subjectMastery[subject].push(percentage);
        });
      }
    });

    // Average mastery levels for each subject
    const averaged: Record<string, number> = {};
    Object.entries(subjectMastery).forEach(([subject, levels]) => {
      averaged[subject] = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
    });

    return averaged;
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

  const getMasteryColor = (percentage: number) => {
    if (percentage >= 90) return "#22c55e"; // green
    if (percentage >= 70) return "#3b82f6"; // blue
    if (percentage >= 50) return "#f59e0b"; // amber
    return "#a855f7"; // purple
  };

  // Get deep dives with journal photos for each child
  const getDeepDivesTimeline = (childId: string) => {
    const deepDives: Array<{
      topic: string;
      weekNumber: number;
      entries: Array<{ date: string; photoUrls: string[]; content: string }>;
    }> = [];

    curriculumData.weeks.forEach(week => {
      const childPlan = week.children?.find(c => c.childId === childId);
      if (childPlan?.deepDives) {
        childPlan.deepDives.forEach(topic => {
          const relatedEntries = journalEntries
            .filter(entry => 
              entry.childId === childId && 
              entry.content?.toLowerCase().includes(topic.toLowerCase())
            )
            .map(entry => ({
              date: entry.entryDate,
              photoUrls: entry.photoUrls || [],
              content: entry.content,
            }));

          if (relatedEntries.length > 0) {
            deepDives.push({
              topic,
              weekNumber: week.weekNumber,
              entries: relatedEntries,
            });
          }
        });
      }
    });

    return deepDives;
  };

  // Generate PDF portfolio
  const generatePortfolioPDF = () => {
    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.text("Homeschool Portfolio", 105, yPos, { align: "center" });
    yPos += 15;

    doc.setFontSize(12);
    doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy")}`, 105, yPos, { align: "center" });
    yPos += 20;

    children.forEach((child, childIndex) => {
      if (childIndex > 0) {
        doc.addPage();
        yPos = 20;
      }

      // Child header
      doc.setFontSize(16);
      doc.text(`${child.name} (Age ${child.age})`, 20, yPos);
      yPos += 10;

      // Mastery summary
      doc.setFontSize(12);
      doc.text("Subject Mastery:", 20, yPos);
      yPos += 8;

      const mastery = calculateMastery(child.id);
      doc.setFontSize(10);
      Object.entries(mastery).forEach(([subject, percentage]) => {
        doc.text(`  ${subject}: ${percentage}%`, 25, yPos);
        yPos += 6;
      });
      yPos += 5;

      // Deep dives
      doc.setFontSize(12);
      doc.text("Deep Dive Topics:", 20, yPos);
      yPos += 8;

      const deepDives = getDeepDivesTimeline(child.id);
      doc.setFontSize(10);
      deepDives.forEach(dive => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`  Week ${dive.weekNumber}: ${dive.topic}`, 25, yPos);
        yPos += 6;
        doc.text(`    ${dive.entries.length} journal entries`, 30, yPos);
        yPos += 8;
      });
    });

    doc.save(`portfolio-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                Progress
              </h1>
              <p className="text-sm text-muted-foreground">
                Mastery tracking and portfolio
              </p>
            </div>
            <Button 
              onClick={generatePortfolioPDF}
              variant="default"
              size="sm"
              data-testid="button-export-pdf"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6 max-w-4xl mx-auto">
        {children.map(child => {
          const mastery = calculateMastery(child.id);
          const deepDives = getDeepDivesTimeline(child.id);
          const childJournalEntries = journalEntries.filter(e => e.childId === child.id);

          return (
            <div key={child.id} className="space-y-4">
              {/* Child Header with Portrait */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16" data-testid={`avatar-child-${child.id}`}>
                      <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                        {child.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="font-heading text-xl">{child.name}</CardTitle>
                      <CardDescription>Age {child.age}</CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{childJournalEntries.length}</div>
                      <div className="text-xs text-muted-foreground">Journal Entries</div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Mastery Rings */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
                    <CardTitle className="font-heading">Subject Mastery</CardTitle>
                  </div>
                  <CardDescription>
                    Overall progress across 12 weeks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(mastery).length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {Object.entries(mastery).map(([subject, percentage]) => (
                        <MasteryRing
                          key={subject}
                          subject={subject}
                          percentage={percentage}
                          color={getMasteryColor(percentage)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No mastery data yet - keep learning!
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Deep Dives Timeline */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <CardTitle className="font-heading">Deep Dives Mastered</CardTitle>
                  </div>
                  <CardDescription>
                    Topics explored with journal documentation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {deepDives.length > 0 ? (
                    <div className="space-y-4">
                      {deepDives.map((dive, idx) => (
                        <div 
                          key={idx} 
                          className="border-l-4 border-primary/30 pl-4 py-2 space-y-2"
                          data-testid={`deep-dive-${idx}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm">{dive.topic}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Calendar className="w-3 h-3" />
                                <span>Week {dive.weekNumber}</span>
                                <span>•</span>
                                <span>{dive.entries.length} journal entries</span>
                              </div>
                            </div>
                            {dive.entries.some(e => e.photoUrls.length > 0) && (
                              <div className="flex gap-1">
                                {dive.entries
                                  .filter(e => e.photoUrls.length > 0)
                                  .slice(0, 3)
                                  .map((entry, photoIdx) => (
                                    <div
                                      key={photoIdx}
                                      className="w-12 h-12 rounded bg-muted border border-border overflow-hidden"
                                      data-testid={`photo-thumbnail-${photoIdx}`}
                                    >
                                      <img
                                        src={entry.photoUrls[0]}
                                        alt="Journal entry"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No deep dives documented yet. Start journaling to build your portfolio!
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
