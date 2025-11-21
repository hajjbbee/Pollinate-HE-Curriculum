import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings as SettingsIcon, LogOut, MapPin, Users, Calendar, Plus, Trash2, ChevronDown, Sparkles } from "lucide-react";
import { SiFacebook } from "react-icons/si";
import { LearningApproachSelector, type LearningApproach } from "@/components/LearningApproachSelector";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newGroupUrl, setNewGroupUrl] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  
  const [eventForms, setEventForms] = useState<{
    [groupId: string]: {
      eventName: string;
      eventDate: string;
      location: string;
      cost: string;
      description: string;
      ticketUrl: string;
    };
  }>({});

  const { data: familyData, isLoading: familyLoading } = useQuery({
    queryKey: ["/api/family"],
    retry: false,
    enabled: !!user,
  });

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ["/api/children"],
    retry: false,
    enabled: !!user,
  });

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["/api/groups"],
    retry: false,
    enabled: !!user,
  });

  const { data: familyApproach, isLoading: approachLoading } = useQuery({
    queryKey: ["/api/family/approach"],
    retry: false,
    enabled: !!familyData,
  });

  const addGroupMutation = useMutation({
    mutationFn: async ({ groupUrl, groupName }: { groupUrl: string; groupName: string }) => {
      return await apiRequest("POST", "/api/groups", { groupUrl, groupName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setNewGroupUrl("");
      setNewGroupName("");
      toast({
        title: "Group added",
        description: "You can now manually add events from this group.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add group",
        variant: "destructive",
      });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      return await apiRequest("DELETE", `/api/groups/${groupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Group removed",
        description: "The group has been removed from your list.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove group",
        variant: "destructive",
      });
    },
  });

  const addEventMutation = useMutation({
    mutationFn: async ({ groupId, eventData }: { groupId: string; eventData: any }) => {
      return await apiRequest("POST", `/api/groups/${groupId}/events`, eventData);
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/week"] });
      setEventForms(prev => ({
        ...prev,
        [groupId]: {
          eventName: "",
          eventDate: "",
          location: "",
          cost: "FREE",
          description: "",
          ticketUrl: "",
        },
      }));
      setExpandedGroup(null);
      toast({
        title: "Event added!",
        description: "The event has been added and will appear on your dashboard.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add event",
        variant: "destructive",
      });
    },
  });

  const updateApproachMutation = useMutation({
    mutationFn: async (approach: string) => {
      return await apiRequest("PUT", "/api/family/approach", { approach });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family/approach"] });
      toast({
        title: "Learning Approach Updated",
        description: "Your curriculum will reflect this approach when regenerated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update learning approach",
        variant: "destructive",
      });
    },
  });

  const getEventForm = (groupId: string) => {
    if (!eventForms[groupId]) {
      return {
        eventName: "",
        eventDate: "",
        location: "",
        cost: "FREE",
        description: "",
        ticketUrl: "",
      };
    }
    return eventForms[groupId];
  };

  const updateEventForm = (groupId: string, field: string, value: string) => {
    setEventForms(prev => ({
      ...prev,
      [groupId]: {
        ...getEventForm(groupId),
        [field]: value,
      },
    }));
  };

  if (familyLoading || childrenLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const calculateAge = (birthdate: string) => {
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <SettingsIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Manage your account and family information</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Account</CardTitle>
            <CardDescription>Your profile information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user?.profileImageUrl} />
                <AvatarFallback className="text-lg">
                  {getInitials(`${user?.firstName || ""} ${user?.lastName || ""}`)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-heading font-semibold text-lg">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" asChild data-testid="button-logout">
              <a href="/api/logout">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </a>
            </Button>
          </CardContent>
        </Card>

        {familyData && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <CardTitle className="font-heading">Family Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Family Name</p>
                <p className="font-semibold">{familyData.familyName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Location</p>
                <p className="font-semibold">
                  {familyData.city}, {familyData.state} {familyData.postalCode}
                </p>
                <p className="text-sm text-muted-foreground">{familyData.country}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Travel Radius</p>
                <p className="font-semibold">{familyData.travelRadiusMinutes} minutes</p>
                {familyData.flexForHighInterest && (
                  <p className="text-sm text-primary">Flex for high interest enabled</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {familyData && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <CardTitle className="font-heading">Learning Approach</CardTitle>
              </div>
              <CardDescription>
                Choose the educational philosophy that guides your family's curriculum
              </CardDescription>
            </CardHeader>
            <CardContent>
              {approachLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <LearningApproachSelector
                  value={(familyApproach?.approach || "perfect-blend") as LearningApproach}
                  onChange={(approach) => updateApproachMutation.mutate(approach)}
                  hideTitle={true}
                />
              )}
            </CardContent>
          </Card>
        )}

        {children && children.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <CardTitle className="font-heading">Children</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {children.map((child: any) => (
                  <Card key={child.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-heading font-semibold text-lg">{child.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Age {calculateAge(child.birthdate)}
                          </p>
                        </div>
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                      </div>
                      {child.interests && child.interests.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-muted-foreground mb-1">Interests</p>
                          <div className="flex flex-wrap gap-1">
                            {child.interests.map((interest: string, idx: number) => (
                              <span
                                key={idx}
                                className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full"
                              >
                                {interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {child.learningStyle && (
                        <p className="text-xs text-muted-foreground">
                          Learning Style: {child.learningStyle}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-[#1877F2] flex items-center justify-center">
                <SiFacebook className="w-3 h-3 text-white" />
              </div>
              <CardTitle className="font-heading">My Homeschool Groups</CardTitle>
            </div>
            <CardDescription>
              Manage Facebook groups where you find educational events. Add events manually from your groups to see them alongside your curriculum.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!groupsLoading && groups && groups.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Your Groups</Label>
                <div className="space-y-3">
                  {groups.map((group: any) => (
                    <Collapsible
                      key={group.id}
                      open={expandedGroup === group.id}
                      onOpenChange={(open) => setExpandedGroup(open ? group.id : null)}
                    >
                      <div className="rounded-lg border border-border">
                        <div className="flex items-center gap-4 p-4" data-testid={`group-card-${group.id}`}>
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded bg-[#1877F2]/10 flex items-center justify-center flex-shrink-0">
                              <SiFacebook className="w-5 h-5 text-[#1877F2]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">{group.groupName}</p>
                              <a
                                href={group.groupUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline truncate block"
                              >
                                {group.groupUrl}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-add-event-${group.id}`}>
                                <Plus className="w-4 h-4 mr-1" />
                                Add Event
                                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${expandedGroup === group.id ? 'rotate-180' : ''}`} />
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteGroupMutation.mutate(group.id)}
                              disabled={deleteGroupMutation.isPending}
                              data-testid={`button-delete-group-${group.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <CollapsibleContent>
                          <div className="border-t border-border p-4 bg-muted/30 space-y-3">
                            <p className="text-sm text-muted-foreground mb-3">
                              Add an event you found in {group.groupName}
                            </p>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor={`event-name-${group.id}`} className="text-sm">
                                    Event Name *
                                  </Label>
                                  <Input
                                    id={`event-name-${group.id}`}
                                    placeholder="Nature Walk & Craft"
                                    value={getEventForm(group.id).eventName}
                                    onChange={(e) => updateEventForm(group.id, "eventName", e.target.value)}
                                    data-testid={`input-event-name-${group.id}`}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`event-date-${group.id}`} className="text-sm">
                                    Date & Time *
                                  </Label>
                                  <Input
                                    id={`event-date-${group.id}`}
                                    type="datetime-local"
                                    value={getEventForm(group.id).eventDate}
                                    onChange={(e) => updateEventForm(group.id, "eventDate", e.target.value)}
                                    data-testid={`input-event-date-${group.id}`}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor={`event-location-${group.id}`} className="text-sm">
                                    Location *
                                  </Label>
                                  <Input
                                    id={`event-location-${group.id}`}
                                    placeholder="City Park, Denver"
                                    value={getEventForm(group.id).location}
                                    onChange={(e) => updateEventForm(group.id, "location", e.target.value)}
                                    data-testid={`input-event-location-${group.id}`}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`event-cost-${group.id}`} className="text-sm">
                                    Cost
                                  </Label>
                                  <Input
                                    id={`event-cost-${group.id}`}
                                    placeholder="FREE"
                                    value={getEventForm(group.id).cost}
                                    onChange={(e) => updateEventForm(group.id, "cost", e.target.value)}
                                    data-testid={`input-event-cost-${group.id}`}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label htmlFor={`event-description-${group.id}`} className="text-sm">
                                  Description (optional)
                                </Label>
                                <Textarea
                                  id={`event-description-${group.id}`}
                                  placeholder="Bring the kids for a guided nature walk followed by leaf crafts..."
                                  value={getEventForm(group.id).description}
                                  onChange={(e) => updateEventForm(group.id, "description", e.target.value)}
                                  rows={2}
                                  data-testid={`input-event-description-${group.id}`}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`event-url-${group.id}`} className="text-sm">
                                  Event URL (optional)
                                </Label>
                                <Input
                                  id={`event-url-${group.id}`}
                                  placeholder="https://..."
                                  value={getEventForm(group.id).ticketUrl}
                                  onChange={(e) => updateEventForm(group.id, "ticketUrl", e.target.value)}
                                  data-testid={`input-event-url-${group.id}`}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    const form = getEventForm(group.id);
                                    if (!form.eventName || !form.eventDate || !form.location) {
                                      toast({
                                        title: "Missing information",
                                        description: "Please fill in event name, date, and location.",
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    addEventMutation.mutate({
                                      groupId: group.id,
                                      eventData: form,
                                    });
                                  }}
                                  disabled={addEventMutation.isPending}
                                  data-testid={`button-save-event-${group.id}`}
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Save Event
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => setExpandedGroup(null)}
                                  data-testid={`button-cancel-event-${group.id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <Label className="text-sm font-semibold">Add a New Group</Label>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="group-url" className="text-sm">
                    Facebook Group URL
                  </Label>
                  <Input
                    id="group-url"
                    placeholder="https://www.facebook.com/groups/yourgroup"
                    value={newGroupUrl}
                    onChange={(e) => setNewGroupUrl(e.target.value)}
                    data-testid="input-group-url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Example: https://www.facebook.com/groups/denverwildandfree
                  </p>
                </div>
                <div>
                  <Label htmlFor="group-name" className="text-sm">
                    Group Name
                  </Label>
                  <Input
                    id="group-name"
                    placeholder="Denver Wild and Free"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    data-testid="input-group-name"
                  />
                </div>
                <Button
                  onClick={() => addGroupMutation.mutate({ groupUrl: newGroupUrl, groupName: newGroupName })}
                  disabled={!newGroupUrl || !newGroupName || addGroupMutation.isPending}
                  data-testid="button-add-group"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Group
                </Button>
              </div>
            </div>

            {groups && groups.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Tip:</strong> After adding a group, you can manually add events from it. Events will appear in your dashboard's "From Your Groups" section and match your curriculum themes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
