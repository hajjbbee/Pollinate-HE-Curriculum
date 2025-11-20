import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ObjectUploader } from "@/components/ObjectUploader";
import { BookOpen, Star, Smile, Meh, ChevronDown, ChevronUp, Sparkles, Mic, Image as ImageIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { UploadResult } from "@uppy/core";
import type { WeekCurriculum } from "@shared/schema";

type ReactionType = "loved" | "okay" | "not_today";

interface ActivityFeedback {
  activityId: string;
  reaction?: ReactionType;
  notes?: string;
  photoUrl?: string;
  voiceNoteUrl?: string;
}

export default function Journal() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [feedbackMap, setFeedbackMap] = useState<Record<string, ActivityFeedback>>({});
  const [emergingInterestsOpen, setEmergingInterestsOpen] = useState(true);
  const [emergingTitle, setEmergingTitle] = useState("");
  const [emergingDescription, setEmergingDescription] = useState("");
  const [emergingPhotoUrl, setEmergingPhotoUrl] = useState("");

  const todayDate = format(new Date(), "yyyy-MM-dd");

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ["/api/children"],
    enabled: !!user,
  });

  const { data: curriculumResponse, isLoading: curriculumLoading } = useQuery({
    queryKey: ["/api/curriculum"],
    enabled: !!user,
  });

  const { data: dailyCompletionData } = useQuery<{ completed: number; total: number; completedIds: string[] }>({
    queryKey: ["/api/daily-completion", todayDate],
    enabled: !!user,
  });

  const completedIds = dailyCompletionData?.completedIds || [];
  const hasCompletedActivities = completedIds.length > 0;

  // Auto-open emerging interests when no completed activities
  useEffect(() => {
    setEmergingInterestsOpen(!hasCompletedActivities);
  }, [hasCompletedActivities]);

  const saveFeedbackMutation = useMutation({
    mutationFn: async (data: { childId: string; activityId: string; reaction: ReactionType; notes?: string; photoUrl?: string }) => {
      // Backend upsert logic handles create-or-update automatically
      const response = await apiRequest("POST", "/api/activity-feedback", {
        childId: data.childId,
        activityId: data.activityId,
        activityDate: todayDate,
        reaction: data.reaction,
        notes: data.notes,
        photoUrl: data.photoUrl,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback saved!",
        description: "Activity feedback has been recorded.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving feedback",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveEmergingInterestMutation = useMutation({
    mutationFn: async (data: { childId: string; title: string; description?: string; photoUrl?: string }) => {
      return await apiRequest("POST", "/api/emerging-interests", data);
    },
    onSuccess: () => {
      toast({
        title: "Interest captured!",
        description: "Emerging interest has been added to your child's profile.",
      });
      setEmergingTitle("");
      setEmergingDescription("");
      setEmergingPhotoUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/emerging-interests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving interest",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReactionClick = (activityId: string, childId: string, reaction: ReactionType) => {
    setFeedbackMap(prev => {
      const currentFeedback = prev[activityId] || {};
      const newReaction = currentFeedback.reaction === reaction ? undefined : reaction;
      
      const updated = {
        ...prev,
        [activityId]: {
          ...currentFeedback,
          activityId,
          reaction: newReaction,
        },
      };
      
      // Save to backend if a reaction is selected (synchronous payload derivation)
      const feedbackToSave = updated[activityId];
      if (feedbackToSave.reaction) {
        // Use setTimeout to avoid mutating during render
        setTimeout(() => {
          saveFeedbackMutation.mutate({
            childId,
            activityId,
            reaction: feedbackToSave.reaction!,
            notes: feedbackToSave.notes,
            photoUrl: feedbackToSave.photoUrl,
          });
        }, 0);
      }
      
      return updated;
    });
  };

  const handleUploadComplete = async (activityId: string, childId: string, result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    const uploadedUrls = result.successful?.map((file) => file.uploadURL) || [];
    if (uploadedUrls.length > 0) {
      const photoUrl = uploadedUrls[0];
      
      // Set photo ACL
      try {
        await apiRequest("PUT", "/api/journal-photos", { photoURL: photoUrl });
      } catch (error) {
        console.error("Failed to set photo ACL:", error);
      }

      // Update local state and persist if reaction exists (synchronous payload derivation)
      setFeedbackMap(prev => {
        const updated = {
          ...prev,
          [activityId]: {
            ...(prev[activityId] || { activityId }),
            photoUrl,
          },
        };
        
        // Save to backend if a reaction already exists
        const feedbackToSave = updated[activityId];
        if (feedbackToSave.reaction) {
          // Use setTimeout to avoid mutating during render
          setTimeout(() => {
            saveFeedbackMutation.mutate({
              childId,
              activityId,
              reaction: feedbackToSave.reaction!,
              notes: feedbackToSave.notes,
              photoUrl,
            });
          }, 0);
        }
        
        return updated;
      });

      const feedbackState = feedbackMap[activityId];
      toast({
        title: "Photo uploaded!",
        description: feedbackState?.reaction 
          ? "Photo has been added to your feedback."
          : "Photo added. Select an emoji reaction to save.",
      });
    }
  };

  const handleEmergingPhotoUpload = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    const uploadedUrls = result.successful?.map((file) => file.uploadURL) || [];
    if (uploadedUrls.length > 0) {
      const photoUrl = uploadedUrls[0];
      
      try {
        await apiRequest("PUT", "/api/journal-photos", { photoURL: photoUrl });
      } catch (error) {
        console.error("Failed to set photo ACL:", error);
      }

      setEmergingPhotoUrl(photoUrl || "");
      toast({
        title: "Photo uploaded!",
        description: "Photo has been added.",
      });
    }
  };

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload", {});
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleSaveEmergingInterest = () => {
    const childrenArray = children as any[] | undefined;
    if (!emergingTitle.trim() || !childrenArray || childrenArray.length === 0) {
      toast({
        title: "Missing information",
        description: "Please add a title for the interest.",
        variant: "destructive",
      });
      return;
    }

    // For now, assign to first child (in future, could let user select)
    const childId = childrenArray[0].id;
    
    saveEmergingInterestMutation.mutate({
      childId,
      title: emergingTitle,
      description: emergingDescription,
      photoUrl: emergingPhotoUrl,
    });
  };

  if (childrenLoading || curriculumLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const curriculumData = (curriculumResponse as any)?.curriculum?.curriculumData as { weeks: WeekCurriculum[] } | undefined;

  // Get today's completed activities
  const getCompletedActivities = () => {
    const childrenArray = children as any[] | undefined;
    if (!curriculumData || !childrenArray) return [];

    const activities: Array<{ id: string; childId: string; childName: string; activityText: string; type: string }> = [];

    // Parse completed IDs
    completedIds.forEach(id => {
      if (id === "family-activity") {
        activities.push({
          id: "family-activity",
          childId: "family",
          childName: "Family",
          activityText: "Family Activity",
          type: "family",
        });
      } else if (id.startsWith("child-")) {
        const childId = id.replace("child-", "");
        const child = childrenArray.find((c: any) => c.id === childId);
        if (child) {
          activities.push({
            id,
            childId: child.id,
            childName: child.name,
            activityText: `${child.name}'s Activity`,
            type: "individual",
          });
        }
      }
    });

    return activities;
  };

  const completedActivities = getCompletedActivities();

  const reactionIcons: Record<ReactionType, { icon: any; label: string; emoji: string }> = {
    loved: { icon: Star, label: "Loved it", emoji: "🌟" },
    okay: { icon: Smile, label: "Okay", emoji: "🙂" },
    not_today: { icon: Meh, label: "Not today", emoji: "😅" },
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground">Daily Journal</h1>
              <p className="text-muted-foreground">Quick feedback on today's learning</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        {/* Completed Activities Feedback */}
        {completedActivities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">How did today go?</CardTitle>
              <CardDescription>Quick reactions to today's completed activities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {completedActivities.map((activity) => {
                const feedback = feedbackMap[activity.id] || {};
                
                return (
                  <div key={activity.id} className="border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {activity.childName}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">{activity.activityText}</span>
                    </div>

                    {/* Emoji Reactions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {(Object.keys(reactionIcons) as ReactionType[]).map((reactionType) => {
                        const reaction = reactionIcons[reactionType];
                        const isSelected = feedback.reaction === reactionType;
                        const IconComponent = reaction.icon;

                        return (
                          <Button
                            key={reactionType}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleReactionClick(activity.id, activity.childId, reactionType)}
                            className="gap-1"
                            data-testid={`button-reaction-${reactionType}-${activity.id}`}
                          >
                            <span className="text-base">{reaction.emoji}</span>
                            <span className="text-xs">{reaction.label}</span>
                          </Button>
                        );
                      })}
                    </div>

                    {/* Optional Photo Upload */}
                    {feedback.photoUrl ? (
                      <div className="relative">
                        <img 
                          src={feedback.photoUrl} 
                          alt="Activity photo" 
                          className="w-full max-w-xs rounded-lg border border-border"
                        />
                      </div>
                    ) : (
                      <ObjectUploader
                        onGetUploadParameters={handleGetUploadParameters}
                        onComplete={(result) => handleUploadComplete(activity.id, activity.childId, result)}
                        maxNumberOfFiles={1}
                        buttonClassName="gap-2"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Add Photo
                      </ObjectUploader>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Emerging Interests Section */}
        <Collapsible open={emergingInterestsOpen} onOpenChange={setEmergingInterestsOpen}>
          <Card className="border-2 border-primary/30">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover-elevate active-elevate-2" data-testid="button-toggle-emerging-interests">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-primary" />
                    <div>
                      <CardTitle className="font-heading text-xl">Anything else today?</CardTitle>
                      <CardDescription>Capture spontaneous obsessions (completely optional)</CardDescription>
                    </div>
                  </div>
                  {emergingInterestsOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <p className="text-sm text-muted-foreground italic">
                  My kid suddenly cared about whales / baking / ancient Greece / the neighbor's cat…
                </p>

                <Separator />

                {/* Smart Suggestions (placeholder for AI-generated suggestions) */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="cursor-pointer hover-elevate" data-testid="suggestion-chip-hamsters">
                    Hamsters again? 🐹
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer hover-elevate" data-testid="suggestion-chip-lego">
                    More LEGO volcanoes? 🌋
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      What was it? <span className="text-muted-foreground">(required)</span>
                    </label>
                    <input
                      type="text"
                      value={emergingTitle}
                      onChange={(e) => setEmergingTitle(e.target.value)}
                      placeholder="e.g., 'Dinosaurs', 'Making slime', 'Ancient Egypt'"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="input-emerging-title"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Tell me more <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Textarea
                      value={emergingDescription}
                      onChange={(e) => setEmergingDescription(e.target.value)}
                      placeholder="What exactly got them excited? How long did they spend on it?"
                      className="min-h-[80px]"
                      data-testid="textarea-emerging-description"
                    />
                  </div>

                  {/* Photo Upload */}
                  {emergingPhotoUrl ? (
                    <div className="relative">
                      <img 
                        src={emergingPhotoUrl} 
                        alt="Interest photo" 
                        className="w-full max-w-xs rounded-lg border border-border"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEmergingPhotoUrl("")}
                        className="mt-2"
                      >
                        Remove Photo
                      </Button>
                    </div>
                  ) : (
                    <ObjectUploader
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleEmergingPhotoUpload}
                      maxNumberOfFiles={1}
                      buttonClassName="gap-2"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Add Photo
                    </ObjectUploader>
                  )}

                  <Button 
                    onClick={handleSaveEmergingInterest}
                    disabled={!emergingTitle.trim() || saveEmergingInterestMutation.isPending}
                    className="w-full gap-2"
                    data-testid="button-save-emerging-interest"
                  >
                    <Sparkles className="w-4 h-4" />
                    {saveEmergingInterestMutation.isPending ? "Saving..." : "Capture This Interest"}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
