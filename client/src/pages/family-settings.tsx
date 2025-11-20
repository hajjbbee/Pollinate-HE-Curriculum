import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { MapPin, User, Calendar, Plus, Trash2, Save, Sparkles, Facebook } from "lucide-react";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import { useLocation } from "wouter";

const familySettingsSchema = z.object({
  familyName: z.string().min(1, "Family name is required"),
  country: z.enum(["US", "AU", "NZ"]),
  address: z.string().min(5, "Please enter a valid address"),
  lat: z.number().optional(),
  lng: z.number().optional(),
  travelRadiusMinutes: z.number().min(15).max(120),
  flexForHighInterest: z.boolean(),
  children: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, "Name is required"),
      birthdate: z.string().min(1, "Birthdate is required"),
      interests: z.string().min(1, "Please add at least one interest"),
      learningStyle: z.string().optional(),
    })
  ).min(1, "Please add at least one child"),
});

type FamilySettingsData = z.infer<typeof familySettingsSchema>;

export default function FamilySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [newGroupUrl, setNewGroupUrl] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

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

  const { data: facebookGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["/api/groups"],
    retry: false,
    enabled: !!user,
  });

  const form = useForm<FamilySettingsData>({
    resolver: zodResolver(familySettingsSchema),
    defaultValues: {
      familyName: "",
      country: "US",
      address: "",
      lat: undefined,
      lng: undefined,
      travelRadiusMinutes: 30,
      flexForHighInterest: true,
      children: [
        {
          name: "",
          birthdate: "",
          interests: "",
          learningStyle: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "children",
  });

  useEffect(() => {
    if (familyData && children) {
      form.reset({
        familyName: familyData.familyName || "",
        country: familyData.country || "US",
        address: familyData.address || "",
        lat: familyData.latitude,
        lng: familyData.longitude,
        travelRadiusMinutes: familyData.travelRadiusMinutes || 30,
        flexForHighInterest: familyData.flexForHighInterest ?? true,
        children: children.map((child: any) => ({
          id: child.id,
          name: child.name,
          birthdate: child.birthdate,
          interests: Array.isArray(child.interests) ? child.interests.join(", ") : "",
          learningStyle: child.learningStyle || "",
        })),
      });
    }
  }, [familyData, children]);

  const addGroupMutation = useMutation({
    mutationFn: async (data: { groupUrl: string; groupName: string }) => {
      return await apiRequest("POST", "/api/groups", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setNewGroupUrl("");
      setNewGroupName("");
      toast({
        title: "Facebook group connected!",
        description: "Events from this group will appear in your Homeschool Happenings.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add group",
        description: error.message || "Please check the URL and try again.",
        variant: "destructive",
      });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      return await apiRequest("DELETE", `/api/groups/${groupId}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Group disconnected",
        description: "Events from this group will no longer appear.",
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: FamilySettingsData) => {
      return await apiRequest("PUT", "/api/family/settings", {
        ...data,
        children: data.children.map(child => ({
          ...child,
          interests: child.interests.split(",").map(i => i.trim()),
        })),
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      
      toast({
        title: "Settings updated!",
        description: "Your curriculum is being refreshed with the new details...",
      });
      
      setIsRegenerating(true);
      
      try {
        await apiRequest("POST", "/api/curriculum/regenerate", {});
        queryClient.invalidateQueries({ queryKey: ["/api/curriculum"] });
        setIsRegenerating(false);
        toast({
          title: "Curriculum regenerated!",
          description: "Your 12-week curriculum has been updated with your new family settings.",
        });
        navigate("/");
      } catch (error: any) {
        setIsRegenerating(false);
        
        // Check for specific error codes
        const errorData = error.response?.data || error;
        
        if (errorData.code === "INSUFFICIENT_CREDITS") {
          toast({
            title: "Insufficient AI credits",
            description: "Your settings were saved successfully, but curriculum regeneration requires additional OpenRouter credits. Please contact support or try again later.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Curriculum regeneration failed",
            description: errorData.message || error.message || "Your settings were saved, but there was an error regenerating your curriculum. You can try regenerating from the dashboard.",
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handlePlaceSelected = (place: any) => {
    if (place.geometry?.location) {
      form.setValue("lat", place.geometry.location.lat());
      form.setValue("lng", place.geometry.location.lng());
    }
  };

  const onSubmit = (data: FamilySettingsData) => {
    updateSettingsMutation.mutate(data);
  };

  if (familyLoading || childrenLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Family Settings</h1>
        <p className="text-muted-foreground">
          Edit your family information and children's details. Saving will automatically regenerate your curriculum.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Family Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <CardTitle className="font-heading">Family Information</CardTitle>
              </div>
              <CardDescription>Your family name and location</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="familyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Family Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="The Smith Family" data-testid="input-family-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-country">
                          <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="NZ">New Zealand</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Location & Travel Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <CardTitle className="font-heading">Location & Travel</CardTitle>
              </div>
              <CardDescription>Your home address and travel preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home Address</FormLabel>
                    <FormControl>
                      <PlacesAutocomplete
                        value={field.value}
                        onChange={field.onChange}
                        onPlaceSelected={handlePlaceSelected}
                        placeholder="123 Main St, Seattle, WA 98101"
                        country={form.watch("country")}
                        dataTestId="input-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="travelRadiusMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Travel Radius: {field.value} minutes</FormLabel>
                    <FormControl>
                      <Slider
                        min={15}
                        max={120}
                        step={15}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="py-4"
                        data-testid="slider-travel-radius"
                      />
                    </FormControl>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>15 min</span>
                      <span>120 min</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="flexForHighInterest"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Flexibility for High Interest</FormLabel>
                      <FormDescription>
                        Go beyond your usual travel radius for exceptional opportunities
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-flex-interest"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Children */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <CardTitle className="font-heading">Children</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: "", birthdate: "", interests: "", learningStyle: "" })}
                  data-testid="button-add-child"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Child
                </Button>
              </div>
              <CardDescription>Add or edit information about your children</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg space-y-4 hover-elevate">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-heading font-semibold">Child {index + 1}</h4>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        data-testid={`button-remove-child-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name={`children.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Child's name" data-testid={`input-child-name-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`children.${index}.birthdate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Birthdate</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid={`input-child-birthdate-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`children.${index}.interests`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interests</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="dinosaurs, space, art, coding (comma-separated)"
                            data-testid={`input-child-interests-${index}`}
                          />
                        </FormControl>
                        <FormDescription>Comma-separated list</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`children.${index}.learningStyle`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Learning Style (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="visual, hands-on, needs movement, etc."
                            data-testid={`input-child-learning-style-${index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Facebook Groups (Optional) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Facebook className="w-5 h-5 text-blue-600" />
                <CardTitle>Connected Facebook Groups (Optional)</CardTitle>
              </div>
              <CardDescription>
                Connect 1-5 private homeschool Facebook groups to automatically discover local events.
                We'll match events to your curriculum themes and show them in "Homeschool Happenings Near You".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Group Form */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="group-url">Facebook Group URL</Label>
                    <Input
                      id="group-url"
                      placeholder="https://www.facebook.com/groups/groupname"
                      value={newGroupUrl}
                      onChange={(e) => setNewGroupUrl(e.target.value)}
                      data-testid="input-group-url"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input
                      id="group-name"
                      placeholder="Denver Wild & Free"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      data-testid="input-group-name"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addGroupMutation.mutate({ groupUrl: newGroupUrl, groupName: newGroupName })}
                  disabled={!newGroupUrl || !newGroupName || addGroupMutation.isPending || (facebookGroups?.length ?? 0) >= 5}
                  data-testid="button-add-group"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {addGroupMutation.isPending ? "Adding..." : "Add Group"}
                </Button>
                {(facebookGroups?.length ?? 0) >= 5 && (
                  <p className="text-sm text-muted-foreground">
                    Maximum of 5 groups reached. Remove a group to add another.
                  </p>
                )}
              </div>

              {/* Connected Groups List */}
              {groupsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : facebookGroups && facebookGroups.length > 0 ? (
                <div className="space-y-2">
                  <Label>Connected Groups ({facebookGroups.length}/5)</Label>
                  {facebookGroups.map((group: any) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                      data-testid={`group-item-${group.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Facebook className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="font-medium" data-testid={`text-group-name-${group.id}`}>
                            {group.groupName}
                          </p>
                          <p className="text-sm text-muted-foreground truncate max-w-md">
                            {group.groupUrl}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteGroupMutation.mutate(group.id)}
                        disabled={deleteGroupMutation.isPending}
                        data-testid={`button-remove-group-${group.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No groups connected yet. Add a group above to get started!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateSettingsMutation.isPending || isRegenerating}
              className="min-w-32"
              data-testid="button-save-settings"
            >
              {updateSettingsMutation.isPending || isRegenerating ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save & Regenerate
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
