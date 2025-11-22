import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Award, Download, Plus, Edit } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Child, TranscriptCourse } from "@shared/schema";
import { getProgressLabel, getStandardConfig } from "@shared/standardsConfig";

export default function TranscriptPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const { data: childrenData, isLoading: childrenLoading } = useQuery({
    queryKey: ["/api/children"],
    enabled: !!user,
  });

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: [`/api/transcript/courses?childId=${selectedChildId}`],
    enabled: !!selectedChildId,
  });

  const children = (childrenData as Child[] | undefined) || [];
  const courses = (coursesData as TranscriptCourse[] | undefined) || [];

  const highSchoolChildren = useMemo(() => {
    return children.filter((child) => child.isHighSchoolMode);
  }, [children]);

  // Initialize selectedChildId when high school children are loaded
  useEffect(() => {
    if (!selectedChildId && highSchoolChildren.length > 0) {
      setSelectedChildId(highSchoolChildren[0].id);
    }
  }, [selectedChildId, highSchoolChildren]);

  if (childrenLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!highSchoolChildren.length) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-primary" />
              <CardTitle>High School Transcripts</CardTitle>
            </div>
            <CardDescription>
              Track academic credits and generate official transcripts for university applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No High School Students Yet</h3>
              <p className="text-muted-foreground mb-4">
                Enable High School Mode in Family Settings for children aged 12+ to start tracking credits and building transcripts.
              </p>
              <Button asChild>
                <a href="/settings">Go to Family Settings</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedChild = highSchoolChildren.find((child) => child.id === selectedChildId);
  const totalCredits = courses.reduce((sum, course) => sum + (course.credits || 0), 0);
  const completedCredits = courses.filter((course) => course.isComplete).reduce((sum, course) => sum + (course.credits || 0), 0);
  const progressPercent = totalCredits > 0 ? (completedCredits / totalCredits) * 100 : 0;
  
  // Get the correct terminology based on the child's education standard
  const progressLabels = getProgressLabel(selectedChild?.educationStandard);
  const standardConfig = getStandardConfig(selectedChild?.educationStandard);

  const subjects = ["All", "English", "Math", "Science", "History", "Elective"];
  const [selectedSubject, setSelectedSubject] = useState("All");

  const filteredCourses = useMemo(() => {
    if (selectedSubject === "All") {
      return courses;
    }
    return courses.filter((course) => course.subject.toLowerCase() === selectedSubject.toLowerCase());
  }, [courses, selectedSubject]);

  const handleDownloadTranscript = async () => {
    if (!selectedChildId) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/transcript/download/${selectedChildId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to download transcript");
      }
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Official-Transcript-${selectedChild?.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Transcript Downloaded",
        description: "Your official transcript PDF is ready to print or submit to universities.",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Unable to generate transcript PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">High School Transcripts</h1>
          <p className="text-muted-foreground">
            Track academic credits and generate official transcripts
          </p>
        </div>
        <Button 
          onClick={handleDownloadTranscript} 
          disabled={isDownloading || !selectedChildId || courses.length === 0}
          data-testid="button-download-transcript"
        >
          <Download className="w-4 h-4 mr-2" />
          {isDownloading ? "Generating..." : "Download Transcript PDF"}
        </Button>
      </div>

      {/* Child Selector Tabs */}
      <Tabs value={selectedChildId || ""} onValueChange={setSelectedChildId}>
        <TabsList>
          {highSchoolChildren.map((child: any) => (
            <TabsTrigger key={child.id} value={child.id} data-testid={`tab-child-${child.id}`}>
              {child.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span>{selectedChild?.name}'s Progress</span>
                <Badge variant="outline" className="text-xs font-normal">
                  {standardConfig.flag} {standardConfig.shortName}
                </Badge>
              </CardTitle>
              <CardDescription>
                {completedCredits.toFixed(1)} of {totalCredits.toFixed(1)} {progressLabels.creditUnit} completed
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{completedCredits.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Earned</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{totalCredits.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progressPercent} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progressLabels.creditLabel}</span>
            <span>{progressLabels.gradeTerminology}</span>
          </div>
        </CardContent>
      </Card>

      {/* Subject Filter */}
      <div className="flex gap-2">
        {subjects.map((subject) => (
          <Button
            key={subject}
            variant={selectedSubject === subject ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSubject(subject)}
            data-testid={`button-filter-${subject.toLowerCase()}`}
          >
            {subject}
          </Button>
        ))}
      </div>

      {/* Courses List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Courses</h2>
          <Button data-testid="button-add-course">
            <Plus className="w-4 h-4 mr-2" />
            Add Course
          </Button>
        </div>

        {coursesLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Courses Yet</h3>
              <p className="text-muted-foreground mb-4">
                Courses are automatically generated from your curriculum activities. 
                Complete activities in your weekly plans to start building credits.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredCourses.map((course: any) => {
            const standard = selectedChild?.educationStandard || 'us';
            
            // Build standard-specific metadata display
            const standardMetadata = [];
            if (standard === 'uk' && course.gcseLevel) {
              standardMetadata.push(`${course.gcseLevel}`);
            } else if (standard === 'ib' && course.ibGroup) {
              standardMetadata.push(`${course.ibGroup}`);
            } else if (standard === 'australia-nz' && course.nceaStandardCode) {
              standardMetadata.push(`NCEA ${course.nceaStandardCode}`);
            } else if (standard === 'eu' && course.ectsCredits) {
              standardMetadata.push(`${course.ectsCredits} ECTS`);
            }
            
            return (
              <Card key={course.id} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{course.courseTitle}</CardTitle>
                        {course.isComplete && (
                          <Badge variant="default" className="bg-green-600">
                            Complete
                          </Badge>
                        )}
                        {standardMetadata.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {standardMetadata[0]}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        Grade {course.gradeLevel} • {course.credits} {progressLabels.creditUnit}{course.credits !== 1 ? 's' : ''}
                        {course.grade && ` • ${progressLabels.gradeTerminology}: ${course.grade}`}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" data-testid={`button-edit-course-${course.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
              {course.courseDescription && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{course.courseDescription}</p>
                  {(course.startDate || course.endDate) && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {course.startDate && `Started: ${new Date(course.startDate).toLocaleDateString()}`}
                      {course.startDate && course.endDate && " • "}
                      {course.endDate && `Ended: ${new Date(course.endDate).toLocaleDateString()}`}
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
